
# Part 17: Performance Optimization

### Deep Theory: The Three Pillars of Hibernate Performance

Every Hibernate performance problem falls into one of three categories:
1. **Too many queries** (N+1 problem) -- Fix with JOIN FETCH, @EntityGraph, @BatchSize
2. **Too much data** (loading full entities when only 3 columns needed) -- Fix with DTO projections
3. **Too long transactions** (holding DB connection for seconds) -- Fix by separating external calls

Mastering these three areas eliminates 95% of Hibernate performance issues.

## 17.1 Batch Fetching

```java
// application.yml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 25
        jdbc:
          batch_size: 50
        order_inserts: true
        order_updates: true
```

```java
// Entity-level batch size
@Entity
public class Customer {
    @OneToMany(mappedBy = "customer")
    @BatchSize(size = 25) // Fetch orders in batches of 25
    private List<Order> orders;
}
// Instead of N queries, generates: SELECT * FROM orders WHERE customer_id IN (?,?,?,...,?)
```

## 17.2 Connection Pooling (HikariCP)

### Deep Theory: Why Connection Pool Sizing Matters

Opening a database connection takes 20-50ms (TCP handshake, SSL negotiation, authentication). HikariCP pre-creates connections so they're ready instantly.

**Formula for pool size:** `connections = (core_count * 2) + effective_spindle_count`
For a 4-core server with SSD: `(4 * 2) + 1 = 9` connections max. Most apps work well with 10-20.

**Warning:** Setting pool size too high HURTS performance. With 100 connections, the database spends more time context-switching between connections than executing queries.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20        # Max connections
      minimum-idle: 5              # Min idle connections
      idle-timeout: 300000         # 5 min idle timeout
      connection-timeout: 20000    # 20 sec connection timeout
      max-lifetime: 1800000        # 30 min max connection lifetime
      leak-detection-threshold: 60000  # Detect connection leaks
```

**Production Tip -- leak-detection-threshold:** If a connection is checked out for longer than this threshold (60s), HikariCP logs a warning with the stack trace showing WHERE the connection was borrowed. This is invaluable for finding long-running transactions.

## 17.3 DTO Projections (Avoid Fetching Full Entities)

### Deep Theory: Why DTO Projections are Critical

Loading a full entity triggers:
1. ALL columns selected (including large TEXT/BLOB)
2. Entity snapshot created (400 bytes per entity for dirty checking)
3. Entity stored in persistence context (memory)
4. All EAGER associations loaded (more queries)

A DTO projection avoids ALL of this overhead.

| Projection Type | Performance | Type Safety | Use When |
|---|---|---|---|
| Interface-based | Good | Compile-time | Simple projections |
| Class-based (record) | Best | Compile-time | Complex projections |
| Tuple / Object[] | Best | No | Quick analytics |

```java
// Interface-based projection
public interface UserSummary {
    Long getId();
    String getName();
    String getEmail();
}

public interface UserRepository extends JpaRepository<User, Long> {
    List<UserSummary> findByStatus(UserStatus status);
    // Generates: SELECT u.id, u.name, u.email FROM users u WHERE u.status = ?
    // NOT: SELECT * FROM users ... (avoids loading unnecessary columns)
}

// Class-based projection (DTO) -- best performance
public record UserDTO(Long id, String name, String email) {}

@Query("SELECT new com.app.dto.UserDTO(u.id, u.name, u.email) " +
       "FROM User u WHERE u.status = :status")
List<UserDTO> findUserDTOs(@Param("status") UserStatus status);
```

## 17.4 Bulk Operations

```java
// BAD: Loading and saving one by one
for (Long id : userIds) {
    User user = userRepository.findById(id).get();
    user.setStatus(UserStatus.INACTIVE);
    userRepository.save(user); // N SELECT + N UPDATE queries!
}

// GOOD: Bulk update with @Query
@Modifying
@Transactional
@Query("UPDATE User u SET u.status = :status WHERE u.id IN :ids")
int bulkUpdateStatus(@Param("ids") List<Long> ids,
                     @Param("status") UserStatus status);
// Single UPDATE query regardless of list size
```

### Interview Questions for Part 17

**Q: How do you decide between interface-based and class-based DTO projections?**
A: Interface-based projections are simpler to write but slightly slower (Spring creates proxies). Class-based (records) are fastest because Hibernate creates objects directly. Use records for performance-critical paths.

**Q: What is the formula for HikariCP pool size?**
A: `(core_count * 2) + spindle_count`. For a 4-core server with SSD: ~9 connections. Setting pool size too high causes database context-switching overhead and actually degrades performance.

---

# Part 18: Hibernate Caching

### Deep Theory: Cache Lookup Flow

When you call `entityManager.find(User.class, 1L)`, Hibernate searches caches in order:

```
find(User.class, 1L)
  |
  v
1st Level Cache (Persistence Context) -- ALWAYS checked first
  |-- FOUND? Return immediately (same object reference)
  |-- NOT FOUND?
  v
2nd Level Cache (if enabled) -- Shared across sessions
  |-- FOUND? Hydrate entity from cached data, add to 1st level cache
  |-- NOT FOUND?
  v
Database Query -- SELECT * FROM users WHERE id = 1
  |-- Result mapped to entity
  |-- Stored in 1st level cache
  |-- Stored in 2nd level cache (if enabled for this entity)
  |-- Returned to caller
```

## 18.1 First-Level Cache (Session Cache)

**What:** Built-in, always-on cache within each Hibernate Session (EntityManager).

**Scope:** Per session (per transaction in Spring).

**How it works:**
```java
@Transactional
public void demonstrateFirstLevelCache() {
    // Query 1: Hits database
    User u1 = userRepository.findById(1L).get();
    // SQL: SELECT * FROM users WHERE id = 1

    // Query 2: Returns from cache -- NO database hit!
    User u2 = userRepository.findById(1L).get();
    // No SQL executed!

    assert u1 == u2; // Same object reference (identity guarantee)
}
```

## 18.2 Second-Level Cache

**What:** Shared cache across all Sessions. Optional, must be configured.

**Scope:** SessionFactory-level (application-wide).

```
+---------------------------------+
|     Application (Multiple       |
|     Concurrent Requests)        |
+---------------------------------+
   |          |           |
   v          v           v
+------+  +------+    +------+
|Sess 1|  |Sess 2|    |Sess 3|  <-- Each has own 1st level cache
+------+  +------+    +------+
     \       |        /
      +------+-------+
      | 2nd Level     |  <-- Shared across ALL sessions
      | Cache         |
      | (EhCache/     |
      |  Redis/       |
      |  Hazelcast)   |
      +-------+-------+
              |
              v
      +-------+-------+
      |   Database     |
      +---------------+
```

### Configuration

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.hibernate.orm</groupId>
    <artifactId>hibernate-jcache</artifactId>
</dependency>
<dependency>
    <groupId>org.ehcache</groupId>
    <artifactId>ehcache</artifactId>
</dependency>
```

```yaml
# application.yml
spring:
  jpa:
    properties:
      hibernate:
        cache:
          use_second_level_cache: true
          region.factory_class: jcache
        javax:
          cache:
            provider: org.ehcache.jsr107.EhcacheCachingProvider
```

```java
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private BigDecimal price;
}
// Now Product entities are cached in 2nd level cache
// Subsequent findById() calls return from cache, not DB
```

### Cache Strategies

| Strategy | Description | Use When |
|---|---|---|
| `READ_ONLY` | Never changes after creation | Reference data, countries, currencies |
| `READ_WRITE` | Reads and updates | Most entities |
| `NONSTRICT_READ_WRITE` | Eventual consistency | Data where slight staleness is OK |
| `TRANSACTIONAL` | Full transaction support | JTA environments |

## 18.3 Query Cache

```yaml
spring:
  jpa:
    properties:
      hibernate:
        cache:
          use_query_cache: true
```

```java
@QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
List<Product> findByCategory(String category);
// Results of this query are cached
// Invalidated when any Product entity changes
```

### Production Warning: Query Cache Invalidation Trap

The query cache invalidates ALL cached queries for an entity type whenever ANY entity of that type is inserted, updated, or deleted. If you have a frequently-updated `Product` table, caching `findByCategory` is pointless -- the cache is invalidated on every product update.

**Use query cache ONLY for:** Rarely-changed reference data (countries, currencies, configuration values).

### Interview Questions for Part 18

**Q: What is the difference between 1st and 2nd level cache?**
A: 1st level cache is per-session, always-on, and guarantees object identity (same ID = same reference). 2nd level cache is shared across all sessions, optional, and must be explicitly configured per entity.

**Q: When should you NOT use the query cache?**
A: When the underlying entity table is frequently updated. The query cache invalidates ALL cached queries for an entity type on any INSERT/UPDATE/DELETE, making it counterproductive for actively modified tables.

---

# Part 19: Common Performance Problems

## 19.1 N+1 Query Problem

**Problem:** Loading a list of entities, then lazy-loading a relationship for each one.

```java
// This generates 1 + N queries:
List<Customer> customers = customerRepository.findAll(); // 1 query
for (Customer c : customers) {
    c.getOrders().size(); // N queries (one per customer)
}
```

**Solutions:**

| Solution | Method | Query Count |
|---|---|---|
| JOIN FETCH | `@Query("SELECT c FROM Customer c JOIN FETCH c.orders")` | 1 |
| @EntityGraph | `@EntityGraph(attributePaths = {"orders"})` | 1 |
| @BatchSize | `@BatchSize(size = 25)` on collection | N/25 |
| DTO Projection | Select only needed columns | 1 |

## 19.2 Lazy Loading Exceptions

**Problem:** `LazyInitializationException` when accessing lazy-loaded data outside Session.

```java
// BAD: Session is closed when controller tries to access orders
@GetMapping("/customers/{id}")
public Customer getCustomer(@PathVariable Long id) {
    Customer c = customerService.findById(id); // Session closes after service
    c.getOrders().size(); // LazyInitializationException!
}
```

**Solutions:**
```java
// Solution 1: Fetch eagerly in the query (BEST)
@Query("SELECT c FROM Customer c JOIN FETCH c.orders WHERE c.id = :id")
Customer findByIdWithOrders(@Param("id") Long id);

// Solution 2: @Transactional on the service method
@Transactional(readOnly = true)
public CustomerDTO getCustomerWithOrders(Long id) {
    Customer c = customerRepository.findById(id).orElseThrow();
    return new CustomerDTO(c, c.getOrders()); // Access while session is open
}

// Solution 3: EntityGraph
@EntityGraph(attributePaths = {"orders"})
Optional<Customer> findById(Long id);
```

### Production Warning: NEVER Use Open Session in View

`spring.jpa.open-in-view=true` (Spring Boot default!) keeps the Hibernate Session open through the entire HTTP request, including view rendering. This prevents LazyInitializationException but:
- Holds database connections for the entire request duration
- Leads to N+1 queries in controllers/templates
- Causes connection pool exhaustion under load

**Always disable it:** `spring.jpa.open-in-view=false`

## 19.3 Slow Queries

**Diagnosis:**
```yaml
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true  # Log query statistics
        format_sql: true
    show-sql: true

logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE  # Show parameter values
```

**Solutions:**
- Add database indexes for frequently queried columns
- Use DTO projections instead of full entities
- Add `@BatchSize` for collections
- Use pagination for large result sets
- Avoid `SELECT *` via projections

## 19.4 Memory Issues

```java
// BAD: Loading 1 million entities into memory
List<User> all = userRepository.findAll(); // OutOfMemoryError!

// GOOD: Process in pages
int page = 0;
Page<User> batch;
do {
    batch = userRepository.findAll(PageRequest.of(page, 500));
    batch.getContent().forEach(this::processUser);
    entityManager.clear(); // Clear persistence context to free memory
    page++;
} while (batch.hasNext());
```

### Interview Questions for Part 19

**Q: What causes LazyInitializationException?**
A: Accessing a LAZY association after the Hibernate Session/EntityManager has been closed. The proxy can't execute the SQL to load data. Fix: use JOIN FETCH, @EntityGraph, or ensure access happens within a @Transactional method.

**Q: Should you enable spring.jpa.open-in-view?**
A: No. It holds database connections for the entire HTTP request including view rendering, leading to connection pool exhaustion. Always disable it and use JOIN FETCH or @EntityGraph instead.

---

# Part 20: Real Production Scenario

## 20.1 User Management System

### Architecture
```
+-----------+     +-------------+     +--------------+     +----------+
|  Client   | --> | Controller  | --> |   Service    | --> |Repository|
| (React)   |     | (REST API)  |     | (@Transact.) |     | (JPA)    |
+-----------+     +-------------+     +--------------+     +----------+
                                                                |
                                                                v
                                                          +----------+
                                                          | Database |
                                                          |PostgreSQL|
                                                          +----------+
```

### Entity
```java
@Entity
@Table(name = "users",
    indexes = @Index(name = "idx_user_email", columnList = "email"))
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE,
        generator = "user_seq")
    @SequenceGenerator(name = "user_seq",
        sequenceName = "user_sequence", allocationSize = 50)
    private Long id;

    @Column(nullable = false, length = 100)
    private String firstName;

    @Column(nullable = false, length = 100)
    private String lastName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserStatus status = UserStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.USER;

    @Embedded
    private Address address;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<UserSession> sessions = new ArrayList<>();

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

### Repository
```java
public interface UserRepository extends JpaRepository<User, Long>,
        JpaSpecificationExecutor<User> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.status = :status")
    Page<User> findByStatus(@Param("status") UserStatus status,
                            Pageable pageable);

    @EntityGraph(attributePaths = {"sessions"})
    Optional<User> findWithSessionsById(Long id);

    @Modifying
    @Query("UPDATE User u SET u.status = 'INACTIVE' " +
           "WHERE u.updatedAt < :cutoff AND u.status = 'ACTIVE'")
    int deactivateInactiveUsers(@Param("cutoff") LocalDateTime cutoff);

    @Query("SELECT new com.app.dto.UserSummaryDTO(u.id, u.firstName, " +
           "u.lastName, u.email, u.status) FROM User u")
    Page<UserSummaryDTO> findAllSummaries(Pageable pageable);
}
```

### Service
```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public UserDTO createUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateEmailException(request.getEmail());
        }

        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());

        User saved = userRepository.save(user);
        return UserDTO.from(saved);
    }

    @Transactional(readOnly = true)
    public Page<UserSummaryDTO> listUsers(int page, int size) {
        return userRepository.findAllSummaries(
            PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @Transactional
    public UserDTO updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException(id));
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        // Dirty checking auto-saves changes on commit
        return UserDTO.from(user);
    }
}
```

### Controller
```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody CreateUserRequest req) {
        UserDTO user = userService.createUser(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @GetMapping
    public Page<UserSummaryDTO> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return userService.listUsers(page, size);
    }

    @PutMapping("/{id}")
    public UserDTO updateUser(@PathVariable Long id,
                              @Valid @RequestBody UpdateUserRequest req) {
        return userService.updateUser(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
```

---

# Part 21: Microservices Data Strategy

## 21.1 Database Per Service Pattern

```
+------------------+    +------------------+    +------------------+
|  User Service    |    |  Order Service   |    | Payment Service  |
|  +-----------+   |    |  +-----------+   |    |  +-----------+   |
|  | Spring    |   |    |  | Spring    |   |    |  | Spring    |   |
|  | Data JPA  |   |    |  | Data JPA  |   |    |  | Data JPA  |   |
|  +-----------+   |    |  +-----------+   |    |  +-----------+   |
|       |          |    |       |          |    |       |          |
|  +-----------+   |    |  +-----------+   |    |  +-----------+   |
|  | User DB   |   |    |  | Order DB  |   |    |  | Payment DB|   |
|  | PostgreSQL|   |    |  | MySQL     |   |    |  | PostgreSQL|   |
|  +-----------+   |    |  +-----------+   |    |  +-----------+   |
+------------------+    +------------------+    +------------------+
```

### Key Rules:
1. Each service owns its database -- no direct cross-service DB access
2. Services communicate via APIs or events, never via shared DB
3. Each service has its own `application.yml` with its own datasource
4. **NO @ManyToOne or @OneToMany across service boundaries** -- use IDs and API calls

### Deep Theory: Why Database Per Service

Sharing a database between services creates **tight coupling**:
- Schema changes in one service break another
- One service's slow query blocks another's connections
- You can't independently scale or deploy services
- Transaction boundaries become unclear

## 21.2 Saga Pattern (Distributed Transactions)

```
Order Saga (Place Order):

1. Order Service: Create order (PENDING)
         |
         v
2. Payment Service: Reserve payment
         |
    Success? ----No----> Compensate: Cancel order
         |
        Yes
         |
         v
3. Inventory Service: Reserve stock
         |
    Success? ----No----> Compensate: Refund payment, Cancel order
         |
        Yes
         |
         v
4. Order Service: Confirm order (CONFIRMED)
```

```java
// Orchestration-based Saga
@Service
public class OrderSagaOrchestrator {

    @Transactional
    public OrderResult placeOrder(OrderRequest request) {
        // Step 1: Create order
        Order order = orderService.create(request);

        try {
            // Step 2: Reserve payment
            PaymentResult payment = paymentClient.reserve(
                order.getId(), order.getTotalAmount());

            // Step 3: Reserve inventory
            InventoryResult inventory = inventoryClient.reserve(
                order.getItems());

            // Step 4: Confirm
            order.confirm();
            return OrderResult.success(order);

        } catch (PaymentException e) {
            order.cancel("Payment failed");
            throw e;
        } catch (InventoryException e) {
            paymentClient.refund(order.getId()); // Compensate
            order.cancel("Inventory unavailable");
            throw e;
        }
    }
}
```

## 21.3 Eventual Consistency with Events

```java
// Order Service publishes event after saving
@Transactional
public Order createOrder(OrderRequest request) {
    Order order = orderRepository.save(new Order(request));

    // Publish event via Kafka
    kafkaTemplate.send("order-events",
        new OrderCreatedEvent(order.getId(), order.getCustomerId(),
            order.getTotalAmount()));

    return order;
}

// Inventory Service consumes event
@KafkaListener(topics = "order-events")
public void handleOrderCreated(OrderCreatedEvent event) {
    inventoryService.reserveStock(event.getOrderId(), event.getItems());
}
```

### Deep Theory: The Outbox Pattern (Reliable Events)

The code above has a critical flaw: if `orderRepository.save()` succeeds but `kafkaTemplate.send()` fails, you have an order in the DB but no event published. The **Outbox Pattern** fixes this:

```java
@Transactional
public Order createOrder(OrderRequest request) {
    Order order = orderRepository.save(new Order(request));
    // Save event to outbox table IN THE SAME TRANSACTION
    outboxRepository.save(new OutboxEvent("OrderCreated", order.getId()));
    return order;
    // A separate poller reads outbox table and publishes to Kafka
    // This guarantees: if order is saved, event is also saved (same TX)
}
```

### Interview Questions for Part 21

**Q: Why can't you use @ManyToOne across microservices?**
A: Because each service has its own database. JPA relationships require both tables to be in the same database. Cross-service data access uses REST APIs or events.

**Q: What is the Saga pattern?**
A: A sequence of local transactions across services, where each step either succeeds or triggers compensating actions to undo previous steps. Used instead of distributed transactions in microservices.

---

# Part 22: Build It Yourself — User Management with JPA

> **Goal:** Build a Spring Boot User Management REST API using Hibernate/JPA, covering entities, repositories, service layer, and performance optimization.

## Concept Overview

| Layer | Technology | Purpose |
|---|---|---|
| Entity | `@Entity`, `@Table`, `@ManyToOne` | Maps Java objects to database tables |
| Repository | `JpaRepository`, `@Query` | Data access without writing SQL |
| Service | `@Transactional`, dirty checking | Business logic with automatic transaction management |
| DTO | Record classes | Decouple API from internal entities |

---

## Step 1: Define Entities with Relationships

**Concept:** Each `@Entity` class maps to a database table. Relationships use `@ManyToOne` (owning side with FK) and `@OneToMany` (inverse side).

```java
@Entity
@Table(name = "users",
    indexes = @Index(name = "idx_user_email", columnList = "email"))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String firstName;

    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    private UserStatus status = UserStatus.ACTIVE;

    @Embedded                                  // Value object stored in same table
    private Address address;

    @OneToMany(mappedBy = "user",              // Inverse side — no FK here
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Order> orders = new ArrayList<>();

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { createdAt = LocalDateTime.now(); }

    // Helper method for bidirectional consistency
    public void addOrder(Order order) {
        orders.add(order);
        order.setUser(this);
    }
}
```

---

## Step 2: Create the Repository

**Concept:** `JpaRepository` gives you CRUD + paging for free. Custom queries use `@Query` (JPQL) or derived method names.

```java
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);          // Derived query — Spring generates SQL

    boolean existsByEmail(String email);               // EXISTS query — efficient

    @Query("SELECT u FROM User u WHERE u.status = :status")
    Page<User> findByStatus(@Param("status") UserStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"orders"})           // Fetch orders eagerly (avoids N+1)
    Optional<User> findWithOrdersById(Long id);

    @Modifying @Transactional
    @Query("UPDATE User u SET u.status = 'INACTIVE' WHERE u.createdAt < :cutoff")
    int deactivateOldUsers(@Param("cutoff") LocalDateTime cutoff);
}
```

---

## Step 3: Build the Service Layer

**Concept:** `@Transactional` manages database transactions. Dirty checking automatically saves changes to persistent entities — no explicit `save()` needed for updates.

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public UserDTO createUser(CreateUserRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new DuplicateEmailException(req.email());
        }
        User user = User.builder()
            .firstName(req.firstName())
            .email(req.email())
            .build();
        return UserDTO.from(userRepository.save(user));
    }

    @Transactional(readOnly = true)       // Read-only = no dirty checking overhead
    public Page<UserDTO> listUsers(int page, int size) {
        return userRepository.findAll(PageRequest.of(page, size))
            .map(UserDTO::from);
    }

    @Transactional
    public UserDTO updateUser(Long id, UpdateUserRequest req) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException(id));
        user.setFirstName(req.firstName());
        // NO save() needed — dirty checking auto-persists on commit
        return UserDTO.from(user);
    }
}
```

---

## Step 4: Performance Optimization

```yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 25     # Batch-fetch lazy collections
        jdbc:
          batch_size: 50                  # Batch INSERTs/UPDATEs
        order_inserts: true               # Group INSERTs by entity type
        order_updates: true
    show-sql: true                        # See generated SQL
```

---

## Key Takeaways

| Concept | Remember |
|---|---|
| `@ManyToOne(fetch = LAZY)` | Always set LAZY — override EAGER defaults |
| `mappedBy` | Inverse side has NO FK column — it's a mirror |
| Dirty checking | Persistent entities auto-save on transaction commit |
| `@EntityGraph` | Solve N+1 by fetching associations in a single query |
| `@Transactional(readOnly = true)` | Better performance for read operations |
| DTO projections | Don't expose entities directly — use DTOs |

---
