import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer,
  faWifi,
  faCircleXmark,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import apiRequest from '../../utils/api';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    warningDevices: 0
  });
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    
    // Set up automatic refresh every 60 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 60000); // 60 seconds
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest('/api/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data);
        
        const stats = {
          totalDevices: data.length,
          onlineDevices: data.filter(d => d.status === 'online').length,
          offlineDevices: data.filter(d => d.status === 'offline').length,
          warningDevices: data.filter(d => d.status === 'warning').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  const chartData = [
    { name: 'Online', value: stats.onlineDevices, color: '#10b981' },
    { name: 'Offline', value: stats.offlineDevices, color: '#ef4444' },
    { name: 'Warning', value: stats.warningDevices, color: '#f59e0b' }
  ];

  // Group devices by location
  const locationCounts = devices.reduce((acc, device) => {
    const location = device.location || 'Unknown';
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {});

  const locationData = Object.entries(locationCounts).map(([location, count], index) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return {
      name: location,
      value: count,
      color: colors[index % colors.length]
    };
  });

  const handleStatusChartClick = (data) => {
    if (data && data.name) {
      navigate('/devices', { 
        state: { 
          statusFilter: data.name.toLowerCase(),
          showFilters: true 
        } 
      });
    }
  };

  const handleLocationChartClick = (data) => {
    if (data && data.name) {
      navigate('/devices', { 
        state: { 
          locationFilter: data.name,
          showFilters: true 
        } 
      });
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <p>Overview of your Raspberry Pi fleet</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faServer} size="lg" />
          </div>
          <div className="stat-content">
            <h3>{stats.totalDevices}</h3>
            <p>Total Devices</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon online">
            <FontAwesomeIcon icon={faWifi} size="lg" />
          </div>
          <div className="stat-content">
            <h3>{stats.onlineDevices}</h3>
            <p>Online Devices</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon offline">
            <FontAwesomeIcon icon={faCircleXmark} size="lg" />
          </div>
          <div className="stat-content">
            <h3>{stats.offlineDevices}</h3>
            <p>Offline Devices</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <FontAwesomeIcon icon={faExclamationTriangle} size="lg" />
          </div>
          <div className="stat-content">
            <h3>{stats.warningDevices}</h3>
            <p>Warning Devices</p>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Device Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                onClick={handleStatusChartClick}
                style={{ cursor: 'pointer' }}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend 
                iconType="square"
                align="right"
                layout="vertical"
                verticalAlign="middle"
                wrapperStyle={{ color: 'var(--text-primary)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Pi Location</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={locationData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                onClick={handleLocationChartClick}
                style={{ cursor: 'pointer' }}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {locationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend 
                iconType="square"
                align="right"
                layout="vertical"
                verticalAlign="middle"
                wrapperStyle={{ color: 'var(--text-primary)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default Dashboard; 