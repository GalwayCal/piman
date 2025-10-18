import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import apiRequest from '../../utils/api';
import config from '../../config';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';
import 'xterm/css/xterm.css';
import './Terminal.css';

const Terminal = () => {
  const { user } = useAuth();
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const terminalRef = useRef(null);
  const socketRef = useRef(null);
  const termRef = useRef(null);
  const connectedRef = useRef(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rebooting, setRebooting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Helper function to show notifications
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Auto-hide after 5 seconds
  };

  useEffect(() => {
    fetchDeviceInfo();
  }, [deviceId]);

  const fetchDeviceInfo = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/devices/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDeviceInfo(data);
      }
    } catch (error) {
      console.error('Error fetching device info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRebootClick = () => {
    setShowConfirmModal(true);
  };

  const confirmReboot = async () => {
    setShowConfirmModal(false);
    
    try {
      setRebooting(true);
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/devices/${deviceId}/reboot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showNotification('Reboot command sent successfully. The device will shut down and restart. Reconnecting in 30 seconds...', 'success');
        // Disconnect the terminal since the device is rebooting
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        // Wait 30 seconds for the device to reboot, then reload the page to reconnect
        setTimeout(() => {
          window.location.reload();
        }, 30000);
      } else {
        const error = await response.json();
        // Check if the error is due to the device rebooting (which is expected)
        if (error.error && error.error.includes('reboot')) {
          showNotification('Reboot command sent successfully! The device is shutting down and will restart. Reconnecting in 30 seconds...', 'success');
          // Wait 30 seconds for the device to reboot, then reload the page to reconnect
          setTimeout(() => {
            window.location.reload();
          }, 30000);
        } else {
          showNotification(`Failed to reboot device: ${error.error}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error rebooting device:', error);
      showNotification('Network error while trying to reboot device', 'error');
    } finally {
      setRebooting(false);
    }
  };

  const cancelReboot = () => {
    setShowConfirmModal(false);
  };

  useEffect(() => {
    if (!terminalRef.current || !deviceInfo) return;



    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: '#264f78'
      },
      rows: 30,
      cols: 80,
      scrollback: 1000,
      allowTransparency: false,
      convertEol: true
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Store terminal reference
    termRef.current = term;

    // Wait for the DOM to be ready
    setTimeout(() => {
      if (terminalRef.current) {
        term.open(terminalRef.current);
        fitAddon.fit();
        term.focus();
        
        // Ensure the terminal element is focusable
        if (term.element) {
          term.element.tabIndex = 0;
          term.element.focus();
        }
        
        // Force terminal to be visible
        if (term.element) {
          term.element.style.display = 'block';
          term.element.style.visibility = 'visible';
          term.element.style.opacity = '1';
        }
        
        
      }
    }, 100);

    // Initialize WebSocket connection
    const token = localStorage.getItem('authToken');
    // Use config API_URL for WebSocket, or fallback to current origin
    const wsUrl = config.API_URL || window.location.origin;
    const socket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    term.writeln(`Connecting to ${deviceInfo?.name} (${deviceInfo?.ip})...`);
    


    socket.on('connect', () => {
      term.writeln('WebSocket connected, establishing SSH...');
    });

    socket.on('disconnect', () => {
      connectedRef.current = false;
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      term.writeln(`WebSocket error: ${error.message}`);
    });

    // Connect to SSH via WebSocket
    socket.emit('terminal:connect', { deviceId, token });

    // Handle WebSocket events
    socket.on('terminal:connected', (data) => {
      term.writeln(data.message);
      term.writeln('');
      connectedRef.current = true;
      setConnected(true);
      
      // Ensure terminal is ready for input
      setTimeout(() => {
        term.focus();
        term.write('\r\n'); // Add a newline to ensure prompt is visible
        

        
        // Force terminal refresh
        if (term.element) {
          term.refresh(0, term.rows - 1);
        }
      }, 100);
    });
    
    // Set connected to true when we receive the first data (indicating SSH is working)
    socket.on('terminal:data', (data) => {
      // Set connected to true on first data received
      if (!connectedRef.current) {
        connectedRef.current = true;
        setConnected(true);
      }
      
      // Ensure the terminal is focused and write the data
      term.focus();
      
      // Write the raw data without cleaning - let xterm.js handle control sequences
      term.write(data.data);
      
      // Force terminal refresh and ensure visibility
      setTimeout(() => {
        if (term.element) {
          term.element.style.display = 'block';
          term.element.style.visibility = 'visible';
          term.element.style.opacity = '1';
          term.refresh(0, term.rows - 1);
          
          // Force a repaint
          term.element.style.transform = 'translateZ(0)';
        }
      }, 10);
    });

    socket.on('terminal:error', (data) => {
      term.writeln(`\r\nError: ${data.message}`);
      connectedRef.current = false;
      setConnected(false);
    });

    socket.on('terminal:disconnected', (data) => {
      term.writeln(`\r\n${data.message}`);
      connectedRef.current = false;
      setConnected(false);
    });

    // Handle terminal input
    term.onData((data) => {
      if (socket && socket.connected && connectedRef.current) {
        socket.emit('terminal:command', { command: data });
      }
    });

    // Handle terminal resize
    const handleResize = () => {
      try {
        fitAddon.fit();
        if (socket && socket.connected) {
          const dims = fitAddon.proposeDimensions();
          if (dims) {
            socket.emit('terminal:resize', { rows: dims.rows, cols: dims.cols });
          }
        }
      } catch (error) {
        console.warn('Terminal resize error:', error);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (socket) {
        socket.disconnect();
      }
      try {
        term.dispose();
      } catch (error) {
        console.warn('Terminal dispose error:', error);
      }
    };
  }, [deviceId, deviceInfo]);



  if (loading) {
    return (
      <div className="terminal-container">
        <div className="loading">Loading terminal...</div>
      </div>
    );
  }

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/devices')} title="Back to devices">
            <FontAwesomeIcon icon={faArrowLeft} size="sm" />
            Back
          </button>
          <div className="device-info">
            <h2>{deviceInfo?.name}</h2>
            <p>{deviceInfo?.ip}</p>
          </div>
        </div>
        <div className="header-right">
          <div className="connection-status">
            <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {hasPermission(user, PERMISSIONS.REBOOT_DEVICES) && (
            <button 
              className="action-btn" 
              onClick={handleRebootClick}
              disabled={rebooting}
              title="Reboot device"
            >
              <FontAwesomeIcon icon={faPowerOff} size="sm" />
            </button>
          )}
        </div>
      </div>

      <div className="terminal-content">
        <div 
          ref={terminalRef} 
          className="terminal" 
          onClick={() => {
            if (termRef.current) {
              termRef.current.focus();
            }
          }}

          style={{ 
            border: '1px solid #404040', 
            height: '100%',
            backgroundColor: '#1e1e1e',
            cursor: 'text'
          }}
        />
      </div>
      
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Reboot</h3>
            <p>Are you sure you want to reboot this device? The device will shut down and restart, which will disconnect the terminal.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelReboot}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={confirmReboot} disabled={rebooting}>
                {rebooting ? 'Rebooting...' : 'Reboot'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Notification */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default Terminal; 