# PiMan - Raspberry Pi Fleet Management System

A modern web application for managing a fleet of Raspberry Pi devices. Built with React frontend and Node.js backend with SQLite database.

## Features

- **Dashboard**: Overview of all devices with charts and statistics
- **Device Management**: Add, edit, and monitor Raspberry Pi devices
- **Remote Terminal**: SSH access to devices through web interface
- **File Editor**: Browse and edit files on remote devices
- **User Management**: Manage system users and permissions
- **Real-time Monitoring**: CPU, memory, and disk usage tracking

## Tech Stack

### Frontend
- React 18
- React Router DOM
- Lucide React (Icons)
- Recharts (Charts)
- xterm.js (Terminal)
- Monaco Editor (File Editor)

### Backend
- Node.js/Express.js
- SQLite (Database)
- Sequelize (ORM)
- JWT (Authentication)
- Socket.IO (Real-time communication)
- SSH2 (SSH connections)

## Getting Started

### Quick Start with Docker (Recommended)

**Option A: One-command install**
```bash
git clone https://github.com/GalwayCal/piman.git && cd piman && ./install.sh
```

**Option B: Manual Docker commands**
```bash
git clone https://github.com/GalwayCal/piman.git
cd piman
docker-compose up -d
```

Open `http://localhost:3000` and login with `admin@piman.com` / `admin123`

**[Complete Docker Guide](DOCKER_INSTALL.md)** - Full instructions and troubleshooting  
**[Auto-Update Guide](AUTO_UPDATE.md)** - Set up automatic updates from GitHub  
**[Reverse Proxy Guide](REVERSE_PROXY.md)** - Access via domain name with nginx/Apache/Caddy  


---

### Manual Installation

#### Prerequisites
- Node.js 16+
- npm or yarn

#### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd piman
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd server
npm install
```

4. Set up environment variables:
```bash
cd server
cp .env.example .env
# Edit .env with your configuration
```

5. Start the backend server:
```bash
cd server
npm start
```

6. Start the frontend development server:
```bash
# From the root directory
npm start
```

The application will be available at `http://localhost:3000`

## Default Credentials

- **Email**: admin@piman.com
- **Password**: admin123

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Devices
- `GET /api/devices` - Get all devices
- `POST /api/devices` - Add new device
- `GET /api/devices/:id` - Get device by ID
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Add new user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Terminal
- `POST /api/terminal/:deviceId/connect` - Connect to device terminal
- `POST /api/terminal/:deviceId/command` - Execute command

### Files
- `GET /api/files/:deviceId` - List files
- `GET /api/files/:deviceId/read` - Read file content
- `POST /api/files/:deviceId/write` - Write file content


