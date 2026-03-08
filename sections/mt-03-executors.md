
# Chapter 9: Executor Framework

### What is the Executor Framework?
The **Executor Framework** (introduced in Java 5, `java.util.concurrent` package) is a higher-level replacement for manually creating and managing threads. It decouples **task submission** from **task execution**, allowing you to focus on WHAT to run, not HOW to run it.

### Why the Executor Framework Exists
Before Java 5, every concurrent operation required manually creating `Thread` objects. This leads to three critical problems in production:

| Problem | Impact |
|---|---|
| **Resource waste** | Each thread costs ~1MB memory + ~1ms creation time |
| **No bound on concurrency** | 10,000 requests = 10,000 threads = OOM crash |
| **No task queuing** | When all threads are busy, new tasks are simply lost |
| **No lifecycle management** | No graceful shutdown, thread leak on exceptions |

### Design Pattern: Thread Pool Pattern
The Executor Framework implements the **Thread Pool** pattern — a fixed set of worker threads are created once, and tasks are submitted to a queue. Workers pull tasks from the queue and execute them.

```
Architecture:

Client Code                      Executor Framework
┌─────────────┐              ┌───────────────────────────────┐
│  Task 1     │ ─submit→ │  BlockingQueue         │
│  Task 2     │ ─submit→ │  [Task1][Task2][Task3]  │
│  Task 3     │ ─submit→ │            │               │
└─────────────┘              │  Worker-1  ←─takes task  │
                              │  Worker-2  ←─takes task  │
                              │  Worker-3  (idle)        │
                              └───────────────────────────────┘
```

### When to Use Executor Framework
- **Always** use it instead of raw `new Thread()` in production code
- When you need to bound concurrency (fixed number of threads)
- When tasks should be queued and processed in order
- When you need graceful shutdown capabilities

### When NOT to Use
- Simple one-off background tasks — consider `CompletableFuture.runAsync()` (uses ForkJoinPool internally)
- Reactive systems — use Project Reactor or RxJava instead
- If using Spring Boot, prefer `@Async` annotation with a configured `TaskExecutor`

## 9.1 Why Thread Pools?

Creating raw threads for every task is expensive and dangerous:

```
Problem with raw threads:
1. Thread creation: ~1ms + ~1MB memory per thread
2. 10,000 concurrent requests = 10,000 threads = ~10GB memory → OOM
3. OS thread limit: ~10,000-30,000 threads per process
4. Context switching overhead grows with thread count
5. No control over concurrency level

Solution: Thread Pools
- Reuse a fixed set of threads
- Queue excess tasks
- Bound concurrency
- Manage lifecycle
```

## 9.2 ThreadPoolExecutor Architecture

### Understanding the Constructor Parameters
The `ThreadPoolExecutor` is the core implementation behind all thread pools. Understanding its 7 parameters is essential for production tuning:

```java
public ThreadPoolExecutor(
    int corePoolSize,        // Threads always kept alive
    int maximumPoolSize,     // Max threads under heavy load
    long keepAliveTime,      // How long idle non-core threads survive
    TimeUnit unit,
    BlockingQueue<Runnable> workQueue,   // Queue for waiting tasks
    ThreadFactory threadFactory,         // Custom thread naming
    RejectedExecutionHandler handler    // What to do when queue is full
)
```

### Step-by-Step: How Tasks Are Dispatched
When you submit a task, the ThreadPoolExecutor follows this exact decision tree:
```
New task arrives:
    │
    ├─ Active threads < corePoolSize?
    │   YES → Create new thread, execute task immediately
    │   NO ↓
    │
    ├─ Work queue has space?
    │   YES → Add task to queue (existing threads will pick it up)
    │   NO ↓
    │
    ├─ Active threads < maximumPoolSize?
    │   YES → Create new thread (temporary, expires after keepAliveTime)
    │   NO ↓
    │
    └─ Execute RejectedExecutionHandler
        ├─ AbortPolicy (default): throws RejectedExecutionException
        ├─ CallerRunsPolicy: caller thread executes the task
        ├─ DiscardPolicy: silently drops the task
        └─ DiscardOldestPolicy: drops oldest queued task, retries
```

## 9.3 Thread Pool Types (Executors Factory Methods)

### Choosing the Right Thread Pool Type

| Thread Pool | Core Threads | Max Threads | Queue | Best For |
|---|---|---|---|---|
| `FixedThreadPool` | n | n | Unbounded | Predictable, steady workload |
| `CachedThreadPool` | 0 | ∞ | SynchronousQueue | Bursty, short-lived tasks |
| `SingleThreadExecutor` | 1 | 1 | Unbounded | Sequential tasks |
| `ScheduledThreadPool` | n | n | DelayedWorkQueue | Timed/periodic tasks |

> **Production Warning:** Never use `Executors.newFixedThreadPool()` or `newCachedThreadPool()` in production without understanding their dangers. Both can cause OOM — one via unbounded queues, the other via unbounded thread creation. Always create `ThreadPoolExecutor` directly with bounded queues.

### FixedThreadPool
```java
// Fixed number of threads, unbounded queue
ExecutorService fixed = Executors.newFixedThreadPool(10);

// Internal: new ThreadPoolExecutor(10, 10, 0L, TimeUnit.MILLISECONDS,
//                                  new LinkedBlockingQueue<Runnable>());

// Use when: Predictable, steady workload
// Danger: Unbounded queue can cause OOM if tasks accumulate!
```

### CachedThreadPool
```java
// Creates threads as needed, reuses idle threads, removes after 60s idle
ExecutorService cached = Executors.newCachedThreadPool();

// Internal: new ThreadPoolExecutor(0, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS,
//                                  new SynchronousQueue<Runnable>());

// Use when: Many short-lived tasks with variable load
// Danger: Can create unlimited threads → OOM under burst traffic!
```

### SingleThreadExecutor
```java
// Single thread, unbounded queue, guarantees sequential execution
ExecutorService single = Executors.newSingleThreadExecutor();

// Use when: Tasks must execute in order (event logging, file writing)
// If thread dies, a new one is created automatically
```

### ScheduledThreadPool
```java
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(5);

// One-time delayed execution
scheduler.schedule(() -> sendReminder(), 30, TimeUnit.MINUTES);

// Fixed-rate: execute every N seconds (regardless of task duration)
scheduler.scheduleAtFixedRate(() -> collectMetrics(), 0, 10, TimeUnit.SECONDS);

// Fixed-delay: wait N seconds AFTER previous execution completes
scheduler.scheduleWithFixedDelay(() -> syncData(), 0, 30, TimeUnit.SECONDS);
```

## 9.4 Production Thread Pool Configuration

```java
@Configuration
public class ExecutorConfig {
    
    @Bean("ioExecutor")
    public ExecutorService ioExecutor() {
        int coreCount = Runtime.getRuntime().availableProcessors();
        return new ThreadPoolExecutor(
            coreCount * 2,              // IO tasks: 2x cores
            coreCount * 4,              // Max under burst
            60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(500),  // Bounded queue!
            new ThreadFactory() {
                private final AtomicInteger count = new AtomicInteger(0);
                public Thread newThread(Runnable r) {
                    Thread t = new Thread(r, "io-worker-" + count.incrementAndGet());
                    t.setDaemon(true);
                    return t;
                }
            },
            new ThreadPoolExecutor.CallerRunsPolicy() // Backpressure
        );
    }
    
    @Bean("cpuExecutor")
    public ExecutorService cpuExecutor() {
        int coreCount = Runtime.getRuntime().availableProcessors();
        return new ThreadPoolExecutor(
            coreCount,                  // CPU tasks: exactly cores
            coreCount,                  // No extra threads for CPU work
            0L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(100),
            r -> {
                Thread t = new Thread(r, "cpu-worker-" + Thread.activeCount());
                t.setDaemon(true);
                return t;
            },
            new ThreadPoolExecutor.AbortPolicy()
        );
    }
    
    // Graceful shutdown on application stop
    @PreDestroy
    public void shutdown() {
        ioExecutor().shutdown();
        cpuExecutor().shutdown();
        try {
            if (!ioExecutor().awaitTermination(30, TimeUnit.SECONDS)) {
                ioExecutor().shutdownNow();
            }
        } catch (InterruptedException e) {
            ioExecutor().shutdownNow();
        }
    }
}
```

### Thread Pool Sizing Guidelines

| Workload | Formula | Rationale |
|---|---|---|
| **CPU-bound** | `cores` | More threads = more context switching, no benefit |
| **IO-bound** | `cores × 2` to `cores × 10` | Threads are mostly waiting on IO |
| **Mixed** | `cores × (1 + wait_time/compute_time)` | Balance CPU usage |
| **Web server** | `100-400` (Tomcat default: 200) | Most time waiting on DB/network |

---

# Chapter 10: CompletableFuture (Java 8+)

## 10.1 What is CompletableFuture?

`CompletableFuture<T>` is a **non-blocking**, **composable**, **chainable** framework for asynchronous programming. It represents a future result that can be completed manually or by a computation.

### Why CompletableFuture Over Future
The old `Future` interface (Java 5) was very limited:

| Limitation of Future | CompletableFuture Solution |
|---|---|
| `get()` blocks the calling thread | `thenApply()`, `thenAccept()` — non-blocking callbacks |
| Cannot chain operations | `thenCompose()`, `thenCombine()` — fluent chaining |
| No exception handling | `exceptionally()`, `handle()` — inline error handling |
| Cannot combine multiple futures | `allOf()`, `anyOf()` — parallel orchestration |
| No manual completion | `complete()`, `completeExceptionally()` |

### When to Use CompletableFuture
- Calling multiple microservices in parallel and combining results
- Non-blocking API responses (reactive-style programming)
- Any scenario where you need to chain async operations

### When NOT to Use
- Simple fire-and-forget tasks — use `@Async` in Spring Boot
- CPU-bound parallel processing on large datasets — use parallel streams or Fork/Join
- Streaming data processing — use Project Reactor or Kafka Streams

### Step-by-Step Execution Flow
```
1. supplyAsync(() -> callServiceA())  → Task submitted to ForkJoinPool
2. .thenApply(result -> transform(result))  → Callback registered (NOT executed yet)
3. .thenCompose(data -> callServiceB(data))  → Another async callback registered
4. .exceptionally(ex -> fallback())  → Error handler registered

Execution happens ONLY when the pool thread processes Step 1.
Steps 2-4 are chained as callbacks — they execute automatically when Step 1 completes.
```

### Design Pattern: Pipeline / Chain of Responsibility
CompletableFuture implements the **Pipeline pattern** — data flows through a chain of transformations, with each stage potentially asynchronous.

### Key API Mental Model
| Method | Analogy | Returns |
|---|---|---|
| `thenApply()` | `map()` in Streams | `CompletableFuture<U>` |
| `thenCompose()` | `flatMap()` in Streams | `CompletableFuture<U>` |
| `thenCombine()` | Joining two parallel paths | `CompletableFuture<V>` |
| `thenAccept()` | `forEach()` in Streams | `CompletableFuture<Void>` |
| `allOf()` | `Promise.all()` in JavaScript | `CompletableFuture<Void>` |
| `anyOf()` | `Promise.race()` in JavaScript | `CompletableFuture<Object>` |

## 10.2 Creating CompletableFutures

### supplyAsync – Returns a value
```java
// Uses ForkJoinPool.commonPool() by default
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    // Runs in ForkJoinPool thread
    return callExternalApi();
});

// With custom executor
CompletableFuture<String> future = CompletableFuture.supplyAsync(
    () -> callExternalApi(),
    customExecutor  // Better for IO-bound tasks!
);
```

### runAsync – No return value
```java
CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
    sendNotification(user);
});
```

## 10.3 Transformation and Chaining

### thenApply – Transform result (like map)
```java
CompletableFuture<String> nameFuture = 
    CompletableFuture.supplyAsync(() -> getUserById(123))  // User
        .thenApply(user -> user.getFirstName() + " " + user.getLastName()); // String

// Chain: supplyAsync → User → thenApply → String
```

### thenCompose – Chaining async operations (like flatMap)
```java
// When each step returns a CompletableFuture
CompletableFuture<OrderDetails> detailsFuture = 
    CompletableFuture.supplyAsync(() -> getOrderId(request))     // String
        .thenCompose(orderId -> 
            CompletableFuture.supplyAsync(() -> fetchOrder(orderId)))  // Order
        .thenCompose(order -> 
            CompletableFuture.supplyAsync(() -> enrichWithDetails(order))); // OrderDetails

// thenApply vs thenCompose:
// thenApply:   f(T) → U              (synchronous transformation)
// thenCompose: f(T) → CompletableFuture<U>  (asynchronous chaining)
```

### thenCombine – Combine two independent futures
```java
CompletableFuture<UserProfile> profileFuture = 
    CompletableFuture.supplyAsync(() -> userService.getProfile(userId));
CompletableFuture<List<Order>> ordersFuture = 
    CompletableFuture.supplyAsync(() -> orderService.getOrders(userId));

CompletableFuture<DashboardDTO> dashboardFuture = profileFuture
    .thenCombine(ordersFuture, (profile, orders) -> 
        new DashboardDTO(profile, orders));
```

## 10.4 Combining Multiple Futures

### allOf – Wait for ALL to complete
```java
CompletableFuture<UserProfile> userFuture = 
    CompletableFuture.supplyAsync(() -> userService.getProfile(userId), ioExecutor);
CompletableFuture<List<Order>> ordersFuture = 
    CompletableFuture.supplyAsync(() -> orderService.getRecent(userId), ioExecutor);
CompletableFuture<WalletBalance> walletFuture = 
    CompletableFuture.supplyAsync(() -> walletService.getBalance(userId), ioExecutor);

// Wait for ALL to complete
CompletableFuture<Void> allComplete = CompletableFuture.allOf(
    userFuture, ordersFuture, walletFuture
);

// After all complete, build the response
DashboardDTO dashboard = allComplete.thenApply(v -> new DashboardDTO(
    userFuture.join(),     // Already completed, non-blocking
    ordersFuture.join(),
    walletFuture.join()
)).join();
```

### anyOf – Wait for FIRST to complete
```java
// Call multiple mirrors, use the fastest response
CompletableFuture<Object> fastest = CompletableFuture.anyOf(
    CompletableFuture.supplyAsync(() -> callMirror1()),
    CompletableFuture.supplyAsync(() -> callMirror2()),
    CompletableFuture.supplyAsync(() -> callMirror3())
);

String result = (String) fastest.join(); // Fastest mirror wins
```

## 10.5 Exception Handling

### exceptionally – Handle exceptions
```java
CompletableFuture<UserProfile> resilientFuture = 
    CompletableFuture.supplyAsync(() -> userService.getProfile(userId))
        .exceptionally(ex -> {
            log.error("Failed to fetch profile", ex);
            return UserProfile.defaultProfile(); // Fallback
        });
```

### handle – Handle result OR exception
```java
CompletableFuture<ApiResponse> responseFuture = 
    CompletableFuture.supplyAsync(() -> callExternalApi())
        .handle((result, exception) -> {
            if (exception != null) {
                return ApiResponse.error(exception.getMessage());
            }
            return ApiResponse.success(result);
        });
```

### whenComplete – Side-effect after completion (no transformation)
```java
CompletableFuture.supplyAsync(() -> processPayment(order))
    .whenComplete((result, exception) -> {
        if (exception != null) {
            alertService.sendAlert("Payment failed: " + exception);
        } else {
            metricsService.recordPayment(result);
        }
    });
```

## 10.6 Full Production Example: Microservice Aggregation

```java
@Service
public class OrderAggregationService {
    
    @Autowired @Qualifier("ioExecutor")
    private ExecutorService ioExecutor;
    
    public CompletableFuture<OrderDetailsResponse> getOrderDetails(Long orderId) {
        
        // Step 1: Fetch order (required)
        CompletableFuture<Order> orderFuture = CompletableFuture
            .supplyAsync(() -> orderService.findById(orderId), ioExecutor);
        
        // Step 2: In parallel, fetch customer AND payment details
        CompletableFuture<Customer> customerFuture = orderFuture
            .thenComposeAsync(order -> CompletableFuture
                .supplyAsync(() -> customerService.findById(order.getCustomerId()), ioExecutor));
        
        CompletableFuture<List<Payment>> paymentsFuture = CompletableFuture
            .supplyAsync(() -> paymentService.findByOrderId(orderId), ioExecutor);
        
        CompletableFuture<ShippingInfo> shippingFuture = CompletableFuture
            .supplyAsync(() -> shippingService.getStatus(orderId), ioExecutor)
            .exceptionally(ex -> ShippingInfo.unknown()); // Graceful fallback
        
        // Step 3: Combine all results
        return CompletableFuture.allOf(orderFuture, customerFuture, paymentsFuture, shippingFuture)
            .thenApply(v -> OrderDetailsResponse.builder()
                .order(orderFuture.join())
                .customer(customerFuture.join())
                .payments(paymentsFuture.join())
                .shipping(shippingFuture.join())
                .build())
            .exceptionally(ex -> {
                log.error("Failed to build order details for {}", orderId, ex);
                throw new OrderDetailsException("Failed to aggregate order details", ex);
            });
    }
}
```

---

# Chapter 11: Fork/Join Framework

## 11.1 What is Fork/Join?

The Fork/Join framework (Java 7+) is designed for **divide-and-conquer** parallelism. It breaks a large task into smaller subtasks, executes them in parallel, and combines the results.

### Why Fork/Join Over Regular Thread Pools
Regular thread pools work well for independent tasks. But when a task needs to **recursively split itself** into subtasks and then **combine results**, a regular thread pool deadlocks — parent tasks block waiting for child results, but child tasks are stuck in the queue.

Fork/Join solves this with the **work-stealing algorithm** — idle threads steal work from busy threads' queues, preventing deadlock and maximizing CPU utilization.

### When to Use Fork/Join
- **Large array/collection processing** — summing, sorting, searching
- **Recursive divide-and-conquer** algorithms (merge sort, quicksort)
- CPU-intensive computations that can be split evenly

### When NOT to Use Fork/Join
- **IO-bound tasks** — blocked threads waste the pool
- **Small datasets** — splitting overhead exceeds parallel benefit
- **Uneven task sizes** — one large subtask blocks everything
- In most cases, **parallel streams** are simpler and use Fork/Join internally

### Architecture
```
ForkJoinPool
│
├─ RecursiveTask<V>  → returns a value (like Callable)
└─ RecursiveAction   → no return value (like Runnable)

Each worker thread has its own deque (double-ended queue):
- Takes tasks from the HEAD of its own deque
- Steals tasks from the TAIL of other threads' deques
```

### Core Components
- **ForkJoinPool** — Specialized thread pool with work-stealing
- **RecursiveTask\<V\>** — Fork/join task that returns a result
- **RecursiveAction** — Fork/join task with no result (void)
- **Work Stealing** — Idle threads steal tasks from busy threads' queues

### Work-Stealing Algorithm
```
Thread 1 queue:  [Task-A] [Task-B] [Task-C]     ← Takes from head
Thread 2 queue:  [Task-D]                        ← Done with its tasks
Thread 3 queue:  [Task-E] [Task-F] [Task-G]

Work Stealing:
Thread 2 is idle → steals Task-G from Thread 3's tail

Thread 1 queue:  [Task-A] [Task-B] [Task-C]
Thread 2 queue:  [Task-G]                        ← Stolen from Thread 3!
Thread 3 queue:  [Task-E] [Task-F]               ← Task-G removed from tail
```

## 11.2 RecursiveTask Example: Parallel Sum

```java
public class ParallelSumTask extends RecursiveTask<Long> {
    private static final int THRESHOLD = 10_000;
    private final long[] array;
    private final int start;
    private final int end;
    
    public ParallelSumTask(long[] array, int start, int end) {
        this.array = array;
        this.start = start;
        this.end = end;
    }
    
    @Override
    protected Long compute() {
        int length = end - start;
        
        // Base case: small enough to compute directly
        if (length <= THRESHOLD) {
            long sum = 0;
            for (int i = start; i < end; i++) {
                sum += array[i];
            }
            return sum;
        }
        
        // Divide: split into two subtasks
        int mid = start + length / 2;
        ParallelSumTask leftTask = new ParallelSumTask(array, start, mid);
        ParallelSumTask rightTask = new ParallelSumTask(array, mid, end);
        
        leftTask.fork();    // Submit left task to ForkJoinPool
        Long rightResult = rightTask.compute();  // Compute right in current thread
        Long leftResult = leftTask.join();       // Wait for left result
        
        // Combine results
        return leftResult + rightResult;
    }
}

// Usage
long[] data = new long[10_000_000]; // 10 million elements
Arrays.fill(data, 1L);

ForkJoinPool pool = new ForkJoinPool(); // Default: cores threads
Long result = pool.invoke(new ParallelSumTask(data, 0, data.length));
System.out.println("Sum: " + result); // 10,000,000
```

## 11.3 RecursiveAction Example: Parallel File Processing

```java
public class FileProcessorAction extends RecursiveAction {
    private static final int THRESHOLD = 10;
    private final List<File> files;
    
    public FileProcessorAction(List<File> files) {
        this.files = files;
    }
    
    @Override
    protected void compute() {
        if (files.size() <= THRESHOLD) {
            // Process files sequentially
            for (File file : files) {
                processFile(file);
            }
        } else {
            int mid = files.size() / 2;
            FileProcessorAction left = new FileProcessorAction(files.subList(0, mid));
            FileProcessorAction right = new FileProcessorAction(files.subList(mid, files.size()));
            invokeAll(left, right);  // Fork both, wait for both
        }
    }
    
    private void processFile(File file) {
        // Parse, transform, index, etc.
        log.info("Processing {} on {}", file.getName(), Thread.currentThread().getName());
    }
}
```

---

# Chapter 12: Parallel Streams

### What are Parallel Streams?
Parallel Streams allow you to process collections using **multiple threads automatically** with a single API change: `.stream()` → `.parallelStream()`. Under the hood, parallel streams use the **Fork/Join framework** to split, process, and combine data.

### Why Parallel Streams Exist
Parallel streams make data parallelism accessible without manually managing threads, pools, or synchronization. They are ideal for **data-parallel** operations where the same transformation is applied to every element independently.

### How Parallel Streams Work Internally
```
1. The stream source provides a Spliterator
2. The Spliterator splits the data into roughly equal chunks
3. Each chunk is wrapped in a ForkJoinTask
4. Tasks are submitted to ForkJoinPool.commonPool()
5. Worker threads process chunks independently
6. Results are combined using the Collector's combiner function

   Source:     [1, 2, 3, 4, 5, 6, 7, 8]
   Split:      [1,2,3,4]   [5,6,7,8]
   Split:      [1,2][3,4]  [5,6][7,8]
   Process:     T-1  T-2    T-3  T-4
   Combine:       10          26
   Final:            36
```

> **Critical Warning:** Parallel streams use `ForkJoinPool.commonPool()`, which is shared by the **entire JVM**. If your parallel stream blocks (e.g., on I/O), it starves ALL other parallel streams in the application.

### Decision Guide: When to Use Parallel Streams
| Condition | Use Parallel? | Why |
|---|---|---|
| Dataset > 100K elements AND CPU-bound | **Yes** | Meaningful speedup |
| Dataset < 10K elements | **No** | Split/merge overhead > benefit |
| I/O operations (REST, DB) | **No** | Blocks shared pool |
| Order-dependent logic | **Caution** | May break ordering |
| Shared mutable state | **NEVER** | Race conditions |
| ArrayList source | **Yes** | Good random-access splitting |
| LinkedList source | **No** | Poor splitting (sequential only) |

## 12.1 stream() vs parallelStream()

```java
List<Order> orders = orderRepository.findAll(); // 100,000 orders

// Sequential stream — single thread
long count = orders.stream()
    .filter(o -> o.getAmount() > 100)
    .count();

// Parallel stream — uses ForkJoinPool.commonPool()
long count = orders.parallelStream()
    .filter(o -> o.getAmount() > 100)
    .count();
```

## 12.2 How Parallel Streams Work

```
parallelStream() internally:
1. Spliterator splits the source into chunks
2. Each chunk is submitted to ForkJoinPool.commonPool()
3. Each thread processes its chunk independently
4. Results are combined using the collector's combiner

Data:  [1, 2, 3, 4, 5, 6, 7, 8]
       ↓ split
[1, 2, 3, 4]    [5, 6, 7, 8]
  ↓ split          ↓ split
[1,2] [3,4]    [5,6] [7,8]
  ↓     ↓        ↓     ↓
 T-1   T-2      T-3   T-4    ← Each thread processes its chunk
  ↓     ↓        ↓     ↓
 3      7       11     15     ← Partial results
  ↓     ↓        ↓     ↓
    10              26        ← Combiner merges results
         ↓
         36                   ← Final result
```

## 12.3 When to Use Parallel Streams

### ✅ Good Candidates
```java
// 1. CPU-heavy computation on large datasets
List<Double> results = largeDataset.parallelStream()
    .map(data -> performHeavyCalculation(data)) // CPU-bound
    .collect(Collectors.toList());

// 2. Embarrassingly parallel operations (no shared state)
long total = sales.parallelStream()
    .mapToDouble(Sale::getAmount)
    .sum();
```

### ❌ When NOT to Use
```java
// 1. Small datasets — overhead > benefit
List<String> small = List.of("a", "b", "c");
small.parallelStream().map(String::toUpperCase); // SLOWER than sequential!

// 2. IO-bound operations — blocks ForkJoinPool threads
orders.parallelStream()
    .map(order -> restTemplate.getForObject(url, Response.class)) // BAD!
    .collect(Collectors.toList());
// Blocks commonPool threads, starving other parallel streams!

// 3. Ordered operations where order matters
// parallelStream may not maintain encounter order for unordered sources

// 4. Operations with shared mutable state
List<String> results = new ArrayList<>(); // NOT thread-safe!
data.parallelStream()
    .map(this::transform)
    .forEach(results::add); // RACE CONDITION!

// FIX: Use collect() instead
List<String> results = data.parallelStream()
    .map(this::transform)
    .collect(Collectors.toList()); // Thread-safe collector
```

## 12.4 Custom ForkJoinPool for Parallel Streams
```java
// Don't pollute the common pool with IO-bound tasks
ForkJoinPool customPool = new ForkJoinPool(20); // 20 threads for IO

List<ApiResponse> results = customPool.submit(() -> 
    urls.parallelStream()
        .map(url -> callApi(url))
        .collect(Collectors.toList())
).get();

customPool.shutdown();
```

### Guidelines

| Scenario | Use Parallel? | Reason |
|---|---|---|
| < 10,000 elements | No | Split/merge overhead exceeds benefit |
| CPU-bound, >100K elements | **Yes** | Significant speedup |
| IO-bound (REST/DB) | **No** | Blocks common pool |
| Ordered output critical | Caution | May need `forEachOrdered()` |
| Shared mutable state | **No** | Race conditions |
| ArrayList source | **Yes** | Good spliterator (random access) |
| LinkedList source | **No** | Poor spliterator (sequential access) |

---
