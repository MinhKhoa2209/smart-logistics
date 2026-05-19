-- ============================================================
-- SEED DATA — Smart Logistics System
-- Realistic Vietnamese logistics/warehouse data
-- ============================================================

-- Clear existing data (order matters for FK constraints)
TRUNCATE TABLE payments, shipment_orders, shipment_items, shipments,
  customer_order_items, customer_orders, transfer_items, transfer_orders,
  order_items, purchase_orders, stock_movements, inventory,
  product_lots, products, customers, users, warehouses, suppliers
  RESTART IDENTITY CASCADE;

-- ─── 1. USERS ────────────────────────────────────────────────
INSERT INTO users (username, full_name, email, phone, role, is_active) VALUES
('admin',        'Nguyễn Văn Quản Trị',   'admin@smartlogistics.vn',      '028-3456-7890', 'admin',             true),
('mgr_hcm',      'Trần Thị Hương',         'huong.tran@smartlogistics.vn', '0901-234-567',  'warehouse_manager', true),
('mgr_hn',       'Lê Minh Tuấn',           'tuan.le@smartlogistics.vn',    '0912-345-678',  'warehouse_manager', true),
('mgr_dn',       'Phạm Quốc Bảo',          'bao.pham@smartlogistics.vn',   '0923-456-789',  'warehouse_manager', true),
('staff_hcm_01', 'Võ Thị Mai',             'mai.vo@smartlogistics.vn',     '0934-567-890',  'staff',             true),
('staff_hcm_02', 'Đặng Văn Hùng',          'hung.dang@smartlogistics.vn',  '0945-678-901',  'staff',             true),
('staff_hn_01',  'Nguyễn Thị Lan',         'lan.nguyen@smartlogistics.vn', '0956-789-012',  'staff',             true),
('staff_dn_01',  'Hoàng Văn Đức',          'duc.hoang@smartlogistics.vn',  '0967-890-123',  'staff',             true);

-- ─── 2. WAREHOUSES ───────────────────────────────────────────
INSERT INTO warehouses (name, warehouse_type, location, capacity, manager_id) VALUES
('Kho Trung tâm TP.HCM',    'distribution_center', 'KCN Tân Bình, Quận Tân Bình, TP.HCM',          80000, 2),
('Kho Hà Nội',              'distribution_center', 'KCN Thăng Long, Đông Anh, Hà Nội',             60000, 3),
('Kho Đà Nẵng',             'distribution_center', 'KCN Hòa Khánh, Liên Chiểu, Đà Nẵng',          35000, 4),
('Kho Lạnh Bình Dương',     'cold_storage',        'KCN VSIP II, Thị xã Tân Uyên, Bình Dương',     20000, 2),
('Kho Trả Hàng TP.HCM',    'returns',             'Quận Bình Tân, TP.HCM',                          8000, 2),
('Kho Fulfillment HCM',     'fulfillment',         'Quận 12, TP.HCM',                               15000, 2),
('Kho Bán Lẻ Hà Nội',      'retail',              '123 Giải Phóng, Hai Bà Trưng, Hà Nội',           5000, 3);

-- Assign staff to warehouses
UPDATE users SET assigned_warehouse_id = 1 WHERE username IN ('staff_hcm_01', 'staff_hcm_02');
UPDATE users SET assigned_warehouse_id = 2 WHERE username = 'staff_hn_01';
UPDATE users SET assigned_warehouse_id = 3 WHERE username = 'staff_dn_01';

-- ─── 3. SUPPLIERS ────────────────────────────────────────────
INSERT INTO suppliers (name, contact_name, email, phone, address, country) VALUES
('Công ty TNHH Điện tử Phương Nam',    'Nguyễn Hoàng Phúc',  'phuc@phuongnam-elec.vn',   '028-3456-7890', '45 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM',    'Vietnam'),
('Samsung Electronics Vietnam',         'Park Ji-hoon',        'jihoon@samsung.vn',        '0274-378-9456', 'KCN Yên Phong, Bắc Ninh',                    'Vietnam'),
('Nhà phân phối Bắc Hà',               'Trần Văn Bắc',        'bac@bacha-dist.vn',        '024-3567-8901', '78 Láng Hạ, Đống Đa, Hà Nội',               'Vietnam'),
('Global Tech Supply Co.',              'John Smith',          'john@globaltech.com',       '+1-408-555-0123','100 Tech Park Dr, San Jose, CA 95110',       'USA'),
('Đại lý Thực phẩm Miền Trung',        'Huỳnh Thanh Sơn',     'son@tpmt.vn',              '0236-345-6789', '56 Trần Phú, Hải Châu, Đà Nẵng',            'Vietnam'),
('Công ty CP Nội thất Hòa Phát',       'Nguyễn Đức Thắng',    'thang@hoaphát-furn.vn',    '024-3869-4000', 'KCN Phố Nối A, Hưng Yên',                   'Vietnam'),
('Vật tư Đóng gói Việt Nam',           'Lê Thị Hoa',          'hoa@vtdg.vn',              '028-3812-3456', '234 Nguyễn Văn Linh, Q.7, TP.HCM',          'Vietnam'),
('LG Electronics Vietnam',              'Kim Sung-jin',        'sungjin@lg.vn',            '0222-378-5678', 'KCN Tràng Duệ, Hải Phòng',                  'Vietnam');

-- ─── 4. PRODUCTS ─────────────────────────────────────────────
INSERT INTO products (sku, name, category, unit, unit_cost, unit_price, min_stock_level, supplier_id) VALUES
-- Electronics
('ELEC-001', 'Laptop Dell Latitude 5540 i7',       'Electronics', 'pcs',  15500000, 19900000, 10, 1),
('ELEC-002', 'Samsung Galaxy Tab S9 FE 128GB',     'Electronics', 'pcs',   7800000, 10500000, 20, 2),
('ELEC-003', 'Tai nghe Sony WH-1000XM5',           'Electronics', 'pcs',   5200000,  7800000, 30, 4),
('ELEC-004', 'Chuột Logitech MX Master 3S',        'Electronics', 'pcs',   1750000,  2490000, 50, 4),
('ELEC-005', 'Bàn phím cơ Keychron K8 Pro',        'Electronics', 'pcs',   2100000,  3200000, 40, 4),
('ELEC-006', 'Màn hình LG 27" 4K IPS',             'Electronics', 'pcs',   6800000,  9500000, 15, 8),
('ELEC-007', 'Webcam Logitech C920 HD Pro',        'Electronics', 'pcs',   1200000,  1890000, 30, 4),
('ELEC-008', 'USB Hub Anker 7-in-1',               'Electronics', 'pcs',    450000,   690000, 80, 4),
-- Food & Beverage
('FOOD-001', 'Cà phê Trung Nguyên Legend 500g',    'Food & Beverage', 'box',  165000,  240000, 200, 5),
('FOOD-002', 'Trà Oolong Phúc Long 200g',          'Food & Beverage', 'box',  110000,  165000, 150, 5),
('FOOD-003', 'Nước mắm Phú Quốc 40° 500ml',       'Food & Beverage', 'bottle', 78000, 115000, 300, 5),
('FOOD-004', 'Dầu ăn Neptune 5L',                  'Food & Beverage', 'bottle',145000, 210000, 200, 5),
('FOOD-005', 'Sữa tươi Vinamilk 1L',               'Food & Beverage', 'box',   28000,   42000, 500, 5),
-- Office Supplies
('OFFC-001', 'Giấy A4 Double A 80gsm (500 tờ)',    'Office Supplies', 'ream',  62000,   88000, 500, 3),
('OFFC-002', 'Bút bi Thiên Long TL-027 (hộp 20)',  'Office Supplies', 'box',   42000,   65000, 200, 3),
('OFFC-003', 'Kẹp giấy Deli 50mm (hộp 12)',        'Office Supplies', 'box',   14000,   22000, 300, 3),
('OFFC-004', 'Bìa hồ sơ Leitz A4',                'Office Supplies', 'pcs',    8500,   13000, 400, 3),
('OFFC-005', 'Mực in HP 85A',                      'Office Supplies', 'pcs',  185000,  280000, 100, 3),
-- Furniture
('FURN-001', 'Ghế công thái học Ergohuman Plus',   'Furniture', 'pcs',  8200000, 12500000, 10, 6),
('FURN-002', 'Bàn làm việc nâng hạ Flexispot E7', 'Furniture', 'pcs',  6500000,  9800000,  8, 6),
('FURN-003', 'Tủ hồ sơ sắt 4 ngăn',               'Furniture', 'pcs',  1850000,  2800000, 15, 6),
('FURN-004', 'Kệ sách gỗ 5 tầng',                 'Furniture', 'pcs',   980000,  1500000, 20, 6),
-- Packaging
('PACK-001', 'Thùng carton 40×30×20cm',            'Packaging', 'pcs',    7500,   12000, 2000, 7),
('PACK-002', 'Băng keo trong 48mm×100m',           'Packaging', 'roll',  11000,   17000,  800, 7),
('PACK-003', 'Túi zip PE 20×30cm (100 cái)',       'Packaging', 'pack',  18000,   28000,  500, 7),
('PACK-004', 'Xốp chèn hàng (cuộn 50m)',           'Packaging', 'roll',  45000,   68000,  300, 7);

-- ─── 5. PRODUCT LOTS ─────────────────────────────────────────
INSERT INTO product_lots (product_id, lot_number, manufacture_date, expiry_date, supplier_id) VALUES
-- Coffee lots (expiry 1 year)
(9,  'LOT-CF-2025-01', '2025-01-10', '2026-01-10', 5),
(9,  'LOT-CF-2025-04', '2025-04-01', '2026-04-01', 5),
(9,  'LOT-CF-2025-07', '2025-07-15', '2026-07-15', 5),
-- Tea lots
(10, 'LOT-TEA-2025-02', '2025-02-15', '2025-08-15', 5),  -- expiring soon!
(10, 'LOT-TEA-2025-05', '2025-05-01', '2025-11-01', 5),
-- Fish sauce (2 years)
(11, 'LOT-NM-2024-11', '2024-11-01', '2026-11-01', 5),
(11, 'LOT-NM-2025-03', '2025-03-01', '2027-03-01', 5),
-- Cooking oil
(12, 'LOT-DO-2025-01', '2025-01-20', '2026-07-20', 5),
(12, 'LOT-DO-2025-06', '2025-06-01', '2027-01-01', 5),
-- Milk (short expiry)
(13, 'LOT-SUA-2025-05A', '2025-05-01', '2025-06-01', 5),  -- expired!
(13, 'LOT-SUA-2025-05B', '2025-05-15', '2025-06-15', 5);  -- expiring very soon!

-- ─── 6. INVENTORY ────────────────────────────────────────────
-- Kho HCM (warehouse_id=1) — main distribution center
INSERT INTO inventory (warehouse_id, product_id, lot_id, quantity, reorder_point, max_stock_level) VALUES
(1, 1,  NULL, 42,   10,  100),  -- Laptop Dell
(1, 2,  NULL, 85,   20,  200),  -- Samsung Tab
(1, 3,  NULL, 8,    30,  150),  -- Sony headphones — LOW STOCK
(1, 4,  NULL, 165,  50,  500),  -- Logitech mouse
(1, 5,  NULL, 22,   40,  200),  -- Keychron keyboard — LOW STOCK
(1, 6,  NULL, 18,   15,   80),  -- LG monitor
(1, 7,  NULL, 95,   30,  300),  -- Webcam
(1, 8,  NULL, 210,  80,  600),  -- USB Hub
(1, 9,  1,    145, 200,  800),  -- Coffee lot 1 — LOW STOCK
(1, 9,  2,    280, 200,  800),  -- Coffee lot 2
(1, 10, 4,    95,  150,  600),  -- Tea lot 1 — LOW STOCK
(1, 11, 6,    420, 300, 1200),  -- Fish sauce lot 1
(1, 12, 8,    185, 200,  800),  -- Cooking oil — LOW STOCK
(1, 13, 10,   0,   500, 2000),  -- Milk expired lot
(1, 14, NULL, 680, 500, 2500),  -- Paper A4
(1, 15, NULL, 245, 200,  800),  -- Pens
(1, 16, NULL, 380, 300, 1200),  -- Paper clips
(1, 19, NULL, 12,  10,   50),   -- Ergohuman chair
(1, 20, NULL, 8,    8,   40),   -- Standing desk — LOW STOCK
(1, 23, NULL, 1850,2000,8000),  -- Carton boxes — LOW STOCK
(1, 24, NULL, 620, 800, 3000),  -- Tape — LOW STOCK
(1, 25, NULL, 480, 500, 2000),  -- Zip bags — LOW STOCK
(1, 26, NULL, 285, 300, 1200),  -- Foam wrap — LOW STOCK

-- Kho HN (warehouse_id=2)
(2, 1,  NULL, 28,   10,   80),  -- Laptop
(2, 2,  NULL, 62,   20,  150),  -- Samsung Tab
(2, 3,  NULL, 45,   30,  150),  -- Sony headphones
(2, 4,  NULL, 220,  50,  400),  -- Logitech mouse
(2, 5,  NULL, 88,   40,  200),  -- Keychron
(2, 6,  NULL, 25,   15,   60),  -- LG monitor
(2, 9,  3,    310, 200,  800),  -- Coffee lot 3
(2, 10, 5,    175, 150,  600),  -- Tea lot 2
(2, 11, 7,    380, 300, 1000),  -- Fish sauce lot 2
(2, 14, NULL, 520, 500, 2000),  -- Paper A4
(2, 15, NULL, 180, 200,  800),  -- Pens — LOW STOCK
(2, 19, NULL, 6,   10,   40),   -- Ergohuman — LOW STOCK
(2, 23, NULL, 1200,2000,6000),  -- Carton — LOW STOCK
(2, 24, NULL, 450, 800, 2500),  -- Tape — LOW STOCK

-- Kho ĐN (warehouse_id=3)
(3, 1,  NULL, 15,   10,   50),  -- Laptop
(3, 2,  NULL, 30,   20,  100),  -- Samsung Tab
(3, 9,  1,    85,  200,  500),  -- Coffee — LOW STOCK
(3, 10, 4,    60,  150,  400),  -- Tea — LOW STOCK
(3, 14, NULL, 280, 500, 1500),  -- Paper — LOW STOCK
(3, 23, NULL, 650,2000,4000),   -- Carton — LOW STOCK

-- Kho Lạnh (warehouse_id=4)
(4, 12, 8,    350, 200,  800),  -- Cooking oil
(4, 12, 9,    420, 200,  800),  -- Cooking oil lot 2
(4, 13, 11,   280, 500, 2000),  -- Milk
(4, 5,  NULL, 0,   500, 2000),  -- Milk expired — 0 qty

-- Kho Fulfillment (warehouse_id=6)
(6, 4,  NULL, 320,  50,  600),  -- Mouse
(6, 8,  NULL, 180,  80,  400),  -- USB Hub
(6, 15, NULL, 420, 200,  800),  -- Pens
(6, 23, NULL, 2500,2000,8000),  -- Carton
(6, 24, NULL, 1200, 800,3000);  -- Tape

-- ─── 7. CUSTOMERS ────────────────────────────────────────────
INSERT INTO customers (username, full_name, email, phone, shipping_address) VALUES
('abctech',      'Công ty CP ABC Technology',        'mua@abctech.vn',          '028-1234-5678', '456 Lê Lợi, Quận 1, TP.HCM'),
('hust_vp',      'Trường ĐH Bách Khoa Hà Nội',       'vp@hust.edu.vn',          '024-3869-4242', '1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội'),
('grab_vn',      'Grab Vietnam LLC',                  'procurement@grab.vn',     '028-7300-0000', 'Tòa nhà Mapletree, 1060 Nguyễn Văn Linh, Q.7, TP.HCM'),
('vingroup',     'Tập đoàn Vingroup',                 'supply@vingroup.vn',      '024-3974-9999', '458 Minh Khai, Hai Bà Trưng, Hà Nội'),
('fpt_corp',     'Công ty CP FPT',                    'logistics@fpt.com.vn',    '024-7300-7300', 'Tòa nhà FPT, Duy Tân, Cầu Giấy, Hà Nội'),
('masan_group',  'Tập đoàn Masan',                    'purchase@masan.com.vn',   '028-6256-3862', '12 Nguyễn Văn Bảo, Gò Vấp, TP.HCM'),
('tiki_corp',    'Công ty TNHH TiKi',                 'ops@tiki.vn',             '1800-6035',     'Tòa nhà Viettel, 285 Cách Mạng Tháng 8, Q.10, TP.HCM'),
('shopee_vn',    'Shopee Vietnam',                    'warehouse@shopee.vn',     '1800-8088',     'Tòa nhà Mapletree, Q.7, TP.HCM');

-- ─── 8. PURCHASE ORDERS ──────────────────────────────────────
INSERT INTO purchase_orders (supplier_id, warehouse_id, status, total_amount, note, created_by, created_at) VALUES
(1, 1, 'received',          77500000, 'Đơn laptop Q1/2025 — đã nhận đủ',                    1, '2025-01-15 09:00:00'),
(2, 2, 'received',         156000000, 'Samsung Tab S9 cho kho HN',                           1, '2025-02-01 10:00:00'),
(4, 1, 'partially_received', 52000000, 'Phụ kiện tech Q2 — nhận 60%',                       1, '2025-03-10 08:30:00'),
(5, 1, 'received',          33000000, 'Thực phẩm tháng 3 — đã nhận',                        1, '2025-03-15 14:00:00'),
(3, 2, 'ordered',           27500000, 'Văn phòng phẩm Q2 — đã đặt hàng',                    1, '2025-04-01 09:00:00'),
(6, 1, 'approved',          82000000, 'Nội thất văn phòng — đã duyệt',                       1, '2025-04-15 11:00:00'),
(7, 6, 'pending',           45000000, 'Vật tư đóng gói tháng 5',                             1, '2025-05-01 08:00:00'),
(8, 2, 'pending',           68000000, 'Màn hình LG cho kho HN',                              1, '2025-05-05 09:30:00'),
(1, 3, 'pending',           31000000, 'Laptop cho kho ĐN',                                   1, '2025-05-10 10:00:00'),
(5, 4, 'received',          58500000, 'Thực phẩm kho lạnh Q1',                               1, '2025-01-20 08:00:00');

INSERT INTO order_items (order_id, product_id, ordered_quantity, received_quantity, unit_cost) VALUES
-- PO 1: Laptop Dell
(1, 1, 5, 5, 15500000),
-- PO 2: Samsung Tab
(2, 2, 20, 20, 7800000),
-- PO 3: Phụ kiện tech (partially received)
(3, 3, 10, 6, 5200000),
(3, 4, 50, 30, 1750000),
-- PO 4: Thực phẩm
(4, 9, 100, 100, 165000),
(4, 11, 100, 100, 78000),
-- PO 5: Văn phòng phẩm
(5, 14, 200, 0, 62000),
(5, 15, 100, 0, 42000),
(5, 16, 150, 0, 14000),
-- PO 6: Nội thất
(6, 19, 5, 0, 8200000),
(6, 20, 5, 0, 6500000),
-- PO 7: Vật tư đóng gói
(7, 23, 2000, 0, 7500),
(7, 24, 500, 0, 11000),
(7, 25, 300, 0, 18000),
-- PO 8: Màn hình LG
(8, 6, 10, 0, 6800000),
-- PO 9: Laptop ĐN
(9, 1, 2, 0, 15500000),
-- PO 10: Thực phẩm kho lạnh
(10, 12, 200, 200, 145000),
(10, 13, 500, 500, 28000);

-- Stock movements — only inbound and transfers (outbound would conflict with trigger)
INSERT INTO stock_movements (product_id, warehouse_id, change_amount, movement_type, reference_type, created_by, created_at) VALUES
(1,  1, 5,   'inbound',     'po_receive',       1, '2025-01-20 10:00:00'),
(2,  2, 20,  'inbound',     'po_receive',       1, '2025-02-10 09:00:00'),
(3,  1, 6,   'inbound',     'po_receive',       1, '2025-03-15 14:00:00'),
(4,  1, 30,  'inbound',     'po_receive',       1, '2025-03-15 14:30:00'),
(9,  1, 100, 'inbound',     'po_receive',       1, '2025-03-20 09:00:00'),
(10, 1, 80,  'inbound',     'po_receive',       1, '2025-03-20 09:30:00'),
(11, 1, 100, 'inbound',     'po_receive',       1, '2025-03-20 10:00:00'),
(12, 4, 200, 'inbound',     'po_receive',       1, '2025-01-25 08:00:00'),
(13, 4, 500, 'inbound',     'po_receive',       1, '2025-01-25 08:30:00'),
(14, 1, 200, 'inbound',     'po_receive',       1, '2025-05-05 09:00:00'),
(15, 1, 100, 'inbound',     'po_receive',       1, '2025-05-05 09:30:00'),
(2,  1, 10,  'inbound',     'po_receive',       1, '2025-05-10 10:00:00'),
(6,  1, 5,   'inbound',     'po_receive',       1, '2025-05-12 11:00:00'),
(9,  2, 150, 'inbound',     'po_receive',       7, '2025-05-14 09:00:00'),
(23, 6, 500, 'inbound',     'po_receive',       5, '2025-05-15 08:00:00'),
(24, 6, 300, 'inbound',     'po_receive',       5, '2025-05-15 08:30:00');

-- ─── 10. TRANSFER ORDERS ─────────────────────────────────────
INSERT INTO transfer_orders (from_warehouse_id, to_warehouse_id, status, requested_by, note, completed_at, created_at) VALUES
(1, 2, 'completed', 5, 'Bổ sung laptop cho kho HN',          '2025-04-20 10:30:00', '2025-04-20 09:00:00'),
(1, 6, 'completed', 5, 'Chuyển chuột Logitech sang fulfillment', '2025-04-22 09:30:00', '2025-04-22 08:00:00'),
(2, 3, 'completed', 7, 'Bổ sung hàng cho kho ĐN',            '2025-04-25 15:00:00', '2025-04-25 13:00:00'),
(1, 2, 'pending',   5, 'Chuyển văn phòng phẩm về HN',         NULL,                  '2025-05-08 09:00:00'),
(4, 1, 'approved',  2, 'Chuyển dầu ăn từ kho lạnh về HCM',   NULL,                  '2025-05-10 10:00:00');

INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES
(1, 1, 2),
(2, 4, 50),
(3, 2, 5), (3, 9, 30),
(4, 14, 100), (4, 15, 50),
(5, 12, 100);

-- ─── 11. SHIPMENTS ───────────────────────────────────────────
INSERT INTO shipments (origin_warehouse_id, destination_address, status, carrier, tracking_number, shipped_at, delivered_at, created_at) VALUES
(1, 'Tòa nhà Mapletree, 1060 Nguyễn Văn Linh, Q.7, TP.HCM', 'delivered',  'Giao Hàng Nhanh', 'GHN-2025-001234', '2025-04-01 08:00:00', '2025-04-02 14:00:00', '2025-03-31 16:00:00'),
(2, '1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',                  'delivered',  'Viettel Post',    'VTP-2025-005678', '2025-04-05 09:00:00', '2025-04-06 11:00:00', '2025-04-04 15:00:00'),
(1, '456 Lê Lợi, Quận 1, TP.HCM',                           'delivered',  'J&T Express',     'JT-2025-009012',  '2025-04-10 07:30:00', '2025-04-10 16:00:00', '2025-04-09 17:00:00'),
(1, 'Tòa nhà FPT, Duy Tân, Cầu Giấy, Hà Nội',               'in_transit', 'Giao Hàng Nhanh', 'GHN-2025-003456', '2025-05-15 08:00:00', NULL,                  '2025-05-14 16:00:00'),
(2, '458 Minh Khai, Hai Bà Trưng, Hà Nội',                  'pending',    'Viettel Post',    NULL,              NULL,                  NULL,                  '2025-05-16 09:00:00'),
(6, 'Tòa nhà Viettel, 285 CMT8, Q.10, TP.HCM',              'in_transit', 'J&T Express',     'JT-2025-007890',  '2025-05-17 07:00:00', NULL,                  '2025-05-16 15:00:00'),
(1, '12 Nguyễn Văn Bảo, Gò Vấp, TP.HCM',                   'failed',     'Giao Hàng Nhanh', 'GHN-2025-004567', '2025-05-10 08:00:00', NULL,                  '2025-05-09 16:00:00');

INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price) VALUES
(1, 4, 10, 2490000), (1, 8, 20, 690000),
(2, 2, 5,  10500000),
(3, 1, 1,  19900000), (3, 3, 2, 7800000),
(4, 6, 3,  9500000), (4, 5, 5, 3200000),
(5, 19, 2, 12500000), (5, 20, 2, 9800000),
(6, 23, 200, 12000), (6, 24, 100, 17000), (6, 25, 50, 28000),
(7, 9, 20, 240000);

-- ─── 12. CUSTOMER ORDERS ─────────────────────────────────────
INSERT INTO customer_orders (customer_id, warehouse_id, status, total_amount, shipping_address, note, created_at) VALUES
(3, 1, 'delivered',  24900000, 'Tòa nhà Mapletree, Q.7, TP.HCM',          'Giao trong giờ hành chính',  '2025-03-30 10:00:00'),
(2, 2, 'shipped',    52500000, '1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',     NULL,                         '2025-04-03 09:00:00'),
(1, 1, 'delivered',  19900000, '456 Lê Lợi, Quận 1, TP.HCM',              'Giao tầng 5',                '2025-04-08 14:00:00'),
(5, 1, 'processing', 47500000, 'Tòa nhà FPT, Duy Tân, Cầu Giấy, Hà Nội', NULL,                         '2025-05-13 11:00:00'),
(4, 2, 'pending',    82000000, '458 Minh Khai, Hai Bà Trưng, Hà Nội',     'Cần hóa đơn VAT',            '2025-05-15 09:00:00'),
(7, 6, 'confirmed',  28500000, 'Tòa nhà Viettel, Q.10, TP.HCM',           NULL,                         '2025-05-15 14:00:00'),
(6, 1, 'cancelled',  16500000, '12 Nguyễn Văn Bảo, Gò Vấp, TP.HCM',      'Khách hủy đơn',              '2025-05-08 10:00:00'),
(8, 1, 'pending',    120000000,'Tòa nhà Mapletree, Q.7, TP.HCM',          'Đơn hàng lớn Q2',            '2025-05-17 08:00:00');

INSERT INTO customer_order_items (customer_order_id, product_id, quantity, unit_price) VALUES
(1, 4, 10, 2490000),
(2, 2, 5,  10500000),
(3, 1, 1,  19900000),
(4, 6, 3,  9500000), (4, 5, 5, 3200000),
(5, 19, 2, 12500000), (5, 20, 2, 9800000), (5, 21, 5, 2800000),
(6, 23, 200, 12000), (6, 24, 100, 17000), (6, 25, 50, 28000),
(7, 9, 50, 240000), (7, 11, 30, 115000),
(8, 1, 5, 19900000), (8, 2, 10, 10500000);

-- Link shipments to customer orders
INSERT INTO shipment_orders (shipment_id, customer_order_id) VALUES
(1, 1), (2, 2), (3, 3), (4, 4), (6, 6);

-- ─── 13. PAYMENTS ────────────────────────────────────────────
INSERT INTO payments (customer_order_id, amount, payment_method, payment_status, paid_at, created_by) VALUES
(1, 24900000,  'bank_transfer', 'paid',    '2025-04-02 15:00:00', 1),
(2, 52500000,  'credit_card',   'paid',    '2025-04-06 12:00:00', 1),
(3, 19900000,  'bank_transfer', 'paid',    '2025-04-10 17:00:00', 1),
(4, 20000000,  'bank_transfer', 'partial', '2025-05-14 10:00:00', 1),
(6, 28500000,  'e_wallet',      'paid',    '2025-05-15 15:00:00', 1);

-- ─── VERIFY ──────────────────────────────────────────────────
SELECT 'Users'           AS entity, count(*) FROM users
UNION ALL SELECT 'Warehouses',      count(*) FROM warehouses
UNION ALL SELECT 'Suppliers',       count(*) FROM suppliers
UNION ALL SELECT 'Products',        count(*) FROM products
UNION ALL SELECT 'Product Lots',    count(*) FROM product_lots
UNION ALL SELECT 'Inventory',       count(*) FROM inventory
UNION ALL SELECT 'Customers',       count(*) FROM customers
UNION ALL SELECT 'Purchase Orders', count(*) FROM purchase_orders
UNION ALL SELECT 'Stock Movements', count(*) FROM stock_movements
UNION ALL SELECT 'Transfers',       count(*) FROM transfer_orders
UNION ALL SELECT 'Shipments',       count(*) FROM shipments
UNION ALL SELECT 'Customer Orders', count(*) FROM customer_orders
UNION ALL SELECT 'Payments',        count(*) FROM payments
ORDER BY entity;
