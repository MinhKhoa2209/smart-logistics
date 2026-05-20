-- ============================================================
-- Audit Trigger — captures INSERT/UPDATE/DELETE on critical tables
-- Stores old/new row values as JSONB in audit_logs
-- User identity read from session variable app.current_user_id
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id INT;
    v_old_value JSONB;
    v_new_value JSONB;
    v_record_id BIGINT;
BEGIN
    -- Read user_id from session variable (set by Express appContext middleware)
    BEGIN
        v_user_id := current_setting('app.current_user_id', true)::INT;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Capture old/new values as JSONB
    IF TG_OP = 'DELETE' THEN
        v_old_value := to_jsonb(OLD);
        v_new_value := NULL;
        v_record_id := (to_jsonb(OLD) ->> (TG_TABLE_NAME || '_id'))::BIGINT;
        IF v_record_id IS NULL THEN
            v_record_id := (to_jsonb(OLD) ->> 'id')::BIGINT;
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        v_old_value := NULL;
        v_new_value := to_jsonb(NEW);
        v_record_id := (to_jsonb(NEW) ->> (TG_TABLE_NAME || '_id'))::BIGINT;
        IF v_record_id IS NULL THEN
            v_record_id := (to_jsonb(NEW) ->> 'id')::BIGINT;
        END IF;
    ELSE -- UPDATE
        v_old_value := to_jsonb(OLD);
        v_new_value := to_jsonb(NEW);
        v_record_id := (to_jsonb(NEW) ->> (TG_TABLE_NAME || '_id'))::BIGINT;
        IF v_record_id IS NULL THEN
            v_record_id := (to_jsonb(NEW) ->> 'id')::BIGINT;
        END IF;
    END IF;

    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value, created_at)
    VALUES (v_user_id, TG_OP, TG_TABLE_NAME, v_record_id, v_old_value, v_new_value, NOW());

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ─── Attach trigger to critical tables ───────────────────────

-- Products
DROP TRIGGER IF EXISTS trg_audit_products ON products;
CREATE TRIGGER trg_audit_products
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Warehouses
DROP TRIGGER IF EXISTS trg_audit_warehouses ON warehouses;
CREATE TRIGGER trg_audit_warehouses
    AFTER INSERT OR UPDATE OR DELETE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Inventory
DROP TRIGGER IF EXISTS trg_audit_inventory ON inventory;
CREATE TRIGGER trg_audit_inventory
    AFTER INSERT OR UPDATE OR DELETE ON inventory
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Purchase Orders
DROP TRIGGER IF EXISTS trg_audit_purchase_orders ON purchase_orders;
CREATE TRIGGER trg_audit_purchase_orders
    AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Customer Orders
DROP TRIGGER IF EXISTS trg_audit_customer_orders ON customer_orders;
CREATE TRIGGER trg_audit_customer_orders
    AFTER INSERT OR UPDATE OR DELETE ON customer_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Shipments
DROP TRIGGER IF EXISTS trg_audit_shipments ON shipments;
CREATE TRIGGER trg_audit_shipments
    AFTER INSERT OR UPDATE OR DELETE ON shipments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Transfer Orders
DROP TRIGGER IF EXISTS trg_audit_transfer_orders ON transfer_orders;
CREATE TRIGGER trg_audit_transfer_orders
    AFTER INSERT OR UPDATE OR DELETE ON transfer_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Suppliers
DROP TRIGGER IF EXISTS trg_audit_suppliers ON suppliers;
CREATE TRIGGER trg_audit_suppliers
    AFTER INSERT OR UPDATE OR DELETE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

SELECT 'Audit triggers created on: products, warehouses, inventory, purchase_orders, customer_orders, shipments, transfer_orders, suppliers' AS result;
