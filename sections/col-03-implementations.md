
# Chapter 3: List Implementations Deep Dive

## 3.1 ArrayList

### What
`ArrayList` is a **resizable-array** implementation of the `List` interface. It is the **most commonly used** collection in Java applications.

### Internal Data Structure
```java
// Simplified internal structure
public class ArrayList<E> extends AbstractList<E> implements List<E>, 
        RandomAccess, Cloneable, Serializable {
    
    transient Object[] elementData;  // The array buffer
    private int size;                // Actual number of elements
    
    private static final int DEFAULT_CAPACITY = 10;
    private static final Object[] EMPTY_ELEMENTDATA = {};
    private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};
}
```

### How It Works

**Initialization:**
```java
// Default constructor - lazy initialization (empty array until first add)
List<String> list = new ArrayList<>();         // elementData = {} (size 0)

// First add triggers growth to DEFAULT_CAPACITY (10)
list.add("A"); // elementData = new Object[10], elementData[0] = "A", size = 1

// With initial capacity
List<String> list2 = new ArrayList<>(100);     // elementData = new Object[100]

// From another collection
List<String> list3 = new ArrayList<>(existingList);
```

**Growth Mechanism (Resizing):**
When the internal array is full, ArrayList grows by **50%** (newCapacity = oldCapacity + oldCapacity >> 1):

```
Initial:   [A][B][C][D][E][F][G][H][I][J]  capacity=10, size=10
Add "K":   Needs growth → new capacity = 10 + 5 = 15
           [A][B][C][D][E][F][G][H][I][J][K][ ][ ][ ][ ]  capacity=15, size=11
```

Internally, `Arrays.copyOf()` is called which uses `System.arraycopy()` (native method) for efficient memory copying.

**Insertion Process:**
```java
// add(E e) - Appends to end - O(1) amortized
list.add("X");
// 1. ensureCapacityInternal(size + 1) - checks if resize needed
// 2. elementData[size++] = "X"

// add(int index, E e) - Inserts at position - O(n)
list.add(2, "X");
// 1. rangeCheckForAdd(index)
// 2. ensureCapacityInternal(size + 1)
// 3. System.arraycopy(elementData, 2, elementData, 3, size - 2) // shift right
// 4. elementData[2] = "X"
// 5. size++
```

**Removal Process:**
```java
// remove(int index) - O(n) due to shifting
list.remove(2);
// 1. rangeCheck(index)
// 2. E oldValue = elementData[index]
// 3. int numMoved = size - index - 1
// 4. System.arraycopy(elementData, 3, elementData, 2, numMoved) // shift left
// 5. elementData[--size] = null // clear for GC
// 6. return oldValue
```

### Time Complexity

| Operation | Time Complexity | Notes |
|---|---|---|
| `get(index)` | O(1) | Direct array access |
| `set(index, e)` | O(1) | Direct array assignment |
| `add(e)` (end) | O(1) amortized | O(n) when resize needed |
| `add(index, e)` | O(n) | Element shifting required |
| `remove(index)` | O(n) | Element shifting required |
| `remove(Object)` | O(n) | Linear search + shift |
| `contains(o)` | O(n) | Linear search |
| `indexOf(o)` | O(n) | Linear search |
| `size()` | O(1) | Returns field value |
| `isEmpty()` | O(1) | Checks size == 0 |

### Deep Theory: ArrayList Resize Cost Analysis

```
Growth Pattern (starting from default capacity 10):
Capacity:  10 -> 15 -> 22 -> 33 -> 49 -> 73 -> 109 -> 163 -> 244 -> ...

To store 1,000,000 elements:
- Number of resizes: ~44 times
- Total elements copied across all resizes: ~2,000,000 (2x total elements)
- Amortized cost per add(): O(1) -- despite O(n) individual resizes

Pre-sizing avoidance:
new ArrayList<>(1_000_000)  -- ZERO resizes, ZERO copies
new ArrayList<>()          -- 44 resizes, 2M copies
```

**Production Rule:** Always pre-size ArrayList when you know or can estimate the size:
```java
// Converting database results -- you know the size!
List<DTO> dtos = new ArrayList<>(entities.size()); // Pre-sized
for (Entity e : entities) { dtos.add(toDTO(e)); }
```

### Thread Safety
**ArrayList is NOT thread-safe.** For concurrent access:
```java
// Option 1: Synchronized wrapper
List<String> syncList = Collections.synchronizedList(new ArrayList<>());

// Option 2: CopyOnWriteArrayList (for read-heavy scenarios)
List<String> cowList = new CopyOnWriteArrayList<>();

// Option 3: External synchronization
synchronized (list) {
    list.add("item");
}
```

### Enterprise Best Practices
```java
@Service
public class ProductService {
    
    // GOOD: Specify initial capacity when size is known/estimated
    public List<ProductDTO> convertToDTO(List<Product> products) {
        List<ProductDTO> dtos = new ArrayList<>(products.size()); // Pre-sized
        for (Product p : products) {
            dtos.add(mapper.toDTO(p));
        }
        return dtos;
    }
    
    // GOOD: Return unmodifiable list from service
    public List<ProductDTO> getActiveProducts() {
        return Collections.unmodifiableList(
            productRepository.findByActive(true)
                .stream()
                .map(mapper::toDTO)
                .collect(Collectors.toList())
        );
    }
}
```

---

## 3.2 LinkedList

### What
`LinkedList` is a **doubly-linked list** implementation of both `List` and `Deque` interfaces. Each element is stored in a **Node** object with references to previous and next nodes.

### Internal Data Structure
```java
public class LinkedList<E> extends AbstractSequentialList<E>
        implements List<E>, Deque<E>, Cloneable, Serializable {
    
    transient int size = 0;
    transient Node<E> first;  // Pointer to first node
    transient Node<E> last;   // Pointer to last node
    
    private static class Node<E> {
        E item;
        Node<E> next;
        Node<E> prev;
        
        Node(Node<E> prev, E element, Node<E> next) {
            this.item = element;
            this.next = next;
            this.prev = prev;
        }
    }
}
```

### How It Works

**Insertion at End:**
```java
list.add("X");
// void linkLast(E e) {
//     Node<E> l = last;
//     Node<E> newNode = new Node<>(l, e, null);
//     last = newNode;
//     if (l == null) first = newNode;
//     else l.next = newNode;
//     size++;
// }
```

**Insertion at Index:**
```java
list.add(2, "X");
// 1. Check index bounds
// 2. If index == size, linkLast(element)
// 3. Else, traverse to node at index (from closest end)
//    - if index < size/2: traverse from first
//    - if index >= size/2: traverse from last
// 4. Link new node before the found node
```

**Lookup (get):**
```java
list.get(5);
// Node<E> node(int index) {
//     if (index < (size >> 1)) {
//         Node<E> x = first;
//         for (int i = 0; i < index; i++) x = x.next;
//         return x;
//     } else {
//         Node<E> x = last;
//         for (int i = size - 1; i > index; i--) x = x.prev;
//         return x;
//     }
// }
```

### Time Complexity

| Operation | Time Complexity | Notes |
|---|---|---|
| `get(index)` | O(n) | Must traverse from nearest end |
| `set(index, e)` | O(n) | Must traverse to find node |
| `add(e)` (end) | O(1) | Direct link to last |
| `addFirst(e)` | O(1) | Direct link to first |
| `add(index, e)` | O(n) | Traverse + O(1) link |
| `remove(index)` | O(n) | Traverse + O(1) unlink |
| `removeFirst()` | O(1) | Direct unlink |
| `removeLast()` | O(1) | Direct unlink |
| `contains(o)` | O(n) | Linear traversal |

### When to Use LinkedList
- Frequent insertions/deletions at **both ends** (use as Deque)
- Implementing a **queue or stack**
- When you **never need random access** by index

### When NOT to Use LinkedList
- Random access patterns (use ArrayList instead)
- Memory-constrained environments (each element has ~40 bytes overhead for Node object)
- Cache performance matters (non-contiguous memory layout -- poor CPU cache utilization)

### Deep Theory: The CPU Cache Problem with LinkedList

```
ArrayList in Memory:    [A][B][C][D][E][F][G][H]  -- contiguous
  CPU cache line (64 bytes) loads multiple elements at once
  Access pattern: predictable, sequential -- CPU prefetcher loves this

LinkedList in Memory:   [A]-->[somewhere in heap][B]-->[elsewhere][C]...
  Each Node is a separate heap allocation
  Access pattern: random jumps -- CPU prefetcher cannot predict
  Result: cache miss on almost every node access
```

**Benchmark Reality:** Even for operations where LinkedList has O(1) complexity (like insertion at a known iterator position), ArrayList is often faster in practice due to CPU cache effects -- up to 10x faster for sequential access patterns.

### Interview Questions for List Implementations

**Q: A developer says "I use LinkedList because insertion is O(1)". Is that correct?**
A: Partially. Insertion at a KNOWN position (via iterator) is O(1). But finding that position is O(n). In practice, most insertions require finding the position first, making it O(n). ArrayList's O(n) shift operation uses `System.arraycopy()` (native memcpy), which is extremely fast due to cache locality.

**Q: When would you actually use LinkedList in production?**
A: Almost never as a List. The only valid use is as a `Deque` (double-ended queue) when you need both `addFirst()` and `addLast()` O(1). But even then, `ArrayDeque` is faster. LinkedList's real niche: when you need to remove elements during iteration using `Iterator.remove()` without shifting.

---

## 3.3 Vector (Legacy)

### What
`Vector` is a **synchronized**, resizable-array implementation of `List`. It was part of Java 1.0 and is now considered **legacy**.

### Key Differences from ArrayList

| Feature | ArrayList | Vector |
|---|---|---|
| Synchronization | Not synchronized | All methods synchronized |
| Growth | Grows by 50% | Grows by 100% (doubles) |
| Performance | Faster (no sync overhead) | Slower (sync overhead) |
| Iterator | Fail-fast | Fail-fast |
| Legacy | Java 1.2 (recommended) | Java 1.0 (legacy) |

### Why to Avoid
```java
// DON'T use Vector in modern code
Vector<String> v = new Vector<>(); // Synchronizes every method unnecessarily

// DO use ArrayList + external synchronization if needed
List<String> list = Collections.synchronizedList(new ArrayList<>());

// OR use CopyOnWriteArrayList for concurrent read-heavy scenarios
List<String> list = new CopyOnWriteArrayList<>();
```

---

## 3.4 Stack (Legacy)

### What
`Stack` extends `Vector` and provides **LIFO (Last-In, First-Out)** operations: `push()`, `pop()`, `peek()`.

### Why to Avoid
```java
// DON'T use Stack - it extends Vector (poor design decision)
Stack<String> stack = new Stack<>();
stack.push("A");
// Problem: Stack inherits Vector methods like add(index, e) 
// which breaks LIFO semantics
stack.add(0, "B"); // This bypasses LIFO!

// DO use Deque instead (Java recommends this)
Deque<String> stack = new ArrayDeque<>();
stack.push("A");
stack.push("B");
String top = stack.pop(); // "B" - proper LIFO
```

---

## 3.5 CopyOnWriteArrayList

### What
`CopyOnWriteArrayList` is a **thread-safe** variant of ArrayList where all mutative operations (add, set, remove) create a **new copy** of the underlying array.

### Internal Mechanism
```java
// Simplified internal working
public class CopyOnWriteArrayList<E> {
    private transient volatile Object[] array; // volatile for visibility
    final transient Object lock = new Object();
    
    public boolean add(E e) {
        synchronized (lock) {
            Object[] elements = getArray();
            int len = elements.length;
            Object[] newElements = Arrays.copyOf(elements, len + 1); // COPY!
            newElements[len] = e;
            setArray(newElements); // Atomic swap
            return true;
        }
    }
    
    public E get(int index) {
        // NO synchronization needed - reads see a consistent snapshot
        return elementAt(getArray(), index);
    }
}
```

### When to Use
- **Read-heavy, write-rare** scenarios
- Event listener lists
- Configuration lists that rarely change
- Observer pattern implementations

### Enterprise Usage
```java
@Component
public class EventPublisher {
    // Listeners rarely change, but are iterated frequently
    private final List<EventListener> listeners = new CopyOnWriteArrayList<>();
    
    public void addListener(EventListener listener) {
        listeners.add(listener); // Creates new array copy
    }
    
    public void publishEvent(Event event) {
        // Safe iteration without synchronization
        for (EventListener listener : listeners) {
            listener.onEvent(event);
        }
    }
}
```

### Time Complexity

| Operation | Time Complexity |
|---|---|
| `get(index)` | O(1) - No lock needed |
| `add(e)` | O(n) - Full array copy |
| `set(index, e)` | O(n) - Full array copy |
| `remove(index)` | O(n) - Full array copy |
| `contains(o)` | O(n) - Linear scan |
| Iteration | O(n) - Snapshot, no ConcurrentModificationException |

### Deep Theory: Why CopyOnWriteArrayList Iterators Never Throw CME

```
Thread A (reading):              Thread B (writing):
iterator = list.iterator()       list.add("X")
  |-- snapshot = array@v1          |-- creates new array@v2
  |-- iterating over array@v1      |-- array@v2 = copy + "X"
  |-- sees: [A, B, C]             |-- list.array = array@v2
  |-- NEVER sees "X"              
  |-- NO CME thrown               

Key: iterator holds reference to OLD array snapshot
New writes create entirely new arrays
Old array is eventually GC'd when iterator finishes
```

**Warning:** CopyOnWriteArrayList is TERRIBLE for write-heavy workloads. Adding 1000 elements to a list of 10,000 creates 1000 array copies of ~10,000 elements each = 10 million element copies!

---

# Chapter 4: Set Implementations Deep Dive

## 4.1 HashSet

### What
`HashSet` is the most commonly used Set implementation. It is backed by a **HashMap** internally.

### Internal Data Structure
```java
public class HashSet<E> extends AbstractSet<E> 
        implements Set<E>, Cloneable, Serializable {
    
    private transient HashMap<E, Object> map;
    private static final Object PRESENT = new Object(); // Dummy value
    
    public HashSet() {
        map = new HashMap<>();
    }
    
    public boolean add(E e) {
        return map.put(e, PRESENT) == null;
    }
    
    public boolean contains(Object o) {
        return map.containsKey(o);
    }
    
    public boolean remove(Object o) {
        return map.remove(o) == PRESENT;
    }
    
    public int size() {
        return map.size();
    }
}
```

**Key Insight:** HashSet is literally a HashMap where elements are stored as **keys** and a dummy `PRESENT` object is used as the value for every entry.

### How Uniqueness is Enforced
1. When `add(e)` is called, it calls `map.put(e, PRESENT)`
2. HashMap computes `hashCode()` of the element
3. If a key with the same hash AND `equals()` already exists, `put()` returns the old value (not null)
4. `add()` returns `true` only if `put()` returned `null` (meaning no duplicate existed)

### Critical: equals() and hashCode() Contract
```java
// MUST override both equals() and hashCode() for custom objects in HashSet
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

### Time Complexity

| Operation | Average | Worst Case |
|---|---|---|
| `add(e)` | O(1) | O(n) |
| `remove(o)` | O(1) | O(n) |
| `contains(o)` | O(1) | O(n) |
| Iteration | O(n + capacity) | O(n + capacity) |

### Deep Theory: Why HashSet Uniqueness Can Silently Break

```java
// DANGEROUS: Mutable object in HashSet
List<String> list1 = new ArrayList<>(Arrays.asList("A"));
Set<List<String>> set = new HashSet<>();
set.add(list1);

System.out.println(set.contains(list1)); // true

list1.add("B"); // Mutating the element AFTER adding to set!

System.out.println(set.contains(list1)); // FALSE! hashCode changed!
// The element is STILL in the set, but in the wrong bucket
// It's a phantom entry -- you can't find it, can't remove it
// It stays in memory until the set is garbage collected
```

**Production Rule:** Objects stored in HashSet (or used as HashMap keys) must be effectively immutable. Use `String`, `Integer`, `Long`, `enum`, or immutable records.

---

## 4.2 LinkedHashSet

### What
`LinkedHashSet` extends `HashSet` and maintains a **doubly-linked list** across all entries, preserving **insertion order**.

### Internal Data Structure
It uses `LinkedHashMap` internally instead of `HashMap`:
```java
public class LinkedHashSet<E> extends HashSet<E> {
    public LinkedHashSet() {
        super(16, .75f, true); // Calls HashSet constructor that creates LinkedHashMap
    }
}

// In HashSet:
HashSet(int initialCapacity, float loadFactor, boolean dummy) {
    map = new LinkedHashMap<>(initialCapacity, loadFactor);
}
```

### When to Use
- When you need **Set uniqueness** + **insertion order**
- Building ordered caches (e.g., LRU cache foundation)
- When iteration order matters

### Enterprise Example
```java
@Service
public class NavigationService {
    
    // Maintain unique breadcrumb trail in order
    public LinkedHashSet<String> buildBreadcrumbs(String path) {
        LinkedHashSet<String> breadcrumbs = new LinkedHashSet<>();
        breadcrumbs.add("Home");
        
        String[] parts = path.split("/");
        for (String part : parts) {
            if (!part.isEmpty()) {
                breadcrumbs.add(formatBreadcrumb(part));
            }
        }
        return breadcrumbs; // Ordered and unique
    }
}
```

---

## 4.3 TreeSet

### What
`TreeSet` is a Set implementation based on a **Red-Black Tree** (self-balancing BST). Elements are stored in **sorted order** (natural ordering or custom Comparator).

### Internal Data Structure
```java
public class TreeSet<E> extends AbstractSet<E>
        implements NavigableSet<E>, Cloneable, Serializable {
    
    private transient NavigableMap<E, Object> m; // Backed by TreeMap
    private static final Object PRESENT = new Object();
    
    public TreeSet() {
        this(new TreeMap<>());
    }
    
    public TreeSet(Comparator<? super E> comparator) {
        this(new TreeMap<>(comparator));
    }
}
```

### Time Complexity

| Operation | Time Complexity |
|---|---|
| `add(e)` | O(log n) |
| `remove(o)` | O(log n) |
| `contains(o)` | O(log n) |
| `first()` / `last()` | O(log n) |
| `lower()` / `higher()` | O(log n) |
| `floor()` / `ceiling()` | O(log n) |

### Deep Theory: Comparable vs Comparator Trap in TreeSet

```java
// TRAP: TreeSet uses compareTo() for EQUALITY, not equals()
TreeSet<String> set = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
set.add("Hello");
set.add("hello"); // NOT added! compareTo returns 0 ("equal" by comparator)
System.out.println(set.size()); // 1!

// This means TreeSet's behavior depends on the Comparator
// Two objects are "equal" in TreeSet if compare() returns 0
// Even if equals() returns false

// Production impact: sorting by just one field can silently drop duplicates
TreeSet<Employee> byName = new TreeSet<>(Comparator.comparing(Employee::getName));
// If two employees have same name, only ONE is kept!
```

**Fix:** Use a tiebreaker in the comparator:
```java
TreeSet<Employee> safe = new TreeSet<>(
    Comparator.comparing(Employee::getName)
              .thenComparing(Employee::getId) // Ensures uniqueness
);
```

### Enterprise Usage
```java
@Service
public class PricingService {
    
    // TreeSet for sorted price tiers
    public NavigableSet<PriceTier> getPriceTiers() {
        TreeSet<PriceTier> tiers = new TreeSet<>(
            Comparator.comparing(PriceTier::getMinQuantity)
        );
        tiers.addAll(priceTierRepository.findAll());
        return Collections.unmodifiableNavigableSet(tiers);
    }
    
    // Find applicable price tier for a quantity
    public PriceTier findTier(int quantity) {
        NavigableSet<PriceTier> tiers = getPriceTiers();
        PriceTier searchTier = new PriceTier(quantity);
        PriceTier floor = tiers.floor(searchTier); // Largest tier <= quantity
        return floor != null ? floor : tiers.first();
    }
}
```

---

## 4.4 EnumSet

### What
`EnumSet` is a specialized Set implementation for use with **enum types**. It is extremely efficient, using a **bit vector** internally.

### Internal Implementation
```java
// For enums with <= 64 constants: uses a single long (RegularEnumSet)
// For enums with > 64 constants: uses long[] array (JumboEnumSet)

// RegularEnumSet (simplified)
class RegularEnumSet<E extends Enum<E>> extends EnumSet<E> {
    private long elements = 0L; // Each bit represents an enum constant
    
    void add(E e) {
        elements |= (1L << e.ordinal()); // Set the bit
    }
    
    boolean contains(Object e) {
        return (elements & (1L << ((Enum<?>)e).ordinal())) != 0;
    }
}
```

### Enterprise Usage
```java
public enum Permission {
    READ, WRITE, DELETE, ADMIN, EXPORT, IMPORT, AUDIT
}

@Service
public class SecurityService {
    
    public EnumSet<Permission> getPermissions(Role role) {
        switch (role) {
            case ADMIN:   return EnumSet.allOf(Permission.class);
            case EDITOR:  return EnumSet.of(Permission.READ, Permission.WRITE);
            case VIEWER:  return EnumSet.of(Permission.READ);
            default:      return EnumSet.noneOf(Permission.class);
        }
    }
    
    public boolean hasPermission(User user, Permission required) {
        EnumSet<Permission> userPerms = getPermissions(user.getRole());
        return userPerms.contains(required);
    }
}
```

### Performance
All operations are **O(1)** using bitwise operations. EnumSet is the **fastest Set implementation** in Java.

---

## 4.5 CopyOnWriteArraySet

### What
A thread-safe Set backed by `CopyOnWriteArrayList`. All mutative operations create a new copy of the underlying array. Best for **small sets** that are read frequently and modified rarely.

```java
// Internally
public class CopyOnWriteArraySet<E> extends AbstractSet<E> {
    private final CopyOnWriteArrayList<E> al;
    
    public boolean add(E e) {
        return al.addIfAbsent(e); // O(n) - checks for duplicates
    }
}
```

---

# Chapter 5: Queue and Deque Implementations Deep Dive

## 5.1 PriorityQueue

### What
`PriorityQueue` is an unbounded queue based on a **binary min-heap**. Elements are ordered by their natural ordering or by a custom `Comparator`. The head of the queue is always the **smallest** element.

### Internal Data Structure
```java
public class PriorityQueue<E> extends AbstractQueue<E> {
    transient Object[] queue; // Binary heap stored as array
    int size;
    private final Comparator<? super E> comparator;
    private static final int DEFAULT_INITIAL_CAPACITY = 11;
}
```

### Binary Heap Properties
```
// Array representation of binary heap:
// Parent of index i: (i - 1) / 2
// Left child of i:  2 * i + 1
// Right child of i: 2 * i + 2

// Example: [1, 3, 2, 7, 5, 4, 8]
//           1
//         /   \
//        3     2
//       / \   / \
//      7   5 4   8
```

### How Operations Work

**offer(e) - Insert:**
1. Add element at the end of array (last position)
2. "Sift up" (bubble up) - compare with parent, swap if smaller
3. Repeat until heap property is restored

**poll() - Remove head:**
1. Save root element (index 0)
2. Move last element to root
3. "Sift down" (bubble down) - compare with smaller child, swap
4. Repeat until heap property is restored

### Time Complexity

| Operation | Time Complexity |
|---|---|
| `offer(e)` / `add(e)` | O(log n) |
| `poll()` / `remove()` | O(log n) |
| `peek()` / `element()` | O(1) |
| `remove(Object)` | O(n) |
| `contains(Object)` | O(n) |

### Enterprise Usage
```java
@Service
public class TaskSchedulerService {
    
    // Priority-based task execution
    private final PriorityQueue<ScheduledTask> taskQueue = new PriorityQueue<>(
        Comparator.comparing(ScheduledTask::getPriority)
                  .thenComparing(ScheduledTask::getScheduledTime)
    );
    
    public void scheduleTask(ScheduledTask task) {
        taskQueue.offer(task);
    }
    
    @Scheduled(fixedRate = 1000)
    public void executeNextTask() {
        ScheduledTask task = taskQueue.poll();
        if (task != null && task.getScheduledTime().isBefore(Instant.now())) {
            taskExecutor.execute(task);
        } else if (task != null) {
            taskQueue.offer(task); // Not ready yet, put back
        }
    }
}

// Top-N elements pattern
public List<Product> getTopNExpensiveProducts(List<Product> products, int n) {
    // Min-heap of size N
    PriorityQueue<Product> minHeap = new PriorityQueue<>(
        Comparator.comparing(Product::getPrice)
    );
    
    for (Product p : products) {
        minHeap.offer(p);
        if (minHeap.size() > n) {
            minHeap.poll(); // Remove smallest
        }
    }
    
    return new ArrayList<>(minHeap);
}
```

### Deep Theory: PriorityQueue is NOT Sorted

A common misconception: PriorityQueue does NOT maintain elements in sorted order. Only the HEAD is guaranteed to be the minimum:

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.addAll(List.of(5, 1, 3, 4, 2));

// Internal array might be: [1, 2, 3, 5, 4] -- NOT sorted!
// Only pq.peek() = 1 is guaranteed to be minimum

// To get sorted output, you MUST drain the queue:
while (!pq.isEmpty()) {
    System.out.print(pq.poll() + " "); // 1 2 3 4 5 (sorted!)
}

// Common mistake: iterating PriorityQueue directly
for (int x : pq) { ... } // NOT in sorted order!
```

**Production Tip:** Use PriorityQueue when you only need the min/max element repeatedly (scheduling, top-N). If you need all elements sorted, use `TreeSet` or sort a `List`.

### Interview Questions for Queue/Deque Implementations

**Q: What is the time complexity of PriorityQueue.remove(Object)?**
A: O(n). It performs a linear search to find the element, then O(log n) sift operation. Unlike `poll()` which is O(log n) because it always removes the head.

**Q: Why does ArrayDeque use a power-of-2 array size?**
A: To enable bitwise AND for index wrapping: `index & (length - 1)` instead of `index % length`. Bitwise AND is ~10x faster than modulo on most CPUs.

---

## 5.2 ArrayDeque

### What
`ArrayDeque` is a **resizable-array** implementation of the `Deque` interface. It is **faster than Stack** (when used as stack) and **faster than LinkedList** (when used as queue).

### Internal Data Structure
```java
public class ArrayDeque<E> extends AbstractCollection<E>
        implements Deque<E>, Cloneable, Serializable {
    
    transient Object[] elements;  // Circular array
    transient int head;           // Index of the head element
    transient int tail;           // Index where next element will be added
}
```

### Circular Buffer Mechanism
```
// ArrayDeque uses a circular buffer
// Example: elements = [D, E, _, _, _, A, B, C]
//                       ↑tail          ↑head
// Logical order: A, B, C, D, E

// addLast: elements[tail] = e; tail = (tail + 1) & (length - 1)
// addFirst: head = (head - 1) & (length - 1); elements[head] = e
// When head == tail: array is full → double the capacity
```

### Time Complexity

| Operation | Time Complexity |
|---|---|
| `addFirst(e)` / `offerFirst(e)` | O(1) amortized |
| `addLast(e)` / `offerLast(e)` | O(1) amortized |
| `removeFirst()` / `pollFirst()` | O(1) |
| `removeLast()` / `pollLast()` | O(1) |
| `getFirst()` / `peekFirst()` | O(1) |
| `getLast()` / `peekLast()` | O(1) |
| `size()` | O(1) |

### Best Practice: Use ArrayDeque over Stack and LinkedList
```java
// As Stack (LIFO)
Deque<String> stack = new ArrayDeque<>();
stack.push("A"); stack.push("B"); stack.push("C");
String top = stack.pop(); // "C"

// As Queue (FIFO)
Deque<String> queue = new ArrayDeque<>();
queue.offer("A"); queue.offer("B"); queue.offer("C");
String first = queue.poll(); // "A"
```

---

## 5.3 LinkedList as Queue

`LinkedList` implements both `List` and `Deque`, so it can be used as a queue:

```java
Queue<String> queue = new LinkedList<>();
queue.offer("A");
queue.offer("B");
String head = queue.poll(); // "A"
```

**However, `ArrayDeque` is generally preferred** over `LinkedList` as a Queue/Deque because:
- Better cache locality (contiguous memory)
- Less memory overhead (no Node objects)
- Faster in practice for most use cases

**Use LinkedList only when you need:**
- A list that also acts as a queue
- Frequent insertion/removal at arbitrary positions during concurrent iteration

---
