
# Chapter 9: Time Complexity and Performance Comparison

## 9.1 List Implementations Comparison

| Operation | ArrayList | LinkedList | Vector | CopyOnWriteArrayList |
|---|---|---|---|---|
| `get(index)` | **O(1)** | O(n) | O(1) | O(1) |
| `add(e)` (end) | **O(1)*** | O(1) | O(1)* | O(n) |
| `add(index, e)` | O(n) | O(n)** | O(n) | O(n) |
| `remove(index)` | O(n) | O(n)** | O(n) | O(n) |
| `contains(o)` | O(n) | O(n) | O(n) | O(n) |
| `iterator.remove()` | O(n) | **O(1)** | O(n) | N/A (snapshot) |
| Thread-safe | No | No | Yes | Yes |
| Memory/element | ~4 bytes† | ~40 bytes | ~4 bytes† | ~4 bytes† |

\* Amortized   \*\* O(1) at known position, O(n) to find position   † Object reference only

### When to Choose What

```
Need random access?         → ArrayList
Need thread safety?         → CopyOnWriteArrayList (read-heavy) or synchronizedList
Need queue/deque behavior?  → ArrayDeque (NOT LinkedList)
Need stable sort order?     → ArrayList
Legacy code requirement?    → Vector (avoid if possible)
```

## 9.2 Set Implementations Comparison

| Operation | HashSet | LinkedHashSet | TreeSet | EnumSet |
|---|---|---|---|---|
| `add(e)` | **O(1)** | O(1) | O(log n) | **O(1)** |
| `remove(o)` | **O(1)** | O(1) | O(log n) | **O(1)** |
| `contains(o)` | **O(1)** | O(1) | O(log n) | **O(1)** |
| `first()`/`last()` | N/A | N/A | O(log n) | O(1) |
| Iteration order | None | **Insertion** | **Sorted** | **Natural** |
| Null elements | Yes (one) | Yes (one) | No‡ | No |

‡ TreeSet with natural ordering doesn't allow null; with Comparator it depends on the implementation.

### When to Choose What
```
Need fastest operations?           → EnumSet (if enum type) or HashSet
Need insertion order?              → LinkedHashSet
Need sorted elements?              → TreeSet
Need thread safety?                → CopyOnWriteArraySet (small sets) or 
                                     Collections.synchronizedSet(new HashSet<>())
Need range queries on elements?    → TreeSet (NavigableSet)
```

## 9.3 Map Implementations Comparison

| Operation | HashMap | LinkedHashMap | TreeMap | ConcurrentHashMap | Hashtable |
|---|---|---|---|---|---|
| `put(k,v)` | **O(1)** | O(1) | O(log n) | O(1) | O(1) |
| `get(k)` | **O(1)** | O(1) | O(log n) | O(1) | O(1) |
| `remove(k)` | **O(1)** | O(1) | O(log n) | O(1) | O(1) |
| `containsKey(k)` | **O(1)** | O(1) | O(log n) | O(1) | O(1) |
| Null keys | Yes (1) | Yes (1) | No‡ | **No** | **No** |
| Null values | Yes | Yes | Yes | **No** | **No** |
| Ordering | None | **Insertion/Access** | **Sorted** | None | None |
| Thread-safe | No | No | No | **Yes** | Yes |

### When to Choose What
```
General purpose?                    → HashMap
Need insertion order?               → LinkedHashMap
Need sorted keys?                   → TreeMap
Need thread safety?                 → ConcurrentHashMap
Need LRU cache?                     → LinkedHashMap (access order)
Need enum keys?                     → EnumMap
Need auto-cleanup of unused keys?   → WeakHashMap
```

## 9.4 Queue/Deque Implementations Comparison

| Operation | PriorityQueue | ArrayDeque | LinkedList |
|---|---|---|---|
| `offer(e)` | O(log n) | **O(1)*** | O(1) |
| `poll()` | O(log n) | **O(1)** | O(1) |
| `peek()` | **O(1)** | **O(1)** | O(1) |
| Ordering | Priority | FIFO/LIFO | FIFO/LIFO |
| Thread-safe | No | No | No |
| Null elements | No | No | Yes |
| Memory | Array-based | Array-based | Node-based |

---

# Chapter 10: Real-Time Enterprise Usage Scenarios

## 10.1 Using Map for Caching in Spring Boot

```java
@Service
public class ProductCacheService {
    
    // Level 1: Simple in-memory cache
    private final Map<String, ProductDTO> l1Cache = new ConcurrentHashMap<>();
    
    // Level 2: LRU cache with max size
    private final Map<String, ProductDTO> l2Cache = 
        Collections.synchronizedMap(new LinkedHashMap<>(100, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, ProductDTO> eldest) {
                return size() > 1000;
            }
        });
    
    public ProductDTO getProduct(String productId) {
        // Check L1 cache
        ProductDTO product = l1Cache.get(productId);
        if (product != null) return product;
        
        // Check L2 cache
        product = l2Cache.get(productId);
        if (product != null) {
            l1Cache.put(productId, product); // Promote to L1
            return product;
        }
        
        // Load from database
        product = productRepository.findById(productId)
            .map(mapper::toDTO)
            .orElseThrow(() -> new ProductNotFoundException(productId));
        
        l2Cache.put(productId, product);
        l1Cache.put(productId, product);
        return product;
    }
    
    @CacheEvict(allEntries = true)
    @Scheduled(fixedRate = 300000) // 5 minutes
    public void evictL1Cache() {
        l1Cache.clear();
    }
}
```

## 10.2 Using Set for Uniqueness in Data Processing

```java
@Service
public class DataDeduplicationService {
    
    public List<TransactionDTO> deduplicateTransactions(
            List<TransactionDTO> incomingTransactions) {
        
        Set<String> processedIds = new HashSet<>();
        List<TransactionDTO> uniqueTransactions = new ArrayList<>();
        List<TransactionDTO> duplicates = new ArrayList<>();
        
        for (TransactionDTO txn : incomingTransactions) {
            if (processedIds.add(txn.getTransactionId())) {
                uniqueTransactions.add(txn);
            } else {
                duplicates.add(txn);
                log.warn("Duplicate transaction detected: {}", txn.getTransactionId());
            }
        }
        
        metricsService.recordDuplicateCount(duplicates.size());
        return uniqueTransactions;
    }
}
```

## 10.3 Using List in REST API Responses

```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
    
    @GetMapping
    public ResponseEntity<PagedResponse<OrderDTO>> getOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        
        Page<Order> orderPage = orderService.findOrders(page, size, status);
        
        List<OrderDTO> orderDTOs = orderPage.getContent().stream()
            .map(mapper::toDTO)
            .collect(Collectors.toList());
        
        PagedResponse<OrderDTO> response = new PagedResponse<>(
            orderDTOs,
            orderPage.getNumber(),
            orderPage.getSize(),
            orderPage.getTotalElements(),
            orderPage.getTotalPages(),
            orderPage.isLast()
        );
        
        return ResponseEntity.ok(response);
    }
}
```

## 10.4 Using ConcurrentHashMap in Multi-Threaded Systems

```java
@Component
public class SessionManager {
    private final ConcurrentHashMap<String, UserSession> activeSessions = 
        new ConcurrentHashMap<>();
    
    public UserSession createSession(User user) {
        String sessionId = UUID.randomUUID().toString();
        UserSession session = new UserSession(sessionId, user, Instant.now());
        activeSessions.put(sessionId, session);
        return session;
    }
    
    public Optional<UserSession> getSession(String sessionId) {
        return Optional.ofNullable(activeSessions.get(sessionId));
    }
    
    public void invalidateSession(String sessionId) {
        activeSessions.remove(sessionId);
    }
    
    // Cleanup expired sessions periodically
    @Scheduled(fixedRate = 60000)
    public void cleanupExpiredSessions() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(24));
        
        activeSessions.entrySet().removeIf(
            entry -> entry.getValue().getCreatedAt().isBefore(cutoff)
        );
        
        log.info("Active sessions after cleanup: {}", activeSessions.size());
    }
    
    // Thread-safe metrics
    public Map<String, Long> getSessionStatistics() {
        return activeSessions.values().stream()
            .collect(Collectors.groupingBy(
                session -> session.getUser().getRole().name(),
                Collectors.counting()
            ));
    }
}
```

## 10.5 Using PriorityQueue in Scheduling Systems

```java
@Service
public class NotificationScheduler {
    
    private final PriorityQueue<ScheduledNotification> queue = new PriorityQueue<>(
        Comparator.comparing(ScheduledNotification::getScheduledTime)
                  .thenComparing(ScheduledNotification::getPriority)
    );
    
    public void schedule(String userId, String message, 
                         Instant scheduledTime, Priority priority) {
        queue.offer(new ScheduledNotification(
            userId, message, scheduledTime, priority
        ));
    }
    
    @Scheduled(fixedRate = 1000)
    public void processNotifications() {
        Instant now = Instant.now();
        
        while (!queue.isEmpty() && queue.peek().getScheduledTime().isBefore(now)) {
            ScheduledNotification notification = queue.poll();
            try {
                notificationSender.send(notification);
            } catch (Exception e) {
                log.error("Failed to send notification", e);
                // Reschedule with delay
                notification.setScheduledTime(now.plusSeconds(30));
                queue.offer(notification);
            }
        }
    }
}
```

## 10.6 Batch Processing with Collections

```java
@Service
public class BatchExportService {
    
    private static final int BATCH_SIZE = 500;
    
    public void exportAllCustomers(OutputStream outputStream) {
        int page = 0;
        List<Customer> batch;
        
        do {
            batch = customerRepository.findAll(
                PageRequest.of(page, BATCH_SIZE, Sort.by("id"))
            ).getContent();
            
            // Process batch using streams
            List<CustomerExportDTO> exportBatch = batch.stream()
                .map(this::toExportDTO)
                .collect(Collectors.toList());
            
            writeToStream(exportBatch, outputStream);
            page++;
            
        } while (batch.size() == BATCH_SIZE);
    }
    
    // Group processing results
    public Map<String, List<ProcessingResult>> processBatch(
            List<String> orderIds) {
        
        return orderIds.stream()
            .map(this::processOrder)
            .collect(Collectors.groupingBy(
                result -> result.isSuccess() ? "SUCCESS" : "FAILED"
            ));
    }
}
```

---

# Chapter 11: Common Pitfalls and Best Practices

## 11.1 ConcurrentModificationException

### What
Thrown when a collection is modified while being iterated using a fail-fast iterator.

### The Problem
```java
// WRONG: Modifying list during iteration
List<String> list = new ArrayList<>(Arrays.asList("A", "B", "C", "D"));
for (String item : list) {
    if (item.equals("B")) {
        list.remove(item); // ConcurrentModificationException!
    }
}
```

### Solutions
```java
// Solution 1: Use Iterator.remove()
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().equals("B")) {
        it.remove(); // Safe!
    }
}

// Solution 2: removeIf (Java 8+)
list.removeIf(item -> item.equals("B"));

// Solution 3: Collect items to remove, then removeAll
List<String> toRemove = new ArrayList<>();
for (String item : list) {
    if (item.equals("B")) toRemove.add(item);
}
list.removeAll(toRemove);

// Solution 4: Use CopyOnWriteArrayList (for concurrent scenarios)
List<String> cowList = new CopyOnWriteArrayList<>(list);
for (String item : cowList) {
    if (item.equals("B")) cowList.remove(item); // Safe, iterates over snapshot
}
```

## 11.2 Fail-Fast vs Fail-Safe Iterators

| Feature | Fail-Fast | Fail-Safe |
|---|---|---|
| Throws CME | Yes | No |
| Works on | Original collection | Copy/snapshot |
| Examples | ArrayList, HashMap, HashSet | CopyOnWriteArrayList, ConcurrentHashMap |
| Memory | No extra memory | Extra memory for copy |
| Reflects changes | N/A (throws) | No (snapshot of original) |
| Use case | Single-threaded | Multi-threaded |

### How Fail-Fast Detection Works (modCount)
```java
// Inside ArrayList:
protected transient int modCount = 0; // Incremented on every structural modification

// Inside Iterator:
private class Itr implements Iterator<E> {
    int expectedModCount = modCount; // Snapshot at iterator creation
    
    public E next() {
        checkForComodification(); // Check before every operation
        // ...
    }
    
    final void checkForComodification() {
        if (modCount != expectedModCount)
            throw new ConcurrentModificationException();
    }
}
```

## 11.3 Improper equals() and hashCode()

### The Problem
```java
// BAD: Missing hashCode override
public class Employee {
    private Long id;
    private String name;
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Employee)) return false;
        return Objects.equals(id, ((Employee) o).id);
    }
    // Missing hashCode()!
}

Employee e1 = new Employee(1L, "John");
Employee e2 = new Employee(1L, "John");

Set<Employee> set = new HashSet<>();
set.add(e1);
set.contains(e2); // May return FALSE! (different hashCode → different bucket)

Map<Employee, String> map = new HashMap<>();
map.put(e1, "value");
map.get(e2); // Returns NULL! (different bucket)
```

### The Contract
1. If `a.equals(b)` returns `true`, then `a.hashCode() == b.hashCode()` MUST be true
2. If `a.hashCode() != b.hashCode()`, then `a.equals(b)` MUST return `false`
3. If `a.hashCode() == b.hashCode()`, `a.equals(b)` may or may not be true (collision is OK)

### The Fix
```java
// GOOD: Always override both
public class Employee {
    private Long id;
    private String name;
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Employee employee = (Employee) o;
        return Objects.equals(id, employee.id);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

## 11.4 Mutable Keys in Maps

```java
// DANGEROUS: Using mutable object as Map key
List<String> key = new ArrayList<>(Arrays.asList("A", "B"));
Map<List<String>, String> map = new HashMap<>();
map.put(key, "value");

System.out.println(map.get(key)); // "value"

key.add("C"); // Mutating the key changes its hashCode!

System.out.println(map.get(key)); // null! Key is lost in wrong bucket

// BEST PRACTICE: Always use immutable objects as Map keys
// Good key types: String, Integer, Long, enum, immutable custom classes
```

## 11.5 Thread Safety Best Practices

```java
// 1. For read-heavy, write-rare: CopyOnWriteArrayList / CopyOnWriteArraySet
// 2. For general concurrent map: ConcurrentHashMap
// 3. For general concurrent set: ConcurrentHashMap.newKeySet()
// 4. For blocking queue: ArrayBlockingQueue, LinkedBlockingQueue
// 5. AVOID: Collections.synchronizedXxx() wrappers (poor performance under contention)

// Compound operations need external synchronization even with synchronizedMap:
Map<String, List<String>> syncMap = Collections.synchronizedMap(new HashMap<>());

// WRONG: Not atomic!
if (!syncMap.containsKey("key")) {
    syncMap.put("key", new ArrayList<>());
}

// RIGHT: Use ConcurrentHashMap with atomic operations
ConcurrentHashMap<String, List<String>> concMap = new ConcurrentHashMap<>();
concMap.computeIfAbsent("key", k -> new ArrayList<>()).add("value");
```

## 11.6 Memory Considerations

```java
// 1. Trim ArrayList when it won't grow further
ArrayList<String> list = new ArrayList<>();
// ... add many elements, then remove many ...
list.trimToSize(); // Reduces internal array to actual size

// 2. Specify initial capacity to avoid repeated resizing
// BAD:
Map<String, Object> map = new HashMap<>(); // Default capacity 16
// Adding 10,000 entries triggers multiple resizes: 16→32→64→...→16384

// GOOD: Pre-size based on expected elements
// capacity = expectedSize / loadFactor + 1
Map<String, Object> map = new HashMap<>(expectedSize * 4 / 3 + 1);

// BEST (Java 19+):
Map<String, Object> map = HashMap.newHashMap(expectedSize);

// 3. Use specialized collections for primitives (consider Eclipse Collections, Trove)
// Java collections box primitives: int → Integer (16 bytes overhead per element)
```

---

# Chapter 12: Collections and Java 8 Integration

## 12.1 Streams with Collections

```java
List<Order> orders = orderRepository.findAll();

// Filter and collect
List<Order> activeOrders = orders.stream()
    .filter(o -> o.getStatus() == OrderStatus.ACTIVE)
    .collect(Collectors.toList());

// Map transformation
List<String> orderIds = orders.stream()
    .map(Order::getId)
    .collect(Collectors.toList());

// Reduce
double totalRevenue = orders.stream()
    .mapToDouble(Order::getAmount)
    .sum();

// Sort
List<Order> sorted = orders.stream()
    .sorted(Comparator.comparing(Order::getCreatedAt).reversed())
    .collect(Collectors.toList());
```

## 12.2 map vs flatMap

```java
// map: One-to-one transformation
// Input: Stream<Order>  →  Output: Stream<String>
List<String> customerNames = orders.stream()
    .map(Order::getCustomerName)
    .collect(Collectors.toList());

// flatMap: One-to-many transformation (flattens nested structures)
// Input: Stream<Order>  →  Output: Stream<OrderItem> (flattened)
List<OrderItem> allItems = orders.stream()
    .flatMap(order -> order.getItems().stream())
    .collect(Collectors.toList());

// Real-world: Flatten lists of lists
List<List<String>> nestedTags = List.of(
    List.of("java", "spring"),
    List.of("docker", "k8s"),
    List.of("java", "microservices")
);

List<String> allTags = nestedTags.stream()
    .flatMap(Collection::stream)
    .distinct()
    .sorted()
    .collect(Collectors.toList());
// Result: [docker, java, k8s, microservices, spring]
```

## 12.3 Collectors.groupingBy

```java
// Simple grouping
Map<OrderStatus, List<Order>> byStatus = orders.stream()
    .collect(Collectors.groupingBy(Order::getStatus));

// Grouping with counting
Map<OrderStatus, Long> countByStatus = orders.stream()
    .collect(Collectors.groupingBy(Order::getStatus, Collectors.counting()));

// Grouping with downstream collector
Map<String, Double> avgAmountByCity = orders.stream()
    .collect(Collectors.groupingBy(
        Order::getCity,
        Collectors.averagingDouble(Order::getAmount)
    ));

// Multi-level grouping
Map<String, Map<OrderStatus, List<Order>>> byCityAndStatus = orders.stream()
    .collect(Collectors.groupingBy(
        Order::getCity,
        Collectors.groupingBy(Order::getStatus)
    ));

// Grouping with custom map type (TreeMap for sorted keys)
TreeMap<String, List<Order>> sortedByCity = orders.stream()
    .collect(Collectors.groupingBy(
        Order::getCity,
        TreeMap::new,
        Collectors.toList()
    ));
```

## 12.4 Collectors.partitioningBy

```java
// Partition into exactly TWO groups (true/false)
Map<Boolean, List<Order>> partitioned = orders.stream()
    .collect(Collectors.partitioningBy(
        order -> order.getAmount() > 1000.0
    ));

List<Order> highValue = partitioned.get(true);
List<Order> lowValue = partitioned.get(false);

// With downstream collector
Map<Boolean, Long> countPartition = orders.stream()
    .collect(Collectors.partitioningBy(
        order -> order.getAmount() > 1000.0,
        Collectors.counting()
    ));
```

## 12.5 Advanced Collectors

```java
// toMap
Map<String, Order> orderById = orders.stream()
    .collect(Collectors.toMap(
        Order::getId,
        Function.identity(),
        (existing, replacement) -> existing // merge function for duplicates
    ));

// joining
String csvIds = orders.stream()
    .map(Order::getId)
    .collect(Collectors.joining(", ", "[", "]"));
// Result: "[ORD-001, ORD-002, ORD-003]"

// summarizing
DoubleSummaryStatistics stats = orders.stream()
    .collect(Collectors.summarizingDouble(Order::getAmount));
// stats.getCount(), stats.getSum(), stats.getMin(), stats.getMax(), stats.getAverage()

// collectingAndThen
List<Order> unmodifiable = orders.stream()
    .filter(o -> o.getStatus() == OrderStatus.ACTIVE)
    .collect(Collectors.collectingAndThen(
        Collectors.toList(),
        Collections::unmodifiableList
    ));

// toUnmodifiableList (Java 10+)
List<Order> immutable = orders.stream()
    .filter(o -> o.getStatus() == OrderStatus.ACTIVE)
    .collect(Collectors.toUnmodifiableList());
```

## 12.6 forEach, replaceAll, compute Methods

```java
// Map.forEach
Map<String, Integer> inventory = new HashMap<>();
inventory.forEach((product, count) -> 
    System.out.println(product + ": " + count));

// Map.replaceAll
inventory.replaceAll((product, count) -> count * 2); // Double all quantities

// Map.compute
inventory.compute("Widget", (key, val) -> (val == null) ? 1 : val + 1);

// Map.merge - frequency counting
Map<String, Integer> wordCount = new HashMap<>();
for (String word : words) {
    wordCount.merge(word, 1, Integer::sum); // Elegant frequency counter
}

// List.replaceAll (UnaryOperator)
List<String> names = new ArrayList<>(Arrays.asList("alice", "bob", "charlie"));
names.replaceAll(String::toUpperCase); // [ALICE, BOB, CHARLIE]

// List.sort (in-place)
names.sort(Comparator.naturalOrder());
names.sort(Comparator.reverseOrder());
names.sort(Comparator.comparing(String::length));
```

---

# Chapter 13: Design Patterns in the Collections Framework

## 13.1 Iterator Pattern

### What
Provides sequential access to elements of a collection without exposing its underlying representation.

### Implementation in JCF
```java
// Every Collection implements Iterable, which provides an Iterator
public interface Iterable<T> {
    Iterator<T> iterator();
}

public interface Iterator<E> {
    boolean hasNext();
    E next();
    default void remove() { throw new UnsupportedOperationException(); }
    default void forEachRemaining(Consumer<? super E> action) { ... }
}

// Each collection provides its own Iterator implementation:
// ArrayList → Itr (array-based traversal)
// LinkedList → ListItr (node-based traversal)
// HashSet → HashMap.KeyIterator (bucket traversal)
// TreeSet → TreeMap.KeyIterator (in-order traversal)
```

### Why This Pattern
- **Decouples** traversal from collection structure
- Client code works with any collection uniformly
- Multiple traversals can happen simultaneously
- `ListIterator` adds bidirectional traversal for Lists

## 13.2 Factory Pattern

### What
Factory methods create collection instances without specifying exact classes.

### Implementation in JCF
```java
// Static factory methods (Java 9+)
List<String> list = List.of("A", "B", "C");           // Returns immutable List
Set<String> set = Set.of("A", "B", "C");               // Returns immutable Set
Map<String, Integer> map = Map.of("A", 1, "B", 2);    // Returns immutable Map

// Collections utility factory methods
List<String> empty = Collections.emptyList();
List<String> single = Collections.singletonList("A");
List<String> nCopies = Collections.nCopies(10, "default");

// The actual implementation classes are HIDDEN
// List.of() may return List12 (1-2 elements) or ListN (3+ elements)
// These are package-private classes - client never sees them
```

### Why This Pattern
- Hides implementation details
- Can return optimized implementations based on input
- Allows implementation changes without breaking client code

## 13.3 Strategy Pattern

### What
Defines a family of algorithms, encapsulates each one, and makes them interchangeable.

### Implementation in JCF
```java
// Comparator is the Strategy:
List<Employee> employees = getEmployees();

// Strategy 1: Sort by name
employees.sort(Comparator.comparing(Employee::getName));

// Strategy 2: Sort by salary (descending)
employees.sort(Comparator.comparing(Employee::getSalary).reversed());

// Strategy 3: Complex multi-field sorting
employees.sort(
    Comparator.comparing(Employee::getDepartment)
              .thenComparing(Employee::getSalary, Comparator.reverseOrder())
              .thenComparing(Employee::getName)
);

// TreeSet/TreeMap use Comparator as strategy for ordering
TreeSet<Employee> sorted = new TreeSet<>(
    Comparator.comparing(Employee::getName)
);
```

### Why This Pattern
- Sorting algorithm is fixed, but comparison logic is pluggable
- Same sort method works with any ordering strategy

## 13.4 Adapter Pattern

### What
Converts the interface of a class into another interface clients expect. Allows incompatible interfaces to work together.

### Implementation in JCF
```java
// Arrays.asList() - Adapts Array to List
String[] array = {"A", "B", "C"};
List<String> list = Arrays.asList(array);
// Returns a fixed-size List backed by the array - an adapter!

// Collections.enumeration() - Adapts Iterator to Enumeration
List<String> list = new ArrayList<>();
Enumeration<String> enumeration = Collections.enumeration(list);

// Collections.list() - Adapts Enumeration to ArrayList
ArrayList<String> fromEnum = Collections.list(enumeration);

// Map views: keySet(), values(), entrySet()
// These are adapter views - they appear as Set/Collection but are backed by the Map
Map<String, Integer> map = new HashMap<>();
Set<String> keys = map.keySet();      // View adapter
Collection<Integer> values = map.values(); // View adapter
// Changes to the map are reflected in the views and vice versa
```

## 13.5 Decorator Pattern

### What
Attaches additional responsibilities to objects dynamically by wrapping them.

### Implementation in JCF
```java
// Unmodifiable wrappers - add read-only behavior
List<String> mutable = new ArrayList<>();
List<String> readOnly = Collections.unmodifiableList(mutable);
// readOnly wraps mutable, intercepting and blocking write operations

// Synchronized wrappers - add thread-safety behavior
List<String> syncList = Collections.synchronizedList(new ArrayList<>());
// syncList wraps the list, adding synchronized blocks to all methods

// Checked wrappers - add runtime type checking
List<String> checked = Collections.checkedList(new ArrayList<>(), String.class);
// Prevents raw-type insertion of wrong types at runtime
```

## 13.6 Template Method Pattern

### What
Defines the skeleton of an algorithm in a base class, allowing subclasses to override specific steps.

### Implementation in JCF
```java
// AbstractList provides template methods
// Concrete implementations only need to implement:
//   - get(int index) → for immutable list
//   - get(int index) + set() + add() + remove() → for mutable list
// All other methods (indexOf, contains, iterator, subList, etc.) 
// are implemented in terms of these primitive operations

public abstract class AbstractList<E> extends AbstractCollection<E> {
    // Template methods that use get():
    public int indexOf(Object o) {
        ListIterator<E> it = listIterator();
        while (it.hasNext()) {
            if (Objects.equals(it.next(), o)) return it.previousIndex();
        }
        return -1;
    }
}
```

---
