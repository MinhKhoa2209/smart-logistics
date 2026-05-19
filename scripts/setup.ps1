# Smart Logistics — Full setup script (Windows PowerShell)
# Run this after cloning or after changing POSTGRES_PASSWORD
# Usage: .\scripts\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Smart Logistics Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check .env exists
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env file not found. Run: cp .env.example .env" -ForegroundColor Red
    exit 1
}

Write-Host "[1/6] Stopping and removing old containers + volumes..." -ForegroundColor Yellow
docker-compose down -v 2>$null

Write-Host "[2/6] Starting services..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "[3/6] Waiting for database to be healthy..." -ForegroundColor Yellow
$maxWait = 60
$waited = 0
do {
    Start-Sleep -Seconds 3
    $waited += 3
    $status = docker inspect --format='{{.State.Health.Status}}' smartlogistic-db 2>$null
    Write-Host "  DB status: $status (${waited}s)"
} while ($status -ne "healthy" -and $waited -lt $maxWait)

if ($status -ne "healthy") {
    Write-Host "ERROR: Database did not become healthy in time." -ForegroundColor Red
    exit 1
}
Write-Host "  Database is ready!" -ForegroundColor Green

Write-Host "[4/6] Restoring database schema..." -ForegroundColor Yellow
docker cp database/smart_logistics.sql smartlogistic-db:/tmp/dump.sql
docker exec smartlogistic-db pg_restore -U postgres -d smart_logistics --no-owner --no-privileges /tmp/dump.sql
Write-Host "  Schema restored!" -ForegroundColor Green

Write-Host "[5/6] Seeding demo data..." -ForegroundColor Yellow
docker cp database/seed.sql smartlogistic-db:/tmp/seed.sql
docker exec smartlogistic-db psql -U postgres -d smart_logistics -f /tmp/seed.sql -q
Write-Host "  Data seeded!" -ForegroundColor Green

Write-Host "[6/6] Setting up Ollama embeddings..." -ForegroundColor Yellow
docker cp backend/setup-ollama.js smartlogistic-backend:/app/setup-ollama.js
docker exec smartlogistic-backend node /app/setup-ollama.js
Write-Host "  Embeddings ready!" -ForegroundColor Green

Write-Host ""
Write-Host "=== Setup complete! ===" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "Backend:  http://localhost:3000/api/health" -ForegroundColor Green
