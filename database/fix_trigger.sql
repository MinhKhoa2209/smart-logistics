-- Fix sync_inventory_from_movements trigger to use explicit UPDATE/INSERT
CREATE OR REPLACE FUNCTION sync_inventory_from_movements()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_qty INT;
BEGIN
    -- Check sufficient stock for outbound movements
    IF NEW.change_amount < 0 THEN
        SELECT quantity INTO v_existing_qty
        FROM inventory
        WHERE warehouse_id = NEW.warehouse_id
          AND product_id = NEW.product_id
          AND (lot_id = NEW.lot_id OR (lot_id IS NULL AND NEW.lot_id IS NULL));

        IF v_existing_qty IS NULL OR v_existing_qty < ABS(NEW.change_amount) THEN
            RAISE EXCEPTION 'Lỗi nghiệp vụ: Kho ID % không đủ số lượng sản phẩm ID % (Hiện có: %, Cần: %)',
                NEW.warehouse_id, NEW.product_id, COALESCE(v_existing_qty, 0), ABS(NEW.change_amount);
        END IF;
    END IF;

    -- Try UPDATE first, then INSERT if no row exists
    IF NEW.lot_id IS NOT NULL THEN
        UPDATE inventory
        SET quantity = quantity + NEW.change_amount, last_counted_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = NEW.warehouse_id AND product_id = NEW.product_id AND lot_id = NEW.lot_id;

        IF NOT FOUND THEN
            INSERT INTO inventory (warehouse_id, product_id, lot_id, quantity, last_counted_at)
            VALUES (NEW.warehouse_id, NEW.product_id, NEW.lot_id, NEW.change_amount, CURRENT_TIMESTAMP);
        END IF;
    ELSE
        UPDATE inventory
        SET quantity = quantity + NEW.change_amount, last_counted_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = NEW.warehouse_id AND product_id = NEW.product_id AND lot_id IS NULL;

        IF NOT FOUND THEN
            INSERT INTO inventory (warehouse_id, product_id, lot_id, quantity, last_counted_at)
            VALUES (NEW.warehouse_id, NEW.product_id, NULL, NEW.change_amount, CURRENT_TIMESTAMP);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
