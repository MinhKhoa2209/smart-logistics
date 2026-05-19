# Smart Logistics System

A warehouse operations and logistics management system built to demonstrate advanced PostgreSQL features.

## PostgreSQL Features Demonstrated

| Feature | Where |
|---|---|
| Transactions + COMMIT/ROLLBACK | Purchase order receiving |
| SELECT ... FOR UPDATE (row locking) | Stock transfers |
| Triggers | Auto-PO on low stock, inventory sync, audit logging |
| Stored Functions | `move_stock_advanced()`, `suggest_smart_warehouse()`, `calculate_distance()` |
| Partial Indexes | `idx_inventory_low_stock` — low stock queries |
| Materialized Views | `mv_inventory_summary` — warehouse reporting |
| Table Partitioning | `stock_movements` partitioned by year |
| Row Level Security (RLS) | Inventory access by role |
| pgvector Semantic Search | Product search using `<=>` cosine distance |
| Audit Logging | JSONB diff on all DML operations |

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS
- **Backend**: Express.js 5 + TypeScript + pg driver (SQL-first)
- **Database**: PostgreSQL 17 + pgvector 0.8
- **Embeddings**: Ollama (`nomic-embed-text`) — local, no API key needed
- **DevOps**: Docker + Docker Compose

## Quick Start

### Prerequisites
- Docker Desktop

### 1. Clone and configure

```bash
git clone <repo-url>
cd smart-logistics

# Create .env from template (only file you need to create)
cp .env.example .env
```

Edit `.env` and set your password:
```
POSTGRES_PASSWORD=your_secure_password
```

> **Important:** If you change `POSTGRES_PASSWORD` after the database volume already exists, you must delete the old volume first:
> ```bash
> docker-compose down -v   # removes pgdata volume
> docker-compose up -d     # recreates DB with new password
> ```
> Then re-run steps 3–5 to restore schema and seed data.

### 2. Start all services

**Option A — Automated setup (recommended):**

```bash
# Linux/Mac
bash scripts/setup.sh

# Windows PowerShell
.\scripts\setup.ps1
```

This script automatically: starts Docker, waits for DB, restores schema, seeds data, and sets up embeddings.

**Option B — Manual setup:**

This starts: PostgreSQL, Ollama, Backend API, Frontend.

### 3. Import database schema

```bash
docker cp database/smart_logistics.sql smartlogistic-db:/tmp/dump.sql
docker exec smartlogistic-db pg_restore -U postgres -d smart_logistics --no-owner /tmp/dump.sql
```

### 4. Seed demo data

```bash
docker cp database/seed.sql smartlogistic-db:/tmp/seed.sql
docker exec smartlogistic-db psql -U postgres -d smart_logistics -f /tmp/seed.sql
```

### 5. Setup Ollama embeddings (for semantic search)

```bash
# Pull nomic-embed-text model and generate embeddings for all products
docker cp backend/setup-ollama.js smartlogistic-backend:/app/setup-ollama.js
docker exec smartlogistic-backend node /app/setup-ollama.js
```

> Note: This step requires the Ollama container to be running and healthy.
> The model download (~274MB) happens automatically on first run.

### 6. Open the app

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health check**: http://localhost:3000/api/health

## Environment Variables

See `backend/.env.example` for all available options.

Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `OLLAMA_URL` — Ollama service URL (default: `http://ollama:11434`)
- `EMBEDDING_MODEL` — Ollama model name (default: `nomic-embed-text`)
