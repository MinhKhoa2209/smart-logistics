# Smart Logistics System — Project Presentation

---

## 1. Introduction

**Smart Logistics** is a multi-warehouse operations and logistics management system, built with the primary goal of **demonstrating advanced PostgreSQL features** within a realistic business context.

The system simulates a Vietnamese logistics company operating multiple warehouses across Ho Chi Minh City, Hanoi, and Da Nang, serving major enterprise customers such as Grab, Vingroup, FPT, Tiki, and Shopee.


---

## 2. Database Architecture

### 2.1 Entity Relationship Diagram

```
suppliers ──< products >── product_lots
                │
                ▼
users ──< warehouses >── inventory <── product_lots
  │                          │
  │                          ▼
  │                    stock_movements  ← PARTITIONED BY YEAR
  │
  ├──< purchase_orders >── order_items >── products
  ├──< transfer_orders >── transfer_items >── products
  │
customers ──< customer_orders >── customer_order_items >── products
                    │
              shipment_orders (junction)
                    │
              shipments >── shipment_items >── products
                    │
              payments
```

### 2.2 Core Tables

| Table | Description | Technical Features |
|---|---|---|
| `users` | System users | Role enum: admin, warehouse_manager, staff |
| `warehouses` | Physical warehouses | 5 types, lat/lon coordinates |
| `products` | Product catalog | `embedding vector(768)` column for pgvector |
| `inventory` | Current stock levels | **RLS enabled**, UNIQUE per (warehouse, product, lot) |
| `stock_movements` | Movement history | **Range-partitioned by year** |
| `purchase_orders` | Supplier orders | Auto-created by trigger on low stock |
| `transfer_orders` | Inter-warehouse transfers | Uses stored function with pessimistic locking |
| `customer_orders` | Customer sales orders | 7 statuses, integrated payment tracking |
| `shipments` | Outbound deliveries | Transition validation, auto-set `delivered_at` |
| `audit_logs` | Change history | JSONB `old_value`/`new_value` |
| `product_lots` | Batch tracking | Expiry date tracking, FIFO ordering |

---

## 3. PostgreSQL Features — Detailed Explanation

---

### 3.1 Transactions (ACID)

**Real-world analogy:**
You go to an ATM to withdraw money. The machine must do 2 things: (1) deduct from your account, (2) dispense cash. If the machine deducts your balance but loses power before dispensing cash → you lose money unfairly. A transaction guarantees: either BOTH things happen, or NEITHER happens.

**In Smart Logistics:**
When receiving goods from a supplier, the system must do 3 things simultaneously:
1. Record "received 5 laptops" in the purchase order
2. Add 5 laptops to warehouse inventory (stock movement)
3. Update the order status to "received"

If step 2 succeeds but step 3 fails → data becomes inconsistent. Transactions solve this:

```sql
BEGIN;  -- Start transaction

  -- Step 1: Record received quantity
  UPDATE order_items SET received_quantity = received_quantity + 5
  WHERE order_item_id = 123;

  -- Step 2: Record inbound stock movement
  INSERT INTO stock_movements (product_id, warehouse_id, change_amount, movement_type)
  VALUES (1, 1, 5, 'inbound');

  -- Step 3: Update order status
  UPDATE purchase_orders SET status = 'received' WHERE order_id = 10;

COMMIT;    -- ✓ All succeeded → save everything
-- or
ROLLBACK;  -- ✗ Something failed → undo everything, back to original state
```

**Demo:** PG Features page → Transactions tab → click Run → see each SQL step → choose COMMIT or ROLLBACK.

---

### 3.2 SELECT ... FOR UPDATE (Row Locking)

**Real-world analogy:**
The warehouse has only 10 laptops left. Two employees A and B simultaneously want to transfer 8 laptops to another warehouse. If both see "10 available" and both deduct 8 → inventory becomes -6 (impossible!).

**Solution:** When A starts the transfer, the system "locks" that inventory row. B must **wait** until A finishes. Like entering a fitting room and locking the door — others must wait outside.

```sql
-- Employee A: locks the inventory row
BEGIN;
SELECT * FROM inventory
WHERE product_id = 1 AND warehouse_id = 1
FOR UPDATE;  -- ← "Lock the door" — B must wait here

-- A performs the transfer
UPDATE inventory SET quantity = quantity - 8 ...;
COMMIT;  -- ← "Unlock the door" — B can now enter

-- Employee B: now sees quantity = 2 (already reduced by A)
-- B wants to transfer 8 but only 2 remain → system returns error "insufficient stock"
```

**Demo:** PG Features page → Row Locking tab → click "Simulate Concurrent Transfers" → see Transfer B waiting for Transfer A.

---

### 3.3 Triggers (Automation)

**Real-world analogy:**
You install a doorbell at your house. Every time someone opens the door → the bell rings automatically. You don't need to sit and watch — it's automatic.

**In the system:** There are 3 "doorbells" (triggers):

**Trigger 1 — Automatically update inventory:**
Every time goods enter/leave (INSERT into stock_movements) → inventory quantity automatically increases/decreases.

```
Employee records: "Received 100 boxes of coffee into HCM warehouse"
    ↓ (trigger fires automatically)
Coffee inventory at HCM warehouse: 145 → 245
```

**Trigger 2 — Automatically reorder when running low:**
When inventory drops to the warning level → system automatically creates a new purchase order.

```
Sony headphones inventory: 30 → drops to 8 (warning level = 30)
    ↓ (trigger detects: 8 ≤ 30)
System automatically creates Purchase Order:
  "Order more Sony headphones from Global Tech Supply"
  Note: "System auto-created due to inventory reaching safety threshold"
```

**Trigger 3 — Record all changes (audit):**
Every time someone modifies/deletes data → system automatically records "who, what changed, when, old/new values".

```
Admin changes laptop price: 15,500,000₫ → 16,000,000₫
    ↓ (trigger automatically records)
audit_logs: {
  user: "admin",
  action: "UPDATE",
  table: "products",
  old_value: {"unit_cost": "15500000"},
  new_value: {"unit_cost": "16000000"},
  time: "2025-05-19 10:30:00"
}
```

**Demo:** PG Features page → Triggers tab → click "Trigger Auto-PO Demo" → see trigger auto-create a purchase order.

---

### 3.4 Stored Functions

**Real-world analogy:**
Instead of remembering every cooking step each time, you write the recipe in a book. Next time you just call the dish name → follow the recipe. A stored function is a "recipe" saved inside the database.

**3 functions in the system:**

**Function 1: Calculate distance between 2 locations**
```sql
-- Distance from Ho Chi Minh City to Hanoi?
SELECT calculate_distance(10.82, 106.63, 21.03, 105.85);
-- → 1137 km
```

**Function 2: Find nearest warehouse with sufficient stock**
```sql
-- Customer in HCMC needs 10 laptops. Which warehouse is closest with enough stock?
SELECT * FROM suggest_smart_warehouse(1, 10, 10.82, 106.63);
-- → HCM Central Warehouse (42 laptops, 0km away)
```
This function combines: check inventory + calculate distance → return the optimal warehouse.

**Function 3: Safe stock transfer (with locking)**
```sql
-- Transfer 5 laptops from HCM warehouse to Hanoi warehouse
SELECT move_stock_advanced(1, 1, 2, NULL, 5, 1);
-- Inside the function:
--   1. Lock inventory row (FOR UPDATE) → prevent conflicts
--   2. Check sufficient stock
--   3. Deduct source warehouse, add to destination
--   4. Log transfer movements
```

**Demo:** PG Features page → Stored Functions tab → select function → enter parameters → click Execute.

---

### 3.5 Partial Indexes

**Real-world analogy:**
You have 1000 books in a library. Instead of labeling all of them, you only put red stickers on the 20 books due for return soon. When you need to find "books due soon" → just look for red stickers, no need to check every single book.

**In the system:**
The inventory table has 58 rows (in production, could be millions). But only ~20 rows have low stock. A partial index only marks those rows:

```sql
-- Only index products that are running low (small subset)
CREATE INDEX idx_inventory_low_stock ON inventory (warehouse_id)
WHERE quantity <= reorder_point;

-- When querying "find low stock items":
-- WITHOUT index: must read entire table (slow)
-- WITH partial index: only reads the 20 marked rows (fast)
```

**Comparison results:**
- With index: **Index Scan** — 0.02ms
- Without index: **Seq Scan** — 0.08ms (4x slower)

With large tables (millions of rows), the difference can be 100x–1000x.

**Demo:** PG Features page → Partial Indexes tab → click "Compare" → see speed comparison.

---

### 3.6 Materialized Views

**Real-world analogy:**
Every morning you need to calculate total revenue from 10 different Excel spreadsheets. Instead of recalculating every time you open them, you calculate once and save the result in a separate sheet. When you need to check → open that sheet (instant). When data changes → click "Refresh" to recalculate.

**In the system:**
The dashboard needs to display: "How many products per warehouse? Total stock? How many running low?" — requires JOINing 2 tables and GROUP BY.

```sql
-- Create a "pre-computed results table"
CREATE MATERIALIZED VIEW mv_inventory_summary AS
SELECT
  w.name AS warehouse_name,
  COUNT(DISTINCT i.product_id) AS product_count,
  SUM(i.quantity) AS total_quantity,
  COUNT(CASE WHEN i.quantity <= i.reorder_point THEN 1 END) AS low_stock_count
FROM warehouses w
LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
GROUP BY w.warehouse_id, w.name;

-- Reading results: super fast (no JOIN needed)
SELECT * FROM mv_inventory_summary;

-- When data changes: refresh (doesn't block readers)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_summary;
```

**Speed comparison:**
- Materialized View: ~0.05ms (reads pre-computed table)
- Original query (JOIN + GROUP BY): ~0.8ms (recalculates from scratch)
- **~16x faster**

**Demo:** PG Features page → Materialized Views tab → click "Refresh MV" then "Compare Performance".

---

### 3.7 Audit Logging (with JSONB)

**Real-world analogy:**
Security cameras in a store. Every time someone picks up/puts down an item → camera records: who, when, what they did. Nobody can delete the footage (tamper-evident).

**In the system:**
Every time someone adds/modifies/deletes important data → trigger automatically records:

```
Admin changes product price:
┌─────────────────────────────────────────────────────┐
│ Time: 2025-05-19 10:30:00                           │
│ User: admin (user_id: 1)                            │
│ Action: UPDATE                                      │
│ Table: products                                     │
│ Record: #1 (Laptop Dell Latitude 5540)              │
│                                                     │
│ OLD value: {"unit_cost": "15,500,000"}              │
│ NEW value: {"unit_cost": "16,000,000"}              │
│                                                     │
│ → Change: unit_cost 15.5M → 16M (+500K)            │
└─────────────────────────────────────────────────────┘
```

**How "who is operating" gets passed into the database:**
```
User sends request → Backend sets session variable:
  SET LOCAL app.current_user_id = '1'
→ Trigger reads this variable when writing audit log
```

**Demo:** PG Features page → Audit tab → click "Run Audit Demo" → see trigger record the change.

---

### 3.8 pgvector — Semantic Search (AI)

**Real-world analogy:**
You go to Google and type "good pho restaurant nearby" — Google doesn't search for the exact word "pho" but understands the **meaning** of your question and returns relevant restaurants. That's semantic search.

**The problem:**
Traditional search (`LIKE '%laptop%'`) only works when the user types the exact word "laptop". If they type "portable computer" or "office electronics" → finds nothing.

**Solution — 3 steps:**

**Step 1: Convert text to numbers (embedding)**
Each product is converted by AI into a sequence of 768 numbers, representing its "meaning":
```
"Laptop Dell Latitude 5540"  → [0.12, -0.34, 0.87, ..., 0.05]  (768 numbers)
"Trung Nguyen Coffee"        → [-0.45, 0.67, -0.12, ..., 0.23] (768 numbers)
```
Products with similar meanings → similar number sequences in 768-dimensional space.

**Step 2: When user searches**
The query text is also converted to 768 numbers:
```
"office electronics" → [0.11, -0.31, 0.84, ..., 0.04]
```

**Step 3: Compare distances**
PostgreSQL calculates the "distance" between the query vector and each product's vector:
```sql
SELECT name, 1 - (embedding <=> query_vector) AS similarity
FROM products
ORDER BY embedding <=> query_vector ASC  -- <=> is the cosine distance operator
LIMIT 20;

-- Results:
-- Laptop Dell (45% similar)
-- Samsung Tab (43% similar)
-- Keychron Keyboard (41% similar)
-- ...
-- Trung Nguyen Coffee (33% similar) ← furthest because unrelated
```

**Where does the AI run?**
Ollama runs locally in Docker — no internet needed, no API key, no cost. The `nomic-embed-text` model (274MB) downloads once and works forever.

**Demo:** PG Features page → pgvector tab → type "cold storage food" → click Search.

---

### 3.9 Row Level Security — RLS

**Real-world analogy:**
In a company, HCM warehouse staff can only view stock in the HCM warehouse. Managers can view warehouses they manage. Directors can view everything. This rule must be **enforced by the database itself** — not dependent on application code.

**Why not let the application check?**
Because if there's a bug in the code, or someone accesses the database directly → they can bypass it. RLS guarantees: whether you use pgAdmin, DBeaver, or any tool → you're still restricted.

**How it works:**

```
Each request from user → Backend sets variable:
  SET LOCAL app.current_user_id = '5'  (staff, assigned to HCM warehouse)

When querying: SELECT * FROM inventory
  → PostgreSQL automatically adds a hidden condition:
    WHERE warehouse_id = 1  (HCM warehouse — assigned to user 5)

Result: staff sees only 23 rows (HCM warehouse)
        manager sees 30 rows (their managed warehouses)
        admin sees 58 rows (everything)
```

**Demo:** PG Features page → RLS tab → click "Compare Role Visibility" → see 3 roles with different row counts.

---

### 3.10 Table Partitioning

**Real-world analogy:**
You have 10 years of invoices in one filing cabinet. Every time you need an invoice from March 2025 → you have to flip through all 10 years. Solution: divide into 10 drawers (one per year). When you need 2025 → only open the 2025 drawer, skip the other 9.

**In the system:**
The `stock_movements` table records EVERY inventory change — accumulates millions of rows over time. Split into partitions by year:

```sql
-- Parent table (doesn't hold data directly)
CREATE TABLE stock_movements (...) PARTITION BY RANGE (created_at);

-- "Drawers" by year
CREATE TABLE stock_movements_2024 PARTITION OF stock_movements
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE stock_movements_2025 PARTITION OF stock_movements
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE stock_movements_2026 PARTITION OF stock_movements
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

**Partition Pruning (automatically skips irrelevant drawers):**
```sql
-- Query: "Get 2025 stock movements"
SELECT * FROM stock_movements
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';

-- PostgreSQL automatically:
-- ✓ Scans: stock_movements_2025 (only this one)
-- ✗ Skips: stock_movements_2024, stock_movements_2026, stock_movements_default
```

With millions of rows, instead of scanning 100% → only scans 25% (1 year / 4 partitions) → **4x faster**.

**Demo:** PG Features page → Partitioning tab → click "Show Partition Pruning" → see which partitions are skipped.

---

## 4. Key Business Flows

### 4.1 Goods Receiving (Purchase Order)

```
Create PO → Approve → Order from supplier → Receive goods
                                               │
                    ┌──────────────────────────┴───────────────────────┐
                    │  Transaction (all or nothing)                     │
                    │                                                   │
                    │  1. Validate: received + new ≤ ordered?          │
                    │  2. Update received quantity                      │
                    │  3. Insert stock_movement (inbound)               │
                    │       └─ Trigger 1: inventory auto-increases     │
                    │       └─ Trigger 2: if another product is low    │
                    │            → auto-create new purchase order!      │
                    │  4. Update order status                           │
                    └──────────────────────────────────────────────────┘
```

### 4.2 Stock Transfer

```
Request: Transfer 5 laptops from HCM → Hanoi
        │
        ▼
Transaction begins
  ├── Check: does HCM warehouse have 5 laptops?
  ├── Call move_stock_advanced():
  │     ├── SELECT FOR UPDATE → lock inventory row (prevent conflicts)
  │     ├── Deduct HCM: 42 → 37
  │     │     └─ Trigger: record stock_movement (transfer_out, -5)
  │     └── Add to Hanoi: 28 → 33
  │           └─ Trigger: record stock_movement (transfer_in, +5)
  └── Record transfer_order (status = 'completed')
Transaction ends (COMMIT)
```

### 4.3 Customer Order

```
pending → confirmed → processing → shipped → delivered
                           │              │
                    Validate inventory  Transaction:
                    (if insufficient   ├── Create shipment
                     → detailed error) ├── Link shipment ↔ order
                                       ├── Deduct stock for each item
                                       │     └─ Trigger: update inventory
                                       └── Change status → 'shipped'
```

---

## 5. Demo Data

| Entity | Count | Notes |
|---|---|---|
| Users | 8 | 1 admin, 3 managers, 4 staff |
| Warehouses | 7 | HCM, Hanoi, Da Nang, Cold Storage, Returns, Fulfillment, Retail |
| Suppliers | 8 | Vietnamese + international (Samsung, LG, Global Tech USA) |
| Products | 26 | Electronics, Food & Beverage, Office, Furniture, Packaging |
| Product Lots | 11 | Includes expiring and expired lots for demo |
| Inventory | 58 rows | Many low-stock items to trigger auto-PO |
| Customers | 8 | Grab, Vingroup, FPT, Tiki, Shopee, HUST... |
| Purchase Orders | **31** | 10 manual + **21 auto-created by trigger!** |
| Stock Movements | 16 | Inbound, transfers, adjustments |
| Shipments | 7 | delivered, in_transit, pending, failed |
| Customer Orders | 8 | All statuses represented |
| Payments | 5 | paid, partial |

---

## 6. Summary

| # | Feature | What problem does it solve? | Demo location |
|---|---|---|---|
| 1 | **Transactions** | Ensure data consistency when updating multiple tables | PG Features → Transactions |
| 2 | **SELECT FOR UPDATE** | Prevent two people from deducting stock simultaneously | PG Features → Row Locking |
| 3 | **Triggers** | Automate: sync inventory, reorder, audit logging | PG Features → Triggers |
| 4 | **Stored Functions** | Encapsulate complex logic, runs fast inside DB | PG Features → Stored Functions |
| 5 | **Partial Indexes** | Speed up queries on small data subsets | PG Features → Partial Indexes |
| 6 | **Materialized Views** | Dashboard loads instantly, no recalculation | PG Features → Materialized Views |
| 7 | **Audit Logging** | Know who changed what, when — cannot be deleted | PG Features → Audit |
| 8 | **pgvector** | Search by meaning, not exact keywords | PG Features → pgvector |
| 9 | **Row Level Security** | Permission enforcement at DB level, app can't bypass | PG Features → RLS |
| 10 | **Partitioning** | Fast queries on large tables by skipping old data | PG Features → Partitioning |

---

*Smart Logistics System — PostgreSQL Advanced Features Project*
