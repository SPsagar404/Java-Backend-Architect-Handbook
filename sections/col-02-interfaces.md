
# Chapter 2: Core Interfaces Deep Dive

## 2.1 Iterable\<E\> Interface

### What
`Iterable<E>` is the **root interface** of the entire collection hierarchy. It is defined in the `java.lang` package (not `java.util`). Any class implementing `Iterable` can be used with the **enhanced for-each loop**.

### Why
It provides a standard way to iterate over elements without exposing the internal structure of the collection. It decouples the traversal logic from the collection implementation.

### When
Use `Iterable` whenever you want your custom class to support the for-each loop and stream operations.

### Where (Enterprise Usage)
```java
// Custom paginated result that is Iterable
public class PaginatedResult<T> implements Iterable<T> {
    private final List<T> items;
    private final int totalPages;
    private final int currentPage;
    
    public PaginatedResult(List<T> items, int totalPages, int currentPage) {
        this.items = items;
        this.totalPages = totalPages;
        this.currentPage = currentPage;
    }
    
    @Override
    public Iterator<T> iterator() {
        return items.iterator();
    }
    
    // Java 8: forEach with Consumer
    @Override
    public void forEach(Consumer<? super T> action) {
        items.forEach(action);
    }
    
    // Java 8: spliterator for parallel streams
    @Override
    public Spliterator<T> spliterator() {
        return items.spliterator();
    }
}

// Usage in controller
PaginatedResult<OrderDTO> result = orderService.getOrders(page, size);
for (OrderDTO order : result) {  // Works because of Iterable
    log.info("Order: {}", order.getId());
}
```

### How It Works Internally
The `Iterable` interface has three methods:
```java
public interface Iterable<T> {
    Iterator<T> iterator();                          // Required
    default void forEach(Consumer<? super T> action) { }  // Java 8
    default Spliterator<T> spliterator() { }              // Java 8
}
```

When the compiler encounters a for-each loop:
```java
for (String s : collection) { ... }
```
It transforms it into:
```java
Iterator<String> it = collection.iterator();
while (it.hasNext()) {
    String s = it.next();
    ...
}
```

### Deep Theory: Spliterator and Parallel Processing

Java 8 added `spliterator()` to enable parallel streams. A Spliterator can split a collection into chunks for concurrent processing:

```java
// How parallelStream() works internally:
// 1. collection.spliterator() creates the root Spliterator
// 2. ForkJoinPool calls trySplit() to divide data
// 3. Each partition is processed by a separate thread
// 4. Results are combined

// Custom Spliterator characteristics affect performance:
// ORDERED -- elements have a defined encounter order (List)
// DISTINCT -- no two elements are equal (Set)
// SORTED -- elements are in sorted order (TreeSet)
// SIZED -- exact size is known (ArrayList)
// NONNULL -- source guarantees no nulls
```

**Production Tip:** `ArrayList.spliterator()` supports efficient splitting (divides array in half). `LinkedList.spliterator()` splits poorly (must traverse to find midpoint). This is why parallel streams on `ArrayList` are 2-5x faster than on `LinkedList`.

---

## 2.2 Collection\<E\> Interface

### What
`Collection<E>` is the **root interface** for most collection types (except `Map`). It extends `Iterable<E>` and defines the basic operations that all collections support.

### Why
It provides a **uniform API** for adding, removing, checking, and iterating over elements regardless of the underlying data structure.

### Key Methods
```java
public interface Collection<E> extends Iterable<E> {
    // Query Operations
    int size();
    boolean isEmpty();
    boolean contains(Object o);
    Iterator<E> iterator();
    Object[] toArray();
    <T> T[] toArray(T[] a);
    
    // Modification Operations
    boolean add(E e);
    boolean remove(Object o);
    
    // Bulk Operations
    boolean containsAll(Collection<?> c);
    boolean addAll(Collection<? extends E> c);
    boolean removeAll(Collection<?> c);
    boolean retainAll(Collection<?> c);
    void clear();
    
    // Java 8+ Methods
    default boolean removeIf(Predicate<? super E> filter) { }
    default Stream<E> stream() { }
    default Stream<E> parallelStream() { }
}
```

### Enterprise Example
```java
@Service
public class NotificationService {
    
    public void sendBulkNotifications(Collection<User> users, String message) {
        // Works with ANY Collection - List, Set, Queue, etc.
        users.stream()
             .filter(User::isActive)
             .forEach(user -> sendNotification(user, message));
    }
    
    public void removeInactiveUsers(Collection<User> users) {
        // Java 8 removeIf
        users.removeIf(user -> !user.isActive());
    }
}
```

### Deep Theory: The UnsupportedOperationException Contract

The Collection interface includes methods like `add()`, `remove()`, `clear()`, but NOT all implementations support them. Immutable collections throw `UnsupportedOperationException`:

```java
List<String> immutable = List.of("A", "B", "C");
immutable.add("D"); // UnsupportedOperationException!

// This is the "optional operation" pattern in JCF
// The interface declares the method, but Javadoc marks it as optional
// Implementation decides whether to support it
```

**Why this design?** To avoid an explosion of sub-interfaces (ReadableCollection, WritableCollection, etc.). This is a trade-off: compile-time type safety is sacrificed for interface simplicity.

### Interview Question for Chapter 2

**Q: Why does Map not extend Collection?**
A: Because Map stores key-value pairs, not individual elements. The `add(E e)` method of Collection doesn't make sense for maps (what would you add -- a key? a value? both?). Maps have their own hierarchy with `put(K, V)`, `get(K)`, `entrySet()`, etc.

---

## 2.3 List\<E\> Interface

### What
`List<E>` is an **ordered collection** (also known as a **sequence**) that allows **duplicate elements** and provides **positional (index-based) access**.

### Why
When you need to maintain insertion order and access elements by their position. Lists are the most commonly used collection type in enterprise applications.

### When to Use
- Maintaining ordered data (e.g., list of orders by date)
- When duplicates are allowed
- When you need index-based access
- REST API response payloads (most common return type)

### Where (Enterprise Usage)
```java
// REST API - Most common usage
@GetMapping("/api/products")
public ResponseEntity<List<ProductDTO>> getProducts(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    
    List<ProductDTO> products = productService.findAll(page, size);
    return ResponseEntity.ok(products);
}

// Service Layer - Business Logic
@Service
public class OrderService {
    
    public List<OrderDTO> getOrdersByCustomer(Long customerId) {
        List<Order> orders = orderRepository.findByCustomerId(customerId);
        return orders.stream()
                     .map(this::toDTO)
                     .sorted(Comparator.comparing(OrderDTO::getCreatedAt).reversed())
                     .collect(Collectors.toList());
    }
}
```

### Key Methods Unique to List
```java
// Positional access
E get(int index);
E set(int index, E element);
void add(int index, E element);
E remove(int index);

// Search
int indexOf(Object o);
int lastIndexOf(Object o);

// Range view
List<E> subList(int fromIndex, int toIndex);

// List Iterator (bidirectional)
ListIterator<E> listIterator();
ListIterator<E> listIterator(int index);

// Java 9+ Factory Methods
List<String> immutable = List.of("A", "B", "C");
List<String> copy = List.copyOf(existingList);

// Java 10+
List<String> unmodifiable = List.copyOf(mutableList);
```

### Deep Theory: The subList() Trap

`subList()` returns a VIEW of the original list, not a copy. This is both powerful and dangerous:

```java
List<String> original = new ArrayList<>(List.of("A", "B", "C", "D", "E"));
List<String> sub = original.subList(1, 4); // [B, C, D] -- VIEW, not copy

sub.set(0, "X"); // original is now [A, X, C, D, E]
original.add("F"); // DANGER: structurally modifying original
sub.get(0); // ConcurrentModificationException! subList is invalidated

// SAFE pattern: copy the subList if you need independence
List<String> safeSub = new ArrayList<>(original.subList(1, 4));
```

**Production Scenario:** A developer returned `list.subList(0, 10)` from a service method. The caller stored it. Later, the original list was cleared. The subList now threw CME on every access, causing intermittent 500 errors.

---

## 2.4 Set\<E\> Interface

### What
`Set<E>` is a collection that contains **no duplicate elements**. It models the mathematical set abstraction.

### Why
When you need to enforce uniqueness of elements. Sets use `equals()` and `hashCode()` to determine element equality.

### When to Use
- Removing duplicates from data
- Membership testing (contains check)
- Set operations (union, intersection, difference)
- Storing unique identifiers (user IDs, session tokens)

### Where (Enterprise Usage)
```java
@Service
public class PermissionService {
    
    // Using Set to enforce unique permissions
    public Set<String> getUserPermissions(Long userId) {
        Set<String> permissions = new HashSet<>();
        
        // Role-based permissions
        Set<Role> roles = roleRepository.findByUserId(userId);
        for (Role role : roles) {
            permissions.addAll(role.getPermissions());
        }
        
        // Direct permissions
        permissions.addAll(permissionRepository.findByUserId(userId));
        
        return Collections.unmodifiableSet(permissions);
    }
    
    // Set operations for access control
    public boolean hasAccess(Long userId, Set<String> requiredPermissions) {
        Set<String> userPermissions = getUserPermissions(userId);
        return userPermissions.containsAll(requiredPermissions);
    }
}

// Deduplication in data processing
@Service
public class DataImportService {
    
    public ImportResult importCustomers(List<CustomerDTO> rawData) {
        Set<String> processedEmails = new HashSet<>();
        List<CustomerDTO> uniqueCustomers = new ArrayList<>();
        List<CustomerDTO> duplicates = new ArrayList<>();
        
        for (CustomerDTO customer : rawData) {
            if (processedEmails.add(customer.getEmail().toLowerCase())) {
                uniqueCustomers.add(customer);
            } else {
                duplicates.add(customer);
            }
        }
        
        return new ImportResult(uniqueCustomers, duplicates);
    }
}
```

### Sub-interfaces
- **SortedSet\<E\>**: Elements maintained in sorted order. Provides `first()`, `last()`, `headSet()`, `tailSet()`, `subSet()`.
- **NavigableSet\<E\>** (Java 6+): Extends SortedSet with navigation methods: `lower()`, `floor()`, `ceiling()`, `higher()`, `pollFirst()`, `pollLast()`.

### Deep Theory: Set Algebra in Production

Sets support mathematical set operations that are tremendously useful:

```java
// UNION: combine two sets
Set<String> union = new HashSet<>(setA);
union.addAll(setB);

// INTERSECTION: common elements
Set<String> intersection = new HashSet<>(setA);
intersection.retainAll(setB);

// DIFFERENCE: elements in A but not in B
Set<String> difference = new HashSet<>(setA);
difference.removeAll(setB);

// SYMMETRIC DIFFERENCE: elements in A or B but not both
Set<String> symDiff = new HashSet<>(setA);
symDiff.addAll(setB);
Set<String> common = new HashSet<>(setA);
common.retainAll(setB);
symDiff.removeAll(common);
```

**Real-World Use Case:** In a permissions system, you compute which permissions were added/removed when a role changes:
```java
Set<String> oldPerms = getPermissions(role, oldVersion);
Set<String> newPerms = getPermissions(role, newVersion);
Set<String> added = new HashSet<>(newPerms);   added.removeAll(oldPerms);
Set<String> removed = new HashSet<>(oldPerms); removed.removeAll(newPerms);
auditLog.record(role, added, removed);
```

---

## 2.5 Queue\<E\> Interface

### What
`Queue<E>` is a collection designed for holding elements **prior to processing**, typically in **FIFO (First-In, First-Out)** order.

### Why
When you need to process elements in a specific order, typically the order in which they arrive.

### When to Use
- Task scheduling and job queues
- Message processing in microservices
- BFS (Breadth-First Search) algorithms
- Rate limiting and throttling
- Producer-consumer patterns

### Key Methods
```java
public interface Queue<E> extends Collection<E> {
    // Throws exception on failure
    boolean add(E e);      // Inserts element
    E remove();            // Removes and returns head
    E element();           // Returns head without removing
    
    // Returns special value on failure
    boolean offer(E e);    // Inserts element, returns false if full
    E poll();              // Removes and returns head, returns null if empty
    E peek();              // Returns head without removing, returns null if empty
}
```

| Operation | Throws Exception | Returns Special Value |
|---|---|---|
| Insert | `add(e)` | `offer(e)` |
| Remove | `remove()` | `poll()` |
| Examine | `element()` | `peek()` |

### Enterprise Usage
```java
@Service
public class EmailQueueService {
    private final Queue<EmailRequest> emailQueue = new LinkedList<>();
    
    public void queueEmail(EmailRequest request) {
        emailQueue.offer(request);
        log.info("Email queued. Queue size: {}", emailQueue.size());
    }
    
    @Scheduled(fixedRate = 1000)
    public void processEmails() {
        EmailRequest request;
        int batchSize = 10;
        int processed = 0;
        
        while (processed < batchSize && (request = emailQueue.poll()) != null) {
            try {
                emailSender.send(request);
                processed++;
            } catch (Exception e) {
                emailQueue.offer(request); // Re-queue on failure
                log.error("Failed to send email", e);
            }
        }
    }
}
```

---

## 2.6 Deque\<E\> Interface

### What
`Deque<E>` (Double-Ended Queue, pronounced "deck") is a linear collection that supports element insertion and removal at **both ends**.

### Why
It can be used as both a **Queue (FIFO)** and a **Stack (LIFO)**, making it more versatile than either alone. Java recommends `Deque` over the legacy `Stack` class.

### When to Use
- When you need both stack and queue behavior
- Undo/redo functionality
- Sliding window algorithms
- Browser history (back/forward)

### Key Methods
```java
// First Element (Head)               // Last Element (Tail)
addFirst(e) / offerFirst(e)           addLast(e) / offerLast(e)
removeFirst() / pollFirst()           removeLast() / pollLast()
getFirst() / peekFirst()              getLast() / peekLast()

// Stack operations (LIFO)
push(e)    // equivalent to addFirst(e)
pop()      // equivalent to removeFirst()
peek()     // equivalent to peekFirst()

// Queue operations (FIFO)
offer(e)   // equivalent to offerLast(e)
poll()     // equivalent to pollFirst()
peek()     // equivalent to peekFirst()
```

### Deep Theory: Why ArrayDeque is Faster Than LinkedList

```
Benchmark Results (JMH, 1M operations):
  ArrayDeque.offer():   ~12 ns/op
  LinkedList.offer():   ~35 ns/op  (3x slower)
  
  ArrayDeque.poll():    ~8 ns/op
  LinkedList.poll():    ~25 ns/op  (3x slower)

Reasons:
1. CPU Cache Locality: ArrayDeque stores elements in contiguous array
   → CPU prefetcher loads adjacent elements into L1 cache
   LinkedList nodes are scattered across heap → cache misses

2. Memory Overhead: ArrayDeque has zero per-element overhead
   LinkedList creates a Node object (48 bytes) per element

3. GC Pressure: ArrayDeque creates no garbage on poll()
   LinkedList creates garbage Node objects for GC to collect
```

**Rule:** Always use `ArrayDeque` instead of `LinkedList` for Stack/Queue behavior. The only exception is when you need null elements (ArrayDeque forbids nulls).

### Enterprise Usage
```java
@Service
public class AuditTrailService {
    // Keep last 1000 audit events using Deque
    private final Deque<AuditEvent> recentEvents = new ArrayDeque<>();
    private static final int MAX_SIZE = 1000;
    
    public void recordEvent(AuditEvent event) {
        recentEvents.addFirst(event); // Most recent at head
        if (recentEvents.size() > MAX_SIZE) {
            recentEvents.removeLast(); // Remove oldest
        }
    }
    
    public List<AuditEvent> getRecentEvents(int count) {
        return recentEvents.stream()
                          .limit(count)
                          .collect(Collectors.toList());
    }
}
```

---

## 2.7 Map\<K,V\> Interface

### What
`Map<K,V>` is an object that maps **keys to values**. A map cannot contain duplicate keys; each key maps to at most one value. **Map does NOT extend Collection.**

### Why
Maps provide the most efficient way to associate keys with values, enabling O(1) average-case lookup in hash-based implementations.

### When to Use
- Key-value associations (caching, configuration)
- Counting/frequency analysis
- Grouping data by a key
- Database-like lookups in memory

### Where (Enterprise Usage)
```java
@Service
public class ConfigurationService {
    private final Map<String, String> configCache = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void loadConfig() {
        // Load all configs into memory Map
        configRepository.findAll()
            .forEach(c -> configCache.put(c.getKey(), c.getValue()));
    }
    
    public String getConfig(String key) {
        return configCache.getOrDefault(key, "default");
    }
    
    public void updateConfig(String key, String value) {
        configCache.put(key, value);
        configRepository.save(new ConfigEntity(key, value));
    }
}

// Grouping with Map
@Service
public class ReportService {
    
    public Map<String, List<Order>> getOrdersByStatus() {
        List<Order> allOrders = orderRepository.findAll();
        return allOrders.stream()
                       .collect(Collectors.groupingBy(
                           order -> order.getStatus().name()
                       ));
    }
    
    public Map<String, Long> getOrderCountByCity() {
        return orderRepository.findAll().stream()
                .collect(Collectors.groupingBy(
                    Order::getCity,
                    Collectors.counting()
                ));
    }
}
```

### Key Methods
```java
// Basic operations
V put(K key, V value);
V get(Object key);
V remove(Object key);
boolean containsKey(Object key);
boolean containsValue(Object value);
int size();

// Bulk operations
void putAll(Map<? extends K, ? extends V> m);
void clear();

// Collection views
Set<K> keySet();
Collection<V> values();
Set<Map.Entry<K,V>> entrySet();

// Java 8+ Methods
V getOrDefault(Object key, V defaultValue);
V putIfAbsent(K key, V value);
V computeIfAbsent(K key, Function<? super K, ? extends V> mappingFunction);
V computeIfPresent(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction);
V compute(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction);
V merge(K key, V value, BiFunction<? super V, ? super V, ? extends V> remappingFunction);
void forEach(BiConsumer<? super K, ? super V> action);
void replaceAll(BiFunction<? super K, ? super V, ? extends V> function);

// Java 9+ Factory Methods
Map<String, Integer> immutable = Map.of("A", 1, "B", 2, "C", 3);
Map<String, Integer> copy = Map.copyOf(existingMap);
```

### Sub-interfaces
- **SortedMap\<K,V\>**: Keys maintained in sorted order
- **NavigableMap\<K,V\>**: Extended SortedMap with navigation methods
- **ConcurrentMap\<K,V\>**: Thread-safe map with atomic operations

### Deep Theory: Java 8 Map Methods Cheat Sheet

| Method | When to Use | Example |
|---|---|---|
| `getOrDefault(k, def)` | Avoid null checks | `map.getOrDefault("key", "N/A")` |
| `putIfAbsent(k, v)` | Insert only if missing | `cache.putIfAbsent(id, loadFromDB())` |
| `computeIfAbsent(k, fn)` | Lazy compute on miss | `map.computeIfAbsent(key, k -> new ArrayList<>())` |
| `computeIfPresent(k, fn)` | Update only if exists | `map.computeIfPresent(key, (k,v) -> v + 1)` |
| `compute(k, fn)` | Insert or update | `map.compute(key, (k,v) -> v == null ? 1 : v + 1)` |
| `merge(k, v, fn)` | Elegant frequency counting | `map.merge(word, 1, Integer::sum)` |
| `replaceAll(fn)` | Transform all values | `map.replaceAll((k,v) -> v.toUpperCase())` |

**Production Pattern -- Multi-Value Map:**
```java
// Building a Map<String, List<String>> safely
Map<String, List<String>> multiMap = new HashMap<>();
multiMap.computeIfAbsent("category", k -> new ArrayList<>()).add("item1");
multiMap.computeIfAbsent("category", k -> new ArrayList<>()).add("item2");
// Result: {category=[item1, item2]}

// WRONG approach (NPE if key doesn't exist):
multiMap.get("category").add("item1"); // NullPointerException!
```

### Interview Questions for Chapter 2

**Q: What is the difference between offer() and add() in Queue?**
A: Both insert elements, but `add()` throws `IllegalStateException` if the queue is full (bounded queues), while `offer()` returns `false`. In unbounded queues (LinkedList, ArrayDeque), both behave identically.

**Q: Why does Java recommend Deque over Stack?**
A: Stack extends Vector (synchronized overhead, bad IS-A relationship). Stack also inherits `add(index, e)` which breaks LIFO semantics. ArrayDeque is faster, not synchronized, and enforces Deque contract properly.

**Q: Why does Map not extend Collection?**
A: Map stores key-value pairs, not individual elements. Collection's `add(E)` method doesn't fit maps. Map has its own API: `put(K,V)`, `get(K)`, `entrySet()`. However, you can get Collection views: `map.keySet()`, `map.values()`, `map.entrySet()`.

---
