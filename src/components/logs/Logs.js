import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import apiRequest from '../../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileAlt, 
  faFilter, 
  faSearch,
  faSync,
  faDownload,
  faTrash
} from '@fortawesome/free-solid-svg-icons';
import './Logs.css';

const Logs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const logsEndRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // Helper function to show notifications
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest('/api/logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data);
        setError(null);
      } else {
        setError('Failed to fetch logs');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Show clear confirmation modal
  const handleClearClick = () => {
    setShowClearModal(true);
  };

  // Cancel clear
  const cancelClear = () => {
    setShowClearModal(false);
  };

  // Confirm clear
  const confirmClear = useCallback(async () => {
    setShowClearModal(false);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest('/api/logs/clear', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showNotification('Logs cleared successfully', 'success');
        fetchLogs();
      } else {
        showNotification('Failed to clear logs', 'error');
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      showNotification('Network error while clearing logs', 'error');
    }
  }, [showNotification, fetchLogs]);

  // Download logs
  const handleDownloadLogs = () => {
    const logText = filteredLogs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `piman-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Logs downloaded successfully', 'success');
  };

  // Filter logs
  useEffect(() => {
    let filtered = logs;

    // Filter by level
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, levelFilter, searchTerm]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logsEndRef.current && autoRefresh) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoRefresh]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchLogs();
      }, 5000); // Refresh every 5 seconds
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh]);

  // Get log level color
  const getLevelColor = (level) => {
    switch (level) {
      case 'error':
        return '#ef4444';
      case 'warn':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  // Check permissions (after all hooks)
  if (!hasPermission(user, PERMISSIONS.VIEW_LOGS)) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to view logs.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="logs-container">
        <div className="loading">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="logs-container">

      <div className="logs-header">
        <div className="header-actions">
          <button className="action-btn" onClick={() => setAutoRefresh(!autoRefresh)} title={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}>
            <FontAwesomeIcon icon={faSync} className={autoRefresh ? 'fa-spin' : ''} />
          </button>
          <button className="action-btn" onClick={fetchLogs} title="Refresh logs">
            <FontAwesomeIcon icon={faSync} />
          </button>
          <button className="action-btn" onClick={handleDownloadLogs} title="Download logs">
            <FontAwesomeIcon icon={faDownload} />
          </button>
          {hasPermission(user, PERMISSIONS.MANAGE_SETTINGS) && (
            <button className="action-btn danger" onClick={handleClearClick} title="Clear logs">
              <FontAwesomeIcon icon={faTrash} />
            </button>
          )}
        </div>
      </div>

      <div className="logs-filters">
        <div className="search-container">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters">
          <div className="filter-group">
            <FontAwesomeIcon icon={faFilter} className="filter-icon" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <button className="action-btn auto-refresh-btn" onClick={() => setAutoRefresh(!autoRefresh)} title={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}>
            <FontAwesomeIcon icon={faSync} className={autoRefresh ? 'fa-spin' : ''} />
            <span>Auto-refresh (5s)</span>
          </button>

          <div className="log-count-right">
            <div className="action-btn log-count-btn">
              <span>{filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="logs-content">
        {filteredLogs.length === 0 ? (
          <div className="no-logs">
            <FontAwesomeIcon icon={faFileAlt} size="3x" />
            <p>No logs found</p>
          </div>
        ) : (
          <div className="logs-list">
            {filteredLogs.map((log, index) => (
              <div key={index} className="log-entry">
                <div 
                  className="log-level" 
                  style={{ backgroundColor: getLevelColor(log.level) }}
                >
                  {log.level.toUpperCase()}
                </div>
                <div className="log-timestamp">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
                <div className="log-message">{log.message}</div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Clear Logs</h3>
            <p>Are you sure you want to clear all logs? This action cannot be undone and all log history will be permanently deleted.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelClear}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={confirmClear}>
                Clear All Logs
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

export default Logs;

