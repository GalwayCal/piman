#!/bin/bash

# PiMan Docker Uninstallation Script

echo "PiMan Uninstallation"
echo "====================="

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: Please run this script from the PiMan directory"
    exit 1
fi

echo "Stopping PiMan containers..."
docker-compose down

echo "Removing PiMan containers and images..."
docker-compose down --rmi all --volumes --remove-orphans

echo "Cleaning up Docker system..."
docker system prune -f

echo ""
echo "SUCCESS: PiMan has been completely removed!"
echo ""
echo "Note: Your data volumes have been removed."
echo "   If you had important data, make sure you backed it up first."
echo ""
echo "To reinstall PiMan, just run: ./install.sh"
