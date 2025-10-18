#!/bin/bash

echo "Stopping PiMan container..."
docker compose down

echo "Rebuilding Docker image..."
docker compose build --no-cache

echo "Starting PiMan..."
docker compose up -d

echo "Waiting for services to start..."
sleep 5

echo "Checking container status..."
docker ps | grep piman

echo "Viewing logs..."
docker logs piman --tail 20

echo ""
echo "SUCCESS: PiMan has been rebuilt and restarted"
echo "Access at: http://$(hostname -I | awk '{print $1}'):3000"
echo "Default login: admin@piman.com / admin123"

