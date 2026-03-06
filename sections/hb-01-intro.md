# Mastering Hibernate ORM & Spring Data JPA -- Internals, Architecture, and Enterprise Usage Guide

---

**Author:** Senior Java Architect
**Target Audience:** Java developers with 3+ years of experience aiming for senior/architect-level roles
**Prerequisites:** Core Java, Spring Boot, SQL fundamentals, JDBC basics

---

# Table of Contents

1. Introduction to ORM
2. What is Hibernate
3. Hibernate Core Architecture
4. Entity Mapping
5. Hibernate Entity Lifecycle
6. Associations in Hibernate
7. Fetching Strategies
8. Hibernate Query Methods
9. Transaction Management
10. Spring Data JPA Introduction
11. Spring Data JPA Architecture
12. Spring Data JPA Repositories
13. Query Methods in Spring Data JPA
14. Custom Queries
15. Pagination and Sorting
16. Spring Data JPA Specifications
17. Performance Optimization
18. Hibernate Caching
19. Common Performance Problems
20. Real Production Scenario
21. Microservices Data Strategy
22. Design Patterns Used
23. Best Practices
24. Interview Questions (100+)
25. Coding Exercises (20)

---

# Part 1: Introduction to ORM

## 1.1 What is ORM (Object Relational Mapping)?

**ORM** is a programming technique that maps objects in an object-oriented language (Java) to rows in a relational database. Instead of writing raw SQL and manually mapping ResultSets to Java objects, ORM frameworks handle this automatically.

```
Without ORM (Raw JDBC):
Java Object  -->  Manual SQL  -->  ResultSet  -->  Manual Mapping  -->  Java Object

With ORM (Hibernate):
Java Object  <-->  ORM Framework  <-->  Database
              (automatic mapping)
```

### Manual JDBC Example (What ORM Eliminates)
```java
// WITHOUT ORM -- Manual, error-prone, tedious
public User findById(Long id) {
    Connection conn = dataSource.getConnection();
    PreparedStatement ps = conn.prepareStatement(
        "SELECT id, name, email, created_at FROM users WHERE id = ?");
    ps.setLong(1, id);
    ResultSet rs = ps.executeQuery();

    User user = null;
    if (rs.next()) {
        user = new User();
        user.setId(rs.getLong("id"));
        user.setName(rs.getString("name"));
        user.setEmail(rs.getString("email"));
        user.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
    }
    rs.close(); ps.close(); conn.close();
    return user;
}

// WITH ORM (Hibernate/JPA) -- Clean, type-safe, automatic
public User findById(Long id) {
    return entityManager.find(User.class, id); // That's it!
}
```

## 1.2 Object Model vs Relational Model

| Aspect | Object Model (Java) | Relational Model (SQL) |
|---|---|---|
| **Structure** | Classes with fields and methods | Tables with columns |
| **Identity** | Object reference (`==`, `.equals()`) | Primary key |
| **Relationships** | References (composition, inheritance) | Foreign keys, join tables |
| **Inheritance** | Class hierarchy (extends) | No native support |
| **Encapsulation** | Private fields + methods | All columns exposed |
| **Navigation** | `user.getOrders().get(0).getItems()` | JOIN queries |
| **Collections** | `List<Order>`, `Set<Item>` | Separate tables |

## 1.3 Object-Relational Impedance Mismatch

The fundamental conflict between how data is represented in objects vs tables:

| Mismatch Area | Problem | ORM Solution |
|---|---|---|
| **Granularity** | Object can have fine-grained types (Address, Money) | `@Embeddable` maps value objects |
| **Inheritance** | Java has class hierarchies; SQL has no inheritance | `@Inheritance` strategies (SINGLE_TABLE, JOINED, TABLE_PER_CLASS) |
| **Identity** | Java: reference equality vs `.equals()` | `@Id` maps to primary key |
| **Associations** | Java: object references; SQL: foreign keys | `@ManyToOne`, `@OneToMany` map relationships |
| **Data Navigation** | Java: traverse object graph; SQL: explicit JOINs | Lazy loading, fetch strategies |

## 1.4 Problems ORM Solves

### Data Mapping
```java
// ORM maps this automatically:
@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;                    // -> id BIGINT PRIMARY KEY

    @Column(nullable = false)
    private String name;                // -> name VARCHAR(255) NOT NULL

    @Column(unique = true)
    private String email;               // -> email VARCHAR(255) UNIQUE

    @Enumerated(EnumType.STRING)
    private UserStatus status;          // -> status VARCHAR(255)

    private LocalDateTime createdAt;    // -> created_at TIMESTAMP
}
```

### Identity Management
```java
// ORM guarantees: same DB row = same Java object within a session
User u1 = entityManager.find(User.class, 1L);
User u2 = entityManager.find(User.class, 1L);
assert u1 == u2; // TRUE -- same object reference (1st level cache)
```

### Transaction Handling
```java
// ORM + Spring manages transactions declaratively
@Transactional
public void transferFunds(Long fromId, Long toId, BigDecimal amount) {
    Account from = accountRepository.findById(fromId).orElseThrow();
    Account to = accountRepository.findById(toId).orElseThrow();
    from.debit(amount);
    to.credit(amount);
    // Auto-committed on success, auto-rolled back on exception
}
```

---

# Part 2: What is Hibernate

## 2.1 What is Hibernate?

**Hibernate** is the most popular ORM framework for Java. It implements the **JPA (Java Persistence API)** specification and provides additional features beyond the standard.

| Aspect | Details |
|---|---|
| **Type** | ORM framework |
| **Implements** | JPA 3.1 (Jakarta Persistence) |
| **Created by** | Gavin King (2001) |
| **Current version** | Hibernate 6.x |
| **License** | LGPL (open source) |

### Why Hibernate Became Popular

1. **Eliminates boilerplate** -- No manual SQL, ResultSet mapping, connection management
2. **Database portability** -- Switch from MySQL to PostgreSQL without changing code
3. **Automatic schema generation** -- Create/update tables from entity classes
4. **Caching** -- Built-in first-level cache, pluggable second-level cache
5. **Lazy loading** -- Load associated data only when accessed
6. **Dirty checking** -- Automatically detects and persists state changes

## 2.2 How Hibernate Works Internally

```
+---------------------------------------------+
|           Java Application                   |
|  (Entities, Services, Repositories)          |
+---------------------------------------------+
         |  persist()  find()  merge()
         v
+---------------------------------------------+
|         Hibernate ORM Layer                  |
|  +------------+  +-------------+             |
|  | Session    |  | Transaction |             |
|  | Factory    |  | Manager     |             |
|  +------------+  +-------------+             |
|  +------------+  +-------------+             |
|  | 1st Level  |  | Query       |             |
|  | Cache      |  | Translator  |             |
|  +------------+  +-------------+             |
|  +------------+                              |
|  | Dialect    | (MySQL, PostgreSQL, Oracle)   |
|  +------------+                              |
+---------------------------------------------+
         |  SQL statements
         v
+---------------------------------------------+
|              JDBC Driver                     |
+---------------------------------------------+
         |
         v
+---------------------------------------------+
|        Relational Database                   |
|   (MySQL, PostgreSQL, Oracle, H2)            |
+---------------------------------------------+
```

### Internal Flow: Saving an Entity
```
1. Application calls entityManager.persist(user)
2. Hibernate assigns ID (via strategy)
3. Entity added to Persistence Context (1st level cache)
4. Entity marked as "dirty" (new)
5. On transaction commit / flush:
   a. Hibernate generates INSERT SQL using Dialect
   b. SQL sent to JDBC driver
   c. JDBC executes against database
   d. Entity state changed to "persistent"
```

---

# Part 3: Hibernate Core Architecture

## 3.1 SessionFactory

**What:** A heavyweight, thread-safe, immutable factory for creating Sessions. Built once at application startup from configuration.

**Why:** Creating database connections is expensive. SessionFactory pre-configures mappings, caches, and connection pools.

**When:** One per database per application (singleton).

```java
// Spring Boot auto-configures this -- you rarely create it manually
// But understanding it is critical for interviews

// Manual creation (non-Spring):
Configuration config = new Configuration()
    .configure("hibernate.cfg.xml")
    .addAnnotatedClass(User.class);
SessionFactory factory = config.buildSessionFactory();

// In Spring Boot: auto-configured as EntityManagerFactory
@Autowired
private EntityManagerFactory entityManagerFactory;
// EntityManagerFactory wraps SessionFactory (JPA standard interface)
```

## 3.2 Session (EntityManager)

**What:** A lightweight, short-lived, non-thread-safe object representing a unit of work. Wraps a JDBC connection. **JPA equivalent: EntityManager.**

**Why:** Provides the API for CRUD operations and serves as the first-level cache (persistence context).

**When:** One per request/transaction (request-scoped in web applications).

```java
// Session operations
Session session = sessionFactory.openSession();

// JPA equivalent (what Spring uses)
EntityManager em = entityManagerFactory.createEntityManager();

// CRUD operations
em.persist(user);              // INSERT
User u = em.find(User.class, 1L);  // SELECT by ID
em.merge(user);                // UPDATE
em.remove(user);               // DELETE
```

## 3.3 Transaction

**What:** Wraps a database transaction. Ensures ACID properties.

```java
// Manual transaction (non-Spring)
Session session = sessionFactory.openSession();
Transaction tx = session.beginTransaction();
try {
    session.persist(user);
    tx.commit();
} catch (Exception e) {
    tx.rollback();
    throw e;
} finally {
    session.close();
}

// Spring manages this with @Transactional -- much cleaner!
@Transactional
public void createUser(User user) {
    entityManager.persist(user); // Auto-commit or rollback
}
```

## 3.4 Hibernate Dialect

**What:** Translates HQL/JPQL to database-specific SQL.

| Database | Dialect Class |
|---|---|
| MySQL 8 | `org.hibernate.dialect.MySQLDialect` |
| PostgreSQL | `org.hibernate.dialect.PostgreSQLDialect` |
| Oracle | `org.hibernate.dialect.OracleDialect` |
| H2 | `org.hibernate.dialect.H2Dialect` |
| SQL Server | `org.hibernate.dialect.SQLServerDialect` |

```yaml
# application.yml
spring:
  jpa:
    database-platform: org.hibernate.dialect.PostgreSQLDialect
    properties:
      hibernate:
        format_sql: true
        show_sql: true
```

---

# Part 4: Entity Mapping

## 4.1 Basic Annotations

### @Entity
Marks a Java class as a persistent entity mapped to a database table.
```java
@Entity // Required -- tells Hibernate "this is a database table"
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name; // Maps to column "name" by default
}
```

### @Table
Customizes the table name and constraints.
```java
@Entity
@Table(
    name = "products",
    schema = "ecommerce",
    uniqueConstraints = @UniqueConstraint(columnNames = {"sku", "region"}),
    indexes = @Index(name = "idx_product_name", columnList = "name")
)
public class Product { ... }
```

### @Id and @GeneratedValue

| Strategy | Description | Database | Use When |
|---|---|---|---|
| `IDENTITY` | Auto-increment column | MySQL, PostgreSQL | Single DB, simple apps |
| `SEQUENCE` | Database sequence | PostgreSQL, Oracle | High-performance batch inserts |
| `TABLE` | Uses a separate table | All | Portable but slow |
| `UUID` | UUID generation | All | Distributed systems |
| `AUTO` | Hibernate picks best | Varies | Default (not recommended) |

```java
// IDENTITY (MySQL, PostgreSQL auto-increment)
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;

// SEQUENCE (PostgreSQL, Oracle -- preferred for performance)
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE,
    generator = "product_seq")
@SequenceGenerator(name = "product_seq",
    sequenceName = "product_sequence",
    allocationSize = 50) // Pre-allocate 50 IDs -- huge performance gain
private Long id;

// UUID (distributed systems)
@Id
@GeneratedValue(strategy = GenerationType.UUID)
private UUID id;
```

### @Column
```java
@Column(
    name = "product_name",    // Column name (default: field name)
    nullable = false,         // NOT NULL constraint
    unique = true,            // UNIQUE constraint
    length = 150,             // VARCHAR length (default 255)
    precision = 10,           // Decimal precision
    scale = 2,                // Decimal scale
    columnDefinition = "TEXT" // Raw SQL column definition
)
private String name;
```

## 4.2 Composite Keys

```java
// Method 1: @EmbeddedId
@Embeddable
public class OrderItemId implements Serializable {
    private Long orderId;
    private Long productId;

    // Constructors, equals(), hashCode() -- REQUIRED
}

@Entity
public class OrderItem {
    @EmbeddedId
    private OrderItemId id;

    private int quantity;
    private BigDecimal price;
}

// Method 2: @IdClass
@Entity
@IdClass(OrderItemId.class)
public class OrderItem {
    @Id private Long orderId;
    @Id private Long productId;
    private int quantity;
}
```

## 4.3 Embedded Objects (Value Objects)

```java
@Embeddable
public class Address {
    private String street;
    private String city;
    private String state;

    @Column(length = 10)
    private String zipCode;
}

@Entity
public class Customer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "street",
            column = @Column(name = "billing_street")),
        @AttributeOverride(name = "city",
            column = @Column(name = "billing_city"))
    })
    private Address billingAddress;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "street",
            column = @Column(name = "shipping_street")),
        @AttributeOverride(name = "city",
            column = @Column(name = "shipping_city"))
    })
    private Address shippingAddress;
}
// Result: ONE table "customer" with columns:
// id, name, billing_street, billing_city, ..., shipping_street, shipping_city
```

## 4.4 Enums and Temporal Types

```java
@Entity
public class Employee {

    @Enumerated(EnumType.STRING) // Store "ACTIVE", not 0
    private EmployeeStatus status;

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

---

# Part 5: Hibernate Entity Lifecycle

## 5.1 Entity States

```
                  new Entity()
                      |
                      v
               +-------------+
               |  TRANSIENT  |   Not managed, no ID, not in DB
               +-------------+
                      |
                persist()
                      |
                      v
               +-------------+
               | PERSISTENT  |   Managed by Session, has ID, in DB
               +-------------+   Changes auto-detected (dirty checking)
                 |         |
        detach()/close()   remove()
                 |         |
                 v         v
          +----------+  +---------+
          | DETACHED |  | REMOVED |
          +----------+  +---------+
               |              Not managed, scheduled for DELETE
          merge()
               |
               v
          +-------------+
          | PERSISTENT  |   Re-attached to new Session
          +-------------+
```

## 5.2 State Transitions with Code

```java
// TRANSIENT -> New object, not yet associated with Session
User user = new User("John", "john@email.com");
// user is TRANSIENT -- Hibernate doesn't know about it

// TRANSIENT -> PERSISTENT
entityManager.persist(user);
// user is now PERSISTENT -- managed by the persistence context
// Hibernate tracks all changes to this object

// PERSISTENT -- Dirty Checking
user.setEmail("john.updated@email.com");
// NO explicit save/update needed!
// Hibernate detects the change and generates UPDATE on flush/commit

// PERSISTENT -> DETACHED
entityManager.detach(user);
// or: entityManager.close()
// user is DETACHED -- no longer managed
user.setName("Jane"); // This change will NOT be auto-persisted

// DETACHED -> PERSISTENT (re-attach)
User managed = entityManager.merge(user);
// 'managed' is PERSISTENT; 'user' is still DETACHED
// Use the returned reference!

// PERSISTENT -> REMOVED
entityManager.remove(managed);
// Entity scheduled for DELETE on flush/commit
```

## 5.3 Important Details

| State | In Session? | Has ID? | In DB? | Changes Tracked? |
|---|---|---|---|---|
| **Transient** | No | No | No | No |
| **Persistent** | Yes | Yes | Yes (or pending INSERT) | Yes (dirty checking) |
| **Detached** | No | Yes | Yes | No |
| **Removed** | Yes | Yes | Yes (pending DELETE) | No |

---

# Part 6: Associations in Hibernate

## 6.1 @ManyToOne (Most Common)

```java
@Entity
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) // LAZY is best practice!
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    private BigDecimal totalAmount;
}
// DB: orders table has customer_id FK column
```

## 6.2 @OneToMany (Inverse Side)

```java
@Entity
public class Customer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;

    @OneToMany(mappedBy = "customer", // Inverse side -- no FK column here
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Order> orders = new ArrayList<>();

    // Helper methods to maintain bidirectional consistency
    public void addOrder(Order order) {
        orders.add(order);
        order.setCustomer(this);
    }

    public void removeOrder(Order order) {
        orders.remove(order);
        order.setCustomer(null);
    }
}
```

## 6.3 @OneToOne

```java
@Entity
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JoinColumn(name = "profile_id", unique = true)
    private UserProfile profile;
}

@Entity
public class UserProfile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(mappedBy = "profile")
    private User user;

    private String bio;
    private String avatarUrl;
}
```

## 6.4 @ManyToMany

```java
@Entity
public class Student {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToMany
    @JoinTable(
        name = "student_courses",
        joinColumns = @JoinColumn(name = "student_id"),
        inverseJoinColumns = @JoinColumn(name = "course_id")
    )
    private Set<Course> courses = new HashSet<>();
}

@Entity
public class Course {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToMany(mappedBy = "courses")
    private Set<Student> students = new HashSet<>();
}
```

## 6.5 Cascade Types

| Cascade Type | Effect | When to Use |
|---|---|---|
| `PERSIST` | Save child when parent is saved | Parent-child relationships |
| `MERGE` | Update child when parent is updated | Almost always with PERSIST |
| `REMOVE` | Delete child when parent is deleted | Owned relationships |
| `REFRESH` | Refresh child when parent is refreshed | Rare |
| `DETACH` | Detach child when parent is detached | Rare |
| `ALL` | All of the above | Strong parent-child ownership |

## 6.6 Owning Side vs Inverse Side

| Concept | Owning Side | Inverse Side |
|---|---|---|
| **Has the FK** | Yes (JoinColumn) | No |
| **Controls relationship** | Yes | No -- uses `mappedBy` |
| **Annotation** | `@JoinColumn` | `mappedBy = "fieldName"` |
| **Example** | `Order.customer` (has customer_id FK) | `Customer.orders` (no FK) |

**Rule:** The side with the foreign key is always the owning side. In `@ManyToOne`, the "Many" side always owns.

---

# Part 7: Fetching Strategies

## 7.1 Lazy vs Eager Loading

### Lazy Loading (Default for Collections)
```java
@OneToMany(mappedBy = "customer", fetch = FetchType.LAZY)
private List<Order> orders;
// SQL: Only loads Customer. Orders loaded ONLY when accessed.
// SELECT * FROM customers WHERE id = ?
// ... later when customer.getOrders() is called:
// SELECT * FROM orders WHERE customer_id = ?
```

### Eager Loading
```java
@ManyToOne(fetch = FetchType.EAGER)
private Customer customer;
// SQL: Loads Customer AND related data immediately via JOIN
// SELECT c.*, o.* FROM customers c JOIN orders o ON ...
```

### Defaults

| Association | Default Fetch Type |
|---|---|
| `@ManyToOne` | EAGER |
| `@OneToOne` | EAGER |
| `@OneToMany` | LAZY |
| `@ManyToMany` | LAZY |

**Best Practice:** Always set `@ManyToOne(fetch = FetchType.LAZY)` and `@OneToOne(fetch = FetchType.LAZY)`. Override defaults.

## 7.2 The N+1 Query Problem

The most common Hibernate performance problem in production.

```java
// N+1 Problem Example:
List<Customer> customers = customerRepository.findAll();
// Query 1: SELECT * FROM customers  (returns 100 customers)

for (Customer c : customers) {
    System.out.println(c.getOrders().size());
    // Query 2: SELECT * FROM orders WHERE customer_id = 1
    // Query 3: SELECT * FROM orders WHERE customer_id = 2
    // ...
    // Query 101: SELECT * FROM orders WHERE customer_id = 100
}
// TOTAL: 1 + 100 = 101 queries! Extremely slow!
```

### Solution 1: JOIN FETCH (JPQL)
```java
@Query("SELECT c FROM Customer c JOIN FETCH c.orders")
List<Customer> findAllWithOrders();
// Single query: SELECT c.*, o.* FROM customers c JOIN orders o ON ...
```

### Solution 2: @EntityGraph
```java
@EntityGraph(attributePaths = {"orders"})
List<Customer> findAll();
// Generates LEFT JOIN FETCH automatically
```

### Solution 3: @BatchSize
```java
@OneToMany(mappedBy = "customer")
@BatchSize(size = 25)
private List<Order> orders;
// Instead of 100 queries, fires 4 queries (100/25 = 4 batches):
// SELECT * FROM orders WHERE customer_id IN (1,2,3,...,25)
// SELECT * FROM orders WHERE customer_id IN (26,27,...,50)
// ...
```

---

# Part 8: Hibernate Query Methods

## 8.1 HQL (Hibernate Query Language)

```java
// HQL operates on ENTITIES, not tables
// Hibernate-specific (not portable to other JPA providers)

// Select
List<User> users = session.createQuery(
    "FROM User u WHERE u.status = :status", User.class)
    .setParameter("status", UserStatus.ACTIVE)
    .getResultList();

// Update
int updated = session.createQuery(
    "UPDATE User u SET u.status = :newStatus WHERE u.lastLogin < :cutoff")
    .setParameter("newStatus", UserStatus.INACTIVE)
    .setParameter("cutoff", LocalDateTime.now().minusDays(90))
    .executeUpdate();
```

## 8.2 JPQL (Java Persistence Query Language)

```java
// JPQL is the JPA standard -- portable across ORM providers
// Very similar to HQL

@Query("SELECT u FROM User u WHERE u.email LIKE %:domain")
List<User> findByEmailDomain(@Param("domain") String domain);

@Query("SELECT NEW com.app.dto.UserSummaryDTO(u.id, u.name, u.email) " +
       "FROM User u WHERE u.status = :status")
List<UserSummaryDTO> findUserSummaries(@Param("status") UserStatus status);

// Aggregations
@Query("SELECT u.department, COUNT(u), AVG(u.salary) " +
       "FROM User u GROUP BY u.department")
List<Object[]> getDepartmentStats();
```

## 8.3 Native SQL

```java
// Use actual SQL -- not portable, but supports DB-specific features
@Query(value = "SELECT * FROM users WHERE email LIKE %?1 " +
               "ORDER BY created_at DESC LIMIT 10",
       nativeQuery = true)
List<User> findRecentByEmailDomain(String domain);

// With result mapping
@Query(value = "SELECT u.id, u.name, COUNT(o.id) as order_count " +
               "FROM users u LEFT JOIN orders o ON u.id = o.user_id " +
               "GROUP BY u.id, u.name",
       nativeQuery = true)
List<Object[]> getUserOrderCounts();
```

## 8.4 Comparison

| Feature | HQL | JPQL | Native SQL |
|---|---|---|---|
| **Standard** | Hibernate-specific | JPA standard | Database-specific |
| **Operates on** | Entities | Entities | Tables |
| **Portability** | Hibernate only | Any JPA provider | Not portable |
| **DB functions** | Some | Limited | Full support |
| **Complex queries** | Good | Good | Best |
| **Use when** | Hibernate features needed | Default choice | Complex/optimized SQL |

---
