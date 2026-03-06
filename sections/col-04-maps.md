
# Chapter 6: Map Implementations Deep Dive

## 6.1 HashMap

### What
`HashMap` is the most commonly used Map implementation, providing **O(1) average-case** operations. It stores key-value pairs in an **array of buckets** using hashing.

### Internal Data Structure (Java 8+)
```java
public class HashMap<K,V> extends AbstractMap<K,V> implements Map<K,V> {
    
    static final int DEFAULT_INITIAL_CAPACITY = 16;    // Must be power of 2
    static final int MAXIMUM_CAPACITY = 1 << 30;
    static final float DEFAULT_LOAD_FACTOR = 0.75f;
    static final int TREEIFY_THRESHOLD = 8;            // LinkedList → Tree
    static final int UNTREEIFY_THRESHOLD = 6;          // Tree → LinkedList
    static final int MIN_TREEIFY_CAPACITY = 64;
    
    transient Node<K,V>[] table;      // The bucket array
    transient int size;
    int threshold;                     // capacity * loadFactor
    final float loadFactor;
    
    // Basic Node (linked list node)
    static class Node<K,V> implements Map.Entry<K,V> {
        final int hash;
        final K key;
        V value;
        Node<K,V> next;
    }
    
    // TreeNode (red-black tree node, used when bucket has > 8 entries)
    static final class TreeNode<K,V> extends LinkedHashMap.Entry<K,V> {
        TreeNode<K,V> parent;
        TreeNode<K,V> left;
        TreeNode<K,V> right;
        TreeNode<K,V> prev;
        boolean red;
    }
}
```

### Properties

| Property | Value |
|---|---|
| Default capacity | 16 |
| Load factor | 0.75 |
| Allows null key | Yes (one) |
| Allows null values | Yes (multiple) |
| Thread-safe | No |
| Ordering | No guarantee |
| Duplicate keys | No (overwrites value) |

### Enterprise Usage
```java
@Service
public class InMemoryCacheService<K, V> {
    private final Map<K, CacheEntry<V>> cache = new HashMap<>();
    
    public void put(K key, V value, Duration ttl) {
        cache.put(key, new CacheEntry<>(value, Instant.now().plus(ttl)));
    }
    
    public Optional<V> get(K key) {
        CacheEntry<V> entry = cache.get(key);
        if (entry == null || entry.isExpired()) {
            cache.remove(key);
            return Optional.empty();
        }
        return Optional.of(entry.getValue());
    }
}
```

---

## 6.2 LinkedHashMap

### What
`LinkedHashMap` extends `HashMap` and maintains a **doubly-linked list** through all entries, preserving either **insertion order** or **access order**.

### Internal Data Structure
```java
public class LinkedHashMap<K,V> extends HashMap<K,V> implements Map<K,V> {
    
    // Extends HashMap.Node with before/after pointers
    static class Entry<K,V> extends HashMap.Node<K,V> {
        Entry<K,V> before, after; // Doubly-linked list pointers
    }
    
    transient LinkedHashMap.Entry<K,V> head; // Eldest entry
    transient LinkedHashMap.Entry<K,V> tail; // Newest entry
    final boolean accessOrder; // true = access-order, false = insertion-order
}
```

### LRU Cache Using LinkedHashMap
```java
public class LRUCache<K, V> extends LinkedHashMap<K, V> {
    private final int maxSize;
    
    public LRUCache(int maxSize) {
        super(maxSize, 0.75f, true); // accessOrder = true
        this.maxSize = maxSize;
    }
    
    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > maxSize; // Remove oldest when capacity exceeded
    }
}

// Usage in Spring Boot
@Service
public class SessionCacheService {
    private final Map<String, UserSession> sessionCache = 
        Collections.synchronizedMap(new LRUCache<>(1000));
    
    public void createSession(String token, UserSession session) {
        sessionCache.put(token, session);
    }
    
    public Optional<UserSession> getSession(String token) {
        return Optional.ofNullable(sessionCache.get(token));
        // get() moves entry to tail (most recently accessed)
    }
}
```

---

## 6.3 TreeMap

### What
`TreeMap` is a **Red-Black Tree** based NavigableMap implementation. Keys are stored in **sorted order** (natural ordering or custom Comparator).

### Time Complexity

| Operation | Time Complexity |
|---|---|
| `put(k, v)` | O(log n) |
| `get(k)` | O(log n) |
| `remove(k)` | O(log n) |
| `containsKey(k)` | O(log n) |
| `firstKey()` / `lastKey()` | O(log n) |
| `floorKey()` / `ceilingKey()` | O(log n) |

### Enterprise Usage
```java
@Service
public class TimeSeriesService {
    
    // TreeMap for time-ordered data with range queries
    private final TreeMap<Instant, MetricValue> metrics = new TreeMap<>();
    
    public void record(Instant timestamp, MetricValue value) {
        metrics.put(timestamp, value);
    }
    
    // Range query - get metrics within time window
    public NavigableMap<Instant, MetricValue> getMetricsInRange(
            Instant from, Instant to) {
        return metrics.subMap(from, true, to, true);
    }
    
    // Get latest metric before a timestamp
    public Map.Entry<Instant, MetricValue> getLatestBefore(Instant timestamp) {
        return metrics.floorEntry(timestamp);
    }
}
```

---

## 6.4 Hashtable (Legacy)

### What
`Hashtable` is a legacy synchronized Map implementation from Java 1.0. **Do not use in modern code.**

| Feature | HashMap | Hashtable |
|---|---|---|
| Synchronization | Not synchronized | All methods synchronized |
| Null keys | Allows one null key | Does NOT allow null key |
| Null values | Allows null values | Does NOT allow null values |
| Performance | Faster | Slower (sync overhead) |
| Iterator | Fail-fast Iterator | Fail-safe Enumerator + Fail-fast Iterator |
| Extends | AbstractMap | Dictionary (legacy) |
| Introduced | Java 1.2 | Java 1.0 |

---

## 6.5 ConcurrentHashMap

### What
`ConcurrentHashMap` is a **thread-safe** HashMap designed for high concurrency. Unlike `Hashtable`, it does NOT lock the entire map.

### Java 8+ Implementation
```java
// Java 8+ uses CAS (Compare-And-Swap) + synchronized on individual bins
// No more Segment-based locking from Java 7

// Simplified structure
public class ConcurrentHashMap<K,V> extends AbstractMap<K,V>
        implements ConcurrentMap<K,V> {
    
    transient volatile Node<K,V>[] table;
    
    // put operation uses CAS for empty bins, synchronized for occupied bins
    final V putVal(K key, V value, boolean onlyIfAbsent) {
        // 1. Compute hash
        // 2. If bin is empty → CAS to insert (no lock!)
        // 3. If bin is occupied → synchronized(bin_head) { insert into chain/tree }
        // 4. If chain length > TREEIFY_THRESHOLD → convert to tree
    }
}
```

### Key Features
- **No null keys or values** (unlike HashMap)
- **CAS operations** for empty bucket insertion (lock-free)
- **Per-bucket synchronization** for occupied buckets
- **Atomic compound operations**: `putIfAbsent()`, `compute()`, `merge()`

### Enterprise Usage
```java
@Component
public class RateLimiter {
    private final ConcurrentHashMap<String, AtomicInteger> requestCounts = 
        new ConcurrentHashMap<>();
    private final int maxRequestsPerMinute;
    
    public boolean isAllowed(String clientId) {
        AtomicInteger count = requestCounts.computeIfAbsent(
            clientId, k -> new AtomicInteger(0)
        );
        return count.incrementAndGet() <= maxRequestsPerMinute;
    }
    
    @Scheduled(fixedRate = 60000)
    public void resetCounts() {
        requestCounts.clear();
    }
}

// Concurrent cache with atomic compute
@Service
public class MetricsService {
    private final ConcurrentHashMap<String, LongAdder> counters = 
        new ConcurrentHashMap<>();
    
    public void increment(String metricName) {
        counters.computeIfAbsent(metricName, k -> new LongAdder()).increment();
    }
    
    public Map<String, Long> getSnapshot() {
        Map<String, Long> snapshot = new HashMap<>();
        counters.forEach((key, value) -> snapshot.put(key, value.sum()));
        return snapshot;
    }
}
```

---

## 6.6 WeakHashMap

### What
A Map implementation with **weak references** for keys. Entries are automatically removed when keys are no longer referenced elsewhere (garbage collected).

### When to Use
- Caches where entries should be garbage collected when keys are no longer in use
- Canonical mapping (identity caches)
- Metadata association with objects whose lifecycle you don't control

```java
// Example: Associating metadata with objects
WeakHashMap<Thread, ThreadMetadata> threadMetadata = new WeakHashMap<>();

Thread t = new Thread(runnable);
threadMetadata.put(t, new ThreadMetadata("worker-1"));

// When thread 't' is no longer referenced and GC'd,
// the entry is automatically removed from the map
```

---

## 6.7 IdentityHashMap

### What
Uses **reference equality** (`==`) instead of **object equality** (`equals()`) for comparing keys. Two keys are equal only if they are the exact same object reference.

```java
IdentityHashMap<String, Integer> map = new IdentityHashMap<>();
String s1 = new String("hello");
String s2 = new String("hello");

map.put(s1, 1);
map.put(s2, 2);

System.out.println(map.size()); // 2! (s1 != s2 by reference)
// Regular HashMap would give size = 1
```

### When to Use
- Serialization frameworks (tracking object identity, not equality)
- Object graph traversal (avoiding infinite loops)
- Performance optimization when reference equality is sufficient

---

## 6.8 EnumMap

### What
A specialized Map for **enum keys**, internally using an **array** indexed by enum ordinal values. Extremely fast and memory-efficient.

```java
public enum OrderStatus { PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED }

// EnumMap usage
EnumMap<OrderStatus, List<Order>> ordersByStatus = new EnumMap<>(OrderStatus.class);
for (OrderStatus status : OrderStatus.values()) {
    ordersByStatus.put(status, new ArrayList<>());
}

// Enterprise usage
@Service
public class OrderDashboardService {
    
    public Map<OrderStatus, Long> getOrderStatistics() {
        EnumMap<OrderStatus, Long> stats = new EnumMap<>(OrderStatus.class);
        
        for (OrderStatus status : OrderStatus.values()) {
            stats.put(status, orderRepository.countByStatus(status));
        }
        return stats;
    }
}
```

### Performance
All operations are **O(1)** - direct array access by ordinal index. No hashing needed.

---

# Chapter 7: HashMap Internals – The Complete Deep Dive

## 7.1 Hashing Mechanism

### hash() Function
```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

**Why XOR with upper 16 bits?**
The bucket index is computed as: `index = hash & (capacity - 1)`. For small capacities (e.g., 16), only the lower 4 bits matter. The XOR spreads the influence of higher bits to lower bits, reducing collisions.

```
hashCode():    1010 1100 0011 0111 1001 0101 1110 0010
h >>> 16:      0000 0000 0000 0000 1010 1100 0011 0111
XOR result:    1010 1100 0011 0111 0011 1001 1101 0101
                                    ↑ Higher bits affect lower bits
```

### Bucket Index Calculation
```java
// index = hash & (n - 1)  where n = table.length (always power of 2)
// This is equivalent to hash % n but FASTER (bitwise AND vs modulo)

// Example with capacity = 16 (n-1 = 15 = 0000 1111)
hash = 0011 1001 1101 0101
n-1  = 0000 0000 0000 1111
AND  = 0000 0000 0000 0101  → bucket index = 5
```

## 7.2 Bucket Structure

```
HashMap table (array of Node/TreeNode):

Index 0:  null
Index 1:  [K1,V1] → [K5,V5] → null          (LinkedList, 2 entries)
Index 2:  null
Index 3:  [K2,V2] → null                      (LinkedList, 1 entry)
Index 4:  null
Index 5:  [K3,V3] → [K7,V7] → ... → [K15,V15] (TreeNode, >8 entries)
...
Index 15: [K4,V4] → null
```

## 7.3 put() Operation – Step by Step

```java
map.put("name", "John");
```

**Step 1:** Calculate hash
```java
int hash = hash("name"); // "name".hashCode() ^ ("name".hashCode() >>> 16)
```

**Step 2:** Find bucket index
```java
int index = hash & (table.length - 1);
```

**Step 3:** Check bucket
```java
if (table[index] == null) {
    // Empty bucket - create new Node
    table[index] = new Node<>(hash, "name", "John", null);
} else {
    // Collision - bucket is occupied
    Node<K,V> p = table[index];
    
    // Check if key already exists
    if (p.hash == hash && (p.key == key || key.equals(p.key))) {
        // Key exists - update value
        p.value = "John";
    } else {
        // Key doesn't exist - add to chain
        // If chain is LinkedList → append to end
        // If chain is TreeNode → insert into Red-Black tree
        
        // After insertion, check chain length
        if (chainLength >= TREEIFY_THRESHOLD - 1) {  // >= 7
            treeifyBin(table, hash); // Convert to Red-Black tree
        }
    }
}
```

**Step 4:** Check if resize needed
```java
if (++size > threshold) { // threshold = capacity * loadFactor
    resize(); // Double the capacity
}
```

## 7.4 Collision Resolution

### Phase 1: Chaining with LinkedList (length < 8)
```
Bucket[5]: [K1,V1] → [K2,V2] → [K3,V3] → null
           All have same bucket index but different keys
```

### Phase 2: Treeification (length >= 8 AND capacity >= 64)
```
When chain length reaches TREEIFY_THRESHOLD (8):
- If table capacity < MIN_TREEIFY_CAPACITY (64): RESIZE instead
- If table capacity >= 64: Convert LinkedList to Red-Black Tree

Bucket[5]:          [K5]
                   /    \
                [K2]    [K8]
               /   \      \
            [K1]  [K3]   [K9]
```

### Phase 3: Untreeification (length <= 6)
When a tree is reduced to UNTREEIFY_THRESHOLD (6) or fewer nodes (via removal), it's converted back to a LinkedList.

## 7.5 Load Factor and Rehashing

### Load Factor
```
Load Factor = number_of_entries / number_of_buckets

Default load factor = 0.75f
- At 75% capacity, HashMap resizes
- This is a balance between space and time efficiency

Higher load factor (e.g., 0.9):
  + Less memory usage
  - More collisions, slower lookups

Lower load factor (e.g., 0.5):
  + Fewer collisions, faster lookups
  - More memory usage
```

### Resizing (Rehashing)
```java
// When size > threshold (capacity * loadFactor):
// 1. Create new table with DOUBLE capacity
// 2. Rehash ALL entries into new table
// 3. Because capacity changed, bucket indices change

// Example:
// Old capacity = 16: index = hash & 15  (0000 1111)
// New capacity = 32: index = hash & 31  (0001 1111)

// Clever optimization in Java 8:
// Each entry either stays in same index OR moves to (oldIndex + oldCapacity)
// This is determined by a single bit check: (hash & oldCapacity) == 0 ?
```

### Resize Growth Pattern
```
Capacity:  16 → 32 → 64 → 128 → 256 → 512 → 1024 → ...
Threshold: 12 → 24 → 48 →  96 → 192 → 384 →  768 → ...
(at load factor 0.75)
```

## 7.6 Java 8 Improvements in HashMap

| Feature | Java 7 | Java 8 |
|---|---|---|
| Collision handling | LinkedList only | LinkedList + Red-Black Tree |
| Worst-case get() | O(n) | O(log n) |
| Hash function | Complex (multiple shifts/XORs) | Simplified (single XOR with upper 16 bits) |
| Resize distribution | Rehash all entries | Bit-check optimization (stays or moves) |
| Insertion in chain | Head insertion | Tail insertion |

**Why tail insertion matters:**
- Java 7 (head insertion): Under concurrent resize, can create **infinite loops** in the linked list (circular reference)
- Java 8 (tail insertion): Maintains insertion order within bucket, avoids circular reference issue

## 7.7 Null Key Handling
```java
// HashMap allows ONE null key - it always goes to bucket index 0
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
    // null → hash = 0 → bucket index = 0
}
```

---

# Chapter 8: TreeMap, LinkedHashMap, and ConcurrentHashMap Internals

## 8.1 TreeMap Internals – Red-Black Tree

### What is a Red-Black Tree?
A **self-balancing binary search tree** with the following properties:
1. Every node is either **RED** or **BLACK**
2. The **root** is always BLACK
3. Every **null leaf** (NIL) is BLACK
4. If a node is RED, both its children must be BLACK (no two consecutive red nodes)
5. Every path from a node to any descendant NIL has the **same number of black nodes** (black-height)

### Visualization
```
          [40:BLACK]
         /          \
    [20:RED]       [60:RED]
    /      \       /      \
[10:BLK] [30:BLK] [50:BLK] [70:BLK]
```

### Balancing Operations

**Left Rotation:**
```
    x                y
   / \      →      / \
  a   y           x   c
     / \         / \
    b   c       a   b
```

**Right Rotation:**
```
      y             x
     / \     →     / \
    x   c         a   y
   / \               / \
  a   b             b   c
```

### TreeMap put() Process
1. If tree is empty → create root node (BLACK)
2. Traverse tree comparing keys using `compareTo()` or `Comparator`
3. Insert new node as RED leaf
4. Fix violations (recolor and rotate)

### Time Complexity
All operations (get, put, remove) are **O(log n)** guaranteed because the tree height is always ≤ 2·log₂(n+1).

---

## 8.2 LinkedHashMap Internals

### Insertion Order Tracking
```java
// Each entry has before/after pointers forming a doubly-linked list
// Overlaid on top of the normal HashMap bucket structure

// HashMap structure:
// Bucket[0]: [A] → [D] → null
// Bucket[1]: [B] → null
// Bucket[2]: [C] → null

// LinkedHashMap adds: head ↔ A ↔ B ↔ C ↔ D ↔ tail (insertion order)
```

### Access Order Mode
```java
// When accessOrder = true:
LinkedHashMap<String, String> map = new LinkedHashMap<>(16, 0.75f, true);
map.put("A", "1"); // Order: A
map.put("B", "2"); // Order: A, B
map.put("C", "3"); // Order: A, B, C

map.get("A");      // Order: B, C, A  (A moved to tail)
map.get("B");      // Order: C, A, B  (B moved to tail)
```

### removeEldestEntry Hook
```java
// Called after every put() operation
protected boolean removeEldestEntry(Map.Entry<K,V> eldest) {
    return false; // Default: never remove
}

// Override for LRU cache behavior:
// return size() > maxCapacity;
```

---

## 8.3 ConcurrentHashMap Internals (Java 8+)

### Architecture
```
ConcurrentHashMap uses fine-grained locking:

table[] (volatile Node array)
  |
  [0] → null
  [1] → Node → Node → null       (synchronized on first node of bin)
  [2] → TreeBin → TreeNodes      (synchronized on TreeBin)
  [3] → null
  ...
  [n] → ForwardingNode            (indicates resize in progress)
```

### Concurrency Mechanisms

**1. CAS (Compare-And-Swap) for empty bins:**
```java
// If bucket is empty, use CAS to atomically insert
// No lock needed! This is the fast path
if (casTabAt(tab, i, null, new Node<>(hash, key, value)))
    break;
```

**2. synchronized on bin head for occupied bins:**
```java
// If bucket is occupied, lock only the first node of that bin
synchronized (f) {  // f = first node in bucket
    // Insert into chain or tree
}
// Other buckets remain unlocked - high concurrency!
```

**3. Volatile reads for visibility:**
```java
// table is declared as volatile
transient volatile Node<K,V>[] table;

// Reads use volatile access (Unsafe.getObjectVolatile)
// Ensures visibility of writes across threads
```

### Bulk Operations (Java 8+)
```java
ConcurrentHashMap<String, Long> map = new ConcurrentHashMap<>();

// Parallel forEach
map.forEach(4, // parallelism threshold
    (key, value) -> System.out.println(key + ": " + value)
);

// Parallel search
String result = map.search(4,
    (key, value) -> value > 1000 ? key : null
);

// Parallel reduce
long total = map.reduceValues(4, Long::sum);
```

### ConcurrentHashMap vs Collections.synchronizedMap

| Feature | ConcurrentHashMap | synchronizedMap |
|---|---|---|
| Locking | Per-bin | Entire map |
| Read locking | No locks (volatile reads) | Full lock |
| Concurrency level | High (many threads) | Low (one at a time) |
| Null keys/values | NOT allowed | Depends on wrapped map |
| Iteration | Weakly consistent | Fail-fast |
| Atomic operations | Yes (compute, merge, etc.) | No |
| Performance | Excellent under contention | Poor under contention |

---
