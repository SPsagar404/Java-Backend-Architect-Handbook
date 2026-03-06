# Mastering SQL, MySQL & Stored Procedures -- Architecture, Optimization, and Enterprise Usage Guide

---

**Author:** Senior Database Architect
**Target Audience:** Java backend developers with 3+ years experience aiming for architect-level database expertise
**Prerequisites:** Basic SQL knowledge, Java, Spring Boot fundamentals

---

# Table of Contents

1. SQL Fundamentals
2. MySQL Architecture
3. SQL Query Mastery
4. Advanced SQL Queries
5. Database Design
6. Stored Procedures Deep Dive
7. Triggers
8. Indexing and Performance Optimization
9. Transactions and Concurrency Control
10. Query Optimization
11. Real Production Database Scenarios
12. MySQL + Spring Boot Integration
13. Stored Procedure Production Examples
14. Database Performance Tuning
15. Common Production Issues
16. Interview Questions (100+)
17. Hands-on SQL Exercises (30)

---

# Part 1: SQL Fundamentals

## 1.1 What is SQL?

**SQL (Structured Query Language)** is the standard language for interacting with relational databases. Every backend system -- banking, e-commerce, insurance, government -- ultimately reads and writes data through SQL.

## 1.2 Types of SQL Commands

| Category | Full Name | Commands | Purpose |
|---|---|---|---|
| **DDL** | Data Definition Language | CREATE, ALTER, DROP, TRUNCATE | Define/modify database structure |
| **DML** | Data Manipulation Language | SELECT, INSERT, UPDATE, DELETE | Manipulate data |
| **TCL** | Transaction Control Language | COMMIT, ROLLBACK, SAVEPOINT | Manage transactions |
| **DCL** | Data Control Language | GRANT, REVOKE | Manage permissions |

```sql
-- DDL: Create table
CREATE TABLE employees (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    department VARCHAR(50),
    salary DECIMAL(12,2),
    hire_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DML: Insert data
INSERT INTO employees (name, email, department, salary, hire_date)
VALUES ('John Doe', 'john@company.com', 'Engineering', 95000.00, '2022-01-15');

-- TCL: Transaction
START TRANSACTION;
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;
COMMIT;

-- DCL: Permissions
GRANT SELECT, INSERT ON employees TO 'app_user'@'localhost';
```

## 1.3 SQL Execution Lifecycle

```
Client sends SQL query
       |
       v
+-------------------------------+
| 1. CONNECTION HANDLER         |
|    Authenticate, assign thread|
+-------------------------------+
       |
       v
+-------------------------------+
| 2. PARSER                     |
|    Syntax check               |
|    Build parse tree            |
+-------------------------------+
       |
       v
+-------------------------------+
| 3. PREPROCESSOR               |
|    Validate table/column names|
|    Check permissions           |
+-------------------------------+
       |
       v
+-------------------------------+
| 4. QUERY OPTIMIZER            |
|    Generate execution plans   |
|    Choose best plan (cost)    |
|    Decide index usage         |
+-------------------------------+
       |
       v
+-------------------------------+
| 5. EXECUTION ENGINE           |
|    Execute chosen plan        |
|    Read/write data via        |
|    storage engine (InnoDB)    |
+-------------------------------+
       |
       v
+-------------------------------+
| 6. RESULT SET                 |
|    Format and return results  |
+-------------------------------+
```

## 1.4 Why SQL Matters for Backend Engineers

| Scenario | SQL Impact |
|---|---|
| Slow API response | Usually a slow SQL query underneath |
| Data integrity | Constraints, transactions, ACID guarantee correctness |
| Reporting | Complex aggregations, window functions |
| Debugging production | Need to query data directly |
| Performance tuning | 80% of backend performance is database performance |
| System design interviews | Database schema design is always tested |

---

# Part 2: MySQL Architecture

## 2.1 MySQL Server Architecture

```
+------------------------------------------------------------------+
|                        MySQL Server                               |
|                                                                    |
|  +----------------------------+                                   |
|  |     Connection Layer       |  Thread per connection            |
|  |  (Authentication, SSL,     |  Connection pooling               |
|  |   Thread management)       |                                   |
|  +----------------------------+                                   |
|              |                                                     |
|              v                                                     |
|  +----------------------------+                                   |
|  |       SQL Layer            |                                   |
|  |  +--------+ +----------+  |                                   |
|  |  | Parser | | Optimizer|  |                                   |
|  |  +--------+ +----------+  |                                   |
|  |  +--------+ +----------+  |                                   |
|  |  | Cache  | | Executor |  |                                   |
|  |  +--------+ +----------+  |                                   |
|  +----------------------------+                                   |
|              |                                                     |
|              v                                                     |
|  +----------------------------+                                   |
|  |    Storage Engine Layer    |                                   |
|  |                            |                                   |
|  |  +--------+ +----------+  |                                   |
|  |  | InnoDB | | MyISAM   |  |                                   |
|  |  +--------+ +----------+  |                                   |
|  |  +--------+ +----------+  |                                   |
|  |  | Memory | | Archive  |  |                                   |
|  |  +--------+ +----------+  |                                   |
|  +----------------------------+                                   |
|              |                                                     |
|              v                                                     |
|  +----------------------------+                                   |
|  |     File System            |                                   |
|  |  Data files, Log files,    |                                   |
|  |  Index files               |                                   |
|  +----------------------------+                                   |
+------------------------------------------------------------------+
```

## 2.2 InnoDB vs MyISAM

| Feature | InnoDB | MyISAM |
|---|---|---|
| **Transactions** | Yes (ACID compliant) | No |
| **Row-level locking** | Yes | Table-level only |
| **Foreign keys** | Yes | No |
| **Crash recovery** | Yes (redo/undo logs) | No |
| **MVCC** | Yes | No |
| **Full-text search** | Yes (5.6+) | Yes |
| **Storage** | Clustered index (data in PK order) | Heap storage |
| **Use case** | OLTP, production systems | Read-heavy analytics, legacy |

**Rule: Always use InnoDB for production systems.**

## 2.3 ACID Properties

| Property | Meaning | MySQL Implementation |
|---|---|---|
| **Atomicity** | All or nothing | Undo log (rollback on failure) |
| **Consistency** | Valid state transitions | Constraints, triggers |
| **Isolation** | Concurrent transactions don't interfere | MVCC + isolation levels |
| **Durability** | Committed data survives crash | Redo log (write-ahead logging) |

## 2.4 MVCC (Multi-Version Concurrency Control)

InnoDB maintains multiple versions of rows to allow readers and writers to operate concurrently without blocking each other.

```
Transaction T1 (READ):               Transaction T2 (WRITE):
SELECT * FROM accounts               UPDATE accounts
WHERE id = 1;                         SET balance = 500
                                      WHERE id = 1;
T1 sees the OLD version              T2 creates a NEW version
(consistent snapshot)                 (written to undo log)

Result: T1 reads without blocking T2
        T2 writes without blocking T1
```

## 2.5 InnoDB Locking

| Lock Type | Scope | Use |
|---|---|---|
| **Shared Lock (S)** | Row | Allows concurrent reads, blocks writes |
| **Exclusive Lock (X)** | Row | Blocks all other access |
| **Intention Shared (IS)** | Table | Signals intent to lock rows for reading |
| **Intention Exclusive (IX)** | Table | Signals intent to lock rows for writing |
| **Gap Lock** | Between index values | Prevents phantom reads |
| **Next-Key Lock** | Row + gap before it | Default for REPEATABLE READ |

```sql
-- Shared lock
SELECT * FROM accounts WHERE id = 1 LOCK IN SHARE MODE;

-- Exclusive lock
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
```

---

# Part 3: SQL Query Mastery

## 3.1 SELECT

```sql
-- Basic select
SELECT name, email, salary FROM employees;

-- All columns (avoid in production!)
SELECT * FROM employees;  -- BAD: loads unnecessary data

-- Aliases
SELECT
    e.name AS employee_name,
    d.name AS department_name,
    e.salary * 12 AS annual_salary
FROM employees e
JOIN departments d ON e.department_id = d.id;
```

## 3.2 WHERE Clause

**What:** Filters rows based on conditions.
**Internally:** Applied after FROM but before GROUP BY in execution order.

```sql
-- Comparison operators
SELECT * FROM employees WHERE salary > 80000;
SELECT * FROM employees WHERE department = 'Engineering';
SELECT * FROM employees WHERE hire_date >= '2023-01-01';

-- Logical operators
SELECT * FROM employees
WHERE department = 'Engineering' AND salary > 80000;

SELECT * FROM employees
WHERE department = 'Engineering' OR department = 'Product';

-- IN operator
SELECT * FROM employees
WHERE department IN ('Engineering', 'Product', 'Design');

-- BETWEEN
SELECT * FROM orders
WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';

-- LIKE (pattern matching)
SELECT * FROM employees WHERE email LIKE '%@gmail.com';
SELECT * FROM employees WHERE name LIKE 'John%';

-- IS NULL
SELECT * FROM employees WHERE manager_id IS NULL; -- Top-level managers

-- NOT
SELECT * FROM employees WHERE department NOT IN ('HR', 'Legal');
```

## 3.3 GROUP BY and Aggregations

**What:** Groups rows by column values and applies aggregate functions.

```sql
-- Count employees per department
SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department;

-- Average salary per department
SELECT department,
       COUNT(*) AS count,
       AVG(salary) AS avg_salary,
       MIN(salary) AS min_salary,
       MAX(salary) AS max_salary,
       SUM(salary) AS total_payroll
FROM employees
GROUP BY department
ORDER BY avg_salary DESC;

-- Monthly revenue
SELECT
    YEAR(order_date) AS year,
    MONTH(order_date) AS month,
    COUNT(*) AS total_orders,
    SUM(total_amount) AS revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date)
ORDER BY year, month;
```

## 3.4 HAVING

**What:** Filters groups (applied AFTER GROUP BY, unlike WHERE which filters rows).

```sql
-- Departments with more than 10 employees
SELECT department, COUNT(*) AS count
FROM employees
GROUP BY department
HAVING COUNT(*) > 10;

-- High-spending customers
SELECT customer_id, SUM(total_amount) AS total_spent
FROM orders
GROUP BY customer_id
HAVING SUM(total_amount) > 10000
ORDER BY total_spent DESC;
```

## 3.5 ORDER BY

```sql
-- Single column sort
SELECT * FROM employees ORDER BY salary DESC;

-- Multiple columns
SELECT * FROM employees
ORDER BY department ASC, salary DESC;

-- Sort by expression
SELECT name, salary, salary * 12 AS annual
FROM employees
ORDER BY annual DESC;
```

## 3.6 LIMIT and OFFSET (Pagination)

```sql
-- First 10 results
SELECT * FROM products ORDER BY created_at DESC LIMIT 10;

-- Page 2 (items 11-20)
SELECT * FROM products ORDER BY created_at DESC LIMIT 10 OFFSET 10;

-- Page N: LIMIT page_size OFFSET (page_number * page_size)

-- Top 5 highest paid employees
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 5;
```

## 3.7 SQL Execution Order

```
Written order:   SELECT -> FROM -> WHERE -> GROUP BY -> HAVING -> ORDER BY -> LIMIT
Execution order: FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY -> LIMIT

This is why you can't use column aliases in WHERE but CAN in ORDER BY.
```

---

# Part 4: Advanced SQL Queries

## 4.1 Subqueries

```sql
-- Scalar subquery (returns single value)
SELECT name, salary,
       (SELECT AVG(salary) FROM employees) AS company_avg
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- IN subquery
SELECT * FROM employees
WHERE department_id IN (
    SELECT id FROM departments WHERE location = 'New York'
);

-- EXISTS subquery (more efficient than IN for large datasets)
SELECT * FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

## 4.2 Correlated Subqueries

A subquery that references the outer query. Executes once per outer row.

```sql
-- Employees earning more than their department average
SELECT e.name, e.salary, e.department
FROM employees e
WHERE e.salary > (
    SELECT AVG(e2.salary)
    FROM employees e2
    WHERE e2.department = e.department  -- References outer query
);

-- Latest order per customer
SELECT * FROM orders o1
WHERE o1.created_at = (
    SELECT MAX(o2.created_at)
    FROM orders o2
    WHERE o2.customer_id = o1.customer_id
);
```

## 4.3 Joins

```sql
-- INNER JOIN (only matching rows from both tables)
SELECT e.name, d.name AS department
FROM employees e
INNER JOIN departments d ON e.department_id = d.id;

-- LEFT JOIN (all rows from left, matching from right, NULL if no match)
SELECT c.name, COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name;
-- Shows ALL customers, even those with zero orders

-- RIGHT JOIN (all rows from right, matching from left)
SELECT e.name, d.name AS department
FROM employees e
RIGHT JOIN departments d ON e.department_id = d.id;
-- Shows ALL departments, even those with no employees

-- FULL OUTER JOIN (MySQL workaround using UNION)
SELECT e.name, d.name AS department
FROM employees e LEFT JOIN departments d ON e.department_id = d.id
UNION
SELECT e.name, d.name AS department
FROM employees e RIGHT JOIN departments d ON e.department_id = d.id;

-- Self Join (table joined with itself)
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

## 4.4 Window Functions

Window functions perform calculations across a set of rows related to the current row WITHOUT collapsing rows (unlike GROUP BY).

```sql
-- ROW_NUMBER: Assign sequential numbers
SELECT
    name, department, salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS salary_rank
FROM employees;

-- RANK and DENSE_RANK
SELECT
    name, department, salary,
    RANK() OVER (ORDER BY salary DESC) AS rank_with_gaps,
    DENSE_RANK() OVER (ORDER BY salary DESC) AS rank_no_gaps
FROM employees;

-- Partition by department (rank within each department)
SELECT
    name, department, salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM employees;

-- Running total
SELECT
    order_date,
    total_amount,
    SUM(total_amount) OVER (ORDER BY order_date) AS running_total
FROM orders;

-- Moving average (last 7 days)
SELECT
    order_date,
    daily_revenue,
    AVG(daily_revenue) OVER (
        ORDER BY order_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7d
FROM daily_sales;

-- LAG and LEAD (previous/next row values)
SELECT
    month,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY month) AS prev_month,
    revenue - LAG(revenue, 1) OVER (ORDER BY month) AS growth
FROM monthly_revenue;

-- NTILE (divide into buckets)
SELECT
    name, salary,
    NTILE(4) OVER (ORDER BY salary) AS salary_quartile
FROM employees;
```

## 4.5 Common Table Expressions (CTE)

```sql
-- Basic CTE
WITH high_earners AS (
    SELECT name, department, salary
    FROM employees
    WHERE salary > 100000
)
SELECT department, COUNT(*) AS count, AVG(salary) AS avg_salary
FROM high_earners
GROUP BY department;

-- Multiple CTEs
WITH
    dept_stats AS (
        SELECT department, AVG(salary) AS avg_salary, COUNT(*) AS emp_count
        FROM employees
        GROUP BY department
    ),
    high_salary_depts AS (
        SELECT department, avg_salary
        FROM dept_stats
        WHERE avg_salary > 80000
    )
SELECT * FROM high_salary_depts ORDER BY avg_salary DESC;

-- Recursive CTE (organizational hierarchy)
WITH RECURSIVE org_chart AS (
    -- Anchor: top-level managers (no manager)
    SELECT id, name, manager_id, 1 AS level
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive: employees reporting to previous level
    SELECT e.id, e.name, e.manager_id, oc.level + 1
    FROM employees e
    INNER JOIN org_chart oc ON e.manager_id = oc.id
)
SELECT * FROM org_chart ORDER BY level, name;
```

---

# Part 5: Database Design

## 5.1 Normalization

### First Normal Form (1NF)
- Each column contains atomic (indivisible) values
- No repeating groups

```sql
-- BAD (not 1NF): phone_numbers contains multiple values
-- | id | name | phone_numbers          |
-- | 1  | John | 555-1234, 555-5678     |

-- GOOD (1NF): separate table for phones
CREATE TABLE employees (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE employee_phones (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    employee_id BIGINT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);
```

### Second Normal Form (2NF)
- Must be in 1NF
- All non-key columns depend on the ENTIRE primary key (no partial dependencies)

### Third Normal Form (3NF)
- Must be in 2NF
- No transitive dependencies (non-key column depends on another non-key column)

```sql
-- BAD (not 3NF): department_name depends on department_id, not employee_id
-- | employee_id | name | department_id | department_name |

-- GOOD (3NF): separate departments table
CREATE TABLE departments (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE employees (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    department_id BIGINT,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

## 5.2 Denormalization

Intentionally adding redundancy to improve read performance.

| When to Normalize | When to Denormalize |
|---|---|
| Write-heavy OLTP systems | Read-heavy reporting/analytics |
| Data integrity is critical | Query performance is critical |
| Storage is a concern | Query simplicity matters |
| Few complex queries | Many complex JOINs |

```sql
-- Normalized: requires JOIN for every order query
SELECT o.*, c.name, c.email FROM orders o JOIN customers c ON o.customer_id = c.id;

-- Denormalized: customer name stored in orders table (redundant but fast)
SELECT order_id, customer_name, total_amount FROM orders;
-- No JOIN needed! But must keep customer_name in sync
```

## 5.3 Database Design for Microservices

```
Rule 1: Each service owns its database
Rule 2: No cross-service foreign keys
Rule 3: Communication via APIs or events

+------------+    +------------+    +------------+
| User       |    | Order      |    | Payment    |
| Service    |    | Service    |    | Service    |
+-----+------+    +-----+------+    +-----+------+
      |                 |                 |
+-----+------+    +-----+------+    +-----+------+
| user_db    |    | order_db   |    | payment_db |
|            |    |            |    |            |
| users      |    | orders     |    | payments   |
| addresses  |    | order_items|    | refunds    |
| user_prefs |    | (stores    |    | txn_log    |
|            |    | customer_id|    |            |
|            |    | NOT FK)    |    |            |
+------------+    +------------+    +------------+
```

## 5.4 Production Schema Example: E-Commerce

```sql
CREATE TABLE customers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    status ENUM('ACTIVE','SUSPENDED','DELETED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status)
);

CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100),
    price DECIMAL(12,2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_sku (sku)
);

CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status ENUM('PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED') DEFAULT 'PENDING',
    shipping_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_order (order_id)
);
```

---

# Part 6: Stored Procedures Deep Dive

## 6.1 What Are Stored Procedures?

A stored procedure is a **precompiled set of SQL statements** stored in the database and executed as a single unit. Think of it as a function in the database.

## 6.2 Why Use Stored Procedures?

| Benefit | Explanation |
|---|---|
| **Performance** | Precompiled execution plan, no repeated parsing |
| **Reduced network calls** | Multiple SQL statements in one call |
| **Security** | Grant EXECUTE permission without direct table access |
| **Encapsulation** | Business logic centralized in database |
| **Reusability** | Call from any application (Java, Python, etc.) |
| **Atomicity** | All statements in one transaction |

## 6.3 When to Use in Production

| Use Case | Example |
|---|---|
| Complex business calculations | Interest calculation in banking |
| Batch data processing | Monthly statement generation |
| Data validation | Eligibility checks in government systems |
| Report generation | Aggregate and format report data |
| Data migration | Transform and move data between tables |

## 6.4 Basic Syntax

```sql
-- Create a simple procedure
DELIMITER //
CREATE PROCEDURE GetEmployeesByDepartment(
    IN dept_name VARCHAR(50)
)
BEGIN
    SELECT id, name, email, salary
    FROM employees
    WHERE department = dept_name
    ORDER BY salary DESC;
END //
DELIMITER ;

-- Call the procedure
CALL GetEmployeesByDepartment('Engineering');
```

## 6.5 Parameter Types

```sql
DELIMITER //
CREATE PROCEDURE TransferFunds(
    IN from_account_id BIGINT,     -- Input only
    IN to_account_id BIGINT,       -- Input only
    IN amount DECIMAL(12,2),       -- Input only
    OUT transfer_id BIGINT,        -- Output only
    OUT status_message VARCHAR(100) -- Output only
)
BEGIN
    DECLARE from_balance DECIMAL(12,2);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET status_message = 'Transfer failed due to database error';
        SET transfer_id = -1;
    END;

    START TRANSACTION;

    -- Check balance
    SELECT balance INTO from_balance
    FROM accounts WHERE id = from_account_id FOR UPDATE;

    IF from_balance < amount THEN
        SET status_message = 'Insufficient funds';
        SET transfer_id = -1;
        ROLLBACK;
    ELSE
        -- Debit
        UPDATE accounts SET balance = balance - amount WHERE id = from_account_id;
        -- Credit
        UPDATE accounts SET balance = balance + amount WHERE id = to_account_id;
        -- Log
        INSERT INTO transactions (from_account, to_account, amount, type, created_at)
        VALUES (from_account_id, to_account_id, amount, 'TRANSFER', NOW());

        SET transfer_id = LAST_INSERT_ID();
        SET status_message = 'Transfer successful';
        COMMIT;
    END IF;
END //
DELIMITER ;

-- Call with OUT parameters
CALL TransferFunds(1, 2, 500.00, @tid, @msg);
SELECT @tid AS transfer_id, @msg AS status;
```

## 6.6 Control Flow

```sql
DELIMITER //
CREATE PROCEDURE CalculateDiscount(
    IN customer_id BIGINT,
    OUT discount_pct DECIMAL(5,2)
)
BEGIN
    DECLARE total_spent DECIMAL(12,2);
    DECLARE membership_years INT;

    -- Get customer data
    SELECT SUM(total_amount), TIMESTAMPDIFF(YEAR, MIN(created_at), NOW())
    INTO total_spent, membership_years
    FROM orders
    WHERE customer_id = customer_id AND status = 'DELIVERED';

    -- IF-ELSEIF-ELSE
    IF total_spent > 50000 AND membership_years > 5 THEN
        SET discount_pct = 20.00;
    ELSEIF total_spent > 25000 OR membership_years > 3 THEN
        SET discount_pct = 15.00;
    ELSEIF total_spent > 10000 THEN
        SET discount_pct = 10.00;
    ELSE
        SET discount_pct = 5.00;
    END IF;
END //
DELIMITER ;
```

## 6.7 Cursors (Row-by-Row Processing)

```sql
DELIMITER //
CREATE PROCEDURE GenerateMonthlyStatements(
    IN statement_month INT,
    IN statement_year INT
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE cust_id BIGINT;
    DECLARE cust_email VARCHAR(150);
    DECLARE total DECIMAL(12,2);

    DECLARE customer_cursor CURSOR FOR
        SELECT c.id, c.email, COALESCE(SUM(o.total_amount), 0)
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customer_id
            AND MONTH(o.created_at) = statement_month
            AND YEAR(o.created_at) = statement_year
        WHERE c.status = 'ACTIVE'
        GROUP BY c.id, c.email;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN customer_cursor;

    read_loop: LOOP
        FETCH customer_cursor INTO cust_id, cust_email, total;
        IF done THEN LEAVE read_loop; END IF;

        INSERT INTO monthly_statements
            (customer_id, statement_month, statement_year, total_amount, generated_at)
        VALUES
            (cust_id, statement_month, statement_year, total, NOW());
    END LOOP;

    CLOSE customer_cursor;
END //
DELIMITER ;
```

---
