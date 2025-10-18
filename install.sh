#!/bin/bash

# PiMan Docker Installation Script
# This script makes it super easy to install and run PiMan

echo "PiMan Docker Installation"
echo "=========================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed. Please install Docker Compose first:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "SUCCESS: Docker and Docker Compose are installed"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: Please run this script from the PiMan directory"
    echo "   Make sure you're in the folder containing docker-compose.yml"
    exit 1
fi

echo "Building and starting PiMan..."
echo "   This may take a few minutes on first run..."

# Build and start the containers
docker compose up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "SUCCESS: PiMan is now running!"
    echo ""
    echo "Access PiMan at: http://localhost:3000"
    echo "Default login: admin@piman.com / admin123"
    echo ""
    echo "Useful commands:"
    echo "   View logs:     docker compose logs -f"
    echo "   Stop PiMan:    docker compose down"
    echo "   Restart:       docker compose restart"
    echo ""
    echo "Full documentation: DOCKER_INSTALL.md"
else
    echo "ERROR: Failed to start PiMan. Check the logs:"
    echo "   docker compose logs"
    exit 1
fi
