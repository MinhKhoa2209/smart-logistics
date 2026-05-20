# Architecture Diagram — Smart Logistics System

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER COMPOSE                                      │
│                                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────┐   │
│  │    FRONTEND      │    │     BACKEND      │    │       DATABASE           │   │
│  │                  │    │                  │    │                          │   │
│  │  React 19        │    │  Express.js 5    │    │  PostgreSQL 17           │   │
│  │  Vite            │    │  TypeScript      │    │  + pgvector 0.8          │   │
│  │  TailwindCSS     │    │  pg driver       │    │                          │   │
│  │  shadcn/ui       │    │  Zod validation  │    │  23 tables               │   │
│  │  Recharts        │    │                  │    │  4 triggers              │   │
│  │                  │    │  12 route modules │    │  3 stored functions      │   │
│  │  nginx (prod)    │    │  12 services     │    │  4 partitions            │   │
│  │                  │    │  11 repositories  │    │  RLS policies            │   │
│  │  Port: 5173      │    │  Port: 3000      │    │  Materialized view       │   │
│  └────────┬─────────┘    └────────┬─────────┘    │  Partial indexes         │   │
│           │                       │               │  Audit logging           │   │
│           │  /api/* (proxy)       │  pg Pool      │                          │   │
│           └───────────────────────┘───────────────┘  Port: 5433              │   │
│                                                                               │   │
│  ┌──────────────────┐                                                         │   │
│  │     OLLAMA       │  (optional — for semantic search)                       │   │
│  │                  │                                                         │   │
│  │  nomic-embed-text│                                                         │   │
│  │  768 dimensions  │                                                         │   │
│  │  Port: 11434     │                                                         │   │
│  └──────────────────┘                                                         │   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow

```
┌──────────┐         ┌─────────┐         ┌─────────┐         ┌────────────┐
│  Browser │ ──────> │  nginx  │ ──────> │ Express │ ──────> │ PostgreSQL │
│          │  HTTP   │ (5173)  │  /api/* │ (3000)  │   SQL   │  (5433)    │
│          │ <────── │         │ <────── │         │ <────── │            │
│          │  HTML   │ static  │  JSON   │         │  rows   │            │
└──────────┘         └─────────┘         └────┬────┘         └────────────┘
                                              │
                                              │ HTTP (embedding)
                                              ▼
                                         ┌─────────┐
                                         │ Ollama  │
                                         │ (11434) │
                                         └─────────┘
```

---

## Backend Architecture (3-Layer)

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  MIDDLEWARE LAYER                                            │
│  ┌──────────┐  ┌────────────┐  ┌───────────────────────┐   │
│  │  Helmet  │  │    CORS    │  │  appContext            │   │
│  │ (security)│  │ (origins) │  │ SET LOCAL user_id      │   │
│  └──────────┘  └────────────┘  │ (for RLS + audit)      │   │
│                                └───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  ROUTES LAYER (12 modules)                                  │
│                                                             │
│  /api/dashboard          /api/products                      │
│  /api/warehouses         /api/inventory                     │
│  /api/stock-movements    /api/purchase-orders               │
│  /api/transfers          /api/shipments                     │
│  /api/customer-orders    /api/lots                          │
│  /api/audit-logs         /api/pg-features                   │
│                                                             │
│  → Zod validation (request body, params, query)             │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVICES LAYER (business logic)                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  withTransaction(async (client) => {                 │    │
│  │    // validate business rules                        │    │
│  │    // call repository functions                      │    │
│  │    // handle PG error codes (P0001, 55P03, 23505)   │    │
│  │  })                                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  REPOSITORIES LAYER (raw SQL — SQL-first, no ORM)           │
│                                                             │
│  const sql = `                                              │
│    SELECT p.*, s.name as supplier_name                      │
│    FROM products p                                          │
│    LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id   │
│    WHERE p.is_active = true                                 │
│    ORDER BY p.created_at DESC                               │
│    LIMIT $1 OFFSET $2                                       │
│  `;                                                         │
│  const result = await query(sql, [pageSize, offset]);       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  DATABASE LAYER (PostgreSQL)                                │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │
│  │   Tables    │  │  Triggers   │  │ Stored Functions │     │
│  │  (23)       │  │  (4)        │  │  (3)            │     │
│  └─────────────┘  └─────────────┘  └─────────────────┘     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │
│  │  Indexes    │  │    RLS      │  │  Partitions     │     │
│  │  (partial)  │  │ (policies)  │  │  (by year)      │     │
│  └─────────────┘  └─────────────┘  └─────────────────┘     │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │  pgvector   │  │     MV      │                           │
│  │ (embeddings)│  │ (summary)   │                           │
│  └─────────────┘  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Internal Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL 17                                    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  TABLES (23)                                                      │  │
│  │                                                                   │  │
│  │  Core:     users, warehouses, suppliers, products, customers      │  │
│  │  Inventory: inventory, stock_movements (partitioned), product_lots│  │
│  │  Orders:   purchase_orders, order_items                           │  │
│  │  Transfer: transfer_orders, transfer_items                        │  │
│  │  Sales:    customer_orders, customer_order_items, payments        │  │
│  │  Shipping: shipments, shipment_items, shipment_orders             │  │
│  │  Audit:    audit_logs                                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  TRIGGERS                                                         │  │
│  │                                                                   │  │
│  │  stock_movements INSERT                                           │  │
│  │    └─→ sync_inventory_from_movements()                            │  │
│  │          └─→ UPDATE/INSERT inventory                              │  │
│  │                                                                   │  │
│  │  inventory UPDATE                                                 │  │
│  │    └─→ check_reorder_and_auto_po()                                │  │
│  │          └─→ INSERT purchase_orders (if low stock)                │  │
│  │                                                                   │  │
│  │  critical tables INSERT/UPDATE/DELETE                              │  │
│  │    └─→ audit_trigger_function()                                   │  │
│  │          └─→ INSERT audit_logs (JSONB old/new values)             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  STORED FUNCTIONS                                                 │  │
│  │                                                                   │  │
│  │  calculate_distance(lat1, lon1, lat2, lon2) → km                  │  │
│  │  suggest_smart_warehouse(product, qty, lat, lon) → nearest wh     │  │
│  │  move_stock_advanced(product, from, to, lot, qty, user) → result  │  │
│  │    └─→ SELECT FOR UPDATE (pessimistic locking)                    │  │
│  │    └─→ INSERT stock_movements (transfer_out + transfer_in)        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  PARTITIONING (stock_movements)                                   │  │
│  │                                                                   │  │
│  │  stock_movements (parent — PARTITION BY RANGE created_at)         │  │
│  │    ├── stock_movements_2024  (2024-01-01 → 2025-01-01)           │  │
│  │    ├── stock_movements_2025  (2025-01-01 → 2026-01-01)           │  │
│  │    ├── stock_movements_2026  (2026-01-01 → 2027-01-01)           │  │
│  │    └── stock_movements_default                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  ROW LEVEL SECURITY (inventory table)                             │  │
│  │                                                                   │  │
│  │  app.current_user_id (session variable)                           │  │
│  │    └─→ get_current_app_user() → user record                      │  │
│  │          └─→ Policy check:                                        │  │
│  │                admin → see ALL rows                                │  │
│  │                manager → see managed warehouses                    │  │
│  │                staff → see assigned warehouse only                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  INDEXES                                                          │  │
│  │                                                                   │  │
│  │  idx_inventory_low_stock (PARTIAL — WHERE qty <= reorder_point)   │  │
│  │  idx_product_lots_expiry (PARTIAL — WHERE is_active = true)       │  │
│  │  idx_products_embedding  (IVFFlat — vector_cosine_ops)            │  │
│  │  + standard B-tree indexes on PKs, FKs, status columns           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  pgvector                                                         │  │
│  │                                                                   │  │
│  │  products.embedding vector(768)                                   │  │
│  │    └─→ Generated by Ollama nomic-embed-text (local AI)            │  │
│  │    └─→ Searched with <=> cosine distance operator                 │  │
│  │    └─→ IVFFlat index for approximate nearest neighbor             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  MATERIALIZED VIEW                                                │  │
│  │                                                                   │  │
│  │  mv_inventory_summary                                             │  │
│  │    └─→ Pre-aggregated: warehouse × product_count × total_qty     │  │
│  │    └─→ REFRESH MATERIALIZED VIEW CONCURRENTLY (non-blocking)      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         React 19 + Vite                                  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  App.tsx                                                          │  │
│  │    └─→ ThemeProvider (dark/light mode)                            │  │
│  │          └─→ ToastProvider (notifications)                        │  │
│  │                └─→ BrowserRouter                                  │  │
│  │                      └─→ Layout (sidebar + header + content)      │  │
│  │                            └─→ 12 Page Routes                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  PAGES (12)                                                       │  │
│  │                                                                   │  │
│  │  DashboardPage      — KPI cards, charts (Recharts), alerts        │  │
│  │  ProductsPage       — CRUD + semantic search (pgvector)           │  │
│  │  WarehousesPage     — List + create + inventory drill-down        │  │
│  │  InventoryPage      — Cross-warehouse view, low-stock filter      │  │
│  │  StockMovementsPage — Movement log, date/type filters             │  │
│  │  PurchaseOrdersPage — Create PO, receive goods                    │  │
│  │  TransferOrdersPage — Create transfer (with lock timeout UX)      │  │
│  │  ShipmentsPage      — Create shipment, status transitions         │  │
│  │  CustomerOrdersPage — Status flow, payment recording              │  │
│  │  ProductLotsPage    — Expiry tracking, FIFO view                  │  │
│  │  AuditLogsPage      — JSONB diff viewer, filters                  │  │
│  │  PGFeaturesPage     — 10-tab interactive PostgreSQL demo          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  UI COMPONENTS (shadcn/ui style)                                  │  │
│  │                                                                   │  │
│  │  Button, Card, Badge, Input, Select, Table                        │  │
│  │  Modal, Pagination, Skeleton, Toast, Tooltip                      │  │
│  │  SQLViewer (syntax highlighting), JSONDiffViewer                  │  │
│  │  LoadingSpinner, ErrorAlert, ThemeToggle                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  API LAYER (Axios)                                                │  │
│  │                                                                   │  │
│  │  client.ts          — Base Axios instance + error interceptor     │  │
│  │  dashboard.ts       — getMetrics, getRecentMovements, getLowStock │  │
│  │  products.ts        — CRUD + semanticSearch                       │  │
│  │  warehouses.ts      — list, detail, inventory, create             │  │
│  │  inventory.ts       — paginated list with filters                 │  │
│  │  stockMovements.ts  — list with date/type filters                 │  │
│  │  purchaseOrders.ts  — list, create, receive                       │  │
│  │  transfers.ts       — list, create                                │  │
│  │  shipments.ts       — list, create, updateStatus                  │  │
│  │  customerOrders.ts  — list, updateStatus, recordPayment           │  │
│  │  productLots.ts     — list, expiring                              │  │
│  │  auditLogs.ts       — list with filters                           │  │
│  │  pgFeatures.ts      — all demo endpoints                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Examples

### Example 1: Stock Transfer with Locking

```
Frontend                    Backend                         PostgreSQL
   │                          │                               │
   │ POST /api/transfers      │                               │
   │ {product:1, from:1,     │                               │
   │  to:2, qty:5}           │                               │
   │─────────────────────────>│                               │
   │                          │ BEGIN                          │
   │                          │──────────────────────────────>│
   │                          │                               │
   │                          │ SELECT quantity FROM inventory │
   │                          │ WHERE product=1, warehouse=1  │
   │                          │──────────────────────────────>│
   │                          │                    qty = 42   │
   │                          │<──────────────────────────────│
   │                          │                               │
   │                          │ SELECT move_stock_advanced()  │
   │                          │   → FOR UPDATE (lock row)     │
   │                          │   → INSERT transfer_out (-5)  │
   │                          │   → INSERT transfer_in (+5)   │
   │                          │──────────────────────────────>│
   │                          │                               │
   │                          │                    Trigger:    │
   │                          │                    inventory   │
   │                          │                    wh1: 42→37  │
   │                          │                    wh2: 28→33  │
   │                          │<──────────────────────────────│
   │                          │                               │
   │                          │ INSERT transfer_orders         │
   │                          │──────────────────────────────>│
   │                          │                               │
   │                          │ COMMIT                         │
   │                          │──────────────────────────────>│
   │                          │                               │
   │  200 OK {transfer_id:6} │                               │
   │<─────────────────────────│                               │
```

### Example 2: Semantic Search with pgvector

```
Frontend                    Backend                    Ollama              PostgreSQL
   │                          │                          │                    │
   │ POST /api/products/      │                          │                    │
   │   semantic-search        │                          │                    │
   │ {query: "office chair"}  │                          │                    │
   │─────────────────────────>│                          │                    │
   │                          │ POST /api/embed          │                    │
   │                          │ {model:"nomic-embed-text"│                    │
   │                          │  input:"office chair"}   │                    │
   │                          │─────────────────────────>│                    │
   │                          │                          │                    │
   │                          │ [0.12, -0.34, ..., 0.05] │                    │
   │                          │<─────────────────────────│                    │
   │                          │                          │                    │
   │                          │ SELECT name,             │                    │
   │                          │   1-(embedding<=>$1) AS  │                    │
   │                          │   similarity             │                    │
   │                          │ FROM products            │                    │
   │                          │ ORDER BY embedding<=>$1  │                    │
   │                          │ LIMIT 20                 │                    │
   │                          │──────────────────────────────────────────────>│
   │                          │                                               │
   │                          │ [{name:"Ergohuman Chair", sim:0.72},          │
   │                          │  {name:"Standing Desk", sim:0.68}, ...]       │
   │                          │<──────────────────────────────────────────────│
   │                          │                          │                    │
   │  200 OK {results: [...]} │                          │                    │
   │<─────────────────────────│                          │                    │
```

---

## Docker Compose Services

```
┌─────────────────────────────────────────────────────────────────┐
│  docker-compose.yml (main)                                      │
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │     db      │     │   backend   │     │  frontend   │       │
│  │             │     │             │     │             │       │
│  │ pgvector/   │     │ node:24     │     │ nginx:alpine│       │
│  │ pgvector:17 │◄────│ (multi-stage│◄────│ (multi-stage│       │
│  │             │ pg  │  build)     │ dep │  build)     │       │
│  │ Port: 5433  │     │ Port: 3000  │     │ Port: 5173  │       │
│  │ Vol: pgdata │     │             │     │             │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                 │
│  Environment: .env (POSTGRES_PASSWORD)                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  docker-compose.ollama.yml (optional)                           │
│                                                                 │
│  ┌─────────────┐                                                │
│  │   ollama    │                                                │
│  │             │                                                │
│  │ ollama/     │                                                │
│  │ ollama:latest│                                               │
│  │             │                                                │
│  │ Port: 11434 │                                                │
│  │ Vol: ollama │                                                │
│  │      _data  │                                                │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
smartlogistic/
├── backend/
│   ├── src/
│   │   ├── config/database.ts       ← pg Pool (max 20 connections)
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts      ← PG error code parsing
│   │   │   ├── validation.ts        ← Zod middleware
│   │   │   └── appContext.ts        ← SET LOCAL app.current_user_id
│   │   ├── routes/ (12 files)       ← HTTP endpoints
│   │   ├── services/ (12 files)     ← Business logic + withTransaction
│   │   ├── repositories/ (11 files) ← Raw SQL queries
│   │   ├── validators/ (10 files)   ← Zod schemas
│   │   └── utils/
│   │       ├── transaction.ts       ← withTransaction(callback)
│   │       ├── pagination.ts        ← Offset calculation
│   │       └── embedding.ts         ← Ollama API client
│   ├── setup-ollama.js              ← Generate embeddings script
│   ├── Dockerfile                   ← Multi-stage build
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/ (12 files)        ← Domain pages
│   │   ├── components/
│   │   │   ├── ui/ (shadcn)         ← Button, Card, Badge, Table...
│   │   │   ├── Layout.tsx           ← Sidebar + Header
│   │   │   ├── SQLViewer.tsx        ← Syntax highlighting
│   │   │   └── JSONDiffViewer.tsx   ← Audit diff display
│   │   ├── api/ (12 files)          ← Axios API functions
│   │   └── lib/
│   │       ├── utils.ts             ← cn() helper
│   │       └── theme.tsx            ← Dark/Light mode
│   ├── nginx.conf                   ← SPA routing + API proxy
│   ├── Dockerfile                   ← Multi-stage build
│   └── package.json
├── database/
│   ├── smart_logistics.sql          ← Full schema (pg_dump)
│   ├── seed.sql                     ← Demo data
│   └── fix_trigger.sql             ← Trigger fix
├── scripts/
│   ├── setup.ps1                    ← Windows setup
│   └── setup.sh                     ← Linux/Mac setup
├── docker-compose.yml               ← Main stack
├── docker-compose.ollama.yml        ← Optional Ollama
├── .env.example                     ← Environment template
├── .gitignore
├── README.md                        ← Quick start guide
├── PRESENTATION.md                  ← Presentation script
└── ARCHITECTURE.md                  ← This file
```

---

*Smart Logistics System — Architecture Documentation*
