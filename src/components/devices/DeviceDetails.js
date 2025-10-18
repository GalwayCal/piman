import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../utils/permissions';
import apiRequest from '../../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, 
  faMicrochip, 
  faMemory, 
  faHdd, 
  faTemperatureHigh,
  faServer,
  faMapMarkerAlt,
  faClock
} from '@fortawesome/free-solid-svg-icons';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import './DeviceDetails.css';

const DeviceDetails = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [device, setDevice] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(24); // Default 24 hours

  useEffect(() => {
    fetchDeviceDetails();
    fetchMetrics();
    
    // Auto-refresh metrics every minute
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, [deviceId, timeRange]);

  const fetchDeviceDetails = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest('/api/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const devices = await response.json();
        const foundDevice = devices.find(d => d.id === parseInt(deviceId));
        setDevice(foundDevice);
      }
    } catch (error) {
      console.error('Error fetching device details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/devices/${deviceId}/metrics?hours=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Format data for charts
        const formattedData = data.map(m => ({
          ...m,
          time: new Date(m.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        }));
        setMetrics(formattedData);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  if (!hasPermission(user, PERMISSIONS.VIEW_DEVICES)) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You do not have permission to view device details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="device-details-container">
        <div className="loading-message">Loading device details...</div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="device-details-container">
        <div className="error-message">Device not found</div>
      </div>
    );
  }

  return (
    <div className="device-details-container">
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate('/devices')}>
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to Devices
        </button>
        <h2>{device.name}</h2>
      </div>

      <div className="device-info-card">
        <h3>Device Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <FontAwesomeIcon icon={faServer} />
            <span className="label">Model:</span>
            <span className="value">{device.model}</span>
          </div>
          <div className="info-item">
            <FontAwesomeIcon icon={faMapMarkerAlt} />
            <span className="label">Location:</span>
            <span className="value">{device.location}</span>
          </div>
          <div className="info-item">
            <FontAwesomeIcon icon={faClock} />
            <span className="label">Uptime:</span>
            <span className="value">{device.uptime}</span>
          </div>
          <div className="info-item">
            <span className="label">IP Address:</span>
            <span className="value">{device.ip}</span>
          </div>
          <div className="info-item">
            <span className="label">Operating System:</span>
            <span className="value">{device.os}</span>
          </div>
        </div>
      </div>

      <div className="time-range-selector">
        <label>Time Range:</label>
        <select value={timeRange} onChange={(e) => setTimeRange(parseInt(e.target.value))}>
          <option value={1}>Last Hour</option>
          <option value={6}>Last 6 Hours</option>
          <option value={12}>Last 12 Hours</option>
          <option value={24}>Last 24 Hours</option>
          <option value={48}>Last 48 Hours</option>
        </select>
      </div>

      <div className="charts-grid">
        {/* CPU Chart */}
        <div className="chart-card">
          <h3>
            <FontAwesomeIcon icon={faMicrochip} />
            CPU Usage
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="time" 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card-background)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="cpu" 
                stroke="var(--primary-color)" 
                strokeWidth={2}
                dot={false}
                name="CPU %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Memory Chart */}
        <div className="chart-card">
          <h3>
            <FontAwesomeIcon icon={faMemory} />
            Memory Usage
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="time" 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card-background)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="memory" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
                name="Memory %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Disk Chart */}
        <div className="chart-card">
          <h3>
            <FontAwesomeIcon icon={faHdd} />
            Disk Usage
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="time" 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card-background)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="disk" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={false}
                name="Disk %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature Chart */}
        <div className="chart-card">
          <h3>
            <FontAwesomeIcon icon={faTemperatureHigh} />
            Temperature
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="time" 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--card-background)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="temperature" 
                stroke="#ef4444" 
                strokeWidth={2}
                dot={false}
                name="Temp °C"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetails;
