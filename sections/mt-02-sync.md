
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

## 5.5 Java Memory Model (JMM) — Deep Dive

### Why the JMM Exists

The Java Memory Model (JSR-133) defines the rules for how threads interact through memory. Without it, the JIT compiler, CPU, and memory hardware are free to **reorder** and **cache** operations in ways that break multithreaded code.

```
The Problem Without JMM Guarantees:
────────────────────────────────────

Java code:              What CPU/compiler might actually do:
  x = 1;                  y = 2;     ← REORDERED! (faster this way)
  y = 2;                  x = 1;

This reordering is invisible in single-threaded code (same result).
But in multithreaded code, Thread B might see y=2 but x=0 (old value)!

Sources of reordering:
1. Compiler (JIT) reordering — for register optimization
2. CPU instruction reordering — out-of-order execution pipelines
3. Store buffer reordering — writes buffered before flushing to cache
4. Cache coherence delays — different cores see updates at different times
```

### Happens-Before Relationship

The **happens-before** relationship is the foundation of JMM. If action A *happens-before* action B, then A's effects are **guaranteed visible** to B.

```
Happens-Before Rules (Memorize These!):
────────────────────────────────────────

1. PROGRAM ORDER RULE
   Within a single thread, each statement happens-before the next.
   x = 1;         ← happens-before →
   y = x + 1;     ← guaranteed to see x = 1

2. MONITOR LOCK RULE
   An unlock() on a monitor happens-before every subsequent lock() on that monitor.
   Thread A: synchronized(lock) { x = 1; }        ← unlock happens
   Thread B: synchronized(lock) { print(x); }     ← lock happens → sees x = 1

3. VOLATILE VARIABLE RULE
   A write to a volatile variable happens-before every subsequent read of that variable.
   Thread A: volatile_flag = true;     ← write
   Thread B: if (volatile_flag) { }    ← read → guaranteed to see true

4. THREAD START RULE
   Thread.start() happens-before any action in the started thread.
   x = 42;
   thread.start();     ← thread.run() sees x = 42

5. THREAD TERMINATION RULE
   Any action in a thread happens-before Thread.join() returns.
   // In thread: x = 42;
   thread.join();      ← after join, caller sees x = 42

6. TRANSITIVITY
   If A happens-before B, and B happens-before C, then A happens-before C.
   This is how volatile can be used to publish non-volatile data safely.
```

### Memory Barriers (Fences)

Memory barriers are CPU instructions that enforce ordering. The JVM inserts them automatically for `volatile` and `synchronized`:

```
Types of Memory Barriers:
─────────────────────────

LoadLoad   — All reads BEFORE the barrier complete before reads AFTER it
StoreStore — All writes BEFORE the barrier are flushed before writes AFTER it
LoadStore  — All reads BEFORE the barrier complete before writes AFTER it
StoreLoad  — All writes BEFORE the barrier are flushed before reads AFTER it
             (most expensive, full memory fence)

What the JVM inserts:

volatile READ:
  [LoadLoad barrier]
  read volatile variable
  [LoadStore barrier]

volatile WRITE:
  [StoreStore barrier]
  write volatile variable
  [StoreLoad barrier]    ← this is why volatile writes are expensive

synchronized ENTER:
  acquire monitor lock
  [LoadLoad + LoadStore barrier]    ← refresh all cached values

synchronized EXIT:
  [StoreStore + LoadStore barrier]  ← flush all writes
  release monitor lock
```

### The Double-Checked Locking Pattern Explained

This pattern is the classic example of why JMM matters:

```java
public class ConnectionPool {
    // WITHOUT volatile: BROKEN!
    // private static ConnectionPool instance;
    
    // WITH volatile: CORRECT
    private static volatile ConnectionPool instance;
    
    public static ConnectionPool getInstance() {
        if (instance == null) {                    // 1st check (no lock)
            synchronized (ConnectionPool.class) {
                if (instance == null) {            // 2nd check (with lock)
                    instance = new ConnectionPool(); // ← THE PROBLEM
                }
            }
        }
        return instance;
    }
}

// Why volatile is required:
// "instance = new ConnectionPool()" is actually 3 steps:
//   1. Allocate memory for ConnectionPool object
//   2. Initialize the object (constructor runs)
//   3. Assign reference to 'instance' variable
//
// Without volatile, the CPU may REORDER steps 2 and 3:
//   1. Allocate memory
//   3. Assign reference (instance now non-null!)  ← REORDERED!
//   2. Initialize object (constructor hasn't run yet!)
//
// Thread B sees instance != null, returns a PARTIALLY CONSTRUCTED object!
// volatile prevents this reordering with a StoreStore barrier.
```

## 5.6 False Sharing — The Hidden Performance Killer

### What is False Sharing?

False sharing occurs when two threads on different cores modify **different variables** that happen to reside on the **same CPU cache line** (64 bytes). Both cores constantly invalidate each other's cache lines, destroying performance.

```
False Sharing Scenario:
───────────────────────

class Counters {
    volatile long counterA = 0;  // Thread 1 writes this
    volatile long counterB = 0;  // Thread 2 writes this
}

Memory layout (both fit in ONE 64-byte cache line):
┌────────────────────────────────────────────────────────────────┐
│  Cache Line (64 bytes)                                         │
│  [counterA: 8 bytes] [counterB: 8 bytes] [padding: 48 bytes]  │
└────────────────────────────────────────────────────────────────┘

Core 0 (Thread 1)              Core 1 (Thread 2)
  writes counterA                writes counterB
  → invalidates Core 1's         → invalidates Core 0's
    cache line!                     cache line!
  → Core 1 must reload           → Core 0 must reload
    from L3/memory                  from L3/memory

Result: 10-100x slower than expected!
Each "independent" write causes a full cache line transfer (~100ns)
instead of an L1 cache hit (~1ns).
```

### How to Fix False Sharing

```java
// Solution 1: @Contended annotation (Java 8+, -XX:-RestrictContended)
import sun.misc.Contended;

class Counters {
    @Contended
    volatile long counterA = 0;   // Padded to its own cache line
    
    @Contended
    volatile long counterB = 0;   // Padded to its own cache line
}

// Solution 2: Manual padding
class Counters {
    volatile long counterA = 0;
    long p1, p2, p3, p4, p5, p6, p7;  // 56 bytes of padding
    volatile long counterB = 0;
    // Now counterA and counterB are on DIFFERENT cache lines
}

// Real-world example: LongAdder uses @Contended internally
// on its Cell[] array to avoid false sharing between cells
```

> **Production Insight:** False sharing is why `LongAdder` is faster than `AtomicLong` under high contention. `LongAdder` spreads updates across multiple cache-line-padded cells, so different threads don't invalidate each other's cache lines.

## 5.7 Atomic Classes — Lock-Free Thread Safety

### The CAS (Compare-And-Swap) Hardware Instruction

All Atomic classes are built on top of **CAS** — an atomic CPU instruction that enables lock-free programming:

```
CAS(memoryLocation, expectedValue, newValue):
  Atomically:
    if (memoryLocation == expectedValue) {
        memoryLocation = newValue;
        return true;   // Success
    } else {
        return false;  // Someone else changed it first, try again
    }

CPU instruction: CMPXCHG on x86, LL/SC on ARM

How AtomicInteger.incrementAndGet() works internally:
  1. Read current value (e.g., 5)
  2. Compute new value (5 + 1 = 6)
  3. CAS(address, 5, 6) 
     → If current is still 5: set to 6, return true ✓
     → If current is now 7 (another thread changed it): return false ✗
  4. If CAS failed: RETRY from step 1 (spin loop)
```

### Atomic Classes Overview

```java
// AtomicInteger / AtomicLong — atomic int/long operations
AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet();                      // Thread-safe ++
counter.compareAndSet(expected, newValue);       // CAS
counter.getAndUpdate(x -> x * 2);               // Atomic function application
counter.accumulateAndGet(5, Integer::sum);       // Atomic accumulation

// AtomicBoolean — atomic flag
AtomicBoolean initialized = new AtomicBoolean(false);
if (initialized.compareAndSet(false, true)) {
    // Only ONE thread enters here — guaranteed
    performInitialization();
}

// AtomicReference<V> — atomic reference swap
AtomicReference<Config> configRef = new AtomicReference<>(loadConfig());
// Atomically update config (lock-free)
configRef.updateAndGet(old -> loadNewConfig());

// AtomicStampedReference<V> — solves the ABA problem
AtomicStampedReference<String> ref = new AtomicStampedReference<>("A", 0);
int[] stampHolder = new int[1];
String value = ref.get(stampHolder);   // Gets value AND stamp
ref.compareAndSet("A", "B", stampHolder[0], stampHolder[0] + 1);
```

### LongAdder vs AtomicLong (Critical for High-Contention Counters)

```java
// AtomicLong: ONE variable, ALL threads CAS on it → contention bottleneck
AtomicLong atomicCounter = new AtomicLong(0);
atomicCounter.incrementAndGet();  // Under 100 threads: LOTS of CAS retries

// LongAdder: MULTIPLE cells, threads spread across cells → minimal contention
LongAdder adderCounter = new LongAdder();
adderCounter.increment();         // Under 100 threads: each thread hits different cell
long total = adderCounter.sum();  // Sum all cells (slightly stale, but fast)
```

```
Performance comparison (100 threads, 1M increments each):
─────────────────────────────────────────────────────────
AtomicLong:    ~3,200 ms  (all threads fighting over one CAS)
LongAdder:     ~380 ms   (threads spread across padded cells)
synchronized:  ~4,500 ms  (lock acquisition overhead)

When to use which:
  AtomicLong  → low contention, need exact real-time value
  LongAdder   → high contention, can tolerate slightly stale sum()
  LongAccumulator → high contention, custom accumulation function
```

### Atomic vs Volatile vs Synchronized Decision Table

| Requirement | Use | Why |
|---|---|---|
| Simple flag (one writer, many readers) | `volatile` | Cheapest visibility guarantee |
| Counter (multiple writers) | `AtomicInteger` / `LongAdder` | Lock-free, no blocking |
| Check-then-act (compare-and-swap) | `AtomicReference.CAS()` | Single atomic operation |
| Multiple fields must be consistent | `synchronized` / `ReentrantLock` | Only way to group operations |
| High-contention counter | `LongAdder` | Distributes contention across cells |

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

## 7.4 AbstractQueuedSynchronizer (AQS) — The Backbone

Almost every synchronization utility in `java.util.concurrent` is built on top of **AQS**: ReentrantLock, Semaphore, CountDownLatch, ReentrantReadWriteLock, and more.

```
AQS Internal Structure:
────────────────────────

┌──────────────────────────────────────────────────┐
│  AbstractQueuedSynchronizer                       │
│                                                   │
│  state: int (volatile)                            │
│    - ReentrantLock: 0 = unlocked, N = lock count  │
│    - Semaphore: number of permits remaining        │
│    - CountDownLatch: count remaining               │
│                                                   │
│  CLH Wait Queue (FIFO):                           │
│  ┌──────┐    ┌──────┐    ┌──────┐                 │
│  │Head  │ →  │Node 1│ →  │Node 2│ → null          │
│  │(dummy)│    │(T1)  │    │(T2)  │                 │
│  └──────┘    └──────┘    └──────┘                 │
│               Thread 1    Thread 2                 │
│               WAITING     WAITING                  │
│                                                   │
│  exclusiveOwnerThread: Thread                     │
│    - Which thread currently owns the lock          │
└──────────────────────────────────────────────────┘

How ReentrantLock.lock() works internally:
  1. Try CAS(state, 0, 1) — fast path (no contention)
     → Success: set exclusiveOwnerThread = currentThread, return
  2. If CAS fails: is currentThread == owner? (reentrant check)
     → Yes: state++ (increment hold count), return
  3. Otherwise: create CLH Node, add to queue tail (CAS)
     → Park thread using LockSupport.park()
     → When unparked: retry acquisition from queue head
```

> **Interview Gold:** When asked "how does ReentrantLock work internally?", explain the AQS state variable, CLH queue, and the fast-path CAS acquisition. This demonstrates deep JVM knowledge.

## 7.5 Synchronization Utilities

### CountDownLatch — Wait for N Events

**Use case:** Main thread waits for multiple worker threads to complete initialization.

```java
// Production scenario: Service startup — wait for all caches to warm up
@Component
public class ApplicationStartup {

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(3);  // Wait for 3 tasks
        
        executor.submit(() -> {
            loadUserCache();        // Takes ~2 seconds
            latch.countDown();      // 3 → 2
        });
        executor.submit(() -> {
            loadProductCatalog();   // Takes ~3 seconds
            latch.countDown();      // 2 → 1
        });
        executor.submit(() -> {
            warmUpConnectionPool(); // Takes ~1 second
            latch.countDown();      // 1 → 0
        });
        
        boolean completed = latch.await(30, TimeUnit.SECONDS);  // Wait for all 3
        if (!completed) {
            throw new IllegalStateException("Startup timed out!");
        }
        log.info("All caches warmed. Application ready to serve traffic.");
    }
}
```

```
CountDownLatch internals (backed by AQS):
  state = N (initial count)
  countDown() → decrementAndGet(state)
  await()     → if state > 0, park thread
  When state reaches 0 → unpark ALL waiting threads

Key properties:
  • ONE-TIME USE — cannot be reset (use CyclicBarrier for reusable)
  • Multiple threads can await() on the same latch
  • countDown() can be called by different threads
```

### CyclicBarrier — Synchronize N Threads at a Barrier Point

**Use case:** Multiple threads must all reach a checkpoint before any can proceed (common in iterative algorithms).

```java
// Production scenario: Parallel data processing with merge step
public class ParallelReportGenerator {

    public Report generateReport(List<DataSource> sources) throws Exception {
        int parties = sources.size();
        List<PartialReport> results = Collections.synchronizedList(new ArrayList<>());
        
        // Barrier action runs when ALL threads arrive
        CyclicBarrier barrier = new CyclicBarrier(parties, () -> {
            log.info("All {} partitions processed. Merging results...", parties);
        });
        
        for (DataSource source : sources) {
            executor.submit(() -> {
                try {
                    PartialReport partial = processDataSource(source);
                    results.add(partial);
                    barrier.await(60, TimeUnit.SECONDS);  // Wait for all threads
                } catch (Exception e) {
                    log.error("Partition failed", e);
                }
            });
        }
        
        return mergeReports(results);
    }
}
```

```
CyclicBarrier vs CountDownLatch:
─────────────────────────────────
                    CountDownLatch        CyclicBarrier
  Reusable?         No (one-time)         Yes (reset after trip)
  Who waits?        Any thread            Only the participating threads
  Who counts down?  Any thread            The waiting threads themselves
  Barrier action?   No                    Yes (Runnable at trip point)
  Use case          "Wait for N events"   "All N threads synchronize"
```

### Semaphore — Control Concurrent Access to a Resource

**Use case:** Limit the number of concurrent connections, API calls, or resource accesses.

```java
// Production scenario: Rate-limiting external API calls
@Service
public class ExternalApiClient {
    
    // Only 10 concurrent API calls allowed (rate limit from provider)
    private final Semaphore semaphore = new Semaphore(10);
    
    public ApiResponse callExternalApi(ApiRequest request) {
        try {
            semaphore.acquire();                   // Block if 10 calls in progress
            try {
                return restTemplate.postForObject(API_URL, request, ApiResponse.class);
            } finally {
                semaphore.release();               // Release permit
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted waiting for API permit", e);
        }
    }
    
    // Non-blocking alternative
    public Optional<ApiResponse> tryCallApi(ApiRequest request) {
        if (semaphore.tryAcquire()) {             // Don't block, return Optional.empty
            try {
                return Optional.of(restTemplate.postForObject(API_URL, request, ApiResponse.class));
            } finally {
                semaphore.release();
            }
        }
        return Optional.empty();                   // API at capacity
    }
}
```

```
Semaphore internals (backed by AQS):
  state = N (number of permits)
  acquire() → if state > 0: CAS(state, state-1), proceed
              if state == 0: park thread in CLH queue
  release() → CAS(state, state+1), unpark one waiting thread

Binary Semaphore (permits=1) vs ReentrantLock:
  • Semaphore is NOT reentrant — same thread acquiring twice will deadlock!
  • Semaphore has no "owner" — any thread can release()
  • Use Semaphore for "resource pool" semantics, ReentrantLock for "mutual exclusion"
```

### Phaser — Dynamic Multi-Phase Synchronization

**Use case:** When the number of participating threads may change dynamically, or when processing has multiple phases.

```java
// Production scenario: Multi-phase ETL pipeline
public class EtlPipeline {
    
    public void runPipeline(List<DataFile> files) {
        Phaser phaser = new Phaser(1);  // Register self as coordinator
        
        for (DataFile file : files) {
            phaser.register();  // Dynamically register each worker
            executor.submit(() -> {
                try {
                    // Phase 0: Extract
                    RawData data = extract(file);
                    phaser.arriveAndAwaitAdvance();  // Wait for all extractions
                    
                    // Phase 1: Transform
                    TransformedData transformed = transform(data);
                    phaser.arriveAndAwaitAdvance();  // Wait for all transformations
                    
                    // Phase 2: Load
                    load(transformed);
                    phaser.arriveAndDeregister();    // Done, deregister
                } catch (Exception e) {
                    phaser.arriveAndDeregister();    // Deregister on failure too
                }
            });
        }
        
        phaser.arriveAndDeregister();  // Coordinator deregisters
    }
}
```

### Synchronization Utilities Summary

| Utility | Purpose | Reusable | Typical Use Case |
|---|---|---|---|
| `CountDownLatch` | Wait for N events | No | Startup initialization |
| `CyclicBarrier` | Synchronize N threads at a point | Yes | Iterative parallel algorithms |
| `Semaphore` | Limit concurrent access | Yes | Connection pools, rate limiting |
| `Phaser` | Dynamic multi-phase sync | Yes | Multi-phase processing pipelines |
| `Exchanger` | Two threads swap data | Yes | Pipeline stage handoffs |

## 7.6 JIT Lock Optimizations

The JIT compiler (HotSpot C2) automatically optimizes locking when it can prove it's safe:

```
Lock Coarsening:
────────────────
JIT combines adjacent synchronized blocks on the same object:

Before optimization:            After optimization:
  synchronized(lock) { a++; }     synchronized(lock) {
  synchronized(lock) { b++; }       a++;
  synchronized(lock) { c++; }       b++;
                                    c++;
                                  }
Result: 3 lock/unlock pairs → 1 lock/unlock pair

Lock Elision (Biased Locking):
──────────────────────────────
JIT detects locks that can never be contended (escape analysis):

  void method() {
      StringBuilder sb = new StringBuilder();  // Thread-local object
      sb.append("Hello");                       // sb never escapes this method
      sb.append(" World");                      // sb.append is synchronized internally
      return sb.toString();
  }
  
  JIT eliminates ALL synchronization on sb because it proves
  sb never escapes to another thread. Zero-cost locking!

Lock Striping (Manual technique):
─────────────────────────────────
Split one lock into N locks, each protecting 1/N of the data:
  Before: ONE lock for entire HashMap → all threads contend
  After:  16 locks, each for a range of buckets → 16x less contention
  This is exactly what ConcurrentHashMap does internally.
```

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

## 8.5 ConcurrentHashMap Internals (Java 8+)

Understanding the internal structure helps you know *why* it's so fast and when to expect limitations:

```
ConcurrentHashMap Internal Structure (Java 8+):
────────────────────────────────────────────────

Table (Node[] array):
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ Bin 0│ Bin 1│ Bin 2│ Bin 3│ Bin 4│ Bin 5│ Bin 6│ Bin 7│
└──┬───┘──────┘──┬───┘──────┘──────┘──────┘──┬───┘──────┘
   │             │                            │
   ↓             ↓                            ↓
  [K=A,V=1]    [K=C,V=3]                   [K=F,V=6]
   │             │                            │
   ↓             ↓                            ↓
  [K=B,V=2]    [K=D,V=4]                   [K=G,V=7]
   │                                          │
   ↓                                          ↓
  null                              ☆ TREEIFIED (TreeNode)
                                      if > 8 entries per bin!

Java 8 Changes from Java 7:
───────────────────────────
Java 7: Segment-based locking (16 fixed segments)
Java 8: Per-bin locking with CAS + synchronized on the head node

Put operation flow:
  1. Compute hash → find bin index
  2. If bin is empty → CAS to insert head node (no lock!)
  3. If bin is not empty → synchronized(headNode) {
       - Traverse linked list / tree
       - Insert new node or update value
     }
  4. If bin size > 8 (TREEIFY_THRESHOLD) → convert linked list to Red-Black Tree
  5. If bin size < 6 (UNTREEIFY_THRESHOLD) → convert back to linked list

Get operation (LOCK-FREE!):
  1. Compute hash → find bin
  2. Traverse chain/tree using volatile reads
  3. No locking at all — reads are always lock-free
```

### ConcurrentHashMap Pitfalls

```java
// ❌ PITFALL 1: Non-atomic check-then-act
if (!map.containsKey(key)) {       // Thread A checks: not present
    map.put(key, computeValue());  // Thread B inserts between check and put!
}

// ✅ FIX: Use atomic operations
map.putIfAbsent(key, computeValue());              // Atomic
map.computeIfAbsent(key, k -> computeValue());     // Atomic, lazy computation

// ❌ PITFALL 2: Size is NOT exact (weakly consistent)
int size = map.size();  // May be stale during concurrent modifications

// ❌ PITFALL 3: Null keys/values not allowed (by design)
map.put(null, "value");    // NullPointerException!
map.put("key", null);      // NullPointerException!
// Reason: null is used internally as a sentinel for absent values

// ✅ BEST PRACTICE: Use compute methods for atomic read-modify-write
map.compute(key, (k, v) -> v == null ? 1 : v + 1);  // Atomic increment
map.merge(key, 1, Integer::sum);                      // Atomic merge
```

## 8.6 ConcurrentSkipListMap / ConcurrentSkipListSet

A **sorted**, thread-safe map implementation using skip lists instead of trees. Provides O(log n) operations with good concurrency.

```
Skip List Structure:
────────────────────

Level 2:  HEAD ──────────────────────→ 15 ──────────→ NULL
             │                          │
Level 1:  HEAD ────→ 5 ──────────→ 15 ────→ 25 ──→ NULL
             │       │              │        │
Level 0:  HEAD → 3 → 5 → 8 → 12 → 15 → 25 → 30 → NULL

Properties:
  • Lock-free reads (CAS-based updates)
  • O(log n) get, put, remove
  • SORTED order (unlike ConcurrentHashMap)
  • Supports range queries: subMap(), headMap(), tailMap()
  • NavigableMap interface (ceiling, floor, higher, lower)
```

```java
// When to use ConcurrentSkipListMap vs ConcurrentHashMap:
ConcurrentHashMap<String, Integer> hashMap;     // O(1) get/put, UNSORTED
ConcurrentSkipListMap<String, Integer> skipMap; // O(log n) get/put, SORTED

// Use ConcurrentSkipListMap when you need:
//   - Sorted iteration (by key order)
//   - Range queries (subMap, headMap, tailMap)
//   - NavigableMap operations (ceilingKey, floorKey)
//   - Concurrent sorted set (ConcurrentSkipListSet)

// Production example: Time-series data with range queries
ConcurrentSkipListMap<Instant, Metric> timeSeries = new ConcurrentSkipListMap<>();
timeSeries.put(Instant.now(), new Metric("cpu", 85.2));

// Get all metrics from last 5 minutes (efficient range query!)
NavigableMap<Instant, Metric> recent = timeSeries.tailMap(
    Instant.now().minus(Duration.ofMinutes(5)), true);
```

## 8.7 Choosing the Right Concurrent Collection

```
Decision Flowchart:
───────────────────

Need a Map?
  ├─ Need sorted keys? → ConcurrentSkipListMap
  └─ Don't need sorting? → ConcurrentHashMap (always)

Need a List?
  ├─ Read-heavy, small list, rare writes? → CopyOnWriteArrayList
  └─ Write-heavy or large list? → Use ConcurrentHashMap or synchronize manually

Need a Queue?
  ├─ Need blocking (producer-consumer)?
  │   ├─ Need bounded capacity? → ArrayBlockingQueue
  │   ├─ Need priority ordering? → PriorityBlockingQueue
  │   ├─ Need direct handoff (no buffer)? → SynchronousQueue
  │   └─ General purpose? → LinkedBlockingQueue
  └─ Non-blocking?
      └─ ConcurrentLinkedQueue

Need a Set?
  ├─ Need sorted? → ConcurrentSkipListSet
  └─ Unordered? → ConcurrentHashMap.newKeySet()
      (or Collections.newSetFromMap(new ConcurrentHashMap<>()))
```

---

