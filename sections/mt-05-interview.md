
# Chapter 18: Interview Questions (60+)

---

## BEGINNER LEVEL (Q1–Q15)

**Q1. What is the difference between a process and a thread?**
A process is an independent program with its own memory space. A thread is a lightweight execution unit within a process that shares the heap with other threads but has its own stack. Thread creation is cheaper (~1MB) vs process creation (full memory allocation).

**Q2. What are the two ways to create a thread in Java?**
1) Extend `Thread` class and override `run()`. 2) Implement `Runnable` interface and pass to `Thread` constructor. Implementing `Runnable` is preferred because Java allows only single inheritance, and it separates the task from the thread mechanism.

**Q3. What is the difference between `start()` and `run()`?**
`start()` creates a new OS thread and calls `run()` in that new thread. Calling `run()` directly executes it in the current thread — no new thread is created. Always use `start()`.

**Q4. What are the thread states in Java?**
NEW (created, not started), RUNNABLE (executing or ready), BLOCKED (waiting for monitor lock), WAITING (waiting indefinitely for notification), TIMED_WAITING (waiting with timeout), TERMINATED (completed execution).

**Q5. What is the difference between `Runnable` and `Callable`?**
`Runnable.run()` returns void and cannot throw checked exceptions. `Callable.call()` returns a value and can throw checked exceptions. Callable is used with `ExecutorService.submit()` and `Future`.

**Q6. What is `Thread.sleep()`?**
Static method that pauses the current thread for the specified duration. The thread does NOT release any locks it holds. Throws `InterruptedException`.

**Q7. What is `Thread.join()`?**
Causes the calling thread to wait until the target thread terminates. `t.join()` blocks until thread `t` finishes. Can specify timeout: `t.join(5000)`.

**Q8. What is `Thread.yield()`?**
Hints to the scheduler that the current thread is willing to give up its CPU time. The scheduler may ignore this hint. Rarely used in practice.

**Q9. What is a daemon thread?**
A background thread that doesn't prevent JVM shutdown. When all non-daemon threads finish, the JVM terminates (killing all daemon threads). Set via `thread.setDaemon(true)` before `start()`. Example: garbage collector.

**Q10. What is the `volatile` keyword?**
Ensures visibility of variable changes across threads by reading/writing directly to main memory (not CPU cache). Does NOT provide atomicity for compound operations like `count++`.

**Q11. What is thread safety?**
Code that functions correctly when accessed by multiple threads concurrently, without data corruption or unexpected behavior. Achieved via synchronization, immutable objects, thread-local storage, or atomic classes.

**Q12. What is a race condition?**
When the outcome depends on the unpredictable order of thread execution accessing shared mutable state. Example: two threads incrementing the same counter simultaneously.

**Q13. What is the `synchronized` keyword?**
Provides mutual exclusion — only one thread can execute a synchronized block/method at a time for a given lock object. Uses the object's intrinsic monitor lock.

**Q14. What is the difference between synchronized method and synchronized block?**
Synchronized method locks `this` (or `Class` for static). Synchronized block can lock any object and only protects a specific code section — more granular, better performance.

**Q15. What is `InterruptedException`?**
Thrown when a thread that is sleeping, waiting, or blocked is interrupted via `Thread.interrupt()`. The thread should handle this by either terminating or restoring the interrupt flag: `Thread.currentThread().interrupt()`.

---

## INTERMEDIATE LEVEL (Q16–Q35)

**Q16. What is a deadlock? How to prevent it?**
Two or more threads permanently blocked, each waiting for a lock held by the other. Prevention: consistent lock ordering, tryLock with timeout, avoid nested locks, use concurrent utilities.

**Q17. What is the difference between `wait()`, `notify()`, and `notifyAll()`?**
`wait()` releases the monitor lock and suspends the thread until notified. `notify()` wakes one arbitrary waiting thread. `notifyAll()` wakes all waiting threads. Must be called inside `synchronized` block.

**Q18. Why should `wait()` be called in a while loop?**
To guard against **spurious wakeups** — a thread can wake up without being notified. The while loop re-checks the condition:
```java
while (!condition) { wait(); }
```

**Q19. What is `ReentrantLock`?**
A lock implementation with capabilities beyond `synchronized`: tryLock (non-blocking), tryLock with timeout, interruptible locking, fairness policy, and multiple Condition objects.

**Q20. What is the difference between `ReentrantLock` and `synchronized`?**

| Feature | synchronized | ReentrantLock |
|---|---|---|
| tryLock | No | Yes |
| Timeout | No | Yes |
| Interruptible | No | Yes |
| Fairness | No | Configurable |
| Conditions | 1 (wait/notify) | Multiple |
| Requires finally | No (auto-release) | Yes (manual unlock) |

**Q21. What is `ReadWriteLock`?**
Allows multiple concurrent readers OR one exclusive writer. `ReentrantReadWriteLock` is the standard implementation. Improves throughput for read-heavy scenarios.

**Q22. What is `ThreadLocal`?**
Provides per-thread copies of a variable. Each thread has its own isolated value. Used for request context, user sessions, database connections. Must call `remove()` in thread pools to avoid memory leaks.

**Q23. What is the `ExecutorService`?**
A framework for managing thread pools. Decouples task submission from thread management. Provides `submit()`, `execute()`, `shutdown()`, `awaitTermination()`.

**Q24. What are the types of thread pools?**
`FixedThreadPool` (fixed threads, unbounded queue), `CachedThreadPool` (elastic, 60s idle timeout), `SingleThreadExecutor` (sequential execution), `ScheduledThreadPool` (delayed/periodic tasks).

**Q25. What is `ThreadPoolExecutor` and its parameters?**
Core pool size, max pool size, keep-alive time, work queue, thread factory, rejection handler. Tasks first fill core threads, then queue, then create up to max threads, then reject.

**Q26. What is the difference between `submit()` and `execute()`?**
`execute(Runnable)` returns void, exceptions are uncaught. `submit(Callable/Runnable)` returns `Future`, exceptions are captured and thrown on `future.get()`.

**Q27. What is `CompletableFuture`?**
Java 8 non-blocking async programming. Supports chaining (thenApply), composition (thenCompose), combining (thenCombine), error handling (exceptionally), and multi-future coordination (allOf, anyOf).

**Q28. What is the difference between `thenApply` and `thenCompose`?**
`thenApply(f)`: transforms result synchronously, `f: T → U`. `thenCompose(f)`: chains async operations, `f: T → CompletableFuture<U>`. thenCompose is like flatMap, thenApply is like map.

**Q29. What is `ConcurrentHashMap`?**
Thread-safe HashMap. Java 8+ uses CAS for empty bins, per-bin synchronized for occupied bins. No null keys/values. Provides atomic operations: `computeIfAbsent`, `merge`, `compute`.

**Q30. What is `CopyOnWriteArrayList`?**
Thread-safe List where every write creates a new array copy. Reads are lock-free. Best for read-heavy, write-rare scenarios (event listeners, configuration). Iteration is snapshot-based (no CME).

**Q31. What is `BlockingQueue`?**
A Queue that blocks `put()` when full and `take()` when empty. Implementations: `ArrayBlockingQueue` (bounded), `LinkedBlockingQueue` (optionally bounded), `SynchronousQueue` (handoff).

**Q32. What is the `AtomicInteger` class?**
Provides atomic operations (incrementAndGet, compareAndSet) on an int variable using CAS hardware instructions. No locking needed:
```java
AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet(); // Thread-safe, lock-free
```

**Q33. What are `CountDownLatch` and `CyclicBarrier`?**
`CountDownLatch`: One-time barrier. Threads wait until count reaches zero. Cannot be reset. Use: wait for N services to start.
`CyclicBarrier`: Reusable barrier. Threads wait for each other, then proceed together. Use: parallel iterative algorithms.

**Q34. What is `Semaphore`?**
Controls access to a resource with a limited number of permits. `acquire()` gets a permit (blocks if none available), `release()` returns a permit. Use: connection pools, rate limiting.

**Q35. What is the `Phaser` class?**
A reusable synchronization barrier supporting a variable number of parties. More flexible than CyclicBarrier. Supports multiple phases of execution.

---

## ADVANCED LEVEL (Q36–Q50)

**Q36. What is `StampedLock` and how does optimistic locking work?**
StampedLock provides three modes: write lock, read lock, and optimistic read. Optimistic read takes no lock — gets a stamp, reads data, then validates the stamp. If a write occurred, falls back to a full read lock. Best for read-dominated workloads.

**Q37. Explain the Fork/Join Framework and work-stealing algorithm.**
ForkJoinPool uses divide-and-conquer: tasks split into subtasks (fork), execute in parallel, combine results (join). Work-stealing: idle threads steal tasks from busy threads' double-ended queues, balancing load automatically.

**Q38. What happens internally when `CompletableFuture.supplyAsync()` is called?**
Creates a CompletableFuture, wraps the Supplier in an AsyncSupply task, submits to ForkJoinPool.commonPool() (or custom executor). When the task completes, the result is stored and dependent stages are triggered.

**Q39. Why are virtual threads (Java 21) important?**
Virtual threads are lightweight (few KB vs 1MB for platform threads). Millions can exist simultaneously. They eliminate the need for reactive programming for IO-bound tasks by making blocking calls cheap. JVM manages scheduling on carrier threads.

**Q40. What is the happens-before relationship in JMM?**
The Java Memory Model defines ordering guarantees:
- Monitor unlock happens-before subsequent lock of same monitor
- Volatile write happens-before subsequent read of same variable
- Thread.start() happens-before any action in the started thread
- Thread termination happens-before join() returns

**Q41. What is false sharing and how to avoid it?**
When two threads modify different variables that reside on the same CPU cache line (64 bytes), both cores invalidate their cache lines. Fix: use `@Contended` annotation or pad variables with extra fields.

**Q42. What is thread starvation?**
A thread cannot get CPU time because higher-priority threads dominate. Causes: unfair locks, priority scheduling, resource hogging. Prevention: fair locks, bounded pools, priority balancing.

**Q43. Explain CAS (Compare-And-Swap) mechanism.**
An atomic CPU instruction: `CAS(memory, expected, new)` — if current value == expected, set to new. Returns success/failure. Used by AtomicInteger, ConcurrentHashMap, and lock-free algorithms. ABA problem is a known caveat.

**Q44. What is the ABA problem?**
Thread reads value A, another thread changes A→B→A, first thread's CAS succeeds thinking nothing changed. Solution: `AtomicStampedReference` with a version stamp.

**Q45. How does `ConcurrentHashMap` handle resizing?**
Uses `ForwardingNode` markers indicating migration. Multiple threads can help transfer buckets. Reads remain unblocked during resize. Each bin is migrated independently.

**Q46. What is `LongAdder` and when to use it over `AtomicLong`?**
`LongAdder` distributes writes across multiple cells, reducing contention. Better for high-contention counters where frequent updates happen from many threads. Sum is computed by adding all cells.

**Q47. How does `parallelStream()` work internally?**
Uses Spliterator to split the source into chunks. Each chunk is submitted to ForkJoinPool.commonPool(). The collector's combiner merges results. Thread count = available processors.

**Q48. What are memory barriers/fences?**
CPU instructions that enforce ordering of memory operations. Prevent compiler/CPU reordering. Volatile reads/writes insert memory barriers. StoreStore, LoadLoad, LoadStore, StoreLoad barriers.

**Q49. Explain the difference between `CountDownLatch`, `CyclicBarrier`, `Phaser`, and `Semaphore`.**

| Feature | CountDownLatch | CyclicBarrier | Phaser | Semaphore |
|---|---|---|---|---|
| Reusable | No | Yes | Yes | N/A |
| Parties | Fixed | Fixed | Dynamic | N/A |
| Action at barrier | No | Optional | Optional | N/A |
| Use case | Wait for N events | Sync N threads | Multi-phase sync | Permit-based access |

**Q50. How to monitor thread pool health in production?**
```java
ThreadPoolExecutor pool = (ThreadPoolExecutor) executor;
pool.getActiveCount();        // Currently executing threads
pool.getPoolSize();           // Current pool size
pool.getQueue().size();       // Tasks waiting in queue
pool.getCompletedTaskCount(); // Tasks completed
pool.getLargestPoolSize();    // Peak thread count
```
Expose via Spring Actuator or Micrometer metrics.

---

## ARCHITECT LEVEL (Q51–Q65)

**Q51. Design a high-throughput event processing system using Java concurrency.**
Use multiple BlockingQueues (one per partition) → consumer threads per queue → ConcurrentHashMap for deduplication → CompletableFuture for async persistence → separate executor for IO. Monitor queue depths and consumer lag.

**Q52. How would you implement a rate limiter using Java concurrency primitives?**
Use `ConcurrentHashMap<String, Deque<Instant>>` for sliding window. Each request adds timestamp, removes expired ones, checks count ≤ limit. Use `Semaphore` for simpler fixed-rate limiting.

**Q53. When would you choose reactive programming (WebFlux) over CompletableFuture?**
WebFlux for very high concurrency with many IO-bound operations (10K+ concurrent connections). CompletableFuture for moderate concurrency, blocking IO that's hard to rewrite, or when team expertise is in imperative style.

**Q54. How to handle thread safety in a distributed caching layer?**
Local: ConcurrentHashMap with read/write separation. Cross-node: distributed locks (Redis/Zookeeper). Cache invalidation: pub/sub events. Consistency: cache-aside pattern with TTL. Bulk operations: StampedLock for read-heavy access.

**Q55. Design a circuit breaker using thread-safe collections.**
```java
ConcurrentHashMap<String, AtomicInteger> failureCounts;
ConcurrentHashMap<String, Instant> lastFailureTime;
ConcurrentHashMap<String, CircuitState> circuitStates;
// States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
```

**Q56. How do you tune thread pools for a microservice handling both CPU and IO work?**
Create separate pools: CPU pool (size = cores), IO pool (size = cores × (1 + W/C)). Use CallerRunsPolicy for backpressure. Monitor with metrics. Adjust based on load testing results.

**Q57. What is the impact of context switching on system performance?**
Each context switch costs 1-10μs. At 10,000 threads with frequent switching, that's 10-100ms overhead per second. Solution: right-size thread pools, use non-blocking IO, virtual threads (Java 21+).

**Q58. How to implement graceful shutdown in a multithreaded Spring Boot application?**
```java
@PreDestroy
public void shutdown() {
    executor.shutdown(); // Stop accepting new tasks
    try {
        if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
            executor.shutdownNow(); // Force shutdown
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }
    } catch (InterruptedException e) {
        executor.shutdownNow();
    }
}
```

**Q59. How to debug a production deadlock?**
1) Get thread dump: `jstack <PID>` or JMX ThreadMXBean. 2) Look for "Found N deadlocks" in output. 3) Identify the lock ordering issue. 4) Fix with consistent ordering or tryLock. 5) Add deadlock detection monitoring.

**Q60. What are the trade-offs between lock-based and lock-free concurrency?**
Lock-based: simpler code, works everywhere, but contention reduces throughput. Lock-free (CAS): higher throughput under contention, no deadlocks, but harder to implement correctly, ABA problem, spin-wait overhead.

**Q61. How to implement a thread-safe connection pool?**
Use a BlockingQueue of connections. `take()` acquires (blocks if none available). `put()` returns. MaxPoolSize = queue capacity. Use Semaphore for bounded permits. Add health check and idle timeout eviction.

**Q62. Compare `synchronized`, `ReentrantLock`, `StampedLock`, and `ConcurrentHashMap` for a shared cache.**
- Low contention: `synchronized` (simplest)
- Medium contention, need tryLock: `ReentrantLock`
- Read-heavy: `StampedLock` (optimistic reads) or `ReentrantReadWriteLock`
- Key-value store: `ConcurrentHashMap` (built-in thread safety, atomic ops)

**Q63. How do virtual threads (Java 21) change concurrency architecture?**
No more thread pool sizing games. One virtual thread per request. Blocking IO becomes cheap. Can have millions of concurrent VTs. No need for reactive frameworks for IO-bound work. Platform threads still better for CPU-bound work.

**Q64. How would you test multithreaded code?**
Use `CountDownLatch` to synchronize thread starts. Use `CyclicBarrier` for stress testing. Use `AtomicReference` to capture exceptions. Use jcstress for correctness testing. Use JMH for performance benchmarks.

**Q65. How to prevent memory leaks in concurrent applications?**
Clear ThreadLocal variables after use. Weak references in caches (WeakHashMap). Bounded collections with eviction. Properly shut down executors. Monitor with heap dumps and profilers.

---

## SCENARIO-BASED (Q66–Q80)

**Q66. A production Spring Boot app becomes unresponsive under load, but CPU usage is only 5%. What's your debugging approach?**
Low CPU + unresponsive = threads waiting on something (locks, IO, connections). Steps: 1) Take 3 thread dumps 10s apart. 2) Count BLOCKED and WAITING threads. 3) If many BLOCKED → lock contention (find the lock). 4) If many WAITING on connection pool → pool exhaustion (increase pool or add timeouts). 5) Check HikariCP metrics for connection leaks.

**Q67. Your team wants to use parallelStream() for batch database inserts. What's your advice?**
DON'T do it. parallelStream() uses ForkJoinPool.commonPool() which is shared across the entire JVM. Blocking DB calls will starve ALL other parallel streams. Instead, use a dedicated ExecutorService with CompletableFuture, or batch the inserts into chunks and use JDBC batch operations.

**Q68. You have a microservice making 5 REST calls to downstream services. Currently sequential (2.5s total). How to optimize?**
Use CompletableFuture with a custom IO executor: `CompletableFuture.allOf(call1, call2, call3, call4, call5)` runs all in parallel. Total time ≈ max of individual calls (~500ms instead of 2.5s). Always use `completeOnTimeout()` for each call. If one fails, use `exceptionally()` with fallback.

**Q69. What would happen if you used `Executors.newCachedThreadPool()` in a HTTP API handler?**
Under load spike, each request creates a new thread (since cached threads are reused only if idle ≤60s). A burst of 50,000 requests → 50,000 threads → ~50GB memory → OutOfMemoryError. Always use `newFixedThreadPool()` or `ThreadPoolExecutor` with bounded queue.

**Q70. You observe intermittent NullPointerException in production, but the code looks correct in single-threaded analysis. What could cause this?**
Race condition on a shared reference: Thread A reads the object, Thread B sets it to null between read and use. Or: instruction reordering — an object reference published before the constructor finishes (broken double-checked locking without volatile). Fix: make the reference volatile, use AtomicReference, or use proper synchronization.

**Q71. A thread dump shows 150 threads in BLOCKED state all waiting on `OrderService.processOrder()`. What's happening?**
The `processOrder()` method is likely synchronized on a single lock (or uses a synchronized method), creating a bottleneck. Solutions: 1) Reduce synchronized scope. 2) Use ConcurrentHashMap instead of synchronized HashMap. 3) Use read-write lock if mostly reads. 4) Consider lock-free alternatives.

**Q72. Your application has 200 Tomcat threads and a HikariCP pool of 10. What happens when all 200 threads need DB access?**
190 threads will wait for a connection (only 10 available). If `connectionTimeout` is not set, they wait forever → request timeouts cascade. Fix: 1) Size connection pool appropriately (but more connections = more DB load). 2) Set `connection-timeout=5000` to fail fast. 3) Use `leak-detection-threshold` to catch leaks.

**Q73. When should you use virtual threads vs reactive programming vs traditional thread pools?**
Virtual threads (Java 21+): Simple blocking IO code, need to handle many concurrent requests, team prefers imperative style. Reactive (WebFlux): Need full backpressure, streaming data pipelines, already have reactive team. Traditional pools: CPU-bound work, legacy systems, need fine-grained control over concurrency.

**Q74. A CountDownLatch with count 5 hangs forever in production. What happened?**
One of the 5 tasks threw an uncaught exception before calling `countDown()`. The latch stays at count > 0 forever. Fix: Always call `countDown()` in a finally block, OR use `latch.await(30, TimeUnit.SECONDS)` with a timeout.

**Q75. You need to implement a cache that refreshes every 5 minutes. How to make it thread-safe?**
Use `AtomicReference<CacheData>` with a scheduled task. The scheduler calls `cacheRef.set(loadFreshData())` atomically. All readers call `cacheRef.get()` (lock-free). Alternatively, use `ConcurrentHashMap.computeIfAbsent()` with TTL-based expiry, or use Caffeine cache (`LoadingCache`).

**Q76. What happens if you use `synchronized` keyword inside virtual threads?**
Virtual threads PIN to the carrier (platform) thread when inside synchronized blocks. The carrier cannot be reused until the synchronized block completes. Under load, this can exhaust all carrier threads. Fix: Replace synchronized with ReentrantLock, which virtual threads can unmount from.

**Q77. How would you design a thread-safe audit log system that doesn't slow down the main request?**
Use a producer-consumer pattern: Main thread submits audit events to a `LinkedBlockingQueue` (non-blocking `offer()`). Background consumers `take()` from queue and batch-insert to DB every 5 seconds. Use `ConcurrentLinkedQueue` if you can't afford any blocking on the producer side.

**Q78. Your thread pool monitoring shows queue size keeps growing but completed task count is stable. What's wrong?**
Producers are faster than consumers. Either: 1) Tasks are slow (check for blocking calls or resource contention). 2) Pool is undersized for the workload. 3) Tasks are deadlocking. Take a thread dump to see what worker threads are doing. Increase pool size or optimize task execution.

**Q79. How do you test that a class is thread-safe in unit tests?**
```java
@RepeatedTest(10)  // Run 10 times to catch intermittent failures
void testConcurrentAccess() throws InterruptedException {
    ThreadSafeList<String> list = new ThreadSafeList<>();
    int threads = 100;
    CountDownLatch ready = new CountDownLatch(threads);
    CountDownLatch go = new CountDownLatch(1);
    CountDownLatch done = new CountDownLatch(threads);

    for (int i = 0; i < threads; i++) {
        final int idx = i;
        new Thread(() -> {
            ready.countDown();
            try { go.await(); } catch (InterruptedException e) {}
            list.add("item-" + idx);
            done.countDown();
        }).start();
    }

    ready.await();  // All threads ready
    go.countDown(); // Release all at once
    done.await();   // Wait for all to finish

    assertEquals(threads, list.size());  // Must always be 100
}
```

**Q80. You're reviewing a PR that uses `Collections.synchronizedMap(new HashMap<>())`. What feedback would you give?**
1) Replace with `ConcurrentHashMap` for better performance (per-bin locking vs whole-map locking). 2) Even with synchronizedMap, compound operations like `if(!map.containsKey(k)) map.put(k,v)` are NOT atomic — still needs external synchronization or `computeIfAbsent()`. 3) Iteration requires manual synchronization with synchronizedMap but not with ConcurrentHashMap.

---

# Chapter 19: Coding Problems (20 Exercises)

## Exercise 1: Producer-Consumer with BlockingQueue

```java
public class ProducerConsumer {
    private final BlockingQueue<Integer> queue = new ArrayBlockingQueue<>(10);
    
    public void produce() throws InterruptedException {
        for (int i = 0; i < 100; i++) {
            queue.put(i);
            System.out.println("Produced: " + i);
        }
        queue.put(-1); // Poison pill
    }
    
    public void consume() throws InterruptedException {
        while (true) {
            int val = queue.take();
            if (val == -1) break; // Poison pill
            System.out.println("Consumed: " + val);
            Thread.sleep(100);
        }
    }
    
    public static void main(String[] args) {
        ProducerConsumer pc = new ProducerConsumer();
        new Thread(() -> { try { pc.produce(); } catch (InterruptedException e) {} }).start();
        new Thread(() -> { try { pc.consume(); } catch (InterruptedException e) {} }).start();
    }
}
```

## Exercise 2: Thread-Safe Singleton (Enum-Based)

```java
public enum ConfigManager {
    INSTANCE;
    
    private final Map<String, String> config = new ConcurrentHashMap<>();
    
    ConfigManager() {
        config.put("db.host", "localhost");
        config.put("db.port", "5432");
    }
    
    public String get(String key) {
        return config.get(key);
    }
    
    public void set(String key, String value) {
        config.put(key, value);
    }
}
```

## Exercise 3: Print Numbers 1-100 Using Two Alternating Threads

```java
public class AlternateThreads {
    private final Object lock = new Object();
    private volatile boolean oddTurn = true;
    
    public void printOdd() {
        for (int i = 1; i <= 99; i += 2) {
            synchronized (lock) {
                while (!oddTurn) {
                    try { lock.wait(); } catch (InterruptedException e) {}
                }
                System.out.println(Thread.currentThread().getName() + ": " + i);
                oddTurn = false;
                lock.notify();
            }
        }
    }
    
    public void printEven() {
        for (int i = 2; i <= 100; i += 2) {
            synchronized (lock) {
                while (oddTurn) {
                    try { lock.wait(); } catch (InterruptedException e) {}
                }
                System.out.println(Thread.currentThread().getName() + ": " + i);
                oddTurn = true;
                lock.notify();
            }
        }
    }
    
    public static void main(String[] args) {
        AlternateThreads at = new AlternateThreads();
        new Thread(at::printOdd, "OddThread").start();
        new Thread(at::printEven, "EvenThread").start();
    }
}
```

## Exercise 4: Thread-Safe Counter with AtomicInteger

```java
public class ThreadSafeCounter {
    private final AtomicInteger count = new AtomicInteger(0);
    
    public void increment() { count.incrementAndGet(); }
    public void decrement() { count.decrementAndGet(); }
    public int get() { return count.get(); }
    
    public static void main(String[] args) throws InterruptedException {
        ThreadSafeCounter counter = new ThreadSafeCounter();
        int threads = 100;
        CountDownLatch latch = new CountDownLatch(threads);
        
        for (int i = 0; i < threads; i++) {
            new Thread(() -> {
                for (int j = 0; j < 1000; j++) counter.increment();
                latch.countDown();
            }).start();
        }
        
        latch.await();
        System.out.println("Final count: " + counter.get()); // Always 100,000
    }
}
```

## Exercise 5: Parallel API Aggregation with CompletableFuture

```java
public class ParallelApiCall {
    
    public static Map<String, Object> aggregateData(Long userId) {
        ExecutorService executor = Executors.newFixedThreadPool(3);
        
        CompletableFuture<String> profileFuture = CompletableFuture
            .supplyAsync(() -> fetchProfile(userId), executor);
        CompletableFuture<List<String>> ordersFuture = CompletableFuture
            .supplyAsync(() -> fetchOrders(userId), executor);
        CompletableFuture<Double> balanceFuture = CompletableFuture
            .supplyAsync(() -> fetchBalance(userId), executor);
        
        CompletableFuture.allOf(profileFuture, ordersFuture, balanceFuture).join();
        
        Map<String, Object> result = new HashMap<>();
        result.put("profile", profileFuture.join());
        result.put("orders", ordersFuture.join());
        result.put("balance", balanceFuture.join());
        
        executor.shutdown();
        return result;
    }
    
    private static String fetchProfile(Long id) { 
        sleep(200); return "User-" + id; 
    }
    private static List<String> fetchOrders(Long id) { 
        sleep(300); return List.of("ORD-1", "ORD-2"); 
    }
    private static Double fetchBalance(Long id) { 
        sleep(150); return 999.99; 
    }
    private static void sleep(long ms) { 
        try { Thread.sleep(ms); } catch (InterruptedException e) {} 
    }
}
```

## Exercise 6: Dining Philosophers (Deadlock Avoidance)

```java
public class DiningPhilosophers {
    private final ReentrantLock[] forks;
    
    public DiningPhilosophers(int n) {
        forks = new ReentrantLock[n];
        for (int i = 0; i < n; i++) forks[i] = new ReentrantLock();
    }
    
    public void eat(int philosopher) {
        int left = philosopher;
        int right = (philosopher + 1) % forks.length;
        
        // Lock ordering: always pick lower-numbered fork first
        int first = Math.min(left, right);
        int second = Math.max(left, right);
        
        forks[first].lock();
        try {
            forks[second].lock();
            try {
                System.out.println("Philosopher " + philosopher + " is eating");
                Thread.sleep(100);
            } catch (InterruptedException e) {
            } finally {
                forks[second].unlock();
            }
        } finally {
            forks[first].unlock();
        }
    }
}
```

## Exercise 7: Read-Write Cache

```java
public class ReadWriteCache<K, V> {
    private final Map<K, V> cache = new HashMap<>();
    private final ReadWriteLock rwLock = new ReentrantReadWriteLock();
    
    public V get(K key) {
        rwLock.readLock().lock();
        try { return cache.get(key); } 
        finally { rwLock.readLock().unlock(); }
    }
    
    public void put(K key, V value) {
        rwLock.writeLock().lock();
        try { cache.put(key, value); } 
        finally { rwLock.writeLock().unlock(); }
    }
    
    public int size() {
        rwLock.readLock().lock();
        try { return cache.size(); } 
        finally { rwLock.readLock().unlock(); }
    }
}
```

## Exercise 8: Countdown Start (Wait for All Threads Ready)

```java
public class RaceSimulation {
    public static void main(String[] args) throws InterruptedException {
        int runners = 5;
        CountDownLatch readyLatch = new CountDownLatch(runners);
        CountDownLatch startLatch = new CountDownLatch(1);
        
        for (int i = 0; i < runners; i++) {
            final int id = i;
            new Thread(() -> {
                System.out.println("Runner " + id + " ready");
                readyLatch.countDown();
                try {
                    startLatch.await(); // All wait for start signal
                    System.out.println("Runner " + id + " started at " + System.nanoTime());
                } catch (InterruptedException e) {}
            }).start();
        }
        
        readyLatch.await(); // Wait for all runners to be ready
        System.out.println("GO!");
        startLatch.countDown(); // Start all at once
    }
}
```

## Exercise 9: Bounded Thread-Safe Queue

```java
public class BoundedQueue<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;
    private final Semaphore empty;
    private final Semaphore full;
    private final Lock lock = new ReentrantLock();
    
    public BoundedQueue(int capacity) {
        this.capacity = capacity;
        this.empty = new Semaphore(capacity);
        this.full = new Semaphore(0);
    }
    
    public void put(T item) throws InterruptedException {
        empty.acquire();
        lock.lock();
        try { queue.offer(item); }
        finally { lock.unlock(); }
        full.release();
    }
    
    public T take() throws InterruptedException {
        full.acquire();
        lock.lock();
        T item;
        try { item = queue.poll(); }
        finally { lock.unlock(); }
        empty.release();
        return item;
    }
}
```

## Exercise 10: Parallel Word Frequency Counter

```java
public class ParallelWordCounter {
    
    public static Map<String, Long> count(List<String> documents) {
        return documents.parallelStream()
            .flatMap(doc -> Arrays.stream(doc.toLowerCase().split("\\W+")))
            .filter(w -> !w.isEmpty())
            .collect(Collectors.groupingBy(Function.identity(),
                ConcurrentHashMap::new, Collectors.counting()));
    }
}
```

## Exercise 11: Scheduled Task Executor

```java
public class TaskScheduler {
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(3);
    
    public ScheduledFuture<?> scheduleOnce(Runnable task, long delay, TimeUnit unit) {
        return scheduler.schedule(task, delay, unit);
    }
    
    public ScheduledFuture<?> scheduleRepeating(Runnable task, long period, TimeUnit unit) {
        return scheduler.scheduleAtFixedRate(task, 0, period, unit);
    }
    
    public void shutdown() {
        scheduler.shutdown();
    }
}
```

## Exercise 12: Thread Barrier Example

```java
public class MatrixProcessor {
    public static void processInPhases(int workers) throws Exception {
        CyclicBarrier barrier = new CyclicBarrier(workers, () -> 
            System.out.println("--- Phase complete, all workers synchronized ---"));
        
        for (int i = 0; i < workers; i++) {
            final int id = i;
            new Thread(() -> {
                try {
                    System.out.println("Worker " + id + " phase 1");
                    barrier.await(); // Wait for all to complete phase 1
                    System.out.println("Worker " + id + " phase 2");
                    barrier.await(); // Wait for all to complete phase 2
                } catch (Exception e) {}
            }).start();
        }
    }
}
```

## Exercise 13: Future Timeout Handler

```java
public class TimeoutHandler {
    
    public static <T> T executeWithTimeout(Callable<T> task, long timeout, 
                                           TimeUnit unit, T fallback) {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Future<T> future = executor.submit(task);
        try {
            return future.get(timeout, unit);
        } catch (TimeoutException e) {
            future.cancel(true);
            return fallback;
        } catch (Exception e) {
            return fallback;
        } finally {
            executor.shutdown();
        }
    }
}
```

## Exercise 14: Thread-Safe Stack

```java
public class ConcurrentStack<T> {
    private final Deque<T> stack = new ArrayDeque<>();
    private final ReentrantLock lock = new ReentrantLock();
    
    public void push(T item) {
        lock.lock();
        try { stack.push(item); }
        finally { lock.unlock(); }
    }
    
    public T pop() {
        lock.lock();
        try { return stack.isEmpty() ? null : stack.pop(); }
        finally { lock.unlock(); }
    }
    
    public T peek() {
        lock.lock();
        try { return stack.isEmpty() ? null : stack.peek(); }
        finally { lock.unlock(); }
    }
}
```

## Exercise 15: Parallel File Search

```java
public class ParallelFileSearch {
    
    public static List<Path> search(Path root, String pattern) throws Exception {
        ForkJoinPool pool = new ForkJoinPool();
        return pool.invoke(new FileSearchTask(root, pattern));
    }
    
    static class FileSearchTask extends RecursiveTask<List<Path>> {
        private final Path dir;
        private final String pattern;
        
        FileSearchTask(Path dir, String pattern) {
            this.dir = dir;
            this.pattern = pattern;
        }
        
        @Override
        protected List<Path> compute() {
            List<Path> results = new ArrayList<>();
            List<FileSearchTask> subTasks = new ArrayList<>();
            
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
                for (Path path : stream) {
                    if (Files.isDirectory(path)) {
                        FileSearchTask subTask = new FileSearchTask(path, pattern);
                        subTasks.add(subTask);
                        subTask.fork();
                    } else if (path.getFileName().toString().contains(pattern)) {
                        results.add(path);
                    }
                }
            } catch (IOException e) {}
            
            for (FileSearchTask task : subTasks) {
                results.addAll(task.join());
            }
            return results;
        }
    }
}
```

## Exercise 16: Async Pipeline with Error Handling

```java
public class AsyncPipeline {
    
    public CompletableFuture<OrderResult> processOrder(OrderRequest request) {
        return CompletableFuture.supplyAsync(() -> validateOrder(request))
            .thenApplyAsync(validated -> calculatePrice(validated))
            .thenComposeAsync(priced -> 
                CompletableFuture.supplyAsync(() -> processPayment(priced)))
            .thenApplyAsync(paid -> sendConfirmation(paid))
            .handle((result, ex) -> {
                if (ex != null) {
                    logError(ex);
                    return OrderResult.failed(ex.getMessage());
                }
                return result;
            });
    }
}
```

## Exercise 17: Multi-Producer Multi-Consumer

```java
public class MultiProducerConsumer {
    
    public static void main(String[] args) {
        BlockingQueue<String> queue = new LinkedBlockingQueue<>(50);
        ExecutorService producers = Executors.newFixedThreadPool(3);
        ExecutorService consumers = Executors.newFixedThreadPool(5);
        
        // 3 producers
        for (int i = 0; i < 3; i++) {
            final int id = i;
            producers.submit(() -> {
                for (int j = 0; j < 100; j++) {
                    try {
                        queue.put("P" + id + "-Item" + j);
                    } catch (InterruptedException e) { break; }
                }
            });
        }
        
        // 5 consumers
        for (int i = 0; i < 5; i++) {
            final int id = i;
            consumers.submit(() -> {
                while (!Thread.currentThread().isInterrupted()) {
                    try {
                        String item = queue.poll(2, TimeUnit.SECONDS);
                        if (item == null) break;
                        System.out.println("C" + id + " consumed: " + item);
                    } catch (InterruptedException e) { break; }
                }
            });
        }
        
        producers.shutdown();
        consumers.shutdown();
    }
}
```

## Exercise 18: Deadlock Detection Utility

```java
public class DeadlockDetector {
    
    public static void startMonitoring(long interval) {
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(() -> {
            ThreadMXBean bean = ManagementFactory.getThreadMXBean();
            long[] deadlocked = bean.findDeadlockedThreads();
            if (deadlocked != null) {
                System.err.println("DEADLOCK DETECTED!");
                ThreadInfo[] infos = bean.getThreadInfo(deadlocked, true, true);
                for (ThreadInfo info : infos) {
                    System.err.println(info);
                }
            }
        }, 0, interval, TimeUnit.SECONDS);
    }
}
```

## Exercise 19: Rate Limiter

```java
public class SlidingWindowRateLimiter {
    private final ConcurrentHashMap<String, Deque<Long>> windows = new ConcurrentHashMap<>();
    private final int maxRequests;
    private final long windowMs;
    
    public SlidingWindowRateLimiter(int maxRequests, Duration window) {
        this.maxRequests = maxRequests;
        this.windowMs = window.toMillis();
    }
    
    public synchronized boolean isAllowed(String clientId) {
        long now = System.currentTimeMillis();
        Deque<Long> timestamps = windows.computeIfAbsent(clientId, k -> new ArrayDeque<>());
        
        while (!timestamps.isEmpty() && now - timestamps.peekFirst() > windowMs) {
            timestamps.pollFirst();
        }
        
        if (timestamps.size() < maxRequests) {
            timestamps.addLast(now);
            return true;
        }
        return false;
    }
}
```

## Exercise 20: Thread Pool Monitor

```java
public class ThreadPoolMonitor {
    
    public static void monitor(ThreadPoolExecutor pool, String name, long intervalSec) {
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(() -> {
            System.out.printf("[%s] Active: %d | Pool: %d | Queue: %d | Completed: %d%n",
                name,
                pool.getActiveCount(),
                pool.getPoolSize(),
                pool.getQueue().size(),
                pool.getCompletedTaskCount()
            );
        }, 0, intervalSec, TimeUnit.SECONDS);
    }
}
```

---

# Chapter 20: Best Practices

## 20.1 Enterprise-Level Multithreading Best Practices

### 1. Always Use Thread Pools
```java
// ❌ NEVER create raw threads in production
new Thread(() -> processOrder(order)).start();

// ✅ ALWAYS use managed thread pools
executor.submit(() -> processOrder(order));
```

### 2. Always Name Your Threads
```java
ThreadFactory factory = r -> {
    Thread t = new Thread(r, "order-processor-" + counter.incrementAndGet());
    t.setDaemon(true);
    return t;
};
```

### 3. Always Use Bounded Queues
```java
// ❌ Unbounded queue = OOM risk
new LinkedBlockingQueue<>()

// ✅ Bounded queue with rejection policy
new LinkedBlockingQueue<>(500)
```

### 4. Separate Pools for CPU and IO
```java
@Bean("cpuPool") // Size = cores
@Bean("ioPool")  // Size = cores × (1 + wait/compute)
```

### 5. Always Clean Up ThreadLocal
```java
try {
    ThreadLocalContext.set(data);
    // ... business logic
} finally {
    ThreadLocalContext.remove(); // Prevent memory leaks!
}
```

### 6. Handle InterruptedException Properly
```java
// ❌ Swallowing interrupt
catch (InterruptedException e) { /* ignore */ }

// ✅ Restore interrupt flag
catch (InterruptedException e) {
    Thread.currentThread().interrupt(); // Restore flag
    throw new RuntimeException("Thread was interrupted", e);
}
```

### 7. Prefer Higher-Level Concurrency Utilities
```
Use                      Instead of
────────────────────     ──────────────────
ExecutorService          new Thread()
CompletableFuture        Future + get()
BlockingQueue            wait/notify
ConcurrentHashMap        Collections.synchronizedMap()
AtomicInteger            synchronized counter
ReentrantLock            synchronized (when advanced features needed)
```

### 8. Always Set Timeouts
```java
future.get(5, TimeUnit.SECONDS);      // Don't block forever
lock.tryLock(2, TimeUnit.SECONDS);     // Don't wait forever
executor.awaitTermination(30, TimeUnit.SECONDS);
```

### 9. Graceful Shutdown
```java
@PreDestroy
public void shutdown() {
    executor.shutdown();
    if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
        List<Runnable> dropped = executor.shutdownNow();
        log.warn("Dropped {} tasks on shutdown", dropped.size());
    }
}
```

### 10. Monitor Everything
```java
// Expose thread pool metrics
@Bean
public MeterBinder threadPoolMetrics(ThreadPoolExecutor pool) {
    return registry -> {
        Gauge.builder("thread.pool.active", pool, ThreadPoolExecutor::getActiveCount)
             .register(registry);
        Gauge.builder("thread.pool.queue.size", pool, e -> e.getQueue().size())
             .register(registry);
    };
}
```

---

*End of Guide*

**Document Version:** 1.0  
**Last Updated:** March 2026  
**Topics Covered:** 20 Chapters, 80+ Interview Questions, 20 Coding Exercises  

## Senior Engineer Decision Framework

### Concurrency Approach Selection

```
Step 1: Do you actually NEED multithreading?
  ├─ Is the current approach fast enough? → Don't add complexity
  ├─ Is the bottleneck IO or CPU?
  │   ├─ IO: Can you batch requests? Use async IO? Increase pool size?
  │   └─ CPU: Can you optimize the algorithm first?
  └─ Is the data truly shared? Can you partition it?

Step 2: Choose the right concurrency model
  ├─ Simple background task → @Async or CompletableFuture.runAsync()
  ├─ Parallel independent calls → CompletableFuture.allOf()
  ├─ Producer-consumer pipeline → BlockingQueue + dedicated consumers
  ├─ CPU-bound batch processing → parallel streams or ForkJoinPool
  ├─ High-concurrency IO (10K+) → Virtual threads (Java 21) or WebFlux
  └─ Real-time streaming → Kafka/RxJava/Project Reactor

Step 3: Choose the right synchronization
  ├─ Can data be immutable? → No synchronization needed (BEST)
  ├─ Can data be thread-local? → ThreadLocal or ScopedValue
  ├─ Simple counter? → AtomicInteger or LongAdder
  ├─ Key-value access? → ConcurrentHashMap (always)
  ├─ Read-heavy shared state? → StampedLock or ReadWriteLock
  └─ Complex multi-field update? → synchronized or ReentrantLock
```

### Production Readiness Checklist for Concurrent Systems

```
Before deploying a multithreaded system to production:
────────────────────────────────────────────────────

Thread Pool Configuration:
  ☐ All pools use bounded queues
  ☐ Pool sizes are based on workload type (CPU vs IO)
  ☐ Rejection policies are set (CallerRunsPolicy recommended)
  ☐ Threads are named (for debugging)
  ☐ Graceful shutdown is implemented (@PreDestroy)

Safety:
  ☐ No raw Thread creation (use ExecutorService)
  ☐ ThreadLocal values are removed after use
  ☐ InterruptedException is handled properly
  ☐ No synchronized blocks around IO/network calls
  ☐ Lock ordering is consistent where nested locks exist

Monitoring:
  ☐ Thread pool metrics are exposed (active, queue size, rejected)
  ☐ Connection pool metrics are monitored
  ☐ Alerting is set for pool exhaustion
  ☐ Thread dump automation is in place for incidents

Testing:
  ☐ Concurrent unit tests with CountDownLatch/CyclicBarrier
  ☐ Load tests with realistic concurrency levels
  ☐ Stress tests to verify rejection and graceful degradation
  ☐ Thread dump analysis performed under load
```

---
