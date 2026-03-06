
# Chapter 14: Interview Preparation – 150+ Questions with Answers

---

## BEGINNER LEVEL (Questions 1–40)

**Q1. What is the Java Collections Framework?**
The JCF is a unified architecture in `java.util` that provides interfaces (List, Set, Map, Queue), implementations (ArrayList, HashSet, HashMap), and algorithms (sort, search) for storing and manipulating groups of objects.

**Q2. What is the difference between Collection and Collections?**
`Collection` is a root **interface** for List, Set, Queue. `Collections` is a **utility class** with static methods like `sort()`, `synchronizedList()`, `unmodifiableMap()`.

**Q3. What is the difference between Array and ArrayList?**
Arrays are fixed-size, support primitives, and have O(1) access. ArrayList is dynamic, stores objects only (autoboxing for primitives), and provides a rich API.

**Q4. What is the difference between ArrayList and LinkedList?**
ArrayList uses a resizable array (O(1) random access, O(n) insertion). LinkedList uses doubly-linked nodes (O(n) random access, O(1) add/remove at ends).

**Q5. What is the difference between List and Set?**
List allows duplicates and maintains insertion order with index access. Set does not allow duplicates and (in HashSet) does not guarantee order.

**Q6. What is the difference between HashSet and TreeSet?**
HashSet uses hashing (O(1) operations, unordered). TreeSet uses a Red-Black Tree (O(log n) operations, sorted order).

**Q7. What is the difference between HashMap and Hashtable?**
HashMap: not synchronized, allows one null key, extends AbstractMap. Hashtable: synchronized, no null key/value, extends Dictionary (legacy).

**Q8. Why HashMap allows one null key but Hashtable does not?**
HashMap explicitly handles null keys by mapping them to bucket index 0 (`hash(null) = 0`). Hashtable calls `key.hashCode()` directly, which throws NPE on null.

**Q9. What is the default capacity and load factor of HashMap?**
Default capacity is 16, default load factor is 0.75 (resizes at 12 entries).

**Q10. What happens when two keys have the same hashCode in HashMap?**
A collision occurs – both entries go to the same bucket. They are stored in a linked list (or tree if > 8 entries). On `get()`, `equals()` is used to find the correct entry.

**Q11. What is the difference between Comparable and Comparator?**
`Comparable` (in the class itself, `compareTo()`, natural ordering) vs `Comparator` (external, `compare()`, custom ordering). TreeSet/TreeMap use one of these.

**Q12. What is the difference between Iterator and ListIterator?**
Iterator: forward-only, works with any Collection. ListIterator: bidirectional, index-based operations, works only with List.

**Q13. What is the difference between Iterator and Enumeration?**
Iterator: fail-fast, has `remove()`. Enumeration: legacy, no `remove()`, verbose method names (`hasMoreElements()`/`nextElement()`).

**Q14. Can we use null as a key in HashMap?**
Yes, exactly one null key is allowed. It is always stored in bucket 0.

**Q15. Can we use null as a key in TreeMap?**
No (with natural ordering). TreeMap calls `compareTo()` on the key, which throws NPE for null. With a custom Comparator that handles null, it's theoretically possible.

**Q16. What is the difference between poll() and remove() in Queue?**
`remove()` throws `NoSuchElementException` if queue is empty. `poll()` returns `null` if empty.

**Q17. What is the difference between peek() and element() in Queue?**
`element()` throws `NoSuchElementException` if empty. `peek()` returns `null`.

**Q18. How does ArrayList grow internally?**
New capacity = old capacity + (old capacity >> 1), i.e., grows by 50%. Uses `Arrays.copyOf()` which calls `System.arraycopy()`.

**Q19. What is the default size of ArrayList?**
The default capacity is 10 (allocated lazily on first `add()`).

**Q20. What is the difference between synchronized collection and concurrent collection?**
Synchronized collections lock the entire collection per operation. Concurrent collections (ConcurrentHashMap) use fine-grained locking/CAS for better throughput.

**Q21. What is an immutable collection?**
A collection that cannot be modified after creation. `List.of()`, `Set.of()`, `Map.of()` (Java 9+), `Collections.unmodifiableXxx()`.

**Q22. What is the difference between `Collections.unmodifiableList()` and `List.of()`?**
`unmodifiableList()` is a view wrapper – changes to the original list are visible. `List.of()` creates a truly immutable copy.

**Q23. What is `Arrays.asList()`?**
Returns a fixed-size list backed by the array. You can `set()` elements but cannot `add()` or `remove()` (throws `UnsupportedOperationException`).

**Q24. How to convert Array to ArrayList?**
`new ArrayList<>(Arrays.asList(array))` – creates a mutable ArrayList from the array.

**Q25. What is the difference between `remove(int index)` and `remove(Object o)` in List?**
`remove(int)` removes by index, returns the removed element. `remove(Object)` removes the first occurrence, returns boolean.

**Q26. What is the initial capacity and growth of Vector?**
Initial capacity: 10. Growth: doubles (100% increase), unlike ArrayList which grows by 50%.

**Q27. Why is Stack class considered deprecated in practice?**
Stack extends Vector (IS-A violation), inherits synchronized overhead and non-LIFO methods like `add(index, e)`. Use `Deque` (ArrayDeque) instead.

**Q28. What is EnumSet?**
A specialized Set for enum types using a bit vector internally. Extremely fast (O(1) all operations) and memory efficient.

**Q29. What is `IdentityHashMap`?**
A Map that uses reference equality (`==`) instead of `equals()` for key comparison. Used in serialization and graph algorithms.

**Q30. What does `Collections.synchronizedList()` return?**
A wrapper list where every method is synchronized on a mutex object. Iteration still needs external synchronization.

**Q31. Can a Set contain duplicate elements?**
No. If you try to add a duplicate, `add()` returns `false` and the set remains unchanged.

**Q32. What is the difference between `HashMap.put()` and `HashMap.putIfAbsent()`?**
`put()` always inserts/overwrites. `putIfAbsent()` only inserts if the key is absent or mapped to null.

**Q33. How to sort a List in Java?**
`Collections.sort(list)` or `list.sort(comparator)` (Java 8+). Both use TimSort (O(n log n)).

**Q34. What is WeakHashMap?**
A Map with weak-reference keys. Entries are automatically removed when keys are garbage collected. Used for caches.

**Q35. How does LinkedHashSet maintain insertion order?**
It uses LinkedHashMap internally, which maintains a doubly-linked list through entries.

**Q36. Can we add heterogeneous objects to a collection?**
Without generics, yes (stored as Object). With generics, the compiler enforces type safety.

**Q37. What is the `NavigableSet` interface?**
Extends SortedSet with navigation methods: `lower()`, `floor()`, `ceiling()`, `higher()`, `pollFirst()`, `pollLast()`, `descendingSet()`.

**Q38. What is the `NavigableMap` interface?**
Extends SortedMap with navigation methods: `lowerKey()`, `floorKey()`, `ceilingKey()`, `higherKey()`, `pollFirstEntry()`, `pollLastEntry()`.

**Q39. What is `Collections.singletonList()`?**
Returns an immutable list containing only the specified element. Memory efficient for single-element lists.

**Q40. What is the time complexity of `contains()` in ArrayList vs HashSet?**
ArrayList: O(n) linear search. HashSet: O(1) average (hash-based lookup).

---

## INTERMEDIATE LEVEL (Questions 41–80)

**Q41. How does HashSet ensure uniqueness?**
HashSet is backed by HashMap. Elements are stored as keys with a dummy value. When `add(e)` is called, if `map.put(e, PRESENT)` returns a non-null value, it means the element already existed.

**Q42. What happens if we override `equals()` but not `hashCode()`?**
Two logically equal objects may have different hashCodes, placing them in different HashMap buckets. This breaks Set uniqueness and Map key lookup.

**Q43. What is ConcurrentModificationException?**
Thrown by fail-fast iterators when the collection is structurally modified during iteration (except through the iterator's own `remove()` method).

**Q44. How to avoid ConcurrentModificationException?**
Use `Iterator.remove()`, `removeIf()` (Java 8), collect-then-remove pattern, CopyOnWriteArrayList, or ConcurrentHashMap.

**Q45. What is the `Spliterator` interface?**
Introduced in Java 8 for parallel stream processing. It can split a collection into partitions for parallel traversal. Methods: `tryAdvance()`, `trySplit()`, `characteristics()`.

**Q46. How does a PriorityQueue order elements?**
Using a binary min-heap. The head is the smallest element (by natural ordering or Comparator). It is NOT sorted – only the head is guaranteed to be the minimum.

**Q47. What is the difference between PriorityQueue and TreeSet?**
PriorityQueue allows duplicates, provides O(1) `peek()` for min, uses heap. TreeSet has no duplicates, all elements sorted, uses Red-Black Tree.

**Q48. What is `Deque` and when to use it?**
Double-Ended Queue supporting insertion/removal at both ends. Use as Stack (LIFO) or Queue (FIFO). Recommended over `Stack` class.

**Q49. What is the difference between ArrayDeque and LinkedList as a Deque?**
ArrayDeque: array-based circular buffer, better cache locality, less memory. LinkedList: node-based, higher memory overhead, allows null elements.

**Q50. How does LinkedList implement both List and Deque?**
It uses a doubly-linked node structure. `get(index)` traverses nodes (List behavior). `addFirst()`/`addLast()` directly modify head/tail pointers (Deque behavior).

**Q51. What is the `computeIfAbsent()` method?**
If the key has no mapping, computes the value using the provided function and inserts it. Atomic in ConcurrentHashMap.
```java
map.computeIfAbsent("key", k -> expensiveComputation(k));
```

**Q52. What is the `merge()` method in Map?**
If key exists, applies the remapping function to merge values. If absent, inserts the value.
```java
map.merge("key", 1, Integer::sum); // Increment count
```

**Q53. How does `HashMap` handle hash collisions in Java 8 vs Java 7?**
Java 7: Linked list only (O(n) worst case). Java 8: Linked list for ≤8 entries, Red-Black Tree for >8 (O(log n) worst case).

**Q54. What is treeification in HashMap?**
When a bucket's chain length exceeds `TREEIFY_THRESHOLD` (8) AND table capacity ≥ `MIN_TREEIFY_CAPACITY` (64), the linked list is converted to a Red-Black Tree.

**Q55. What is the `TREEIFY_THRESHOLD` in HashMap?**
8. When a bucket has more than 8 entries, the linked list is converted to a tree (if capacity ≥ 64).

**Q56. What is the `UNTREEIFY_THRESHOLD` in HashMap?**
6. When a tree bucket shrinks to 6 or fewer entries, it's converted back to a linked list.

**Q57. Why is HashMap capacity always a power of 2?**
So that `hash & (capacity - 1)` can be used instead of `hash % capacity`. Bitwise AND is significantly faster than modulo.

**Q58. What is the hash() distribution function used in Java 8 HashMap?**
`(h = key.hashCode()) ^ (h >>> 16)`. XORs upper 16 bits with lower 16 bits to spread hash values and reduce collisions for small tables.

**Q59. How does HashMap resize?**
When `size > capacity * loadFactor`, the table doubles in size. Each entry either stays at the same index or moves to `oldIndex + oldCapacity`, determined by `(hash & oldCapacity) == 0`.

**Q60. What is the difference between HashMap and LinkedHashMap?**
LinkedHashMap maintains entry insertion order (or access order) via a doubly-linked list. HashMap has no ordering guarantee.

**Q61. How to implement an LRU Cache in Java?**
Extend `LinkedHashMap` with `accessOrder=true` and override `removeEldestEntry()` to evict when size exceeds capacity.

**Q62. What is `CopyOnWriteArrayList`?**
A thread-safe List where every mutation (add, remove, set) creates a new copy of the internal array. Ideal for read-heavy, write-rare scenarios.

**Q63. What is the difference between `fail-fast` and `fail-safe` iterators?**
Fail-fast: detect concurrent modification via `modCount`, throw CME (ArrayList, HashMap). Fail-safe: work on a copy/snapshot, never throw CME (CopyOnWriteArrayList, ConcurrentHashMap).

**Q64. How does `modCount` track concurrent modification?**
`modCount` is incremented on every structural modification. The iterator saves it as `expectedModCount` and checks equality before each operation.

**Q65. What is the difference between `Comparable` and `Comparator` with examples?**
```java
// Comparable: class implements comparison logic
class Employee implements Comparable<Employee> {
    public int compareTo(Employee o) { return this.name.compareTo(o.name); }
}

// Comparator: external comparison logic
Comparator<Employee> bySalary = Comparator.comparing(Employee::getSalary);
```

**Q66. How to make a collection thread-safe?**
`Collections.synchronizedXxx()`, `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue`, or external synchronization.

**Q67. What is `Collections.unmodifiableList()` and when to use it?**
Returns a read-only view wrapper. Use to return immutable references from APIs, protecting internal state.

**Q68. What is the diamond operator?**
Java 7+ type inference: `List<String> list = new ArrayList<>()` – compiler infers generic type.

**Q69. Can we add elements to an unmodifiable collection?**
No, `add()`/`remove()` throw `UnsupportedOperationException`. But changes to the original collection (for `Collections.unmodifiableXxx()`) are visible.

**Q70. What is the difference between `List.of()` and `Arrays.asList()`?**
`List.of()`: truly immutable, no nulls allowed. `Arrays.asList()`: fixed-size, backed by array, allows set(), allows nulls.

**Q71. How does `TreeMap` maintain sorted order?**
Uses a Red-Black Tree (self-balancing BST). Keys are sorted by natural ordering or a Comparator.

**Q72. What is the `subMap()` method in TreeMap?**
Returns a view of the map whose keys range from `fromKey` to `toKey`.
```java
NavigableMap<String, V> sub = treeMap.subMap("B", true, "F", false);
```

**Q73. What is `EnumMap` and why is it faster than HashMap?**
A Map for enum keys using an internal array indexed by ordinal value. O(1) direct access, no hashing needed.

**Q74. What is the `removeIf()` method?**
Java 8 default method on Collection that removes elements matching a predicate. Safe from CME.
```java
list.removeIf(item -> item.getAge() < 18);
```

**Q75. What are the Java 9+ collection factory methods?**
`List.of()`, `Set.of()`, `Map.of()`, `Map.ofEntries()`. Create immutable collections.

**Q76. What is `Collectors.toUnmodifiableList()`?**
Java 10+ collector that creates an immutable list from stream. Equivalent to `collectingAndThen(toList(), Collections::unmodifiableList)`.

**Q77. How to convert List to Map in Java 8?**
```java
Map<Long, Employee> map = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Function.identity()));
```

**Q78. What is `Collectors.groupingBy()`?**
Groups stream elements by a classifier function, returning `Map<K, List<V>>`.

**Q79. What is `Collectors.partitioningBy()`?**
Special case of grouping that creates exactly two groups (true/false) based on a predicate.

**Q80. What is the difference between `stream()` and `parallelStream()`?**
`stream()`: sequential processing. `parallelStream()`: uses ForkJoinPool for parallel processing. Use parallel only for CPU-intensive operations on large datasets.

---

## ADVANCED LEVEL (Questions 81–130)

**Q81. Explain the complete internal working of HashMap.put().**
1) Compute hash: `(h = key.hashCode()) ^ (h >>> 16)`. 2) Find bucket: `hash & (n-1)`. 3) If empty bucket: create new Node. 4) If occupied: traverse chain – if key found (by hash AND equals), update value; else append new node. 5) If chain length ≥ 8: treeify. 6) If size > threshold: resize (double capacity).

**Q82. Why did Java 8 switch from head insertion to tail insertion in HashMap?**
Head insertion in Java 7 could cause infinite loops under concurrent resize (circular references in linked list). Tail insertion maintains order and avoids this issue.

**Q83. How does ConcurrentHashMap achieve thread safety without locking the entire map?**
Java 8: Empty bins use CAS (lock-free). Occupied bins use `synchronized` on the first node of the bin only. Reads use volatile access (no locks). This provides high concurrency.

**Q84. What is CAS (Compare-And-Swap)?**
An atomic CPU instruction: if current value == expected value, set to new value. ConcurrentHashMap uses CAS for lock-free insertion into empty bins.

**Q85. How does ConcurrentHashMap.size() work?**
Uses a `baseCount` with `CounterCell` array for distributed counting (like `LongAdder`). Avoids single-point contention on a counter variable.

**Q86. What is the difference between `ConcurrentHashMap.putIfAbsent()` and `HashMap.putIfAbsent()`?**
Both have same behavior, but ConcurrentHashMap's is atomic (thread-safe). HashMap's is not atomic under concurrent access.

**Q87. Can ConcurrentHashMap have null keys or values?**
No. Both null key and null value throw `NullPointerException`. This is by design – null would be ambiguous with "key not found".

**Q88. What is a Red-Black Tree? How is it used in HashMap?**
A self-balancing BST with color properties ensuring O(log n) height. In HashMap (Java 8+), when a bucket's chain exceeds 8 entries, it converts from linked list to red-black tree.

**Q89. What are Red-Black Tree rotations?**
Left rotation and right rotation are used to rebalance the tree after insertions/deletions. They change parent-child relationships while maintaining BST properties.

**Q90. How does TreeMap guarantee O(log n) operations?**
TreeMap uses a Red-Black Tree. After every insertion/deletion, the tree self-balances through recoloring and rotations, keeping height ≤ 2·log₂(n+1).

**Q91. What is the difference between `synchronized(map)` and `ConcurrentHashMap`?**
`synchronized(map)`: exclusive lock, only one thread operates at a time. ConcurrentHashMap: per-bin locking + CAS, multiple threads operate concurrently on different bins.

**Q92. What is `ConcurrentSkipListMap`?**
A concurrent, sorted NavigableMap using skip lists. Provides O(log n) operations with thread safety. Use instead of `synchronizedMap(new TreeMap())`.

**Q93. How does `LinkedHashMap` support access-order iteration?**
When `accessOrder=true`, every `get()` or `put()` moves the accessed entry to the tail of the doubly-linked list. Iteration goes head→tail (eldest→newest).

**Q94. What is `WeakHashMap` and when would you use it?**
A Map where keys are held via `WeakReference`. When a key is GC'd, its entry is automatically removed. Used for metadata caches tied to object lifecycle.

**Q95. How does `IdentityHashMap` differ from `HashMap` in collision resolution?**
Uses `System.identityHashCode()` instead of `hashCode()`, and `==` instead of `equals()`. Uses linear probing instead of chaining.

**Q96. What is the difference between `keySet()`, `values()`, and `entrySet()`?**
All three return **views** backed by the map. `keySet()`: Set of keys. `values()`: Collection of values. `entrySet()`: Set of Map.Entry pairs. Changes to views affect the map.

**Q97. What is `Map.Entry`?**
An inner interface of Map representing a key-value pair. Methods: `getKey()`, `getValue()`, `setValue()`.

**Q98. How to iterate over a Map efficiently?**
```java
// Best practice: entrySet() to avoid double lookup
for (Map.Entry<K, V> entry : map.entrySet()) {
    K key = entry.getKey();
    V value = entry.getValue();
}
// Java 8:
map.forEach((key, value) -> { ... });
```

**Q99. What is the `Spliterator.characteristics()` method?**
Returns characteristics of the collection: ORDERED, DISTINCT, SORTED, SIZED, NONNULL, IMMUTABLE, CONCURRENT, SUBSIZED.

**Q100. How does `Collections.sort()` work internally?**
Uses TimSort (hybrid of merge sort and insertion sort). O(n log n) worst case, O(n) best case (nearly sorted data). Stable sort.

**Q101. What is the difference between `Comparator.naturalOrder()` and `Comparator.reverseOrder()`?**
`naturalOrder()`: sorts by the element's `compareTo()`. `reverseOrder()`: reverse of natural order. Both return singleton Comparator instances.

**Q102. Explain `Comparator.comparing()` with `thenComparing()`.**
```java
Comparator<Employee> comp = Comparator.comparing(Employee::getDepartment)
                                      .thenComparing(Employee::getSalary)
                                      .thenComparing(Employee::getName);
```
Chains multiple comparison criteria.

**Q103. What is `Comparator.nullsFirst()` and `nullsLast()`?**
Wraps a Comparator to handle null values: `nullsFirst()` sorts nulls before non-nulls, `nullsLast()` sorts nulls after.

**Q104. How do streams differ from collections?**
Collections store data (eager). Streams process data (lazy, can be infinite). Streams don't mutate source, support parallel processing, and are consumed once.

**Q105. What is a short-circuiting stream operation?**
Operations that don't need to process all elements: `findFirst()`, `findAny()`, `anyMatch()`, `allMatch()`, `noneMatch()`, `limit()`.

**Q106. What is `Collectors.toMap()` merge function?**
When duplicate keys are found, the merge function decides which value to keep:
```java
Collectors.toMap(Employee::getDept, Employee::getName, (e1, e2) -> e1 + ", " + e2)
```

**Q107. How does `parallelStream()` work internally?**
Uses the common ForkJoinPool. The Spliterator splits the source into chunks, each processed by a separate thread. Results are combined.

**Q108. What is `Collectors.collectingAndThen()`?**
Applies a finishing transformation after collection:
```java
Collectors.collectingAndThen(Collectors.toList(), Collections::unmodifiableList)
```

**Q109. How does `Map.compute()` differ from `computeIfAbsent()`?**
`compute()`: always applies the remapping function, even if key exists. `computeIfAbsent()`: only computes if key is absent.

**Q110. What is the difference between `Map.replace()` and `Map.put()`?**
`replace()` only replaces if the key already exists (returns null if not). `put()` always inserts/updates.

**Q111. How does `ArrayDeque` implement a circular buffer?**
Uses an array with `head` and `tail` indices. When indices reach the end, they wrap around using bitwise AND: `index & (length - 1)`.

**Q112. Why are null elements not allowed in ArrayDeque?**
Because `null` is used as a sentinel value by `poll()` and `peek()` to indicate an empty deque.

**Q113. What is the `subList()` method and its pitfalls?**
Returns a view of the original list. Modifications to the subList affect the original. Structural changes to the original invalidate the subList (CME risk).

**Q114. What is `Collections.checkedList()`?**
Returns a type-safe view that checks runtime type of every element added. Prevents heap pollution from raw types.

**Q115. How to create a synchronized Set in Java?**
`Collections.synchronizedSet(new HashSet<>())` or `ConcurrentHashMap.newKeySet()` or `CopyOnWriteArraySet`.

**Q116. What is the time complexity of `TreeMap.subMap()`?**
O(log n) to find boundaries, O(k) to iterate where k is the number of entries in range.

**Q117. How does `PriorityQueue.remove(Object)` work?**
Linear search O(n) to find the element, then sift-down O(log n) to restore heap property. Overall O(n).

**Q118. What are the differences between Queue and Deque?**
Queue: insert at tail, remove from head (FIFO). Deque: insert/remove at both ends. Deque can act as both Queue and Stack.

**Q119. How does `Collections.binarySearch()` work?**
Requires a sorted list. Uses binary search (O(log n) for RandomAccess lists, O(n log n) for linked lists due to traversal).

**Q120. What is the difference between `Iterator.remove()` and `Collection.remove()`?**
`Iterator.remove()` removes the current element safely during iteration (updates modCount). `Collection.remove()` during iteration causes CME.

**Q121. What is the `Set.copyOf()` method?**
Java 10+. Returns an unmodifiable Set containing the elements of the given collection. No nulls allowed.

**Q122. How does `HashMap` handle the case when `hashCode()` returns the same value for all keys?**
All entries go to the same bucket. Pre-Java 8: O(n) linked list traversal. Java 8+: converts to Red-Black Tree after 8 entries → O(log n).

**Q123. What is the significance of `initialCapacity` in HashMap constructor?**
Pre-sizing avoids repeated resizing. Best practice: set to `(expectedEntries / loadFactor) + 1`.

**Q124. What is `System.identityHashCode()`?**
Returns the default hashCode (memory-based) even if `hashCode()` is overridden. Used by `IdentityHashMap`.

**Q125. How does `LinkedList` optimize `get(index)`?**
It checks if `index < size/2`. If yes, traverses from `first`; otherwise from `last`. Still O(n) but halves the traversal.

**Q126. What are the NavigableMap methods `floorEntry()`, `ceilingEntry()`, `lowerEntry()`, `higherEntry()`?**
`floor`: greatest key ≤ given. `ceiling`: smallest key ≥ given. `lower`: greatest key < given. `higher`: smallest key > given.

**Q127. What is the `Map.ofEntries()` method?**
Java 9+. Creates an immutable Map from `Map.Entry` objects:
```java
Map.ofEntries(Map.entry("A", 1), Map.entry("B", 2));
```

**Q128. How does `Collections.frequency()` work?**
Iterates through the collection, counting elements equal to the specified object. O(n).

**Q129. What is the `Collections.disjoint()` method?**
Returns `true` if two collections have no elements in common. Optimized for Set intersection.

**Q130. How to create a thread-safe Queue?**
`ArrayBlockingQueue`, `LinkedBlockingQueue`, `ConcurrentLinkedQueue`, `PriorityBlockingQueue`.

---

## ARCHITECT LEVEL (Questions 131–155)

**Q131. How would you design a caching layer using Java Collections?**
Use `ConcurrentHashMap` for thread-safe access, `LinkedHashMap` with access order for LRU eviction, wrap with scheduled cleanup for TTL. Consider two-tier cache (L1: ConcurrentHashMap, L2: LinkedHashMap LRU).

**Q132. When would you choose TreeMap over HashMap in a production system?**
When you need sorted key order, range queries (`subMap`, `headMap`, `tailMap`), or navigation methods (`floorKey`, `ceilingKey`). Example: time-series data, price tiers, scheduling.

**Q133. How would you handle a scenario where millions of objects are stored in a HashSet?**
Pre-size capacity, ensure good hashCode distribution, consider memory (each entry ~32-48 bytes), use off-heap solutions for very large sets, consider Bloom filters for membership testing.

**Q134. How does ConcurrentHashMap handle resize (rehashing)?**
Uses a `ForwardingNode` marker. Multiple threads can help with transfer. Bins are migrated incrementally. Reads remain non-blocking during resize.

**Q135. What is the worst-case scenario for HashMap performance?**
All keys hash to the same bucket. Pre-Java 8: O(n) per operation (linked list). Java 8+: O(log n) (tree). Caused by poor `hashCode()` implementation or hash-flooding attacks.

**Q136. How would you prevent hash-flooding DoS attacks?**
Java 8's treeification mitigates this (O(log n) vs O(n)). Additionally, use `String` keys (Java uses randomized hash seeds since Java 7u6), limit collection sizes, use `ConcurrentHashMap`.

**Q137. Design a rate limiter using Java Collections.**
Use `ConcurrentHashMap<String, Deque<Instant>>` to track request timestamps per client. On each request, remove expired timestamps and check if count exceeds limit.

**Q138. How would you design an event-driven system using collections?**
Use `CopyOnWriteArrayList` for listener registration, `ConcurrentLinkedQueue` for event queue, `ConcurrentHashMap` for topic-subscriber mapping.

**Q139. When would you use WeakHashMap in production?**
ClassLoader-level caches, storing metadata about objects whose lifecycle you don't control, preventing memory leaks in long-lived caches.

**Q140. How to implement a bounded concurrent collection?**
Use `ArrayBlockingQueue` (fixed capacity, blocks on full), or `LinkedBlockingQueue` with capacity, or custom wrapper with `Semaphore`.

**Q141. What are the memory implications of choosing ArrayList vs LinkedList for 1M elements?**
ArrayList: ~4MB (1M × 4 bytes reference + ~8 bytes array overhead). LinkedList: ~40MB (1M × ~40 bytes per Node). ArrayList is ~10x more memory efficient.

**Q142. How does Java's `TimSort` algorithm work?**
Finds natural runs (ascending/descending), merges them using a merge stack. Optimized for partially sorted data. O(n) best, O(n log n) worst. Stable.

**Q143. How would you process 10 million records using collections efficiently?**
Batch processing with pagination, use parallel streams with appropriate chunk sizes, consider memory-mapped files, use primitive-specialized collections to avoid boxing.

**Q144. What is a `NavigableMap` and give an enterprise use case?**
NavigableMap extends SortedMap with floor/ceiling/lower/higher navigation. Use case: pricing tiers – `floorEntry(quantity)` finds the applicable tier.

**Q145. How to design a distributed cache using local Java Collections?**
Local: ConcurrentHashMap with TTL. Sync: Use message broker (Kafka) for invalidation events. Two-tier: L1 local ConcurrentHashMap + L2 Redis. Consistency via cache-aside or write-through.

**Q146. When is `CopyOnWriteArrayList` inappropriate?**
High write frequency (each write copies entire array), large lists (expensive copies), memory-constrained environments.

**Q147. How would you implement a sliding window algorithm?**
Use `ArrayDeque` as a bounded window. Add to tail, remove from head when window exceeds size. For time-based windows, use `TreeMap<Timestamp, Value>` with `subMap()`.

**Q148. What is the `Phaser`, `CountDownLatch`, `CyclicBarrier` relationship with collections?**
Not collections directly, but used in conjunction: BlockingQueues with latches for producer-consumer, CyclicBarrier for phased processing of batched collections.

**Q149. How would you implement a thread-safe LRU cache?**
```java
// Option 1: synchronized LinkedHashMap
Map<K,V> cache = Collections.synchronizedMap(new LinkedHashMap<>(cap, 0.75f, true) {
    protected boolean removeEldestEntry(Map.Entry<K,V> e) { return size() > cap; }
});
// Option 2: ConcurrentHashMap + Manual LRU tracking
// Option 3: Caffeine library (production-grade)
```

**Q150. How does `AbstractList` use the Template Method pattern?**
It provides implementations of `indexOf`, `lastIndexOf`, `contains`, `iterator`, `subList` in terms of abstract method `get(int index)`. Subclasses only implement `get()` for read-only lists.

**Q151. What is the contract for properly implementing `Comparable`?**
Must be consistent with equals: `(x.compareTo(y) == 0) == x.equals(y)`. Must be transitive. Must be symmetric in sign. Must handle null properly.

**Q152. How would you architect collection usage in a high-throughput microservice?**
Read paths: `ConcurrentHashMap` for caches, `ArrayList` for responses. Write paths: `BlockingQueue` for async processing. Minimize contention with `LongAdder` for counters. Pre-size collections. Use immutable collections for shared data.

**Q153. What are the trade-offs between `ConcurrentHashMap` and `Collections.synchronizedMap()`?**
ConcurrentHashMap: higher throughput, weaker consistency (eventual iteration), no null keys/values, atomic compound ops. SynchronizedMap: simple, strong consistency, allows nulls, poor under contention.

**Q154. How to implement a pub-sub system using Java Collections?**
```java
ConcurrentHashMap<String, CopyOnWriteArrayList<Consumer<Event>>> subscribers;
ConcurrentLinkedQueue<Event> eventQueue;
// Publisher: eventQueue.offer(event)
// Dispatcher: poll from queue, lookup subscribers, call each
```

**Q155. How would you migrate from Hashtable to ConcurrentHashMap in a legacy system?**
1) Replace `new Hashtable<>()` with `new ConcurrentHashMap<>()`. 2) Remove external `synchronized` blocks. 3) Replace compound operations with `computeIfAbsent()`, `merge()`, etc. 4) Handle null key/value differences. 5) Test under concurrent load.

---

# Chapter 15: Coding Exercises and Problems

## Exercise 1: Find Duplicates in a List

```java
public static <T> Set<T> findDuplicates(List<T> list) {
    Set<T> seen = new HashSet<>();
    Set<T> duplicates = new LinkedHashSet<>(); // Preserve order of first duplicate
    
    for (T item : list) {
        if (!seen.add(item)) {
            duplicates.add(item);
        }
    }
    return duplicates;
}

// Java 8 alternative
public static <T> Set<T> findDuplicatesStream(List<T> list) {
    return list.stream()
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
        .entrySet().stream()
        .filter(e -> e.getValue() > 1)
        .map(Map.Entry::getKey)
        .collect(Collectors.toSet());
}

// Usage
List<String> items = Arrays.asList("apple", "banana", "apple", "cherry", "banana", "date");
Set<String> dups = findDuplicates(items); // [apple, banana]
```

## Exercise 2: Frequency Count Using Map

```java
public static <T> Map<T, Long> frequencyCount(List<T> list) {
    return list.stream()
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
}

// Without streams
public static <T> Map<T, Integer> frequencyCountClassic(List<T> list) {
    Map<T, Integer> freq = new LinkedHashMap<>();
    for (T item : list) {
        freq.merge(item, 1, Integer::sum);
    }
    return freq;
}

// Usage
List<String> words = Arrays.asList("java", "spring", "java", "docker", "spring", "java");
Map<String, Long> freq = frequencyCount(words);
// {java=3, spring=2, docker=1}
```

## Exercise 3: Sort Custom Objects

```java
public class Employee implements Comparable<Employee> {
    private String name;
    private String department;
    private double salary;
    
    // Constructor, getters, setters...
    
    @Override
    public int compareTo(Employee o) {
        return this.name.compareTo(o.name);
    }
}

// Multiple sorting strategies
List<Employee> employees = getEmployees();

// Sort by name (natural order)
Collections.sort(employees);

// Sort by salary descending
employees.sort(Comparator.comparing(Employee::getSalary).reversed());

// Sort by department, then salary descending, then name
employees.sort(
    Comparator.comparing(Employee::getDepartment)
              .thenComparing(Employee::getSalary, Comparator.reverseOrder())
              .thenComparing(Employee::getName)
);

// Sort with null handling
employees.sort(
    Comparator.comparing(Employee::getDepartment, 
                         Comparator.nullsLast(Comparator.naturalOrder()))
);
```

## Exercise 4: Convert List to Map

```java
// List of employees to Map<id, Employee>
Map<Long, Employee> empMap = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Function.identity()));

// Handle duplicate keys
Map<String, Employee> byName = employees.stream()
    .collect(Collectors.toMap(
        Employee::getName,
        Function.identity(),
        (existing, replacement) -> existing // Keep first occurrence
    ));

// Collect into specific Map type (TreeMap for sorted keys)
TreeMap<Long, Employee> sorted = employees.stream()
    .collect(Collectors.toMap(
        Employee::getId,
        Function.identity(),
        (e1, e2) -> e1,
        TreeMap::new
    ));
```

## Exercise 5: Group Elements

```java
// Group employees by department
Map<String, List<Employee>> byDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment));

// Group and count
Map<String, Long> countByDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment, Collectors.counting()));

// Group and find max salary per department
Map<String, Optional<Employee>> highestPaid = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.maxBy(Comparator.comparing(Employee::getSalary))
    ));

// Group and sum salaries
Map<String, Double> totalSalary = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.summingDouble(Employee::getSalary)
    ));

// Group by salary range
Map<String, List<Employee>> bySalaryRange = employees.stream()
    .collect(Collectors.groupingBy(emp -> {
        if (emp.getSalary() > 100000) return "HIGH";
        else if (emp.getSalary() > 50000) return "MEDIUM";
        else return "LOW";
    }));
```

## Exercise 6: Find Top N Elements

```java
// Using PriorityQueue (most efficient for large datasets)
public static <T> List<T> topN(List<T> list, int n, Comparator<T> comp) {
    PriorityQueue<T> minHeap = new PriorityQueue<>(n, comp);
    for (T item : list) {
        minHeap.offer(item);
        if (minHeap.size() > n) {
            minHeap.poll();
        }
    }
    List<T> result = new ArrayList<>(minHeap);
    result.sort(comp.reversed());
    return result;
}

// Using streams
List<Employee> top5Paid = employees.stream()
    .sorted(Comparator.comparing(Employee::getSalary).reversed())
    .limit(5)
    .collect(Collectors.toList());
```

## Exercise 7: Implement a Simple Cache

```java
public class SimpleCache<K, V> {
    private final Map<K, CacheEntry<V>> cache;
    private final int maxSize;
    private final Duration defaultTTL;
    
    public SimpleCache(int maxSize, Duration defaultTTL) {
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
        this.cache = Collections.synchronizedMap(
            new LinkedHashMap<>(maxSize, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<K, CacheEntry<V>> eldest) {
                    return size() > SimpleCache.this.maxSize;
                }
            }
        );
    }
    
    public void put(K key, V value) {
        cache.put(key, new CacheEntry<>(value, Instant.now().plus(defaultTTL)));
    }
    
    public Optional<V> get(K key) {
        CacheEntry<V> entry = cache.get(key);
        if (entry == null || entry.isExpired()) {
            cache.remove(key);
            return Optional.empty();
        }
        return Optional.of(entry.getValue());
    }
    
    private static class CacheEntry<V> {
        private final V value;
        private final Instant expiresAt;
        
        CacheEntry(V value, Instant expiresAt) {
            this.value = value;
            this.expiresAt = expiresAt;
        }
        
        boolean isExpired() { return Instant.now().isAfter(expiresAt); }
        V getValue() { return value; }
    }
}
```

## Exercise 8: Word Frequency Counter from Text

```java
public static Map<String, Long> wordFrequency(String text) {
    return Arrays.stream(text.toLowerCase().split("\\W+"))
        .filter(w -> !w.isEmpty())
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
}

// Sorted by frequency (descending)
public static LinkedHashMap<String, Long> topWords(String text, int n) {
    return wordFrequency(text).entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .limit(n)
        .collect(Collectors.toMap(
            Map.Entry::getKey, Map.Entry::getValue,
            (e1, e2) -> e1, LinkedHashMap::new
        ));
}
```

## Exercise 9: Set Operations

```java
public static <T> Set<T> union(Set<T> a, Set<T> b) {
    Set<T> result = new HashSet<>(a);
    result.addAll(b);
    return result;
}

public static <T> Set<T> intersection(Set<T> a, Set<T> b) {
    Set<T> result = new HashSet<>(a);
    result.retainAll(b);
    return result;
}

public static <T> Set<T> difference(Set<T> a, Set<T> b) {
    Set<T> result = new HashSet<>(a);
    result.removeAll(b);
    return result;
}

public static <T> Set<T> symmetricDifference(Set<T> a, Set<T> b) {
    Set<T> result = union(a, b);
    result.removeAll(intersection(a, b));
    return result;
}
```

## Exercise 10: Flatten Nested List and Remove Duplicates

```java
public static <T> List<T> flattenAndDeduplicate(List<List<T>> nested) {
    return nested.stream()
        .flatMap(Collection::stream)
        .distinct()
        .collect(Collectors.toList());
}

// With sorting
public static <T extends Comparable<T>> List<T> flattenDedupSort(List<List<T>> nested) {
    return nested.stream()
        .flatMap(Collection::stream)
        .collect(Collectors.toCollection(TreeSet::new))
        .stream()
        .collect(Collectors.toList());
}
```

---

# Appendix: Quick Reference Cheat Sheet

## Choosing the Right Collection

```
Need a List?
├── Need thread safety?
│   ├── Read-heavy → CopyOnWriteArrayList
│   └── Write-heavy → Collections.synchronizedList(new ArrayList<>())
├── Need random access? → ArrayList (90% of cases)
├── Need frequent insert/remove at both ends? → ArrayDeque
└── Need to act as Queue too? → LinkedList

Need a Set?
├── Need thread safety? → ConcurrentHashMap.newKeySet()
├── Need sorted order? → TreeSet
├── Need insertion order? → LinkedHashSet
├── Enum values? → EnumSet
└── Default → HashSet

Need a Map?
├── Need thread safety?
│   ├── High concurrency → ConcurrentHashMap
│   └── Sorted + concurrent → ConcurrentSkipListMap
├── Need sorted keys? → TreeMap
├── Need insertion order? → LinkedHashMap
├── Need LRU eviction? → LinkedHashMap (access-order)
├── Enum keys? → EnumMap
├── Auto-cleanup? → WeakHashMap
└── Default → HashMap

Need a Queue?
├── Need thread safety?
│   ├── Bounded → ArrayBlockingQueue
│   └── Unbounded → ConcurrentLinkedQueue
├── Need priority ordering? → PriorityQueue
├── Need LIFO (Stack)? → ArrayDeque
└── Default FIFO → ArrayDeque
```

---

*End of Guide*

**Document Version:** 1.0  
**Last Updated:** March 2026  
**Topics Covered:** 15 Chapters, 155+ Interview Questions, 10 Coding Exercises  
