
# Part 9: Transaction Management

## 9.1 ACID Properties

| Property | Meaning | Example |
|---|---|---|
| **Atomicity** | All or nothing -- entire transaction succeeds or rolls back | Transfer $100: debit AND credit must both succeed |
| **Consistency** | Database moves from one valid state to another | Balance never goes negative if constraint exists |
| **Isolation** | Concurrent transactions don't interfere | Two users buying last item -- only one succeeds |
| **Durability** | Committed data survives crashes | After commit, data persists even if server restarts |

## 9.2 Spring @Transactional

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

| Propagation | Behavior | Use Case |
|---|---|---|
| `REQUIRED` (default) | Join existing or create new | Most service methods |
| `REQUIRES_NEW` | Always create new (suspend existing) | Audit logging that must persist even if parent fails |
| `SUPPORTS` | Join existing or run non-transactional | Read-only queries |
| `NOT_SUPPORTED` | Suspend existing, run non-transactional | Non-critical operations |
| `MANDATORY` | Must have existing, throw if none | Methods that should never be called directly |
| `NEVER` | Throw if transaction exists | Methods that must not run in a transaction |
| `NESTED` | Create savepoint within existing | Partial rollbacks |

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

## 9.5 Read-Only Transactions

```java
@Transactional(readOnly = true) // Performance optimization
public List<User> getAllActiveUsers() {
    return userRepository.findByStatus(UserStatus.ACTIVE);
    // Hibernate skips dirty checking -- faster!
    // Spring may route to read replica if configured
}
```

---

# Part 10: Spring Data JPA Introduction

## 10.1 What is Spring Data JPA?

**Spring Data JPA** is an abstraction layer on top of JPA/Hibernate that eliminates boilerplate repository code. You define an interface, and Spring generates the implementation at runtime.

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

---

# Part 13: Query Methods in Spring Data JPA

## 13.1 Method Name Query Derivation

Spring Data parses method names and generates JPQL automatically:

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

## 16.1 Dynamic Queries with Specifications

For dashboards or search pages where filters are optional and dynamic.

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

---
