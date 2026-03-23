# Mastering Java Multithreading & Concurrency – Internals, Architecture, and Enterprise Usage Guide

---

**Author:** Senior Java Architect  
**Target Audience:** Java developers with 3+ years of experience aiming for senior/architect-level roles  
**Prerequisites:** Core Java, Spring Boot, REST APIs, Microservices basics  

---

# Table of Contents

1. [Introduction to Multithreading](#chapter-1-introduction-to-multithreading)
2. [Process vs Thread](#chapter-2-process-vs-thread)
3. [Java Thread Lifecycle](#chapter-3-java-thread-lifecycle)
4. [Creating Threads in Java](#chapter-4-creating-threads-in-java)
5. [Synchronization](#chapter-5-synchronization)
6. [Inter-Thread Communication](#chapter-6-inter-thread-communication)
7. [Locks Framework](#chapter-7-locks-framework)
8. [Java Concurrent Collections](#chapter-8-java-concurrent-collections)
9. [Executor Framework](#chapter-9-executor-framework)
10. [CompletableFuture (Java 8+)](#chapter-10-completablefuture-java-8)
11. [Fork/Join Framework](#chapter-11-forkjoin-framework)
12. [Parallel Streams](#chapter-12-parallel-streams)
13. [Deadlocks](#chapter-13-deadlocks)
14. [Thread Safety Design Patterns](#chapter-14-thread-safety-design-patterns)
15. [Multithreading in Spring Boot Applications](#chapter-15-multithreading-in-spring-boot-applications)
16. [Performance Optimization](#chapter-16-performance-optimization)
17. [Common Production Issues](#chapter-17-common-production-issues)
18. [Interview Questions (60+)](#chapter-18-interview-questions)
19. [Coding Problems (20 Exercises)](#chapter-19-coding-problems)
20. [Best Practices](#chapter-20-best-practices)

---

# Chapter 1: Introduction to Multithreading

## 1.1 What is Multithreading?

**Multithreading** is the ability of a CPU (or a single process) to execute multiple threads concurrently. Each thread is an independent path of execution within a process. In Java, every application starts with at least one thread — the **main thread** — and can create additional threads to perform work in parallel.

```java
public class Main {
    public static void main(String[] args) {
        // This is the "main" thread
        System.out.println("Current thread: " + Thread.currentThread().getName());
        // Output: Current thread: main
    }
}
```

### Concurrency vs Parallelism

| Concept | Description | Example |
|---|---|---|
| **Concurrency** | Multiple tasks make progress in overlapping time periods (interleaving on a single core) | A single barista handling 3 coffee orders by switching between them |
| **Parallelism** | Multiple tasks execute at the exact same instant (multiple cores) | Three baristas each making one coffee simultaneously |

Java's threading model supports **both** through the JVM's thread scheduler and the OS kernel.

### How JVM Maps Java Threads to OS Threads

Since Java 1.2, the HotSpot JVM uses a **1:1 threading model** — every `java.lang.Thread` maps directly to a native OS thread (POSIX thread on Linux, Win32 thread on Windows).

```
Java World                           OS World
┌──────────────────┐                ┌───────────────────┐
│  Thread t1       │ ──── JNI ──→  │  pthread_create()  │  Linux
│  Thread t2       │ ──── JNI ──→  │  CreateThread()    │  Windows
│  Thread t3       │ ──── JNI ──→  │  pthread_create()  │  Linux
└──────────────────┘                └───────────────────┘
                                         │
                                    OS Scheduler
                                    (CFS on Linux)
                                         │
                                    ┌────┴────┐
                                    │ CPU     │
                                    │ Cores   │
                                    └─────────┘

Thread.start() → native start0() → JVM_StartThread() → OS thread created
```

**What this means in practice:**
- Java thread scheduling is delegated to the **OS scheduler** (Completely Fair Scheduler on Linux)
- Java's `Thread.setPriority()` maps to OS priority levels (but mapping varies by OS)
- Thread context switching is handled at the kernel level
- Each Java thread consumes a real OS thread, which means you are bounded by OS limits (~30,000 threads per process on most systems)

### CPU Architecture and its Impact on Multithreading

Understanding CPU hardware is critical for writing high-performance concurrent code:

```
Modern CPU Architecture (8-core, 16-thread CPU):
┌──────────────────────────────────────────────────────┐
│  CPU Package                                          │
│                                                       │
│  Core 0          Core 1          Core 2    ...  Core 7│
│  ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│  │ HT-0 HT-1│   │ HT-0 HT-1│   │ HT-0 HT-1│         │
│  │ L1 Cache │   │ L1 Cache │   │ L1 Cache │         │
│  │ (64KB)   │   │ (64KB)   │   │ (64KB)   │         │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘         │
│       │              │              │                 │
│  ┌────┴──────────────┴──────────────┴────┐           │
│  │           L2 Cache (256KB per core)    │           │
│  └────────────────────┬──────────────────┘           │
│                       │                               │
│  ┌────────────────────┴──────────────────────────┐   │
│  │          L3 Cache (Shared, 16-32MB)            │   │
│  └───────────────────────────────────────────────┘   │
│                       │                               │
│  ┌────────────────────┴──────────────────────────┐   │
│  │               Main Memory (RAM)                │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘

Key Facts for Java Developers:
─────────────────────────────
• L1 cache access: ~1 ns     (fastest, per-core)
• L2 cache access: ~4 ns
• L3 cache access: ~12 ns    (shared across cores)
• Main memory:     ~100 ns   (100x slower than L1!)
• Cache line size:  64 bytes  (unit of data transfer between cache and memory)

Why this matters:
• volatile forces reads/writes through to main memory, bypassing cache
• false sharing occurs when two threads modify data on the same 64-byte cache line
• Thread-local data is fast because it stays in L1 cache
• Hyper-threading shares a core's resources — two HTs on one core are NOT the same as two cores
```

### Amdahl's Law — The Ceiling of Parallelism

**Amdahl's Law** defines the theoretical maximum speedup from parallelism. No matter how many cores you add, the sequential portion of your code limits the total speedup.

```
Formula:
              1
Speedup = ─────────────────
          S + (1 - S) / N

Where:
  S = fraction of code that is sequential (cannot be parallelized)
  N = number of processor cores

Example Calculations:
─────────────────────
If 10% of your code is sequential (S = 0.1):
  4 cores:   1 / (0.1 + 0.9/4)   = 1 / 0.325  = 3.08x speedup
  8 cores:   1 / (0.1 + 0.9/8)   = 1 / 0.2125 = 4.71x speedup
  16 cores:  1 / (0.1 + 0.9/16)  = 1 / 0.156  = 6.40x speedup
  ∞ cores:   1 / 0.1             = 10x speedup  ← MAXIMUM POSSIBLE!

If 50% of your code is sequential (S = 0.5):
  4 cores:   1 / (0.5 + 0.5/4)   = 1 / 0.625  = 1.6x speedup
  ∞ cores:   1 / 0.5             = 2x speedup   ← MAXIMUM!
```

> **Production Insight:** In backend services, the "sequential" portion is often the time spent on shared locks (synchronized blocks). Reducing lock contention has a bigger impact on scalability than adding more cores. This is why `ConcurrentHashMap` (fine-grained locking) is so much faster than `Hashtable` (single global lock).

### Green Threads vs OS Threads vs Virtual Threads

| Feature | Green Threads (JDK 1.0) | OS/Platform Threads (JDK 1.2+) | Virtual Threads (JDK 21+) |
|---|---|---|---|
| **Managed by** | JVM | OS kernel | JVM (mounted on carrier threads) |
| **Memory per thread** | ~KB | ~1 MB (stack) | ~KB (resizable stack) |
| **Max threads per JVM** | Thousands | ~10,000–30,000 | **Millions** |
| **Scheduling** | JVM cooperative | OS preemptive | JVM (continuation-based) |
| **True parallelism** | No (single OS thread) | Yes | Yes (via carrier threads) |
| **Blocking cost** | Blocks all threads | Blocks one OS thread | Unmounts from carrier, carrier reused |
| **Use case** | Deprecated | Current standard | Future standard for IO-bound |

```java
// Platform thread (current standard):
Thread platformThread = new Thread(() -> doWork());
platformThread.start(); // Creates OS thread (~1MB memory)

// Virtual thread (Java 21+):
Thread virtualThread = Thread.ofVirtual().start(() -> doWork());
// Uses ~few KB, millions can coexist

// Virtual thread executor (Java 21+):
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            // Each task gets its own virtual thread
            // Blocking IO automatically unmounts the virtual thread
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        });
    }
}
```

> **Senior Engineer Perspective:** Virtual threads (Project Loom) are a game-changer for IO-bound workloads. They eliminate the need for reactive programming frameworks (WebFlux, RxJava) in many scenarios by making blocking calls cheap. However, they do NOT help with CPU-bound tasks — for those, the number of platform threads (= CPU cores) remains the bottleneck.

---

## 1.2 Why Multithreading is Needed

### In Enterprise Backend Systems

| Problem | Single-Threaded | Multi-Threaded |
|---|---|---|
| Handling 10,000 concurrent API requests | Requests queued, >10s response time | Multiple threads serve requests simultaneously, <200ms |
| Calling 5 microservices for one response | Sequential: 5×200ms = 1000ms | Parallel: max(200ms) = 200ms |
| Processing 1M database records | ~30 minutes | ~5 minutes (parallel batches) |
| Real-time event streaming | Backpressure, missed events | Dedicated consumer threads handle throughput |

### Key Benefits

1. **Responsiveness** – UI and API endpoints remain responsive while background work runs
2. **Resource Utilization** – Uses idle CPU cores instead of wasting them
3. **Throughput** – More work completed in the same time
4. **Scalability** – Handle more concurrent users/requests
5. **Asynchronous Processing** – Fire-and-forget for non-critical tasks (emails, logging, analytics)

### Drawbacks

1. **Complexity** – Harder to reason about, debug, and test
2. **Race Conditions** – Shared mutable state leads to data corruption
3. **Deadlocks** – Threads waiting for each other indefinitely
4. **Memory Overhead** – Each thread consumes ~512KB-1MB stack memory
5. **Context Switching** – CPU overhead switching between threads

---

## 1.3 Real-World Production Use Cases

### Use Case 1: High-Traffic Backend Service
```java
// Tomcat handles each HTTP request in a separate thread (thread-per-request model)
// Default: 200 threads in Spring Boot's embedded Tomcat
@RestController
public class OrderController {
    @GetMapping("/api/orders/{id}")
    public ResponseEntity<OrderDTO> getOrder(@PathVariable Long id) {
        // Each request runs in its own Tomcat worker thread
        // Thread: http-nio-8080-exec-1, http-nio-8080-exec-2, etc.
        return ResponseEntity.ok(orderService.findById(id));
    }
}
```

### Use Case 2: Parallel API Calls in Microservices
```java
@Service
public class DashboardService {
    
    public DashboardDTO buildDashboard(Long userId) {
        // Sequential: 200 + 150 + 100 = 450ms
        // Parallel:   max(200, 150, 100) = 200ms  → 56% faster!
        
        CompletableFuture<UserProfile> userFuture = 
            CompletableFuture.supplyAsync(() -> userService.getProfile(userId));
        CompletableFuture<List<Order>> ordersFuture = 
            CompletableFuture.supplyAsync(() -> orderService.getRecent(userId));
        CompletableFuture<WalletBalance> walletFuture = 
            CompletableFuture.supplyAsync(() -> walletService.getBalance(userId));
        
        CompletableFuture.allOf(userFuture, ordersFuture, walletFuture).join();
        
        return new DashboardDTO(
            userFuture.join(), ordersFuture.join(), walletFuture.join()
        );
    }
}
```

### Use Case 3: Batch Processing
```java
@Service
public class ReportGenerationService {
    
    @Async("reportExecutor")
    public void generateMonthlyReport(YearMonth month) {
        // Runs in a background thread, doesn't block the API call
        List<Transaction> txns = transactionRepo.findByMonth(month);
        byte[] pdf = pdfGenerator.create(txns);
        storageService.upload("reports/" + month + ".pdf", pdf);
        emailService.notify("Report ready for " + month);
    }
}
```

### Use Case 4: Kafka Consumer Processing
```java
@KafkaListener(topics = "order-events", concurrency = "5")
public void consume(OrderEvent event) {
    // 5 consumer threads process messages in parallel
    // Each partition is consumed by exactly one thread
    orderProcessor.process(event);
}
```

---

# Chapter 2: Process vs Thread

## 2.1 What is a Process?

A **process** is an independent program in execution with its own **memory space** (heap, stack, code, data segments). The operating system allocates separate resources to each process.

```
┌────────────────────── Process A ──────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │   Code   │  │   Data   │  │   Heap   │            │
│  │ Segment  │  │ Segment  │  │ (Dynamic)│            │
│  └──────────┘  └──────────┘  └──────────┘            │
│  ┌──────────┐                                         │
│  │  Stack   │  ← One stack per thread                 │
│  └──────────┘                                         │
│  PID: 1234  │  Memory: 256MB  │  Own file handles     │
└───────────────────────────────────────────────────────┘

┌────────────────────── Process B ──────────────────────┐
│  Completely separate memory space                      │
│  Cannot access Process A's memory directly             │
│  PID: 5678  │  Memory: 128MB  │  Own file handles     │
└───────────────────────────────────────────────────────┘
```

## 2.2 What is a Thread?

A **thread** is a lightweight unit of execution **within a process**. Threads within the same process **share the heap memory** but have their own **stack**.

```
┌─────────────────────── Process (JVM) ──────────────────────┐
│                                                             │
│   Shared Memory                                             │
│   ┌────────────────────────────────────────┐                │
│   │  Heap (Objects, Instance Variables)     │                │
│   │  Method Area (Class data, static vars)  │                │
│   │  Code Segment                           │                │
│   └────────────────────────────────────────┘                │
│                                                             │
│   Thread 1 (main)    Thread 2          Thread 3             │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│   │  Stack   │      │  Stack   │      │  Stack   │         │
│   │ (local   │      │ (local   │      │ (local   │         │
│   │  vars)   │      │  vars)   │      │  vars)   │         │
│   │  PC      │      │  PC      │      │  PC      │         │
│   └──────────┘      └──────────┘      └──────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 2.3 Detailed Comparison

| Feature | Process | Thread |
|---|---|---|
| **Definition** | Independent program in execution | Lightweight execution unit within a process |
| **Memory** | Own memory space (isolated) | Shares heap with other threads; own stack |
| **Creation Cost** | Heavy (OS allocates memory, resources) | Lightweight (~512KB-1MB stack) |
| **Communication** | IPC (sockets, pipes, shared files) | Direct via shared heap memory |
| **Context Switch** | Expensive (full memory context swap) | Cheaper (shared address space) |
| **Crash Impact** | One process crash doesn't affect others | One thread crash can kill the entire process |
| **Isolation** | Full isolation | No memory isolation between threads |
| **Example** | Two separate JVM instances | Multiple threads inside one Spring Boot app |

### Context Switching

```
Context Switch Between PROCESSES (Expensive):
─────────────────────────────────────────────
1. Save entire CPU state (registers, PC, stack pointer)
2. Save memory mappings (page table)
3. Flush TLB (Translation Lookaside Buffer)
4. Load new process memory mappings
5. Restore new process CPU state
→ Cost: ~1-10 microseconds

Context Switch Between THREADS (Cheaper):
─────────────────────────────────────────
1. Save CPU state (registers, PC, stack pointer)
2. Load new thread's CPU state
(No memory mapping change - same process!)
→ Cost: ~0.1-1 microseconds
```

### Backend Scenario
```java
// PROCESS-level parallelism: Microservices are separate processes
// UserService (PID 1001) — separate JVM
// OrderService (PID 1002) — separate JVM
// PaymentService (PID 1003) — separate JVM

// THREAD-level parallelism: Within each service
// UserService has 200 Tomcat threads handling HTTP requests concurrently
// All 200 threads share the same heap (Spring beans, caches, etc.)
```

### JVM Per-Thread Memory Layout (Deep Dive)

Each Java thread gets its own dedicated memory regions. Understanding this is essential for diagnosing `StackOverflowError` and tuning memory:

```
Per-Thread Memory (Private to each thread):
┌─────────────────────────────────────────────────────┐
│  Thread Stack (default: -Xss512k to -Xss1m)         │
│  ┌─────────────────────────────────────────────────┐│
│  │ Stack Frame: main()                              ││
│  │   - Local variables: int x = 5                   ││
│  │   - Operand stack: [5, 10]                       ││
│  │   - Return address                               ││
│  ├─────────────────────────────────────────────────┤│
│  │ Stack Frame: processOrder(Order o)               ││
│  │   - Local variables: Order ref, String s         ││
│  │   - Operand stack                                ││
│  ├─────────────────────────────────────────────────┤│
│  │ Stack Frame: validatePayment(Payment p)          ││
│  │   - (each method call adds a frame)              ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  Program Counter (PC Register)                       │
│  - Address of current bytecode instruction           │
│  - Undefined for native methods                      │
│                                                      │
│  Native Method Stack                                 │
│  - For JNI calls (C/C++ code)                        │
│  - Separate from Java stack                          │
└─────────────────────────────────────────────────────┘

Memory Calculation for 200 Tomcat threads:
  Default stack:  512KB × 200 = 100 MB just for thread stacks!
  With 1MB:       1MB × 200   = 200 MB
  
  Production tip: Use -Xss512k for web servers (most methods have 
  shallow call stacks). Use -Xss1m or more for deep recursion.
```

### Context Switching: Hidden Performance Killer

Context switching is more expensive than the raw time cost suggests because of **cache pollution**:

```
What actually happens during a thread context switch:
──────────────────────────────────────────────────────

Step 1: Save State (~100 ns)
  - Save all CPU registers (16 general-purpose + flags + FPU)
  - Save stack pointer and program counter
  - Save thread-local storage pointer

Step 2: Scheduler Decision (~200 ns)
  - OS scheduler picks next thread (CFS on Linux)
  - Update scheduling statistics

Step 3: Restore State (~100 ns)
  - Load new thread's registers
  - Load new thread's stack pointer

Step 4: CACHE WARM-UP (the real cost!! ~1,000-10,000 ns)
  - New thread accesses different data
  - L1 cache misses (data for old thread, not new)
  - L2 cache misses (pipeline stalls)
  - TLB misses (for process switches)
  
Real-world impact:
  Measured switch cost:  ~1-5 μs (direct overhead)
  Cache pollution cost:  ~5-50 μs (indirect, measured by slowdown)
  
  At 10,000 context switches/second:
    Direct cost:   10K × 5μs  = 50ms  (5% of one CPU)  
    Indirect cost: 10K × 25μs = 250ms (25% of one CPU!) ← the REAL problem

How to check context switching on Linux:
  $ vmstat 1          # Look at 'cs' column
  $ pidstat -w -p PID # Per-process context switches
```

> **Production Insight:** If your JVM application shows high context switching (`> 50,000/sec`), you likely have too many threads competing for too few cores. The fix is NOT adding more threads — it's reducing thread count, using non-blocking IO, or switching to virtual threads.

### When to Use Processes vs Threads (Senior Decision Framework)

```
Decision Framework:
──────────────────

Use PROCESSES (separate JVMs) when:
  ✓ Need fault isolation (crash in one service shouldn't kill others)
  ✓ Different scaling requirements (user service: 4 instances, payment: 2)
  ✓ Different technology stacks (Java + Python + Go)
  ✓ Independent deployment lifecycle
  → This is why microservices are separate processes

Use THREADS (within one JVM) when:
  ✓ Need to share memory (caches, connection pools, state)
  ✓ Communication must be ultra-fast (no serialization, no network)
  ✓ Tasks are tightly coupled and need consistent view of data
  ✓ Low-latency requirements (IPC overhead too high)
  → This is why web servers use thread pools, not process pools
```

---

# Chapter 3: Java Thread Lifecycle

## 3.1 Thread States

Java defines **6 thread states** in `java.lang.Thread.State`:

```
                    ┌─────────┐
         start()    │         │
    ┌──────────────→│RUNNABLE │←───────────────────────────┐
    │               │         │                             │
┌───┴───┐           └────┬────┘                             │
│  NEW  │                │                                  │
└───────┘                │                                  │
                    ┌────┴────┐                              │
                    │ enters  │                              │
                    │sync block│                             │
                    │(locked) │                              │
                    └────┬────┘                              │
                         ↓                                   │
                    ┌─────────┐     lock acquired           │
                    │ BLOCKED │─────────────────────────────┘
                    └─────────┘
                         
    From RUNNABLE:
                    ┌─────────────┐   notify()/              
     wait()         │   WAITING   │   notifyAll()           
    ────────────→   │             │────────────→ RUNNABLE    
                    └─────────────┘                          
                         
     sleep(ms)      ┌─────────────┐   timeout/              
     wait(ms)       │TIMED_WAITING│   notify()              
    ────────────→   │             │────────────→ RUNNABLE    
                    └─────────────┘                          
                         
     run() ends     ┌─────────────┐
    ────────────→   │ TERMINATED  │
                    └─────────────┘
```

## 3.2 State Descriptions

### NEW
Thread object created but `start()` not yet called.
```java
Thread t = new Thread(() -> System.out.println("Hello"));
System.out.println(t.getState()); // NEW
```

### RUNNABLE
Thread is executing or ready to execute (in the OS run queue). Java does not distinguish between "running" and "ready."
```java
Thread t = new Thread(() -> {
    while (true) { /* busy */ }
});
t.start();
System.out.println(t.getState()); // RUNNABLE
```

### BLOCKED
Thread is waiting to acquire a **monitor lock** (intrinsic lock) held by another thread.
```java
Object lock = new Object();

Thread t1 = new Thread(() -> {
    synchronized (lock) {
        try { Thread.sleep(10000); } catch (InterruptedException e) {}
    }
});

Thread t2 = new Thread(() -> {
    synchronized (lock) { // t2 BLOCKED here waiting for lock held by t1
        System.out.println("Got lock!");
    }
});

t1.start();
Thread.sleep(100);
t2.start();
Thread.sleep(100);
System.out.println(t2.getState()); // BLOCKED
```

### WAITING
Thread is waiting indefinitely for another thread to perform a specific action.
Caused by: `Object.wait()`, `Thread.join()`, `LockSupport.park()`
```java
Object lock = new Object();
Thread t = new Thread(() -> {
    synchronized (lock) {
        try { lock.wait(); } catch (InterruptedException e) {} // WAITING until notify()
    }
});
t.start();
Thread.sleep(100);
System.out.println(t.getState()); // WAITING
```

### TIMED_WAITING
Thread is waiting for a specified period of time.
Caused by: `Thread.sleep(ms)`, `Object.wait(ms)`, `Thread.join(ms)`, `LockSupport.parkNanos()`
```java
Thread t = new Thread(() -> {
    try { Thread.sleep(5000); } catch (InterruptedException e) {}
});
t.start();
Thread.sleep(100);
System.out.println(t.getState()); // TIMED_WAITING
```

### TERMINATED
Thread has completed execution (either normally or via exception).
```java
Thread t = new Thread(() -> System.out.println("Done"));
t.start();
t.join(); // Wait for completion
System.out.println(t.getState()); // TERMINATED
```

### JVM Internal: How Thread State Transitions Work

At the JVM level, thread state transitions are managed by the **ObjectMonitor** (for synchronized blocks) and **ParkEvent/Parker** (for j.u.c locks):

```
JVM Internal Thread State Machine:
──────────────────────────────────

Thread.start() → JVM calls os::create_thread()
  → OS thread created → state set to RUNNABLE
  → OS scheduler picks it up → run() method executes

Entering synchronized block:
  → JVM checks ObjectMonitor owner
  → If free: set owner = current thread, enter block (RUNNABLE)
  → If owned by other: 
      1. Spin briefly (adaptive spinning, ~5000 iterations)
      2. If still locked → enqueue in ObjectMonitor's _EntryList
      3. Thread state → BLOCKED
      4. OS parks the thread (removes from scheduler)

Object.wait():
  → Thread MUST own the monitor (otherwise IllegalMonitorStateException)
  → Release monitor (set owner = null)
  → Move thread to ObjectMonitor's _WaitSet
  → Thread state → WAITING
  → OS parks the thread

Object.notify():
  → Pick ONE thread from _WaitSet
  → Move it to _EntryList (must re-acquire monitor)
  → Woken thread state → BLOCKED (waiting to re-acquire monitor)
  → When monitor acquired → RUNNABLE

LockSupport.park() / unpark():
  → Direct OS-level thread parking
  → Used internally by ReentrantLock, CountDownLatch, etc.
  → Thread state → WAITING or TIMED_WAITING
```

### Reading Thread Dumps: State-Based Diagnostics

Thread dumps (`jstack <PID>`) are the #1 tool for diagnosing production threading issues. Here's how to read each state:

```
How to take a thread dump:
──────────────────────────
$ jstack <PID>                    # Basic dump
$ jstack -l <PID>                 # With lock info
$ jcmd <PID> Thread.print        # Alternative (recommended)
$ kill -3 <PID>                   # Sends dump to stdout (Linux)

What each state means in a thread dump:
───────────────────────────────────────

1. RUNNABLE — "java.lang.Thread.State: RUNNABLE"
   Normal: Thread is doing work (CPU or IO)
   Problem: If many threads RUNNABLE but CPU is low → likely doing blocking IO
            that Java reports as RUNNABLE (e.g., socket read, file IO)
   
   "http-nio-8080-exec-1" #25 daemon prio=5 os_prio=0 tid=0x00007f...
      java.lang.Thread.State: RUNNABLE
        at java.net.SocketInputStream.read(SocketInputStream.java:152)
        at com.mysql.cj.protocol.ReadAheadInputStream.read(...)
   ↑ This is actually BLOCKED on network IO, but Java shows it as RUNNABLE

2. BLOCKED — "java.lang.Thread.State: BLOCKED (on object monitor)"
   Problem: Thread is waiting for a synchronized lock
   Action:  Find who holds the lock and why they are slow
   
   "worker-3" #18 prio=5 os_prio=0 tid=0x00007f...
      java.lang.Thread.State: BLOCKED (on object monitor)
        at com.app.service.OrderService.processOrder(OrderService.java:45)
        - waiting to lock <0x00000000c0035a68> (a java.util.HashMap)
        - locked by "worker-1" #16
   ↑ worker-3 is blocked because worker-1 holds the lock on HashMap

3. WAITING — "java.lang.Thread.State: WAITING (parking)"
   Normal: Thread is waiting for work (e.g., thread pool idle)
   Problem: If many threads WAITING on same condition → possible deadlock
   
   "pool-1-thread-3" #20 prio=5 os_prio=0 tid=0x00007f...
      java.lang.Thread.State: WAITING (parking)
        at sun.misc.Unsafe.park(Native Method)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:175)
        at java.util.concurrent.LinkedBlockingQueue.take(...)
   ↑ Normal: thread pool worker waiting for next task

4. TIMED_WAITING — "java.lang.Thread.State: TIMED_WAITING (sleeping)"
   Normal: Thread sleeping or waiting with timeout
   Problem: If business threads are sleeping → inefficient design
   
Quick Diagnosis Cheat Sheet:
────────────────────────────
Many BLOCKED threads    → Lock contention → reduce sync scope or use ConcurrentHashMap
Many WAITING on IO      → Connection pool exhaustion → increase pool or add timeouts
All threads RUNNABLE    → CPU-bound → check for infinite loops or heavy computation
Deadlock detected       → Fix lock ordering or use tryLock with timeout
```

> **Senior Engineer Tip:** Take 3 thread dumps 5–10 seconds apart. Compare them. Threads that are stuck in the same state across all 3 dumps are the problem threads. Threads that change state are just doing normal work.

---

# Chapter 4: Creating Threads in Java

## 4.1 Extending Thread Class

### What
Create a new class that extends `java.lang.Thread` and override the `run()` method.

### Why / When
Simplest approach but **tightly couples** the task with the thread mechanism. Use only for simple, one-off scenarios. **Avoid in production** — violates single responsibility principle and wastes the single inheritance slot.

### How It Works
```java
public class DataFetcherThread extends Thread {
    
    private final String url;
    
    public DataFetcherThread(String url) {
        this.url = url;
        setName("DataFetcher-" + url.hashCode());
    }
    
    @Override
    public void run() {
        System.out.println(Thread.currentThread().getName() + " fetching: " + url);
        // Simulate API call
        try { Thread.sleep(1000); } catch (InterruptedException e) { 
            Thread.currentThread().interrupt(); 
        }
        System.out.println(Thread.currentThread().getName() + " done");
    }
}

// Usage
DataFetcherThread t1 = new DataFetcherThread("https://api.example.com/users");
DataFetcherThread t2 = new DataFetcherThread("https://api.example.com/orders");
t1.start(); // Creates new OS thread and calls run()
t2.start();
t1.join();  // Wait for t1 to finish
t2.join();  // Wait for t2 to finish
```

**Under the hood:** `Thread.start()` → calls native `start0()` → JVM creates a new OS thread → OS thread invokes the `run()` method.

---

## 4.2 Implementing Runnable

### What
Implement the `Runnable` functional interface and pass it to a `Thread` constructor.

### Why / When
**Preferred over extending Thread.** Separates the task from the thread. Class can extend another class. Task can be reused, submitted to thread pools, or used with lambda expressions.

### How It Works
```java
// Using lambda (Java 8+)
Runnable fetchTask = () -> {
    System.out.println(Thread.currentThread().getName() + " executing task");
    // Business logic here
};

Thread t = new Thread(fetchTask, "Worker-1");
t.start();

// Enterprise example: Background cleanup
@Service
public class CacheCleanupService implements Runnable {
    
    @Autowired
    private CacheManager cacheManager;
    
    @Override
    public void run() {
        while (!Thread.currentThread().isInterrupted()) {
            cacheManager.evictExpired();
            try {
                Thread.sleep(60000); // Every 60 seconds
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
}
```

---

## 4.3 Callable + Future

### What
`Callable<V>` is like `Runnable` but **returns a result** and **can throw checked exceptions**. `Future<V>` represents the result of an asynchronous computation.

### Why / When
When you need a **return value** from a thread or need to handle **exceptions** thrown during execution. Used with `ExecutorService`.

### How It Works
```java
// Callable returns a value
Callable<Double> priceCalculator = () -> {
    Thread.sleep(2000); // Simulate heavy computation
    return 99.95;
};

ExecutorService executor = Executors.newSingleThreadExecutor();
Future<Double> future = executor.submit(priceCalculator);

// Do other work while computation runs...
System.out.println("Doing other work...");

// Get result (blocks if not ready yet)
Double price = future.get();           // Blocks until done
// or with timeout:
Double price2 = future.get(5, TimeUnit.SECONDS); // Throws TimeoutException

System.out.println("Price: " + price);

executor.shutdown();
```

### Future API
```java
boolean isDone = future.isDone();          // Check if complete
boolean cancelled = future.cancel(true);   // Cancel with interrupt
boolean isCancelled = future.isCancelled();
V result = future.get();                   // Block until result
V result = future.get(timeout, unit);      // Block with timeout
```

### Limitations of Future
- `get()` is **blocking** — defeats the purpose of async
- No way to **chain** or **compose** futures
- No way to **combine** multiple futures
- No manual completion
- No exception handling callbacks

→ **Solution: CompletableFuture** (Chapter 10)

---

## 4.4 ExecutorService

### What
A higher-level abstraction for managing threads through **thread pools**. Part of the `java.util.concurrent` package.

### Why / When
**Always use in production.** Creating raw threads is wasteful (thread creation ~1ms, ~1MB memory each). ExecutorService reuses threads, manages lifecycle, bounds concurrency.

### How It Works
```java
// Create thread pool
ExecutorService executor = Executors.newFixedThreadPool(10);

// Submit tasks
Future<String> result = executor.submit(() -> {
    return callExternalAPI();
});

// Submit Runnable (no return value)
executor.execute(() -> {
    sendEmailNotification(user);
});

// Shutdown
executor.shutdown();                        // Graceful: finish queued tasks
executor.awaitTermination(30, TimeUnit.SECONDS); // Wait for completion
// executor.shutdownNow();                 // Forceful: interrupt running tasks
```

### Production Example
```java
@Configuration
public class ThreadPoolConfig {
    
    @Bean("apiCallExecutor")
    public ExecutorService apiCallExecutor() {
        return new ThreadPoolExecutor(
            5,                          // core pool size
            20,                         // max pool size
            60L, TimeUnit.SECONDS,      // keep-alive for idle threads
            new LinkedBlockingQueue<>(100), // work queue capacity
            new ThreadFactoryBuilder()
                .setNameFormat("api-call-%d")
                .setDaemon(true)
                .build(),
            new ThreadPoolExecutor.CallerRunsPolicy() // rejection policy
        );
    }
}

@Service
public class ExternalApiService {
    
    @Autowired
    @Qualifier("apiCallExecutor")
    private ExecutorService executor;
    
    public List<ApiResponse> callMultipleApis(List<String> urls) {
        List<Future<ApiResponse>> futures = urls.stream()
            .map(url -> executor.submit(() -> restTemplate.getForObject(url, ApiResponse.class)))
            .collect(Collectors.toList());
        
        return futures.stream()
            .map(f -> {
                try { return f.get(5, TimeUnit.SECONDS); }
                catch (Exception e) { return ApiResponse.error(e.getMessage()); }
            })
            .collect(Collectors.toList());
    }
}
```

---

## 4.5 CompletableFuture (Modern Approach)

### What
Introduced in **Java 8**, `CompletableFuture<T>` is a powerful, non-blocking, composable asynchronous programming model.

### Why / When
**The modern standard for async programming in Java.** Supports chaining, combining, error handling, and callbacks — all without blocking.

### Quick Preview (Full deep dive in Chapter 10)
```java
@Service
public class OrderAggregatorService {
    
    public OrderDetails getOrderDetails(Long orderId) {
        
        CompletableFuture<Order> orderFuture = 
            CompletableFuture.supplyAsync(() -> orderService.findById(orderId));
            
        CompletableFuture<Customer> customerFuture = orderFuture
            .thenCompose(order -> 
                CompletableFuture.supplyAsync(() -> 
                    customerService.findById(order.getCustomerId())));
        
        CompletableFuture<List<Payment>> paymentsFuture = 
            CompletableFuture.supplyAsync(() -> paymentService.findByOrder(orderId));
        
        return orderFuture
            .thenCombine(customerFuture, (order, customer) -> 
                new OrderDetails(order, customer))
            .thenCombine(paymentsFuture, (details, payments) -> {
                details.setPayments(payments);
                return details;
            })
            .exceptionally(ex -> {
                log.error("Failed to build order details", ex);
                return OrderDetails.empty();
            })
            .join(); // Terminal operation
    }
}
```

### Comparison of All Approaches

| Feature | Thread/Runnable | Callable+Future | ExecutorService | CompletableFuture |
|---|---|---|---|---|
| Return value | No (Runnable) | Yes | Yes | Yes |
| Exception handling | Manual | `get()` throws | `get()` throws | `exceptionally()`, `handle()` |
| Thread pool | No (raw thread) | No | **Yes** | Yes (ForkJoinPool default) |
| Chaining | No | No | No | **Yes** |
| Combining | No | No | Manual | **Yes** (`thenCombine`, `allOf`) |
| Non-blocking | No | `get()` blocks | `get()` blocks | **Yes** (callbacks) |
| Production use | ❌ Avoid | ⚠️ Limited | ✅ Good | ✅ **Best** |

### Thread.start() Internals: What Actually Happens

When you call `thread.start()`, here is the complete chain of events inside the JVM:

```
Java code: thread.start()
    │
    ├─→ Thread.start() [Java method]
    │     - Checks state != NEW → throws IllegalThreadStateException if already started
    │     - Adds thread to ThreadGroup
    │     - Calls native start0()
    │
    ├─→ JVM_StartThread() [C++ code in JVM]
    │     - Allocates JavaThread object (JVM internal representation)
    │     - Sets stack size (from -Xss or Thread constructor)
    │     - Calls os::create_thread()
    │
    ├─→ os::create_thread() [Platform-specific]
    │     - Linux:   pthread_create(&tid, &attr, thread_native_entry, thread)
    │     - Windows: CreateThread(NULL, stack_size, thread_native_entry, thread, ...)
    │     - macOS:   pthread_create() (same as Linux)
    │
    ├─→ thread_native_entry() [C++ callback, runs in NEW OS thread]
    │     - Initializes thread-local storage
    │     - Sets thread state to RUNNABLE
    │     - Calls thread->run() → JavaThread::run()
    │
    └─→ JavaThread::run()
          - Installs signal handlers
          - Calls Thread.run() [back to Java code!]
          - When run() returns → thread cleanup → state = TERMINATED

Key points:
  • Thread.start() can ONLY be called once. Calling it again throws
    IllegalThreadStateException. This is because OS threads cannot be restarted.
  • You can verify: thread.start(); thread.start(); // throws on second call
  • This is why thread pools REUSE threads instead of creating new ones.
```

### Daemon Threads: Deep Understanding

Daemon threads are background service threads that **do not prevent JVM shutdown**. When all non-daemon (user) threads finish, the JVM terminates — killing all daemon threads abruptly.

```java
// Creating daemon threads
Thread daemon = new Thread(() -> {
    while (true) {
        cleanupExpiredCache();
        try { Thread.sleep(60000); } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            break;
        }
    }
});
daemon.setDaemon(true);  // MUST be set BEFORE start()
daemon.setName("cache-cleanup-daemon");
daemon.start();

// Daemon thread properties:
// 1. MUST call setDaemon(true) BEFORE start()
// 2. Child threads inherit daemon status from parent
// 3. Daemon threads are killed abruptly — no finally blocks executed!
// 4. Do NOT use for tasks that require cleanup (file writes, DB commits)
```

```
When to use daemon vs non-daemon threads:
─────────────────────────────────────────
Daemon threads:                        Non-daemon threads:
  • GC, monitoring, heartbeats           • Business logic
  • Cache cleanup                        • File I/O that must complete
  • Metrics collection                   • Database transactions
  • Thread pool workers (usually)        • Message processing
  
⚠️ In Spring Boot: @Async threads are non-daemon by default.
   Tomcat worker threads are also non-daemon.
   Set daemon=true for fire-and-forget background tasks.
```

### Handling InterruptedException: The Right Way

`InterruptedException` is how Java signals a thread to stop. Handling it correctly is a mark of senior engineering:

```java
// ❌ ANTI-PATTERN 1: Swallowing the interrupt (NEVER DO THIS)
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    // Silently ignored — the thread continues running!
    // Callers who tried to interrupt this thread are puzzled why it won't stop
}

// ❌ ANTI-PATTERN 2: Just logging and continuing  
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    log.error("Interrupted", e);  // Loses the interrupt flag!
}

// ✅ CORRECT PATTERN 1: Propagate the exception
public void doWork() throws InterruptedException {
    Thread.sleep(1000);  // Let caller handle it
}

// ✅ CORRECT PATTERN 2: Restore interrupt flag + terminate
public void run() {
    while (!Thread.currentThread().isInterrupted()) {
        try {
            processNextItem();
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();  // RESTORE the flag!
            break;                               // Exit the loop
        }
    }
    cleanup();  // Graceful cleanup before thread dies
}

// ✅ CORRECT PATTERN 3: Convert to unchecked exception
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    throw new RuntimeException("Thread was interrupted", e);
}
```

> **Why restoring the interrupt flag matters:** When `InterruptedException` is thrown, the interrupt flag is automatically cleared. If you don't restore it with `Thread.currentThread().interrupt()`, higher-level code (like ExecutorService.shutdownNow()) has no way to know the thread was interrupted.

### Thread Creation: Common Anti-Patterns in Production

```java
// ❌ ANTI-PATTERN 1: Creating threads in a loop
@GetMapping("/api/process")
public void processRequest() {
    for (Item item : items) {
        new Thread(() -> process(item)).start(); // 10,000 items = 10,000 threads = CRASH
    }
}

// ✅ FIX: Use ExecutorService with bounded pool
@Autowired @Qualifier("processingPool")
private ExecutorService executor;

@GetMapping("/api/process")
public void processRequest() {
    items.forEach(item -> executor.submit(() -> process(item)));
}

// ❌ ANTI-PATTERN 2: Not naming threads
new Thread(() -> doWork()).start();
// Thread dump shows: "Thread-47" — impossible to debug

// ✅ FIX: Always name threads
new Thread(() -> doWork(), "order-processor-1").start();
// Thread dump shows: "order-processor-1" — instantly meaningful

// ❌ ANTI-PATTERN 3: Ignoring thread pool shutdown
@Bean
public ExecutorService executor() {
    return Executors.newFixedThreadPool(10);
    // Never shut down → threads leak on application context refresh
}

// ✅ FIX: Graceful shutdown
@Bean(destroyMethod = "shutdown")
public ExecutorService executor() {
    return Executors.newFixedThreadPool(10);
}
```

---

