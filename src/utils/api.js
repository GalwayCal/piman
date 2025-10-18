import config from '../config';

/**
 * Makes an API request with the correct base URL
 * @param {string} endpoint - The API endpoint (e.g., '/api/devices')
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} - The fetch response
 */
export const apiRequest = (endpoint, options = {}) => {
  const url = `${config.API_URL}${endpoint}`;
  
  // Add default headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  // Merge headers
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
};

export default apiRequest;

