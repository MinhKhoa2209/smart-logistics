# Script trình bày: Table Partitioning, Partial Indexes, Materialized Views

## Mở đầu

Trong phần này, em sẽ trình bày 3 kỹ thuật PostgreSQL được áp dụng trong hệ thống Smart Logistics: Table Partitioning, Partial Indexes và Materialized Views.

Điểm chung của 3 kỹ thuật này là đều phục vụ mục tiêu tối ưu hiệu năng khi dữ liệu tăng lớn. Tuy nhiên, mỗi kỹ thuật giải quyết một kiểu vấn đề khác nhau:

- Table Partitioning giúp chia bảng lớn thành nhiều phần nhỏ để truy vấn nhanh hơn.
- Partial Indexes giúp tăng tốc các truy vấn chỉ quan tâm đến một nhóm dữ liệu nhỏ.
- Materialized Views giúp lưu sẵn kết quả tính toán phức tạp để dashboard đọc nhanh hơn.

## 1. Table Partitioning

Đầu tiên là Table Partitioning.

Trong hệ thống Smart Logistics, bảng phù hợp để partition là `stock_movements`. Đây là bảng ghi lại mọi thay đổi tồn kho, ví dụ nhập hàng, xuất hàng, điều chuyển hoặc điều chỉnh số lượng. Theo thời gian, bảng này có thể tăng lên hàng triệu dòng.

Vì dữ liệu stock movement luôn gắn với thời gian, hệ thống chia bảng này theo `created_at`, cụ thể là partition theo từng năm:

```sql
CREATE TABLE stock_movements (...) PARTITION BY RANGE (created_at);

CREATE TABLE stock_movements_2024 PARTITION OF stock_movements
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE stock_movements_2025 PARTITION OF stock_movements
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE stock_movements_2026 PARTITION OF stock_movements
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

Khi người dùng truy vấn dữ liệu trong năm 2025:

```sql
SELECT * FROM stock_movements
WHERE created_at >= '2025-01-01'
  AND created_at < '2026-01-01';
```

PostgreSQL sẽ tự động dùng cơ chế partition pruning. Nghĩa là database chỉ scan partition `stock_movements_2025`, còn các partition như 2024, 2026 hoặc default sẽ được bỏ qua.

Lợi ích là thay vì scan toàn bộ bảng, database chỉ scan phần dữ liệu liên quan. Nếu có 4 partition theo năm, truy vấn một năm chỉ cần đọc khoảng 25% dữ liệu. Khi dữ liệu lớn, việc này giúp giảm đáng kể thời gian truy vấn.


## 2. Partial Indexes

Tiếp theo là Partial Indexes.

Trong hệ thống là truy vấn hàng sắp hết tồn kho. Bảng `inventory` có nhiều dòng, nhưng chỉ một phần nhỏ có `quantity <= reorder_point`. Vì vậy hệ thống tạo partial index chỉ cho các dòng low stock:

```sql
CREATE INDEX idx_inventory_low_stock ON inventory (warehouse_id)
WHERE quantity <= reorder_point;
```

Khi cần tìm các mặt hàng low stock, PostgreSQL có thể dùng index nhỏ này thay vì quét toàn bộ bảng `inventory`.

Nếu không có index, database phải dùng sequential scan, tức là đọc toàn bộ bảng để kiểm tra từng dòng. Với partial index, database chỉ đọc nhóm dòng đã được đánh dấu là low stock.

Trong tài liệu, kết quả so sánh là:

- Có index: Rows read: 20 / 58
- Không có index: Rows read: 58 / 58

Với dữ liệu demo thì bảng còn nhỏ thì thời gian truy xuất chỉ chênh lệch vài phần trăm mili giây. Nhưng trong hệ thống thật với hàng triệu dòng, chênh lệch có thể lên đến 100 lần hoặc 1000 lần.


## 3. Materialized Views

Phần cuối là Materialized Views.

Materialized View có thể hiểu là một bảng kết quả được tính sẵn. Khác với view thông thường, mỗi lần query view là database phải chạy lại câu SQL bên trong. Còn materialized view thì lưu kết quả ra vật lý, nên khi đọc sẽ nhanh hơn.

Trong hệ thống Smart Logistics, dashboard cần hiển thị các thông tin như:

- Mỗi kho có bao nhiêu sản phẩm.
- Tổng số lượng tồn kho là bao nhiêu.
- Có bao nhiêu mặt hàng đang low stock.

Nếu tính trực tiếp, database phải join bảng `warehouses` với `inventory`, sau đó group by theo kho:

```sql
CREATE MATERIALIZED VIEW mv_inventory_summary AS
SELECT
  w.name AS warehouse_name,
  COUNT(DISTINCT i.product_id) AS product_count,
  SUM(i.quantity) AS total_quantity,
  COUNT(CASE WHEN i.quantity <= i.reorder_point THEN 1 END) AS low_stock_count
FROM warehouses w
LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
GROUP BY w.warehouse_id, w.name;
```

Sau khi tạo materialized view, dashboard chỉ cần đọc:

```sql
SELECT * FROM mv_inventory_summary;
```

Như vậy dashboard không cần tính lại join và group by mỗi lần load.

Khi dữ liệu inventory thay đổi, hệ thống có thể refresh materialized view:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_summary;
```

Từ khóa `CONCURRENTLY` giúp refresh mà không block các truy vấn đọc đang chạy.
Kết quả
- Materialized View: khoảng 0.5ms vì đọc kết quả đã tính sẵn.
- Query gốc dùng JOIN và GROUP BY: khoảng 1.2 ms vì phải tính lại từ đầu.
