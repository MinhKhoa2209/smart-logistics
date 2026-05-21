# ============================================================
# Smart Logistics — Full Setup Script (Windows PowerShell)
# ============================================================
# Usage:
#   .\scripts\setup.ps1
#
# Prerequisites:
#   - Docker Desktop running
#   - .env file created from .env.example
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Smart Logistics — Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── Check prerequisites ──────────────────────────────────────
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    Write-Host "  Run: cp .env.example .env" -ForegroundColor Yellow
    Write-Host "  Then edit .env and set POSTGRES_PASSWORD" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker not found! Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# ─── Step 1: Stop old containers and remove volumes ───────────
Write-Host "[1/7] Stopping old containers and removing volumes..." -ForegroundColor Yellow
docker-compose down -v 2>$null
Write-Host "  Done." -ForegroundColor Green

# ─── Step 2: Start services ───────────────────────────────────
Write-Host "[2/7] Starting Docker services (db + backend + frontend)..." -ForegroundColor Yellow
docker-compose up -d --build
Write-Host "  Containers started." -ForegroundColor Green

# ─── Step 3: Wait for database to be healthy ──────────────────
Write-Host "[3/7] Waiting for database to be healthy..." -ForegroundColor Yellow
$maxWait = 90
$waited = 0
do {
    Start-Sleep -Seconds 3
    $waited += 3
    $status = docker inspect --format='{{.State.Health.Status}}' smartlogistic-db 2>$null
    if ($waited % 9 -eq 0) {
        Write-Host "  Waiting... ($waited s, status: $status)" -ForegroundColor Gray
    }
} while ($status -ne "healthy" -and $waited -lt $maxWait)

if ($status -ne "healthy") {
    Write-Host "[ERROR] Database did not become healthy after ${maxWait}s." -ForegroundColor Red
    Write-Host "  Check: docker logs smartlogistic-db" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Database is healthy!" -ForegroundColor Green

# ─── Step 4: Restore database schema ─────────────────────────
Write-Host "[4/7] Restoring database schema from pg_dump..." -ForegroundColor Yellow
docker cp database/smart_logistics.sql smartlogistic-db:/tmp/dump.sql
docker exec smartlogistic-db pg_restore -U postgres -d smart_logistics --no-owner --no-privileges /tmp/dump.sql 2>$null
Write-Host "  Schema restored." -ForegroundColor Green

# ─── Step 5: Seed demo data ──────────────────────────────────
Write-Host "[5/7] Seeding demo data..." -ForegroundColor Yellow
docker cp database/seed.sql smartlogistic-db:/tmp/seed.sql
docker exec smartlogistic-db psql -U postgres -d smart_logistics -f /tmp/seed.sql -q 2>$null
Write-Host "  Data seeded." -ForegroundColor Green

# ─── Step 6: Fix trigger (if needed) ─────────────────────────
Write-Host "[6/7] Applying trigger fix..." -ForegroundColor Yellow
if (Test-Path "database/fix_trigger.sql") {
    docker cp database/fix_trigger.sql smartlogistic-db:/tmp/fix_trigger.sql
    docker exec smartlogistic-db psql -U postgres -d smart_logistics -f /tmp/fix_trigger.sql -q 2>$null
}
if (Test-Path "database/app_user.sql") {
    $appDbUser = if ($env:APP_DB_USER) { $env:APP_DB_USER } else { "app_user" }
    $appDbPassword = if ($env:APP_DB_PASSWORD) { $env:APP_DB_PASSWORD } else { "app_password" }
    docker cp database/app_user.sql smartlogistic-db:/tmp/app_user.sql
    docker exec smartlogistic-db psql -U postgres -d smart_logistics -v app_user="$appDbUser" -v app_password="$appDbPassword" -f /tmp/app_user.sql -q 2>$null
}
Write-Host "  Triggers updated." -ForegroundColor Green

# ─── Step 7: Setup Ollama embeddings (optional) ───────────────
Write-Host "[7/7] Setting up Ollama embeddings for semantic search..." -ForegroundColor Yellow
Write-Host "  (Ollama is managed by docker-compose.yml)" -ForegroundColor Gray

# Check if Ollama is reachable from backend
$ollamaReachable = docker exec smartlogistic-backend node -e "fetch('http://ollama:11434/api/tags').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>$null
if ($LASTEXITCODE -eq 0) {
    docker cp backend/setup-ollama.js smartlogistic-backend:/app/setup-ollama.js
    docker exec smartlogistic-backend node /app/setup-ollama.js
    Write-Host "  Embeddings generated!" -ForegroundColor Green
} else {
    Write-Host "  Ollama not running — skipping embeddings." -ForegroundColor Yellow
    Write-Host "  Semantic search will not work until Ollama is healthy. Then run:" -ForegroundColor Yellow
    Write-Host "    docker compose up -d ollama" -ForegroundColor Gray
    Write-Host "    docker cp backend/setup-ollama.js smartlogistic-backend:/app/setup-ollama.js" -ForegroundColor Gray
    Write-Host "    docker exec smartlogistic-backend node /app/setup-ollama.js" -ForegroundColor Gray
}

# ─── Done ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend:    http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend API: http://localhost:3000/api" -ForegroundColor Green
Write-Host "  Health:      http://localhost:3000/api/health" -ForegroundColor Green
Write-Host "  Database:    localhost:5433 (user: postgres)" -ForegroundColor Green
Write-Host ""
