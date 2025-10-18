import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import Devices from './components/devices/Devices';
import DeviceDetails from './components/devices/DeviceDetails';
import Users from './components/users/Users';
import Terminal from './components/terminal/Terminal';
import FileEditor from './components/fileeditor/FileEditor';
import Logs from './components/logs/Logs';
import ProtectedRoute from './components/auth/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="devices" element={<Devices />} />
              <Route path="devices/:deviceId/details" element={<DeviceDetails />} />
              <Route path="users" element={<Users />} />
              <Route path="terminal/:deviceId" element={<Terminal />} />
              <Route path="files/:deviceId" element={<FileEditor />} />
              <Route path="logs" element={<Logs />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App; 