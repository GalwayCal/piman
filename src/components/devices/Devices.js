import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import apiRequest from '../../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer, 
  faPlus, 
  faSearch, 
  faTerminal,
  faFileAlt,
  faCog,
  faWifi,
  faCircleXmark,
  faMicrochip,
  faHdd,
  faMemory,
  faTemperatureHigh,
  faMapMarkerAlt,
  faClock,
  faExclamationTriangle,
  faTrashAlt,
  faTh,
  faList,
  faChartLine
} from '@fortawesome/free-solid-svg-icons';
import './Devices.css';

const Devices = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [hideOffline, setHideOffline] = useState(false);
  const [isGridView, setIsGridView] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [notification, setNotification] = useState(null);

  // Helper function to show notifications
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Auto-hide after 5 seconds
  };

  const [newDevice, setNewDevice] = useState({
    name: '',
    ip: '',
    location: '',
    username: 'pi',
    password: '',
    port: 22
  });

  // Handle navigation state and apply filters
  useEffect(() => {
    if (location.state) {
      const { statusFilter: navStatusFilter, locationFilter: navLocationFilter } = location.state;
      if (navStatusFilter) {
        setStatusFilter(navStatusFilter);
      }
      if (navLocationFilter) {
        setLocationFilter(navLocationFilter);
      }
    }
  }, [location.state]);

  // Fetch devices from API
  useEffect(() => {
    fetchDevices();
    
    // Set up automatic refresh every 60 seconds
    const interval = setInterval(() => {
      fetchDevices();
    }, 60000); // 60 seconds
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await apiRequest('/api/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      } else {
        setError('Failed to fetch devices');
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const addDevice = async (deviceData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest('/api/devices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(deviceData)
      });

      if (response.ok) {
        const newDevice = await response.json();
        setDevices(prev => [...prev, newDevice]);
        setShowAddModal(false);
        setNewDevice({
          name: '',
          ip: '',
          location: '',
          username: 'pi',
          password: '',
          port: 22
        });
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to add device' };
      }
    } catch (error) {
      console.error('Error adding device:', error);
      return { success: false, error: 'Network error' };
    }
  };

  // Show delete confirmation modal
  const handleDeleteClick = (device) => {
    setDeletingDevice(device);
    setShowDeleteModal(true);
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingDevice(null);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deletingDevice) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/devices/${deletingDevice.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setDevices(prev => prev.filter(device => device.id !== deletingDevice.id));
        showNotification(`Device "${deletingDevice.name}" deleted successfully`, 'success');
      } else {
        showNotification('Failed to delete device', 'error');
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      showNotification('Network error while deleting device', 'error');
    } finally {
      setShowDeleteModal(false);
      setDeletingDevice(null);
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    const result = await addDevice(newDevice);
    if (!result.success) {
      setError(result.error);
    }
  };

  const editDevice = async (deviceData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/devices/${deviceData.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(deviceData)
      });

      if (response.ok) {
        const updatedDevice = await response.json();
        setDevices(prev => prev.map(device => 
          device.id === updatedDevice.id ? updatedDevice : device
        ));
        setShowEditModal(false);
        setEditingDevice(null);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to update device' };
      }
    } catch (error) {
      console.error('Error updating device:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const handleEditDevice = async (e) => {
    e.preventDefault();
    const result = await editDevice(editingDevice);
    if (!result.success) {
      setError(result.error);
    }
  };

  const openEditModal = (device) => {
    setEditingDevice({
      id: device.id,
      name: device.name,
      ip: device.ip,
      location: device.location,
      username: device.username || 'pi',
      password: device.password || '',
      port: device.port || 22
    });
    setShowEditModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return '#10b981';
      case 'offline':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <FontAwesomeIcon icon={faWifi} size="sm" />;
      case 'offline':
        return <FontAwesomeIcon icon={faCircleXmark} size="sm" />;
      case 'warning':
        return <FontAwesomeIcon icon={faExclamationTriangle} size="sm" />;
      default:
        return <FontAwesomeIcon icon={faWifi} size="sm" />;
    }
  };

  const formatLastSeen = (lastSeen) => {
    // If lastSeen is null, undefined, or empty, device has never been seen
    if (!lastSeen) {
      return 'Never';
    }
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInSeconds = Math.floor((now - lastSeenDate) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  const getDeviceStatus = (device) => {
    // If device has a status field, use it
    if (device.status) {
      return device.status;
    }
    
    // Otherwise, determine status based on lastSeen
    if (!device.lastSeen) {
      return 'offline';
    }
    
    const now = new Date();
    const lastSeenDate = new Date(device.lastSeen);
    const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
    
    // Consider device online if last seen within 5 minutes
    if (diffInMinutes <= 5) {
      return 'online';
    } else if (diffInMinutes <= 30) {
      return 'warning';
    } else {
      return 'offline';
    }
  };

  const DeviceCard = ({ device }) => (
    <div className="device-card">
      <div className="device-header">
        <div className="device-info">
          <div className="device-name-row">
            <h3>{device.name}</h3>
            <div className="device-status">
              <div 
                className={`status-indicator ${getDeviceStatus(device)}`}
              >
                {getStatusIcon(getDeviceStatus(device))}
              </div>
            </div>
          </div>
          <div className="device-meta">
            <span className="device-location">
              <FontAwesomeIcon icon={faMapMarkerAlt} size="sm" />
              {device.location}
            </span>
          </div>
          <div className="device-actions">
            <Link to={`/devices/${device.id}/details`} className="action-btn" title="View metrics">
              <FontAwesomeIcon icon={faChartLine} size="sm" />
            </Link>
            {hasPermission(user, PERMISSIONS.ACCESS_TERMINAL) && (
              <Link to={`/terminal/${device.id}`} className="action-btn" title="Terminal">
                <FontAwesomeIcon icon={faTerminal} size="sm" />
              </Link>
            )}
            {hasPermission(user, PERMISSIONS.ACCESS_FILES) && (
              <Link to={`/files/${device.id}`} className="action-btn" title="Files">
                <FontAwesomeIcon icon={faFileAlt} size="sm" />
              </Link>
            )}
            {hasPermission(user, PERMISSIONS.EDIT_DEVICES) && (
              <button 
                className="action-btn" 
                onClick={() => openEditModal(device)}
                title="Edit device"
              >
                <FontAwesomeIcon icon={faCog} size="sm" />
              </button>
            )}
            {hasPermission(user, PERMISSIONS.DELETE_DEVICES) && (
              <button 
                className="action-btn delete-btn" 
                onClick={() => handleDeleteClick(device)}
                title="Delete device"
              >
                <FontAwesomeIcon icon={faTrashAlt} size="sm" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="device-details">
        <div className="detail-row">
          <span className="label">IP Address:</span>
          <span className="value">{device.ip}</span>
        </div>
        <div className="detail-row">
          <span className="label">Last Seen:</span>
                      <span className="value">
              <FontAwesomeIcon icon={faClock} size="sm" />
              {device.lastSeen ? formatLastSeen(device.lastSeen) : 'Never'}
            </span>
        </div>
        <div className="detail-row">
          <span className="label">Uptime:</span>
          <span className="value">
            <FontAwesomeIcon icon={faClock} size="sm" />
            {device.uptime || 'Unknown'}
          </span>
        </div>
      </div>

      <div className="device-metrics">
        <div className="metric">
          <div className="metric-header">
            <FontAwesomeIcon icon={faMicrochip} size="sm" />
            <span>CPU</span>
          </div>
          <div className="metric-bar">
            <div 
              className={`metric-fill ${(device.cpu || 0) > 70 ? 'high-usage' : ''}`}
              style={{ width: `${device.cpu || 0}%` }}
            />
          </div>
          <span className="metric-value">{device.cpu || 0}%</span>
        </div>

        <div className="metric">
          <div className="metric-header">
            <FontAwesomeIcon icon={faMemory} size="sm" />
            <span>Memory</span>
          </div>
          <div className="metric-bar">
            <div 
              className={`metric-fill ${(device.memory || 0) > 70 ? 'high-usage' : ''}`}
              style={{ width: `${device.memory || 0}%` }}
            />
          </div>
          <span className="metric-value">{device.memory || 0}%</span>
        </div>

        <div className="metric">
          <div className="metric-header">
            <FontAwesomeIcon icon={faHdd} size="sm" />
            <span>Disk</span>
          </div>
          <div className="metric-bar">
            <div 
              className={`metric-fill ${(device.disk || 0) > 70 ? 'high-usage' : ''}`}
              style={{ width: `${device.disk || 0}%` }}
            />
          </div>
          <span className="metric-value">{device.disk || 0}%</span>
        </div>

        <div className="metric">
          <div className="metric-header">
            <FontAwesomeIcon icon={faTemperatureHigh} size="sm" />
            <span>Temp</span>
          </div>
          <div className="metric-bar">
            <div 
              className={`metric-fill ${(device.temperature || 0) > 70 ? 'high-usage' : ''}`}
              style={{ width: `${Math.min((device.temperature || 0) / 100 * 100, 100)}%` }}
            />
          </div>
          <span className="metric-value">{device.temperature ? `${device.temperature}°C` : 'N/A'}</span>
        </div>
      </div>

      <div className="device-tags">
        <span className="tag">{device.model}</span>
        <span className="tag">{device.os}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="devices-container">
        <div className="loading">Loading devices...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="devices-container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.ip.includes(searchTerm) ||
                         device.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || device.location === locationFilter;
    const matchesHideOffline = !hideOffline || device.status !== 'offline';
    
    return matchesSearch && matchesStatus && matchesLocation && matchesHideOffline;
  });

  const locations = [...new Set(devices.map(device => device.location))];

  return (
    <div className="devices-container">
      <div className="devices-header">
        <div className="header-left">
          <p>Manage your Raspberry Pi fleet</p>
        </div>
        {hasPermission(user, PERMISSIONS.ADD_DEVICES) && (
          <button 
            className="add-device-btn"
            onClick={() => setShowAddModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} size="sm" />
            Add Device
          </button>
        )}
      </div>

      <div className="devices-filters">
        <div className="search-container">
          <FontAwesomeIcon icon={faSearch} size="sm" />
          <input
            type="text"
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filters">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="warning">Warning</option>
          </select>
          <select 
            value={locationFilter} 
            onChange={(e) => setLocationFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
          <label className="filter-checkbox">
            <input 
              type="checkbox" 
              checked={hideOffline}
              onChange={(e) => setHideOffline(e.target.checked)}
            />
            <span>Hide Offline</span>
          </label>
          <div className="layout-toggle">
            <button
              className={`toggle-btn ${isGridView ? 'active' : ''}`}
              onClick={() => setIsGridView(true)}
              title="Grid View"
            >
              <FontAwesomeIcon icon={faTh} size="sm" />
            </button>
            <button
              className={`toggle-btn ${!isGridView ? 'active' : ''}`}
              onClick={() => setIsGridView(false)}
              title="List View"
            >
              <FontAwesomeIcon icon={faList} size="sm" />
            </button>
          </div>
        </div>
      </div>

      <div className={`devices-grid ${isGridView ? 'grid-layout' : 'list-layout'}`}>
        {filteredDevices.length > 0 ? (
          filteredDevices.map(device => (
            <DeviceCard key={device.id} device={device} />
          ))
        ) : (
          <div className="empty-state">
            <FontAwesomeIcon icon={faServer} size="3x" />
            <h3>No devices found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add New Device</h2>
              <button 
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddDevice}>
              <div className="form-group">
                <label htmlFor="name">Device Name</label>
                <input
                  type="text"
                  id="name"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({...newDevice, name: e.target.value})}
                  placeholder="Enter device name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="ip">IP Address</label>
                <input
                  type="text"
                  id="ip"
                  value={newDevice.ip}
                  onChange={(e) => setNewDevice({...newDevice, ip: e.target.value})}
                  placeholder="192.168.1.100"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  value={newDevice.location}
                  onChange={(e) => setNewDevice({...newDevice, location: e.target.value})}
                  placeholder="Office, Lab, etc."
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={newDevice.username}
                  onChange={(e) => setNewDevice({...newDevice, username: e.target.value})}
                  placeholder="pi"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={newDevice.password}
                  onChange={(e) => setNewDevice({...newDevice, password: e.target.value})}
                  placeholder="Enter password"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="port">SSH Port</label>
                <input
                  type="number"
                  id="port"
                  value={newDevice.port}
                  onChange={(e) => setNewDevice({...newDevice, port: parseInt(e.target.value)})}
                  placeholder="22"
                  min="1"
                  max="65535"
                />
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Add Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {showEditModal && editingDevice && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Device</h2>
              <button 
                className="close-btn"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditDevice}>
              <div className="form-group">
                <label htmlFor="edit-name">Device Name</label>
                <input
                  type="text"
                  id="edit-name"
                  value={editingDevice.name}
                  onChange={(e) => setEditingDevice({...editingDevice, name: e.target.value})}
                  placeholder="Enter device name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-ip">IP Address</label>
                <input
                  type="text"
                  id="edit-ip"
                  value={editingDevice.ip}
                  onChange={(e) => setEditingDevice({...editingDevice, ip: e.target.value})}
                  placeholder="192.168.1.100"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-location">Location</label>
                <input
                  type="text"
                  id="edit-location"
                  value={editingDevice.location}
                  onChange={(e) => setEditingDevice({...editingDevice, location: e.target.value})}
                  placeholder="Office, Lab, etc."
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-username">Username</label>
                <input
                  type="text"
                  id="edit-username"
                  value={editingDevice.username}
                  onChange={(e) => setEditingDevice({...editingDevice, username: e.target.value})}
                  placeholder="pi"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-password">Password</label>
                <input
                  type="password"
                  id="edit-password"
                  value={editingDevice.password}
                  onChange={(e) => setEditingDevice({...editingDevice, password: e.target.value})}
                  placeholder="Enter password"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-port">SSH Port</label>
                <input
                  type="number"
                  id="edit-port"
                  value={editingDevice.port}
                  onChange={(e) => setEditingDevice({...editingDevice, port: parseInt(e.target.value)})}
                  placeholder="22"
                  min="1"
                  max="65535"
                />
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Update Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingDevice && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete the device "{deletingDevice.name}"? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={confirmDelete}>
                Delete Device
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

export default Devices; 