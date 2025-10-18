# PiMan Auto-Update Guide

This guide explains how to set up automatic updates for PiMan using GitHub webhooks or manual update scripts.

## Manual Update

### Quick Update

Simply run the update script:

```bash
cd /root/piman
chmod +x update.sh
./update.sh
```

This will:
1. Check for updates from GitHub
2. Pull latest changes
3. Stop the current container
4. Rebuild the Docker image
5. Start the updated container

## Automatic Updates with GitHub Webhooks

### Option 1: Using the Webhook Server

#### Step 1: Install Dependencies

The webhook server requires Node.js (already installed with PiMan):

```bash
cd /root/piman
# Dependencies are already installed with PiMan
```

#### Step 2: Configure the Webhook Secret

Edit the systemd service file and set a secure secret:

```bash
nano piman-webhook.service
```

Change `your-webhook-secret-here` to a random, secure string:

```
Environment="WEBHOOK_SECRET=YOUR_RANDOM_SECRET_HERE"
```

Generate a secure secret:

```bash
openssl rand -hex 32
```

#### Step 3: Install the Webhook Service

```bash
# Copy service file to systemd
sudo cp piman-webhook.service /etc/systemd/system/

# Update paths if PiMan is not in /root/piman
sudo nano /etc/systemd/system/piman-webhook.service

# Reload systemd
sudo systemctl daemon-reload

# Start the service
sudo systemctl start piman-webhook

# Enable auto-start on boot
sudo systemctl enable piman-webhook

# Check status
sudo systemctl status piman-webhook
```

#### Step 4: Configure GitHub Webhook

1. Go to your GitHub repository
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure:
   - **Payload URL**: `http://YOUR_SERVER_IP:9000/webhook`
   - **Content type**: `application/json`
   - **Secret**: (paste the secret from Step 2)
   - **Events**: Select "Just the push event"
   - **Active**: ✓ Checked
4. Click **Add webhook**

#### Step 5: Test the Webhook

Make a small change to your repository and push to main/master:

```bash
# On your development machine
git add .
git commit -m "Test webhook"
git push
```

Watch the webhook logs:

```bash
tail -f /root/piman/webhook.log
```

Or check status via HTTP:

```bash
curl http://localhost:9000/status
```

### Option 2: Using a Cron Job

If you prefer scheduled updates instead of webhooks, set up a cron job:

```bash
# Open crontab
crontab -e

# Add one of these lines:

# Update every day at 2 AM
0 2 * * * cd /root/piman && ./update.sh >> /root/piman/cron-update.log 2>&1

# Update every 6 hours
0 */6 * * * cd /root/piman && ./update.sh >> /root/piman/cron-update.log 2>&1

# Update every hour
0 * * * * cd /root/piman && ./update.sh >> /root/piman/cron-update.log 2>&1
```

## Firewall Configuration

If using webhooks, ensure port 9000 is accessible from GitHub:

```bash
# UFW
sudo ufw allow 9000/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 9000 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

For security, you can restrict to GitHub's webhook IPs:
https://api.github.com/meta (see "hooks" array)

## Monitoring

### Webhook Server Logs

```bash
# View live logs
tail -f /root/piman/webhook.log

# View systemd logs
journalctl -u piman-webhook -f

# Check last 50 lines
tail -n 50 /root/piman/webhook.log
```

### Container Logs

```bash
# View PiMan container logs
docker logs piman -f

# View last 100 lines
docker logs piman --tail 100
```

### Health Check

```bash
# Check webhook server health
curl http://localhost:9000/health

# Check container status
docker ps | grep piman
```

## Troubleshooting

### Webhook Not Triggering

1. Check webhook server is running:
   ```bash
   sudo systemctl status piman-webhook
   ```

2. Check GitHub webhook deliveries:
   - Go to repository **Settings** → **Webhooks**
   - Click on your webhook
   - Check **Recent Deliveries** tab

3. Verify firewall allows connections on port 9000

4. Check logs for errors:
   ```bash
   tail -f /root/piman/webhook.log
   ```

### Update Fails

1. Check Docker is running:
   ```bash
   sudo systemctl status docker
   ```

2. Check disk space:
   ```bash
   df -h
   ```

3. Manually run update to see errors:
   ```bash
   cd /root/piman
   ./update.sh
   ```

4. Check for merge conflicts:
   ```bash
   git status
   ```

### Rollback to Previous Version

```bash
# Stop container
docker compose down

# Check git history
git log --oneline -10

# Rollback to previous commit
git reset --hard COMMIT_HASH

# Rebuild
docker compose up -d --build
```

## Security Best Practices

1. Use a strong webhook secret (at least 32 random characters)
2. Only allow webhooks from GitHub IPs
3. Use HTTPS if possible (requires reverse proxy like nginx)
4. Regularly review webhook logs
5. Keep the server and Docker updated

## Advanced: HTTPS with Nginx

For production, use nginx as a reverse proxy with SSL:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /webhook {
        proxy_pass http://localhost:9000/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then use `https://your-domain.com/webhook` as the GitHub webhook URL.

## Useful Commands

```bash
# Start webhook server
sudo systemctl start piman-webhook

# Stop webhook server
sudo systemctl stop piman-webhook

# Restart webhook server
sudo systemctl restart piman-webhook

# View webhook status
sudo systemctl status piman-webhook

# Disable auto-start
sudo systemctl disable piman-webhook

# Enable auto-start
sudo systemctl enable piman-webhook

# Manual update
cd /root/piman && ./update.sh

# Force rebuild without pulling
cd /root/piman && docker compose up -d --build --force-recreate
```

