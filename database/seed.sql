-- ============================================================
-- SEED DATA for Smart Logistics System
-- Demonstrates: triggers, transactions, inventory, audit logs
-- ============================================================

-- 1. Users (admin, managers, staff)
INSERT INTO users (username, full_name, email, role, is_active) VALUES
('admin', 'Nguyễn Văn Admin', 'admin@smartlogistics.vn', 'admin', true),
('manager_hcm', 'Trần Thị Hương', 'huong.tran@smartlogistics.vn', 'warehouse_manager', true),
('manager_hn', 'Lê Minh Tuấn', 'tuan.le@smartlogistics.vn', 'warehouse_manager', true),
('staff_01', 'Phạm Đức Anh', 'anh.pham@smartlogistics.vn', 'staff', true),
('staff_02', 'Võ Thị Mai', 'mai.vo@smartlogistics.vn', 'staff', true);

-- 2. Suppliers
INSERT INTO suppliers (name, contact_name, email, phone, address, country) VALUES
('Công ty TNHH Điện tử Phương Nam', 'Nguyễn Hoàng', 'hoang@phuongnam.vn', '028-3456-7890', '123 Nguyễn Huệ, Q1, TP.HCM', 'Vietnam'),
('Samsung Electronics Vietnam', 'Park Ji-hoon', 'jihoon@samsung.vn', '0274-3789-456', 'KCN Yên Phong, Bắc Ninh', 'Vietnam'),
('Nhà phân phối Bắc Hà', 'Trần Văn Bắc', 'bac@bacha.vn', '024-3567-8901', '45 Láng Hạ, Đống Đa, Hà Nội', 'Vietnam'),
('Global Tech Supply Co.', 'John Smith', 'john@globaltech.com', '+1-555-0123', '100 Tech Park, San Jose, CA', 'USA'),
('Đại lý vật tư Miền Trung', 'Huỳnh Thanh Sơn', 'son@mientrung.vn', '0236-3456-789', '78 Trần Phú, Đà Nẵng', 'Vietnam');

-- 3. Warehouses
INSERT INTO warehouses (name, warehouse_type, location, capacity, manager_id) VALUES
('Kho Trung tâm TP.HCM', 'distribution_center', 'KCN Tân Bình, TP.HCM', 50000, 2),
('Kho Hà Nội', 'distribution_center', 'KCN Thăng Long, Hà Nội', 35000, 3),
('Kho Đà Nẵng', 'distribution_center', 'KCN Hòa Khánh, Đà Nẵng', 20000, NULL),
('Kho trả hàng TP.HCM', 'returns', 'Q.Bình Tân, TP.HCM', 5000, 2),
('Kho lạnh Bình Dương', 'cold_storage', 'KCN VSIP, Bình Dương', 15000, NULL);

-- Assign staff to warehouses
UPDATE users SET assigned_warehouse_id = 1 WHERE username = 'staff_01';
UPDATE users SET assigned_warehouse_id = 2 WHERE username = 'staff_02';

-- 4. Products (diverse categories for demo)
INSERT INTO products (sku, name, category, unit, unit_cost, unit_price, min_stock_level, supplier_id) VALUES
('ELEC-001', 'Laptop Dell Latitude 5540', 'Electronics', 'pcs', 15000000, 18500000, 20, 1),
('ELEC-002', 'Samsung Galaxy Tab S9', 'Electronics', 'pcs', 8500000, 11000000, 30, 2),
('ELEC-003', 'Tai nghe Sony WH-1000XM5', 'Electronics', 'pcs', 5200000, 7500000, 50, 4),
('ELEC-004', 'Chuột Logitech MX Master 3S', 'Electronics', 'pcs', 1800000, 2500000, 100, 4),
('ELEC-005', 'Bàn phím cơ Keychron K8 Pro', 'Electronics', 'pcs', 2200000, 3200000, 80, 4),
('FOOD-001', 'Cà phê Trung Nguyên Legend', 'Food & Beverage', 'box', 180000, 250000, 200, 5),
('FOOD-002', 'Trà Oolong Phúc Long', 'Food & Beverage', 'box', 120000, 180000, 150, 5),
('FOOD-003', 'Nước mắm Phú Quốc 40°', 'Food & Beverage', 'bottle', 85000, 120000, 300, 5),
('OFFC-001', 'Giấy A4 Double A 80gsm', 'Office Supplies', 'ream', 65000, 85000, 500, 3),
('OFFC-002', 'Bút bi Thiên Long TL-027', 'Office Supplies', 'box', 45000, 65000, 200, 3),
('OFFC-003', 'Kẹp giấy Deli 50mm', 'Office Supplies', 'box', 15000, 25000, 300, 3),
('FURN-001', 'Ghế công thái học Ergohuman', 'Furniture', 'pcs', 8500000, 12000000, 15, 1),
('FURN-002', 'Bàn làm việc nâng hạ', 'Furniture', 'pcs', 6500000, 9500000, 10, 1),
('PACK-001', 'Thùng carton 40x30x20cm', 'Packaging', 'pcs', 8000, 12000, 1000, 3),
('PACK-002', 'Băng keo trong 48mm', 'Packaging', 'roll', 12000, 18000, 500, 3);

-- 5. Product Lots (for FIFO and expiry tracking)
INSERT INTO product_lots (product_id, lot_number, manufacture_date, expiry_date, supplier_id) VALUES
(6, 'LOT-CF-2025-01', '2025-01-15', '2026-01-15', 5),
(6, 'LOT-CF-2025-03', '2025-03-01', '2026-03-01', 5),
(7, 'LOT-TEA-2025-02', '2025-02-10', '2025-08-10', 5),
(7, 'LOT-TEA-2025-04', '2025-04-20', '2025-10-20', 5),
(8, 'LOT-NM-2024-12', '2024-12-01', '2026-12-01', 5),
(8, 'LOT-NM-2025-05', '2025-05-01', '2027-05-01', 5);

-- 6. Inventory (with various stock levels for low-stock demo)
INSERT INTO inventory (warehouse_id, product_id, lot_id, quantity, reorder_point, max_stock_level) VALUES
-- Kho HCM
(1, 1, NULL, 45, 20, 100),
(1, 2, NULL, 80, 30, 150),
(1, 3, NULL, 12, 50, 200),   -- LOW STOCK!
(1, 4, NULL, 150, 100, 500),
(1, 5, NULL, 25, 80, 300),   -- LOW STOCK!
(1, 6, 1, 180, 200, 800),    -- LOW STOCK!
(1, 7, 3, 200, 150, 600),
(1, 8, 5, 350, 300, 1000),
(1, 9, NULL, 600, 500, 2000),
(1, 10, NULL, 250, 200, 800),
(1, 12, NULL, 18, 15, 50),
(1, 14, NULL, 1200, 1000, 5000),
(1, 15, NULL, 600, 500, 2000),
-- Kho Hà Nội
(2, 1, NULL, 30, 20, 80),
(2, 2, NULL, 55, 30, 120),
(2, 3, NULL, 90, 50, 200),
(2, 4, NULL, 200, 100, 400),
(2, 5, NULL, 100, 80, 250),
(2, 6, 2, 250, 200, 600),
(2, 7, 4, 180, 150, 500),
(2, 9, NULL, 450, 500, 1500),  -- LOW STOCK!
(2, 10, NULL, 180, 200, 600),  -- LOW STOCK!
(2, 11, NULL, 350, 300, 1000),
(2, 13, NULL, 12, 10, 40),
(2, 14, NULL, 800, 1000, 4000), -- LOW STOCK!
-- Kho Đà Nẵng
(3, 1, NULL, 15, 20, 60),     -- LOW STOCK!
(3, 2, NULL, 40, 30, 100),
(3, 6, 1, 100, 200, 500),     -- LOW STOCK!
(3, 9, NULL, 300, 500, 1200), -- LOW STOCK!
(3, 14, NULL, 500, 1000, 3000); -- LOW STOCK!

-- 7. Purchase Orders (various statuses)
INSERT INTO purchase_orders (supplier_id, warehouse_id, status, total_amount, note, created_by) VALUES
(1, 1, 'pending', 75000000, 'Đơn hàng laptop Q2/2025', 1),
(2, 2, 'ordered', 170000000, 'Samsung tablets cho kho HN', 1),
(3, 1, 'partially_received', 32500000, 'Văn phòng phẩm tháng 5', 1),
(5, 3, 'received', 18000000, 'Thực phẩm cho kho ĐN', 1),
(4, 1, 'pending', 52000000, 'Phụ kiện tech Q2', 1);

-- Order items
INSERT INTO order_items (order_id, product_id, ordered_quantity, received_quantity, unit_cost) VALUES
(1, 1, 5, 0, 15000000),
(2, 2, 20, 0, 8500000),
(3, 9, 500, 300, 65000),
(4, 6, 100, 100, 180000),
(5, 3, 10, 0, 5200000);

-- 8. Stock Movements (triggers will sync inventory)
-- These demonstrate the trg_sync_inventory_after_movement trigger
INSERT INTO stock_movements (product_id, warehouse_id, change_amount, movement_type, lot_id, reference_type, created_by, created_at) VALUES
(1, 1, 10, 'inbound', NULL, 'po_receive', 1, '2025-05-01 09:00:00'),
(2, 1, 20, 'inbound', NULL, 'po_receive', 1, '2025-05-02 10:30:00'),
(3, 2, 15, 'inbound', NULL, 'po_receive', 1, '2025-05-03 14:00:00'),
(1, 1, -3, 'outbound', NULL, 'shipment', 4, '2025-05-05 08:00:00'),
(4, 1, 50, 'inbound', NULL, 'po_receive', 1, '2025-05-06 11:00:00'),
(9, 2, 100, 'inbound', NULL, 'po_receive', 5, '2025-05-07 09:30:00'),
(14, 1, 200, 'inbound', NULL, 'po_receive', 4, '2025-05-08 16:00:00'),
(2, 1, -5, 'outbound', NULL, 'shipment', 4, '2025-05-10 10:00:00'),
(1, 2, 8, 'inbound', NULL, 'transfer', 5, '2025-05-12 13:00:00'),
(6, 1, 50, 'inbound', 1, 'po_receive', 1, '2025-05-14 09:00:00');

-- 9. Transfer Orders
INSERT INTO transfer_orders (from_warehouse_id, to_warehouse_id, status, requested_by, note) VALUES
(1, 2, 'completed', 4, 'Chuyển laptop sang kho HN'),
(1, 3, 'completed', 4, 'Bổ sung hàng cho kho ĐN'),
(2, 1, 'pending', 5, 'Chuyển văn phòng phẩm về HCM');

INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES
(1, 1, 5),
(2, 2, 10),
(3, 9, 100);

-- 10. Customers
INSERT INTO customers (username, full_name, email, phone, shipping_address) VALUES
('customer_01', 'Công ty ABC Tech', 'mua@abctech.vn', '028-1234-5678', '456 Lê Lợi, Q1, TP.HCM'),
('customer_02', 'Trường ĐH Bách Khoa HN', 'vp@hust.edu.vn', '024-3869-4242', '1 Đại Cồ Việt, Hai Bà Trưng, HN'),
('customer_03', 'Văn phòng Grab Vietnam', 'procurement@grab.vn', '028-7300-0000', 'Tòa nhà Mapletree, Q7, TP.HCM');

-- 11. Customer Orders
INSERT INTO customer_orders (customer_id, warehouse_id, status, total_amount, shipping_address) VALUES
(1, 1, 'processing', 37000000, '456 Lê Lợi, Q1, TP.HCM'),
(2, 2, 'pending', 85000000, '1 Đại Cồ Việt, Hai Bà Trưng, HN'),
(3, 1, 'shipped', 25000000, 'Tòa nhà Mapletree, Q7, TP.HCM');

INSERT INTO customer_order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 2, 18500000),
(2, 2, 5, 11000000),
(2, 3, 4, 7500000),
(3, 4, 10, 2500000);

-- 12. Shipments
INSERT INTO shipments (origin_warehouse_id, destination_address, carrier, status, shipped_at) VALUES
(1, 'Tòa nhà Mapletree, Q7, TP.HCM', 'Giao Hàng Nhanh', 'in_transit', '2025-05-18 08:00:00'),
(2, '1 Đại Cồ Việt, HN', 'Viettel Post', 'pending', NULL),
(1, '456 Lê Lợi, Q1, TP.HCM', 'J&T Express', 'delivered', '2025-05-15 09:00:00');

INSERT INTO shipment_items (shipment_id, product_id, quantity) VALUES
(1, 4, 10),
(2, 2, 5),
(3, 1, 1);

-- 13. Payments
INSERT INTO payments (order_id, amount, payment_method, payment_status, created_by) VALUES
(1, 18500000, 'bank_transfer', 'completed', 1),
(3, 25000000, 'credit_card', 'completed', 1);

-- Verify data
SELECT 'Users: ' || count(*) FROM users
UNION ALL SELECT 'Suppliers: ' || count(*) FROM suppliers
UNION ALL SELECT 'Warehouses: ' || count(*) FROM warehouses
UNION ALL SELECT 'Products: ' || count(*) FROM products
UNION ALL SELECT 'Inventory: ' || count(*) FROM inventory
UNION ALL SELECT 'Stock Movements: ' || count(*) FROM stock_movements
UNION ALL SELECT 'Purchase Orders: ' || count(*) FROM purchase_orders
UNION ALL SELECT 'Customer Orders: ' || count(*) FROM customer_orders
UNION ALL SELECT 'Shipments: ' || count(*) FROM shipments;
