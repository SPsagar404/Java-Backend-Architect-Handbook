
# Part 7: Triggers

## 7.1 What Are Triggers?

A trigger is a stored SQL program that **automatically executes** when a specific event (INSERT, UPDATE, DELETE) occurs on a table. Triggers fire without explicit calls.

## 7.2 Trigger Types

| Trigger | When It Fires | Common Use |
|---|---|---|
| `BEFORE INSERT` | Before a new row is inserted | Validate/modify data before saving |
| `AFTER INSERT` | After a new row is inserted | Audit logging, sync denormalized data |
| `BEFORE UPDATE` | Before a row is updated | Validate changes, preserve history |
| `AFTER UPDATE` | After a row is updated | Log changes, notify systems |
| `BEFORE DELETE` | Before a row is deleted | Prevent deletion, archive data |
| `AFTER DELETE` | After a row is deleted | Cleanup related data, audit |

## 7.3 Audit Logging Trigger

```sql
-- Audit log table
CREATE TABLE audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id BIGINT NOT NULL,
    action VARCHAR(10) NOT NULL,
    old_values JSON,
    new_values JSON,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger: log every change to employees table
DELIMITER //
CREATE TRIGGER trg_employees_after_update
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (
        'employees',
        NEW.id,
        'UPDATE',
        JSON_OBJECT(
            'name', OLD.name,
            'salary', OLD.salary,
            'department', OLD.department,
            'is_active', OLD.is_active
        ),
        JSON_OBJECT(
            'name', NEW.name,
            'salary', NEW.salary,
            'department', NEW.department,
            'is_active', NEW.is_active
        ),
        CURRENT_USER()
    );
END //
DELIMITER ;
```

## 7.4 Data Validation Trigger

```sql
DELIMITER //
CREATE TRIGGER trg_orders_before_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    -- Validate: amount must be positive
    IF NEW.total_amount <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order amount must be greater than zero';
    END IF;

    -- Auto-set created timestamp
    SET NEW.created_at = NOW();

    -- Default status
    IF NEW.status IS NULL THEN
        SET NEW.status = 'PENDING';
    END IF;
END //
DELIMITER ;
```

## 7.5 Automatic Stock Update Trigger

```sql
-- After order item is inserted, decrease product stock
DELIMITER //
CREATE TRIGGER trg_order_items_after_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE products
    SET stock_quantity = stock_quantity - NEW.quantity
    WHERE id = NEW.product_id;

    -- Check if stock went negative
    IF (SELECT stock_quantity FROM products WHERE id = NEW.product_id) < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Insufficient stock for product';
    END IF;
END //
DELIMITER ;

-- After order is cancelled, restore stock
DELIMITER //
CREATE TRIGGER trg_orders_after_update_status
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF OLD.status != 'CANCELLED' AND NEW.status = 'CANCELLED' THEN
        UPDATE products p
        INNER JOIN order_items oi ON p.id = oi.product_id
        SET p.stock_quantity = p.stock_quantity + oi.quantity
        WHERE oi.order_id = NEW.id;
    END IF;
END //
DELIMITER ;
```

## 7.6 Soft Delete Trigger

```sql
-- Prevent actual DELETE; mark as deleted instead
DELIMITER //
CREATE TRIGGER trg_customers_before_delete
BEFORE DELETE ON customers
FOR EACH ROW
BEGIN
    -- Instead of deleting, update status
    UPDATE customers
    SET status = 'DELETED', updated_at = NOW()
    WHERE id = OLD.id;

    -- Prevent the actual delete
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Use soft delete: UPDATE status to DELETED instead';
END //
DELIMITER ;
```

---

# Part 8: Indexing and Performance Optimization

## 8.1 What Is an Index?

An index is a **data structure** (usually B+ tree) that speeds up data retrieval. Like a book's index that tells you which page a topic is on, a database index tells MySQL which row a value is in.

```
WITHOUT Index:
  SELECT * FROM employees WHERE email = 'john@test.com';
  MySQL scans ALL 1,000,000 rows (full table scan)
  Time: 2000ms

WITH Index on email:
  MySQL walks the B+ tree directly to the row
  Time: 1ms
```

## 8.2 Index Types

### Clustered Index (Primary Key)
```
- InnoDB tables ALWAYS have a clustered index
- Data rows are physically stored in primary key order
- One per table (the primary key)
- Finding by PK is the fastest possible query

+--------+--------+--------+--------+
| id=1   | id=2   | id=3   | id=4   |  Data stored in PK order
| row    | row    | row    | row    |
+--------+--------+--------+--------+
```

### Non-Clustered Index (Secondary)
```sql
-- Points to the primary key, not directly to data
CREATE INDEX idx_email ON employees(email);
-- Lookup: idx_email -> primary key -> data row (two lookups)

+--------+--------+--------+--------+
| alice@ | bob@   | carl@  | dana@  |  Index sorted by email
| -> PK3 | -> PK1 | -> PK7 | -> PK2 |  Points to primary keys
+--------+--------+--------+--------+
```

### Composite Index
```sql
CREATE INDEX idx_dept_salary ON employees(department, salary);

-- USES INDEX (leftmost prefix rule):
SELECT * FROM employees WHERE department = 'Engineering';              -- Yes
SELECT * FROM employees WHERE department = 'Eng' AND salary > 80000;  -- Yes
SELECT * FROM employees WHERE department = 'Eng' ORDER BY salary;     -- Yes

-- DOES NOT USE INDEX:
SELECT * FROM employees WHERE salary > 80000;  -- No! Leftmost column not used
```

### Covering Index
```sql
CREATE INDEX idx_covering ON employees(department, salary, name);

-- This query is answered ENTIRELY from the index (no table lookup):
SELECT name, salary FROM employees WHERE department = 'Engineering';
-- "Covering" because all SELECT columns are in the index
```

## 8.3 When to Use Indexes

| Use Index | Don't Use Index |
|---|---|
| Columns in WHERE clauses | Tables with < 1000 rows |
| Columns in JOIN conditions | Columns with very low cardinality (e.g., boolean) |
| Columns in ORDER BY | Columns that are frequently updated |
| Columns in GROUP BY | Tables that are write-heavy with few reads |
| Unique constraints | Wide columns (TEXT, BLOB) |

## 8.4 Index Performance Example

```sql
-- Table: orders (5 million rows)
-- Query: Find recent orders for a customer

-- WITHOUT INDEX: Full table scan
EXPLAIN SELECT * FROM orders
WHERE customer_id = 42 AND status = 'PENDING'
ORDER BY created_at DESC LIMIT 10;
-- type: ALL, rows: 5,000,000, time: 3200ms

-- ADD INDEX
CREATE INDEX idx_customer_status_date
ON orders(customer_id, status, created_at);

-- WITH INDEX: Index lookup
EXPLAIN SELECT * FROM orders
WHERE customer_id = 42 AND status = 'PENDING'
ORDER BY created_at DESC LIMIT 10;
-- type: ref, rows: 15, time: 1ms
```

## 8.5 Index Anti-Patterns

```sql
-- 1. Function on indexed column (index NOT used)
SELECT * FROM employees WHERE YEAR(hire_date) = 2024;  -- BAD
SELECT * FROM employees WHERE hire_date >= '2024-01-01'
                          AND hire_date < '2025-01-01'; -- GOOD

-- 2. LIKE with leading wildcard (index NOT used)
SELECT * FROM employees WHERE name LIKE '%John%';  -- BAD (full scan)
SELECT * FROM employees WHERE name LIKE 'John%';   -- GOOD (uses index)

-- 3. OR with non-indexed column
SELECT * FROM employees WHERE email = 'x@y.com' OR phone = '555-1234';
-- If only email is indexed, full scan may be needed

-- 4. Implicit type conversion
SELECT * FROM employees WHERE id = '42';  -- String compared to INT
-- May prevent index usage depending on engine
```

---

# Part 9: Transactions and Concurrency Control

## 9.1 Transactions

```sql
-- Transfer $500 from account 1 to account 2
START TRANSACTION;

    UPDATE accounts SET balance = balance - 500 WHERE id = 1;
    UPDATE accounts SET balance = balance + 500 WHERE id = 2;
    INSERT INTO transactions (from_id, to_id, amount, type)
    VALUES (1, 2, 500, 'TRANSFER');

COMMIT;  -- All changes saved permanently

-- If anything fails:
ROLLBACK;  -- ALL changes undone (atomicity)
```

## 9.2 Savepoints

```sql
START TRANSACTION;

    INSERT INTO orders (customer_id, total_amount) VALUES (1, 100);
    SAVEPOINT after_order;

    INSERT INTO order_items (order_id, product_id, quantity) VALUES (1, 5, 2);

    -- Oops, wrong product
    ROLLBACK TO SAVEPOINT after_order;
    -- Only the order_items insert is undone, order is still there

    INSERT INTO order_items (order_id, product_id, quantity) VALUES (1, 8, 2);

COMMIT;
```

## 9.3 Isolation Levels

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Performance |
|---|---|---|---|---|
| **READ UNCOMMITTED** | Yes | Yes | Yes | Fastest |
| **READ COMMITTED** | No | Yes | Yes | Good |
| **REPEATABLE READ** (MySQL default) | No | No | Nearly No* | Medium |
| **SERIALIZABLE** | No | No | No | Slowest |

*InnoDB uses gap locks to prevent most phantom reads even at REPEATABLE READ.

### Dirty Read Example
```sql
-- READ UNCOMMITTED allows reading uncommitted data from other transactions

-- Transaction 1:
START TRANSACTION;
UPDATE accounts SET balance = 1000 WHERE id = 1;
-- NOT committed yet!

-- Transaction 2 (READ UNCOMMITTED):
SELECT balance FROM accounts WHERE id = 1;
-- Returns 1000 (uncommitted data!)

-- Transaction 1:
ROLLBACK;
-- Transaction 2 read data that never actually existed!
```

### Non-Repeatable Read Example
```sql
-- Transaction 1 (READ COMMITTED):
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 1;  -- Returns 500

-- Transaction 2 commits an update:
UPDATE accounts SET balance = 800 WHERE id = 1;
COMMIT;

-- Transaction 1 reads again:
SELECT balance FROM accounts WHERE id = 1;  -- Returns 800 (different!)
-- Same query, different result within same transaction
```

```sql
-- Set isolation level
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- Or for global:
SET GLOBAL TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

## 9.4 Deadlocks

Two transactions waiting for each other's locks.

```sql
-- Transaction 1:                  Transaction 2:
START TRANSACTION;                 START TRANSACTION;
UPDATE accounts                    UPDATE accounts
SET balance = 100                  SET balance = 200
WHERE id = 1;   -- Locks row 1    WHERE id = 2;   -- Locks row 2

UPDATE accounts                    UPDATE accounts
SET balance = 200                  SET balance = 100
WHERE id = 2;   -- WAITS for T2   WHERE id = 1;   -- WAITS for T1

-- DEADLOCK! MySQL detects it and kills one transaction
```

**How to prevent deadlocks:**
1. Always access tables/rows in the same order
2. Keep transactions short
3. Use appropriate isolation level
4. Add proper indexes to reduce lock scope

---

# Part 10: Query Optimization

## 10.1 EXPLAIN Command

```sql
EXPLAIN SELECT o.id, c.name, o.total_amount
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'PENDING'
ORDER BY o.created_at DESC
LIMIT 10;
```

### EXPLAIN Output Columns

| Column | Meaning | What to Look For |
|---|---|---|
| **type** | Join type | ALL is bad; ref, eq_ref, const are good |
| **rows** | Estimated rows scanned | Lower is better |
| **key** | Index actually used | NULL means no index used |
| **Extra** | Additional info | "Using filesort" and "Using temporary" are concerns |

### Join Types (best to worst)

| Type | Speed | Description |
|---|---|---|
| `const` | Fastest | Primary key or unique index lookup |
| `eq_ref` | Fast | Unique index in JOIN (one row per match) |
| `ref` | Good | Non-unique index lookup |
| `range` | OK | Index range scan (BETWEEN, >, <) |
| `index` | Slow | Full index scan (reads entire index) |
| `ALL` | Slowest | Full table scan (reads every row) |

## 10.2 Optimization Techniques

### 1. Add Missing Indexes
```sql
-- Before: Full table scan
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;
-- type: ALL, rows: 5000000

-- Fix:
CREATE INDEX idx_customer_id ON orders(customer_id);

-- After: Index lookup
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;
-- type: ref, rows: 25
```

### 2. Use Covering Index
```sql
-- Before: Index lookup + table lookup (two steps)
SELECT customer_id, status, total_amount FROM orders WHERE customer_id = 42;

-- Create covering index
CREATE INDEX idx_covering ON orders(customer_id, status, total_amount);
-- After: Index-only scan (one step, no table lookup)
-- Extra: Using index
```

### 3. Avoid SELECT *
```sql
-- BAD: Loads all columns from disk
SELECT * FROM orders WHERE customer_id = 42;

-- GOOD: Load only needed columns
SELECT id, status, total_amount FROM orders WHERE customer_id = 42;
```

### 4. Optimize Subqueries with JOIN
```sql
-- SLOW: Correlated subquery runs once per row
SELECT * FROM employees e
WHERE salary > (SELECT AVG(salary) FROM employees e2 WHERE e2.department = e.department);

-- FASTER: JOIN with precomputed averages
SELECT e.*
FROM employees e
INNER JOIN (
    SELECT department, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY department
) dept_avg ON e.department = dept_avg.department
WHERE e.salary > dept_avg.avg_salary;
```

### 5. Optimize Pagination for Deep Pages
```sql
-- SLOW: OFFSET skips rows one by one
SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 1000000;
-- Scans 1,000,010 rows!

-- FAST: Keyset pagination (seek method)
SELECT * FROM orders
WHERE id > 1000000  -- Start from last seen ID
ORDER BY id
LIMIT 10;
-- Scans only 10 rows using index
```

### 6. Use EXISTS Instead of IN for Large Datasets
```sql
-- SLOW for large subquery results:
SELECT * FROM customers WHERE id IN (SELECT customer_id FROM orders);

-- FASTER:
SELECT * FROM customers c WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

---

# Part 11: Real Production Database Scenarios

## 11.1 Order Processing System

```sql
-- Place an order (transaction ensures atomicity)
DELIMITER //
CREATE PROCEDURE PlaceOrder(
    IN p_customer_id BIGINT,
    IN p_product_ids JSON,
    IN p_quantities JSON,
    IN p_shipping_address TEXT,
    OUT p_order_id BIGINT,
    OUT p_status VARCHAR(50)
)
BEGIN
    DECLARE v_product_id BIGINT;
    DECLARE v_quantity INT;
    DECLARE v_price DECIMAL(12,2);
    DECLARE v_stock INT;
    DECLARE v_total DECIMAL(12,2) DEFAULT 0;
    DECLARE v_items INT;
    DECLARE v_i INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_order_id = -1;
        SET p_status = 'FAILED';
    END;

    SET v_items = JSON_LENGTH(p_product_ids);

    START TRANSACTION;

    -- Create order
    INSERT INTO orders (customer_id, total_amount, status, shipping_address, created_at)
    VALUES (p_customer_id, 0, 'PENDING', p_shipping_address, NOW());
    SET p_order_id = LAST_INSERT_ID();

    -- Process each item
    WHILE v_i < v_items DO
        SET v_product_id = JSON_EXTRACT(p_product_ids, CONCAT('$[', v_i, ']'));
        SET v_quantity = JSON_EXTRACT(p_quantities, CONCAT('$[', v_i, ']'));

        -- Lock product row and check stock
        SELECT price, stock_quantity INTO v_price, v_stock
        FROM products WHERE id = v_product_id FOR UPDATE;

        IF v_stock < v_quantity THEN
            SET p_status = CONCAT('Insufficient stock for product ', v_product_id);
            ROLLBACK;
            SET p_order_id = -1;
            LEAVE;
        END IF;

        -- Insert order item
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (p_order_id, v_product_id, v_quantity, v_price);

        -- Update stock
        UPDATE products SET stock_quantity = stock_quantity - v_quantity
        WHERE id = v_product_id;

        SET v_total = v_total + (v_price * v_quantity);
        SET v_i = v_i + 1;
    END WHILE;

    -- Update total
    UPDATE orders SET total_amount = v_total WHERE id = p_order_id;

    COMMIT;
    SET p_status = 'SUCCESS';
END //
DELIMITER ;
```

## 11.2 Banking Transaction System

```sql
-- Daily interest calculation
DELIMITER //
CREATE PROCEDURE CalculateDailyInterest()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_account_id BIGINT;
    DECLARE v_balance DECIMAL(15,2);
    DECLARE v_rate DECIMAL(8,6);
    DECLARE v_interest DECIMAL(15,2);
    DECLARE v_processed INT DEFAULT 0;

    DECLARE account_cursor CURSOR FOR
        SELECT a.id, a.balance, at.annual_interest_rate
        FROM accounts a
        JOIN account_types at ON a.type_id = at.id
        WHERE a.status = 'ACTIVE' AND a.balance > 0;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    START TRANSACTION;

    OPEN account_cursor;
    calc_loop: LOOP
        FETCH account_cursor INTO v_account_id, v_balance, v_rate;
        IF done THEN LEAVE calc_loop; END IF;

        -- Daily interest = balance * (annual_rate / 365)
        SET v_interest = ROUND(v_balance * (v_rate / 365), 2);

        -- Credit interest
        UPDATE accounts SET balance = balance + v_interest WHERE id = v_account_id;

        -- Log transaction
        INSERT INTO transactions (account_id, amount, type, description, created_at)
        VALUES (v_account_id, v_interest, 'INTEREST', 'Daily interest credit', NOW());

        SET v_processed = v_processed + 1;
    END LOOP;
    CLOSE account_cursor;

    -- Log batch completion
    INSERT INTO batch_log (job_name, records_processed, completed_at)
    VALUES ('DAILY_INTEREST', v_processed, NOW());

    COMMIT;
END //
DELIMITER ;
```

## 11.3 Inventory Management Queries

```sql
-- Products running low on stock
SELECT p.id, p.name, p.sku, p.stock_quantity, p.category,
       CASE
           WHEN p.stock_quantity = 0 THEN 'OUT_OF_STOCK'
           WHEN p.stock_quantity < 10 THEN 'CRITICAL'
           WHEN p.stock_quantity < 50 THEN 'LOW'
           ELSE 'ADEQUATE'
       END AS stock_status
FROM products p
WHERE p.is_active = TRUE AND p.stock_quantity < 50
ORDER BY p.stock_quantity ASC;

-- Top selling products this month
SELECT p.name, p.sku,
       SUM(oi.quantity) AS units_sold,
       SUM(oi.line_total) AS revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE o.status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')
  AND o.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
GROUP BY p.id, p.name, p.sku
ORDER BY units_sold DESC
LIMIT 20;

-- Inventory turnover rate
SELECT p.name, p.stock_quantity,
       COALESCE(sales.monthly_sold, 0) AS monthly_sold,
       CASE
           WHEN sales.monthly_sold > 0
           THEN ROUND(p.stock_quantity / sales.monthly_sold, 1)
           ELSE 999
       END AS months_of_stock
FROM products p
LEFT JOIN (
    SELECT oi.product_id, SUM(oi.quantity) AS monthly_sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY oi.product_id
) sales ON p.id = sales.product_id
WHERE p.is_active = TRUE
ORDER BY months_of_stock ASC;
```

## 11.4 Batch Processing: Monthly Report

```sql
-- Generate monthly revenue report
CREATE TABLE monthly_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_month DATE NOT NULL,
    total_orders INT,
    total_revenue DECIMAL(15,2),
    avg_order_value DECIMAL(12,2),
    new_customers INT,
    top_category VARCHAR(100),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DELIMITER //
CREATE PROCEDURE GenerateMonthlyReport(
    IN p_year INT,
    IN p_month INT
)
BEGIN
    DECLARE v_start_date DATE;
    DECLARE v_end_date DATE;
    DECLARE v_total_orders INT;
    DECLARE v_total_revenue DECIMAL(15,2);
    DECLARE v_avg_value DECIMAL(12,2);
    DECLARE v_new_customers INT;
    DECLARE v_top_category VARCHAR(100);

    SET v_start_date = CONCAT(p_year, '-', LPAD(p_month, 2, '0'), '-01');
    SET v_end_date = LAST_DAY(v_start_date);

    -- Order stats
    SELECT COUNT(*), COALESCE(SUM(total_amount), 0), COALESCE(AVG(total_amount), 0)
    INTO v_total_orders, v_total_revenue, v_avg_value
    FROM orders
    WHERE created_at BETWEEN v_start_date AND v_end_date
      AND status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED');

    -- New customers
    SELECT COUNT(*) INTO v_new_customers
    FROM customers
    WHERE created_at BETWEEN v_start_date AND v_end_date;

    -- Top category by revenue
    SELECT p.category INTO v_top_category
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at BETWEEN v_start_date AND v_end_date
    GROUP BY p.category
    ORDER BY SUM(oi.line_total) DESC
    LIMIT 1;

    INSERT INTO monthly_reports
        (report_month, total_orders, total_revenue, avg_order_value, new_customers, top_category)
    VALUES
        (v_start_date, v_total_orders, v_total_revenue, v_avg_value, v_new_customers, v_top_category);
END //
DELIMITER ;
```

---
