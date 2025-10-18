# PiMan Docker Installation

## Quick Start (3 Commands!)

### Prerequisites
- Docker installed on your system
- Git (to download the code)

### Installation Steps

1. **Download PiMan**
   ```bash
   git clone https://github.com/GalwayCal/piman.git
   cd piman
   ```

2. **Start PiMan**
   ```bash
   docker-compose up -d
   ```

3. **Access PiMan**
   - Open your browser to: `http://localhost:3000`
   - Default login: `admin@piman.com` / `admin123`

That's it!

---

## What This Does

- **Builds** the PiMan application automatically
- **Runs** both frontend (port 3000) and backend (port 3001)
- **Persists** your data and logs between restarts
- **Secures** the application with proper user permissions

---

## Managing PiMan

### Start PiMan
```bash
docker-compose up -d
```

### Stop PiMan
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f
```

### Restart PiMan
```bash
docker-compose restart
```

### Update PiMan
```bash
git pull
docker-compose down
docker-compose up -d --build
```

---

## Data Persistence

Your data is automatically saved in Docker volumes:
- **Database**: `piman_data` volume
- **Logs**: `piman_logs` volume

Even if you delete the container, your data remains safe!

---

## Troubleshooting

### Port Already in Use
If ports 3000 or 3001 are already in use, edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Change 3000 to 8080
  - "8081:3001"  # Change 3001 to 8081
```

### Permission Issues
```bash
sudo docker-compose up -d
```

### View Container Status
```bash
docker-compose ps
```

---

## Advanced Usage

### Custom Configuration
Edit `docker-compose.yml` to change:
- Ports
- Environment variables
- Volume locations

### Backup Data
```bash
docker run --rm -v piman_data:/data -v $(pwd):/backup alpine tar czf /backup/piman-backup.tar.gz -C /data .
```

### Restore Data
```bash
docker run --rm -v piman_data:/data -v $(pwd):/backup alpine tar xzf /backup/piman-backup.tar.gz -C /data
```


