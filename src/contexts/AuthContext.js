import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { hasPermission as checkPermission } from '../utils/permissions';
import apiRequest from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  const WARNING_TIME = 25 * 60 * 1000; // 25 minutes (5 min before timeout)

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    const lastActivity = localStorage.getItem('lastActivity');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        
        // Check if session has expired due to inactivity
        if (lastActivity) {
          const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
          if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
            // Session expired
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            localStorage.removeItem('lastActivity');
            setUser(null);
            setLoading(false);
            return;
          }
        }
        
        setUser(parsedUser);
        // Update last activity
        localStorage.setItem('lastActivity', Date.now().toString());
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('lastActivity');
      }
    }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('lastActivity');
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (warningTimer.current) {
      clearTimeout(warningTimer.current);
    }
    setUser(null);
  }, []);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timers
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (warningTimer.current) {
      clearTimeout(warningTimer.current);
    }
    
    // Update last activity timestamp
    localStorage.setItem('lastActivity', Date.now().toString());
    
    // Set new timers
    if (user) {
      // Warning timer (5 minutes before logout)
      warningTimer.current = setTimeout(() => {
        console.warn('Warning: Session will expire in 5 minutes due to inactivity');
        // You could show a toast notification here if desired
      }, WARNING_TIME);
      
      // Logout timer (30 minutes)
      inactivityTimer.current = setTimeout(() => {
        console.log('Session expired due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, INACTIVITY_TIMEOUT, WARNING_TIME, logout]);

  // Track user activity
  useEffect(() => {
    if (!user) return;

    // Events to track for activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Reset timer on any activity
    const handleActivity = () => {
      resetInactivityTimer();
    };
    
    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });
    
    // Initialize timer
    resetInactivityTimer();
    
    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [user, resetInactivityTimer]);

  const login = async (email, password) => {
    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        localStorage.setItem('lastActivity', Date.now().toString());
        setUser(data.user);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    hasPermission: checkPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 