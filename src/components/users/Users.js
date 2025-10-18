import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import apiRequest from '../../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faPlus, 
  faSearch, 
  faEdit,
  faTrashAlt,
  faShieldAlt,
  faUser,
  faUserCheck,
  faUserTimes
} from '@fortawesome/free-solid-svg-icons';
import './Users.css';

const UsersComponent = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    status: 'active'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await apiRequest('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <FontAwesomeIcon icon={faShieldAlt} size="sm" />;
      case 'manager':
        return <FontAwesomeIcon icon={faUserCheck} size="sm" />;
      case 'user':
        return <FontAwesomeIcon icon={faUser} size="sm" />;
      default:
        return <FontAwesomeIcon icon={faUser} size="sm" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <FontAwesomeIcon icon={faUserCheck} size="sm" />;
      case 'inactive':
        return <FontAwesomeIcon icon={faUserTimes} size="sm" />;
      default:
        return <FontAwesomeIcon icon={faUser} size="sm" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return '#ef4444';
      case 'manager':
        return '#f59e0b';
      case 'user':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'inactive':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleAddUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        const user = await response.json();
        setUsers([...users, user]);
        setShowAddModal(false);
        setNewUser({
          name: '',
          email: '',
          password: '',
          role: 'user',
          status: 'active'
        });
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('authToken');
      
      // Prepare update data - only include password if new password is provided
      const updateData = {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        status: editingUser.status
      };
      
      // Only include password if a new one is provided
      if (newPassword.trim()) {
        updateData.password = newPassword;
      }
      
      const response = await apiRequest(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(user => user.id === updatedUser.id ? updatedUser : user));
        setShowEditModal(false);
        setEditingUser(null);
        setNewPassword('');
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
    setNewPassword(''); // Reset password field
    setShowEditModal(true);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await apiRequest(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setUsers(users.filter(user => user.id !== userId));
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Network error');
    }
  };



  if (loading) {
    return (
      <div className="users-container">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="users-container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="users-container">
      <div className="users-header">
        <div className="header-left">
          <h1>Users</h1>
          <p>Manage system users and permissions</p>
        </div>
        {hasPermission(currentUser, PERMISSIONS.ADD_USERS) && (
          <button 
            className="add-user-btn"
            onClick={() => setShowAddModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} size="sm" />
            Add User
          </button>
        )}
      </div>

      <div className="users-filters">
        <div className="search-container">
          <FontAwesomeIcon icon={faSearch} size="sm" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="users-grid">
        {filteredUsers.length > 0 ? (
          filteredUsers.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-header">
                <div className="user-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                </div>
                <div className="user-status">
                  <div 
                    className="status-indicator" 
                    style={{ backgroundColor: getStatusColor(user.status) }}
                  >
                    {getStatusIcon(user.status)}
                  </div>
                  <span className="status-text">{user.status}</span>
                </div>
              </div>

              <div className="user-details">
                <div className="detail-row">
                  <span className="label">Role:</span>
                  <span className="value">
                    <div 
                      className="role-badge" 
                      style={{ backgroundColor: getRoleColor(user.role) }}
                    >
                      {getRoleIcon(user.role)}
                      {user.role}
                    </div>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Last Login:</span>
                  <span className="value">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>

              <div className="user-actions">
                {hasPermission(currentUser, PERMISSIONS.EDIT_USERS) && (
                  <button 
                    className="action-btn"
                    onClick={() => openEditModal(user)}
                    title="Edit user"
                  >
                    <FontAwesomeIcon icon={faEdit} size="sm" />
                  </button>
                )}
                {hasPermission(currentUser, PERMISSIONS.DELETE_USERS) && (
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDeleteUser(user.id)}
                    title="Delete user"
                  >
                    <FontAwesomeIcon icon={faTrashAlt} size="sm" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <FontAwesomeIcon icon={faUsers} size="3x" />
            <h3>No users found</h3>
            <p>Try adjusting your search</p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add New User</h2>
              <button 
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  placeholder="Enter user name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Enter password"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={newUser.status}
                  onChange={(e) => setNewUser({...newUser, status: e.target.value})}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="primary"
                  disabled={submitting}
                >
                  {submitting ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit User</h2>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="form-group">
                <label htmlFor="edit-name">Name</label>
                <input
                  type="text"
                  id="edit-name"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  placeholder="Enter user name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  type="email"
                  id="edit-email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-password">Password (leave blank to keep current)</label>
                <input
                  type="password"
                  id="edit-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (optional)"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({...editingUser, status: e.target.value})}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="primary"
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersComponent; 