#!/bin/bash

# PiMan Docker Update Script
# This script pulls the latest changes from GitHub and rebuilds the Docker container

set -e  # Exit on error

echo "=========================================="
echo "PiMan Docker Update Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker is not installed${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}ERROR: Docker Compose is not installed${NC}"
    exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${RED}ERROR: Not a git repository${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking for updates from GitHub...${NC}"
git fetch origin

# Check if there are updates
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL = $REMOTE ]; then
    echo -e "${GREEN}Already up to date!${NC}"
    read -p "Do you want to rebuild anyway? (y/N): " REBUILD
    if [[ ! $REBUILD =~ ^[Yy]$ ]]; then
        echo "Exiting without rebuild."
        exit 0
    fi
else
    echo -e "${YELLOW}Updates available!${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Pulling latest changes...${NC}"
git pull origin main || git pull origin master

echo ""
echo -e "${YELLOW}Step 3: Stopping current container...${NC}"
docker compose down

echo ""
echo -e "${YELLOW}Step 4: Rebuilding Docker image...${NC}"
docker compose build --no-cache

echo ""
echo -e "${YELLOW}Step 5: Starting updated container...${NC}"
docker compose up -d

echo ""
echo -e "${YELLOW}Step 6: Waiting for services to start...${NC}"
sleep 5

echo ""
echo -e "${YELLOW}Step 7: Checking container status...${NC}"
docker ps | grep piman

echo ""
echo -e "${YELLOW}Step 8: Viewing recent logs...${NC}"
docker logs piman --tail 20

echo ""
echo -e "${GREEN}=========================================="
echo "SUCCESS: PiMan has been updated!"
echo "==========================================${NC}"
echo ""
echo "Access at: http://$(hostname -I | awk '{print $1}'):3000"
echo "Default login: admin@piman.com / admin123"
echo ""
echo "To view logs: docker logs piman -f"
echo "To stop: docker compose down"
echo ""

