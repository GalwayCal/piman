#!/usr/bin/env node

/**
 * PiMan GitHub Webhook Server
 * 
 * This server listens for GitHub webhook events and automatically
 * updates the Docker container when changes are pushed to the repository.
 * 
 * Setup:
 * 1. Run: npm install express body-parser
 * 2. Configure GitHub webhook:
 *    - Payload URL: http://YOUR_SERVER_IP:9000/webhook
 *    - Content type: application/json
 *    - Secret: (set WEBHOOK_SECRET environment variable)
 *    - Events: Just the push event
 * 3. Run: node webhook-server.js
 */

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
const LOG_FILE = path.join(__dirname, 'webhook.log');

// Middleware
app.use(bodyParser.json());

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Verify GitHub webhook signature
function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Execute update script
function executeUpdate() {
  log('Starting update process...');
  
  try {
    // Make update script executable
    execSync('chmod +x update.sh', { cwd: __dirname });
    
    // Execute update script
    const output = execSync('./update.sh', { 
      cwd: __dirname,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    log('Update output:\n' + output);
    log('Update completed successfully');
    return { success: true, output };
  } catch (error) {
    log('Update failed: ' + error.message);
    if (error.stdout) log('stdout: ' + error.stdout);
    if (error.stderr) log('stderr: ' + error.stderr);
    return { success: false, error: error.message };
  }
}

// Webhook endpoint
app.post('/webhook', (req, res) => {
  log('Received webhook request');
  
  // Verify signature
  if (!verifySignature(req)) {
    log('Invalid signature - rejecting request');
    return res.status(401).send('Invalid signature');
  }
  
  // Check if it's a push event
  const event = req.headers['x-github-event'];
  if (event !== 'push') {
    log(`Ignoring non-push event: ${event}`);
    return res.status(200).send('Event ignored');
  }
  
  // Get branch information
  const branch = req.body.ref.replace('refs/heads/', '');
  log(`Push event received for branch: ${branch}`);
  
  // Only update on main/master branch
  if (branch !== 'main' && branch !== 'master') {
    log(`Ignoring push to non-main branch: ${branch}`);
    return res.status(200).send('Branch ignored');
  }
  
  // Respond immediately to GitHub
  res.status(200).send('Update initiated');
  
  // Execute update asynchronously
  log('Initiating update...');
  setTimeout(() => {
    executeUpdate();
  }, 1000);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  try {
    // Read last 50 lines of log
    const logs = execSync(`tail -n 50 ${LOG_FILE}`, { encoding: 'utf-8' });
    res.status(200).json({
      status: 'running',
      logs: logs.split('\n')
    });
  } catch (error) {
    res.status(200).json({
      status: 'running',
      logs: []
    });
  }
});

// Start server
app.listen(PORT, () => {
  log(`PiMan Webhook Server listening on port ${PORT}`);
  log(`Webhook URL: http://YOUR_SERVER_IP:${PORT}/webhook`);
  log(`Health check: http://YOUR_SERVER_IP:${PORT}/health`);
  log(`Status: http://YOUR_SERVER_IP:${PORT}/status`);
  log(`Secret: ${SECRET === 'your-webhook-secret' ? 'WARNING: Using default secret!' : 'Custom secret configured'}`);
});

