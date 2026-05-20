# Smart Logistics System — Trình bày Đồ án

---

## 1. Giới thiệu

**Smart Logistics** là hệ thống quản lý kho hàng và logistics đa kho, được xây dựng với mục tiêu chính là **minh họa các tính năng nâng cao của PostgreSQL** trong một bài toán kinh doanh thực tế.

Hệ thống mô phỏng hoạt động của một công ty logistics Việt Nam với nhiều kho hàng trải dài từ TP.HCM, Hà Nội đến Đà Nẵng, phục vụ các khách hàng doanh nghiệp lớn như Grab, Vingroup, FPT, Tiki, Shopee.

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
Mỗi khi có hàng nhập/xuất (INSERT vào stock_movements) → tồn kho tự động tăng/giảm.

```
Nhân viên ghi: "Nhập 100 hộp cà phê vào kho HCM"
    ↓ (trigger tự động chạy)
Tồn kho cà phê ở kho HCM: 145 → 245
```

**Trigger 2 — Tự động đặt hàng khi sắp hết:**
Khi tồn kho giảm xuống mức cảnh báo → hệ thống tự tạo đơn mua hàng mới.

```
Tồn kho tai nghe Sony: 30 → giảm còn 8 (mức cảnh báo = 30)
    ↓ (trigger phát hiện: 8 ≤ 30)
Hệ thống tự động tạo Purchase Order:
  "Đặt thêm tai nghe Sony từ Global Tech Supply"
  Ghi chú: "Hệ thống tự động khởi tạo do tồn kho chạm ngưỡng cảnh báo"
```

**Trigger 3 — Ghi nhật ký thay đổi:**
Mỗi khi ai đó sửa/xóa dữ liệu → hệ thống tự ghi lại "ai, sửa gì, lúc nào, giá trị cũ/mới".

```
Admin sửa giá laptop: 15.500.000đ → 16.000.000đ
    ↓ (trigger tự động ghi)
audit_logs: {
  user: "admin",
  action: "UPDATE",
  table: "products",
  old_value: {"unit_cost": "15500000"},
  new_value: {"unit_cost": "16000000"},
  time: "2025-05-19 10:30:00"
}
```

**Demo:** Trang PG Features → tab Triggers → bấm "Trigger Auto-PO Demo" → thấy trigger tự tạo đơn mua hàng.

---

### 3.4 Stored Functions (Hàm lưu trữ)

**Ví dụ đời thực:**
Thay vì mỗi lần nấu ăn phải nhớ từng bước, bạn viết công thức vào sách. Lần sau chỉ cần gọi tên món → làm theo công thức. Stored function là "công thức" được lưu sẵn trong database.

**3 hàm trong hệ thống:**

**Hàm 1: Tính khoảng cách giữa 2 địa điểm**
```sql
-- Khoảng cách từ TP.HCM đến Hà Nội?
SELECT calculate_distance(10.82, 106.63, 21.03, 105.85);
-- → 1137 km
```

**Hàm 2: Tìm kho gần nhất có đủ hàng**
```sql
-- Khách ở TP.HCM cần 10 laptop. Kho nào gần nhất có đủ?
SELECT * FROM suggest_smart_warehouse(1, 10, 10.82, 106.63);
-- → Kho Trung tâm TP.HCM (42 laptop, cách 0km)
```
Hàm này kết hợp: kiểm tra tồn kho + tính khoảng cách → trả về kho tối ưu nhất.

**Hàm 3: Chuyển kho an toàn (có khóa)**
```sql
-- Chuyển 5 laptop từ kho HCM sang kho HN
SELECT move_stock_advanced(1, 1, 2, NULL, 5, 1);
-- Bên trong hàm:
--   1. Khóa dòng tồn kho (FOR UPDATE) → ngăn xung đột
--   2. Kiểm tra đủ hàng không
--   3. Trừ kho nguồn, cộng kho đích
--   4. Ghi log chuyển kho
```

**Demo:** Trang PG Features → tab Stored Functions → chọn hàm → nhập tham số → bấm Execute.

---

### 3.5 Partial Indexes (Chỉ mục một phần)

**Ví dụ đời thực:**
Bạn có 1000 cuốn sách trong thư viện. Thay vì đánh dấu tất cả, bạn chỉ dán nhãn đỏ lên 20 cuốn sắp hết hạn mượn. Khi cần tìm "sách sắp hết hạn" → chỉ cần nhìn nhãn đỏ, không cần lật từng cuốn.

**Trong hệ thống:**
Bảng inventory có 58 dòng (thực tế có thể hàng triệu). Nhưng chỉ ~20 dòng có tồn kho thấp. Partial index chỉ đánh dấu những dòng đó:

```sql
-- Chỉ index các sản phẩm sắp hết hàng (subset nhỏ)
CREATE INDEX idx_inventory_low_stock ON inventory (warehouse_id)
WHERE quantity <= reorder_point;

-- Khi query "tìm hàng sắp hết":
-- KHÔNG CÓ index: phải đọc toàn bộ bảng (chậm)
-- CÓ partial index: chỉ đọc 20 dòng đã đánh dấu (nhanh)
```

**Kết quả so sánh:**
- Có index: **Index Scan** — 0.02ms
- Không index: **Seq Scan** — 0.08ms (chậm hơn 4x)

Với bảng lớn (triệu dòng), sự khác biệt có thể là 100x–1000x.

**Demo:** Trang PG Features → tab Partial Indexes → bấm "Compare" → thấy so sánh tốc độ.

---

### 3.6 Materialized Views (View vật lý hóa)

**Ví dụ đời thực:**
Mỗi sáng bạn phải tính tổng doanh thu từ 10 bảng Excel khác nhau. Thay vì tính lại mỗi lần mở, bạn tính 1 lần rồi lưu kết quả vào 1 sheet riêng. Khi cần xem → mở sheet đó (nhanh). Khi dữ liệu thay đổi → bấm "Refresh" để tính lại.

**Trong hệ thống:**
Dashboard cần hiển thị: "Mỗi kho có bao nhiêu sản phẩm? Tổng tồn kho? Bao nhiêu sắp hết?" — phải JOIN 2 bảng và GROUP BY.

```sql
-- Tạo "bảng kết quả" lưu sẵn
CREATE MATERIALIZED VIEW mv_inventory_summary AS
SELECT
  w.name AS warehouse_name,
  COUNT(DISTINCT i.product_id) AS product_count,
  SUM(i.quantity) AS total_quantity,
  COUNT(CASE WHEN i.quantity <= i.reorder_point THEN 1 END) AS low_stock_count
FROM warehouses w
LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
GROUP BY w.warehouse_id, w.name;

-- Đọc kết quả: siêu nhanh (không cần JOIN lại)
SELECT * FROM mv_inventory_summary;

-- Khi dữ liệu thay đổi: refresh (không block người đang đọc)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_summary;
```

**So sánh tốc độ:**
- Materialized View: ~0.05ms (đọc bảng có sẵn)
- Query gốc (JOIN + GROUP BY): ~0.8ms (tính lại từ đầu)
- **Nhanh hơn ~16 lần**

**Demo:** Trang PG Features → tab Materialized Views → bấm "Refresh MV" rồi "Compare Performance".

---

### 3.7 Audit Logging (Nhật ký kiểm toán)

**Ví dụ đời thực:**
Camera an ninh trong cửa hàng. Mỗi khi ai đó lấy/đặt hàng lên kệ → camera ghi lại: ai, lúc nào, làm gì. Không ai có thể xóa được video (tamper-evident).

**Trong hệ thống:**
Mỗi khi ai đó thêm/sửa/xóa dữ liệu quan trọng → trigger tự động ghi lại:

```
Admin sửa giá sản phẩm:
┌─────────────────────────────────────────────────────┐
│ Thời gian: 2025-05-19 10:30:00                      │
│ Người thực hiện: admin (user_id: 1)                 │
│ Hành động: UPDATE                                   │
│ Bảng: products                                      │
│ Record: #1 (Laptop Dell Latitude 5540)              │
│                                                     │
│ Giá trị CŨ: {"unit_cost": "15,500,000"}            │
│ Giá trị MỚI: {"unit_cost": "16,000,000"}           │
│                                                     │
│ → Thay đổi: unit_cost 15.5M → 16M (+500K)          │
└─────────────────────────────────────────────────────┘
```

**Cách truyền "ai đang thao tác" vào database:**
```
Người dùng gửi request → Backend set biến session:
  SET LOCAL app.current_user_id = '1'
→ Trigger đọc biến này khi ghi audit log
```

**Demo:** Trang PG Features → tab Audit → bấm "Run Audit Demo" → thấy trigger ghi lại thay đổi.

---

### 3.8 pgvector — Tìm kiếm ngữ nghĩa (AI)

**Ví dụ đời thực:**
Bạn vào Google gõ "nơi ăn phở ngon gần đây" — Google không tìm chính xác từ "phở" mà hiểu **ý nghĩa** câu hỏi và trả về nhà hàng phù hợp. Đó là semantic search.

**Vấn đề:**
Tìm kiếm thông thường (`LIKE '%laptop%'`) chỉ tìm được khi user gõ đúng từ "laptop". Nếu gõ "máy tính xách tay" hay "thiết bị điện tử văn phòng" → không tìm được gì.

**Giải pháp — 3 bước:**

**Bước 1: Chuyển text thành số (embedding)**
Mỗi sản phẩm được AI chuyển thành một dãy 768 con số, đại diện cho "ý nghĩa" của nó:
```
"Laptop Dell Latitude 5540"  → [0.12, -0.34, 0.87, ..., 0.05]  (768 số)
"Cà phê Trung Nguyên"       → [-0.45, 0.67, -0.12, ..., 0.23] (768 số)
```
Các sản phẩm có nghĩa gần nhau → dãy số gần nhau trong không gian 768 chiều.

**Bước 2: Khi user tìm kiếm**
Query text cũng được chuyển thành 768 số:
```
"thiết bị điện tử văn phòng" → [0.11, -0.31, 0.84, ..., 0.04]
```

**Bước 3: So sánh khoảng cách**
PostgreSQL tính "khoảng cách" giữa vector query và vector mỗi sản phẩm:
```sql
SELECT name, 1 - (embedding <=> query_vector) AS similarity
FROM products
ORDER BY embedding <=> query_vector ASC  -- <=> là toán tử cosine distance
LIMIT 20;

-- Kết quả:
-- Laptop Dell (45% giống)
-- Samsung Tab (43% giống)
-- Bàn phím Keychron (41% giống)
-- ...
-- Cà phê Trung Nguyên (33% giống) ← xa nhất vì không liên quan
```

**AI chạy ở đâu?**
Ollama chạy local trong Docker — không cần internet, không cần API key, không tốn tiền. Model `nomic-embed-text` (274MB) tải 1 lần rồi dùng mãi.

**Demo:** Trang PG Features → tab pgvector → gõ "cold storage food" → bấm Search.

---

### 3.9 Row Level Security — RLS (Phân quyền ở tầng database)

**Ví dụ đời thực:**
Trong công ty, nhân viên kho HCM chỉ được xem hàng trong kho HCM. Quản lý được xem kho mình phụ trách. Giám đốc xem được tất cả. Quy tắc này phải được **database tự enforce** — không phụ thuộc vào ứng dụng.

**Tại sao không để ứng dụng kiểm tra?**
Vì nếu có bug trong code, hoặc ai đó truy cập database trực tiếp → bypass được. RLS đảm bảo: dù bạn dùng pgAdmin, DBeaver, hay bất kỳ tool nào → vẫn bị giới hạn.

**Cách hoạt động:**

```
Mỗi request từ user → Backend set biến:
  SET LOCAL app.current_user_id = '5'  (staff, assigned kho HCM)

Khi query: SELECT * FROM inventory
  → PostgreSQL tự động thêm điều kiện ẩn:
    WHERE warehouse_id = 1  (kho HCM — kho được assign cho user 5)

Kết quả: staff chỉ thấy 23 dòng (kho HCM)
         manager thấy 30 dòng (các kho mình quản lý)
         admin thấy 58 dòng (tất cả)
```

**Demo:** Trang PG Features → tab RLS → bấm "Compare Role Visibility" → thấy 3 role nhìn thấy số dòng khác nhau.

---

### 3.10 Table Partitioning (Phân vùng bảng)

**Ví dụ đời thực:**
Bạn có 10 năm hóa đơn trong 1 tủ hồ sơ. Mỗi lần cần tìm hóa đơn tháng 3/2025 → phải lật qua tất cả 10 năm. Giải pháp: chia thành 10 ngăn kéo (mỗi ngăn = 1 năm). Khi cần năm 2025 → chỉ mở ngăn 2025, bỏ qua 9 ngăn còn lại.

**Trong hệ thống:**
Bảng `stock_movements` ghi lại MỌI biến động kho — tích lũy hàng triệu dòng theo thời gian. Chia thành các partition theo năm:

```sql
-- Bảng cha (không chứa data trực tiếp)
CREATE TABLE stock_movements (...) PARTITION BY RANGE (created_at);

-- Các "ngăn kéo" theo năm
CREATE TABLE stock_movements_2024 PARTITION OF stock_movements
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE stock_movements_2025 PARTITION OF stock_movements
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE stock_movements_2026 PARTITION OF stock_movements
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

**Partition Pruning (tự động bỏ qua ngăn không cần):**
```sql
-- Query: "Lấy biến động kho năm 2025"
SELECT * FROM stock_movements
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';

-- PostgreSQL tự động:
-- ✓ Scan: stock_movements_2025 (chỉ ngăn này)
-- ✗ Bỏ qua: stock_movements_2024, stock_movements_2026, stock_movements_default
```

Với hàng triệu dòng, thay vì scan 100% → chỉ scan 25% (1 năm / 4 partitions) → **nhanh hơn 4x**.

**Demo:** Trang PG Features → tab Partitioning → bấm "Show Partition Pruning" → thấy partition nào bị bỏ qua.

---

## 4. Luồng nghiệp vụ chính

### 4.1 Nhập hàng (Purchase Order)

```
Tạo đơn mua hàng → Duyệt → Đặt hàng NCC → Nhận hàng
                                               │
                    ┌──────────────────────────┴───────────────────────┐
                    │  Transaction (tất cả hoặc không gì)              │
                    │                                                  │
                    │  1. Kiểm tra: nhận thêm có vượt quá đặt không?  │
                    │  2. Cập nhật số lượng đã nhận                    │
                    │  3. Ghi nhận nhập kho (stock_movement)           │
                    │       └─ Trigger 1: tồn kho tự động tăng        │
                    │       └─ Trigger 2: nếu hàng khác sắp hết       │
                    │            → tự động tạo đơn mua hàng mới!      │
                    │  4. Cập nhật trạng thái đơn hàng                 │
                    └──────────────────────────────────────────────────┘
```

### 4.2 Chuyển kho (Transfer)

```
Yêu cầu: Chuyển 5 laptop từ kho HCM → kho HN
        │
        ▼
Transaction bắt đầu
  ├── Kiểm tra: kho HCM có đủ 5 laptop không?
  ├── Gọi move_stock_advanced():
  │     ├── SELECT FOR UPDATE → khóa dòng tồn kho (ngăn xung đột)
  │     ├── Trừ kho HCM: 42 → 37
  │     │     └─ Trigger: ghi stock_movement (transfer_out, -5)
  │     └── Cộng kho HN: 28 → 33
  │           └─ Trigger: ghi stock_movement (transfer_in, +5)
  └── Ghi nhận transfer_order (status = 'completed')
Transaction kết thúc (COMMIT)
```

### 4.3 Đơn khách hàng (Customer Order)

```
pending → confirmed → processing → shipped → delivered
                           │              │
                    Kiểm tra tồn kho   Transaction:
                    (nếu thiếu → báo   ├── Tạo shipment
                     lỗi chi tiết)     ├── Liên kết shipment ↔ order
                                       ├── Trừ kho cho từng sản phẩm
                                       │     └─ Trigger: cập nhật tồn kho
                                       └── Đổi trạng thái → 'shipped'
```

---

## 5. Dữ liệu Demo

| Entity | Số lượng | Ghi chú |
|---|---|---|
| Users | 8 | 1 admin, 3 managers, 4 staff |
| Warehouses | 7 | HCM, HN, ĐN, Kho lạnh, Returns, Fulfillment, Retail |
| Suppliers | 8 | VN + quốc tế (Samsung, LG, Global Tech USA) |
| Products | 26 | Electronics, Food, Office, Furniture, Packaging |
| Product Lots | 11 | Có lot sắp hết hạn và đã hết hạn |
| Inventory | 58 rows | Nhiều low-stock để trigger tự tạo PO |
| Customers | 8 | Grab, Vingroup, FPT, Tiki, Shopee, HUST... |
| Purchase Orders | **31** | 10 tạo thủ công + **21 tự động bởi trigger!** |
| Stock Movements | 16 | Inbound, transfers, adjustments |
| Shipments | 7 | delivered, in_transit, pending, failed |
| Customer Orders | 8 | Đủ các trạng thái |
| Payments | 5 | paid, partial |

---

## 6. Tổng kết

| # | Feature | Giải quyết vấn đề gì | Demo ở đâu |
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
