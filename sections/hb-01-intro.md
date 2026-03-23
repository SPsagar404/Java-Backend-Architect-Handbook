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

### Deep Theory: Why ORM Was Invented

**The Core Problem:** In the early 2000s, enterprise Java projects spent 30-40% of development time writing boilerplate JDBC code. Every entity required manual SQL strings, ResultSet-to-Object mapping, connection lifecycle management, and transaction handling. A single missed `close()` call on a Connection could leak database connections and crash the production server within hours.

**What ORM does internally:**
1. **Metadata scanning** -- At startup, Hibernate reads all `@Entity` annotations, builds an internal "metamodel" mapping each Java class to its database table, each field to its column
2. **SQL generation** -- When you call `persist(user)`, Hibernate consults its metamodel and the configured Dialect to generate the correct INSERT SQL for your specific database
3. **State tracking** -- Hibernate takes a "snapshot" of every loaded entity. On `flush()`/`commit()`, it compares current field values against the snapshot and generates UPDATE SQL only for changed columns
4. **Connection management** -- Hibernate obtains connections from HikariCP, executes SQL, and returns connections to the pool automatically

```
Without ORM (Raw JDBC):
Java Object  -->  Manual SQL  -->  ResultSet  -->  Manual Mapping  -->  Java Object

With ORM (Hibernate):
Java Object  <-->  ORM Framework  <-->  Database
              (automatic mapping)
```

### Real-World Impact: Why This Matters in Production

| Scenario | Without ORM (JDBC) | With ORM (Hibernate) |
|---|---|---|
| **E-commerce: Add a new field** | Change SQL in 15+ DAO methods | Add one field + annotation |
| **Banking: Switch Oracle to PostgreSQL** | Rewrite all SQL queries | Change one Dialect property |
| **Healthcare: Audit compliance** | Manually track every field change | `@EntityListeners` + Envers |
| **Microservices: 20 entities** | 20 DAO classes x 5 methods = 100+ methods | 20 interfaces, zero implementations |

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

### Production Bug That ORM Prevents

**Connection Leak Scenario (JDBC):**
```java
// BUG: If ps.executeQuery() throws, conn is NEVER closed
public User findById(Long id) {
    Connection conn = dataSource.getConnection();
    PreparedStatement ps = conn.prepareStatement("SELECT ...");
    ResultSet rs = ps.executeQuery(); // Exception here -> conn leaked!
    // ... mapping code
    conn.close(); // Never reached
}
// After 20 connections leak, HikariCP pool exhausted -> entire app hangs!
```
With Hibernate, connection lifecycle is managed entirely by the framework. You never open, close, or leak connections.

### When NOT to Use ORM

| Scenario | Use Instead |
|---|---|
| Complex reporting with window functions, CTEs | Native SQL or database views |
| Bulk loading millions of rows | JDBC batch or database COPY command |
| Simple CRUD with 2-3 tables | Spring Data JDBC (lighter weight) |
| NoSQL databases (MongoDB, Cassandra) | Spring Data MongoDB/Cassandra |

## 1.2 Object Model vs Relational Model

### Deep Theory: The Two Worlds

The object model is designed for **behavior** (methods, encapsulation, polymorphism). The relational model is designed for **data integrity** (normalization, constraints, set-based operations). ORM bridges these fundamentally different paradigms.

| Aspect | Object Model (Java) | Relational Model (SQL) |
|---|---|---|
| **Structure** | Classes with fields and methods | Tables with columns |
| **Identity** | Object reference (`==`, `.equals()`) | Primary key |
| **Relationships** | References (composition, inheritance) | Foreign keys, join tables |
| **Inheritance** | Class hierarchy (extends) | No native support |
| **Encapsulation** | Private fields + methods | All columns exposed |
| **Navigation** | `user.getOrders().get(0).getItems()` | JOIN queries |
| **Collections** | `List<Order>`, `Set<Item>` | Separate tables |

### How Senior Architects Think About This

**In Java:** You think in terms of object graphs -- a `Customer` HAS a `List<Order>`, each `Order` HAS a `List<OrderItem>`, each `OrderItem` REFERENCES a `Product`. Navigation is natural: `customer.getOrders().get(0).getItems().get(0).getProduct().getName()`.

**In SQL:** There is no "navigation." To get the same data, you write a 4-table JOIN query. The database has no concept of an "object graph" -- it only knows about rows, columns, and set-based operations.

**Hibernate's job** is to translate between these two mental models transparently, so developers think in objects while the database stores in tables.

## 1.3 Object-Relational Impedance Mismatch

The fundamental conflict between how data is represented in objects vs tables:

| Mismatch Area | Problem | ORM Solution |
|---|---|---|
| **Granularity** | Object can have fine-grained types (Address, Money) | `@Embeddable` maps value objects |
| **Inheritance** | Java has class hierarchies; SQL has no inheritance | `@Inheritance` strategies (SINGLE_TABLE, JOINED, TABLE_PER_CLASS) |
| **Identity** | Java: reference equality vs `.equals()` | `@Id` maps to primary key |
| **Associations** | Java: object references; SQL: foreign keys | `@ManyToOne`, `@OneToMany` map relationships |
| **Data Navigation** | Java: traverse object graph; SQL: explicit JOINs | Lazy loading, fetch strategies |

### Deep Dive: Why Impedance Mismatch Causes Production Bugs

**Granularity Mismatch Example:**
In Java, a `Money` value object has amount + currency. In SQL, this is just two columns. If you use raw JDBC, you must manually combine/split these everywhere. With `@Embeddable`, Hibernate handles this seamlessly.

**Inheritance Mismatch Example:**
In Java, `CreditCardPayment extends Payment` is natural. In SQL, there's NO inheritance. You must choose: one table with NULL columns (SINGLE_TABLE), separate tables with JOINs (JOINED), or completely separate tables (TABLE_PER_CLASS). Each has performance tradeoffs that senior developers must understand.

**Navigation Mismatch Example:**
In Java, `order.getCustomer().getAddress().getCity()` traverses the object graph, potentially triggering 3 separate SQL queries (LazyInitializationException risk). In SQL, you'd write a single JOIN query. This mismatch is the root cause of the N+1 problem.

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

**Why This Matters in Production:** Without identity guarantee, you might load the same user twice, modify one copy, and lose changes from the other copy. Hibernate's first-level cache prevents this data inconsistency.

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

### Dirty Checking (Automatic Change Detection)
```java
@Transactional
public void updateUserEmail(Long userId, String newEmail) {
    User user = userRepository.findById(userId).orElseThrow();
    user.setEmail(newEmail);
    // NO save() call needed! Hibernate detects the change automatically.
    // At commit time, Hibernate compares current state vs loaded snapshot
    // and generates: UPDATE users SET email = ? WHERE id = ?
}
```

**How Dirty Checking Works Internally:**
```
1. findById(1L) -> Hibernate loads User from DB, stores a COPY (snapshot) in Persistence Context
2. user.setEmail("new@email.com") -> Only the live object changes, snapshot untouched
3. Transaction commit triggers flush()
4. Hibernate compares: live.email ("new@email.com") vs snapshot.email ("old@email.com")
5. Difference detected -> generates UPDATE SQL for ONLY the changed field
6. SQL executed, snapshot updated
```

### Interview Questions for Part 1

**Q: What is the object-relational impedance mismatch?**
A: It's the fundamental conflict between Java's object model (inheritance, encapsulation, object graph navigation) and SQL's relational model (tables, foreign keys, set-based operations). ORM frameworks like Hibernate bridge this gap by automatically translating between the two paradigms.

**Q: When would you choose raw JDBC over Hibernate?**
A: For bulk data loading (millions of rows), complex analytics with window functions/CTEs, or when absolute query control is needed for performance-critical paths. In practice, most enterprise apps use Hibernate for 90% of operations and native queries for the remaining 10%.

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

### Deep Theory: JPA vs Hibernate -- The Critical Distinction

**JPA is an interface (specification).** It defines annotations (`@Entity`, `@Id`, `@ManyToOne`) and APIs (`EntityManager`, `Query`) but contains ZERO implementation code. Think of JPA as a Java interface.

**Hibernate is the implementation.** When you call `entityManager.persist(user)`, the actual code that generates SQL, manages the cache, and talks to JDBC is Hibernate's code.

**Why this matters in production:**
- Your code should depend on JPA interfaces (`EntityManager`, `@Entity`), NOT Hibernate-specific classes
- This allows you to theoretically swap Hibernate for EclipseLink or OpenJPA (though this rarely happens in practice)
- Spring Boot auto-configures Hibernate as the default JPA provider

```
Your Code --> JPA API (javax/jakarta.persistence) --> Hibernate Implementation --> JDBC --> Database
```

**Hibernate 6.x Key Changes:**
- Migrated from `javax.persistence` to `jakarta.persistence` (Jakarta EE namespace)
- New Semantic Query Model (SQM) replaces the old AST-based query parser
- Improved type system with better SQL type inference
- Built-in support for Java Records as DTOs

### Why Hibernate Became Popular

1. **Eliminates boilerplate** -- No manual SQL, ResultSet mapping, connection management
2. **Database portability** -- Switch from MySQL to PostgreSQL without changing code
3. **Automatic schema generation** -- Create/update tables from entity classes
4. **Caching** -- Built-in first-level cache, pluggable second-level cache
5. **Lazy loading** -- Load associated data only when accessed
6. **Dirty checking** -- Automatically detects and persists state changes

### How Spring Boot Auto-Configures Hibernate

When you add `spring-boot-starter-data-jpa` to your project, Spring Boot automatically:

```
1. Detects Hibernate on classpath (it ships with the starter)
2. Creates HikariCP DataSource from application.yml properties
3. Creates LocalContainerEntityManagerFactoryBean
4. Scans for @Entity classes in your base package
5. Builds SessionFactory (wrapped as EntityManagerFactory)
6. Creates PlatformTransactionManager (JpaTransactionManager)
7. Registers Spring Data JPA repositories
```

**Result:** Zero manual Hibernate configuration needed. You just write entities and repositories.

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

### Deep Dive: What Happens Inside persist()

```
entityManager.persist(user)
  |
  v
SessionImpl.persist(user)
  |
  v
ActionQueue.addAction(EntityInsertAction)
  |-- Entity added to Persistence Context (IdentityMap)
  |-- Snapshot of entity state captured
  |-- ID generated (depends on strategy):
  |     IDENTITY -> Must execute INSERT immediately to get auto-generated ID
  |     SEQUENCE -> Pre-allocates IDs from sequence (batch-friendly)
  |     UUID     -> Generated in Java, no DB call needed
  |
  v
On flush() / commit():
  |
  v
ActionQueue.executeActions()
  |-- Sorts actions by entity type (for batching)
  |-- Generates SQL via Dialect
  |-- Executes via PreparedStatement (JDBC)
  |-- Updates entity state to MANAGED
```

**Why IDENTITY disables batch inserts:** With `GenerationType.IDENTITY`, Hibernate must execute an INSERT immediately upon `persist()` to retrieve the auto-generated ID from the database. This breaks batching because each INSERT must be executed individually. Use `SEQUENCE` with `allocationSize=50` for batch-friendly ID generation.

### Monolithic vs Microservices: Hibernate Configuration

| Aspect | Monolithic | Microservices |
|---|---|---|
| **SessionFactory** | One per application | One per service |
| **Database** | Single shared database | Database per service |
| **Transactions** | Single `@Transactional` spans all tables | Each service manages its own transactions |
| **Entity relationships** | Full JPA relationships across all entities | NO cross-service entity relationships |
| **Data consistency** | ACID (single DB transaction) | Eventual consistency (Saga pattern) |

### Interview Questions for Part 2

**Q: What is the difference between JPA and Hibernate?**
A: JPA is a specification (set of interfaces and annotations). Hibernate is an implementation that provides the actual code behind those interfaces. Your application code should depend on JPA interfaces, while Spring Boot configures Hibernate as the JPA provider behind the scenes.

**Q: Why does GenerationType.IDENTITY disable batch inserts?**
A: Because IDENTITY relies on database auto-increment. Hibernate must execute each INSERT individually to retrieve the generated ID. With SEQUENCE, Hibernate can pre-allocate a block of IDs (allocationSize=50) and batch 50 INSERTs in a single JDBC call.

---

# Part 3: Hibernate Core Architecture

## 3.1 SessionFactory

**What:** A heavyweight, thread-safe, immutable factory for creating Sessions. Built once at application startup from configuration.

**Why:** Creating database connections is expensive. SessionFactory pre-configures mappings, caches, and connection pools.

**When:** One per database per application (singleton).

### Deep Theory: What SessionFactory Contains Internally

When Hibernate builds a SessionFactory at startup, it performs expensive one-time initialization:

```
SessionFactory contains:
  |
  +-- Entity Metamodel (compiled @Entity mappings)
  |     Each entity class -> table name, column mappings, relationship graph
  |
  +-- Named Query Cache (pre-compiled @NamedQuery / @Query definitions)
  |     Queries validated at startup (fail-fast if JPQL has errors)
  |
  +-- Connection Pool Reference (HikariCP DataSource)
  |     Manages physical database connections
  |
  +-- Second-Level Cache Configuration (if enabled)
  |     Cache regions per entity type
  |
  +-- Dialect Instance
  |     Database-specific SQL generation rules
  |
  +-- Type Registry
        Java type -> SQL type mappings
```

**Production Impact:** Because SessionFactory is so expensive to build (parses all entities, validates all named queries, connects to database), it should NEVER be created per-request. A misconfigured Spring application that accidentally creates multiple SessionFactories will consume excessive memory and slow startup dramatically.

**How to detect:** If your Spring Boot app takes 30+ seconds to start, check for multiple `EntityManagerFactory` beans or duplicate `@EntityScan` configurations.

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

### Production Scenario: Multiple DataSources

In a monolithic app that reads from a primary DB and a legacy DB:
```java
// Primary SessionFactory
@Primary
@Bean
public LocalContainerEntityManagerFactoryBean primaryEMF(DataSource primaryDS) {
    // ... configured for primary database
}

// Legacy SessionFactory
@Bean
public LocalContainerEntityManagerFactoryBean legacyEMF(DataSource legacyDS) {
    // ... configured for legacy read-only database
}
// Each SessionFactory = separate persistence unit = separate 1st/2nd level caches
```

## 3.2 Session (EntityManager)

**What:** A lightweight, short-lived, non-thread-safe object representing a unit of work. Wraps a JDBC connection. **JPA equivalent: EntityManager.**

**Why:** Provides the API for CRUD operations and serves as the first-level cache (persistence context).

**When:** One per request/transaction (request-scoped in web applications).

### Deep Theory: Why Session is NOT Thread-Safe

The Session maintains an internal `IdentityMap` (the first-level cache) that maps entity IDs to object references. This map is NOT synchronized. If two threads share a Session:
- Thread A loads User(id=1), puts it in the IdentityMap
- Thread B loads User(id=1), gets Thread A's reference
- Thread A modifies User.name = "Alice"
- Thread B reads User.name -- sees "Alice" (corrupted data!)

**Spring Boot's solution:** Spring wraps the EntityManager in a thread-bound proxy. Each HTTP request thread gets its own EntityManager via `@PersistenceContext`.

```java
@PersistenceContext
private EntityManager em; // This is a PROXY, not the actual EntityManager
// Spring creates a real EntityManager per thread from the SessionFactory
```

### Deep Dive: The Persistence Context

The Persistence Context is the "heart" of Hibernate. It is a Map inside each Session:

```
Persistence Context (inside Session):
  Key: EntityKey(type=User.class, id=1)  ->  Value: User@abc (Java object reference)
  Key: EntityKey(type=User.class, id=2)  ->  Value: User@def
  Key: EntityKey(type=Order.class, id=5) ->  Value: Order@ghi

Also stores:
  - Entity snapshots (loaded state for dirty checking)
  - Pending actions queue (INSERT, UPDATE, DELETE)
  - Collection entries (lazy proxy references)
```

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

### Production Problem: Bloated Persistence Context

**Scenario:** A batch job loads 100,000 entities for processing:
```java
// BAD: Persistence Context grows to 100K entities -> OutOfMemoryError
@Transactional
public void processAll() {
    List<User> users = userRepository.findAll(); // 100K entities loaded!
    users.forEach(u -> u.setProcessed(true));
    // At flush: Hibernate dirty-checks ALL 100K entities -> extremely slow
}

// GOOD: Process in batches, clear persistence context periodically
@Transactional
public void processAll() {
    int page = 0;
    Page<User> batch;
    do {
        batch = userRepository.findAll(PageRequest.of(page, 500));
        batch.forEach(u -> u.setProcessed(true));
        entityManager.flush();  // Execute pending UPDATEs
        entityManager.clear();  // Clear 1st level cache -> free memory
        page++;
    } while (batch.hasNext());
}
```

## 3.3 Transaction

**What:** Wraps a database transaction. Ensures ACID properties.

### Deep Theory: How @Transactional Works Under the Hood

```
1. Spring creates a CGLIB proxy around your @Service class
2. When a @Transactional method is called from OUTSIDE the class:
   a. Proxy intercepts the method call
   b. TransactionInterceptor obtains a Connection from HikariCP
   c. Sets auto-commit = false on the Connection
   d. Binds Connection to current thread (ThreadLocal)
   e. Calls your actual method
   f. On success: Connection.commit()
   g. On RuntimeException: Connection.rollback()
   h. Returns Connection to pool
```

**Critical Gotcha -- Self-Invocation:**
```java
@Service
public class OrderService {
    
    @Transactional
    public void placeOrder(OrderRequest req) {
        // ...
        this.logAudit(req); // BUG! Self-invocation bypasses proxy!
    }
    
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAudit(OrderRequest req) {
        // This does NOT run in a new transaction!
        // The proxy is bypassed when calling methods within the same class.
    }
}

// Fix: Inject self or extract to a separate class
@Autowired private OrderService self; // Inject proxy reference
self.logAudit(req); // Now goes through the proxy -> new transaction
```

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

### Deep Theory: Why Dialects Exist

Different databases implement SQL differently:
- **Pagination:** MySQL uses `LIMIT 10 OFFSET 20`, Oracle uses `FETCH FIRST 10 ROWS ONLY`, SQL Server uses `TOP 10`
- **ID Generation:** PostgreSQL has `SEQUENCE`, MySQL uses `AUTO_INCREMENT`
- **Data Types:** PostgreSQL has `TEXT`, `JSONB`, `UUID`; MySQL uses `LONGTEXT`, `JSON`
- **Locking:** PostgreSQL uses `SELECT ... FOR UPDATE SKIP LOCKED`, Oracle syntax differs

The Hibernate Dialect translates your database-agnostic JPQL into the correct SQL for your target database. This is how you achieve **database portability** -- the same Java code runs on any supported database.

**Production Scenario -- Database Migration:**
A healthcare company migrates from Oracle to PostgreSQL to save licensing costs. With Hibernate, the migration involves:
1. Change `database-platform` in `application.yml`
2. Update JDBC URL and driver
3. Test all native queries (which are NOT portable)
4. Run Flyway migrations to recreate schema

NO changes to entity classes, repositories, or service logic.

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

### Interview Questions for Part 3

**Q: What is the difference between SessionFactory and Session?**
A: SessionFactory is heavyweight, thread-safe, created once at startup (singleton). It holds compiled entity mappings, caches, and connection pool config. Session is lightweight, non-thread-safe, created per-request/transaction. Session IS the persistence context (first-level cache) and wraps a JDBC connection.

**Q: Why is Session NOT thread-safe? How does Spring handle this?**
A: Session maintains an unsynchronized IdentityMap. Spring injects a thread-bound proxy via `@PersistenceContext`. Each HTTP request thread gets its own real EntityManager, ensuring thread isolation.

**Q: What happens if you accidentally create two SessionFactory instances?**
A: You get double memory consumption (two metamodels, two caches), potential data inconsistency (entity loaded in SessionFactory-1 is invisible to SessionFactory-2's cache), and slow startup. This is a common misconfiguration bug.

---

# Part 4: Entity Mapping

## 4.1 Basic Annotations

### Deep Theory: What Makes a Valid @Entity

Hibernate requires specific conditions for an `@Entity` class:
1. Must be a **top-level class** or a `static` inner class (non-static inner classes can't be instantiated via reflection)
2. Must have a **no-argument constructor** (can be `protected` -- Hibernate uses reflection)
3. Must NOT be `final` (Hibernate creates CGLIB proxies for lazy loading)
4. Must have an `@Id` field (every entity needs a primary key)
5. Should implement `Serializable` if used in second-level cache or distributed sessions

**Production Bug -- Final Entity:**
```java
@Entity
public final class Product { ... } // BUG! Hibernate cannot create lazy proxy
// Result: LazyInitializationException or forced EAGER loading
```

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

**Why @Index matters in production:** Without database indexes on frequently queried columns, SELECT queries scan the entire table. A table with 10 million rows and no index on `name` takes 2-5 seconds per query. With an index: < 5 milliseconds.

### @Id and @GeneratedValue

| Strategy | Description | Database | Use When |
|---|---|---|---|
| `IDENTITY` | Auto-increment column | MySQL, PostgreSQL | Single DB, simple apps |
| `SEQUENCE` | Database sequence | PostgreSQL, Oracle | High-performance batch inserts |
| `TABLE` | Uses a separate table | All | Portable but slow |
| `UUID` | UUID generation | All | Distributed systems |
| `AUTO` | Hibernate picks best | Varies | Default (not recommended) |

### Deep Dive: Why SEQUENCE is Superior for Performance

```
IDENTITY strategy:
  persist(user1) -> INSERT INTO users ... (must execute NOW to get ID) -> id=1
  persist(user2) -> INSERT INTO users ... (must execute NOW to get ID) -> id=2
  persist(user3) -> INSERT INTO users ... (must execute NOW to get ID) -> id=3
  Result: 3 individual INSERT statements (no batching possible)

SEQUENCE strategy (allocationSize=50):
  persist(user1) -> SELECT nextval('user_seq') -> returns 1 (allocates IDs 1-50)
  persist(user2) -> Uses pre-allocated ID 2 (no DB call!)
  persist(user3) -> Uses pre-allocated ID 3 (no DB call!)
  ... on flush:
  Result: Single batch INSERT for all 3 users (JDBC batching enabled!)
```

**Performance numbers:** Inserting 10,000 entities:
- IDENTITY: ~10,000 individual INSERTs = 8-12 seconds
- SEQUENCE (allocationSize=50): ~200 batch INSERTs = 0.5-1 second (10x faster)

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

**When to use UUID:** In microservices where multiple services insert into their own databases, and IDs must be globally unique. UUID eliminates the need for a centralized sequence. Tradeoff: UUIDs are 128-bit (larger index), and random UUIDs cause B-tree fragmentation. Use ordered UUIDs (UUIDv7) to mitigate.

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

### When to Use Composite Keys

**Use composite keys when:** The business domain naturally identifies entities by multiple columns (e.g., a student's enrollment is identified by student_id + course_id). Common in legacy databases and many-to-many join tables with extra attributes.

**Architect's preference:** Most modern systems use a surrogate `@Id Long id` instead. Composite keys complicate queries, caching, and JPA/Spring Data integration.

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

**Critical: equals() and hashCode() are REQUIRED.** Hibernate uses these for identity checking in the persistence context. If missing, two entities with the same composite key will be treated as different objects, causing data inconsistency.

## 4.3 Embedded Objects (Value Objects)

### Deep Theory: Value Objects in Domain-Driven Design

An `@Embeddable` represents a **value object** -- something that has no identity of its own. An Address is not an independent entity; it exists only as part of a Customer. It has no lifecycle of its own and no primary key.

**Architect's Rule:** If it has NO independent identity, use `@Embeddable`. If it has its own lifecycle and is referenced by multiple entities, use `@Entity` with `@OneToOne`.

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

**Real-World Usage:** E-commerce systems commonly embed `Money` (amount + currency), `DateRange` (start + end), and `GeoLocation` (lat + lng) as value objects.

## 4.4 Enums and Temporal Types

### Deep Theory: EnumType.ORDINAL vs EnumType.STRING

**NEVER use `EnumType.ORDINAL` in production!** Ordinal stores the enum's position (0, 1, 2...). If someone reorders the enum constants or adds a new value between existing ones, ALL existing data becomes corrupt.

```java
// DANGEROUS: ordinal values
public enum Status { ACTIVE, INACTIVE, SUSPENDED }
// ACTIVE=0, INACTIVE=1, SUSPENDED=2

// Someone adds a new status:
public enum Status { ACTIVE, PENDING, INACTIVE, SUSPENDED }
// Now: ACTIVE=0, PENDING=1, INACTIVE=2, SUSPENDED=3
// All rows with ordinal=1 (which were INACTIVE) now map to PENDING! DATA CORRUPTION!
```

**Always use `EnumType.STRING`** -- stores the enum name as text. Immune to reordering.

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

### Interview Questions for Part 4

**Q: Why should you NEVER use EnumType.ORDINAL?**
A: Because it stores the enum's positional index (0, 1, 2). If someone reorders the enum or inserts a new constant, all existing database values silently map to wrong enum constants, causing data corruption that's extremely difficult to detect and fix.

**Q: Why does SEQUENCE strategy outperform IDENTITY for batch inserts?**
A: SEQUENCE pre-allocates a block of IDs (e.g., 50) in a single DB call, allowing Hibernate to assign IDs in-memory and batch multiple INSERTs in a single JDBC call. IDENTITY requires an individual INSERT per entity to retrieve the auto-generated ID.

---

# Part 5: Hibernate Entity Lifecycle

## 5.1 Entity States

### Deep Theory: Why Entity States Matter

Understanding entity states is the single most important concept for debugging Hibernate issues in production. Every "mysterious" bug -- unexpected UPDATEs, missing data, `LazyInitializationException`, stale data -- traces back to the entity being in the wrong state.

**The key insight:** Hibernate only tracks changes to **Persistent** entities. If your entity is Transient or Detached, modifications are silently ignored. This is the #1 source of "my save isn't working" bugs.

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

### Production Bug: merge() Returns a NEW Reference

```java
// COMMON BUG:
User detached = getDetachedUser();
entityManager.merge(detached);
detached.setName("Updated"); // BUG! 'detached' is still DETACHED!

// CORRECT:
User managed = entityManager.merge(detached);
managed.setName("Updated"); // 'managed' is PERSISTENT -- change tracked!
```

### Deep Dive: How Dirty Checking Works Internally

```
1. When entity is loaded (find/query), Hibernate stores a SNAPSHOT:
   snapshot = { name: "John", email: "john@email.com", status: "ACTIVE" }
   
2. Your code modifies the entity:
   user.setEmail("john.new@email.com")
   
3. On flush(), Hibernate compares EVERY field:
   current.name == snapshot.name?  YES -> skip
   current.email == snapshot.email? NO  -> mark dirty
   current.status == snapshot.status? YES -> skip
   
4. Only dirty fields generate SQL:
   UPDATE users SET email = 'john.new@email.com' WHERE id = 1
   (NOT: UPDATE users SET name='John', email='john.new@email.com', status='ACTIVE' WHERE id = 1)
```

**Performance concern:** Dirty checking compares ALL fields of ALL persistent entities on every flush. With 10,000 entities in the persistence context, each having 20 fields, that's 200,000 comparisons per flush. This is why `@Transactional(readOnly = true)` is a performance optimization -- it tells Hibernate to skip dirty checking entirely.

**@DynamicUpdate:** By default, Hibernate generates UPDATE statements with ALL columns (for statement caching efficiency). Use `@DynamicUpdate` on entities with many columns to generate UPDATEs with only changed columns, reducing database I/O.

## 5.3 Important Details

| State | In Session? | Has ID? | In DB? | Changes Tracked? |
|---|---|---|---|---|
| **Transient** | No | No | No | No |
| **Persistent** | Yes | Yes | Yes (or pending INSERT) | Yes (dirty checking) |
| **Detached** | No | Yes | Yes | No |
| **Removed** | Yes | Yes | Yes (pending DELETE) | No |

### FlushMode: When Does Hibernate Execute SQL?

| FlushMode | Behavior | Use Case |
|---|---|---|
| `AUTO` (default) | Flush before queries and on commit | Most applications |
| `COMMIT` | Flush only on commit | Performance optimization when queries don't depend on pending changes |
| `MANUAL` | Flush only when explicitly called | Full control (advanced) |

**Production Tip:** If you're executing a JPQL `SELECT` and Hibernate flushes pending INSERTs before it (to ensure query consistency), this AUTO flush can be unexpectedly slow. Use `readOnly = true` for pure read transactions to avoid unnecessary flushes.

### Interview Questions for Part 5

**Q: What happens if you call entityManager.merge() and then modify the ORIGINAL (not returned) reference?**
A: The original object remains DETACHED. Only the returned reference is PERSISTENT. Modifying the original has no effect on the database. This is a very common bug.

**Q: Why does @Transactional(readOnly=true) improve performance?**
A: Three reasons: (1) Hibernate skips dirty checking on all loaded entities (no snapshot comparison), (2) Hibernate may skip entity snapshots entirely (less memory), (3) Spring may route the query to a database read replica.

---

# Part 6: Associations in Hibernate

### Deep Theory: How Hibernate Maps Relationships to SQL

Hibernate translates Java object references into SQL foreign keys and join tables. Understanding the SQL generated by each annotation is critical for debugging performance issues.

**Architect's Rule:** Always think in terms of SQL first, then map to JPA annotations. If you don't know what SQL will be generated, you'll create N+1 problems, unnecessary JOINs, and cascade disasters.

## 6.1 @ManyToOne (Most Common)

### Why @ManyToOne is the Most Important Annotation

In most enterprise systems, 80% of relationships are @ManyToOne. An Order belongs to a Customer. A Product belongs to a Category. An Employee belongs to a Department. Understanding this annotation deeply is essential.

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

**What Hibernate generates:**
```sql
CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    total_amount DECIMAL(19,2),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

**Critical: Always set `fetch = FetchType.LAZY` on @ManyToOne!**
The JPA default for @ManyToOne is EAGER. This means EVERY time you load an Order, Hibernate also loads the Customer via a JOIN, even if you never access `order.getCustomer()`. In a list of 1000 orders, this generates 1000 unnecessary Customer loads.

## 6.2 @OneToMany (Inverse Side)

### Deep Theory: The Inverse Side Does NOT Control the Relationship

The inverse side (`mappedBy`) is a mirror. It tells Hibernate "the relationship is already mapped by the other side." Changes to the inverse side's collection are IGNORED by Hibernate for persistence purposes.

```java
// THIS DOES NOT WORK:
Customer customer = new Customer();
customer.getOrders().add(new Order()); // Order has NO customer reference
entityManager.persist(customer);
// Result: Order is saved with customer_id = NULL!

// THIS WORKS:
Order order = new Order();
order.setCustomer(customer); // SET THE OWNING SIDE
entityManager.persist(order);
// Result: Order is saved with correct customer_id FK
```

**Best Practice: Always use helper methods** to keep both sides in sync:

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

### Production Warning: @OneToOne Lazy Loading Trap

`@OneToOne` with `mappedBy` (inverse side) **cannot be lazy-loaded** by default! Hibernate cannot determine whether the related entity exists without querying the database. It must either load the entity (EAGER) or use bytecode enhancement.

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

    @OneToOne(mappedBy = "profile") // WARNING: Cannot be lazy on the inverse side!
    private User user;

    private String bio;
    private String avatarUrl;
}
```

**Fix for inverse @OneToOne lazy loading:**
- Use `@MapsId` instead (share the primary key)
- Use bytecode enhancement (`hibernate.enhance_lazy_loading=true`)
- Or accept EAGER loading on the inverse side

## 6.4 @ManyToMany

### Architect's Warning: Avoid @ManyToMany in Production

In real enterprise systems, pure `@ManyToMany` is almost never the right choice. The join table inevitably needs extra columns (enrollment_date, grade, status). You should use an explicit join entity instead.

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

**Why Set instead of List for @ManyToMany:** Using `List` with @ManyToMany causes Hibernate to delete ALL rows in the join table and re-insert them every time the collection is modified. Using `Set` allows Hibernate to add/remove individual rows. This is a critical performance difference with large datasets.

**Better approach with explicit join entity:**
```java
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

## 6.5 Cascade Types

| Cascade Type | Effect | When to Use |
|---|---|---|
| `PERSIST` | Save child when parent is saved | Parent-child relationships |
| `MERGE` | Update child when parent is updated | Almost always with PERSIST |
| `REMOVE` | Delete child when parent is deleted | Owned relationships |
| `REFRESH` | Refresh child when parent is refreshed | Rare |
| `DETACH` | Detach child when parent is detached | Rare |
| `ALL` | All of the above | Strong parent-child ownership |

### Production Danger: CascadeType.ALL Can Delete Your Data

```java
// DANGEROUS: CascadeType.ALL includes REMOVE
@ManyToOne(cascade = CascadeType.ALL) // NEVER cascade on @ManyToOne!
@JoinColumn(name = "department_id")
private Department department;

// If you delete an Employee, CascadeType.ALL cascades REMOVE to Department
// which deletes the Department AND all other employees in it!
```

**Rule:** NEVER use `cascade` on `@ManyToOne`. Only cascade from parent to child (OneToMany), never from child to parent.

## 6.6 Owning Side vs Inverse Side

| Concept | Owning Side | Inverse Side |
|---|---|---|
| **Has the FK** | Yes (JoinColumn) | No |
| **Controls relationship** | Yes | No -- uses `mappedBy` |
| **Annotation** | `@JoinColumn` | `mappedBy = "fieldName"` |
| **Example** | `Order.customer` (has customer_id FK) | `Customer.orders` (no FK) |

**Rule:** The side with the foreign key is always the owning side. In `@ManyToOne`, the "Many" side always owns.

### Interview Questions for Part 6

**Q: What happens if you add an Order to Customer.orders but don't set Order.customer?**
A: The order is saved with `customer_id = NULL` because only the owning side (Order.customer) controls the foreign key. Changes to the inverse side (Customer.orders) are ignored for SQL generation.

**Q: Why should you avoid @ManyToMany with List?**
A: Because Hibernate deletes ALL rows in the join table and re-inserts them on any modification. Using Set allows individual row add/remove operations, which is dramatically more efficient.

**Q: Can @OneToOne with mappedBy be lazy-loaded?**
A: No, not by default. Hibernate can't determine if the related entity exists without a query. Solutions: use @MapsId (shared primary key), bytecode enhancement, or accept EAGER loading on the inverse side.

---

# Part 7: Fetching Strategies

### Deep Theory: Why Fetching Strategy is the #1 Performance Decision

Every Hibernate performance problem in production traces back to incorrect fetching. Loading too much data (EAGER) wastes memory and bandwidth. Loading too little (LAZY without planning) causes the N+1 problem. The architect's job is to choose the right strategy for each use case.

**Architect's Rule:** Define entity associations as LAZY, then selectively fetch eagerly per-query using JOIN FETCH or @EntityGraph. NEVER use `FetchType.EAGER` on the entity definition.

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

### How Lazy Loading Works Internally

When you define a LAZY association, Hibernate doesn't load the data. Instead, it creates a **proxy object** (or PersistentCollection for collections). The proxy looks like a real object but contains no data. When you call a method on it (e.g., `orders.size()`), Hibernate intercepts the call, executes the SELECT, and populates the data.

```
customer.getOrders() returns:
  PersistentBag (Hibernate proxy collection)
  |-- initialized = false
  |-- session = Session@xyz (reference to current session)
  
customer.getOrders().size() triggers:
  1. Proxy detects it's not initialized
  2. Checks if Session is still open (if NOT -> LazyInitializationException!)
  3. Executes: SELECT * FROM orders WHERE customer_id = ?
  4. Populates the collection
  5. Sets initialized = true
  6. Returns actual size
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

### Root Cause Analysis

The N+1 problem occurs when:
1. You load a list of parent entities (1 query)
2. For each parent, Hibernate lazily loads a child collection (N queries)
3. Total: 1 + N queries

**Why it's dangerous:** With 100 customers, you get 101 queries. With 10,000 customers, you get 10,001 queries. Each query has network round-trip overhead (1-5ms). 10,001 queries x 2ms = 20 seconds just in network latency!

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

**Warning -- Cartesian Product Problem:** If you JOIN FETCH two collections simultaneously, you get a Cartesian product. Customer with 5 orders and 3 addresses = 15 result rows per customer!

```java
// BAD: Cartesian product (MultipleBagFetchException with Lists)
@Query("SELECT c FROM Customer c JOIN FETCH c.orders JOIN FETCH c.addresses")
List<Customer> findAllWithOrdersAndAddresses(); // EXCEPTION!

// Fix: Use Set instead of List for one collection, OR fetch in separate queries
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

**When to use @BatchSize:** When you can't use JOIN FETCH (e.g., pagination with JOIN FETCH fails because Hibernate applies LIMIT in-memory). @BatchSize works correctly with pagination.

### How to Detect N+1 in Production

```yaml
# Enable Hibernate statistics
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true
# Check logs for:
# Session Metrics { 101 JDBC statements prepared }
# If statement count is much higher than expected, you have N+1!
```

### Interview Questions for Part 7

**Q: What causes the N+1 problem?**
A: Loading N parent entities in one query, then lazily loading a child collection for each parent triggers N additional queries. Total = 1 + N. Fix with JOIN FETCH, @EntityGraph, or @BatchSize.

**Q: Why can't you use JOIN FETCH with pagination?**
A: When you JOIN FETCH a collection and use Pageable, Hibernate can't apply SQL LIMIT/OFFSET correctly (each parent has multiple rows from the JOIN). Hibernate falls back to in-memory pagination, loading ALL data first. Use @BatchSize or DTO projections instead.

---

# Part 8: Hibernate Query Methods

### Deep Theory: How Hibernate Translates Queries

Hibernate provides three query languages. Understanding when to use each and what SQL they generate is crucial:

```
JPQL/HQL Query String
   |  (parsed by Hibernate Query Parser / SQM in Hibernate 6)
   v
SQL Abstract Syntax Tree (AST)
   |  (Dialect applies DB-specific rules)
   v
Native SQL String -> JDBC PreparedStatement -> Database
```

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

### Production Tip: Bulk UPDATE Bypasses Persistence Context

When you use HQL/JPQL `UPDATE` or `DELETE`, Hibernate executes SQL directly without updating the persistence context. Entities in memory become stale!

```java
@Transactional
public void deactivateUsers() {
    entityManager.createQuery("UPDATE User u SET u.status = 'INACTIVE' WHERE ...")
        .executeUpdate();
    entityManager.clear(); // CRITICAL! Without this, cached entities still show old status
}
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

### Best Practice: Use DTO Projections for Read-Only Queries

Loading full entities for display-only purposes wastes resources:
- Loads ALL columns (including large TEXT/BLOB fields)
- Creates entity snapshots (memory overhead for dirty checking)
- Loads EAGER associations unnecessarily

DTO projections skip ALL of this overhead.

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

### When to Use Native SQL in Production

| Use Case | Why Native SQL |
|---|---|
| Window functions | `ROW_NUMBER() OVER(PARTITION BY ...)` not supported in JPQL |
| Common Table Expressions (CTEs) | `WITH ... AS (...)` not in JPQL |
| Full-text search | PostgreSQL `tsvector`, MySQL `MATCH AGAINST` |
| Database-specific JSON | PostgreSQL `jsonb_extract_path_text` |
| Performance-critical queries | Hand-optimized SQL with query hints |

## 8.4 Comparison

| Feature | HQL | JPQL | Native SQL |
|---|---|---|---|
| **Standard** | Hibernate-specific | JPA standard | Database-specific |
| **Operates on** | Entities | Entities | Tables |
| **Portability** | Hibernate only | Any JPA provider | Not portable |
| **DB functions** | Some | Limited | Full support |
| **Complex queries** | Good | Good | Best |
| **Use when** | Hibernate features needed | Default choice | Complex/optimized SQL |

### Interview Questions for Part 8

**Q: What is the difference between HQL and JPQL?**
A: HQL is Hibernate-specific and supports Hibernate extensions. JPQL is the JPA standard, portable across JPA providers. In practice, most developers use JPQL via `@Query` in Spring Data repositories.

**Q: Why do bulk HQL UPDATE/DELETE statements cause stale data?**
A: Because they execute SQL directly, bypassing the persistence context. Entities cached in the first-level cache still reflect old state. Fix: call `entityManager.clear()` or use `@Modifying(clearAutomatically = true)`.

---
