// API Configuration
const getApiUrl = () => {
  // 1. Use environment variable if explicitly set
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 2. In development, use empty string (proxy handles it)
  if (process.env.NODE_ENV !== 'production') {
    return '';
  }
  
  // 3. In production, detect if we need a port or not
  const { protocol, hostname, port } = window.location;
  
  // If accessing via port 3000 (direct Docker access), use port 3001 for API
  if (port === '3000') {
    return `${protocol}//${hostname}:3001`;
  }
  
  // If accessing via standard HTTP/HTTPS ports (reverse proxy), use same origin
  if (port === '' || port === '80' || port === '443') {
    // Reverse proxy scenario - API is served from same origin
    return '';
  }
  
  // Fallback: use port 3001
  return `${protocol}//${hostname}:3001`;
};

const config = {
  API_URL: getApiUrl(),
};

export default config;

