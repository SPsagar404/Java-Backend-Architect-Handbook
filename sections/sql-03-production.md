
# Part 12: MySQL + Spring Boot Integration

## 12.1 JDBC (Java Database Connectivity)

```java
// Raw JDBC -- low-level, manual connection management
public class JdbcExample {

    public User findById(Long id) throws SQLException {
        String sql = "SELECT id, name, email FROM users WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return new User(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getString("email")
                    );
                }
            }
        }
        return null;
    }
}
// Problems: boilerplate, manual resource management, no caching
```

## 12.2 Spring JdbcTemplate

```java
@Repository
public class UserJdbcRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public User findById(Long id) {
        String sql = "SELECT id, name, email, salary FROM users WHERE id = ?";
        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> new User(
            rs.getLong("id"),
            rs.getString("name"),
            rs.getString("email"),
            rs.getBigDecimal("salary")
        ), id);
    }

    public List<User> findByDepartment(String department) {
        String sql = "SELECT * FROM users WHERE department = ? ORDER BY name";
        return jdbcTemplate.query(sql, (rs, rowNum) -> new User(
            rs.getLong("id"),
            rs.getString("name"),
            rs.getString("email"),
            rs.getBigDecimal("salary")
        ), department);
    }

    public int updateSalary(Long id, BigDecimal newSalary) {
        return jdbcTemplate.update(
            "UPDATE users SET salary = ? WHERE id = ?", newSalary, id);
    }
}
```

## 12.3 Connection Pooling (HikariCP)

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb?useSSL=true&serverTimezone=UTC
    username: app_user
    password: secret
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      idle-timeout: 300000        # 5 min
      connection-timeout: 20000   # 20 sec
      max-lifetime: 1800000       # 30 min
      leak-detection-threshold: 60000  # Detect connection leaks
      pool-name: MyAppPool
```

```
Connection Pool Flow:

Application needs DB connection
        |
        v
+------------------+
| HikariCP Pool    |
| (20 connections) |
+------------------+
  |  Borrow        |  Return
  v                v
+------------------+
| MySQL Server     |
| (max_connections)|
+------------------+

Benefits:
- Reuse connections (creating new ones is expensive: ~100ms)
- Limit total connections to prevent DB overload
- Detect leaked connections
- Auto-validate connections before use
```

## 12.4 Hibernate + Spring Data JPA

```java
// Entity
@Entity
@Table(name = "orders",
       indexes = @Index(name = "idx_customer_status", columnList = "customer_id, status"))
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { createdAt = LocalDateTime.now(); }
}

// Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    @Query("SELECT o FROM Order o WHERE o.status = :status " +
           "AND o.createdAt > :since")
    Page<Order> findRecentByStatus(@Param("status") OrderStatus status,
                                    @Param("since") LocalDateTime since,
                                    Pageable pageable);

    @Modifying @Transactional
    @Query("UPDATE Order o SET o.status = 'CANCELLED' " +
           "WHERE o.status = 'PENDING' AND o.createdAt < :cutoff")
    int cancelStaleOrders(@Param("cutoff") LocalDateTime cutoff);
}
```

## 12.5 Calling Stored Procedures from Spring Boot

```java
@Repository
public class PaymentRepository {

    @PersistenceContext
    private EntityManager em;

    public TransferResult transferFunds(Long fromId, Long toId, BigDecimal amount) {
        StoredProcedureQuery query = em
            .createStoredProcedureQuery("TransferFunds")
            .registerStoredProcedureParameter("from_account_id", Long.class, ParameterMode.IN)
            .registerStoredProcedureParameter("to_account_id", Long.class, ParameterMode.IN)
            .registerStoredProcedureParameter("amount", BigDecimal.class, ParameterMode.IN)
            .registerStoredProcedureParameter("transfer_id", Long.class, ParameterMode.OUT)
            .registerStoredProcedureParameter("status_message", String.class, ParameterMode.OUT)
            .setParameter("from_account_id", fromId)
            .setParameter("to_account_id", toId)
            .setParameter("amount", amount);

        query.execute();

        Long transferId = (Long) query.getOutputParameterValue("transfer_id");
        String status = (String) query.getOutputParameterValue("status_message");

        return new TransferResult(transferId, status);
    }
}
```

---

# Part 13: Stored Procedure Production Examples

## 13.1 Payment Processing

```sql
DELIMITER //
CREATE PROCEDURE ProcessPayment(
    IN p_order_id BIGINT,
    IN p_payment_method VARCHAR(20),
    IN p_card_last_four VARCHAR(4),
    OUT p_payment_id BIGINT,
    OUT p_result VARCHAR(50)
)
BEGIN
    DECLARE v_order_amount DECIMAL(12,2);
    DECLARE v_order_status VARCHAR(20);
    DECLARE v_customer_id BIGINT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'PAYMENT_FAILED';
        SET p_payment_id = -1;
    END;

    START TRANSACTION;

    -- Get order details with exclusive lock
    SELECT total_amount, status, customer_id
    INTO v_order_amount, v_order_status, v_customer_id
    FROM orders WHERE id = p_order_id FOR UPDATE;

    -- Validate order
    IF v_order_status != 'PENDING' THEN
        SET p_result = 'ORDER_NOT_PENDING';
        SET p_payment_id = -1;
        ROLLBACK;
    ELSE
        -- Create payment record
        INSERT INTO payments (order_id, customer_id, amount, payment_method,
                              card_last_four, status, created_at)
        VALUES (p_order_id, v_customer_id, v_order_amount, p_payment_method,
                p_card_last_four, 'SUCCESS', NOW());

        SET p_payment_id = LAST_INSERT_ID();

        -- Update order status
        UPDATE orders SET status = 'CONFIRMED', updated_at = NOW()
        WHERE id = p_order_id;

        -- Create transaction log
        INSERT INTO transaction_log (payment_id, action, amount, created_at)
        VALUES (p_payment_id, 'CHARGE', v_order_amount, NOW());

        SET p_result = 'SUCCESS';
        COMMIT;
    END IF;
END //
DELIMITER ;
```

## 13.2 Eligibility Calculation (Government System)

```sql
DELIMITER //
CREATE PROCEDURE CheckEligibility(
    IN p_applicant_id BIGINT,
    OUT p_eligible BOOLEAN,
    OUT p_reason VARCHAR(200),
    OUT p_benefit_amount DECIMAL(10,2)
)
BEGIN
    DECLARE v_age INT;
    DECLARE v_income DECIMAL(12,2);
    DECLARE v_household_size INT;
    DECLARE v_state VARCHAR(2);
    DECLARE v_existing_benefits INT;
    DECLARE v_fpl DECIMAL(12,2);

    -- Get applicant info
    SELECT
        TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()),
        annual_income,
        household_size,
        state_code
    INTO v_age, v_income, v_household_size, v_state
    FROM applicants
    WHERE id = p_applicant_id;

    -- Check for existing active benefits
    SELECT COUNT(*) INTO v_existing_benefits
    FROM benefits
    WHERE applicant_id = p_applicant_id AND status = 'ACTIVE';

    -- Get Federal Poverty Level for household size
    SELECT income_threshold INTO v_fpl
    FROM poverty_levels
    WHERE household_size = LEAST(v_household_size, 8)
      AND effective_year = YEAR(CURDATE());

    -- Eligibility rules
    SET p_eligible = FALSE;
    SET p_benefit_amount = 0;

    IF v_existing_benefits > 0 THEN
        SET p_reason = 'Already receiving benefits';
    ELSEIF v_age < 18 THEN
        SET p_reason = 'Applicant must be 18 or older';
    ELSEIF v_income > (v_fpl * 1.38) THEN
        SET p_reason = 'Income exceeds 138% of Federal Poverty Level';
    ELSE
        SET p_eligible = TRUE;
        SET p_reason = 'Eligible';

        -- Calculate benefit amount based on income bracket
        IF v_income <= (v_fpl * 0.5) THEN
            SET p_benefit_amount = 500.00 * v_household_size;
        ELSEIF v_income <= v_fpl THEN
            SET p_benefit_amount = 350.00 * v_household_size;
        ELSE
            SET p_benefit_amount = 200.00 * v_household_size;
        END IF;

        -- Log eligibility determination
        INSERT INTO eligibility_log
            (applicant_id, eligible, reason, benefit_amount, determined_at)
        VALUES
            (p_applicant_id, p_eligible, p_reason, p_benefit_amount, NOW());
    END IF;
END //
DELIMITER ;
```

## 13.3 Report Generation

```sql
DELIMITER //
CREATE PROCEDURE GenerateSalesReport(
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    -- Summary
    SELECT
        COUNT(DISTINCT o.id) AS total_orders,
        COUNT(DISTINCT o.customer_id) AS unique_customers,
        SUM(o.total_amount) AS total_revenue,
        AVG(o.total_amount) AS avg_order_value,
        MAX(o.total_amount) AS largest_order
    FROM orders o
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
      AND o.status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED');

    -- Daily breakdown
    SELECT
        DATE(o.created_at) AS order_date,
        COUNT(*) AS orders,
        SUM(o.total_amount) AS revenue
    FROM orders o
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
      AND o.status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')
    GROUP BY DATE(o.created_at)
    ORDER BY order_date;

    -- Top products
    SELECT
        p.name,
        p.category,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.line_total) AS revenue,
        RANK() OVER (ORDER BY SUM(oi.line_total) DESC) AS revenue_rank
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY p.id, p.name, p.category
    ORDER BY revenue DESC
    LIMIT 20;

    -- Category performance
    SELECT
        p.category,
        COUNT(DISTINCT o.id) AS orders,
        SUM(oi.quantity) AS units,
        SUM(oi.line_total) AS revenue,
        ROUND(SUM(oi.line_total) / (SELECT SUM(total_amount) FROM orders
            WHERE created_at BETWEEN p_start_date AND p_end_date) * 100, 2) AS pct_of_total
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY p.category
    ORDER BY revenue DESC;
END //
DELIMITER ;
```

## 13.4 Batch Data Processing

```sql
DELIMITER //
CREATE PROCEDURE BatchDeactivateInactiveUsers(
    IN p_inactive_days INT,
    OUT p_count INT
)
BEGIN
    DECLARE v_batch_size INT DEFAULT 1000;
    DECLARE v_affected INT DEFAULT 1;

    SET p_count = 0;

    -- Process in batches to avoid long-running locks
    WHILE v_affected > 0 DO
        UPDATE users
        SET status = 'INACTIVE', updated_at = NOW()
        WHERE status = 'ACTIVE'
          AND last_login_at < DATE_SUB(NOW(), INTERVAL p_inactive_days DAY)
        LIMIT v_batch_size;

        SET v_affected = ROW_COUNT();
        SET p_count = p_count + v_affected;

        -- Small delay to let other transactions proceed
        IF v_affected > 0 THEN
            DO SLEEP(0.1);
        END IF;
    END WHILE;
END //
DELIMITER ;
```

---

# Part 14: Database Performance Tuning

## 14.1 Query Tuning Checklist

| Step | Action |
|---|---|
| 1 | Run EXPLAIN on slow queries |
| 2 | Check if indexes exist for WHERE/JOIN columns |
| 3 | Look for full table scans (type: ALL) |
| 4 | Check for "Using filesort" and "Using temporary" |
| 5 | Verify selectivity of existing indexes |
| 6 | Consider covering indexes |
| 7 | Rewrite correlated subqueries as JOINs |
| 8 | Use LIMIT for large result sets |
| 9 | Avoid SELECT * |
| 10 | Check slow query log |

## 14.2 Index Tuning

```sql
-- Find unused indexes
SELECT
    s.TABLE_NAME, s.INDEX_NAME,
    s.SEQ_IN_INDEX, s.COLUMN_NAME,
    t.TABLE_ROWS
FROM information_schema.STATISTICS s
JOIN information_schema.TABLES t
    ON s.TABLE_SCHEMA = t.TABLE_SCHEMA AND s.TABLE_NAME = t.TABLE_NAME
WHERE s.TABLE_SCHEMA = 'mydb'
ORDER BY t.TABLE_ROWS DESC;

-- Find missing indexes (queries with full table scans)
-- Enable slow query log:
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- Log queries taking > 1 second
SET GLOBAL log_queries_not_using_indexes = 'ON';
```

## 14.3 Database Partitioning

```sql
-- Range partitioning by date (for large tables like orders)
CREATE TABLE orders_partitioned (
    id BIGINT AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    total_amount DECIMAL(12,2),
    status VARCHAR(20),
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- Benefits:
-- Query for 2024 data only scans partition p2024
-- Old data can be dropped by dropping a single partition
-- Each partition has its own indexes
```

## 14.4 Read Replicas

```
Write traffic:
  Application -> Primary MySQL (writes)

Read traffic:
  Application -> Read Replica 1 (reads)
              -> Read Replica 2 (reads)

Primary MySQL --> Replication --> Replica 1
              --> Replication --> Replica 2

Spring Boot config:
  @Transactional(readOnly = true)  -> Routes to read replica
  @Transactional                    -> Routes to primary
```

```java
// Routing DataSource
public class ReadWriteRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
            ? "read" : "write";
    }
}
```

## 14.5 Server Configuration Tuning

```ini
# my.cnf (MySQL configuration)
[mysqld]
# InnoDB Buffer Pool (allocate 70-80% of server RAM)
innodb_buffer_pool_size = 8G

# Log file size (for crash recovery)
innodb_log_file_size = 512M

# Max connections
max_connections = 200

# Thread cache
thread_cache_size = 50

# Query cache (disabled in MySQL 8.0+)
# query_cache_type = 0

# Slow query log
slow_query_log = 1
long_query_time = 2
log_queries_not_using_indexes = 1

# Temp table size
tmp_table_size = 256M
max_heap_table_size = 256M

# Sort buffer
sort_buffer_size = 4M
join_buffer_size = 4M
```

---

# Part 15: Common Production Issues

## 15.1 Deadlocks

**Symptoms:** Application throws `com.mysql.cj.jdbc.exceptions.MySQLTransactionRollbackException: Deadlock found`

**Detection:**
```sql
SHOW ENGINE INNODB STATUS;  -- Shows last deadlock info
-- Look for "LATEST DETECTED DEADLOCK" section
```

**Prevention:**
```sql
-- 1. Always access rows in the same order
-- BAD:
-- T1: UPDATE accounts WHERE id = 1; UPDATE accounts WHERE id = 2;
-- T2: UPDATE accounts WHERE id = 2; UPDATE accounts WHERE id = 1;

-- GOOD:
-- Both transactions lock in id order:
-- T1: UPDATE accounts WHERE id = 1; UPDATE accounts WHERE id = 2;
-- T2: UPDATE accounts WHERE id = 1; UPDATE accounts WHERE id = 2;

-- 2. Keep transactions short
-- 3. Use SELECT ... FOR UPDATE only when necessary
-- 4. Add proper indexes to reduce lock scope
```

## 15.2 Lock Contention

**Symptoms:** High wait times, slow queries, connection pool exhaustion.

```sql
-- Find blocking transactions
SELECT
    r.trx_id AS waiting_trx_id,
    r.trx_mysql_thread_id AS waiting_thread,
    r.trx_query AS waiting_query,
    b.trx_id AS blocking_trx_id,
    b.trx_mysql_thread_id AS blocking_thread,
    b.trx_query AS blocking_query
FROM information_schema.INNODB_LOCK_WAITS w
INNER JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id
INNER JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id;

-- Kill blocking transaction if necessary
KILL <blocking_thread_id>;
```

## 15.3 Slow Queries

**Detection:**
```sql
-- Check currently running queries
SHOW PROCESSLIST;

-- From slow query log
SELECT * FROM mysql.slow_log
ORDER BY query_time DESC LIMIT 10;

-- Performance Schema (MySQL 8.0+)
SELECT
    DIGEST_TEXT,
    COUNT_STAR AS exec_count,
    ROUND(SUM_TIMER_WAIT / 1000000000000, 2) AS total_time_sec,
    ROUND(AVG_TIMER_WAIT / 1000000000000, 2) AS avg_time_sec,
    SUM_ROWS_EXAMINED AS rows_examined
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 10;
```

**Common fixes:**
1. Add indexes on filtered/joined columns
2. Rewrite subqueries as JOINs
3. Use pagination instead of loading all rows
4. Add covering indexes
5. Optimize GROUP BY with indexes

## 15.4 High CPU Usage

**Causes:** Full table scans, missing indexes, complex queries, too many concurrent connections.

```sql
-- Find resource-intensive queries
SELECT * FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC LIMIT 5;

-- Check table scan ratio
SHOW GLOBAL STATUS LIKE 'Handler_read%';
-- Handler_read_rnd_next should be low relative to Handler_read_key
```

## 15.5 Connection Leaks

**Symptoms:** "Too many connections" errors, pool exhaustion.

```sql
-- Check current connections
SHOW GLOBAL STATUS LIKE 'Threads_connected';
SHOW GLOBAL STATUS LIKE 'Max_used_connections';
SHOW PROCESSLIST;  -- See all active connections
```

**Prevention:**
```yaml
# HikariCP leak detection
spring:
  datasource:
    hikari:
      leak-detection-threshold: 30000  # Warn if connection held > 30 sec
```

```java
// Always use try-with-resources or @Transactional
// BAD: Connection never returned to pool
Connection conn = dataSource.getConnection();
// ... use conn but forget to close

// GOOD:
try (Connection conn = dataSource.getConnection()) {
    // Auto-closed when block exits
}

// BEST: Let Spring manage connections
@Transactional
public void processData() {
    // Spring handles connection lifecycle
}
```

## 15.6 Troubleshooting Checklist

| Issue | Command | Look For |
|---|---|---|
| Slow queries | `EXPLAIN` | type: ALL, Using filesort |
| Deadlocks | `SHOW ENGINE INNODB STATUS` | LATEST DETECTED DEADLOCK |
| Locks | `SHOW PROCESSLIST` | State: Locked, Waiting |
| Connections | `SHOW GLOBAL STATUS LIKE 'Threads%'` | Max exceeded |
| Memory | `SHOW VARIABLES LIKE 'innodb_buffer_pool_size'` | Pool too small |
| Replication lag | `SHOW SLAVE STATUS` | Seconds_Behind_Master |

---
