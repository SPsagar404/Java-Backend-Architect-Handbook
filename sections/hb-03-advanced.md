
# Part 17: Performance Optimization

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

## 17.3 DTO Projections (Avoid Fetching Full Entities)

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

// Class-based projection (DTO)
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

---

# Part 18: Hibernate Caching

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
// Solution 1: Fetch eagerly in the query
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

---
