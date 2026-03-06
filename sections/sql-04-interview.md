
# Part 16: SQL Interview Questions (100+)

## SQL Basics (Q1-Q20)

**Q1. What is the difference between DDL and DML?**
DDL (Data Definition Language) defines structure: CREATE, ALTER, DROP, TRUNCATE. DML (Data Manipulation Language) manipulates data: SELECT, INSERT, UPDATE, DELETE. DDL auto-commits; DML can be rolled back within a transaction.

**Q2. What is the difference between DELETE, TRUNCATE, and DROP?**
DELETE: removes rows (can use WHERE, logged, can rollback). TRUNCATE: removes all rows (no WHERE, faster, resets AUTO_INCREMENT). DROP: removes entire table (structure + data). DELETE is slowest; TRUNCATE is fastest for clearing a table.

**Q3. What is the difference between WHERE and HAVING?**
WHERE filters rows before GROUP BY. HAVING filters groups after GROUP BY. WHERE cannot use aggregate functions; HAVING can. Example: `HAVING COUNT(*) > 5`.

**Q4. What is the difference between CHAR and VARCHAR?**
CHAR: fixed-length (always allocates full size, padded with spaces). VARCHAR: variable-length (stores only actual characters + 1-2 bytes for length). Use CHAR for fixed data (state codes, zip codes); VARCHAR for variable data (names, emails).

**Q5. What is the difference between UNION and UNION ALL?**
UNION combines results and removes duplicates (slower, requires sort). UNION ALL combines results and keeps all duplicates (faster). Use UNION ALL when you know there are no duplicates or duplicates are acceptable.

**Q6. What are constraints?**
Rules enforced on columns: PRIMARY KEY (unique + not null), FOREIGN KEY (referential integrity), UNIQUE (no duplicates), NOT NULL (required), CHECK (condition), DEFAULT (fallback value).

**Q7. What is a primary key?**
A column (or combination) that uniquely identifies each row. Must be unique and NOT NULL. Only one primary key per table. InnoDB stores data in primary key order (clustered index).

**Q8. What is a foreign key?**
A column that references the primary key of another table. Enforces referential integrity. Prevents orphan records. Can specify ON DELETE CASCADE or ON DELETE SET NULL.

**Q9. What is AUTO_INCREMENT?**
MySQL feature that automatically generates a unique integer for new rows. Used for primary keys. Starts at 1 by default, increments by 1. Thread-safe.

**Q10. What is the difference between IN and EXISTS?**
IN compares a value against a list. EXISTS checks if a subquery returns any rows. EXISTS is usually faster for large subquery results because it stops at the first match.

**Q11. Write a query to find the second highest salary.**
```sql
SELECT MAX(salary) FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
-- Or using DENSE_RANK:
SELECT salary FROM (
    SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
    FROM employees
) ranked WHERE rnk = 2;
```

**Q12. What is the difference between JOIN and subquery?**
JOINs are generally faster because the optimizer handles them better. Subqueries are more readable for simple lookups. Correlated subqueries are slow (execute once per row). Prefer JOINs for large datasets.

**Q13. What is NULL in SQL?**
NULL represents unknown or missing data. NULL is not zero, not empty string. Any comparison with NULL returns NULL (not TRUE). Use IS NULL / IS NOT NULL to check. Use COALESCE to handle NULLs.

**Q14. What is COALESCE?**
Returns the first non-NULL value from a list of expressions.
```sql
SELECT COALESCE(phone, mobile, 'No phone') AS contact FROM customers;
```

**Q15. What is CASE expression?**
SQL's if-then-else logic.
```sql
SELECT name,
    CASE
        WHEN salary > 100000 THEN 'Senior'
        WHEN salary > 60000 THEN 'Mid'
        ELSE 'Junior'
    END AS level
FROM employees;
```

**Q16. What are aggregate functions?**
Functions that compute a single result from multiple rows: COUNT, SUM, AVG, MIN, MAX. Used with GROUP BY. Ignore NULLs (except COUNT(*)).

**Q17. What is the execution order of a SQL query?**
FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY -> LIMIT. This is why you can't use column aliases in WHERE but can in ORDER BY.

**Q18. What is a view?**
A virtual table defined by a SELECT query. Does not store data physically. Used for abstraction, security (expose limited columns), and simplifying complex queries.

**Q19. What is the difference between a view and a table?**
Table stores data physically; view stores a query definition. Table takes disk space; view takes none. Table data persists; view data is computed on access.

**Q20. What are TCL commands?**
Transaction Control Language: COMMIT (save changes), ROLLBACK (undo changes), SAVEPOINT (partial rollback point), SET TRANSACTION (configure isolation level).

## Joins (Q21-Q35)

**Q21. Explain all types of JOINs.**
INNER JOIN: only matching rows from both tables. LEFT JOIN: all left rows + matching right (NULL if no match). RIGHT JOIN: all right rows + matching left. FULL OUTER JOIN: all rows from both (MySQL uses UNION). CROSS JOIN: cartesian product.

**Q22. What is a self join?**
Joining a table with itself. Common use: employee-manager hierarchy.
```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e LEFT JOIN employees m ON e.manager_id = m.id;
```

**Q23. What is a cross join?**
Produces cartesian product: every row from table A combined with every row from table B. If A has 100 rows and B has 50, result has 5000 rows. Rarely used intentionally.

**Q24. What is the difference between LEFT JOIN and RIGHT JOIN?**
LEFT JOIN keeps all rows from the left table. RIGHT JOIN keeps all rows from the right table. They are mirrors of each other. Convention: use LEFT JOIN consistently.

**Q25. How to find rows in table A that don't exist in table B?**
```sql
SELECT a.* FROM table_a a
LEFT JOIN table_b b ON a.id = b.a_id
WHERE b.id IS NULL;
-- Or: NOT EXISTS
SELECT * FROM table_a a
WHERE NOT EXISTS (SELECT 1 FROM table_b b WHERE b.a_id = a.id);
```

**Q26. What is a natural join?**
Joins on columns with the same name in both tables automatically. Risky because schema changes can break it. Always use explicit JOIN ON conditions.

**Q27. Can you JOIN more than 2 tables?**
Yes. JOINs chain: `FROM a JOIN b ON ... JOIN c ON ... JOIN d ON ...`. Performance depends on indexes and data volume. Each additional JOIN adds complexity.

**Q28. What is the performance impact of JOINs?**
Depends on indexes, data size, and join type. Nested loop join is O(n*m) without indexes. With indexes, each lookup is O(log n). Always index JOIN columns.

**Q29. How to optimize a slow JOIN?**
1. Index columns in ON clause. 2. Filter early with WHERE. 3. Reduce selected columns. 4. Consider denormalization for read-heavy queries. 5. Use EXPLAIN to check plan.

**Q30. What is the difference between ON and WHERE in a LEFT JOIN?**
ON condition determines which rows to join. WHERE filters after the join. Putting a condition on the RIGHT table in WHERE effectively turns LEFT JOIN into INNER JOIN.

**Q31. Write a query to find duplicate rows.**
```sql
SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;
```

**Q32. Write a query to delete duplicate rows keeping one.**
```sql
DELETE u1 FROM users u1
INNER JOIN users u2 ON u1.email = u2.email
WHERE u1.id > u2.id;
```

**Q33. What is a semi-join?**
A join where you check existence but don't include columns from the second table. Implemented using EXISTS or IN. Optimizer may convert IN to semi-join.

**Q34. What is an anti-join?**
A join that returns rows from the first table that have NO match in the second table. Implemented using NOT EXISTS or LEFT JOIN + IS NULL.

**Q35. How does MySQL process multi-table JOINs?**
MySQL uses nested-loop join by default. For each row in the outer table, it scans/looks up matching rows in the inner table using indexes. The optimizer chooses table order for best performance.

## Indexes (Q36-Q50)

**Q36. What is an index?**
A data structure (B+ tree) that speeds up data retrieval by allowing direct look up instead of full table scan. Like a book's index that maps topics to page numbers.

**Q37. What is the difference between clustered and non-clustered indexes?**
Clustered: data rows stored in index order (one per table, usually PK). Non-clustered: separate structure pointing to PK (multiple per table).

**Q38. What is a composite index?**
An index on multiple columns. Follows leftmost prefix rule: `INDEX(a,b,c)` supports queries on (a), (a,b), (a,b,c) but NOT (b), (c), or (b,c).

**Q39. What is a covering index?**
An index that contains all columns needed by a query. MySQL reads data entirely from the index without accessing the table. EXPLAIN shows "Using index".

**Q40. When should you NOT create an index?**
Small tables (< 1000 rows), frequently updated columns, low cardinality columns (boolean), wide columns (TEXT/BLOB), tables with heavy writes and few reads.

**Q41. What is index selectivity?**
The ratio of distinct values to total rows. High selectivity (close to 1.0) means the index is effective. Low selectivity (e.g., gender column) means the index is nearly useless.

**Q42. How does a B+ tree index work?**
A balanced tree where leaf nodes contain pointers to data rows. Each lookup traverses from root to leaf (O(log n)). Leaf nodes are linked for efficient range scans.

**Q43. What is a full-text index?**
A special index for text search. Supports natural language search and boolean mode. Used for searching large text columns.
```sql
CREATE FULLTEXT INDEX idx_content ON articles(title, body);
SELECT * FROM articles WHERE MATCH(title, body) AGAINST('database optimization');
```

**Q44. What is the impact of too many indexes?**
Slower writes (every INSERT/UPDATE/DELETE updates all indexes). More disk space. More memory usage. Only create indexes that are actually used by queries.

**Q45. How to find unused indexes?**
```sql
SELECT * FROM sys.schema_unused_indexes WHERE object_schema = 'mydb';
```

**Q46. What is an index hint?**
Force or suggest MySQL to use a specific index.
```sql
SELECT * FROM orders USE INDEX (idx_customer_id) WHERE customer_id = 42;
SELECT * FROM orders FORCE INDEX (idx_date) WHERE created_at > '2024-01-01';
```

**Q47. What is a prefix index?**
Indexing only the first N characters of a string column. Saves space. Useful for long strings.
```sql
CREATE INDEX idx_email ON users(email(50));
```

**Q48. How to check if an index is being used?**
Use EXPLAIN. Check the "key" column. If NULL, no index is used. Also check "type": ALL means full scan.

**Q49. What is an invisible index?**
MySQL 8.0 feature. Index exists but optimizer ignores it. Used to test impact of dropping an index without actually dropping it.
```sql
ALTER TABLE orders ALTER INDEX idx_status INVISIBLE;
```

**Q50. What is the difference between UNIQUE index and PRIMARY KEY?**
Both enforce uniqueness. PRIMARY KEY: only one per table, implies NOT NULL, defines clustered index. UNIQUE: multiple per table, allows NULL (one NULL), creates non-clustered index.

## Transactions and Stored Procedures (Q51-Q70)

**Q51. What is ACID?**
Atomicity (all or nothing), Consistency (valid state), Isolation (concurrent transactions don't interfere), Durability (committed data survives crash).

**Q52. Explain isolation levels.**
READ UNCOMMITTED (see uncommitted changes), READ COMMITTED (see only committed), REPEATABLE READ (consistent read within transaction, MySQL default), SERIALIZABLE (full isolation, slowest).

**Q53. What is a deadlock?**
Two transactions waiting for each other's locks. MySQL detects and kills one. Prevent by: accessing rows in consistent order, keeping transactions short, using proper indexes.

**Q54. What is a stored procedure?**
Precompiled SQL program stored in the database. Called with CALL. Supports parameters (IN/OUT/INOUT), variables, flow control, cursors, and error handling.

**Q55. What is the difference between stored procedure and function?**
Procedure: called with CALL, can have OUT params, can return multiple result sets, can do DML. Function: called in SQL expressions, returns single value, no OUT params in standard SQL.

**Q56. What is a cursor?**
A database object that traverses the result set row by row. Used in stored procedures for row-level processing. Slower than set-based operations.

**Q57. What is a trigger?**
SQL code that automatically executes when INSERT/UPDATE/DELETE occurs. Used for audit logging, data validation, denormalization. Cannot be called manually.

**Q58. What is the difference between BEFORE and AFTER triggers?**
BEFORE: fires before the operation, can modify NEW values. AFTER: fires after the operation, data is already saved.

**Q59. Can a trigger call itself (recursive trigger)?**
MySQL does not allow recursive triggers by default. A trigger on table A cannot cause another trigger on table A to fire.

**Q60. What is a stored function?**
```sql
CREATE FUNCTION CalculateTax(amount DECIMAL(12,2)) RETURNS DECIMAL(12,2)
DETERMINISTIC
BEGIN
    RETURN amount * 0.18;
END;
-- Usage: SELECT price, CalculateTax(price) AS tax FROM products;
```

**Q61. How to handle errors in stored procedures?**
```sql
DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; END;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Custom error';
```

**Q62. What is SAVEPOINT?**
A named point within a transaction. You can ROLLBACK TO SAVEPOINT without undoing the entire transaction. Useful for partial undo in complex procedures.

**Q63. What is autocommit?**
MySQL's default mode where each SQL statement is a separate transaction that auto-commits. Disable with `SET autocommit = 0;` to manually control transactions.

**Q64. What is two-phase commit?**
A protocol for distributed transactions: Phase 1 (Prepare) all participants vote YES/NO. Phase 2 (Commit) if all voted YES, commit; otherwise rollback all.

**Q65. How to optimize stored procedures?**
1. Use set-based operations instead of cursors. 2. Add indexes for queried columns. 3. Minimize variables. 4. Avoid dynamic SQL unless necessary. 5. Keep transactions short.

**Q66. What is DETERMINISTIC in functions?**
A function is DETERMINISTIC if it always returns the same result for the same input. MySQL can cache results of deterministic functions. Mark functions correctly for optimization.

**Q67. What is the difference between temporary table and CTE?**
Temporary table: physical table in tempdb, persists for session, can be indexed. CTE: virtual, exists only for single query, no indexing. Use temp tables for large intermediate results; CTEs for readability.

**Q68. How to pass a list of IDs to a stored procedure?**
Use JSON or comma-separated string with FIND_IN_SET, or a temporary table.
```sql
-- JSON approach (MySQL 5.7+)
DELIMITER //
CREATE PROCEDURE GetUsersByIds(IN p_ids JSON)
BEGIN
    SELECT * FROM users u
    WHERE JSON_CONTAINS(p_ids, CAST(u.id AS JSON));
END //
```

**Q69. What is SELECT FOR UPDATE?**
Acquires exclusive lock on selected rows. Other transactions wait until lock is released. Used to prevent concurrent modifications.
```sql
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
-- Row is locked until COMMIT or ROLLBACK
```

**Q70. How to debug a stored procedure?**
Use SELECT statements to output intermediate values (poor man's debugger). Use information_schema.routines to view procedure source. Log to a debug table.

## Query Optimization (Q71-Q85)

**Q71. What is EXPLAIN?**
Shows the query execution plan: which indexes are used, join order, estimated rows scanned, and cost. Essential for diagnosing slow queries.

**Q72. What does "type: ALL" mean in EXPLAIN?**
Full table scan. Every row is read. Usually means a missing index. This is the worst join type.

**Q73. What is "Using filesort" in EXPLAIN?**
MySQL couldn't use an index for sorting and must sort in memory or disk. Often means ORDER BY columns are not indexed. Can be slow for large result sets.

**Q74. What is "Using temporary" in EXPLAIN?**
MySQL creates a temporary table to process the query. Common with DISTINCT, GROUP BY, or UNION. May indicate optimization opportunity.

**Q75. How to optimize GROUP BY?**
Add an index that matches the GROUP BY columns. If `GROUP BY department`, add `INDEX(department)`. This allows MySQL to group using the index without sorting.

**Q76. What is query caching?**
MySQL 5.x had query cache (deprecated in 8.0). Application-level caching with Redis is the modern alternative.

**Q77. How to optimize LIKE queries?**
`LIKE 'John%'` can use index (prefix match). `LIKE '%John%'` cannot use index (full scan). For substring search, use FULLTEXT index.

**Q78. What is index condition pushdown?**
InnoDB evaluates WHERE conditions at the storage engine level using the index, reducing the number of rows the server needs to examine. Enabled by default in MySQL 5.6+.

**Q79. How to optimize COUNT queries?**
`COUNT(*)` counts all rows (uses smallest index). `COUNT(column)` counts non-NULL rows in that column. For approximate counts, use `SHOW TABLE STATUS`.

**Q80. What is the difference between LIMIT 1 and EXISTS?**
Both stop after finding one row. EXISTS is semantically clearer for "does this exist?" checks. Performance is similar but EXISTS may be slightly faster.

**Q81. How to optimize INSERT performance?**
Batch inserts: `INSERT INTO t VALUES (1,..), (2,..), (3,..)`. Disable indexes during bulk load. Use `LOAD DATA INFILE` for massive imports. Wrap in single transaction.

**Q82. What is partition pruning?**
When querying a partitioned table, MySQL only scans relevant partitions. If `WHERE year = 2024` and table is partitioned by year, only the 2024 partition is scanned.

**Q83. How to profile a query?**
```sql
SET profiling = 1;
SELECT * FROM orders WHERE customer_id = 42;
SHOW PROFILE FOR QUERY 1;
-- Shows time spent in: parsing, optimizing, executing, sending
```

**Q84. What is a derived table?**
A subquery in the FROM clause. MySQL materializes it as a temporary table. Can be replaced with CTE for readability.
```sql
SELECT dept, avg_sal FROM (
    SELECT department AS dept, AVG(salary) AS avg_sal
    FROM employees GROUP BY department
) AS dept_avgs WHERE avg_sal > 80000;
```

**Q85. How to handle pagination for millions of rows?**
Keyset/seek pagination instead of OFFSET:
```sql
-- Instead of: LIMIT 10 OFFSET 999990 (scans 1M rows!)
-- Use: WHERE id > last_seen_id LIMIT 10 (index lookup, fast)
```

## Architecture (Q86-Q105)

**Q86. What is InnoDB buffer pool?**
In-memory cache for data and indexes. Larger buffer pool = more data cached = fewer disk reads. Set to 70-80% of server RAM. Most impactful MySQL setting.

**Q87. What is the redo log?**
Write-ahead log for crash recovery. Changes written to redo log before data files. On crash, MySQL replays redo log to recover committed transactions. Ensures durability (D in ACID).

**Q88. What is the undo log?**
Stores previous versions of modified rows. Used for ROLLBACK and MVCC. Allows other transactions to read old versions while a transaction modifies data.

**Q89. What is the binary log (binlog)?**
Records all data modifications in order. Used for replication (replicas replay binlog events) and point-in-time recovery. Different from redo log (which is for crash recovery).

**Q90. What is replication in MySQL?**
Primary-replica setup: primary handles writes, binlog events replicate to replicas. Replicas handle reads. Provides read scalability and high availability.

**Q91. What is GTID replication?**
Global Transaction Identifier: each transaction has a unique ID across all servers. Simplifies failover because replicas know exactly which transactions they've applied.

**Q92. What is the difference between row-based and statement-based replication?**
Row-based: replicates actual row changes (larger binlog, deterministic). Statement-based: replicates SQL statements (smaller, non-deterministic for some functions). Mixed: uses statement-based by default, switches to row-based when needed.

**Q93. How to implement high availability in MySQL?**
MySQL Group Replication, InnoDB Cluster, or Galera Cluster for multi-master. ProxySQL or MySQL Router for connection routing. Automatic failover on primary failure.

**Q94. What is sharding?**
Distributing data across multiple MySQL instances. Each shard holds a subset of data (e.g., users 1-1M on shard1, 1M-2M on shard2). Application routes queries to correct shard.

**Q95. What is the difference between horizontal and vertical partitioning?**
Horizontal: split rows across partitions (by range, hash, list). Vertical: split columns into separate tables (normalize). Horizontal is for large tables; vertical is for wide tables.

**Q96. How does MySQL handle concurrent writes?**
InnoDB uses row-level locking, MVCC, and isolation levels. Writers lock affected rows. Readers use MVCC snapshots. Deadlocks are detected and resolved automatically.

**Q97. What is the purpose of the innodb_flush_log_at_trx_commit setting?**
Controls durability vs performance. Value 1: flush redo log to disk on every commit (safest, slowest). Value 2: flush to OS cache on commit (faster, less safe). Value 0: flush every second (fastest, risk of 1 second data loss).

**Q98. What is online DDL?**
MySQL 5.6+ allows ALTER TABLE operations without blocking reads/writes. Uses algorithm INPLACE or INSTANT. Example: adding an index doesn't lock the table.

**Q99. Design a database schema for a banking system.**
Tables: accounts, customers, transactions, account_types, branches. Use DECIMAL for monetary values. Foreign keys for integrity. Indexes on account_number, customer_id. Stored procedures for transfers.

**Q100. When would you choose MySQL over PostgreSQL?**
MySQL: simpler replication, widely supported, faster for simple queries. PostgreSQL: better for complex queries (CTEs, window functions), JSON support, extensibility. Choose based on use case.

**Q101. What is connection pooling and why is it important?**
Reusing database connections instead of creating new ones. Creating a connection takes ~100ms. Pool maintains ready connections. HikariCP is the fastest Java connection pool.

**Q102. What is the slow query log?**
Logs queries that take longer than `long_query_time` seconds. Essential for production monitoring. Should always be enabled.

**Q103. How to handle schema migrations in production?**
Use Flyway or Liquibase. Version all schema changes as scripts. Run migrations during deployment. Always use backward-compatible changes. Never use `ddl-auto: update`.

**Q104. What is the difference between OLTP and OLAP?**
OLTP: Online Transaction Processing (fast reads/writes, normalized, row-oriented). OLAP: Online Analytical Processing (complex queries, denormalized, columnar storage). Most backend apps are OLTP.

**Q105. What is MySQL 8.0's most important feature?**
Window functions, CTEs (WITH clause), JSON improvements, invisible indexes, instant DDL, default authentication change (caching_sha2_password), roles for access control.

---

# Part 17: Hands-on SQL Exercises (30)

## Beginner (Exercises 1-10)

**Exercise 1:** Create a database called `ecommerce` with tables: `customers`, `products`, `orders`, `order_items`.
```sql
CREATE DATABASE ecommerce;
USE ecommerce;
CREATE TABLE customers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    category VARCHAR(100)
);
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE TABLE order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

**Exercise 2:** Insert 5 customers and 10 products.
```sql
INSERT INTO customers (name, email) VALUES
('Alice Johnson', 'alice@mail.com'),
('Bob Smith', 'bob@mail.com'),
('Carol White', 'carol@mail.com'),
('David Brown', 'david@mail.com'),
('Eve Davis', 'eve@mail.com');

INSERT INTO products (name, price, stock, category) VALUES
('Laptop', 999.99, 50, 'Electronics'),
('Phone', 699.99, 100, 'Electronics'),
('Headphones', 149.99, 200, 'Electronics'),
('Desk', 299.99, 30, 'Furniture'),
('Chair', 199.99, 45, 'Furniture'),
('Keyboard', 79.99, 150, 'Accessories'),
('Mouse', 29.99, 300, 'Accessories'),
('Monitor', 449.99, 40, 'Electronics'),
('Webcam', 89.99, 80, 'Electronics'),
('USB Hub', 24.99, 500, 'Accessories');
```

**Exercise 3:** Find all products in the Electronics category priced above $100.
```sql
SELECT * FROM products WHERE category = 'Electronics' AND price > 100 ORDER BY price DESC;
```

**Exercise 4:** Count products per category.
```sql
SELECT category, COUNT(*) AS product_count, AVG(price) AS avg_price
FROM products GROUP BY category ORDER BY product_count DESC;
```

**Exercise 5:** Find customers who have never placed an order.
```sql
SELECT c.* FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.id IS NULL;
```

**Exercise 6:** Get the total revenue per month.
```sql
SELECT
    DATE_FORMAT(o.created_at, '%Y-%m') AS month,
    COUNT(*) AS total_orders,
    SUM(o.total_amount) AS revenue
FROM orders o
WHERE o.status != 'CANCELLED'
GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
ORDER BY month;
```

**Exercise 7:** Find the most expensive product in each category.
```sql
SELECT p.* FROM products p
INNER JOIN (
    SELECT category, MAX(price) AS max_price
    FROM products GROUP BY category
) max_p ON p.category = max_p.category AND p.price = max_p.max_price;
```

**Exercise 8:** List all orders with customer name and order total.
```sql
SELECT o.id AS order_id, c.name AS customer, o.total_amount, o.status, o.created_at
FROM orders o
JOIN customers c ON o.customer_id = c.id
ORDER BY o.created_at DESC;
```

**Exercise 9:** Update stock after an order is placed.
```sql
UPDATE products SET stock = stock - 2 WHERE id = 1;
```

**Exercise 10:** Delete all cancelled orders older than 1 year.
```sql
DELETE FROM order_items
WHERE order_id IN (
    SELECT id FROM orders
    WHERE status = 'CANCELLED' AND created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR)
);
DELETE FROM orders
WHERE status = 'CANCELLED' AND created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

## Intermediate (Exercises 11-20)

**Exercise 11:** Find the top 5 customers by total spending.
```sql
SELECT c.name, SUM(o.total_amount) AS total_spent, COUNT(o.id) AS order_count
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status NOT IN ('CANCELLED')
GROUP BY c.id, c.name
ORDER BY total_spent DESC
LIMIT 5;
```

**Exercise 12:** Find products that have never been ordered.
```sql
SELECT p.* FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.product_id = p.id
);
```

**Exercise 13:** Calculate order totals using SUM of line items.
```sql
SELECT oi.order_id,
       SUM(oi.quantity * oi.unit_price) AS calculated_total
FROM order_items oi
GROUP BY oi.order_id;
```

**Exercise 14:** Rank customers by total spending.
```sql
SELECT
    c.name,
    SUM(o.total_amount) AS total_spent,
    RANK() OVER (ORDER BY SUM(o.total_amount) DESC) AS spending_rank
FROM customers c
JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name;
```

**Exercise 15:** Find month-over-month revenue growth.
```sql
WITH monthly AS (
    SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        SUM(total_amount) AS revenue
    FROM orders WHERE status != 'CANCELLED'
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
)
SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_month,
    ROUND((revenue - LAG(revenue) OVER (ORDER BY month))
        / LAG(revenue) OVER (ORDER BY month) * 100, 2) AS growth_pct
FROM monthly;
```

**Exercise 16:** Find the running total of orders.
```sql
SELECT
    id, customer_id, total_amount, created_at,
    SUM(total_amount) OVER (ORDER BY created_at) AS running_total
FROM orders
WHERE status != 'CANCELLED';
```

**Exercise 17:** Find customers who ordered in both January and February.
```sql
SELECT c.name FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE MONTH(o.created_at) IN (1, 2) AND YEAR(o.created_at) = 2024
GROUP BY c.id, c.name
HAVING COUNT(DISTINCT MONTH(o.created_at)) = 2;
```

**Exercise 18:** Create a product sales summary with category totals.
```sql
SELECT
    COALESCE(p.category, 'TOTAL') AS category,
    SUM(oi.quantity) AS units_sold,
    SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE o.status IN ('CONFIRMED', 'DELIVERED')
GROUP BY p.category WITH ROLLUP;
```

**Exercise 19:** Find products with stock below average.
```sql
SELECT * FROM products
WHERE stock < (SELECT AVG(stock) FROM products)
ORDER BY stock ASC;
```

**Exercise 20:** Pivot monthly sales by category.
```sql
SELECT
    DATE_FORMAT(o.created_at, '%Y-%m') AS month,
    SUM(CASE WHEN p.category = 'Electronics' THEN oi.quantity * oi.unit_price ELSE 0 END) AS electronics,
    SUM(CASE WHEN p.category = 'Furniture' THEN oi.quantity * oi.unit_price ELSE 0 END) AS furniture,
    SUM(CASE WHEN p.category = 'Accessories' THEN oi.quantity * oi.unit_price ELSE 0 END) AS accessories
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
ORDER BY month;
```

## Advanced (Exercises 21-30)

**Exercise 21:** Write a stored procedure to process an order.
```sql
DELIMITER //
CREATE PROCEDURE PlaceSimpleOrder(
    IN p_customer_id BIGINT, IN p_product_id BIGINT,
    IN p_quantity INT, OUT p_order_id BIGINT)
BEGIN
    DECLARE v_price DECIMAL(12,2);
    DECLARE v_stock INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_order_id = -1; END;

    START TRANSACTION;
    SELECT price, stock INTO v_price, v_stock FROM products WHERE id = p_product_id FOR UPDATE;
    IF v_stock < p_quantity THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock';
    END IF;
    INSERT INTO orders (customer_id, total_amount, status) VALUES (p_customer_id, v_price * p_quantity, 'CONFIRMED');
    SET p_order_id = LAST_INSERT_ID();
    INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (p_order_id, p_product_id, p_quantity, v_price);
    UPDATE products SET stock = stock - p_quantity WHERE id = p_product_id;
    COMMIT;
END //
DELIMITER ;
```

**Exercise 22:** Write a trigger for audit logging on orders.
```sql
DELIMITER //
CREATE TRIGGER trg_orders_audit
AFTER UPDATE ON orders FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_at)
        VALUES ('orders', NEW.id, 'STATUS_CHANGE',
                JSON_OBJECT('status', OLD.status),
                JSON_OBJECT('status', NEW.status), NOW());
    END IF;
END //
DELIMITER ;
```

**Exercise 23:** Write a recursive CTE to find employee hierarchy.
```sql
WITH RECURSIVE hierarchy AS (
    SELECT id, name, manager_id, 1 AS level, CAST(name AS CHAR(500)) AS path
    FROM employees WHERE manager_id IS NULL
    UNION ALL
    SELECT e.id, e.name, e.manager_id, h.level + 1, CONCAT(h.path, ' > ', e.name)
    FROM employees e JOIN hierarchy h ON e.manager_id = h.id
)
SELECT * FROM hierarchy ORDER BY path;
```

**Exercise 24:** Implement keyset pagination.
```sql
-- Page 1:
SELECT id, name, price FROM products ORDER BY id LIMIT 10;
-- Page N (last seen id = 10):
SELECT id, name, price FROM products WHERE id > 10 ORDER BY id LIMIT 10;
```

**Exercise 25:** Write a query using NTILE to bucket customers by spending.
```sql
SELECT name, total_spent,
    CASE quartile
        WHEN 1 THEN 'Bronze' WHEN 2 THEN 'Silver'
        WHEN 3 THEN 'Gold' WHEN 4 THEN 'Platinum'
    END AS tier
FROM (
    SELECT c.name, SUM(o.total_amount) AS total_spent,
           NTILE(4) OVER (ORDER BY SUM(o.total_amount)) AS quartile
    FROM customers c JOIN orders o ON c.id = o.customer_id
    GROUP BY c.id, c.name
) ranked;
```

**Exercise 26:** Find gaps in sequential IDs.
```sql
SELECT t1.id + 1 AS gap_start,
       MIN(t2.id) - 1 AS gap_end
FROM orders t1
JOIN orders t2 ON t2.id > t1.id
WHERE NOT EXISTS (SELECT 1 FROM orders t3 WHERE t3.id = t1.id + 1)
GROUP BY t1.id
HAVING gap_start <= gap_end;
```

**Exercise 27:** Write a query to detect fraudulent orders (same customer, multiple orders within 1 minute).
```sql
SELECT
    o1.customer_id, o1.id AS order1, o2.id AS order2,
    o1.created_at AS time1, o2.created_at AS time2,
    TIMESTAMPDIFF(SECOND, o1.created_at, o2.created_at) AS seconds_apart
FROM orders o1
JOIN orders o2 ON o1.customer_id = o2.customer_id
    AND o1.id < o2.id
    AND TIMESTAMPDIFF(SECOND, o1.created_at, o2.created_at) < 60;
```

**Exercise 28:** Create a materialized summary table and stored procedure to refresh it.
```sql
CREATE TABLE daily_sales_summary (
    sales_date DATE PRIMARY KEY,
    total_orders INT, total_revenue DECIMAL(15,2),
    avg_order_value DECIMAL(12,2), unique_customers INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DELIMITER //
CREATE PROCEDURE RefreshDailySummary(IN p_date DATE)
BEGIN
    REPLACE INTO daily_sales_summary
    SELECT DATE(created_at), COUNT(*), SUM(total_amount),
           AVG(total_amount), COUNT(DISTINCT customer_id), NOW()
    FROM orders
    WHERE DATE(created_at) = p_date AND status != 'CANCELLED';
END //
DELIMITER ;
```

**Exercise 29:** Write a query to find the median salary.
```sql
SELECT AVG(salary) AS median_salary
FROM (
    SELECT salary, ROW_NUMBER() OVER (ORDER BY salary) AS rn,
           COUNT(*) OVER () AS total
    FROM employees
) sub
WHERE rn IN (FLOOR((total + 1) / 2), CEIL((total + 1) / 2));
```

**Exercise 30:** Create a stored procedure that generates a complete customer report.
```sql
DELIMITER //
CREATE PROCEDURE CustomerReport(IN p_customer_id BIGINT)
BEGIN
    -- Customer info
    SELECT id, name, email, created_at FROM customers WHERE id = p_customer_id;

    -- Order summary
    SELECT COUNT(*) AS total_orders, SUM(total_amount) AS total_spent,
           AVG(total_amount) AS avg_order, MAX(created_at) AS last_order
    FROM orders WHERE customer_id = p_customer_id AND status != 'CANCELLED';

    -- Recent orders
    SELECT id, total_amount, status, created_at
    FROM orders WHERE customer_id = p_customer_id
    ORDER BY created_at DESC LIMIT 10;

    -- Top products purchased
    SELECT p.name, SUM(oi.quantity) AS total_qty, SUM(oi.quantity * oi.unit_price) AS total_spent
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.customer_id = p_customer_id
    GROUP BY p.id, p.name ORDER BY total_spent DESC LIMIT 5;
END //
DELIMITER ;
```

---

*End of Guide*

**Document Version:** 1.0
**Last Updated:** March 2026
**Topics Covered:** 17 Parts, 105 Interview Questions, 30 SQL Exercises
