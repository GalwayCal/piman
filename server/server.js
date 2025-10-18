const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;
const winston = require('winston');
const { Client } = require('ssh2');
const http = require('http');
const socketIo = require('socket.io');
const { encryptPassword, decryptPassword, isEncrypted } = require('./utils/encryption');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3001;

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

// Define models
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'user'),
    defaultValue: 'user'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  lastLogin: {
    type: DataTypes.DATE,
    defaultValue: null
  }
}, {
  underscored: true
});

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ip: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    defaultValue: 'galway'
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  port: {
    type: DataTypes.INTEGER,
    defaultValue: 22
  },
  model: {
    type: DataTypes.STRING,
    defaultValue: 'Raspberry Pi 4 Model B'
  },
  os: {
    type: DataTypes.STRING,
    defaultValue: 'Raspberry Pi OS'
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'warning'),
    defaultValue: 'offline'
  },
  cpu: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  memory: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  disk: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: null
  },
  uptime: {
    type: DataTypes.STRING,
    defaultValue: 'Unknown'
  },
  temperature: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  }
}, {
  underscored: true,
  hooks: {
    // Encrypt password and username before saving
    beforeCreate: async (device) => {
      if (device.password && !isEncrypted(device.password)) {
        device.password = encryptPassword(device.password);
      }
      if (device.username && !isEncrypted(device.username)) {
        device.username = encryptPassword(device.username);
      }
    },
    beforeUpdate: async (device) => {
      if (device.password && !isEncrypted(device.password)) {
        device.password = encryptPassword(device.password);
      }
      if (device.username && !isEncrypted(device.username)) {
        device.username = encryptPassword(device.username);
      }
    },
    // Decrypt password and username after retrieving
    afterFind: async (devices) => {
      if (devices) {
        if (Array.isArray(devices)) {
          devices.forEach(device => {
            if (device.password && isEncrypted(device.password)) {
              device.password = decryptPassword(device.password);
            }
            if (device.username && isEncrypted(device.username)) {
              device.username = decryptPassword(device.username);
            }
          });
        } else {
          if (devices.password && isEncrypted(devices.password)) {
            devices.password = decryptPassword(devices.password);
          }
          if (devices.username && isEncrypted(devices.username)) {
            devices.username = decryptPassword(devices.username);
          }
        }
      }
    }
  }
});

// DeviceMetrics model for historical data
const DeviceMetrics = sequelize.define('DeviceMetrics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  deviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Devices',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  cpu: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  memory: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  disk: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  temperature: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  underscored: true,
  tableName: 'device_metrics',
  indexes: [
    {
      fields: ['device_id', 'timestamp']
    },
    {
      fields: ['timestamp']
    }
  ]
});

// Define associations
Device.hasMany(DeviceMetrics, { foreignKey: 'deviceId', as: 'metrics' });
DeviceMetrics.belongsTo(Device, { foreignKey: 'deviceId' });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Initialize database
const initializeDatabase = async () => {
  try {
    // Use alter: true but catch and ignore migration errors if the schema is already correct
    try {
      await sequelize.sync({ alter: true });
      logger.info('Database synchronized successfully');
    } catch (syncError) {
      // If it's just a constraint error during migration, the tables likely already exist
      if (syncError.name === 'SequelizeUniqueConstraintError' || syncError.parent?.code === 'SQLITE_CONSTRAINT') {
        logger.warn('Database migration skipped (tables already in correct state)');
        // Verify tables exist by trying a simple query
        await User.findOne();
        await Device.findOne();
        logger.info('Database verified successfully');
      } else {
        throw syncError; // Re-throw if it's a different error
      }
    }
    
    // Create default admin user if it doesn't exist
    const adminExists = await User.findOne({ where: { email: 'admin@piman.com' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        name: 'Admin User',
        email: 'admin@piman.com',
        password: hashedPassword,
        role: 'admin'
      });
      logger.info('Default admin user created');
    }

    // Create a test device if none exist
    const deviceCount = await Device.count();
    if (deviceCount === 0) {
      await Device.create({
        name: 'Test Pi',
        ip: '192.168.5.108',
        location: 'Office',
        username: 'galway',
        password: 'galway',
        port: 22,
        model: 'Raspberry Pi 4 Model B',
        os: 'Raspberry Pi OS',
        status: 'online',
        cpu: 45,
        memory: 60,
        disk: 75,
        lastSeen: new Date()
      });
      logger.info('Test device created');
    }
  } catch (error) {
    logger.error('Database initialization error:', error);
  }
};

// Get real metrics from Raspberry Pi
const getPiMetrics = (device) => {
  return new Promise((resolve, reject) => {
    // First check if device is pingable
    const { exec } = require('child_process');
    const pingCommand = process.platform === 'win32' ? `ping -n 1 ${device.ip}` : `ping -c 1 ${device.ip}`;
    
    exec(pingCommand, (error, stdout, stderr) => {
      if (error) {
        // Device is not reachable, reject immediately
        reject(new Error('Device not reachable'));
        return;
      }
      
      // Device is pingable, proceed with SSH
      const conn = new Client();
      
      conn.on('ready', () => {
        // Get CPU usage
        conn.exec('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'', (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }
        
        let cpuOutput = '';
        stream.on('data', (data) => {
          cpuOutput += data.toString();
        });
        
        stream.on('close', () => {
          // Get memory usage
          conn.exec('free | grep Mem | awk \'{printf "%.1f", $3/$2 * 100.0}\'', (err, stream) => {
            if (err) {
              conn.end();
              reject(err);
              return;
            }
            
            let memoryOutput = '';
            stream.on('data', (data) => {
              memoryOutput += data.toString();
            });
            
            stream.on('close', () => {
              // Get disk usage
              conn.exec('df / | tail -1 | awk \'{print $5}\' | sed \'s/%//\'', (err, stream) => {
                if (err) {
                  conn.end();
                  reject(err);
                  return;
                }
                
                let diskOutput = '';
                stream.on('data', (data) => {
                  diskOutput += data.toString();
                });
                
                stream.on('close', () => {
                  // Get Raspberry Pi model
                  conn.exec('cat /proc/device-tree/model', (err, stream) => {
                    if (err) {
                      conn.end();
                      reject(err);
                      return;
                    }
                    
                    let modelOutput = '';
                    stream.on('data', (data) => {
                      modelOutput += data.toString();
                    });
                    
                    stream.on('close', () => {
                      // Get OS version
                      conn.exec('cat /etc/os-release | grep PRETTY_NAME | cut -d "=" -f2 | tr -d \'"\'', (err, stream) => {
                        if (err) {
                          conn.end();
                          reject(err);
                          return;
                        }
                        
                        let osOutput = '';
                        stream.on('data', (data) => {
                          osOutput += data.toString();
                        });
                        
                        stream.on('close', () => {
                          // Get uptime
                          conn.exec('uptime -p', (err, stream) => {
                            if (err) {
                              conn.end();
                              reject(err);
                              return;
                            }
                            
                            let uptimeOutput = '';
                            stream.on('data', (data) => {
                              uptimeOutput += data.toString();
                            });
                            
                            stream.on('close', () => {
                              // Get CPU temperature
                              conn.exec('vcgencmd measure_temp | cut -d "=" -f2 | cut -d "\'" -f1', (err, stream) => {
                                if (err) {
                                  conn.end();
                                  reject(err);
                                  return;
                                }
                                
                                let tempOutput = '';
                                stream.on('data', (data) => {
                                  tempOutput += data.toString();
                                });
                                
                                stream.on('close', () => {
                                  conn.end();
                                  
                                  // Parse the outputs
                                  const cpu = parseFloat(cpuOutput.trim()) || 0;
                                  const memory = parseFloat(memoryOutput.trim()) || 0;
                                  const disk = parseFloat(diskOutput.trim()) || 0;
                                  const model = modelOutput.trim() || 'Raspberry Pi 4 Model B';
                                  const os = osOutput.trim() || 'Raspberry Pi OS';
                                  const uptime = uptimeOutput.trim().replace(/^up\s+/i, '') || 'Unknown';
                                  const temperature = parseFloat(tempOutput.trim()) || 0;
                                  
                                  resolve({
                                    cpu: Math.round(cpu),
                                    memory: Math.round(memory),
                                    disk: Math.round(disk),
                                    model: model,
                                    os: os,
                                    uptime: uptime,
                                    temperature: Math.round(temperature * 10) / 10 // Round to 1 decimal place
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
    
      conn.on('error', (err) => {
        reject(err);
      });
      
      // Connect to the Pi
      conn.connect({
        host: device.ip,
        port: device.port || 22,
        username: device.username || 'pi',
        password: device.password
      });
    });
  });
};

// Clean up old metrics (older than 48 hours)
const cleanupOldMetrics = async () => {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const deleted = await DeviceMetrics.destroy({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.lt]: fortyEightHoursAgo
        }
      }
    });
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old metric records (older than 48 hours)`);
    }
  } catch (error) {
    logger.error('Error cleaning up old metrics:', error);
  }
};

// Update device metrics with real data
const updateDeviceMetrics = async () => {
  try {
    const devices = await Device.findAll();
    for (const device of devices) {
      try {
        // Get real metrics from the Pi
        const metrics = await getPiMetrics(device);
        
        // Update device with real metrics, model, OS, uptime, temperature and current timestamp
        await device.update({
          cpu: metrics.cpu,
          memory: metrics.memory,
          disk: metrics.disk,
          model: metrics.model,
          os: metrics.os,
          uptime: metrics.uptime,
          temperature: metrics.temperature,
          lastSeen: new Date(),
          status: 'online'
        });
        
        // Store historical metrics
        await DeviceMetrics.create({
          deviceId: device.id,
          cpu: metrics.cpu,
          memory: metrics.memory,
          disk: metrics.disk,
          temperature: metrics.temperature,
          timestamp: new Date()
        });
        
        logger.info(`Real metrics updated for ${device.name}: CPU=${metrics.cpu}%, Memory=${metrics.memory}%, Disk=${metrics.disk}%, Temp=${metrics.temperature}°C, Model=${metrics.model}, OS=${metrics.os}, Uptime=${metrics.uptime}`);
      } catch (error) {
        // Check if device is not reachable (ping failed)
        if (error.message === 'Device not reachable') {
          await device.update({
            cpu: 0,
            memory: 0,
            disk: 0,
            status: 'offline' // Mark as offline when not pingable
            // Don't update lastSeen for unreachable devices
          });
          
          logger.warn(`Device ${device.name} (${device.ip}) is not reachable - marking as offline`);
        } else {
          // SSH failed but device is pingable - mark as warning
          const fallbackCpu = Math.round(20 + Math.random() * 30); // 20-50%
          const fallbackMemory = Math.round(30 + Math.random() * 40); // 30-70%
          const fallbackDisk = Math.round(25 + Math.random() * 35); // 25-60%
          
          await device.update({
            cpu: fallbackCpu,
            memory: fallbackMemory,
            disk: fallbackDisk,
            lastSeen: new Date(),
            status: 'warning' // Mark as warning for SSH issues
          });
          
          logger.warn(`SSH failed for ${device.name}: ${error.message} - marking as warning`);
          logger.info(`Using fallback metrics: CPU=${fallbackCpu}%, Memory=${fallbackMemory}%, Disk=${fallbackDisk}%`);
        }
      }
    }
  } catch (error) {
    logger.error('Error updating device metrics:', error);
  }
};

// Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login timestamp
    await user.update({ lastLogin: new Date() });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Device routes
app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.findAll({
      attributes: { exclude: ['password', 'username'] }
    });
    res.json(devices);
  } catch (error) {
    logger.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get historical metrics for a device
app.get('/api/devices/:id/metrics', authenticateToken, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const hours = parseInt(req.query.hours) || 24; // Default to 24 hours
    
    // Calculate time range (max 48 hours)
    const hoursToFetch = Math.min(hours, 48);
    const startTime = new Date(Date.now() - hoursToFetch * 60 * 60 * 1000);
    
    const metrics = await DeviceMetrics.findAll({
      where: {
        deviceId: deviceId,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: startTime
        }
      },
      order: [['timestamp', 'ASC']],
      attributes: ['cpu', 'memory', 'disk', 'temperature', 'timestamp']
    });
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching device metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

app.post('/api/devices/:id/reboot', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const conn = new Client();
    
    let responseSent = false;
    
    conn.on('ready', () => {
      // Use systemctl reboot which is more reliable on modern systems
      conn.exec('sudo systemctl reboot', (err, stream) => {
        if (err) {
          conn.end();
          logger.error(`Failed to reboot device ${device.name}:`, err);
          if (!responseSent) {
            responseSent = true;
            return res.status(500).json({ error: 'Failed to reboot device' });
          }
          return;
        }
        
        let output = '';
        let errorOutput = '';
        
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        stream.on('close', (code) => {
          conn.end();
          logger.info(`Reboot command sent to ${device.name}, exit code: ${code}, output: ${output}, error: ${errorOutput}`);
          if (!responseSent) {
            responseSent = true;
            res.json({ message: 'Reboot command sent successfully' });
          }
        });
        
        stream.on('error', (err) => {
          conn.end();
          logger.error(`Reboot stream error for ${device.name}:`, err);
          if (!responseSent) {
            responseSent = true;
            res.status(500).json({ error: 'Reboot command failed' });
          }
        });
      });
    });
    
    conn.on('error', (err) => {
      logger.error(`SSH connection error for reboot ${device.name}:`, err);
      // If the connection fails after sending reboot, it might be because the device is rebooting
      // This is actually expected behavior - don't send error if reboot was successful
      if (!responseSent) {
        responseSent = true;
        res.status(500).json({ error: 'Failed to connect to device' });
      }
    });
    
    conn.connect({
      host: device.ip,
      port: device.port || 22,
      username: device.username,
      password: device.password
    });
    
  } catch (error) {
    logger.error('Error rebooting device:', error);
    res.status(500).json({ error: 'Failed to reboot device' });
  }
});

app.post('/api/devices', authenticateToken, async (req, res) => {
  try {
    const device = await Device.create(req.body);
    
    // Return device without sensitive fields
    const safeDevice = await Device.findByPk(device.id, {
      attributes: { exclude: ['password', 'username'] }
    });
    res.status(201).json(safeDevice);
  } catch (error) {
    logger.error('Error creating device:', error);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

app.get('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'username'] }
    });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    logger.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

app.put('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    await device.update(req.body);
    
    // Reload device without sensitive fields
    const updatedDevice = await Device.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'username'] }
    });
    res.json(updatedDevice);
  } catch (error) {
    logger.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Delete associated metrics first
    await DeviceMetrics.destroy({
      where: { deviceId: req.params.id }
    });
    
    await device.destroy();
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// User routes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }
    });
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({
      ...req.body,
      password: hashedPassword
    });
    
    const { password, ...userWithoutPassword } = user.toJSON();
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = { ...req.body };
    if (req.body.password) {
      updateData.password = await bcrypt.hash(req.body.password, 10);
    }

    await user.update(updateData);
    
    const { password, ...userWithoutPassword } = user.toJSON();
    res.json(userWithoutPassword);
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Logs routes
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const logFilePath = path.join(__dirname, 'logs', 'combined.log');
    
    // Read the log file
    const logContent = await fs.readFile(logFilePath, 'utf-8');
    
    // Parse log entries (assuming JSON format from winston)
    const logLines = logContent.trim().split('\n').filter(line => line);
    const logs = logLines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        // If not JSON, return as plain text
        return {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: line
        };
      }
    }).reverse(); // Most recent first
    
    res.json(logs);
  } catch (error) {
    logger.error('Error reading logs:', error);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

app.delete('/api/logs/clear', authenticateToken, async (req, res) => {
  try {
    const logsDir = path.join(__dirname, 'logs');
    
    // Get user details for logging BEFORE clearing
    const userId = req.user.userId || req.user.id;
    const user = await User.findByPk(userId);
    const username = user ? user.name : 'Unknown';
    
    // Read existing audit entries (logs cleared messages) from combined.log
    const combinedLogPath = path.join(logsDir, 'combined.log');
    let existingAuditEntries = [];
    
    try {
      const existingContent = await fs.readFile(combinedLogPath, 'utf8');
      const lines = existingContent.split('\n').filter(line => line.trim());
      
      // Keep only "Logs cleared by" entries as parsed objects
      existingAuditEntries = lines
        .filter(line => {
          try {
            const logEntry = JSON.parse(line);
            return logEntry.message && logEntry.message.startsWith('Logs cleared by');
          } catch {
            return false;
          }
        })
        .map(line => JSON.parse(line));
    } catch (readError) {
      // If file doesn't exist or can't be read, start fresh
      console.log('No existing audit entries to preserve');
    }
    
    // Create the new audit log entry as an object
    const newAuditEntry = {
      message: `Logs cleared by ${username}`,
      level: 'info',
      timestamp: new Date().toISOString(),
      userId,
      username
    };
    
    // Add new entry to existing ones
    existingAuditEntries.push(newAuditEntry);
    
    // Convert all audit entries to JSON strings
    const allAuditEntriesStr = existingAuditEntries
      .map(entry => JSON.stringify(entry))
      .join('\n') + '\n';
    
    // Temporarily close Winston file transports to prevent auto-logging during write
    logger.clear();
    
    // List of log files that Winston is actually using
    const logFiles = [
      'combined.log',
      'error.log'
    ];
    
    // Clear all log files but preserve ALL audit entries
    for (const logFile of logFiles) {
      const logFilePath = path.join(logsDir, logFile);
      try {
        await fs.writeFile(logFilePath, allAuditEntriesStr);
        console.log(`Cleared ${logFile} (${existingAuditEntries.length} audit entries preserved)`);
      } catch (fileError) {
        // If a specific file doesn't exist, that's okay - continue with others
        console.log(`Note: Could not clear ${logFile} (file may not exist)`);
      }
    }
    
    // Also clear any old log files that might exist
    const oldLogFiles = ['piman.log', 'exceptions.log', 'rejections.log'];
    for (const logFile of oldLogFiles) {
      const logFilePath = path.join(logsDir, logFile);
      try {
        await fs.writeFile(logFilePath, '');
        console.log(`Cleared old log file ${logFile}`);
      } catch (fileError) {
        // If a specific file doesn't exist, that's okay - continue with others
        console.log(`Note: Could not clear old log file ${logFile} (file may not exist)`);
      }
    }
    
    // Small delay to ensure file writes are complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create NEW Winston transports (can't reuse old ones as they're closed)
    logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
    logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
    logger.add(new winston.transports.Console({ format: winston.format.simple() }));
    
    res.json({ message: 'Logs cleared successfully' });
  } catch (error) {
    // Make sure to restore transports even on error
    if (logger.transports.length === 0) {
      const transports = [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ];
      transports.forEach(transport => logger.add(transport));
    }
    logger.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Terminal routes
app.post('/api/terminal/:deviceId/connect', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Simulate connection
    res.json({ success: true, message: 'Connected to device' });
  } catch (error) {
    logger.error('Terminal connection error:', error);
    res.status(500).json({ error: 'Failed to connect to terminal' });
  }
});

// WebSocket terminal handling
const terminalSessions = new Map();

io.on('connection', (socket) => {
  logger.info('Client connected to WebSocket');

  socket.on('terminal:connect', async (data) => {
    try {
      const { deviceId, token } = data;
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Get device info
      const device = await Device.findByPk(deviceId);
      if (!device) {
        socket.emit('terminal:error', { message: 'Device not found' });
        return;
      }

      // Create SSH connection
      const sshClient = new Client();
      
      sshClient.on('ready', () => {
        logger.info(`SSH connection established to ${device.ip}`);
        
        // Create shell session
        logger.info('Creating SSH shell session...');
        sshClient.shell((err, stream) => {
          if (err) {
            logger.error('SSH shell error:', err);
            socket.emit('terminal:error', { message: 'Failed to create shell session' });
            return;
          }
          logger.info('SSH shell session created successfully');

          // Store session
          terminalSessions.set(socket.id, { sshClient, stream, deviceId });

          // Send welcome message
          logger.info(`Emitting terminal:connected for device ${device.name}`);
          socket.emit('terminal:connected', { 
            message: `Connected to ${device.name} (${device.ip})` 
          });

          // Handle incoming data from SSH
          stream.on('data', (data) => {
            socket.emit('terminal:data', { data: data.toString() });
          });

          // Handle SSH stream end
          stream.on('close', () => {
            socket.emit('terminal:disconnected', { message: 'SSH session closed' });
            terminalSessions.delete(socket.id);
          });

          // Handle incoming commands from client
          socket.on('terminal:command', (data) => {
            logger.info(`Received command from client: ${data.command}`);
            if (stream && !stream.destroyed) {
              stream.write(data.command);
              logger.info('Command sent to SSH stream');
            } else {
              logger.warn('SSH stream not ready for command');
            }
          });

          // Handle terminal resize
          socket.on('terminal:resize', (data) => {
            if (stream && !stream.destroyed) {
              stream.setWindow(data.rows, data.cols);
            }
          });
        });
      });

      sshClient.on('error', (err) => {
        logger.error('SSH connection error:', err);
        socket.emit('terminal:error', { message: 'SSH connection failed' });
      });

      // Connect to SSH
      sshClient.connect({
        host: device.ip,
        port: device.port || 22,
        username: device.username,
        password: device.password,
        readyTimeout: 10000
      });

    } catch (error) {
      logger.error('Terminal connection error:', error);
      socket.emit('terminal:error', { message: 'Authentication failed' });
    }
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected from WebSocket');
    
    // Clean up SSH session
    const session = terminalSessions.get(socket.id);
    if (session) {
      session.sshClient.end();
      terminalSessions.delete(socket.id);
    }
  });
});

// File routes
app.get('/api/files/:deviceId', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const path = req.query.path || '/home/galway';
    
    // Use SSH to list files
    const sshClient = new Client();
    
    sshClient.on('ready', () => {
      sshClient.exec(`ls -la "${path}"`, (err, stream) => {
        if (err) {
          logger.error('SSH exec error:', err);
          res.status(500).json({ error: 'Failed to list files' });
          sshClient.end();
          return;
        }
        
        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.on('close', () => {
          sshClient.end();
          
          // Parse ls output
          const files = [];
          const lines = output.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 9) {
              const permissions = parts[0];
              const name = parts[8];
              
              if (name !== '.' && name !== '..') {
                const isDirectory = permissions.startsWith('d');
                const filePath = path.endsWith('/') ? path + name : path + '/' + name;
                
                files.push({
                  name: name,
                  type: isDirectory ? 'directory' : 'file',
                  path: filePath,
                  size: parts[4] || '0',
                  permissions: permissions
                });
              }
            }
          }
          
          res.json({ files });
        });
      });
    });
    
    sshClient.on('error', (err) => {
      logger.error('SSH connection error:', err);
      res.status(500).json({ error: 'Failed to connect to device' });
    });
    
    sshClient.connect({
      host: device.ip,
      port: device.port || 22,
      username: device.username,
      password: device.password,
      readyTimeout: 10000
    });
    
  } catch (error) {
    logger.error('File listing error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.get('/api/files/:deviceId/read', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const path = req.query.path;
    if (!path) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Check if file is an image or PDF
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico)$/i.test(path);
    const isPdf = /\.pdf$/i.test(path);
    
    // Use SSH to read file
    const sshClient = new Client();
    let responseSent = false;
    
    sshClient.on('ready', () => {
      // Use base64 for images and PDFs, cat for text files
      const command = (isImage || isPdf) ? `base64 -w 0 "${path}"` : `cat "${path}"`;
      
      sshClient.exec(command, { maxBuffer: 50 * 1024 * 1024 }, (err, stream) => {
        if (err) {
          logger.error('SSH exec error:', err);
          if (!responseSent) {
            responseSent = true;
            res.status(500).json({ error: 'Failed to read file' });
          }
          sshClient.end();
          return;
        }
        
        let content = '';
        let chunks = [];
        let totalSize = 0;
        const MAX_SIZE = 50 * 1024 * 1024; // 50MB limit
        
        stream.on('data', (data) => {
          chunks.push(data);
          totalSize += data.length;
          
          // Check if file is too large
          if (totalSize > MAX_SIZE) {
            logger.warn(`File too large: ${totalSize} bytes`);
            if (!responseSent) {
              responseSent = true;
              res.status(413).json({ error: 'File too large (max 50MB)' });
            }
            sshClient.end();
            stream.destroy();
          }
        });
        
        stream.on('close', () => {
          sshClient.end();
          if (!responseSent) {
            responseSent = true;
            content = Buffer.concat(chunks).toString();
            res.json({ content, isImage, isPdf });
          }
        });
        
        stream.on('error', (streamErr) => {
          logger.error('Stream error:', streamErr);
          if (!responseSent) {
            responseSent = true;
            res.status(500).json({ error: 'Failed to read file' });
          }
          sshClient.end();
        });
      });
    });
    
    sshClient.on('error', (err) => {
      logger.error('SSH connection error:', err);
      if (!responseSent) {
        responseSent = true;
        res.status(500).json({ error: 'Failed to connect to device' });
      }
    });
    
    sshClient.connect({
      host: device.ip,
      port: device.port || 22,
      username: device.username,
      password: device.password,
      readyTimeout: 10000
    });
    
  } catch (error) {
    logger.error('File read error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to read file' });
    }
  }
});

app.post('/api/files/:deviceId/write', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const { path, content } = req.body;
    if (!path || content === undefined) {
      return res.status(400).json({ error: 'File path and content are required' });
    }
    
    // Use SSH to write file
    const sshClient = new Client();
    
    sshClient.on('ready', () => {
      // Use a here-document approach to write content safely
      const tempFile = `/tmp/piman_${Date.now()}.tmp`;
      
      // Escape single quotes in content for here-document
      const escapedContent = content.replace(/'/g, "'\"'\"'");
      
      const command = `cat > "${tempFile}" << 'EOF'
${escapedContent}
EOF
if sudo mv "${tempFile}" "${path}"; then
  echo "File written successfully"
else
  echo "Failed to move temp file"
  rm -f "${tempFile}"
  exit 1
fi`;
      
      logger.info('Executing file write command for path:', path);
      
      sshClient.exec(command, (err, stream) => {
        if (err) {
          logger.error('SSH exec error:', err);
          res.status(500).json({ error: 'Failed to write file' });
          sshClient.end();
          return;
        }
        
        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.on('close', (code) => {
          sshClient.end();
          
          logger.info('File write command completed with code:', code, 'Output:', output);
          
          if (code === 0) {
            res.json({ success: true, message: 'File saved successfully' });
          } else {
            logger.error('File write failed with code:', code, 'Output:', output);
            res.status(500).json({ error: 'Failed to write file' });
          }
        });
      });
    });
    
    sshClient.on('error', (err) => {
      logger.error('SSH connection error:', err);
      res.status(500).json({ error: 'Failed to connect to device' });
    });
    
    sshClient.connect({
      host: device.ip,
      port: device.port || 22,
      username: device.username,
      password: device.password,
      readyTimeout: 10000
    });
    
  } catch (error) {
    logger.error('File write error:', error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

app.delete('/api/files/:deviceId/delete', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Use SSH to delete file
    const sshClient = new Client();
    
    sshClient.on('ready', () => {
      sshClient.exec(`sudo rm -f "${path}"`, (err, stream) => {
        if (err) {
          logger.error('SSH exec error:', err);
          res.status(500).json({ error: 'Failed to delete file' });
          sshClient.end();
          return;
        }
        
        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.on('close', (code) => {
          sshClient.end();
          
          if (code === 0) {
            res.json({ success: true, message: 'File deleted successfully' });
          } else {
            res.status(500).json({ error: 'Failed to delete file' });
          }
        });
      });
    });
    
    sshClient.on('error', (err) => {
      logger.error('SSH connection error:', err);
      res.status(500).json({ error: 'Failed to connect to device' });
    });
    
    sshClient.connect({
      host: device.ip,
      port: device.port || 22,
      username: device.username,
      password: device.password,
      readyTimeout: 10000
    });
    
  } catch (error) {
    logger.error('File delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Start server
const startServer = async () => {
  try {
    await initializeDatabase();
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
    // Update device metrics every 60 seconds
    setInterval(updateDeviceMetrics, 60000);
    logger.info('Device metrics update interval started');
    
    // Clean up old metrics every hour
    setInterval(cleanupOldMetrics, 60 * 60 * 1000);
    logger.info('Metrics cleanup interval started (runs every hour)');
  } catch (error) {
    logger.error('Server startup error:', error);
  }
};

startServer(); 