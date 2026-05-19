#!/bin/bash
# Smart Logistics — Full setup script
# Run this after cloning or after changing POSTGRES_PASSWORD
# Usage: bash scripts/setup.sh

set -e

echo "=== Smart Logistics Setup ==="
echo ""

# Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Run: cp .env.example .env"
  exit 1
fi

echo "[1/6] Stopping and removing old containers + volumes..."
docker-compose down -v 2>/dev/null || true

echo "[2/6] Starting services..."
docker-compose up -d

echo "[3/6] Waiting for database to be healthy..."
until docker exec smartlogistic-db pg_isready -U postgres -d smart_logistics > /dev/null 2>&1; do
  echo "  Waiting for DB..."
  sleep 3
done
echo "  Database is ready!"

echo "[4/6] Restoring database schema..."
docker cp database/smart_logistics.sql smartlogistic-db:/tmp/dump.sql
docker exec smartlogistic-db pg_restore -U postgres -d smart_logistics --no-owner --no-privileges /tmp/dump.sql
echo "  Schema restored!"

echo "[5/6] Seeding demo data..."
docker cp database/seed.sql smartlogistic-db:/tmp/seed.sql
docker exec smartlogistic-db psql -U postgres -d smart_logistics -f /tmp/seed.sql -q
echo "  Data seeded!"

echo "[6/6] Setting up Ollama embeddings (requires internet for first run)..."
docker cp backend/setup-ollama.js smartlogistic-backend:/app/setup-ollama.js
docker exec smartlogistic-backend node /app/setup-ollama.js
echo "  Embeddings ready!"

echo ""
echo "=== Setup complete! ==="
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3000/api/health"
