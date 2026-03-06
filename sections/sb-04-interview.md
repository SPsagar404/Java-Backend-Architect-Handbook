
# Part 18: Production Best Practices

## 18.1 Idempotency

Every batch job must be **idempotent** -- running it twice with the same parameters should produce the same result without side effects.

```java
// BAD: Not idempotent -- running twice creates duplicate invoices
public Invoice process(Customer customer) {
    return new Invoice(customer); // Always creates new
}

// GOOD: Idempotent -- checks for existing before creating
public Invoice process(Customer customer) {
    Invoice existing = invoiceRepository
        .findByCustomerIdAndMonth(customer.getId(), YearMonth.now());
    if (existing != null) {
        return null; // Skip -- already processed
    }
    return new Invoice(customer);
}
```

## 18.2 Restartable Jobs

Configure jobs to restart from the last failed point, not from the beginning:

```java
@Bean
public Step restartableStep(JobRepository jobRepo,
                             PlatformTransactionManager txManager) {
    return new StepBuilder("restartableStep", jobRepo)
        .<Data, Data>chunk(100, txManager)
        .reader(pagingReader()) // Paging readers are restartable!
        .processor(processor())
        .writer(writer())
        .allowStartIfComplete(false) // Don't re-run completed steps
        .build();
}
```

## 18.3 Job Parameters for Uniqueness

```java
// Use meaningful parameters so each run is unique
JobParameters params = new JobParametersBuilder()
    .addString("date", LocalDate.now().toString())     // Makes each day unique
    .addLong("timestamp", System.currentTimeMillis())  // Forces uniqueness
    .toJobParameters();
```

## 18.4 Externalize Configuration

```yaml
# application.yml
batch:
  invoice-job:
    chunk-size: 100
    skip-limit: 50
    retry-limit: 3
    thread-count: 4
    cron: "0 0 0 1 * *"
```

```java
@Value("${batch.invoice-job.chunk-size}")
private int chunkSize;

@Value("${batch.invoice-job.skip-limit}")
private int skipLimit;
```

## 18.5 Monitoring and Alerting

```java
@Component
public class JobCompletionNotifier implements JobExecutionListener {

    @Override
    public void afterJob(JobExecution execution) {
        // Send metrics to monitoring system
        meterRegistry.timer("batch.job.duration",
            "job", execution.getJobInstance().getJobName(),
            "status", execution.getStatus().toString())
            .record(Duration.between(
                execution.getStartTime(), execution.getEndTime()));

        if (execution.getStatus() == BatchStatus.FAILED) {
            // Page the on-call engineer
            pagerDutyService.createIncident(
                "Batch Job Failed: " +
                execution.getJobInstance().getJobName(),
                execution.getAllFailureExceptions()
            );
        }
    }
}
```

---

# Part 19: Performance Optimization

## 19.1 Thread Pool Configuration

```java
@Bean
public TaskExecutor batchTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);
    executor.setMaxPoolSize(8);
    executor.setQueueCapacity(50);
    executor.setThreadNamePrefix("batch-");
    executor.initialize();
    return executor;
}
```

## 19.2 Parallel Steps

Execute independent steps concurrently:

```java
@Bean
public Job parallelJob(JobRepository jobRepo,
                        Step loadCustomers,
                        Step loadProducts,
                        Step generateReport) {
    // loadCustomers and loadProducts run in parallel
    // generateReport runs after both complete
    Flow customerFlow = new FlowBuilder<SimpleFlow>("customerFlow")
        .start(loadCustomers).build();
    Flow productFlow = new FlowBuilder<SimpleFlow>("productFlow")
        .start(loadProducts).build();

    return new JobBuilder("parallelJob", jobRepo)
        .start(new FlowBuilder<SimpleFlow>("parallelFlow")
            .split(new SimpleAsyncTaskExecutor())
            .add(customerFlow, productFlow)
            .build())
        .next(generateReport) // Runs after both complete
        .end()
        .build();
}
```

## 19.3 Optimization Checklist

| Optimization | Impact | How |
|---|---|---|
| Chunk size tuning | High | Start with 100, benchmark and adjust |
| Paging reader | High | Use pageSize matching chunk size |
| Multi-threaded steps | High | `taskExecutor()` + `throttleLimit()` |
| Partitioning | Very High | Split data into independent ranges |
| Index DB queries | Very High | Index columns used in reader queries |
| Batch writes | High | Use `JdbcBatchItemWriter` for bulk inserts |
| Disable auto-flush | Medium | Set `clearSession=true` on JPA reader |
| Connection pool | Medium | HikariCP with adequate max-pool-size |
| Parallel steps | Medium | Independent steps run concurrently |
| Async writer | Medium | Write to queue, process asynchronously |

## 19.4 Benchmarking Example

```
Scenario: Process 1 million customer records

Configuration A: Single-threaded, chunk=100
  -> Time: 45 minutes

Configuration B: 4 threads, chunk=100
  -> Time: 13 minutes

Configuration C: 8 partitions, chunk=200
  -> Time: 6 minutes

Configuration D: 8 partitions, chunk=200, indexed queries
  -> Time: 3 minutes
```

---

# Part 20: Common Production Issues

## 20.1 Job Failures

**Problem:** Job fails midway through processing 500,000 records.

**Solution:**
```java
// 1. Make jobs restartable (default in Spring Batch)
// 2. Use paging readers (maintain position via page number)
// 3. Check job status and restart
JobExecution lastExecution = jobExplorer
    .getLastJobExecution(jobInstance);
if (lastExecution != null &&
    lastExecution.getStatus() == BatchStatus.FAILED) {
    // Restart from last committed chunk
    jobLauncher.run(job, lastExecution.getJobParameters());
}
```

## 20.2 Duplicate Processing

**Problem:** Job runs twice for the same date, creating duplicate records.

**Solution:**
```java
// Option 1: Unique job parameters prevent re-execution
// Spring Batch won't re-run a COMPLETED job with same parameters

// Option 2: Idempotent processor
public Invoice process(Customer customer) {
    if (invoiceRepository.existsByCustomerIdAndMonth(
            customer.getId(), currentMonth)) {
        return null; // Already processed, skip
    }
    return createInvoice(customer);
}

// Option 3: Database unique constraint
@Table(uniqueConstraints = @UniqueConstraint(
    columnNames = {"customer_id", "invoice_month"}
))
```

## 20.3 Deadlocks in Batch

**Problem:** Multiple batch threads deadlock on database rows.

**Solution:**
```java
// 1. Process disjoint data ranges (partitioning)
// 2. Consistent lock ordering
// 3. Reduce transaction scope (smaller chunks)
// 4. Use optimistic locking
@Version
private Long version; // JPA optimistic lock

// 5. Retry on deadlock
.retry(DeadlockLoserDataAccessException.class)
.retryLimit(3)
```

## 20.4 Memory Leaks

**Problem:** Job processes millions of records, JVM runs out of memory.

**Solution:**
```java
// 1. Use paging reader (not cursor for huge datasets)
// 2. Clear JPA session periodically
@Bean
public JpaPagingItemReader<Entity> reader(EntityManagerFactory emf) {
    JpaPagingItemReader<Entity> reader = new JpaPagingItemReaderBuilder<Entity>()
        .entityManagerFactory(emf)
        .queryString("SELECT e FROM Entity e")
        .pageSize(200)
        .build();
    // Clear persistence context after each page read
    return reader;
}

// 3. Use stateless session (Hibernate)
// 4. Process in smaller batches
// 5. Set appropriate JVM heap: -Xmx2g -Xms1g
```

## 20.5 Thread Starvation

**Problem:** Scheduled tasks pile up because default scheduler has only 1 thread.

**Solution:**
```java
@Configuration
public class SchedulerConfig implements SchedulingConfigurer {
    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10); // 10 threads for scheduled tasks
        scheduler.initialize();
        registrar.setTaskScheduler(scheduler);
    }
}
```

---

# Part 21: Interview Questions (50+)

## Spring Scheduler Questions

**Q1. What annotations are needed to enable scheduling in Spring Boot?**
`@EnableScheduling` on a configuration class and `@Scheduled` on the methods to schedule. The scheduled class must be a Spring bean (`@Component`).

**Q2. What is the difference between fixedRate and fixedDelay?**
`fixedRate` starts the timer from the **beginning** of the previous execution, so tasks may overlap if execution takes longer than the rate. `fixedDelay` starts the timer from the **end** of the previous execution, guaranteeing no overlap.

**Q3. What is the default thread pool size for @Scheduled?**
**One (1) thread.** This means all scheduled tasks share a single thread and run sequentially. Configure via `SchedulingConfigurer` to increase.

**Q4. How do you externalize cron expressions?**
Use SpEL: `@Scheduled(cron = "${app.cron.cleanup}")` and define the cron string in `application.yml`.

**Q5. What happens if a scheduled task throws an exception?**
The exception is logged but does NOT stop future executions. The scheduler continues to fire at the next scheduled time. Use `ErrorHandler` for custom handling.

**Q6. How do you disable a scheduled task in a specific environment?**
Use `@ConditionalOnProperty`: `@ConditionalOnProperty(name = "scheduler.enabled", havingValue = "true")` or use `-` as cron: `@Scheduled(cron = "${job.cron:-}")`.

**Q7. Can two scheduled methods run at the same time?**
Not by default (single thread). With a configured thread pool of size > 1, yes, different @Scheduled methods can run concurrently.

**Q8. How do you handle scheduling in a clustered environment?**
Use ShedLock or Quartz with JDBC JobStore. ShedLock uses a database lock table to ensure only one instance executes the job.

## Spring Batch Questions

**Q9. What is the difference between a Job and a Step?**
A Job is the overall batch process containing one or more Steps. A Step is a single, independent phase of a Job that has its own reader, processor, and writer.

**Q10. What is chunk-oriented processing?**
Data is read, processed, and written in groups (chunks). A chunk of N items is read one at a time, processed, then all N items are written together in a single transaction.

**Q11. What happens if a chunk fails?**
The entire chunk transaction is rolled back. With skip policy, individual failed items can be skipped and the rest of the chunk retried.

**Q12. What is the role of JobRepository?**
Stores metadata about job/step executions in database tables (BATCH_JOB_INSTANCE, BATCH_JOB_EXECUTION, BATCH_STEP_EXECUTION). Enables restart, monitoring, and auditing.

**Q13. How does restart work in Spring Batch?**
On restart, Spring Batch reads the last successful commit count from BATCH_STEP_EXECUTION and resumes from that point. Paging readers track their position for restart.

**Q14. What is the difference between JdbcPagingItemReader and JpaPagingItemReader?**
JdbcPagingItemReader uses raw JDBC with SQL and supports restart natively. JpaPagingItemReader uses JPA/JPQL but has overhead from persistence context management.

**Q15. What is a Tasklet step?**
A step that executes a single task (not chunk-oriented). Used for simple operations like deleting files, running a stored procedure, or sending a notification.

**Q16. What is skip logic in Spring Batch?**
Configures the job to skip (ignore) items that cause certain exceptions, up to a configurable limit. Skipped items are logged but don't fail the job.

**Q17. What is retry logic?**
Automatically retries a failed item operation a configurable number of times before skipping or failing. Useful for transient errors like database timeouts.

**Q18. How do you pass data between steps?**
Use `ExecutionContext` -- a key-value map available per Step or per Job. Step-level context is isolated; Job-level context is shared across steps.

**Q19. What is partitioning in Spring Batch?**
Splitting the input data into independent partitions (ranges) and processing each partition in a separate thread. Significantly improves throughput for large datasets.

**Q20. What is the throttle limit?**
Controls the maximum number of concurrent threads in a multi-threaded step. `throttleLimit(8)` means at most 8 threads process chunks simultaneously.

## Advanced Questions

**Q21. How do you trigger a batch job via REST API?**
Inject `JobLauncher` and `Job` beans, create `JobParameters`, and call `jobLauncher.run(job, params)` from a controller method.

**Q22. How is Spring Batch different from Quartz?**
Spring Batch is a **processing framework** (read, process, write data). Quartz is a **scheduling framework** (trigger jobs at times). They complement each other -- Quartz schedules, Spring Batch processes.

**Q23. What are the batch job statuses?**
STARTING, STARTED, STOPPING, STOPPED, FAILED, COMPLETED, ABANDONED, UNKNOWN.

**Q24. How do you make a batch job idempotent?**
Check for existing processed records before creating new ones. Use unique constraints. Use database upsert operations. Make job parameters date-based.

**Q25. How to handle millions of records efficiently?**
Chunk processing, paging readers, partitioning, multi-threaded steps, indexed DB queries, batch writes, and appropriate JVM memory.

**Q26. What is the difference between multi-threaded step and partitioning?**
Multi-threaded step: multiple threads share the same reader (must be thread-safe). Partitioning: each thread has its own reader working on a disjoint data range (preferred).

**Q27. How do you unit test a batch job?**
Use `@SpringBatchTest` which provides `JobLauncherTestUtils`. Assert on `JobExecution.getStatus()`, step read/write counts.

**Q28. What is flow-based job?**
A job with conditional step execution: `on("COMPLETED").to(nextStep).on("FAILED").to(errorStep)`.

**Q29. How do you handle job scheduling in Kubernetes?**
Use CronJob resources in Kubernetes instead of `@Scheduled`. Each CronJob creates a Pod that runs the batch job and terminates.

**Q30. What is remote chunking?**
Processing is distributed across multiple JVMs. The master reads and sends items to worker JVMs which process and write. Items are sent via messaging (JMS, RabbitMQ).

## Architect-Level Questions

**Q31. Design a batch system for processing 10 million records nightly.**
Use partitioning (8-16 partitions by ID range), JdbcPagingItemReader, batch size 200, separate IO and CPU thread pools, retry on transient errors, skip on data errors, monitoring with metrics.

**Q32. How to ensure exactly-once processing in batch?**
Unique constraints + idempotent operations + partition by non-overlapping ranges + transactional chunk processing.

**Q33. How to handle batch in a cloud-native microservices environment?**
Separate batch processing service, triggered via scheduler or Kafka events, stores execution metadata in its own database, publishes completion events to Kafka.

**Q34. Design a file-based batch processing system.**
FlatFileItemReader with line tokenizer -> validation processor -> JPA writer. Handle multiple file formats, bad record files, completion flags.

**Q35. How to implement a batch job that calls external APIs?**
Custom ItemProcessor with WebClient/RestTemplate. Handle rate limiting, circuit breaker (Resilience4j), retry on 5xx errors, skip on 4xx errors, timeout configuration.

**Q36. What are the tradeoffs of chunk size?**
Small chunks: more transactions, fine-grained restart, slower. Large chunks: fewer transactions, coarse restart, faster but more memory. Typical production: 100-500.

**Q37. How to implement conditional step execution?**
```java
.start(validationStep)
    .on("COMPLETED").to(processingStep)
    .on("FAILED").to(errorNotificationStep)
    .end()
```

**Q38. How to prevent concurrent execution of the same batch job?**
Use `JobParametersIncrementer` with unique run IDs. Or use ShedLock for distributed locking. Or check `JobExplorer` for running executions before launching.

**Q39. Design a batch system with rollback and compensating transactions.**
Use savepoints per chunk. On failure, execute compensating step that reverses partial changes. Log all operations for audit trail.

**Q40. How to implement event-driven batch triggering?**
Kafka consumer listens for trigger events -> calls `JobLauncher.run()`. Decouple scheduling from batch execution.

**Q41. What is the maximum throughput you can achieve with Spring Batch?**
Depends on infrastructure. With 8 partitions, batch writes, indexed queries: 50,000-100,000 records/minute is typical. Remote chunking can scale further.

**Q42. How to handle timezone issues in scheduled jobs?**
Use `@Scheduled(cron = "...", zone = "America/New_York")`. Store all timestamps in UTC internally, convert for display.

**Q43. Design a retry strategy for a batch job calling a flaky external API.**
Exponential backoff: 1s, 2s, 4s. Circuit breaker after 5 consecutive failures. Dead letter queue for items that exhaust retries. Manual intervention for dead-lettered items.

**Q44. How to version and migrate batch job configurations?**
Use Flyway/Liquibase for batch metadata tables. Version job configurations alongside application code. Never modify completed job parameters.

**Q45. How to implement a data migration batch job between two databases?**
JdbcCursorItemReader from source DB -> transformation processor -> JdbcBatchItemWriter to target DB. Partitioned by table/date range. Validation step after migration.

**Q46. How to test batch jobs with large datasets?**
Integration tests with H2/embedded DB. Subset testing (1% of production data). Performance tests in staging environment. Property-based testing for processors.

**Q47. How do you handle schema changes in batch tables?**
Spring Batch schema changes are rare. Use Flyway migration scripts. Test with both old and new schema versions.

**Q48. What is the difference between Spring Batch and Apache Spark?**
Spring Batch: single-JVM, chunk processing, enterprise integration. Spark: distributed computing, in-memory, big data analytics. Use Batch for < 100M records, Spark for bigger.

**Q49. How to implement audit logging in batch jobs?**
StepExecutionListener logs step metrics. Custom ItemWriteListener logs each batch. ExecutionContext stores processing metadata.

**Q50. How to implement batch job SLAs?**
Monitor job duration via metrics. Alert if job exceeds SLA threshold. Implement kill switch for long-running jobs. Auto-scale partitions based on data volume.

**Q51. How to decommission a batch job safely?**
Disable via property flag. Monitor for any dependent systems. Keep job definition for restart of failed historical runs. Archive batch metadata after retention period.

**Q52. How to handle daylight saving time in cron expressions?**
Spring handles DST transitions. For critical midnight jobs, schedule at 1 AM instead of midnight. Always specify timezone in the cron annotation.

---

# Part 22: Coding Exercises (15+)

## Exercise 1: Simple Fixed-Rate Scheduler

```java
@Component
public class HeartbeatScheduler {
    private final AtomicInteger count = new AtomicInteger(0);

    @Scheduled(fixedRate = 5000)
    public void heartbeat() {
        System.out.printf("[%s] Heartbeat #%d on thread %s%n",
            Instant.now(), count.incrementAndGet(),
            Thread.currentThread().getName());
    }
}
```

## Exercise 2: Cron-Based Report Scheduler

```java
@Component
public class DailyReportScheduler {

    @Autowired private OrderRepository orderRepository;

    @Scheduled(cron = "0 0 7 * * MON-FRI")
    public void generateDailyReport() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        List<Order> orders = orderRepository.findByOrderDate(yesterday);

        long totalOrders = orders.size();
        BigDecimal totalRevenue = orders.stream()
            .map(Order::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        System.out.printf("Daily Report for %s: Orders=%d, Revenue=$%s%n",
            yesterday, totalOrders, totalRevenue);
    }
}
```

## Exercise 3: Configurable Scheduler with Thread Pool

```java
@Configuration
@EnableScheduling
public class SchedulerConfig implements SchedulingConfigurer {

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(5);
        scheduler.setThreadNamePrefix("my-scheduler-");
        scheduler.setErrorHandler(t ->
            System.err.println("Task error: " + t.getMessage()));
        scheduler.initialize();
        registrar.setTaskScheduler(scheduler);
    }
}
```

## Exercise 4: Basic Spring Batch Job (CSV to Database)

```java
@Configuration
public class CsvImportJobConfig {

    @Bean
    public FlatFileItemReader<Product> csvReader() {
        return new FlatFileItemReaderBuilder<Product>()
            .name("productCsvReader")
            .resource(new ClassPathResource("products.csv"))
            .delimited()
            .names("name", "category", "price")
            .targetType(Product.class)
            .build();
    }

    @Bean
    public ItemProcessor<Product, Product> priceValidator() {
        return product -> {
            if (product.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
                return null; // Skip invalid prices
            }
            product.setImportDate(LocalDate.now());
            return product;
        };
    }

    @Bean
    public JpaItemWriter<Product> productWriter(EntityManagerFactory emf) {
        JpaItemWriter<Product> writer = new JpaItemWriter<>();
        writer.setEntityManagerFactory(emf);
        return writer;
    }

    @Bean
    public Job importJob(JobRepository repo, Step importStep) {
        return new JobBuilder("csvImportJob", repo)
            .start(importStep).build();
    }

    @Bean
    public Step importStep(JobRepository repo,
                            PlatformTransactionManager tx) {
        return new StepBuilder("importStep", repo)
            .<Product, Product>chunk(50, tx)
            .reader(csvReader())
            .processor(priceValidator())
            .writer(productWriter(null))
            .build();
    }
}
```

## Exercise 5: Batch Job with Skip and Retry

```java
@Bean
public Step faultTolerantStep(JobRepository repo,
                               PlatformTransactionManager tx) {
    return new StepBuilder("faultTolerant", repo)
        .<Customer, Invoice>chunk(100, tx)
        .reader(customerReader())
        .processor(invoiceProcessor())
        .writer(invoiceWriter())
        .faultTolerant()
        .skipLimit(20)
        .skip(DataFormatException.class)
        .retryLimit(3)
        .retry(TransientDataAccessException.class)
        .listener(new SkipListener<Customer, Invoice>() {
            public void onSkipInProcess(Customer c, Throwable t) {
                System.err.println("Skipped customer " + c.getId());
            }
        })
        .build();
}
```

## Exercise 6: Multi-Step Job (Process then Notify)

```java
@Bean
public Job multiStepJob(JobRepository repo,
                         Step processStep, Step notifyStep) {
    return new JobBuilder("multiStepJob", repo)
        .start(processStep)
        .next(notifyStep)
        .build();
}

@Bean
public Step notifyStep(JobRepository repo,
                        PlatformTransactionManager tx) {
    return new StepBuilder("notifyStep", repo)
        .tasklet((contribution, chunkContext) -> {
            int processed = chunkContext.getStepContext()
                .getStepExecution().getJobExecution()
                .getExecutionContext().getInt("processedCount", 0);
            emailService.send("admin@company.com",
                "Batch complete: " + processed + " records");
            return RepeatStatus.FINISHED;
        }, tx).build();
}
```

## Exercise 7: Partitioned Batch Job

```java
@Bean
public Step masterStep(JobRepository repo, Step workerStep) {
    return new StepBuilder("masterStep", repo)
        .partitioner("workerStep", idRangePartitioner())
        .step(workerStep)
        .gridSize(4) // 4 partitions
        .taskExecutor(new SimpleAsyncTaskExecutor())
        .build();
}

@Bean
public Partitioner idRangePartitioner() {
    return gridSize -> {
        Map<String, ExecutionContext> map = new HashMap<>();
        long total = customerRepository.count();
        long range = total / gridSize + 1;
        for (int i = 0; i < gridSize; i++) {
            ExecutionContext ctx = new ExecutionContext();
            ctx.putLong("minId", i * range + 1);
            ctx.putLong("maxId", (i + 1) * range);
            map.put("partition" + i, ctx);
        }
        return map;
    };
}
```

## Exercise 8: Scheduler-Triggered Batch Job

```java
@Component
public class NightlyBatchTrigger {

    @Autowired private JobLauncher jobLauncher;
    @Autowired private Job processJob;

    @Scheduled(cron = "0 0 0 * * *")
    public void triggerNightlyJob() {
        try {
            JobParameters params = new JobParametersBuilder()
                .addLocalDate("runDate", LocalDate.now())
                .addLong("runId", System.currentTimeMillis())
                .toJobParameters();
            JobExecution ex = jobLauncher.run(processJob, params);
            System.out.println("Job status: " + ex.getStatus());
        } catch (Exception e) {
            System.err.println("Job failed: " + e.getMessage());
        }
    }
}
```

## Exercise 9: REST API to Trigger and Monitor Batch

```java
@RestController
@RequestMapping("/api/batch")
public class BatchController {

    @Autowired private JobLauncher launcher;
    @Autowired private Job job;
    @Autowired private JobExplorer explorer;

    @PostMapping("/run")
    public ResponseEntity<Map<String, Object>> runJob() throws Exception {
        JobParameters params = new JobParametersBuilder()
            .addLong("time", System.currentTimeMillis())
            .toJobParameters();
        JobExecution exec = launcher.run(job, params);
        return ResponseEntity.ok(Map.of(
            "jobId", exec.getId(),
            "status", exec.getStatus().toString()
        ));
    }

    @GetMapping("/status/{jobId}")
    public ResponseEntity<Map<String, Object>> getStatus(
            @PathVariable Long jobId) {
        JobExecution exec = explorer.getJobExecution(jobId);
        return ResponseEntity.ok(Map.of(
            "status", exec.getStatus().toString(),
            "startTime", exec.getStartTime().toString(),
            "endTime", exec.getEndTime() != null ?
                exec.getEndTime().toString() : "Running"
        ));
    }
}
```

## Exercise 10: Conditional Flow Job

```java
@Bean
public Job conditionalJob(JobRepository repo,
                           Step validation, Step process, Step error) {
    return new JobBuilder("conditionalJob", repo)
        .start(validation)
            .on("COMPLETED").to(process)
            .from(validation)
            .on("FAILED").to(error)
        .end()
        .build();
}
```

## Exercise 11: Database to CSV Export

```java
@Bean
public FlatFileItemWriter<Order> csvExportWriter() {
    return new FlatFileItemWriterBuilder<Order>()
        .name("orderCsvWriter")
        .resource(new FileSystemResource("export/orders.csv"))
        .delimited()
        .delimiter(",")
        .names("id", "customerName", "amount", "date")
        .headerCallback(writer ->
            writer.write("ID,Customer,Amount,Date"))
        .build();
}
```

## Exercise 12: Custom ItemReader from REST API

```java
@Component
@StepScope
public class ApiItemReader implements ItemReader<ExternalData> {

    private List<ExternalData> data;
    private int index = 0;

    @BeforeStep
    public void init(StepExecution stepExecution) {
        this.data = restTemplate.exchange(
            "https://api.example.com/data",
            HttpMethod.GET, null,
            new ParameterizedTypeReference<List<ExternalData>>() {}
        ).getBody();
    }

    @Override
    public ExternalData read() {
        if (index < data.size()) {
            return data.get(index++);
        }
        return null; // No more items
    }
}
```

## Exercise 13: ShedLock for Distributed Scheduling

```java
// Dependency: net.javacrumbs.shedlock:shedlock-spring

@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "10m")
public class ShedLockConfig {
    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(dataSource);
    }
}

@Component
public class DistributedScheduler {

    @Scheduled(cron = "0 0 * * * *")
    @SchedulerLock(name = "hourlySync",
                   lockAtMostFor = "55m",
                   lockAtLeastFor = "5m")
    public void syncData() {
        // Only ONE instance runs this across the cluster
        dataService.syncAll();
    }
}
```

## Exercise 14: Job Execution Listener with Metrics

```java
@Component
public class MetricsJobListener implements JobExecutionListener {
    @Autowired private MeterRegistry registry;

    @Override
    public void beforeJob(JobExecution exec) {
        registry.counter("batch.jobs.started",
            "job", exec.getJobInstance().getJobName()).increment();
    }

    @Override
    public void afterJob(JobExecution exec) {
        String job = exec.getJobInstance().getJobName();
        registry.counter("batch.jobs.completed",
            "job", job,
            "status", exec.getStatus().toString()).increment();
    }
}
```

## Exercise 15: Composite Processor (Chain Multiple Processors)

```java
@Bean
public CompositeItemProcessor<RawData, ProcessedData> compositeProcessor() {
    CompositeItemProcessor<RawData, ProcessedData> processor =
        new CompositeItemProcessor<>();
    processor.setDelegates(List.of(
        validationProcessor(),
        transformationProcessor(),
        enrichmentProcessor()
    ));
    return processor;
}
```

---

*End of Guide*

**Document Version:** 1.0
**Last Updated:** March 2026
**Topics Covered:** 22 Parts, 52 Interview Questions, 15 Coding Exercises
