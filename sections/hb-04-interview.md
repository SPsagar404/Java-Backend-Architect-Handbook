
# Part 22: Design Patterns Used

## 22.1 Repository Pattern

**What:** Encapsulates data access logic behind an interface, providing a collection-like API.

**Why:** Decouples business logic from data access. Enables testing with mock repositories.

```java
// The Repository Pattern is built into Spring Data JPA
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByCustomerId(Long customerId);
}

// Service depends on interface, not implementation
@Service
public class OrderService {
    private final OrderRepository orderRepository; // Interface!

    public List<Order> getCustomerOrders(Long customerId) {
        return orderRepository.findByCustomerId(customerId);
    }
}

// In tests: use mock
@MockBean
private OrderRepository orderRepository;
```

## 22.2 DAO Pattern (Data Access Object)

**What:** Similar to Repository but closer to the persistence mechanism. Often wraps EntityManager directly.

**When:** When Spring Data JPA's auto-generated methods are insufficient.

```java
@Repository
public class CustomOrderDao {

    @PersistenceContext
    private EntityManager em;

    public List<Order> findByComplexCriteria(OrderSearchCriteria criteria) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Order> cq = cb.createQuery(Order.class);
        Root<Order> root = cq.from(Order.class);
        List<Predicate> predicates = new ArrayList<>();
        // Build dynamic query...
        return em.createQuery(cq).getResultList();
    }
}
```

## 22.3 Specification Pattern

**What:** Encapsulates query criteria into reusable, composable objects.

**When:** Dynamic filtering (search pages, dashboards).

```java
// Already covered in Part 16 -- Specifications are composable:
Specification<Product> spec = Specification
    .where(hasCategory("Electronics"))
    .and(priceBetween(100, 500))
    .and(nameContains("phone"));
productRepository.findAll(spec, pageable);
```

## 22.4 Unit of Work Pattern

**What:** Tracks all changes during a business transaction and persists them as a single unit.

**How Hibernate implements it:** The Session/EntityManager IS the Unit of Work. It tracks all persistent entities and flushes changes on commit.

```java
@Transactional // Defines the Unit of Work boundary
public void processOrder(OrderRequest request) {
    // All changes within this method are tracked
    Order order = new Order(request);
    entityManager.persist(order);      // Tracked

    Customer customer = customerRepo.findById(request.getCustomerId()).get();
    customer.incrementOrderCount();    // Tracked (dirty checking)

    Inventory inv = inventoryRepo.findByProductId(request.getProductId());
    inv.decrementStock(request.getQuantity()); // Tracked

    // At @Transactional boundary: ALL changes flushed in single transaction
    // INSERT order + UPDATE customer + UPDATE inventory
}
```

---

# Part 23: Best Practices

## 23.1 Entity Design

```java
// 1. Always override equals() and hashCode() using business key
@Entity
public class User {
    @Id @GeneratedValue
    private Long id;

    @Column(unique = true, nullable = false)
    private String email; // Business key

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof User)) return false;
        User user = (User) o;
        return email != null && email.equals(user.email);
    }

    @Override
    public int hashCode() {
        return Objects.hash(email); // Based on business key, NOT id
    }
}

// 2. Use LAZY fetch by default
@ManyToOne(fetch = FetchType.LAZY) // Override EAGER default!
private Customer customer;

// 3. Use Set instead of List for ManyToMany (avoids duplicates)
@ManyToMany
private Set<Role> roles = new HashSet<>();

// 4. Add helper methods for bidirectional relationships
public void addOrder(Order order) {
    orders.add(order);
    order.setCustomer(this);
}

// 5. Use @PrePersist and @PreUpdate for audit fields
@PrePersist void onCreate() { createdAt = Instant.now(); }
@PreUpdate void onUpdate() { updatedAt = Instant.now(); }
```

## 23.2 Transaction Boundaries

```java
// 1. Keep transactions SHORT -- only in service layer
@Service
public class UserService {
    @Transactional // HERE -- not in controller or repository
    public void updateUser(Long id, UpdateRequest req) { ... }
}

// 2. Use readOnly for queries (performance boost)
@Transactional(readOnly = true)
public List<UserDTO> searchUsers(SearchCriteria criteria) { ... }

// 3. Avoid calling external APIs inside transactions
@Transactional
public void processPayment(PaymentRequest req) {
    Order order = orderRepo.findById(req.getOrderId()).get();
    // DON'T call external payment API here -- holds DB connection!
}

// BETTER:
public void processPayment(PaymentRequest req) {
    Order order = loadOrder(req.getOrderId()); // @Transactional(readOnly=true)
    PaymentResult result = paymentApi.charge(req); // No transaction
    updateOrderStatus(order.getId(), result); // @Transactional
}
```

## 23.3 Avoiding LazyInitializationException

```java
// Rule: Access all lazy data WITHIN the @Transactional boundary

// Option 1: JOIN FETCH in repository
@Query("SELECT c FROM Customer c JOIN FETCH c.orders WHERE c.id = :id")
Customer findWithOrders(@Param("id") Long id);

// Option 2: @EntityGraph
@EntityGraph(attributePaths = {"orders", "orders.items"})
Optional<Customer> findById(Long id);

// Option 3: Map to DTO inside transaction
@Transactional(readOnly = true)
public CustomerDTO getCustomer(Long id) {
    Customer c = customerRepo.findById(id).orElseThrow();
    return new CustomerDTO(c.getName(), c.getOrders().size()); // Access here!
}
```

## 23.4 Query Writing Rules

1. **Never use `SELECT *` in production** -- use DTO projections
2. **Add indexes** for columns used in WHERE, JOIN, ORDER BY
3. **Paginate large results** -- never return unbounded lists
4. **Use @BatchSize** for collections to prevent N+1
5. **Use bulk operations** (@Modifying @Query) for mass updates
6. **Monitor slow queries** with `hibernate.generate_statistics: true`

---

# Part 24: Interview Questions (100+)

## Hibernate Fundamentals (Q1-Q25)

**Q1. What is ORM and why do we need it?**
ORM maps Java objects to database tables automatically, eliminating manual JDBC code, ResultSet mapping, and SQL string building. It solves the object-relational impedance mismatch.

**Q2. What is the difference between JPA and Hibernate?**
JPA is a specification (interface/standard). Hibernate is an implementation of JPA. JPA defines annotations like `@Entity`, `@Id`; Hibernate provides the actual code that makes them work.

**Q3. What is a SessionFactory?**
A heavyweight, thread-safe, immutable factory created once at startup. It holds compiled mappings, caches, and connection pool configuration. One SessionFactory per database.

**Q4. What is a Session/EntityManager?**
A lightweight, short-lived, non-thread-safe object that wraps a JDBC connection. It provides the API for CRUD operations and serves as the first-level cache.

**Q5. Explain the Hibernate entity lifecycle.**
Four states: Transient (new, not managed), Persistent (managed by Session, changes auto-tracked), Detached (was persistent, Session closed), Removed (scheduled for deletion).

**Q6. What is dirty checking?**
Hibernate automatically detects changes to persistent entities by comparing current state to a snapshot taken when the entity was loaded. Modified entities generate UPDATE SQL on flush.

**Q7. What is the first-level cache?**
The Session-level cache. Within a Session, the same entity (by ID) is always the same Java object. Second `findById()` returns the cached instance, not a new DB query.

**Q8. What is the second-level cache?**
A SessionFactory-level cache shared across all Sessions. Requires configuration (EhCache, Hazelcast). Caches entity data beyond individual Sessions.

**Q9. What is the difference between `persist()` and `save()`?**
`persist()` is JPA standard -- makes entity persistent, may not return ID immediately. `save()` is Hibernate-specific -- returns the generated ID immediately.

**Q10. What is the difference between `merge()` and `update()`?**
`merge()` copies detached entity state to a new persistent instance (returns the managed copy). `update()` reattaches the detached entity itself (Hibernate-specific, can throw if another instance with same ID is in Session).

**Q11. What is `@GeneratedValue` strategy SEQUENCE vs IDENTITY?**
SEQUENCE uses a database sequence object, allowing batch inserts (Hibernate pre-allocates IDs). IDENTITY uses auto-increment columns but disables batch inserts because Hibernate must execute INSERT to get the ID.

**Q12. What is an @Embeddable?**
A value object that maps to columns in the parent entity's table (no separate table). Example: Address embedded in Customer table.

**Q13. What is the difference between @Embedded and @OneToOne?**
@Embedded stores data in the same table (value object, no identity). @OneToOne uses a separate table with foreign key (has its own identity/lifecycle).

**Q14. What is cascade in Hibernate?**
Cascade propagates operations from parent to child. CascadeType.PERSIST cascades save, REMOVE cascades delete, ALL cascades everything.

**Q15. What is orphanRemoval?**
When a child entity is removed from the parent's collection, it is automatically deleted from the database. Different from CASCADE.REMOVE which only deletes children when the parent is deleted.

**Q16. Explain owning side vs inverse side.**
The owning side has the foreign key column (@JoinColumn). The inverse side uses `mappedBy`. Only changes to the owning side are persisted to the database.

**Q17. What is FetchType.LAZY vs EAGER?**
LAZY loads associated data only when accessed (proxy). EAGER loads immediately via JOIN. LAZY is preferred for performance.

**Q18. What is the N+1 problem?**
Loading N entities and then lazily loading a relationship for each generates 1 + N queries. Solved with JOIN FETCH, @EntityGraph, or @BatchSize.

**Q19. What is HQL vs JPQL?**
HQL is Hibernate-specific query language. JPQL is the JPA standard. Both operate on entities (not tables). JPQL is portable across JPA providers.

**Q20. When would you use native SQL?**
For database-specific features (window functions, CTEs, full-text search), complex queries that are difficult in JPQL, or performance-critical queries.

**Q21. What is @NamedQuery?**
Pre-compiled JPQL queries defined on entity classes. Validated at startup, cached, and reusable. Replaced by @Query in Spring Data JPA.

**Q22. What is optimistic vs pessimistic locking?**
Optimistic: uses @Version column, detects conflicts at commit time. Pessimistic: locks database rows using SELECT FOR UPDATE, prevents concurrent access.

**Q23. What is the @Version annotation?**
Implements optimistic locking. Hibernate checks the version column on UPDATE; if it changed since read, throws OptimisticLockException.

**Q24. What is a Hibernate Dialect?**
Translates HQL/JPQL to database-specific SQL. Different databases have different SQL syntax (LIMIT vs ROWNUM, sequences vs auto-increment).

**Q25. What is `spring.jpa.hibernate.ddl-auto`?**
Controls schema generation: `none` (no action), `validate` (check schema), `update` (alter tables), `create` (drop and create), `create-drop` (create on startup, drop on shutdown). Production should use `validate` or `none`.

## Spring Data JPA Questions (Q26-Q50)

**Q26. What is Spring Data JPA?**
An abstraction layer on top of JPA that generates repository implementations from interfaces at runtime, eliminating boilerplate data access code.

**Q27. What is the difference between CrudRepository and JpaRepository?**
JpaRepository extends CrudRepository and adds JPA-specific methods: `flush()`, `saveAndFlush()`, `deleteAllInBatch()`, and supports pagination and sorting.

**Q28. How does query method derivation work?**
Spring Data parses method names and generates JPQL. `findByEmailAndStatus(String email, Status status)` becomes `SELECT u FROM User u WHERE u.email = ?1 AND u.status = ?2`.

**Q29. What is the @Query annotation?**
Defines custom JPQL or native SQL queries on repository methods when method name derivation is insufficient.

**Q30. What is @Modifying?**
Required on @Query methods that modify data (UPDATE, DELETE). Must be used with @Transactional.

**Q31. How does pagination work?**
Pass `Pageable` parameter to repository method. Returns `Page<T>` with content, total count, page info. `PageRequest.of(page, size, sort)` creates Pageable.

**Q32. What is a Specification?**
A reusable query predicate. Implements `Specification<T>` interface. Composable with `.and()`, `.or()`. Requires `JpaSpecificationExecutor`.

**Q33. What is an @EntityGraph?**
Defines which associations to fetch eagerly for a specific query, overriding default fetch types. Prevents N+1 without JOIN FETCH in query string.

**Q34. What is a DTO projection?**
Selecting only specific columns into a DTO instead of full entity. Reduces data transfer and avoids loading unnecessary relationships.

**Q35. What is the difference between interface and class projections?**
Interface projections: Spring generates proxy implementing getter methods. Class projections: constructor-based, JPQL `SELECT NEW`.

**Q36. How to handle soft deletes?**
Use `@SQLDelete` and `@Where` annotations or manually add `deletedAt` column with global filter.

**Q37. What is Auditing in Spring Data JPA?**
Auto-populating `createdBy`, `createdDate`, `lastModifiedBy`, `lastModifiedDate` using `@EnableJpaAuditing` and `@CreatedDate`, `@LastModifiedDate` annotations.

**Q38. What is @Transactional(readOnly = true)?**
Tells Hibernate to skip dirty checking for entities loaded in this transaction, improving performance. May also route to read replicas.

**Q39. What happens if @Transactional is on a private method?**
It does NOT work. Spring AOP creates proxies for public methods only. @Transactional on private methods is silently ignored.

**Q40. What is the Open Session in View pattern?**
Keeps the Hibernate Session open until the view is rendered (controller returns response). Prevents LazyInitializationException but can cause N+1 queries in views. `spring.jpa.open-in-view=false` to disable (recommended).

**Q41. How to implement custom repository methods?**
Create a custom interface + implementation class. Spring Data merges it with the auto-generated implementation.

**Q42. What is QueryByExample?**
Creates queries from entity instances. `productRepository.findAll(Example.of(probe))` where probe is a partially filled entity.

**Q43. How to use multiple data sources?**
Configure separate DataSource, EntityManagerFactory, and TransactionManager beans. Use `@EnableJpaRepositories(basePackages, entityManagerFactoryRef)` per datasource.

**Q44. What is @Param in @Query?**
Binds method parameters to named query parameters: `@Query("... WHERE u.email = :email") User findByEmail(@Param("email") String email)`.

**Q45. What is saveAndFlush() vs save()?**
`save()` persists but may delay SQL until transaction commit. `saveAndFlush()` immediately executes SQL, useful when you need the generated ID right away.

**Q46. How to call stored procedures?**
Use `@Procedure` annotation or `@NamedStoredProcedureQuery` on the entity.

**Q47. What is @Lock in Spring Data JPA?**
Applies pessimistic or optimistic lock mode to a query: `@Lock(LockModeType.PESSIMISTIC_WRITE)`.

**Q48. How to handle database migrations?**
Use Flyway or Liquibase. Never use `ddl-auto: update` in production. Version all schema changes as migration scripts.

**Q49. What is the difference between findById and getById?**
`findById()` returns `Optional<T>`, immediately executes SELECT. `getReferenceById()` returns a lazy proxy, throws EntityNotFoundException on access if not found.

**Q50. How to test repositories?**
Use `@DataJpaTest` with embedded H2. It auto-configures an in-memory database, scans for entities and repositories, wraps tests in transactions that rollback.

## Performance and Architecture Questions (Q51-Q75)

**Q51. How to solve the N+1 problem?**
Four solutions: JOIN FETCH in JPQL, @EntityGraph, @BatchSize on collections, DTO projections that avoid relationships entirely.

**Q52. How to optimize batch inserts?**
Use SEQUENCE strategy (not IDENTITY), set `hibernate.jdbc.batch_size=50`, enable `order_inserts=true`, flush and clear EntityManager periodically.

**Q53. What is connection pool sizing best practice?**
Formula: connections = (core_count * 2) + disk_spindles. For most apps, 10-20 connections with HikariCP.

**Q54. How to detect slow queries?**
Enable `hibernate.generate_statistics=true` and `show_sql=true`. Use slow query logging in the database. Monitor with APM tools.

**Q55. What is the difference between JPQL JOIN and JOIN FETCH?**
JOIN filters results but doesn't load the association. JOIN FETCH loads the association into the entity (initializes the lazy proxy).

**Q56. When to use native queries?**
Database-specific functions, window functions, CTEs, full-text search, performance-critical queries, complex aggregations.

**Q57. How to handle large result sets?**
Use pagination (Pageable), streaming (Stream<T>), or ScrollableResults. Never load millions of entities into memory.

**Q58. What is the impact of CascadeType.ALL?**
Cascades all operations including REMOVE. Can cause unexpected deletions. Use specific cascades (PERSIST, MERGE) unless parent truly owns child lifecycle.

**Q59. How to prevent LazyInitializationException?**
Fetch data within @Transactional, use JOIN FETCH, use @EntityGraph, map to DTO inside service layer, or disable Open Session in View.

**Q60. What is database indexing strategy for JPA?**
Index columns used in WHERE, JOIN, and ORDER BY clauses. Use `@Index` on `@Table` or manage via Flyway/Liquibase migrations.

**Q61. How to implement multi-tenancy?**
Database per tenant (separate datasources), Schema per tenant (schema switching), or Discriminator column (shared table with tenant_id filter).

**Q62. What is OSIV (Open Session in View) and why disable it?**
Keeps Session open through controller response rendering. Causes lazy queries in view layer (N+1 risk). Disable with `spring.jpa.open-in-view=false`.

**Q63. How to handle concurrent updates?**
Use @Version for optimistic locking. Handle OptimisticLockException with retry logic in service layer.

**Q64. What is the difference between first and second level cache?**
L1: per Session, automatic, cannot be disabled. L2: per SessionFactory, shared, configurable, requires explicit opt-in per entity.

**Q65. How to monitor Hibernate in production?**
Enable statistics, export metrics to Prometheus/Grafana (via Micrometer), log slow queries, monitor connection pool metrics (HikariCP).

**Q66. What is @DynamicUpdate?**
Generates UPDATE SQL with only changed columns, not all columns. Useful for tables with many columns.

**Q67. What is @NaturalId?**
Marks a business key (like email, SSN). Hibernate provides a cache-friendly lookup by natural ID.

**Q68. How to handle inheritance in JPA?**
Three strategies: SINGLE_TABLE (one table, discriminator column), JOINED (table per class with JOIN), TABLE_PER_CLASS (separate tables, no JOIN).

**Q69. When to use SINGLE_TABLE vs JOINED inheritance?**
SINGLE_TABLE: best performance (no JOINs), nullable columns. JOINED: normalized, no nulls, but slower due to JOINs.

**Q70. What is @MappedSuperclass vs @Inheritance?**
@MappedSuperclass: shares fields but no polymorphic queries. @Inheritance: full polymorphism with `FROM BaseEntity` queries.

**Q71. How to implement soft delete with JPA?**
Add `deletedAt` column, override delete with `@SQLDelete(sql = "UPDATE ... SET deleted_at = NOW()")`, filter with `@Where(clause = "deleted_at IS NULL")`.

**Q72. What is EntityManager.flush()?**
Synchronizes persistence context with database (executes pending SQL) WITHOUT committing the transaction. Useful before native queries.

**Q73. What is the difference between em.persist() and repo.save()?**
`persist()` is JPA standard, only works on new entities. `save()` calls `persist()` for new or `merge()` for existing (based on ID presence).

**Q74. How to handle time zones in JPA?**
Store as `Instant` or `OffsetDateTime` in UTC. Configure JVM timezone: `-Duser.timezone=UTC`. Use `@Column(columnDefinition = "TIMESTAMP WITH TIME ZONE")`.

**Q75. What is the best entity equals/hashCode strategy?**
Use business key (email, ISBN), never the generated ID (changes from null to value on persist). If no business key, use UUID set in constructor.

## Architect-Level Questions (Q76-Q100)

**Q76. Design a multi-tenant SaaS persistence layer.**
Use discriminator-based tenancy with `tenant_id` column. Implement Hibernate filter to automatically add `WHERE tenant_id = ?`. Use `ThreadLocal` to store current tenant.

**Q77. How to handle database migrations in CI/CD?**
Flyway migration scripts versioned in Git. CI pipeline runs `flyway:migrate` before deployment. Rollback scripts for each migration. Never use `ddl-auto`.

**Q78. Design read/write splitting with JPA.**
Configure two datasources (primary for writes, replica for reads). Use `@Transactional(readOnly = true)` to route to replica. Implement `AbstractRoutingDataSource`.

**Q79. How to implement CQRS with JPA?**
Write model: full entities with JPA for commands. Read model: DTO projections or separate read-optimized views. Optionally synchronize via events.

**Q80. Design an audit logging system with JPA.**
Use Hibernate Envers or custom `@EntityListeners` with `@PrePersist`, `@PreUpdate`, `@PreRemove`. Store audit trail in separate audit tables.

**Q81. How to handle schema evolution in microservices?**
Each service owns its schema. Use backward-compatible migrations (add columns, never remove). Blue-green deployment with migration windows.

**Q82. Design a high-performance bulk import system.**
Stateless Session, JDBC batch inserts, disable auto-commit, clear persistence context every N rows, use database COPY command for massive imports.

**Q83. How to implement event sourcing with JPA?**
Store events as entities in an events table. Rebuild state by replaying events. Use `@DomainEvents` in Spring Data for publishing.

**Q84. How to handle distributed caching with Hibernate L2?**
Use Hazelcast or Redis as L2 cache provider. Configure cache regions per entity. Handle cache invalidation across cluster nodes.

**Q85. Design a full-text search with JPA.**
Use Hibernate Search (Lucene/Elasticsearch integration) or native database full-text indexes with native queries.

**Q86. How to profile and optimize a slow JPA application?**
Enable Hibernate statistics, identify N+1 queries, check for missing indexes, analyze query plans (EXPLAIN), add DTO projections, configure batch fetching.

**Q87. Design a versioned API with different entity shapes.**
Use DTO projection per API version. Keep entity stable; vary DTOs. Version endpoints: `/api/v1/users`, `/api/v2/users`.

**Q88. How to handle eventual consistency between services?**
Outbox pattern: write event to outbox table in same transaction, background process publishes to Kafka. Consumer is idempotent.

**Q89. When would you NOT use an ORM?**
Extreme performance requirements, complex reporting (use raw SQL/views), simple CRUD with few entities (use Spring JDBC), NoSQL databases.

**Q90. Design a data archival strategy with JPA.**
Partition tables by date. Batch job moves old data to archive tables. Use separate entity mappings for archive. Maintain foreign key integrity.

**Q91. How to handle database connection issues gracefully?**
HikariCP connection validation, circuit breaker pattern (Resilience4j), retry with exponential backoff, health checks for database connectivity.

**Q92. Design the persistence layer for an e-commerce platform.**
User, Product, Order, OrderItem, Payment, Address entities. Aggregate root pattern (Order is aggregate root for OrderItems). Optimistic locking on inventory. Event-driven stock updates.

**Q93. How to implement row-level security with JPA?**
Hibernate `@Filter` with `@FilterDef`. Enable filter per Session with tenant/user context. Or use database-level row-level security (PostgreSQL RLS).

**Q94. What is the Outbox Pattern?**
Write domain event to an outbox table within the same transaction as the business operation. A separate process reads the outbox and publishes to message broker. Guarantees at-least-once delivery.

**Q95. How to handle large BLOB/CLOB data?**
Use `@Lob` with lazy loading. Store large files in object storage (S3), save only reference in DB. Use streaming for large reads.

**Q96. Design a polymorphic search across entity types.**
Use SINGLE_TABLE inheritance with discriminator. Query base entity with Specifications. Or use Elasticsearch for cross-entity search.

**Q97. How to implement database sharding with JPA?**
Custom `AbstractRoutingDataSource` that routes based on shard key. Each shard has own EntityManagerFactory. Application manages shard selection.

**Q98. What is the Unit of Work pattern in Hibernate?**
The Session IS the Unit of Work. It tracks all entity changes (inserts, updates, deletes) and flushes them as a batch in a single transaction on commit.

**Q99. How to implement the Specification pattern for complex filters?**
Create reusable Specification classes. Compose with `.and()`, `.or()`. Support dynamic filter UI. Test each specification independently.

**Q100. Design a reporting system that doesn't impact OLTP performance.**
Use read replica for reports. Materialize views for complex aggregations. Use Spring Batch for scheduled report generation. DTO projections for lightweight queries.

**Q101. What is the difference between Spring Data JPA and Spring Data JDBC?**
JPA: full ORM, lazy loading, caching, entity lifecycle. JDBC: no ORM, no lazy loading, no session cache. JDBC is simpler but less powerful.

**Q102. How to handle database transactions across multiple repositories?**
One @Transactional on the service method wraps all repository calls in a single transaction. Don't put @Transactional on repositories.

**Q103. What is the N+1 problem in aggregations?**
Loading aggregate data by iterating entities instead of using GROUP BY queries. Solution: use @Query with aggregation functions or native SQL.

---

# Part 25: Coding Exercises (20)

## Exercise 1: Basic Entity with Auditing
```java
@Entity
@EntityListeners(AuditingEntityListener.class)
public class Article {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;
}
```

## Exercise 2: Composite Key Entity
```java
@Embeddable
public class EnrollmentId implements Serializable {
    private Long studentId;
    private Long courseId;
    // equals() and hashCode()
}

@Entity
public class Enrollment {
    @EmbeddedId
    private EnrollmentId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("studentId")
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("courseId")
    private Course course;

    private LocalDate enrolledDate;
    private String grade;
}
```

## Exercise 3: OneToMany with Cascade and OrphanRemoval
```java
@Entity
public class ShoppingCart {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<CartItem> items = new ArrayList<>();

    public void addItem(Product product, int quantity) {
        CartItem item = new CartItem(this, product, quantity);
        items.add(item);
    }

    public void removeItem(CartItem item) {
        items.remove(item);
        item.setCart(null);
    }
}
```

## Exercise 4: Inheritance Mapping (SINGLE_TABLE)
```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "payment_type")
public abstract class Payment {
    @Id @GeneratedValue private Long id;
    private BigDecimal amount;
    private LocalDateTime paidAt;
}

@Entity
@DiscriminatorValue("CREDIT_CARD")
public class CreditCardPayment extends Payment {
    private String cardNumber;
    private String expiryDate;
}

@Entity
@DiscriminatorValue("BANK_TRANSFER")
public class BankTransferPayment extends Payment {
    private String bankCode;
    private String accountNumber;
}
```

## Exercise 5: Query Method Derivation
```java
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    List<Employee> findByDepartmentAndStatusOrderBySalaryDesc(
        String department, EmployeeStatus status);

    Optional<Employee> findFirstByDepartmentOrderBySalaryDesc(
        String department); // Highest paid in department

    long countByDepartment(String department);
    boolean existsByEmail(String email);
    List<Employee> findTop5ByOrderBySalaryDesc(); // Top 5 earners
}
```

## Exercise 6: Custom @Query with DTO Projection
```java
public record DepartmentStats(
    String department, long employeeCount, BigDecimal avgSalary) {}

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    @Query("SELECT new com.app.dto.DepartmentStats(" +
           "e.department, COUNT(e), AVG(e.salary)) " +
           "FROM Employee e GROUP BY e.department " +
           "ORDER BY AVG(e.salary) DESC")
    List<DepartmentStats> getDepartmentStatistics();
}
```

## Exercise 7: Pagination with Specification
```java
@Service
public class EmployeeSearchService {

    @Autowired private EmployeeRepository repo;

    public Page<Employee> search(String name, String dept,
                                  BigDecimal minSalary, Pageable pageable) {
        Specification<Employee> spec = Specification.where(null);
        if (name != null) spec = spec.and(nameContains(name));
        if (dept != null) spec = spec.and(inDepartment(dept));
        if (minSalary != null) spec = spec.and(salaryGreaterThan(minSalary));
        return repo.findAll(spec, pageable);
    }

    private Specification<Employee> nameContains(String name) {
        return (r, q, cb) -> cb.like(cb.lower(r.get("name")),
            "%" + name.toLowerCase() + "%");
    }

    private Specification<Employee> inDepartment(String dept) {
        return (r, q, cb) -> cb.equal(r.get("department"), dept);
    }

    private Specification<Employee> salaryGreaterThan(BigDecimal min) {
        return (r, q, cb) -> cb.greaterThanOrEqualTo(r.get("salary"), min);
    }
}
```

## Exercise 8: Optimistic Locking
```java
@Entity
public class InventoryItem {
    @Id private Long id;
    private String productName;
    private int quantity;

    @Version
    private Long version; // Optimistic lock column

    public void decrementStock(int amount) {
        if (quantity < amount)
            throw new InsufficientStockException();
        this.quantity -= amount;
    }
}

@Service
public class InventoryService {
    @Transactional
    @Retryable(value = OptimisticLockException.class, maxAttempts = 3)
    public void reserveStock(Long itemId, int amount) {
        InventoryItem item = repo.findById(itemId).orElseThrow();
        item.decrementStock(amount);
        // If another thread updated concurrently, version mismatch
        // throws OptimisticLockException -> retry
    }
}
```

## Exercise 9: Entity Lifecycle Callbacks
```java
@Entity
public class Order {
    @Id @GeneratedValue private Long id;
    private BigDecimal amount;
    private String status;

    @PrePersist  void prePersist()  { log.info("About to INSERT order"); }
    @PostPersist void postPersist() { log.info("INSERTed order id={}", id); }
    @PreUpdate   void preUpdate()   { log.info("About to UPDATE order {}", id); }
    @PostUpdate  void postUpdate()  { log.info("UPDATEd order {}", id); }
    @PreRemove   void preRemove()   { log.info("About to DELETE order {}", id); }
    @PostRemove  void postRemove()  { log.info("DELETEd order {}", id); }
    @PostLoad    void postLoad()    { log.info("LOADed order {}", id); }
}
```

## Exercise 10: Bulk Update with @Modifying
```java
public interface UserRepository extends JpaRepository<User, Long> {
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("UPDATE User u SET u.status = 'INACTIVE' " +
           "WHERE u.lastLoginAt < :cutoff")
    int deactivateInactiveUsers(@Param("cutoff") LocalDateTime cutoff);
}
```

## Exercise 11: ManyToMany with Extra Columns
```java
// When join table needs extra columns, use an entity instead of @ManyToMany
@Entity
public class ProjectAssignment {
    @EmbeddedId
    private ProjectAssignmentId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("employeeId")
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("projectId")
    private Project project;

    private String role;          // Extra column
    private LocalDate assignedDate; // Extra column
}
```

## Exercise 12: Custom Repository Implementation
```java
public interface UserRepositoryCustom {
    List<User> findUsersWithComplexCriteria(UserSearchCriteria criteria);
}

@Repository
public class UserRepositoryCustomImpl implements UserRepositoryCustom {
    @PersistenceContext
    private EntityManager em;

    @Override
    public List<User> findUsersWithComplexCriteria(UserSearchCriteria c) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<User> query = cb.createQuery(User.class);
        Root<User> root = query.from(User.class);

        List<Predicate> predicates = new ArrayList<>();
        if (c.getName() != null)
            predicates.add(cb.like(root.get("name"), "%" + c.getName() + "%"));
        if (c.getMinAge() != null)
            predicates.add(cb.ge(root.get("age"), c.getMinAge()));

        query.where(predicates.toArray(new Predicate[0]));
        return em.createQuery(query).getResultList();
    }
}

// Combine with Spring Data
public interface UserRepository extends JpaRepository<User, Long>,
                                         UserRepositoryCustom { }
```

## Exercise 13: Interface-Based Projection
```java
public interface UserSummary {
    Long getId();
    String getFullName();
    String getEmail();

    @Value("#{target.firstName + ' ' + target.lastName}")
    String getDisplayName(); // Computed from entity fields
}

public interface UserRepository extends JpaRepository<User, Long> {
    List<UserSummary> findByStatus(UserStatus status);
}
```

## Exercise 14: Soft Delete
```java
@Entity
@SQLDelete(sql = "UPDATE products SET deleted_at = NOW() WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
public class Product {
    @Id @GeneratedValue private Long id;
    private String name;
    private LocalDateTime deletedAt;
}
// productRepository.deleteById(1L);
// Executes: UPDATE products SET deleted_at = NOW() WHERE id = 1
// productRepository.findAll();
// Executes: SELECT * FROM products WHERE deleted_at IS NULL
```

## Exercise 15: EntityGraph for Selective Fetching
```java
@Entity
@NamedEntityGraph(name = "Customer.withOrdersAndItems",
    attributeNodes = {
        @NamedAttributeNode(value = "orders",
            subgraph = "orders-items")
    },
    subgraphs = {
        @NamedSubgraph(name = "orders-items",
            attributeNodes = @NamedAttributeNode("items"))
    })
public class Customer { ... }

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    @EntityGraph("Customer.withOrdersAndItems")
    Optional<Customer> findById(Long id);
}
```

## Exercise 16: Stored Procedure Call
```java
public interface ReportRepository extends JpaRepository<Report, Long> {

    @Procedure(name = "generate_monthly_report")
    void generateMonthlyReport(@Param("month") int month,
                                @Param("year") int year);
}
```

## Exercise 17: Multiple DataSources
```java
@Configuration
@EnableJpaRepositories(
    basePackages = "com.app.primary.repository",
    entityManagerFactoryRef = "primaryEntityManagerFactory",
    transactionManagerRef = "primaryTransactionManager")
public class PrimaryDataSourceConfig {

    @Primary
    @Bean
    @ConfigurationProperties("spring.datasource.primary")
    public DataSource primaryDataSource() {
        return DataSourceBuilder.create().build();
    }
}
```

## Exercise 18: Query by Example
```java
@Transactional(readOnly = true)
public List<Product> searchByExample(String name, String category) {
    Product probe = new Product();
    probe.setName(name);
    probe.setCategory(category);

    ExampleMatcher matcher = ExampleMatcher.matching()
        .withIgnoreCase()
        .withStringMatcher(ExampleMatcher.StringMatcher.CONTAINING)
        .withIgnoreNullValues();

    return productRepository.findAll(Example.of(probe, matcher));
}
```

## Exercise 19: Batch Processing with JPA
```java
@Transactional
public void batchInsert(List<Employee> employees) {
    for (int i = 0; i < employees.size(); i++) {
        entityManager.persist(employees.get(i));
        if (i % 50 == 0) { // Flush every 50
            entityManager.flush();
            entityManager.clear(); // Free memory
        }
    }
}
```

## Exercise 20: Testing Repository with @DataJpaTest
```java
@DataJpaTest
class UserRepositoryTest {

    @Autowired private UserRepository userRepository;
    @Autowired private TestEntityManager entityManager;

    @Test
    void shouldFindByEmail() {
        User user = new User("John", "john@test.com");
        entityManager.persistAndFlush(user);

        Optional<User> found = userRepository.findByEmail("john@test.com");

        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("John");
    }

    @Test
    void shouldReturnEmptyForNonExistentEmail() {
        Optional<User> found = userRepository.findByEmail("x@test.com");
        assertThat(found).isEmpty();
    }

    @Test
    void shouldPaginateResults() {
        for (int i = 0; i < 25; i++) {
            entityManager.persist(new User("User" + i, "u" + i + "@test.com"));
        }
        entityManager.flush();

        Page<User> page = userRepository.findAll(PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getTotalElements()).isEqualTo(25);
        assertThat(page.getTotalPages()).isEqualTo(3);
    }
}
```

---

*End of Guide*

**Document Version:** 1.0
**Last Updated:** March 2026
**Topics Covered:** 25 Parts, 103 Interview Questions, 20 Coding Exercises
