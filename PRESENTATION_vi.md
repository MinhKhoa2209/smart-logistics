# Smart Logistics System — Trình bày Đồ án

---

## 1. Giới thiệu

**Smart Logistics** là hệ thống quản lý kho hàng và logistics đa kho, được xây dựng với mục tiêu chính là **minh họa các tính năng nâng cao của PostgreSQL** trong một bài toán kinh doanh thực tế.

Hệ thống mô phỏng hoạt động của một công ty logistics Việt Nam với nhiều kho hàng trải dài từ TP.HCM, Hà Nội đến Đà Nẵng, phục vụ các khách hàng doanh nghiệp lớn như Grab, Vingroup, FPT, Tiki, Shopee.

> **Trọng tâm là Database — Frontend và Backend chỉ đóng vai trò hỗ trợ demo.**

---

## 2. Kiến trúc Database

### 2.1 Sơ đồ quan hệ

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

### 2.2 Các bảng chính

| Bảng | Mô tả | Đặc điểm kỹ thuật |
|---|---|---|
| `users` | Người dùng hệ thống | Role enum: admin, warehouse_manager, staff |
| `warehouses` | Kho hàng | 5 loại kho, có tọa độ lat/lon |
| `products` | Danh mục sản phẩm | Cột `embedding vector(768)` cho pgvector |
| `inventory` | Tồn kho hiện tại | **RLS enabled**, UNIQUE per (warehouse, product, lot) |
| `stock_movements` | Lịch sử biến động | **Range-partitioned by year** |
| `purchase_orders` | Đơn mua hàng | Auto-created bởi trigger khi low stock |
| `transfer_orders` | Chuyển kho | Dùng stored function với pessimistic locking |
| `customer_orders` | Đơn khách hàng | 7 trạng thái, tích hợp payment |
| `shipments` | Vận chuyển | Transition validation, `delivered_at` auto-set |
| `audit_logs` | Nhật ký thay đổi | JSONB `old_value`/`new_value` |
| `product_lots` | Lô hàng | Expiry date tracking, FIFO ordering |


---

## 3. PostgreSQL Features — Giải thích chi tiết

---

### 3.1 Transactions (Giao dịch)

**Ví dụ đời thực:**
Bạn đi ATM rút tiền. Máy phải làm 2 việc: (1) trừ tiền trong tài khoản, (2) nhả tiền mặt ra. Nếu máy trừ tiền xong nhưng bị mất điện trước khi nhả tiền → bạn mất tiền oan. Transaction đảm bảo: hoặc CẢ HAI việc đều xảy ra, hoặc KHÔNG việc nào xảy ra.

**Trong hệ thống Smart Logistics:**
Khi nhận hàng từ nhà cung cấp, hệ thống phải làm 3 việc cùng lúc:
1. Ghi nhận "đã nhận 5 cái laptop" vào đơn mua hàng
2. Thêm 5 cái laptop vào kho (stock movement)
3. Cập nhật trạng thái đơn hàng thành "đã nhận"

Nếu bước 2 thành công nhưng bước 3 lỗi → dữ liệu sai lệch. Transaction giải quyết:

```sql
BEGIN;  -- Bắt đầu giao dịch

  -- Bước 1: Ghi nhận số lượng đã nhận
  UPDATE order_items SET received_quantity = received_quantity + 5
  WHERE order_item_id = 123;

  -- Bước 2: Ghi nhận nhập kho
  INSERT INTO stock_movements (product_id, warehouse_id, change_amount, movement_type)
  VALUES (1, 1, 5, 'inbound');

  -- Bước 3: Cập nhật trạng thái
  UPDATE purchase_orders SET status = 'received' WHERE order_id = 10;

COMMIT;    -- ✓ Tất cả thành công → lưu hết
-- hoặc
ROLLBACK;  -- ✗ Có lỗi → hủy hết, quay về trạng thái ban đầu
```

**Demo:** Trang PG Features → tab Transactions → bấm Run → thấy từng bước SQL → chọn COMMIT hoặc ROLLBACK.

---

### 3.2 SELECT ... FOR UPDATE (Khóa dòng)

**Ví dụ đời thực:**
Trong kho chỉ còn 10 cái laptop. Hai nhân viên A và B cùng lúc muốn chuyển 8 cái sang kho khác. Nếu cả hai đều thấy "còn 10" và cùng trừ 8 → tồn kho thành -6 (vô lý!).

**Giải pháp:** Khi A bắt đầu chuyển, hệ thống "khóa" dòng tồn kho đó lại. B phải **chờ** cho đến khi A xong. Giống như bạn vào phòng thay đồ và khóa cửa — người khác phải đợi bên ngoài.

```sql
-- Nhân viên A: khóa dòng tồn kho
BEGIN;
SELECT * FROM inventory
WHERE product_id = 1 AND warehouse_id = 1
FOR UPDATE;  -- ← "Khóa cửa" — B phải chờ ở đây

-- A thực hiện chuyển kho
UPDATE inventory SET quantity = quantity - 8 ...;
COMMIT;  -- ← "Mở cửa" — B mới được vào

-- Nhân viên B: bây giờ mới thấy quantity = 2 (đã bị A trừ)
-- B muốn chuyển 8 nhưng chỉ còn 2 → hệ thống báo lỗi "không đủ hàng"
```

**Demo:** Trang PG Features → tab Row Locking → bấm "Simulate Concurrent Transfers" → thấy Transfer B phải chờ Transfer A.

---

### 3.3 Triggers (Tự động hóa)

**Ví dụ đời thực:**
Bạn đặt chuông báo ở cửa nhà. Mỗi khi có người mở cửa → chuông tự kêu. Bạn không cần ngồi canh — nó tự động.

**Trong hệ thống:** Có 3 "chuông báo" (trigger):

**Trigger 1 — Tự động cập nhật tồn kho:**
```
Nhân viên ghi: "Nhập 100 hộp cà phê vào kho HCM"
    ↓ (trigger tự động chạy)
Tồn kho cà phê ở kho HCM: 145 → 245
```

**Trigger 2 — Tự động đặt hàng khi sắp hết:**
```
Tồn kho tai nghe Sony: 30 → giảm còn 8 (mức cảnh báo = 30)
    ↓ (trigger phát hiện: 8 ≤ 30)
Hệ thống tự động tạo Purchase Order:
  "Đặt thêm tai nghe Sony từ Global Tech Supply"
  Ghi chú: "Hệ thống tự động khởi tạo do tồn kho chạm ngưỡng cảnh báo"
```

**Trigger 3 — Ghi nhật ký thay đổi:**
```
Admin sửa giá laptop: 15.500.000đ → 16.000.000đ
    ↓ (trigger tự động ghi)
audit_logs: {user: "admin", action: "UPDATE", table: "products",
  old_value: {"unit_cost": "15500000"}, new_value: {"unit_cost": "16000000"}}
```

**Demo:** Trang PG Features → tab Triggers → bấm "Trigger Auto-PO Demo".

---

### 3.4 Stored Functions (Hàm lưu trữ)

**Ví dụ đời thực:**
Thay vì mỗi lần nấu ăn phải nhớ từng bước, bạn viết công thức vào sách. Lần sau chỉ cần gọi tên món → làm theo công thức.

**3 hàm trong hệ thống:**

**Hàm 1: Tính khoảng cách** — `calculate_distance(10.82, 106.63, 21.03, 105.85)` → 1137 km

**Hàm 2: Tìm kho gần nhất có đủ hàng** — `suggest_smart_warehouse(1, 10, 10.82, 106.63)` → Kho HCM (42 laptop, 0km)

**Hàm 3: Chuyển kho an toàn** — `move_stock_advanced(1, 1, 2, NULL, 5, 1)` → Khóa row + trừ kho nguồn + cộng kho đích

**Demo:** Trang PG Features → tab Stored Functions → chọn hàm → nhập tham số → bấm Execute.

---

### 3.5 Partial Indexes (Chỉ mục một phần)

**Ví dụ đời thực:**
Bạn có 1000 cuốn sách. Thay vì đánh dấu tất cả, bạn chỉ dán nhãn đỏ lên 20 cuốn sắp hết hạn mượn. Khi cần tìm "sách sắp hết hạn" → chỉ nhìn nhãn đỏ.

```sql
CREATE INDEX idx_inventory_low_stock ON inventory (warehouse_id)
WHERE quantity <= reorder_point;  -- Chỉ index ~20 dòng thay vì toàn bộ
```

**Kết quả:** Có index: 0.02ms | Không index: 0.08ms → **Nhanh hơn 4x** (với bảng lớn: 100x–1000x)

**Demo:** Trang PG Features → tab Partial Indexes → bấm "Compare".

---

### 3.6 Materialized Views (View vật lý hóa)

**Ví dụ đời thực:**
Mỗi sáng bạn phải tính tổng doanh thu từ 10 bảng Excel. Thay vì tính lại mỗi lần, bạn tính 1 lần rồi lưu kết quả. Khi dữ liệu thay đổi → bấm "Refresh".

```sql
CREATE MATERIALIZED VIEW mv_inventory_summary AS
SELECT w.name, COUNT(DISTINCT i.product_id), SUM(i.quantity)
FROM warehouses w LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
GROUP BY w.warehouse_id, w.name;

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_summary;  -- Không block reads
```

**So sánh:** MV: 0.05ms | Query gốc: 0.8ms → **Nhanh hơn 16x**

**Demo:** Trang PG Features → tab Materialized Views → bấm "Compare Performance".

---

### 3.7 Audit Logging (Nhật ký kiểm toán)

**Ví dụ đời thực:**
Camera an ninh trong cửa hàng. Mỗi khi ai đó lấy/đặt hàng → camera ghi lại: ai, lúc nào, làm gì. Không ai xóa được.

**Cơ chế:** Trigger tự động capture JSONB diff (giá trị cũ/mới) + user_id từ session variable `app.current_user_id`.

**Demo:** Trang PG Features → tab Audit → bấm "Run Audit Demo".

---

### 3.8 pgvector — Tìm kiếm ngữ nghĩa (AI)

**Ví dụ đời thực:**
Bạn vào Google gõ "nơi ăn phở ngon gần đây" — Google hiểu **ý nghĩa** câu hỏi, không tìm chính xác từ "phở".

**Vấn đề:** `LIKE '%laptop%'` không tìm được khi user gõ "máy tính xách tay".

**Giải pháp:**
1. Mỗi sản phẩm → AI chuyển thành 768 con số (embedding)
2. Query text → cũng chuyển thành 768 số
3. PostgreSQL tính khoảng cách cosine giữa 2 vector → trả về sản phẩm gần nhất

```sql
SELECT name, 1 - (embedding <=> $1::vector) AS similarity
FROM products ORDER BY embedding <=> $1::vector LIMIT 20;
```

**AI chạy local:** Ollama (Docker) — không cần internet, không cần API key, không tốn tiền.

**Demo:** Trang PG Features → tab pgvector → gõ "cold storage food" → bấm Search.

---

### 3.9 Row Level Security — RLS (Phân quyền tầng database)

**Ví dụ đời thực:**
Nhân viên kho HCM chỉ được xem hàng trong kho HCM. Quản lý kho thấy các kho mình phụ trách. Giám đốc thấy tất cả. Quy tắc này phải do **database enforce** — không phụ thuộc vào code ứng dụng.

**Tại sao không để ứng dụng kiểm tra?**
Vì nếu code có bug, hoặc ai đó truy cập DB trực tiếp qua pgAdmin/DBeaver → họ bypass được. RLS đảm bảo: dù dùng công cụ nào → vẫn bị giới hạn.

**Cách hoạt động:**
```
Request → Backend set (trong transaction):
  BEGIN;
  SET LOCAL app.current_user_id = '5';  (staff, assigned kho HCM)

Khi query: SELECT * FROM inventory
  → PostgreSQL gọi get_current_app_user() cho từng dòng:
      đọc app.current_user_id từ session → tra bảng users
  → Tự động áp policy tương ứng:
      staff:             WHERE warehouse_id = assigned_warehouse_id
      warehouse_manager: WHERE warehouse_id IN (kho đang quản lý)
      admin:             không giới hạn

Kết quả: staff (userId=5)           → 26 dòng  (chỉ kho được giao)
         warehouse_manager (userId=2) → 37 dòng  (các kho đang quản lý)
         admin (userId=1)             → 58 dòng  (tất cả)
```

**Vấn đề quan trọng — tại sao `postgres` superuser bypass RLS:**

PostgreSQL superuser mặc định có `BYPASSRLS = true`. Nếu backend kết nối bằng user `postgres`, **toàn bộ RLS policy bị bỏ qua hoàn toàn** dù có `SET LOCAL app.current_user_id` hay không. Fix là tạo một DB role riêng không có quyền superuser:

```sql
-- Tạo role ứng dụng, không có BYPASSRLS
CREATE ROLE app_user WITH LOGIN PASSWORD '...'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Cấp đúng quyền cần thiết
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
```

```yaml
# docker-compose.yml — backend kết nối bằng app_user, không phải postgres
DATABASE_URL: postgresql://app_user:app_password@db:5432/smart_logistics
```

**Tại sao dùng `SET LOCAL` thay vì `SET SESSION`:**

`SET LOCAL` chỉ có hiệu lực trong transaction hiện tại. Với connection pool, connection được tái sử dụng giữa các request. Nếu dùng `SET SESSION`, `user_id` của request trước sẽ bị leak sang request sau. Backend wrap mọi query cần RLS trong transaction:

```typescript
// queryWithContext() trong appContext.ts
await client.query('BEGIN');
await client.query('SET LOCAL app.current_user_id = $1', [userId]);
const result = await client.query(sql, params);   // RLS thấy đúng user
await client.query('COMMIT');
// Connection trả về pool — SET LOCAL biến mất, không leak
```

**4 policies đang active trên bảng `inventory`:**

| Command | Policy | Quy tắc |
|---|---|---|
| SELECT | `inventory_select_policy` | admin: tất cả; manager: kho đang quản lý; staff: kho được giao |
| INSERT | `inventory_insert_policy` | Như SELECT |
| UPDATE | `inventory_update_policy` | Như SELECT (cả USING lẫn WITH CHECK) |
| DELETE | `inventory_delete_policy` | Chỉ admin |

**Demo:** Trang PG Features → tab RLS → bấm "Compare Role Visibility" → thấy staff=26, manager=37, admin=58 dòng.

---

### 3.10 Table Partitioning (Phân vùng bảng)

**Ví dụ đời thực:**
10 năm hóa đơn trong 1 tủ. Chia thành 10 ngăn kéo (mỗi ngăn = 1 năm). Cần năm 2025 → chỉ mở ngăn 2025, bỏ qua 9 ngăn còn lại.

```sql
CREATE TABLE stock_movements (...) PARTITION BY RANGE (created_at);
-- stock_movements_2024, stock_movements_2025, stock_movements_2026, default

-- Query năm 2025 → PostgreSQL chỉ scan partition 2025, bỏ qua 2024/2026
```

**Kết quả:** Thay vì scan 100% → chỉ scan 25% → **Nhanh hơn 4x**

**Demo:** Trang PG Features → tab Partitioning → bấm "Show Partition Pruning".

---

## 4. Luồng nghiệp vụ chính

### 4.1 Nhập hàng
```
Tạo PO → Duyệt → Đặt hàng → Nhận hàng (Transaction)
  → Trigger 1: sync inventory
  → Trigger 2: auto-create PO nếu low stock
```

### 4.2 Chuyển kho
```
Yêu cầu → Transaction → move_stock_advanced() → FOR UPDATE (lock)
  → transfer_out (-5) + transfer_in (+5) → Trigger sync cả 2 kho
```

### 4.3 Đơn khách hàng
```
pending → confirmed → processing (validate inventory)
  → shipped (Transaction: shipment + outbound movements) → delivered
```

---

## 5. Dữ liệu Demo

| Entity | Số lượng | Ghi chú |
|---|---|---|
| Users | 8 | 1 admin, 3 managers, 4 staff |
| Warehouses | 7 | HCM, HN, ĐN, Kho lạnh, Returns, Fulfillment, Retail |
| Products | 26 | Electronics, Food, Office, Furniture, Packaging |
| Inventory | 58 rows | Nhiều low-stock để trigger tự tạo PO |
| Customers | 8 | Grab, Vingroup, FPT, Tiki, Shopee... |
| Purchase Orders | **31** | 10 thủ công + **21 tự động bởi trigger!** |
| Shipments | 7 | delivered, in_transit, pending, failed |
| Customer Orders | 8 | Đủ các trạng thái |

---

## 6. Tổng kết

| # | Feature | Giải quyết vấn đề gì | Demo |
|---|---|---|---|
| 1 | **Transactions** | Đảm bảo dữ liệu nhất quán khi cập nhật nhiều bảng | PG Features → Transactions |
| 2 | **SELECT FOR UPDATE** | Ngăn 2 người cùng trừ hàng 1 lúc | PG Features → Row Locking |
| 3 | **Triggers** | Tự động hóa: sync tồn kho, đặt hàng, ghi log | PG Features → Triggers |
| 4 | **Stored Functions** | Đóng gói logic phức tạp, chạy nhanh trong DB | PG Features → Stored Functions |
| 5 | **Partial Indexes** | Tăng tốc query trên subset nhỏ dữ liệu | PG Features → Partial Indexes |
| 6 | **Materialized Views** | Dashboard load nhanh, không cần tính lại | PG Features → Materialized Views |
| 7 | **Audit Logging** | Biết ai sửa gì, khi nào, không thể xóa | PG Features → Audit |
| 8 | **pgvector** | Tìm kiếm theo ý nghĩa, không cần gõ đúng từ | PG Features → pgvector |
| 9 | **Row Level Security** | Phân quyền ở tầng DB, app không bypass được | PG Features → RLS |
| 10 | **Partitioning** | Query nhanh trên bảng lớn bằng cách bỏ qua data cũ | PG Features → Partitioning |

---

*Smart Logistics System — Đồ án PostgreSQL Advanced Features*
