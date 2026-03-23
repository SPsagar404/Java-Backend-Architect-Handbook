
# Part 9: Transaction Management

### What is Transaction Management in Spring?
Spring's `@Transactional` annotation provides **declarative transaction management** — you annotate a method, and Spring automatically wraps it in a database transaction. No manual `begin/commit/rollback` code needed.

### Why @Transactional Over Manual Transactions
| Manual Transaction | @Transactional |
|---|---|
| 10+ lines of try/catch/finally | Single annotation |
| Easy to forget rollback | Automatic rollback on exceptions |
| Scattered across codebase | Clean separation of concerns |
| Hard to test | Mockable, testable |

### Step-by-Step: How @Transactional Works Internally
```
1. Spring creates a proxy around the @Service class
2. When a @Transactional method is called:
   a. Proxy intercepts the call
   b. Opens a new transaction (or joins existing)
   c. Calls the actual method
   d. If method succeeds → COMMIT
   e. If RuntimeException is thrown → ROLLBACK
   f. If checked exception is thrown → COMMIT (by default!)
```

> **Critical Gotcha:** @Transactional does NOT work on `private` methods or when calling a @Transactional method from within the **same class** (self-invocation bypasses the proxy).

### Deep Theory: Checked vs Unchecked Exception Rollback

This catches even experienced developers off guard:

```java
// RuntimeException (unchecked) -> ROLLS BACK (expected)
@Transactional
public void method1() {
    userRepository.save(user);
    throw new RuntimeException("Error!"); // Transaction ROLLED BACK
}

// Checked Exception -> COMMITS! (unexpected!)
@Transactional
public void method2() throws IOException {
    userRepository.save(user);
    throw new IOException("Error!"); // Transaction COMMITTED! User is saved!
}

// Fix: Explicitly rollback for checked exceptions
@Transactional(rollbackFor = Exception.class) // Rolls back for ANY exception
public void method3() throws IOException {
    userRepository.save(user);
    throw new IOException("Error!"); // Now ROLLED BACK correctly
}
```

**Best Practice:** Always use `@Transactional(rollbackFor = Exception.class)` in production code.

## 9.1 ACID Properties

| Property | Meaning | Example |
|---|---|---|
| **Atomicity** | All or nothing -- entire transaction succeeds or rolls back | Transfer $100: debit AND credit must both succeed |
| **Consistency** | Database moves from one valid state to another | Balance never goes negative if constraint exists |
| **Isolation** | Concurrent transactions don't interfere | Two users buying last item -- only one succeeds |
| **Durability** | Committed data survives crashes | After commit, data persists even if server restarts |

### Real-World ACID Scenario: Banking Transfer

```java
@Transactional(rollbackFor = Exception.class)
public void transfer(Long fromId, Long toId, BigDecimal amount) {
    Account from = accountRepo.findById(fromId)
        .orElseThrow(() -> new AccountNotFoundException(fromId));
    Account to = accountRepo.findById(toId)
        .orElseThrow(() -> new AccountNotFoundException(toId));
    
    from.debit(amount);   // Atomicity: if this succeeds but credit fails...
    to.credit(amount);    // ...both are rolled back (all or nothing)
    // Isolation: concurrent transfer uses @Version (optimistic lock)
    // Durability: once committed, even a server crash won't lose the data
}
```

## 9.2 Spring @Transactional

### When to Use @Transactional
- **Service layer methods** that modify data (INSERT, UPDATE, DELETE)
- **Multi-step operations** where all steps must succeed or fail together
- Methods that read data and need **snapshot consistency** (`readOnly = true`)

### When NOT to Use @Transactional
- **Controller methods** -- transactions should be scoped at the service layer
- **Very long-running operations** -- holding a transaction for minutes blocks database resources
- **External API calls** within a transaction -- the API call cannot be rolled back

### Production Anti-Pattern: Calling External APIs Inside a Transaction

```java
// BAD: External API call inside transaction
@Transactional
public void processOrder(OrderRequest req) {
    Order order = orderRepo.save(new Order(req));
    paymentGateway.charge(req.getPaymentInfo()); // Takes 2-5 seconds!
    // Transaction holds DB connection for 5+ seconds -> connection pool exhaustion!
}

// GOOD: Separate transaction from external call
public void processOrder(OrderRequest req) {
    Order order = createOrder(req);              // @Transactional (fast)
    PaymentResult result = paymentGateway.charge(req); // No transaction
    updateOrderPayment(order.getId(), result);   // @Transactional (fast)
}
```

```java
@Service
public class OrderService {

    @Transactional // Wraps method in a database transaction
    public Order placeOrder(OrderRequest request) {
        // 1. Validate inventory
        Product product = productRepository.findById(request.getProductId())
            .orElseThrow(() -> new ProductNotFoundException(request.getProductId()));

        if (product.getStock() < request.getQuantity()) {
            throw new InsufficientStockException();
        }

        // 2. Reduce stock
        product.setStock(product.getStock() - request.getQuantity());

        // 3. Create order
        Order order = new Order();
        order.setProduct(product);
        order.setQuantity(request.getQuantity());
        order.setTotalPrice(product.getPrice()
            .multiply(BigDecimal.valueOf(request.getQuantity())));

        // 4. Save and return
        return orderRepository.save(order);
        // If ANY step throws an exception, ALL changes are rolled back
    }
}
```

## 9.3 Transaction Propagation

### What is Transaction Propagation?
Propagation defines what happens when a @Transactional method calls another @Transactional method. Should they share the same transaction? Create a new one? Throw an error?

### Why This Matters in Production
Consider: An order placement method calls an audit logging method. If the order fails and rolls back, should the audit log also roll back? Usually NO — you want the audit log to persist. This is where `REQUIRES_NEW` propagation saves you.

| Propagation | Behavior | Use Case |
|---|---|---|
| `REQUIRED` (default) | Join existing or create new | Most service methods |
| `REQUIRES_NEW` | Always create new (suspend existing) | Audit logging that must persist even if parent fails |
| `SUPPORTS` | Join existing or run non-transactional | Read-only queries |
| `NOT_SUPPORTED` | Suspend existing, run non-transactional | Non-critical operations |
| `MANDATORY` | Must have existing, throw if none | Methods that should never be called directly |
| `NEVER` | Throw if transaction exists | Methods that must not run in a transaction |
| `NESTED` | Create savepoint within existing | Partial rollbacks |

### Deep Dive: REQUIRES_NEW vs NESTED

```java
// REQUIRES_NEW: Completely separate transaction
// If inner fails, outer can still commit
@Transactional
public void placeOrder(OrderRequest req) {
    Order order = orderRepo.save(new Order(req));
    try {
        notificationService.sendEmail(order); // REQUIRES_NEW
    } catch (Exception e) {
        log.error("Email failed, but order is still saved");
    }
}

// NESTED: Savepoint within SAME transaction
// If nested rolls back, outer can continue
// But if outer rolls back, ALL nested changes also roll back
@Transactional
public void importBatch(List<Record> records) {
    for (Record r : records) {
        try {
            processRecord(r); // NESTED: savepoint per record
        } catch (Exception e) {
            log.error("Record {} failed, skipping", r.getId());
        }
    }
}
```

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void logAuditEvent(String action, String details) {
    // This runs in its OWN transaction
    // Even if the calling method rolls back, audit log is preserved
    AuditLog log = new AuditLog(action, details, Instant.now());
    auditRepository.save(log);
}
```

## 9.4 Isolation Levels

### Deep Theory: What Each Isolation Problem Looks Like

**Dirty Read:** Transaction A reads uncommitted data from Transaction B. If B rolls back, A has read data that never existed.

**Non-Repeatable Read:** Transaction A reads a row, Transaction B modifies it and commits. A reads again and gets different values.

**Phantom Read:** Transaction A counts rows matching a condition. Transaction B inserts a new matching row. A counts again and gets a different count.

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Performance |
|---|---|---|---|---|
| **READ_UNCOMMITTED** | Yes | Yes | Yes | Fastest |
| **READ_COMMITTED** | No | Yes | Yes | Good (PostgreSQL default) |
| **REPEATABLE_READ** | No | No | Yes | Medium (MySQL default) |
| **SERIALIZABLE** | No | No | No | Slowest |

```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public BigDecimal getAccountBalance(Long accountId) { ... }
```

**Production Rule:** Use your database's default isolation level unless you have a specific reason to change. Use `@Version` (optimistic locking) instead of SERIALIZABLE for concurrency control.

## 9.5 Read-Only Transactions

```java
@Transactional(readOnly = true) // Performance optimization
public List<User> getAllActiveUsers() {
    return userRepository.findByStatus(UserStatus.ACTIVE);
    // Hibernate skips dirty checking -- faster!
    // Spring may route to read replica if configured
}
```

### Deep Theory: Three Benefits of readOnly = true

1. **Hibernate optimization:** Skips dirty checking entirely (no entity snapshots stored, no field-by-field comparison at flush)
2. **Database optimization:** Some databases optimize read-only connections (PostgreSQL can avoid WAL overhead)
3. **Read replica routing:** Spring can route readOnly transactions to a database read replica using `AbstractRoutingDataSource`, reducing load on the primary

### Interview Questions for Part 9

**Q: Why does @Transactional NOT rollback on checked exceptions by default?**
A: By Spring design, checked exceptions are considered "recoverable" and don't trigger rollback. Use `@Transactional(rollbackFor = Exception.class)` to override.

**Q: What happens if you call a @Transactional method from within the same class?**
A: The proxy is bypassed (self-invocation), so the second method runs without its own transaction. Fix: inject the bean into itself or extract to a separate service.

**Q: When would you use REQUIRES_NEW propagation?**
A: For operations that must succeed independently, such as audit logging, notification tracking, or metrics. Even if the business operation rolls back, the audit log persists.

---

# Part 10: Spring Data JPA Introduction

## 10.1 What is Spring Data JPA?

**Spring Data JPA** is an abstraction layer on top of JPA/Hibernate that eliminates boilerplate repository code. You define an interface, and Spring generates the implementation at runtime.

### Why Spring Data JPA Exists
Without Spring Data JPA, every entity requires a repository class with 5+ methods of repetitive code (find, save, delete, update, count). Spring Data JPA generates these implementations **automatically** from just an interface declaration.

### Design Patterns Used
| Pattern | Where Used |
|---|---|
| **Repository Pattern** | Each interface represents a data access object for one entity |
| **Proxy Pattern** | Spring creates a runtime proxy implementing the interface |
| **Template Method** | `SimpleJpaRepository` provides default implementations |
| **Strategy Pattern** | Query derivation strategies (method name, @Query, native) |

```java
// WITHOUT Spring Data JPA -- manual repository
@Repository
public class UserRepositoryImpl {

    @PersistenceContext
    private EntityManager em;

    public User findById(Long id) {
        return em.find(User.class, id);
    }

    public List<User> findByStatus(UserStatus status) {
        return em.createQuery(
            "SELECT u FROM User u WHERE u.status = :status", User.class)
            .setParameter("status", status)
            .getResultList();
    }

    public User save(User user) {
        if (user.getId() == null) {
            em.persist(user);
            return user;
        }
        return em.merge(user);
    }

    public void delete(User user) {
        em.remove(em.contains(user) ? user : em.merge(user));
    }

    public List<User> findAll() {
        return em.createQuery("SELECT u FROM User u", User.class)
            .getResultList();
    }
}

// WITH Spring Data JPA -- just an interface!
public interface UserRepository extends JpaRepository<User, Long> {
    List<User> findByStatus(UserStatus status);
    // That's it! Spring generates everything else automatically.
}
```

## 10.2 How Spring Data JPA Works

1. You define an interface extending `JpaRepository`
2. Spring Boot scans for repository interfaces at startup
3. Spring Data creates a **proxy** implementation at runtime
4. The proxy delegates to `SimpleJpaRepository` (default implementation)
5. `SimpleJpaRepository` uses `EntityManager` internally

### Deep Dive: What SimpleJpaRepository Does Internally

```java
// This is what Spring generates FOR YOU:
public class SimpleJpaRepository<T, ID> implements JpaRepository<T, ID> {
    
    private final EntityManager em;
    
    @Transactional
    public <S extends T> S save(S entity) {
        if (isNew(entity)) {
            em.persist(entity);   // New entity -> INSERT
            return entity;
        } else {
            return em.merge(entity); // Existing entity -> UPDATE
        }
    }
    
    // isNew() checks: is entity.getId() == null?
    // If yes -> persist(). If no -> merge().
    // This is why @GeneratedValue matters!
}
```

**Production Gotcha -- save() on Entity with Preset ID:**
If you set the ID manually before calling `save()`, Spring thinks the entity already exists and calls `merge()` instead of `persist()`. This triggers a SELECT to check if the entity exists, then an INSERT -- resulting in 2 queries instead of 1. Fix: implement `Persistable<ID>` interface.

### Interview Questions for Part 10

**Q: How does Spring Data JPA decide whether to call persist() or merge() in save()?**
A: It checks `isNew()` which by default checks if the entity's `@Id` field is null. Null ID means new entity -> persist(). Non-null ID means existing -> merge(). Override this by implementing `Persistable<ID>`.

---

# Part 11: Spring Data JPA Architecture

## 11.1 Architecture Diagram

```
+---------------------------------------------------------------+
|                      Spring Boot Application                   |
|                                                                |
|  +------------------+                                          |
|  |   Controller     |  @RestController                         |
|  |   (REST API)     |  Handles HTTP requests                   |
|  +--------+---------+                                          |
|           |                                                    |
|           v                                                    |
|  +------------------+                                          |
|  |    Service        |  @Service @Transactional                |
|  |   (Business       |  Business logic and                     |
|  |    Logic)         |  transaction boundaries                 |
|  +--------+---------+                                          |
|           |                                                    |
|           v                                                    |
|  +------------------+                                          |
|  |   Repository     |  JpaRepository interface                 |
|  |   (Data Access)  |  Auto-generated implementation           |
|  +--------+---------+                                          |
|           |                                                    |
|           v                                                    |
|  +------------------+                                          |
|  | SimpleJpaRepo    |  Spring Data's default implementation    |
|  | (Generated Proxy)|  Uses EntityManager internally           |
|  +--------+---------+                                          |
|           |                                                    |
|           v                                                    |
|  +------------------+  +-------------------+                   |
|  | EntityManager    |  | Hibernate Session |                   |
|  | (JPA Standard)   |  | (Implementation)  |                   |
|  +--------+---------+  +-------------------+                   |
|           |                                                    |
|           v                                                    |
|  +------------------+                                          |
|  |   JDBC / HikariCP|  Connection pooling                     |
|  +--------+---------+                                          |
|           |                                                    |
|           v                                                    |
|  +------------------+                                          |
|  |   Database       |  PostgreSQL, MySQL, Oracle               |
|  +------------------+                                          |
+---------------------------------------------------------------+
```

## 11.2 The Stack

| Layer | Technology | Role |
|---|---|---|
| API | Spring MVC / WebFlux | REST endpoints |
| Service | Spring @Service | Business logic, transactions |
| Repository | Spring Data JPA | Data access abstraction |
| ORM | Hibernate 6 | Object-relational mapping |
| Connection Pool | HikariCP | JDBC connection management |
| Database | PostgreSQL/MySQL | Data storage |

### Deep Dive: Request Lifecycle Through the Stack

```
GET /api/users/1
  |
  v
Controller: userService.getUser(1)
  |
  v
Spring AOP Proxy intercepts @Transactional
  -> Obtains Connection from HikariCP pool
  -> Sets autocommit = false
  -> Binds Connection to ThreadLocal
  |
  v
Service calls userRepository.findById(1)
  |
  v
Spring Data proxy delegates to SimpleJpaRepository.findById()
  -> Calls entityManager.find(User.class, 1)
  |
  v
Hibernate checks 1st level cache (Persistence Context)
  -> Cache MISS -> generates SQL via Dialect
  -> SELECT u.* FROM users u WHERE u.id = ?
  |
  v
JDBC PreparedStatement executes on physical Connection
  -> ResultSet returned
  -> Hibernate maps to User entity
  -> Stores in Persistence Context (1st level cache)
  |
  v
Service returns UserDTO
  -> AOP Proxy calls Connection.commit()
  -> Connection returned to HikariCP pool
  |
  v
Controller returns ResponseEntity<UserDTO> as JSON
```

---

# Part 12: Spring Data JPA Repositories

## 12.1 Repository Hierarchy

```
Repository (Marker interface)
    |
CrudRepository (CRUD operations)
    |
ListCrudRepository (List-returning CRUD)
    |
PagingAndSortingRepository (+ Pagination, Sorting)
    |
JpaRepository (+ JPA-specific: flush, batch, example queries)
```

## 12.2 CrudRepository

```java
// Provides basic CRUD
public interface CrudRepository<T, ID> extends Repository<T, ID> {
    <S extends T> S save(S entity);
    Optional<T> findById(ID id);
    boolean existsById(ID id);
    Iterable<T> findAll();
    long count();
    void deleteById(ID id);
    void delete(T entity);
}
```

## 12.3 JpaRepository (Recommended)

```java
// Extends CrudRepository + adds JPA features
public interface JpaRepository<T, ID> extends
        ListCrudRepository<T, ID>,
        ListPagingAndSortingRepository<T, ID>,
        QueryByExampleExecutor<T> {

    void flush();
    <S extends T> S saveAndFlush(S entity);
    void deleteAllInBatch();
    List<T> findAll(Sort sort);
    Page<T> findAll(Pageable pageable);
}

// Usage:
public interface ProductRepository extends JpaRepository<Product, Long> {
    // Inherits: save, findById, findAll, count, delete,
    //           flush, saveAndFlush, pagination, sorting, etc.
}
```

## 12.4 When to Use Which

| Repository | Use When |
|---|---|
| `CrudRepository` | Simple CRUD, no pagination needed |
| `PagingAndSortingRepository` | Need pagination but no JPA features |
| `JpaRepository` | Default choice for Spring Boot apps |

### Interview Questions for Part 12

**Q: What is the difference between CrudRepository and JpaRepository?**
A: JpaRepository extends CrudRepository and adds JPA-specific methods: `flush()`, `saveAndFlush()`, `deleteAllInBatch()`, and full pagination support. Always use JpaRepository in Spring Boot.

**Q: Why does deleteAllInBatch() exist alongside deleteAll()?**
A: `deleteAll()` loads all entities first, then deletes each one individually (N queries). `deleteAllInBatch()` executes a single `DELETE FROM table` SQL (1 query). For large tables, batch is orders of magnitude faster.

---

# Part 13: Query Methods in Spring Data JPA

### Three Ways to Define Queries in Spring Data JPA
Spring Data JPA provides three strategies for creating queries, from simplest to most powerful:

| Strategy | When to Use | Example |
|---|---|---|
| **Derived query (method name)** | Simple conditions (1-3 fields) | `findByName(String name)` |
| **@Query (JPQL)** | Complex queries, joins, aggregations | `@Query("SELECT u FROM User u WHERE...")` |
| **Native query** | Database-specific features, complex analytics | `@Query(value = "SELECT...", nativeQuery = true)` |

> **Rule of Thumb:** Start with derived queries. Move to @Query when method names become unreadable (more than 3 conditions). Use native queries only when you need database-specific syntax.

### Deep Theory: How Spring Data Derives Queries From Method Names

At startup, Spring Data parses each method name into tokens:

```
findByStatusAndRoleOrderByNameAsc
  |       |     |      |      |
  v       v     v      v      v
 find   Status  And   Role   OrderBy Name Asc
  |       |           |      |
  v       v           v      v
SELECT  WHERE status= AND role=  ORDER BY name ASC

Generated JPQL:
SELECT u FROM User u WHERE u.status = ?1 AND u.role = ?2 ORDER BY u.name ASC
```

**If Spring Data cannot parse the method name, the application fails to start** (fail-fast). This is actually a feature -- it catches query typos at startup rather than at runtime.

## 13.1 Method Name Query Derivation

### How It Works
Spring Data parses method names and generates JPQL automatically. The method name IS the query — Spring breaks it into parts:

```java
public interface UserRepository extends JpaRepository<User, Long> {

    // SELECT u FROM User u WHERE u.name = ?1
    List<User> findByName(String name);

    // SELECT u FROM User u WHERE u.email = ?1
    Optional<User> findByEmail(String email);

    // SELECT u FROM User u WHERE u.status = ?1 AND u.role = ?2
    List<User> findByStatusAndRole(UserStatus status, Role role);

    // SELECT u FROM User u WHERE u.name LIKE %?1%
    List<User> findByNameContaining(String keyword);

    // SELECT u FROM User u WHERE u.age BETWEEN ?1 AND ?2
    List<User> findByAgeBetween(int min, int max);

    // SELECT u FROM User u WHERE u.status IN ?1
    List<User> findByStatusIn(Collection<UserStatus> statuses);

    // SELECT u FROM User u WHERE u.deletedAt IS NULL
    List<User> findByDeletedAtIsNull();

    // SELECT u FROM User u ORDER BY u.createdAt DESC
    List<User> findAllByOrderByCreatedAtDesc();

    // COUNT
    long countByStatus(UserStatus status);

    // EXISTS
    boolean existsByEmail(String email);

    // DELETE
    void deleteByStatus(UserStatus status);

    // LIMIT
    List<User> findTop10ByOrderByCreatedAtDesc();
    Optional<User> findFirstByOrderByCreatedAtDesc();
}
```

## 13.2 Query Keywords Reference

| Keyword | SQL Equivalent | Example |
|---|---|---|
| `And` | AND | `findByNameAndEmail` |
| `Or` | OR | `findByNameOrEmail` |
| `Between` | BETWEEN | `findByAgeBetween` |
| `LessThan` | < | `findByAgeLessThan` |
| `GreaterThan` | > | `findByAgeGreaterThan` |
| `Like` | LIKE | `findByNameLike` |
| `Containing` | LIKE %...% | `findByNameContaining` |
| `StartingWith` | LIKE ...% | `findByNameStartingWith` |
| `In` | IN (...) | `findByStatusIn` |
| `IsNull` | IS NULL | `findByDeletedAtIsNull` |
| `IsNotNull` | IS NOT NULL | `findByEmailIsNotNull` |
| `OrderBy` | ORDER BY | `findByStatusOrderByNameAsc` |
| `Not` | <> | `findByStatusNot` |
| `True` / `False` | = true/false | `findByActiveTrue` |

---

# Part 14: Custom Queries

### Deep Theory: Why @Query Exists

Derived query methods work great for 1-3 conditions. But when you need JOINs, GROUP BY, subqueries, or when the method name becomes `findByStatusAndRoleAndDepartmentAndSalaryGreaterThanAndCreatedAtAfter`, it's time for `@Query`. The query is validated at startup -- if you have a JPQL syntax error, the application fails to start.

## 14.1 @Query with JPQL

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    // JPQL -- uses entity names, not table names
    @Query("SELECT o FROM Order o WHERE o.customer.id = :customerId " +
           "AND o.status = :status ORDER BY o.createdAt DESC")
    List<Order> findCustomerOrdersByStatus(
        @Param("customerId") Long customerId,
        @Param("status") OrderStatus status);

    // Projection -- return DTO instead of entity
    @Query("SELECT NEW com.app.dto.OrderSummary(o.id, o.totalAmount, " +
           "o.status, o.createdAt) FROM Order o " +
           "WHERE o.customer.id = :customerId")
    List<OrderSummary> findOrderSummaries(@Param("customerId") Long customerId);

    // Aggregation
    @Query("SELECT o.status, COUNT(o), SUM(o.totalAmount) " +
           "FROM Order o GROUP BY o.status")
    List<Object[]> getOrderStatistics();

    // Update query
    @Modifying
    @Transactional
    @Query("UPDATE Order o SET o.status = :newStatus " +
           "WHERE o.status = :oldStatus AND o.createdAt < :cutoff")
    int bulkUpdateStatus(@Param("oldStatus") OrderStatus oldStatus,
                         @Param("newStatus") OrderStatus newStatus,
                         @Param("cutoff") LocalDateTime cutoff);
}
```

### Production Warning: @Modifying Requires clearAutomatically

When you use `@Modifying` with `@Query` for UPDATE/DELETE, the persistence context is NOT automatically cleared. Entities loaded before the bulk operation still show old values!

```java
@Modifying(clearAutomatically = true) // CRITICAL: clear stale cache
@Transactional
@Query("UPDATE Order o SET o.status = :newStatus WHERE ...")
int bulkUpdateStatus(...);
```

## 14.2 Native Queries

```java
// When you need database-specific features
@Query(value = "SELECT * FROM orders WHERE total_amount > :min " +
               "ORDER BY created_at DESC LIMIT :limit",
       nativeQuery = true)
List<Order> findExpensiveRecentOrders(@Param("min") BigDecimal min,
                                      @Param("limit") int limit);

// Complex analytics
@Query(value = """
    SELECT DATE(o.created_at) as order_date,
           COUNT(*) as total_orders,
           SUM(o.total_amount) as revenue
    FROM orders o
    WHERE o.created_at >= :startDate
    GROUP BY DATE(o.created_at)
    ORDER BY order_date
    """, nativeQuery = true)
List<Object[]> getDailyRevenue(@Param("startDate") LocalDate startDate);
```

---

# Part 15: Pagination and Sorting

### Deep Theory: Why Pagination is Non-Negotiable in Production

Without pagination, `findAll()` on a table with 1 million rows loads ALL rows into memory -> OutOfMemoryError, or at minimum, a 30-second response time. Every list endpoint in production MUST be paginated.

**Pagination generates TWO SQL queries:**
1. `SELECT ... LIMIT 20 OFFSET 40` (fetch the page data)
2. `SELECT COUNT(*) FROM ...` (total count for pagination metadata)

The COUNT query can be expensive on large tables. For infinite-scroll UIs, use `Slice<T>` instead of `Page<T>` to skip the count query.

## 15.1 Pageable

```java
// Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Page<Product> findByCategory(String category, Pageable pageable);
}

// Service
@Transactional(readOnly = true)
public Page<ProductDTO> getProducts(String category, int page, int size) {
    Pageable pageable = PageRequest.of(page, size, Sort.by("name").ascending());
    Page<Product> products = productRepository.findByCategory(category, pageable);
    return products.map(this::toDTO); // Map entity to DTO
}

// Controller
@GetMapping("/api/products")
public Page<ProductDTO> listProducts(
        @RequestParam(defaultValue = "") String category,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "name,asc") String[] sort) {

    Sort sortObj = Sort.by(Sort.Direction.fromString(sort[1]), sort[0]);
    return productService.getProducts(category, page, size);
}
```

## 15.2 Page Response

```json
{
  "content": [ ... ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20,
    "sort": { "sorted": true, "orders": [{"property": "name", "direction": "ASC"}] }
  },
  "totalElements": 156,
  "totalPages": 8,
  "last": false,
  "first": true,
  "numberOfElements": 20
}
```

## 15.3 Sorting

```java
// Multiple sort criteria
Sort sort = Sort.by(
    Sort.Order.desc("priority"),
    Sort.Order.asc("name")
);
List<Product> sorted = productRepository.findAll(sort);
```

---

# Part 16: Spring Data JPA Specifications

### What are Specifications?
Specifications allow you to build **dynamic, composable queries** at runtime. Instead of writing separate repository methods for every possible filter combination, you create reusable building blocks that can be combined with AND/OR.

### Why Specifications Over Multiple Repository Methods
Imagine a product search page with 6 optional filters (category, price range, keyword, brand, rating, availability). Without Specifications, you'd need 2⁶ = 64 repository methods for every possible combination. With Specifications, you need just 6 reusable building blocks.

### When to Use Specifications
- **Search/filter pages** with multiple optional criteria
- **Admin dashboards** where users combine filters dynamically
- When query conditions are known only at runtime

### When NOT to Use Specifications
- Simple, fixed queries — use derived query methods instead
- Complex analytics — use native queries or views
- When there are only 1-2 filter conditions

### Design Pattern: Specification Pattern (Domain-Driven Design)
This implements the **Specification pattern** from DDD — each specification encapsulates a single business rule that can be combined with `and()`, `or()`, `not()`.

## 16.1 Dynamic Queries with Specifications

```java
// Repository must extend JpaSpecificationExecutor
public interface ProductRepository extends JpaRepository<Product, Long>,
        JpaSpecificationExecutor<Product> {
}

// Specification class
public class ProductSpecifications {

    public static Specification<Product> hasCategory(String category) {
        return (root, query, cb) ->
            category == null ? null :
            cb.equal(root.get("category"), category);
    }

    public static Specification<Product> priceBetween(
            BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min == null && max == null) return null;
            if (min != null && max != null)
                return cb.between(root.get("price"), min, max);
            if (min != null)
                return cb.greaterThanOrEqualTo(root.get("price"), min);
            return cb.lessThanOrEqualTo(root.get("price"), max);
        };
    }

    public static Specification<Product> nameContains(String keyword) {
        return (root, query, cb) ->
            keyword == null ? null :
            cb.like(cb.lower(root.get("name")),
                    "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<Product> isActive() {
        return (root, query, cb) ->
            cb.equal(root.get("active"), true);
    }
}

// Service -- compose specifications dynamically
@Transactional(readOnly = true)
public Page<Product> searchProducts(ProductSearchRequest req, Pageable pageable) {
    Specification<Product> spec = Specification
        .where(ProductSpecifications.isActive())
        .and(ProductSpecifications.hasCategory(req.getCategory()))
        .and(ProductSpecifications.priceBetween(req.getMinPrice(), req.getMaxPrice()))
        .and(ProductSpecifications.nameContains(req.getKeyword()));

    return productRepository.findAll(spec, pageable);
}
```

### Performance Tip: Avoid N+1 with Specifications

Specifications generate JPQL that can trigger N+1 if the matched entities have LAZY associations that you access later. Combine Specifications with `@EntityGraph` or a custom `Specification` that adds a `JOIN FETCH`:

```java
public static Specification<Product> fetchCategory() {
    return (root, query, cb) -> {
        if (query.getResultType() != Long.class) { // Skip for COUNT queries
            root.fetch("category", JoinType.LEFT);
        }
        return null;
    };
}
```

### Interview Questions for Part 16

**Q: When should you use Specifications vs derived query methods?**
A: Use Specifications when you have dynamic, optional filters that combine at runtime (search pages with multiple checkboxes). Use derived methods for fixed, simple queries.

**Q: Can you combine Specifications with pagination?**
A: Yes. Pass both `Specification<T>` and `Pageable` to `repository.findAll(spec, pageable)`. The Specification handles WHERE clauses, Pageable handles LIMIT/OFFSET/ORDER BY.

---
