
# Chapter 13: Deadlocks

## 13.1 What is a Deadlock?

A **deadlock** is a situation where two or more threads are **permanently blocked**, each waiting for a lock held by the other.

```
Thread A holds Lock-1, waiting for Lock-2
Thread B holds Lock-2, waiting for Lock-1
→ Neither can proceed → Application hangs forever
```

### Visualization
```
Thread A ────→ [Holds Lock-1] ────→ [Waiting for Lock-2] ──┐
                                                             │
Thread B ────→ [Holds Lock-2] ────→ [Waiting for Lock-1] ──┘
                   ↑                        │
                   └────────────────────────┘
                        DEADLOCK CYCLE
```

## 13.2 Four Conditions for Deadlock (Coffman Conditions)

ALL four must hold simultaneously:

| Condition | Description |
|---|---|
| **Mutual Exclusion** | At least one resource is held in non-sharable mode |
| **Hold and Wait** | Thread holds one resource while waiting for another |
| **No Preemption** | Resources cannot be forcibly taken from a thread |
| **Circular Wait** | Circular chain of threads, each waiting for a resource held by the next |

## 13.3 Deadlock Code Example

```java
public class DeadlockExample {
    private final Object lockA = new Object();
    private final Object lockB = new Object();
    
    public void method1() {
        synchronized (lockA) {           // Thread 1 acquires lockA
            System.out.println("Thread 1: Holding lockA");
            try { Thread.sleep(100); } catch (InterruptedException e) {}
            
            synchronized (lockB) {       // Thread 1 waiting for lockB
                System.out.println("Thread 1: Holding lockA & lockB");
            }
        }
    }
    
    public void method2() {
        synchronized (lockB) {           // Thread 2 acquires lockB
            System.out.println("Thread 2: Holding lockB");
            try { Thread.sleep(100); } catch (InterruptedException e) {}
            
            synchronized (lockA) {       // Thread 2 waiting for lockA → DEADLOCK!
                System.out.println("Thread 2: Holding lockB & lockA");
            }
        }
    }
}

// Run
DeadlockExample example = new DeadlockExample();
new Thread(example::method1, "Thread-1").start();
new Thread(example::method2, "Thread-2").start();
// Both threads will hang forever!
```

## 13.4 Detection

### Using jstack (Command Line)
```bash
# Find JVM process ID
jps

# Dump threads
jstack <PID>

# Output will show:
# "Thread-1": waiting to lock 0x00000007ab
#   - locked 0x00000007cd
# "Thread-2": waiting to lock 0x00000007cd
#   - locked 0x00000007ab
# Found 1 deadlock.
```

### Programmatic Detection
```java
ThreadMXBean bean = ManagementFactory.getThreadMXBean();
long[] deadlockedThreadIds = bean.findDeadlockedThreads();

if (deadlockedThreadIds != null) {
    ThreadInfo[] infos = bean.getThreadInfo(deadlockedThreadIds, true, true);
    for (ThreadInfo info : infos) {
        System.out.println("Deadlocked thread: " + info.getThreadName());
        System.out.println("Waiting for: " + info.getLockName());
        System.out.println("Held by: " + info.getLockOwnerName());
    }
}
```

## 13.5 Prevention Strategies

### Strategy 1: Lock Ordering (Break Circular Wait)
```java
// ALWAYS acquire locks in the same order
public void transferMoney(Account from, Account to, double amount) {
    // Sort by account ID to ensure consistent lock ordering
    Account first = from.getId() < to.getId() ? from : to;
    Account second = from.getId() < to.getId() ? to : from;
    
    synchronized (first) {
        synchronized (second) {
            from.debit(amount);
            to.credit(amount);
        }
    }
}
```

### Strategy 2: tryLock with Timeout (Break Hold and Wait)
```java
public boolean transferWithTimeout(Account from, Account to, double amount) {
    ReentrantLock lock1 = from.getLock();
    ReentrantLock lock2 = to.getLock();
    
    boolean gotLock1 = false, gotLock2 = false;
    try {
        gotLock1 = lock1.tryLock(1, TimeUnit.SECONDS);
        gotLock2 = lock2.tryLock(1, TimeUnit.SECONDS);
        
        if (gotLock1 && gotLock2) {
            from.debit(amount);
            to.credit(amount);
            return true;
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    } finally {
        if (gotLock1) lock1.unlock();
        if (gotLock2) lock2.unlock();
    }
    return false; // Retry later
}
```

### Strategy 3: Avoid Nested Locks
```java
// Instead of nested synchronized blocks, use a single coarse-grained lock
private final ReentrantLock transferLock = new ReentrantLock();

public void transfer(Account from, Account to, double amount) {
    transferLock.lock(); // Single lock for all transfers
    try {
        from.debit(amount);
        to.credit(amount);
    } finally {
        transferLock.unlock();
    }
}
```

---

# Chapter 14: Thread Safety Design Patterns

## 14.1 Immutable Objects

Objects whose state **cannot change after construction**. Inherently thread-safe — no synchronization needed.

```java
public final class ImmutableConfig {
    private final String host;
    private final int port;
    private final List<String> endpoints;
    
    public ImmutableConfig(String host, int port, List<String> endpoints) {
        this.host = host;
        this.port = port;
        this.endpoints = Collections.unmodifiableList(new ArrayList<>(endpoints));
    }
    
    public String getHost() { return host; }
    public int getPort() { return port; }
    public List<String> getEndpoints() { return endpoints; } // Immutable copy
}

// Thread-safe: multiple threads can read without synchronization
```

### Rules for Immutability
1. Make class `final` (prevent subclassing)
2. Make all fields `private final`
3. No setter methods
4. Deep copy mutable objects in constructor
5. Return copies of mutable fields (defensive copies)

## 14.2 ThreadLocal

Each thread gets its **own copy** of a variable. No sharing → no synchronization needed.

```java
public class RequestContext {
    
    private static final ThreadLocal<String> correlationId = 
        ThreadLocal.withInitial(() -> UUID.randomUUID().toString());
    
    private static final ThreadLocal<UserInfo> currentUser = new ThreadLocal<>();
    
    public static String getCorrelationId() {
        return correlationId.get();
    }
    
    public static void setCurrentUser(UserInfo user) {
        currentUser.set(user);
    }
    
    public static UserInfo getCurrentUser() {
        return currentUser.get();
    }
    
    // CRITICAL: Always clean up to avoid memory leaks in thread pools!
    public static void clear() {
        correlationId.remove();
        currentUser.remove();
    }
}

// Spring MVC interceptor
@Component
public class RequestInterceptor implements HandlerInterceptor {
    
    @Override
    public boolean preHandle(HttpServletRequest request, 
                             HttpServletResponse response, Object handler) {
        RequestContext.setCurrentUser(extractUser(request));
        return true;
    }
    
    @Override
    public void afterCompletion(HttpServletRequest request, 
                                HttpServletResponse response, Object handler, Exception ex) {
        RequestContext.clear(); // MUST clear to prevent leaks in thread pool!
    }
}
```

### ThreadLocal Memory Leak Warning
```
⚠️ In thread pools (Tomcat, ExecutorService), threads are REUSED.
If you don't call ThreadLocal.remove(), the value persists
across requests → memory leak + data leakage between users!

ALWAYS use try-finally or interceptors to clean up ThreadLocal.
```

## 14.3 Producer-Consumer Pattern

```java
@Component
public class EventProcessingSystem {
    
    private final BlockingQueue<Event> eventQueue = new LinkedBlockingQueue<>(10_000);
    
    // Producer: REST controller thread
    @PostMapping("/api/events")
    public ResponseEntity<String> receiveEvent(@RequestBody Event event) {
        if (eventQueue.offer(event)) {
            return ResponseEntity.accepted().body("Queued");
        }
        return ResponseEntity.status(429).body("Queue full");
    }
    
    // Consumer: Background worker threads
    @PostConstruct
    public void startConsumers() {
        for (int i = 0; i < 5; i++) {
            Thread consumer = new Thread(() -> {
                while (!Thread.currentThread().isInterrupted()) {
                    try {
                        Event event = eventQueue.take();
                        processEvent(event);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
            }, "event-consumer-" + i);
            consumer.setDaemon(true);
            consumer.start();
        }
    }
}
```

## 14.4 Thread-Safe Singleton (Double-Checked Locking)

```java
public class DatabaseConnectionPool {
    
    // volatile ensures visibility + prevents instruction reordering
    private static volatile DatabaseConnectionPool instance;
    
    private DatabaseConnectionPool() {
        // Initialize connection pool
    }
    
    public static DatabaseConnectionPool getInstance() {
        if (instance == null) {                    // First check (no locking)
            synchronized (DatabaseConnectionPool.class) {
                if (instance == null) {            // Second check (with lock)
                    instance = new DatabaseConnectionPool();
                }
            }
        }
        return instance;
    }
}

// Better alternative: Enum Singleton
public enum ConnectionPoolSingleton {
    INSTANCE;
    
    private final HikariDataSource dataSource;
    
    ConnectionPoolSingleton() {
        dataSource = new HikariDataSource();
        dataSource.setJdbcUrl("jdbc:postgresql://localhost:5432/db");
    }
    
    public Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }
}
```

## 14.5 Guarded Suspension

Thread waits until a condition is satisfied before proceeding.

```java
public class GuardedQueue<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notEmpty = lock.newCondition();
    
    public T get() throws InterruptedException {
        lock.lock();
        try {
            while (queue.isEmpty()) {
                notEmpty.await(); // Guard: suspend until condition met
            }
            return queue.poll();
        } finally {
            lock.unlock();
        }
    }
    
    public void put(T item) {
        lock.lock();
        try {
            queue.offer(item);
            notEmpty.signal(); // Notify waiting threads
        } finally {
            lock.unlock();
        }
    }
}
```

---

# Chapter 15: Multithreading in Spring Boot Applications

## 15.1 @Async – Asynchronous Method Execution

```java
// Step 1: Enable async
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {
    
    @Override
    @Bean("taskExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}

// Step 2: Use @Async on methods
@Service
public class NotificationService {
    
    @Async("taskExecutor") // Runs in background thread
    public void sendEmailNotification(String email, String message) {
        // This runs in a thread from taskExecutor pool
        // Does NOT block the calling thread
        emailSender.send(email, message);
        log.info("Email sent to {} on thread {}", email, Thread.currentThread().getName());
    }
    
    @Async("taskExecutor")
    public CompletableFuture<EmailResult> sendEmailAsync(String email, String message) {
        EmailResult result = emailSender.send(email, message);
        return CompletableFuture.completedFuture(result);
    }
}

// Step 3: Call from controller
@RestController
public class OrderController {
    
    @PostMapping("/api/orders")
    public ResponseEntity<OrderDTO> createOrder(@RequestBody CreateOrderRequest request) {
        Order order = orderService.create(request);
        
        // Fire-and-forget: runs in background thread
        notificationService.sendEmailNotification(
            order.getCustomerEmail(), 
            "Order " + order.getId() + " confirmed!"
        );
        
        return ResponseEntity.status(201).body(mapper.toDTO(order));
        // Response returns immediately, email sends in background
    }
}
```

### @Async Rules
```
⚠️ @Async ONLY works when called from OUTSIDE the class.
   Self-invocation bypasses the proxy → runs synchronously!

   // WRONG - self-invocation
   public void doWork() {
       sendEmailNotification("...", "..."); // Runs synchronously!
   }
   
   // CORRECT - called from another bean
   @Autowired NotificationService notificationService;
   notificationService.sendEmailNotification("...", "..."); // Async!
```

## 15.2 Parallel API Calls in Service Layer

```java
@Service
public class UserDashboardService {
    
    @Autowired @Qualifier("taskExecutor")
    private Executor executor;
    
    public DashboardResponse getDashboard(Long userId) {
        CompletableFuture<UserProfile> profileFuture = CompletableFuture
            .supplyAsync(() -> userClient.getProfile(userId), executor);
        
        CompletableFuture<List<Order>> ordersFuture = CompletableFuture
            .supplyAsync(() -> orderClient.getRecentOrders(userId), executor);
        
        CompletableFuture<Wallet> walletFuture = CompletableFuture
            .supplyAsync(() -> walletClient.getBalance(userId), executor);
        
        CompletableFuture<List<Notification>> notifFuture = CompletableFuture
            .supplyAsync(() -> notifClient.getUnread(userId), executor)
            .exceptionally(ex -> Collections.emptyList()); // Graceful degradation
        
        CompletableFuture.allOf(profileFuture, ordersFuture, walletFuture, notifFuture)
            .join();
        
        return DashboardResponse.builder()
            .profile(profileFuture.join())
            .recentOrders(ordersFuture.join())
            .wallet(walletFuture.join())
            .notifications(notifFuture.join())
            .build();
    }
}
```

## 15.3 Kafka Consumer Concurrency

```java
@Configuration
public class KafkaConfig {
    
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, String> factory = 
            new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());
        factory.setConcurrency(3); // 3 consumer threads
        return factory;
    }
}

@Service
public class OrderEventConsumer {
    
    @KafkaListener(topics = "order-events", groupId = "order-processor",
                   concurrency = "5") // 5 concurrent consumer threads
    public void consume(ConsumerRecord<String, OrderEvent> record) {
        log.info("Processing order event on thread: {}", Thread.currentThread().getName());
        orderProcessor.process(record.value());
    }
}
```

## 15.4 Scheduled Tasks

```java
@Configuration
@EnableScheduling
public class SchedulerConfig implements SchedulingConfigurer {
    
    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setScheduler(schedulerExecutor());
    }
    
    @Bean
    public Executor schedulerExecutor() {
        return Executors.newScheduledThreadPool(5,
            r -> new Thread(r, "scheduler-" + System.nanoTime()));
    }
}

@Service
public class MaintenanceService {
    
    @Scheduled(fixedRate = 300000) // Every 5 minutes
    public void cleanupExpiredSessions() {
        sessionStore.removeExpired();
    }
    
    @Scheduled(cron = "0 0 2 * * ?") // Daily at 2 AM
    public void generateDailyReport() {
        reportService.generateAndSend();
    }
}
```

---

# Chapter 16: Performance Optimization

## 16.1 Thread Pool Tuning

### CPU-Bound vs IO-Bound

| Workload Type | Characteristics | Pool Size Formula |
|---|---|---|
| **CPU-Bound** | Computation-heavy, rarely waits | `N = number of CPU cores` |
| **IO-Bound** | Waiting for network/disk/DB | `N = cores × (1 + W/C)` |
| **Mixed** | Both compute and IO | Separate pools for each |

```
W = wait time (how long thread waits for IO)
C = compute time (how long thread uses CPU)

Example: 4-core machine, API calls that take 200ms (180ms wait, 20ms compute)
N = 4 × (1 + 180/20) = 4 × 10 = 40 threads for IO pool
```

### Production Configuration
```java
@Bean("ioPool")
public ExecutorService ioPool() {
    int cores = Runtime.getRuntime().availableProcessors();
    return new ThreadPoolExecutor(
        cores * 2,                     // Core: 2× cores
        cores * 8,                     // Max: 8× cores under burst
        60, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(500), // Bounded!
        new ThreadPoolExecutor.CallerRunsPolicy()
    );
}

@Bean("cpuPool")
public ExecutorService cpuPool() {
    int cores = Runtime.getRuntime().availableProcessors();
    return new ThreadPoolExecutor(
        cores, cores,                  // Fixed size = cores
        0, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(100)
    );
}
```

## 16.2 Blocking vs Non-Blocking

```java
// BLOCKING: Thread is idle while waiting (wastes thread)
String result = restTemplate.getForObject(url, String.class); // Thread sleeps during IO

// NON-BLOCKING: Thread is free to do other work
WebClient.create(url)
    .get()
    .retrieve()
    .bodyToMono(String.class)
    .subscribe(result -> processResult(result)); // Callback on completion
```

## 16.3 Key Best Practices

```
1. NEVER use Executors.newCachedThreadPool() in production
   → Unbounded thread creation can crash your JVM

2. ALWAYS use bounded queues
   → LinkedBlockingQueue without capacity = unbounded = OOM risk

3. ALWAYS name your threads
   → Debugging "pool-3-thread-7" is miserable; "order-processor-3" is clear

4. ALWAYS set a rejection policy
   → CallerRunsPolicy provides natural backpressure

5. SEPARATE thread pools for CPU and IO tasks
   → IO-bound tasks blocking CPU pool = starvation

6. Monitor thread pool metrics
   → active threads, queue size, rejected tasks, completion time
```

---

# Chapter 17: Common Production Issues

## 17.1 Thread Starvation

### Problem
All threads in a pool are busy (or blocked), and new tasks can't execute.
```java
// Example: All 10 threads blocked on a slow database
ExecutorService pool = Executors.newFixedThreadPool(10);
for (int i = 0; i < 100; i++) {
    pool.submit(() -> {
        // Slow database query that takes 30 seconds
        jdbcTemplate.query("SELECT * FROM huge_table", rowMapper);
        // All 10 threads stuck here, remaining 90 tasks wait in queue
    });
}
```

### Solution
```java
// 1. Use separate pools for different task types
// 2. Add timeouts to IO operations
// 3. Use circuit breakers (Resilience4j)
// 4. Monitor queue depth and active thread count
```

## 17.2 Memory Leaks with ThreadLocal

```java
// PROBLEM: ThreadLocal not cleaned up in thread pool
public class UserContext {
    private static final ThreadLocal<UserData> userData = new ThreadLocal<>();
    
    public static void set(UserData data) { userData.set(data); }
    public static UserData get() { return userData.get(); }
    // Missing: remove()!
}

// In thread pool: Thread handles Request A, sets UserData for User #1
// Thread returns to pool
// Next Request B gets the same thread → still sees User #1's data!

// SOLUTION: Always clean up
public static void clear() { userData.remove(); }
// Call in finally block, filter, or interceptor
```

## 17.3 Excessive Thread Creation

```java
// ANTI-PATTERN: Creating new thread for every request
@GetMapping("/api/data")
public ResponseEntity<Data> getData() {
    new Thread(() -> cacheService.refresh()).start(); // New thread every request!
    return ResponseEntity.ok(data);
}

// FIX: Use a thread pool
@Async("taskExecutor") // Bounded, managed thread pool
public void refreshCache() { cacheService.refresh(); }
```

## 17.4 Blocking Operations in Reactive/Async Pipelines

```java
// PROBLEM: Blocking call in CompletableFuture using common pool
CompletableFuture.supplyAsync(() -> {
    return restTemplate.getForObject(url, Data.class); // BLOCKS a ForkJoinPool thread!
});

// FIX: Use a dedicated IO executor
CompletableFuture.supplyAsync(() -> {
    return restTemplate.getForObject(url, Data.class);
}, ioExecutor); // IO pool designed for blocking calls
```

---
