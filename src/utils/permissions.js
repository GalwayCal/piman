// Role-based permissions for the application
export const ROLES = {
  USER: 'user',
  MANAGER: 'manager', 
  ADMIN: 'admin'
};

// Permission definitions
export const PERMISSIONS = {
  // Device permissions
  VIEW_DEVICES: 'view_devices',
  ADD_DEVICES: 'add_devices',
  EDIT_DEVICES: 'edit_devices',
  DELETE_DEVICES: 'delete_devices',
  REBOOT_DEVICES: 'reboot_devices',
  
  // Terminal permissions
  ACCESS_TERMINAL: 'access_terminal',
  
  // File permissions
  ACCESS_FILES: 'access_files',
  
  // User management permissions
  VIEW_USERS: 'view_users',
  ADD_USERS: 'add_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  
  // Dashboard permissions
  VIEW_DASHBOARD: 'view_dashboard',
  
  // Log permissions
  VIEW_LOGS: 'view_logs',
  
  // Settings permissions
  MANAGE_SETTINGS: 'manage_settings'
};

// Role permissions mapping
export const ROLE_PERMISSIONS = {
  [ROLES.USER]: [
    PERMISSIONS.VIEW_DEVICES,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_DEVICES,
    PERMISSIONS.ADD_DEVICES,
    PERMISSIONS.EDIT_DEVICES,
    PERMISSIONS.DELETE_DEVICES,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_DEVICES,
    PERMISSIONS.ADD_DEVICES,
    PERMISSIONS.EDIT_DEVICES,
    PERMISSIONS.DELETE_DEVICES,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.ACCESS_TERMINAL,
    PERMISSIONS.ACCESS_FILES,
    PERMISSIONS.REBOOT_DEVICES,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.ADD_USERS,
    PERMISSIONS.EDIT_USERS,
    PERMISSIONS.DELETE_USERS,
    PERMISSIONS.VIEW_LOGS,
    PERMISSIONS.MANAGE_SETTINGS
  ]
};

// Helper function to check if user has permission
export const hasPermission = (user, permission) => {
  if (!user || !user.role) return false;
  
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
};

// Helper function to check if user has any of the given permissions
export const hasAnyPermission = (user, permissions) => {
  return permissions.some(permission => hasPermission(user, permission));
};

// Helper function to check if user has all of the given permissions
export const hasAllPermissions = (user, permissions) => {
  return permissions.every(permission => hasPermission(user, permission));
}; 