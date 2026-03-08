
# Chapter 5: Synchronization

## 5.1 Race Conditions

### What is a Race Condition?
A **race condition** occurs when two or more threads access shared data concurrently, and the outcome depends on the unpredictable order of thread execution. The program produces different results on different runs because thread scheduling is non-deterministic.

### Why Race Conditions are Dangerous
Race conditions are among the most dangerous bugs in software because:
- They are **non-deterministic** — the bug may appear only 1 in 10,000 runs
- They are **hard to reproduce** — adding logging or debugging often changes thread timing and hides the bug
- They cause **data corruption** — financial calculations become wrong, inventory goes negative
- They can lead to **security vulnerabilities** — TOCTOU (Time-of-Check to Time-of-Use) attacks exploit race conditions

### When Race Conditions Occur
A race condition requires ALL three of these conditions simultaneously:
1. **Shared mutable state** — multiple threads access the same variable/object
2. **At least one thread writes** — if all threads only read, there is no race
3. **No synchronization** — no mechanism prevents concurrent access

> **Key Insight:** If you eliminate ANY ONE of these three conditions, the race condition disappears. This is the foundation of all thread-safety strategies.

### Real-World Production Scenarios
| Scenario | What Goes Wrong |
|---|---|
| Two users buy the last item simultaneously | Inventory goes to -1, both get confirmation |
| Two threads update the same bank balance | Money appears or disappears |
| Two services claim the same resource | Double-booking, duplicate processing |
| Counter incremented by multiple threads | Final count is less than expected |

### Step-by-Step: How a Race Condition Happens
```
Thread A                           Thread B
--------                           --------
Step 1: Read balance (1000)        
                                   Step 2: Read balance (1000)  ← stale!
Step 3: balance = 1000 - 800       
        balance = 200              Step 4: balance = 1000 - 800
                                           balance = 200  ← OVERWRITES Thread A's write!

Result: Only $800 deducted instead of $1600. Bank loses $800.
```

### Example: The Classic Bank Account Problem
```java
public class BankAccount {
    private double balance = 1000.0; // Shared mutable state
    
    public void withdraw(double amount) {
        if (balance >= amount) {          // Step 1: CHECK
            // Thread could be preempted here!
            balance -= amount;            // Step 2: ACT
        }
    }
    
    public double getBalance() {
        return balance;
    }
}

// Two threads withdrawing simultaneously:
BankAccount account = new BankAccount(); // balance = 1000

// Thread A: withdraw(800)
// Thread B: withdraw(800)

// Possible interleaving:
// Thread A: checks balance >= 800 → true (balance is 1000)
// Thread B: checks balance >= 800 → true (balance is STILL 1000, A hasn't subtracted yet!)
// Thread A: balance -= 800 → balance = 200
// Thread B: balance -= 800 → balance = -600  ← OVERDRAFT! Data corruption!
```

## 5.2 Critical Sections

### What is a Critical Section?
A **critical section** is a block of code that accesses shared resources and must be executed by only one thread at a time. It is the smallest possible region of code that needs protection.

### Why Critical Sections Matter
The goal is to make the critical section **as small as possible**. Locking too much code reduces concurrency (threads wait longer). Locking too little causes race conditions.

### Design Principle: Minimize Lock Scope
```
BAD:  Lock entire method (other threads blocked for everything)
┌─────────────────────────────────────────────────────┐
│  🔒 LOCKED                                          │
│  Read config (safe)  →  Access shared data  →  Log  │
└─────────────────────────────────────────────────────┘

GOOD: Lock only the shared data access (other threads blocked minimally)
┌──────────────┐ ┌─────────────────┐ ┌──────────────┐
│  Read config │ │  🔒 LOCKED       │ │  Log         │
│  (no lock)   │ │  Access shared  │ │  (no lock)   │
└──────────────┘ └─────────────────┘ └──────────────┘
```

### Execution Flow
```
Thread A ──→ [Enter Critical Section] ──→ [Read/Write Shared Data] ──→ [Exit]
                      🔒 LOCKED
Thread B ──→ [Waiting...             ] ──────────────────────────→ [Enter] ──→ [...]
```

---

## 5.3 The synchronized Keyword

### What is synchronized?
The `synchronized` keyword provides **mutual exclusion** (mutex) — only one thread can execute a synchronized block/method at a time for a given lock object.

### Why synchronized Exists
Java needed a simple, language-level mechanism to protect critical sections. Before `java.util.concurrent` (added in Java 5), `synchronized` was the **only** way to achieve thread safety.

### When to Use synchronized
| Use synchronized When | Don't Use synchronized When |
|---|---|
| Simple mutual exclusion needed | You need tryLock or timeout |
| Few threads contending | High contention (100+ threads) |
| Code simplicity matters | You need read/write lock separation |
| Lock scope is a single method/block | You need to lock across methods |

### Alternatives to synchronized
| Alternative | When to Use Instead |
|---|---|
| `ReentrantLock` | Need tryLock, timeout, fair ordering, multiple conditions |
| `ReadWriteLock` | Read-heavy workload, few writes |
| `StampedLock` | Optimistic reads, highest performance |
| `Atomic*` classes | Simple counters, flags (no locking needed) |
| `ConcurrentHashMap` | Thread-safe map without external locking |

### How It Works Internally
Every Java object has an **intrinsic lock** (also called **monitor**). When a thread enters a synchronized block:

1. Thread attempts to acquire the object's monitor lock
2. If lock is free → thread acquires it and enters the block
3. If lock is held → thread goes to **BLOCKED** state
4. When thread exits the block → lock is released
5. One waiting thread is awakened and acquires the lock

```
Object's Monitor:
┌─────────────────────────┐
│  Owner: Thread-A        │  ← Currently holds the lock
│  Entry Set: [Thread-B,  │  ← Threads waiting to acquire
│              Thread-C]  │
│  Wait Set:  [Thread-D]  │  ← Threads that called wait()
└─────────────────────────┘
```

### Synchronized Method
```java
public class BankAccount {
    private double balance = 1000.0;
    
    // Lock object = "this" (the BankAccount instance)
    public synchronized void withdraw(double amount) {
        if (balance >= amount) {
            balance -= amount;
        }
    }
    
    public synchronized void deposit(double amount) {
        balance += amount;
    }
    
    public synchronized double getBalance() {
        return balance;
    }
}
```

### Synchronized Block (More Granular)
```java
public class InventoryService {
    private final Map<String, Integer> stock = new HashMap<>();
    private final Object stockLock = new Object(); // Dedicated lock object
    
    public boolean reserveItem(String itemId, int quantity) {
        synchronized (stockLock) { // Only lock the critical section
            Integer available = stock.getOrDefault(itemId, 0);
            if (available >= quantity) {
                stock.put(itemId, available - quantity);
                return true;
            }
            return false;
        }
        // Non-critical code runs without holding the lock
    }
    
    public void restockItem(String itemId, int quantity) {
        synchronized (stockLock) {
            stock.merge(itemId, quantity, Integer::sum);
        }
    }
}
```

### Static Synchronized Method
```java
public class ConnectionPool {
    private static final List<Connection> pool = new ArrayList<>();
    
    // Lock object = ConnectionPool.class (the Class object)
    public static synchronized Connection getConnection() {
        if (pool.isEmpty()) {
            return createNewConnection();
        }
        return pool.remove(pool.size() - 1);
    }
    
    public static synchronized void returnConnection(Connection conn) {
        pool.add(conn);
    }
}
```

### Synchronized Block vs Method

| Feature | Synchronized Method | Synchronized Block |
|---|---|---|
| Lock object | `this` (instance) or `Class` (static) | Any specified object |
| Granularity | Entire method | Specific code section |
| Performance | May hold lock too long | Fine-grained, better concurrency |
| Flexibility | Less flexible | Can use different locks for different resources |
| Best for | Simple cases | Production code with multiple shared resources |

### Enterprise Example: Concurrent Microservice Updates
```java
@Service
public class OrderProcessingService {
    
    private final Map<Long, Order> orderCache = new ConcurrentHashMap<>();
    
    // Use per-order locking to allow concurrent updates to DIFFERENT orders
    public void updateOrderStatus(Long orderId, OrderStatus newStatus) {
        Order order = orderCache.get(orderId);
        if (order == null) return;
        
        synchronized (order) { // Lock on the specific order, not the entire cache
            if (order.getStatus().canTransitionTo(newStatus)) {
                order.setStatus(newStatus);
                order.setUpdatedAt(Instant.now());
                orderRepository.save(order);
                eventPublisher.publish(new OrderStatusChangedEvent(orderId, newStatus));
            }
        }
    }
}
```

## 5.4 Volatile Keyword

### What is volatile?
The `volatile` keyword ensures **visibility** of changes across threads. When a variable is declared volatile, reads/writes go directly to main memory (no CPU cache).

### Why volatile Exists — The JMM Visibility Problem
Without `volatile`, each thread may work with a **cached copy** of a variable in its CPU cache. Thread A updates a variable, but Thread B never sees the update because it reads its own stale cached copy.

```
Without volatile:
┌──────────────┐     ┌──────────────┐
│  Thread A    │     │  Thread B    │
│  CPU Cache   │     │  CPU Cache   │
│  running=F   │     │  running=T   │  ← STALE! Thread B never sees the update
└──────┬───────┘     └──────┬───────┘
       │                    │
   ┌───┴────────────────────┴───┐
   │     Main Memory            │
   │     running = false        │
   └────────────────────────────┘

With volatile:
  Thread A writes → goes DIRECTLY to main memory
  Thread B reads  → reads DIRECTLY from main memory
  No caching, always fresh value
```

### When to Use volatile
- Simple flags (boolean state): `volatile boolean running = true;`
- When only **one thread writes** and others read
- Status indicators, configuration flags, shutdown signals

### When NOT to Use volatile
- **Compound operations** (check-then-act, increment) — NOT atomic with volatile
- When **multiple threads write** to the same variable
- When you need **mutual exclusion** — volatile provides only visibility, not atomicity

```java
public class GracefulShutdown {
    private volatile boolean running = true; // Visible to all threads
    
    public void run() {
        while (running) { // Other thread can set running = false
            processNextItem();
        }
        cleanup();
    }
    
    public void shutdown() {
        running = false; // Immediately visible to the run() thread
    }
}
```

### volatile vs synchronized

| Feature | volatile | synchronized |
|---|---|---|
| Atomicity | No (only read/write of variable) | Yes (entire block) |
| Visibility | Yes | Yes |
| Mutual exclusion | No | Yes |
| Performance | Faster (no locking) | Slower (lock acquisition) |
| Use case | Simple flags, single writes | Compound operations |

---

# Chapter 6: Inter-Thread Communication

## 6.1 wait(), notify(), notifyAll()

### What is Inter-Thread Communication?
Inter-thread communication allows threads to **coordinate** their actions based on shared state. Instead of busy-waiting (spinning in a loop checking a condition), threads can efficiently **sleep** until another thread signals that the condition has changed.

### Why It Exists — The Polling Problem
Without wait/notify, a thread must continuously check a condition:
```
BAD: Busy-waiting (wastes CPU cycles)
while (!dataAvailable) {
    // Thread spins, consuming 100% CPU doing nothing useful
}

GOOD: wait/notify (thread sleeps, zero CPU usage while waiting)
while (!dataAvailable) {
    wait();  // Thread sleeps, uses no CPU. Woken up by notify()
}
```

### When to Use wait/notify vs Modern Alternatives
| Approach | Use When |
|---|---|
| `wait()/notify()` | Legacy code, learning fundamentals |
| `Condition` (from `Lock`) | Need multiple wait conditions on one lock |
| `BlockingQueue` | **Production code** — handles wait/notify internally |
| `CompletableFuture` | One-time async result passing |
| `CountDownLatch` | One thread waits for N threads to finish |

> **Best Practice:** In production code, prefer `BlockingQueue` or `CompletableFuture` over raw wait/notify. They handle synchronization internally and are less error-prone.

### How wait/notify Works Internally

| Method | Description |
|---|---|
| `wait()` | Current thread releases lock and enters WAITING state until notified |
| `wait(long ms)` | Same as wait() but with timeout (TIMED_WAITING) |
| `notify()` | Wakes up ONE arbitrary waiting thread |
| `notifyAll()` | Wakes up ALL waiting threads (recommended) |

### Step-by-Step Execution Flow
```
1. Thread A calls wait() on object X
   → Thread A RELEASES the lock on X
   → Thread A enters WAITING state (uses no CPU)
   → Thread A is added to X's "wait set"

2. Thread B acquires lock on X, modifies shared state
   → Thread B calls notifyAll() on X
   → All threads in X's wait set are moved to "entry set"
   → Thread B releases lock on X

3. Thread A re-acquires lock on X
   → Thread A re-checks condition in while loop
   → If condition met: proceeds. If not: calls wait() again
```

### Critical Rules
1. Must be called inside `synchronized` block on the **same object**
2. `wait()` releases the lock; the thread re-acquires it when woken up
3. Always use `while` loop (not `if`) to check condition — guard against **spurious wakeups**
4. Prefer `notifyAll()` over `notify()` to avoid lost signals

### Design Pattern: Guarded Suspension
The wait/notify pattern implements the **Guarded Suspension** design pattern — a thread suspends execution until a guard condition becomes true.

## 6.2 Producer-Consumer Pattern

### What is the Producer-Consumer Pattern?
The **Producer-Consumer pattern** decouples data production from data consumption. Producers generate data and place it in a shared buffer. Consumers take data from the buffer and process it. Neither needs to know about the other.

### Why This Pattern is Used
- **Decoupling** — producers and consumers work independently at different speeds
- **Buffering** — absorb temporary speed mismatches (producer faster than consumer)
- **Scalability** — easily add more producers or consumers

### Real-World Examples
| System | Producer | Buffer | Consumer |
|---|---|---|---|
| REST API | HTTP request handler | BlockingQueue | Background worker threads |
| Kafka | Event publisher | Kafka topic | Consumer group |
| Batch processing | File reader | In-memory queue | Record processor |
| Logging | Application thread | Log buffer | Log writer thread |

```java
public class MessageQueue<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;
    
    public MessageQueue(int capacity) {
        this.capacity = capacity;
    }
    
    // Producer: Add message to queue
    public synchronized void produce(T message) throws InterruptedException {
        // WHILE (not IF) — guards against spurious wakeups
        while (queue.size() == capacity) {
            System.out.println("Queue full. Producer waiting...");
            wait(); // Release lock, wait for consumer to consume
        }
        
        queue.offer(message);
        System.out.println("Produced: " + message + " | Queue size: " + queue.size());
        notifyAll(); // Wake up waiting consumers
    }
    
    // Consumer: Take message from queue
    public synchronized T consume() throws InterruptedException {
        while (queue.isEmpty()) {
            System.out.println("Queue empty. Consumer waiting...");
            wait(); // Release lock, wait for producer to produce
        }
        
        T message = queue.poll();
        System.out.println("Consumed: " + message + " | Queue size: " + queue.size());
        notifyAll(); // Wake up waiting producers
        return message;
    }
}

// Usage
MessageQueue<String> queue = new MessageQueue<>(5);

// Producer thread
Thread producer = new Thread(() -> {
    for (int i = 0; i < 20; i++) {
        try {
            queue.produce("Message-" + i);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
});

// Consumer thread
Thread consumer = new Thread(() -> {
    for (int i = 0; i < 20; i++) {
        try {
            queue.consume();
            Thread.sleep(500); // Simulate processing
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
});

producer.start();
consumer.start();
```

### Step-by-Step Execution Flow
```
1. Producer starts, queue is empty (size 0)
2. Producer calls produce("Message-0")
   → Acquires lock on queue object
   → queue.size() (0) != capacity (5), so no wait
   → Adds message, queue size = 1
   → Calls notifyAll() (no one waiting yet)
   → Releases lock

3. Producer produces Messages 1-4 similarly (queue size → 5)

4. Producer calls produce("Message-5")
   → Acquires lock
   → queue.size() (5) == capacity (5)!
   → Calls wait() → RELEASES lock, enters WAITING state

5. Consumer starts, calls consume()
   → Acquires lock (producer released it via wait())
   → Queue not empty, polls "Message-0"
   → Calls notifyAll() → WAKES UP producer
   → Releases lock

6. Producer wakes up, re-acquires lock
   → Re-checks while condition: queue.size() (4) != 5
   → Adds "Message-5", notifies all
   → Releases lock

7. Cycle continues until all messages produced and consumed
```

### Modern Alternative: BlockingQueue
```java
// In production, use BlockingQueue instead of manual wait/notify
BlockingQueue<String> queue = new ArrayBlockingQueue<>(5);

// Producer
queue.put("message");  // Blocks if full

// Consumer
String msg = queue.take();  // Blocks if empty
```

---

# Chapter 7: Locks Framework (java.util.concurrent.locks)

### Why a Separate Locks Framework?
The `synchronized` keyword was Java's only locking mechanism until Java 5. While simple, it has limitations:
- Cannot attempt a lock without blocking (no tryLock)
- Cannot timeout while waiting for a lock
- Cannot interrupt a thread waiting for a lock
- Cannot have fairness guarantees
- Only one wait/notify condition per lock

The `java.util.concurrent.locks` package was introduced in **Java 5** to address all of these limitations while maintaining backward compatibility.

## 7.1 ReentrantLock

### What is ReentrantLock?
A **reentrant mutual exclusion lock** with extended capabilities beyond `synchronized`. The same thread can acquire the lock multiple times without deadlocking (hence "reentrant" — re-entering the same lock).

### Why "Reentrant" Matters
```
Scenario: Method A calls Method B, both need the same lock

Non-reentrant lock:     Reentrant lock:
  methodA() {             methodA() {
    lock.lock();            lock.lock();       // count = 1
    methodB();  ← DEADLOCK! methodB();         // works fine
  }                       }
  methodB() {             methodB() {
    lock.lock(); ← blocks   lock.lock();       // count = 2
    forever!                // ... work ...
  }                         lock.unlock();     // count = 1
                          }
```

### When to Use ReentrantLock vs synchronized
| Use ReentrantLock When | Stick with synchronized When |
|---|---|
| Need tryLock() or lock timeout | Simple mutual exclusion |
| Need fair lock ordering | Code simplicity matters most |
| Need multiple Condition objects | Short critical sections |
| Need interruptible lock waiting | No need for advanced features |
| Complex locking scenarios | Low contention scenarios |

### Why Use Over synchronized
- **tryLock()** — Non-blocking lock attempt
- **tryLock(timeout)** — Timed lock attempt
- **lockInterruptibly()** — Can be interrupted while waiting
- **Fairness policy** — Optional FIFO ordering of waiting threads
- **Multiple Condition objects** — More flexible than wait/notify

> **Production Rule:** Always use `try-finally` with ReentrantLock. If you forget `unlock()` in a `finally` block, threads will deadlock permanently.

### How It Works
```java
public class ThreadSafeCounter {
    private int count = 0;
    private final ReentrantLock lock = new ReentrantLock();
    
    public void increment() {
        lock.lock();           // Acquire lock
        try {
            count++;           // Critical section
        } finally {
            lock.unlock();     // ALWAYS unlock in finally!
        }
    }
    
    public boolean tryIncrement() {
        if (lock.tryLock()) {  // Non-blocking attempt
            try {
                count++;
                return true;
            } finally {
                lock.unlock();
            }
        }
        return false; // Lock not available, skip
    }
    
    public void incrementWithTimeout() throws InterruptedException {
        if (lock.tryLock(2, TimeUnit.SECONDS)) { // Wait up to 2 seconds
            try {
                count++;
            } finally {
                lock.unlock();
            }
        } else {
            throw new TimeoutException("Could not acquire lock within 2 seconds");
        }
    }
}
```

### Fair vs Unfair Lock
```java
// Unfair (default) — Better throughput, but thread starvation possible
ReentrantLock unfairLock = new ReentrantLock();       // unfair
ReentrantLock fairLock = new ReentrantLock(true);     // fair — FIFO ordering

// Fair lock: threads acquire lock in the order they requested it
// Unfair lock: a thread can "barge in" and acquire the lock ahead of waiting threads
// Unfair is usually preferred for better throughput
```

### Condition Variables (Advanced wait/notify)
```java
public class BoundedBuffer<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();   // Separate condition
    private final Condition notEmpty = lock.newCondition();  // Separate condition
    
    public BoundedBuffer(int capacity) { this.capacity = capacity; }
    
    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (queue.size() == capacity) {
                notFull.await();     // Wait until not full
            }
            queue.offer(item);
            notEmpty.signal();       // Signal that buffer is not empty
        } finally {
            lock.unlock();
        }
    }
    
    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (queue.isEmpty()) {
                notEmpty.await();    // Wait until not empty
            }
            T item = queue.poll();
            notFull.signal();        // Signal that buffer is not full
            return item;
        } finally {
            lock.unlock();
        }
    }
}
```

---

## 7.2 ReadWriteLock

### What is ReadWriteLock?
Allows multiple **concurrent readers** OR one **exclusive writer**. Dramatically improves throughput for read-heavy scenarios.

### Why ReadWriteLock Exists
With `synchronized` or `ReentrantLock`, even read operations block each other. In a system where 95% of operations are reads, this wastes concurrency. ReadWriteLock allows all readers to proceed simultaneously — only writers need exclusive access.

### When to Use ReadWriteLock
- **Read-heavy workloads** (90%+ reads, few writes)
- Configuration caches, reference data, lookup tables
- When reads are significantly more frequent than writes

### When NOT to Use ReadWriteLock
- **Write-heavy workloads** — overhead of read/write tracking adds no benefit
- **Short critical sections** — lock overhead may exceed actual work
- Consider `ConcurrentHashMap` for concurrent map access instead

### Real-World Scenario
```
Configuration Cache (1000 reads/sec, 1 write/min):

synchronized:          ReadWriteLock:
  [R1] [R2] [R3]...     [R1] [R2] [R3]  ← all read simultaneously
  Each waits for         [R4] [R5]       ← no waiting!
  the previous one       [W1]            ← only writer blocks
  Throughput: LOW        Throughput: HIGH
```

### How It Works
```
Reader threads:    [R1] [R2] [R3] — All can read simultaneously
Writer thread:     [W1]          — Exclusive access, blocks all readers and other writers

Rules:
- Multiple readers CAN hold the read lock simultaneously
- Only ONE writer can hold the write lock
- Writer blocks all readers and other writers
- Readers block writers
```

### Implementation
```java
@Service
public class ConfigurationCache {
    
    private final Map<String, String> config = new HashMap<>();
    private final ReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final Lock readLock = rwLock.readLock();
    private final Lock writeLock = rwLock.writeLock();
    
    // Multiple threads can read concurrently
    public String getConfig(String key) {
        readLock.lock();
        try {
            return config.getOrDefault(key, "");
        } finally {
            readLock.unlock();
        }
    }
    
    // Only one thread writes at a time (exclusive)
    public void updateConfig(String key, String value) {
        writeLock.lock();
        try {
            config.put(key, value);
            log.info("Config updated: {} = {}", key, value);
        } finally {
            writeLock.unlock();
        }
    }
    
    // Bulk reload requires exclusive access
    public void reloadAll(Map<String, String> newConfig) {
        writeLock.lock();
        try {
            config.clear();
            config.putAll(newConfig);
        } finally {
            writeLock.unlock();
        }
    }
}
```

---

## 7.3 StampedLock (Java 8+)

### What
An advanced lock that adds an **optimistic read mode** to ReadWriteLock. Optimistic reads don't acquire any lock — they check afterward if data was modified.

### Three Modes

| Mode | Description | Use Case |
|---|---|---|
| **Read Lock** | Shared lock (like ReadWriteLock) | Read when writes are frequent |
| **Write Lock** | Exclusive lock | Write operations |
| **Optimistic Read** | No locking, just a stamp check | Read-heavy, occasional writes |

### How Optimistic Read Works
```java
public class Point {
    private double x, y;
    private final StampedLock lock = new StampedLock();
    
    public void move(double deltaX, double deltaY) {
        long stamp = lock.writeLock();      // Exclusive write lock
        try {
            x += deltaX;
            y += deltaY;
        } finally {
            lock.unlockWrite(stamp);
        }
    }
    
    public double distanceFromOrigin() {
        long stamp = lock.tryOptimisticRead();  // No locking! Just get a stamp
        double currentX = x;
        double currentY = y;
        
        if (!lock.validate(stamp)) {            // Check if a write happened
            // Write happened during our read → fall back to read lock
            stamp = lock.readLock();
            try {
                currentX = x;
                currentY = y;
            } finally {
                lock.unlockRead(stamp);
            }
        }
        
        return Math.sqrt(currentX * currentX + currentY * currentY);
    }
}
```

### Lock Comparison Table

| Feature | synchronized | ReentrantLock | ReadWriteLock | StampedLock |
|---|---|---|---|---|
| Fairness | No | Configurable | Configurable | No |
| tryLock | No | Yes | Yes | Yes |
| Interruptible | No | Yes | Yes | Yes |
| Condition | 1 (wait/notify) | Multiple | Multiple | No |
| Reentrant | Yes | Yes | Yes | No |
| Read/Write split | No | No | Yes | Yes |
| Optimistic read | No | No | No | **Yes** |
| Performance | Good | Good | Better (reads) | **Best** (reads) |
| Complexity | Low | Medium | Medium | High |

---

# Chapter 8: Java Concurrent Collections

### Why Concurrent Collections Exist
Before Java 5, the only thread-safe collections were `Vector`, `Hashtable`, and `Collections.synchronizedXxx()` wrappers. These use **coarse-grained locking** — every method synchronizes on the entire collection, creating a bottleneck. Concurrent collections use **fine-grained locking**, **lock-free algorithms (CAS)**, and **copy-on-write** strategies for dramatically better performance.

| Collection Type | Old Thread-Safe | Modern Concurrent | Performance Gain |
|---|---|---|---|
| Map | `Hashtable`, `Collections.synchronizedMap()` | `ConcurrentHashMap` | 10-100x under contention |
| List | `Vector`, `Collections.synchronizedList()` | `CopyOnWriteArrayList` | Lock-free reads |
| Queue | (none) | `ConcurrentLinkedQueue`, `BlockingQueue` | Non-blocking or efficient blocking |

---

## 8.1 ConcurrentHashMap

### What is ConcurrentHashMap?
A thread-safe HashMap designed for **high concurrency**. Uses per-bucket locking (Java 8+) instead of locking the entire map.

### Why ConcurrentHashMap Over Hashtable/synchronizedMap
| Feature | `Hashtable` / `synchronizedMap` | `ConcurrentHashMap` |
|---|---|---|
| Locking | Entire map locked on every operation | Only affected bucket locked |
| Read performance | Blocked by any write | Lock-free reads (volatile) |
| Write performance | All writes sequential | Concurrent writes to different buckets |
| Null keys/values | `Hashtable`: no nulls; `synchronizedMap`: allows | No nulls (by design) |
| Iterator | Fail-fast (throws CME) | Weakly consistent (no CME) |

### When to Use ConcurrentHashMap
- In-memory caches, rate limiters, metrics counters
- Any map accessed by multiple threads
- When you need `computeIfAbsent`, `merge`, or other atomic compound operations

### When NOT to Use ConcurrentHashMap
- Single-threaded code — use `HashMap` (no overhead)
- Need sorted keys — use `ConcurrentSkipListMap`
- Need to lock multiple operations atomically — external `synchronized` block needed

### Internal Architecture (Java 8+)
```
ConcurrentHashMap table[]
┌────┐
│ [0]│ → null
│ [1]│ → Node → Node → null     ← synchronized on first node (bin-level lock)
│ [2]│ → TreeBin → ...          ← synchronized on TreeBin
│ [3]│ → null                   ← CAS for empty bin insertion (no lock!)
│ ...│
│ [n]│ → ForwardingNode         ← resize in progress
└────┘

Key operations:
- Empty bin insert: CAS (Compare-And-Swap) — no lock!
- Occupied bin insert: synchronized on bin head — only this bin locked
- Read: volatile read — no lock!
```

### Production Usage
```java
@Component
public class ApiRateLimiter {
    
    private final ConcurrentHashMap<String, AtomicLong> requestCounts = 
        new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Instant> windowStart = 
        new ConcurrentHashMap<>();
    
    private static final int MAX_REQUESTS = 100;
    private static final Duration WINDOW = Duration.ofMinutes(1);
    
    public boolean isAllowed(String clientId) {
        Instant now = Instant.now();
        
        windowStart.compute(clientId, (key, start) -> {
            if (start == null || Duration.between(start, now).compareTo(WINDOW) > 0) {
                requestCounts.put(clientId, new AtomicLong(0));
                return now;
            }
            return start;
        });
        
        long count = requestCounts.computeIfAbsent(clientId, 
            k -> new AtomicLong(0)).incrementAndGet();
        return count <= MAX_REQUESTS;
    }
}
```

### Atomic Compound Operations
```java
ConcurrentHashMap<String, LongAdder> metrics = new ConcurrentHashMap<>();

// computeIfAbsent — atomic create-if-missing
metrics.computeIfAbsent("api.calls", k -> new LongAdder()).increment();

// merge — atomic read-modify-write
ConcurrentHashMap<String, Integer> wordCount = new ConcurrentHashMap<>();
wordCount.merge("java", 1, Integer::sum);  // Thread-safe increment

// Bulk operations (Java 8+)
long total = metrics.reduceValues(/* parallelismThreshold */ 4, 
    LongAdder::sum, Long::sum);
```

---

## 8.2 CopyOnWriteArrayList

### What is CopyOnWriteArrayList?
A thread-safe List where every write operation creates a **new copy** of the underlying array. Read operations are completely lock-free because they read from an immutable snapshot.

### Why Copy-on-Write?
The fundamental insight is: **if the data never changes in place, reads can never be inconsistent**. By copying the entire array on every write, existing readers continue iterating the old (immutable) array while the new version is prepared.

### How It Works Internally
```
State 1: array = [A, B, C]   ← all readers see this

Writer adds D:
  1. Creates new array: [A, B, C, D]
  2. Atomically swaps reference: array → new array
  3. Old array: readers still iterating it see [A, B, C] — consistent!
  4. New readers see [A, B, C, D]

No locks needed for reads. Iterator never throws ConcurrentModificationException.
```

### When to Use
- **Read-heavy, write-rare** scenarios (e.g., event listeners, configuration lists)
- Small-to-medium sized lists
- When iterator consistency is critical (no ConcurrentModificationException)

### When NOT to Use
- **Frequent writes** — each write copies the ENTIRE array (O(n) time and memory)
- **Large lists** — copying a 10,000-element array on every add is expensive
- Use `ConcurrentLinkedQueue` or `Collections.synchronizedList()` instead for write-heavy scenarios

```java
@Component
public class WebhookRegistry {
    
    private final CopyOnWriteArrayList<WebhookEndpoint> endpoints = 
        new CopyOnWriteArrayList<>();
    
    // Rare write — copies entire array
    public void register(WebhookEndpoint endpoint) {
        endpoints.addIfAbsent(endpoint);
    }
    
    // Frequent read — no lock, no copy
    public void notifyAll(Event event) {
        for (WebhookEndpoint endpoint : endpoints) { // Safe iteration, no CME
            try {
                httpClient.post(endpoint.getUrl(), event);
            } catch (Exception e) {
                log.error("Webhook failed: {}", endpoint.getUrl(), e);
            }
        }
    }
}
```

---

## 8.3 BlockingQueue

### What is BlockingQueue?
A Queue that blocks the thread on `put()` when full and on `take()` when empty. **The go-to data structure for producer-consumer patterns** in production Java applications.

### Why BlockingQueue Over Manual wait/notify
BlockingQueue encapsulates all the synchronization complexity (wait/notify, while loops, lock management) into a simple `put()` and `take()` API. It eliminates the most common concurrency bugs.

### When to Use Which Implementation
| If You Need... | Use... | Why |
|---|---|---|
| Fixed-size buffer | `ArrayBlockingQueue` | Bounded, predictable memory |
| Unbounded or large buffer | `LinkedBlockingQueue` | Grows as needed |
| Priority ordering | `PriorityBlockingQueue` | Always dequeues highest priority |
| Direct handoff (no buffer) | `SynchronousQueue` | Producer waits for consumer |
| Delayed processing | `DelayQueue` | Elements available only after delay |

### Implementations

| Implementation | Description | Bounded |
|---|---|---|
| `ArrayBlockingQueue` | Array-based, fixed capacity | Yes |
| `LinkedBlockingQueue` | Linked nodes, optional capacity | Optional |
| `PriorityBlockingQueue` | Priority-based ordering | No |
| `SynchronousQueue` | Zero-capacity, direct handoff | N/A |
| `DelayQueue` | Elements available only after delay | No |

### Key Methods

| Method | Blocks? | Behavior when limit reached |
|---|---|---|
| `put(e)` | Yes | Blocks until space available |
| `take()` | Yes | Blocks until element available |
| `offer(e)` | No | Returns false if full |
| `poll()` | No | Returns null if empty |
| `offer(e, timeout)` | Timed | Blocks up to timeout |
| `poll(timeout)` | Timed | Blocks up to timeout |

### Production: Task Processing Queue
```java
@Component
public class OrderProcessingQueue {
    
    private final BlockingQueue<Order> queue = new ArrayBlockingQueue<>(1000);
    
    // Called by REST controller — enqueues order
    public boolean submit(Order order) {
        return queue.offer(order); // Non-blocking, returns false if full
    }
    
    // Background processor threads
    @PostConstruct
    public void startProcessors() {
        int processors = Runtime.getRuntime().availableProcessors();
        for (int i = 0; i < processors; i++) {
            Thread processor = new Thread(() -> {
                while (!Thread.currentThread().isInterrupted()) {
                    try {
                        Order order = queue.take(); // Blocks until order available
                        processOrder(order);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }, "order-processor-" + i);
            processor.setDaemon(true);
            processor.start();
        }
    }
}
```

---

## 8.4 ConcurrentLinkedQueue

### What
An unbounded, lock-free, thread-safe queue based on **CAS (Compare-And-Swap)** operations. Non-blocking — never puts a thread to sleep.

### When to Use
- High-contention producer-consumer without blocking
- When `size()` is not needed (O(n) traversal for size!)
- Event buffering in real-time systems

```java
@Component
public class EventBuffer {
    
    private final ConcurrentLinkedQueue<AuditEvent> buffer = new ConcurrentLinkedQueue<>();
    
    // Multiple producer threads — lock-free
    public void record(AuditEvent event) {
        buffer.offer(event); // Never blocks, never fails (unbounded)
    }
    
    // Periodic flush to database
    @Scheduled(fixedRate = 5000)
    public void flush() {
        List<AuditEvent> batch = new ArrayList<>();
        AuditEvent event;
        int count = 0;
        
        while ((event = buffer.poll()) != null && count < 500) {
            batch.add(event);
            count++;
        }
        
        if (!batch.isEmpty()) {
            auditRepository.saveAll(batch);
            log.info("Flushed {} audit events", batch.size());
        }
    }
}
```

### Thread-Safe Collection Comparison

| Collection | Lock Strategy | Blocking | Best For |
|---|---|---|---|
| `ConcurrentHashMap` | Per-bin lock + CAS | No | High-concurrency maps |
| `CopyOnWriteArrayList` | Copy-on-write | No | Read-heavy small lists |
| `ArrayBlockingQueue` | ReentrantLock | Yes | Bounded producer-consumer |
| `LinkedBlockingQueue` | Dual ReentrantLock | Yes | Unbounded producer-consumer |
| `ConcurrentLinkedQueue` | CAS (lock-free) | No | High-throughput non-blocking |
| `SynchronousQueue` | Direct handoff | Yes | Thread-to-thread handoff |

---
