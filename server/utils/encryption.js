const crypto = require('crypto');

// Use environment variable for encryption key, fallback to a default for development
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'piman-dev-key-32-chars-long!';
const ALGORITHM = 'aes-256-cbc';

// Ensure the key is exactly 32 bytes for AES-256
const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

/**
 * Encrypt a password using AES-256-CBC
 * @param {string} password - The plain text password to encrypt
 * @returns {string} - The encrypted password in format: iv:encryptedData
 */
function encryptPassword(password) {
  if (!password) return null;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a password using AES-256-CBC
 * @param {string} encryptedPassword - The encrypted password in format: iv:encryptedData
 * @returns {string} - The decrypted plain text password
 */
function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || encryptedPassword === '') return null;
  
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted password format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    
    // Validate IV length
    if (iv.length !== 16) {
      throw new Error('Invalid IV length');
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting password:', error);
    return null;
  }
}

/**
 * Check if a string appears to be encrypted (contains colon separator)
 * @param {string} str - The string to check
 * @returns {boolean} - True if the string appears to be encrypted
 */
function isEncrypted(str) {
  return str && str.includes(':') && str.length > 32;
}

module.exports = {
  encryptPassword,
  decryptPassword,
  isEncrypted
};
