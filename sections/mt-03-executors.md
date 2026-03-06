
# Chapter 9: Executor Framework

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

### How Tasks Are Dispatched
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
