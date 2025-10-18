# PiMan Reverse Proxy Setup Guide

This guide explains how to set up a reverse proxy (nginx, Apache, or Caddy) for PiMan so you can access it via a domain name.

## Why Use a Reverse Proxy?

- Access via clean domain name (e.g., `piman.yourdomain.com`)
- HTTPS/SSL support for secure connections
- Single port (80/443) instead of multiple ports (3000, 3001)
- Better security and access control
- Load balancing capabilities

## Nginx Setup (Recommended)

### Step 1: Install Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### Step 2: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/piman
```

Copy the contents from `nginx-example.conf` and modify:
- Replace `your-domain.com` with your actual domain
- Update SSL certificate paths if using HTTPS
- Or use the HTTP-only version at the bottom

### Step 3: Enable the Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/piman /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 4: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Or specific ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Apache Setup

### Step 1: Install Apache

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install apache2

# Enable required modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo a2enmod ssl
```

### Step 2: Create Apache Configuration

```bash
sudo nano /etc/apache2/sites-available/piman.conf
```

Add the following configuration:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    
    # Redirect to HTTPS (optional)
    # Redirect permanent / https://your-domain.com/
    
    # Frontend
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # Backend API
    ProxyPass /api http://localhost:3001/api
    ProxyPassReverse /api http://localhost:3001/api
    
    # WebSocket
    ProxyPass /socket.io http://localhost:3001/socket.io
    ProxyPassReverse /socket.io http://localhost:3001/socket.io
    
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:3001/$1" [P,L]
    
    ErrorLog ${APACHE_LOG_DIR}/piman_error.log
    CustomLog ${APACHE_LOG_DIR}/piman_access.log combined
</VirtualHost>
```

### Step 3: Enable the Site

```bash
# Enable site
sudo a2ensite piman

# Test configuration
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

## Caddy Setup (Easiest)

### Step 1: Install Caddy

```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Step 2: Create Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

Add the following (Caddy automatically handles HTTPS):

```caddy
your-domain.com {
    # Frontend
    reverse_proxy localhost:3000
    
    # Backend API
    handle /api/* {
        reverse_proxy localhost:3001
    }
    
    # WebSocket
    handle /socket.io/* {
        reverse_proxy localhost:3001
    }
}
```

### Step 3: Restart Caddy

```bash
sudo systemctl restart caddy
```

That's it! Caddy automatically handles HTTPS with Let's Encrypt.

## DNS Configuration

Point your domain to your server:

```
Type: A
Name: @ (or subdomain like 'piman')
Value: YOUR_SERVER_IP
TTL: 3600
```

## SSL/HTTPS Setup (Optional but Recommended)

### Option 1: Let's Encrypt with Certbot (Nginx)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate and auto-configure nginx
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Option 2: Let's Encrypt with Certbot (Apache)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-apache

# Get certificate and auto-configure Apache
sudo certbot --apache -d your-domain.com
```

### Option 3: Caddy (Automatic)

Caddy automatically handles SSL certificates via Let's Encrypt. No configuration needed!

## Testing

### Test Frontend
```bash
curl http://your-domain.com
# Should return HTML
```

### Test Backend API
```bash
curl http://your-domain.com/api/devices
# Should return 401 (auth required) or device data if authenticated
```

### Test in Browser
1. Open `http://your-domain.com` (or `https://` if SSL configured)
2. Login with `admin@piman.com` / `admin123`
3. Check browser console for errors
4. Test all features (dashboard, devices, terminal, files)

## Troubleshooting

### 502 Bad Gateway

Check if PiMan is running:
```bash
docker ps | grep piman
```

Check logs:
```bash
docker logs piman
```

### API Calls Failing

Check browser console for the API URL being used.

If you see errors, try setting an explicit API URL in the config:
```bash
# In your reverse proxy, add a header:
proxy_set_header X-Forwarded-Proto $scheme;
```

Or set an environment variable when building:
```bash
REACT_APP_API_URL="" docker compose up -d --build
```

### WebSocket Connection Failed

Ensure your proxy passes WebSocket upgrade headers:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Mixed Content Errors (HTTPS)

Ensure all resources are loaded over HTTPS. Check that Socket.IO is using the correct protocol.

## Environment Variable Override

If automatic detection fails, you can force a specific API URL:

### Docker Compose
```yaml
services:
  piman:
    build:
      context: .
      args:
        - REACT_APP_API_URL=
    environment:
      - REACT_APP_API_URL=
```

### Dockerfile
```dockerfile
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
```

## Security Best Practices

1. Always use HTTPS in production
2. Configure firewall to only allow necessary ports
3. Use strong SSL ciphers
4. Enable HSTS (HTTP Strict Transport Security)
5. Implement rate limiting
6. Keep reverse proxy and PiMan updated
7. Use fail2ban to prevent brute force attacks

## Example Production Setup

```nginx
# /etc/nginx/sites-available/piman
server {
    listen 80;
    server_name piman.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name piman.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/piman.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/piman.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    client_max_body_size 100M;
}
```

This setup provides:
- HTTPS with Let's Encrypt
- HTTP to HTTPS redirect
- WebSocket support
- Security headers
- Large file upload support

