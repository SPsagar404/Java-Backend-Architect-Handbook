
# Chapter 13: Deadlocks

## 13.1 What is a Deadlock?

A **deadlock** is a situation where two or more threads are **permanently blocked**, each waiting for a lock held by the other.

### Why Deadlocks Are Critical
- The application **hangs silently** — no exception is thrown, no error logged
- Affects only the deadlocked threads initially, but cascades as other threads wait for the same locks
- In production, deadlocks often appear only under **high load** (when thread timing changes)
- They are **permanent** — the application will never recover without intervention

### Real-World Production Scenarios
| Scenario | What Happens |
|---|---|
| Money transfer between two accounts | Thread A locks Account-1, Thread B locks Account-2, both wait for the other |
| Distributed lock across microservices | Service A holds Lock-X, Service B holds Lock-Y, circular dependency |
| Database row-level locks | Transaction 1 locks Row A, Transaction 2 locks Row B, both try to update the other |
| Spring bean circular dependency | BeanA depends on BeanB, BeanB depends on BeanA during initialization |

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

## 13.6 Livelock — The Invisible Deadlock

A **livelock** is when threads keep responding to each other but make **no progress**. Unlike a deadlock (threads are frozen), a livelock has threads actively running but doing useless work.

```java
// Real-world analogy: Two people in a hallway keep stepping aside for each other
// Both are "active" but neither makes progress

// Code Example: Livelock in a transfer system
public boolean transfer(Account from, Account to, BigDecimal amount) {
    while (true) {
        if (from.getLock().tryLock()) {
            try {
                if (to.getLock().tryLock()) {
                    try {
                        from.debit(amount);
                        to.credit(amount);
                        return true;
                    } finally {
                        to.getLock().unlock();
                    }
                }
            } finally {
                from.getLock().unlock();
            }
        }
        // Both threads reach here simultaneously, retry, clash again = LIVELOCK!
    }
}

// FIX: Add random backoff
if (!to.getLock().tryLock()) {
    from.getLock().unlock();
    Thread.sleep(ThreadLocalRandom.current().nextInt(1, 10));  // Random backoff
}
```

```
Deadlock vs Livelock vs Starvation:
────────────────────────────────────
  Deadlock:    Threads FROZEN, waiting for each other
               → CPU idle, detected by jstack/ThreadMXBean
  
  Livelock:    Threads ACTIVE, but doing useless work repeatedly
               → CPU busy, harder to detect (looks like working!)
  
  Starvation:  Thread never gets CPU time or lock access
               → Usually caused by unfair locks + high-priority threads
               → Fix: use fair locks (new ReentrantLock(true))
```

## 13.7 Thread Leak Detection

A **thread leak** is when threads are created but never properly terminated. Over time, the JVM runs out of OS threads and crashes.

```java
// Common causes of thread leaks:
// 1. ExecutorService never shut down
// 2. Daemon threads with infinite loops and no interrupt check
// 3. Thread pools created inside methods (new pool per request!)

// Detection: Monitor thread count over time
@Scheduled(fixedRate = 60000)
public void detectThreadLeak() {
    int threadCount = Thread.activeCount();
    log.info("Active threads: {}", threadCount);
    
    if (threadCount > 500) {
        log.error("THREAD LEAK DETECTED! {} active threads", threadCount);
        // Take thread dump for analysis
        ThreadMXBean bean = ManagementFactory.getThreadMXBean();
        ThreadInfo[] infos = bean.dumpAllThreads(true, true);
        for (ThreadInfo info : infos) {
            log.error(info.toString());
        }
    }
}
```

### Deadlock Prevention Checklist (Code Review)

```
Code Review Checklist for Lock Safety:
────────────────────────────────────────
☐ Do all locks have a consistent global ordering?
☐ Are all lock acquisitions wrapped in try-finally with unlock()?
☐ Are there timeouts on all lock acquisitions (tryLock with timeout)?
☐ Are nested locks minimized or eliminated?
☐ Are external calls (REST, DB) made outside of lock scope?
☐ Are thread pools properly shut down in @PreDestroy?
☐ Are ThreadLocal values cleaned up with remove()?
☐ Are all executors using bounded queues?
☐ Is there monitoring for active threads and queue depth?
☐ Are InterruptedExceptions handled properly (not swallowed)?
```

---

# Chapter 14: Thread Safety Design Patterns

### Why Thread Safety Patterns Matter
There are exactly **three strategies** to achieve thread safety. Every pattern falls into one of these categories:

| Strategy | How It Works | Example Patterns |
|---|---|---|
| **Don't share state** | Each thread has its own data | ThreadLocal, immutable value objects |
| **Share immutable state** | Data cannot change after creation | Immutable objects, final fields |
| **Synchronize access** | Only one thread accesses at a time | synchronized, locks, atomic variables |

> **Architect's Principle:** Always prefer immutability and no-sharing over synchronization. Synchronization is the most error-prone approach.

## 14.1 Immutable Objects

### What are Immutable Objects?
Objects whose state **cannot change after construction**. Inherently thread-safe — no synchronization needed.

### Why Use Immutable Objects for Thread Safety
- **Zero synchronization overhead** — no locks, no volatile, no atomic operations
- **No race conditions possible** — if the data cannot change, concurrent reads are always safe
- **Safe to share freely** — pass between threads, store in caches, return from methods
- **Easier to reason about** — the object you have will never change unexpectedly

### When to Use
- Configuration objects, DTOs, value objects, keys in maps
- Any object shared across threads where mutation is not needed

### When NOT to Use
- Objects that MUST be updated frequently (use AtomicReference or synchronized instead)
- Very large objects where copying is expensive

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

### What is ThreadLocal?
Each thread gets its **own copy** of a variable. No sharing → no synchronization needed.

### Why ThreadLocal Exists
Sometimes you need per-request data (current user, transaction ID, locale) that flows through many method calls. Passing it as a parameter to every method is impractical. ThreadLocal makes it **implicitly available** to any code running on the same thread.

### When to Use
- Per-request context in web applications (user identity, correlation ID)
- Database connections (connection-per-thread pattern)
- `SimpleDateFormat` instances (not thread-safe, ThreadLocal fixes it)

### When NOT to Use
- **With thread pools** — ThreadLocal values leak between requests unless explicitly cleaned up
- **With async/reactive code** — tasks may switch threads mid-execution
- **For sharing data between threads** — ThreadLocal is per-thread, not shared

> **Production Warning:** ALWAYS call `ThreadLocal.remove()` in a `finally` block or interceptor. In thread pools, a thread is reused for the next request — if you don't clean up, the next request sees the previous request's data. This is a **security vulnerability**.

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

## 14.6 Immutability with Java Records (Java 16+)

Java Records provide the most concise way to create immutable data carriers:

```java
// Before Records: verbose immutable class
public final class OrderEvent {
    private final String orderId;
    private final BigDecimal amount;
    private final Instant timestamp;
    
    public OrderEvent(String orderId, BigDecimal amount, Instant timestamp) {
        this.orderId = orderId;
        this.amount = amount;
        this.timestamp = timestamp;
    }
    // + getters, equals, hashCode, toString (50+ lines)
}

// With Records: inherently immutable, thread-safe by design
public record OrderEvent(
    String orderId,
    BigDecimal amount,
    Instant timestamp
) {
    // Compact constructor for validation:
    public OrderEvent {
        Objects.requireNonNull(orderId, "orderId must not be null");
        if (amount.compareTo(BigDecimal.ZERO) < 0)
            throw new IllegalArgumentException("amount must be >= 0");
    }
}

// Thread-safe by design:
// • All fields are final (immutable)
// • No setters (state can't change)
// • Can be freely shared between threads without synchronization
// • Perfect for event objects, DTOs, and message payloads
```

## 14.7 Lock-Free State Management with AtomicReference

```java
// Pattern: Atomic configuration updates without locks
public class DynamicConfig {
    
    // Immutable config record
    public record AppConfig(int maxRetries, Duration timeout, boolean featureFlag) {}
    
    private final AtomicReference<AppConfig> config;
    
    public DynamicConfig(AppConfig initialConfig) {
        this.config = new AtomicReference<>(initialConfig);
    }
    
    // Thread-safe read (no lock needed)
    public AppConfig getConfig() {
        return config.get();  // Volatile read
    }
    
    // Thread-safe update (CAS, no lock needed)
    public void updateTimeout(Duration newTimeout) {
        config.updateAndGet(current -> 
            new AppConfig(current.maxRetries(), newTimeout, current.featureFlag()));
    }
    
    // Thread-safe conditional update
    public boolean enableFeature() {
        return config.compareAndSet(
            config.get(),  // expected
            new AppConfig(config.get().maxRetries(), config.get().timeout(), true)
        );
    }
}

// This pattern is used by:
//  - Spring Cloud Config refresh
//  - Feature flag systems (LaunchDarkly, Unleash)
//  - Dynamic routing tables
```

## 14.8 Thread-Safe Builder Pattern

```java
// Builder pattern is inherently thread-safe when used correctly:
// The builder itself is NOT shared — each thread creates its own builder
// The built object is immutable — safe to share across threads

public record HttpRequest(
    String url, String method, Map<String, String> headers, byte[] body
) {
    public static Builder builder() { return new Builder(); }
    
    public static class Builder {
        private String url;
        private String method = "GET";
        private final Map<String, String> headers = new HashMap<>();
        private byte[] body;
        
        public Builder url(String url) { this.url = url; return this; }
        public Builder method(String method) { this.method = method; return this; }
        public Builder header(String k, String v) { headers.put(k, v); return this; }
        public Builder body(byte[] body) { this.body = body; return this; }
        
        public HttpRequest build() {
            return new HttpRequest(
                url, method,
                Collections.unmodifiableMap(new HashMap<>(headers)),  // Defensive copy!
                body != null ? body.clone() : null  // Defensive copy!
            );
        }
    }
}

// Thread-safety guarantee:
// Builder is created and used by a SINGLE thread (no sharing needed)
// HttpRequest record is immutable (safe to share across any threads)
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

## 16.4 Reactive Programming vs Multithreading

```
Comparison: When to Use Which
────────────────────────────────

                      Traditional Multithreading    Reactive (WebFlux/RxJava)
 Thread per request:  1 thread = 1 request           1 thread = 1000s of requests
 Memory usage:        ~1MB per thread (stack)         ~KB per subscription
 Blocking IO:         Thread sleeps during IO         Event loop continues
 Programming model:   Imperative (familiar)           Declarative (learning curve)
 Debugging:           Stack traces are clear           Stack traces are cryptic
 Error handling:      try-catch (familiar)             onError operators
 Ecosystem support:   Spring MVC (mature)              Spring WebFlux (growing)
 Best for:            CPU-bound, simple IO             High-concurrency IO-bound
 Throughput ceiling:  ~10K concurrent (thread limit)   ~100K+ concurrent

Decision Framework:
  1. < 500 concurrent connections → Use traditional threads + Spring MVC
  2. 500-5000 concurrent → Consider virtual threads (Java 21) first
  3. > 5000 concurrent IO-bound → Consider reactive (WebFlux)
  4. CPU-bound workloads → Always traditional threads
  5. Team familiarity matters → Choose what your team can debug!
```

## 16.5 Virtual Threads Deep Dive (Project Loom, Java 21+)

```java
// Virtual threads fundamentally change the threading model:

// OLD MODEL: 1 platform thread per request (limited to ~10K concurrent)
@Configuration
public class TomcatConfig {
    // server.tomcat.threads.max=200  (OS THREAD LIMIT)
}

// NEW MODEL: 1 virtual thread per request (millions possible)
// application.properties:
// spring.threads.virtual.enabled=true  (Spring Boot 3.2+)

// What happens internally:
// 1. Virtual thread starts on a carrier (platform) thread
// 2. When virtual thread hits blocking IO (JDBC, HTTP, file read):
//    - Virtual thread is UNMOUNTED from carrier
//    - Carrier thread is FREE to run other virtual threads
// 3. When IO completes:
//    - Virtual thread is MOUNTED on any available carrier
//    - Execution continues seamlessly

// Diagram:
// Carrier threads (platform):  [C1] [C2] [C3] [C4]  (= CPU cores)
// Virtual threads:             [V1] [V2] [V3] ... [V1000000]
// 
// V1 runs on C1 → V1 blocks on IO → V1 unmounts → C1 picks up V47
// V1's IO completes → V1 mounts on C3 (any free carrier) → continues
```

```
Virtual Thread Caveats:
────────────────────────

1. PINNING: Virtual threads PIN to carrier when inside:
   - synchronized blocks/methods (cannot unmount!)
   - JNI/native code
   FIX: Replace synchronized with ReentrantLock

2. ThreadLocal: Works but each virtual thread gets its own copy
   Risk: 1 million virtual threads = 1 million ThreadLocal copies = OOM
   FIX: Use ScopedValue (Java 21 preview) instead of ThreadLocal

3. CPU-bound work: Virtual threads offer NO benefit
   They only help when threads spend most time WAITING (IO)

4. Thread pools: DON'T pool virtual threads
   They are cheap to create — just create a new one per task
   Use: Executors.newVirtualThreadPerTaskExecutor()
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

## 17.5 Production Thread Debugging Toolkit

### jcmd — The Modern Alternative to jstack

```
Production debugging commands:
──────────────────────────────

$ jcmd <PID> Thread.print              # Thread dump (like jstack, but better)
$ jcmd <PID> Thread.dump_to_file <f>   # Dump to file (Java 21+)
$ jcmd <PID> VM.native_memory summary  # Native memory usage
$ jcmd <PID> GC.heap_dump <file>       # Heap dump
$ jcmd <PID> VM.uptime                 # JVM uptime
$ jcmd <PID> VM.flags                  # All JVM flags

Java Flight Recorder (JFR) — Zero-overhead production profiling:
$ jcmd <PID> JFR.start name=recording duration=60s filename=recording.jfr
$ jcmd <PID> JFR.stop name=recording

Analyze JFR recording:
$ jfr print --events jdk.ThreadPark recording.jfr   # Thread parking events
$ jfr print --events jdk.JavaMonitorWait recording.jfr  # Lock wait events

Or use JDK Mission Control (jmc) GUI for visual analysis.
```

### Thread Dump Analysis Methodology (Step-by-Step)

```
5-Step Thread Dump Analysis:
───────────────────────────────

1. TAKE MULTIPLE DUMPS (3 dumps, 10 seconds apart)
   $ for i in 1 2 3; do jstack <PID> > dump_$i.txt; sleep 10; done

2. LOOK FOR DEADLOCKS (auto-detected by jstack)
   Search for: "Found one Java-level deadlock"

3. COUNT THREAD STATES
   $ grep "java.lang.Thread.State:" dump_1.txt | sort | uniq -c
     150 RUNNABLE          ← threads doing work or blocking on IO
      35 WAITING (parking)  ← idle pool threads (normal)
      15 BLOCKED            ← waiting for locks (problem if high)
       5 TIMED_WAITING      ← sleeping or waiting with timeout

4. IDENTIFY STUCK THREADS
   Compare dump_1, dump_2, dump_3:
   Thread in SAME STATE + SAME STACK in ALL 3 dumps = STUCK

5. FIND THE ROOT CAUSE
   For BLOCKED threads: follow the chain
     Thread-3 waiting for lock → held by Thread-1 → Thread-1 is doing what?
   For RUNNABLE but stuck (IO):
     Look at bottom of stack: SocketInputStream.read() = waiting on network
```

### Connection Pool Starvation Diagnosis

```java
// Symptom: All requests timeout, but CPU is low
// Root cause: All HikariCP connections are checked out, new requests wait forever

// Detection: HikariCP metrics
@Bean
public MeterBinder hikariMetrics(HikariDataSource ds) {
    return registry -> {
        Gauge.builder("hikari.active", ds, HikariDataSource::getHikariPoolMXBean)
             .description("Active connections").register(registry);
        Gauge.builder("hikari.pending", ds.getHikariPoolMXBean(),
             HikariPoolMXBean::getThreadsAwaitingConnection)
             .description("Threads waiting for connection").register(registry);
    };
}

// Prevention:
// spring.datasource.hikari.maximum-pool-size=20
// spring.datasource.hikari.connection-timeout=5000  (fail fast, don't hang)
// spring.datasource.hikari.leak-detection-threshold=10000  (detect leaks!!)
//
// When leak-detection-threshold is set, HikariCP logs a WARNING if a connection
// is held for more than 10 seconds — this catches forgotten close() calls.
```

---

# Chapter 18: Build It Yourself — Async Order Processing System

> **Goal:** Build a Spring Boot application that processes orders asynchronously using ThreadPool, CompletableFuture, BlockingQueue, and @Async.

## Concept Overview

| Component | Threading Pattern | Why |
|---|---|---|
| Order submission | `@Async` | Non-blocking — API returns immediately |
| Parallel API calls | `CompletableFuture.allOf()` | Call payment + inventory simultaneously |
| Background queue | `BlockingQueue` + workers | Producer-consumer decoupling |
| Thread pool | `ThreadPoolTaskExecutor` | Bounded pool prevents exhaustion |

---

## Step 1: Configure Thread Pool

**Concept:** Always use bounded pools in production. Never create raw threads.

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    @Bean("orderPool")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);               // 5 threads always alive
        executor.setMaxPoolSize(20);               // Scale to 20 under load
        executor.setQueueCapacity(100);            // Max 100 waiting tasks
        executor.setThreadNamePrefix("order-");    // Named for debugging
        executor.setRejectedExecutionHandler(
            new ThreadPoolExecutor.CallerRunsPolicy());  // Backpressure
        executor.initialize();
        return executor;
    }
}
```

**Key Takeaways:**
- `corePoolSize` = threads always alive (even idle)
- `queueCapacity` = MUST be bounded (prevent OOM)
- `CallerRunsPolicy` = slows producer when overwhelmed

---

## Step 2: Build Async Order Service

**Concept:** `@Async` runs method in background thread. `CompletableFuture.allOf()` runs multiple calls in parallel.

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final PaymentClient paymentClient;
    private final InventoryClient inventoryClient;

    @Async("orderPool")
    public CompletableFuture<OrderResult> processOrderAsync(OrderRequest request) {
        log.info("Processing on thread: {}", Thread.currentThread().getName());

        // PARALLEL calls — 200ms total instead of 400ms sequential
        CompletableFuture<PaymentResult> payment = CompletableFuture
            .supplyAsync(() -> paymentClient.charge(request.getPayment()));
        CompletableFuture<InventoryResult> inventory = CompletableFuture
            .supplyAsync(() -> inventoryClient.reserve(request.getItems()));

        CompletableFuture.allOf(payment, inventory).join();

        return CompletableFuture.completedFuture(
            new OrderResult(payment.join().getTxnId(), inventory.join().getReservationId()));
    }
}
```

---

## Step 3: Create Producer-Consumer Queue

**Concept:** BlockingQueue decouples submission from processing. Producers add, consumers process independently.

```java
@Service
public class OrderQueueService {

    private final BlockingQueue<OrderRequest> queue =
        new LinkedBlockingQueue<>(10_000);          // Bounded queue

    public boolean submit(OrderRequest order) {
        return queue.offer(order);                  // Non-blocking, returns false if full
    }

    @PostConstruct
    public void startConsumers() {
        for (int i = 0; i < 5; i++) {
            Thread worker = new Thread(() -> {
                while (!Thread.currentThread().isInterrupted()) {
                    try {
                        OrderRequest order = queue.take();   // Blocks until available
                        processOrder(order);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
            }, "order-worker-" + i);
            worker.setDaemon(true);
            worker.start();
        }
    }
}
```

---

## Step 4: REST Controller

```java
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired private OrderService orderService;

    @PostMapping
    public ResponseEntity<String> submitOrder(@RequestBody OrderRequest request) {
        orderService.processOrderAsync(request);    // Returns immediately
        return ResponseEntity.accepted().body("Order submitted");
    }
}
```

---

## Key Takeaways

| Pattern | Use When | Avoid When |
|---|---|---|
| `@Async` | Fire-and-forget (emails, logs) | Need result immediately |
| `CompletableFuture.allOf()` | Parallel independent calls | Sequential dependencies |
| `BlockingQueue` + consumers | High-throughput processing | Simple one-off tasks |
| `ThreadPoolTaskExecutor` | Always in production | Never create raw threads |

---
