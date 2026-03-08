
# Part 13: Error Handling in Batch Jobs

## 13.1 Skip Logic

Skip problematic records and continue processing. Essential for batch jobs where a few bad records should not fail the entire job.

```java
@Bean
public Step faultTolerantStep(JobRepository jobRepo,
                               PlatformTransactionManager txManager) {
    return new StepBuilder("faultTolerantStep", jobRepo)
        .<Customer, Invoice>chunk(100, txManager)
        .reader(customerReader())
        .processor(invoiceProcessor())
        .writer(invoiceWriter())
        .faultTolerant()
        .skipLimit(50)                              // Max 50 skips allowed
        .skip(DataIntegrityViolationException.class) // Skip on this exception
        .skip(InvalidDataException.class)
        .noSkip(DatabaseConnectionException.class)   // Never skip on this
        .listener(skipListener())                    // Log skipped items
        .build();
}

@Component
public class BatchSkipListener implements SkipListener<Customer, Invoice> {

    @Override
    public void onSkipInRead(Throwable t) {
        log.error("Skipped during READ: {}", t.getMessage());
    }

    @Override
    public void onSkipInProcess(Customer customer, Throwable t) {
        log.error("Skipped during PROCESS for customer {}: {}",
            customer.getId(), t.getMessage());
        auditService.logSkippedRecord("PROCESS", customer.getId(), t);
    }

    @Override
    public void onSkipInWrite(Invoice invoice, Throwable t) {
        log.error("Skipped during WRITE for invoice {}: {}",
            invoice.getId(), t.getMessage());
    }
}
```

## 13.2 Retry Logic

Automatically retry failed operations (useful for transient errors like DB timeouts):

```java
@Bean
public Step retryableStep(JobRepository jobRepo,
                           PlatformTransactionManager txManager) {
    return new StepBuilder("retryableStep", jobRepo)
        .<Order, Settlement>chunk(100, txManager)
        .reader(orderReader())
        .processor(settlementProcessor())
        .writer(settlementWriter())
        .faultTolerant()
        .retryLimit(3)                                 // Retry up to 3 times
        .retry(TransientDataAccessException.class)     // Retry on DB timeout
        .retry(OptimisticLockingFailureException.class)
        .noRetry(ValidationException.class)            // Don't retry validation errors
        .build();
}
```

## 13.3 Custom Retry and Skip Together

```java
@Bean
public Step robustStep(JobRepository jobRepo,
                        PlatformTransactionManager txManager) {
    return new StepBuilder("robustStep", jobRepo)
        .<Input, Output>chunk(100, txManager)
        .reader(reader())
        .processor(processor())
        .writer(writer())
        .faultTolerant()
        // Retry transient errors 3 times
        .retryLimit(3)
        .retry(DeadlockLoserDataAccessException.class)
        .retry(CannotAcquireLockException.class)
        // After retries exhausted, skip and continue
        .skipLimit(100)
        .skip(Exception.class)
        .noSkip(FatalBatchException.class)  // Never skip fatal errors
        .listener(skipListener())
        .listener(retryListener())
        .build();
}
```

## 13.4 Transaction Rollback

By default, Spring Batch rolls back the entire chunk transaction on error. You can configure exceptions that should NOT cause rollback:

```java
.noRollback(ValidationException.class)  // Don't rollback for validation errors
```

---

# Part 14: Job Monitoring

## 14.1 JobExecution

```java
@RestController
@RequestMapping("/api/batch")
public class BatchMonitorController {

    @Autowired
    private JobExplorer jobExplorer;

    @GetMapping("/jobs/{jobName}/executions")
    public List<JobExecutionDTO> getExecutions(@PathVariable String jobName) {
        List<JobInstance> instances = jobExplorer
            .getJobInstances(jobName, 0, 20);

        return instances.stream()
            .flatMap(instance ->
                jobExplorer.getJobExecutions(instance).stream())
            .map(exec -> new JobExecutionDTO(
                exec.getId(),
                exec.getStatus().toString(),
                exec.getStartTime(),
                exec.getEndTime(),
                exec.getExitStatus().getExitCode(),
                getStepSummaries(exec)
            ))
            .collect(Collectors.toList());
    }
}
```

## 14.2 StepExecution Monitoring

```java
@Component
public class StepMonitorListener implements StepExecutionListener {

    @Override
    public void afterStep(StepExecution stepExecution) {
        log.info("Step: {} | Status: {} | Read: {} | Processed: {} | " +
                 "Written: {} | Skipped: {} | Duration: {}ms",
            stepExecution.getStepName(),
            stepExecution.getStatus(),
            stepExecution.getReadCount(),
            stepExecution.getFilterCount(),
            stepExecution.getWriteCount(),
            stepExecution.getSkipCount(),
            Duration.between(stepExecution.getStartTime(),
                stepExecution.getEndTime()).toMillis()
        );

        // Send metrics to Prometheus/Grafana
        metricsService.recordStepMetrics(
            stepExecution.getStepName(),
            stepExecution.getReadCount(),
            stepExecution.getWriteCount(),
            stepExecution.getSkipCount()
        );
    }
}
```

## 14.3 Production Monitoring Dashboard Metrics

| Metric | What to Monitor |
|---|---|
| `batch.job.duration` | Total job execution time |
| `batch.step.read.count` | Records read per step |
| `batch.step.write.count` | Records written per step |
| `batch.step.skip.count` | Records skipped (errors) |
| `batch.job.status` | COMPLETED, FAILED, STOPPED |
| `batch.step.throughput` | Records processed per second |
| Queue depth | Unprocessed items in work queue |
| Thread pool utilization | Active threads vs pool size |

---

# Part 15: Spring Batch Database Tables

## 15.1 Internal Tables

Spring Batch automatically creates metadata tables to track job execution:

| Table | Purpose |
|---|---|
| `BATCH_JOB_INSTANCE` | Logical job run (unique per job name + parameters) |
| `BATCH_JOB_EXECUTION` | Physical job run (each attempt, including restarts) |
| `BATCH_JOB_EXECUTION_PARAMS` | Parameters passed to the job |
| `BATCH_JOB_EXECUTION_CONTEXT` | Serialized ExecutionContext for the job |
| `BATCH_STEP_EXECUTION` | Each step's execution details |
| `BATCH_STEP_EXECUTION_CONTEXT` | Serialized ExecutionContext for the step |

## 15.2 Table Relationships

```
BATCH_JOB_INSTANCE (1) -----> (*) BATCH_JOB_EXECUTION
     |                                     |
     | (job name + params = unique)        | (each run/restart)
     |                                     |
     |                                     +-----> (*) BATCH_STEP_EXECUTION
     |                                     |           (one per step per execution)
     |                                     |
     |                                     +-----> (*) BATCH_JOB_EXECUTION_PARAMS
     |                                     |
     |                                     +-----> (1) BATCH_JOB_EXECUTION_CONTEXT
```

## 15.3 Key Fields

### BATCH_JOB_EXECUTION
| Column | Description |
|---|---|
| `JOB_EXECUTION_ID` | Primary key |
| `JOB_INSTANCE_ID` | FK to job instance |
| `START_TIME` | When the job started |
| `END_TIME` | When the job ended |
| `STATUS` | COMPLETED, STARTED, FAILED, STOPPED, ABANDONED |
| `EXIT_CODE` | COMPLETED, FAILED, NOOP, etc. |
| `EXIT_MESSAGE` | Error message if failed |

### BATCH_STEP_EXECUTION
| Column | Description |
|---|---|
| `STEP_EXECUTION_ID` | Primary key |
| `STEP_NAME` | Name of the step |
| `READ_COUNT` | Number of items read |
| `WRITE_COUNT` | Number of items written |
| `COMMIT_COUNT` | Number of chunks committed |
| `SKIP_COUNT_READ/PROCESS/WRITE` | Skipped items at each phase |
| `ROLLBACK_COUNT` | Number of rollbacks |

## 15.4 Configuration

```yaml
# application.yml
spring:
  batch:
    jdbc:
      initialize-schema: always  # Create tables on startup (dev)
      # initialize-schema: never  # Production (use Flyway/Liquibase)
    job:
      enabled: false  # Don't auto-run jobs on startup
```

---

# Part 16: Spring Batch + Scheduler Integration

## 16.1 Trigger Batch Jobs with Scheduler

```java
@Component
public class BatchJobScheduler {

    @Autowired
    private JobLauncher jobLauncher;

    @Autowired
    @Qualifier("invoiceGenerationJob")
    private Job invoiceJob;

    @Autowired
    @Qualifier("dailyNoticeJob")
    private Job noticeJob;

    // Trigger invoice generation at midnight on the 1st of each month
    @Scheduled(cron = "0 0 0 1 * *")
    public void triggerMonthlyInvoiceJob() {
        try {
            JobParameters params = new JobParametersBuilder()
                .addString("month", YearMonth.now().toString())
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

            JobExecution execution = jobLauncher.run(invoiceJob, params);
            log.info("Invoice job started with status: {}",
                execution.getStatus());
        } catch (Exception e) {
            log.error("Failed to start invoice job", e);
            alertService.sendCriticalAlert("Invoice batch job failed to start", e);
        }
    }

    // Trigger notice generation every midnight
    @Scheduled(cron = "0 0 0 * * *")
    public void triggerDailyNoticeJob() {
        try {
            JobParameters params = new JobParametersBuilder()
                .addString("date", LocalDate.now().toString())
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

            jobLauncher.run(noticeJob, params);
        } catch (Exception e) {
            log.error("Failed to start notice job", e);
        }
    }
}
```

## 16.2 REST API Trigger (Manual Execution)

```java
@RestController
@RequestMapping("/api/batch")
public class BatchJobController {

    @Autowired private JobLauncher jobLauncher;
    @Autowired private Job invoiceJob;

    @PostMapping("/jobs/invoice/run")
    public ResponseEntity<String> runInvoiceJob(
            @RequestParam String month) {
        try {
            JobParameters params = new JobParametersBuilder()
                .addString("month", month)
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();

            JobExecution execution = jobLauncher.run(invoiceJob, params);
            return ResponseEntity.ok(
                "Job started with ID: " + execution.getId());
        } catch (JobInstanceAlreadyCompleteException e) {
            return ResponseEntity.status(409)
                .body("Job already completed for this month");
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body("Failed to start job: " + e.getMessage());
        }
    }
}
```

---

# Part 17: Microservice Architecture with Batch

## 17.1 Architecture Overview

```
+------------------------------------------------------------------+
|                      API Gateway                                  |
+------------------------------------------------------------------+
     |              |                |                |
     v              v                v                v
+----------+  +----------+  +--------------+  +--------------+
| Eligib.  |  | Notice   |  | Notification |  | Batch        |
| Service  |  | Service  |  | Service      |  | Processor    |
| (REST)   |  | (REST)   |  | (REST)       |  | Service      |
+----------+  +----------+  +--------------+  +--------------+
     |              |                |                |
     v              v                v                v
+----------+  +----------+  +--------------+  +--------------+
| Eligib.  |  | Notice   |  | Email/SMS    |  | Batch Jobs   |
| Rules    |  | Template |  | Gateway      |  | Spring Batch |
| Engine   |  | Engine   |  |              |  | + Scheduler  |
+----------+  +----------+  +--------------+  +--------------+
     |              |                                |
     +-------+------+                                |
             |                                       |
             v                                       v
     +--------------+                        +--------------+
     |  PostgreSQL  |                        |  PostgreSQL  |
     |  (Services)  |                        |  (Batch Meta)|
     +--------------+                        +--------------+
             |
             v
     +--------------+
     |    Kafka     |  (Event-driven communication)
     +--------------+
```

## 17.2 Batch Processing Service

```java
@SpringBootApplication
@EnableBatchProcessing
@EnableScheduling
public class BatchProcessorServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(BatchProcessorServiceApplication.class, args);
    }
}
```

### Inter-Service Communication from Batch

```java
@Component
public class EligibilityCheckProcessor
        implements ItemProcessor<Client, Client> {

    @Autowired
    private WebClient eligibilityServiceClient;

    @Override
    public Client process(Client client) throws Exception {
        // Call Eligibility Service via REST
        EligibilityResult result = eligibilityServiceClient.get()
            .uri("/api/eligibility/{clientId}", client.getId())
            .retrieve()
            .bodyToMono(EligibilityResult.class)
            .block(Duration.ofSeconds(5));

        if (result != null && result.isStatusChanged()) {
            client.setEligibilityStatus(result.getNewStatus());
            return client;
        }
        return null; // Skip unchanged
    }
}

// Writer: Publish event to Kafka for Notification Service
@Component
public class NotificationEventWriter implements ItemWriter<Notice> {

    @Autowired
    private KafkaTemplate<String, NoticeEvent> kafkaTemplate;

    @Override
    public void write(Chunk<? extends Notice> notices) throws Exception {
        for (Notice notice : notices) {
            NoticeEvent event = new NoticeEvent(
                notice.getClientId(),
                notice.getType(),
                notice.getClientEmail()
            );
            kafkaTemplate.send("notice-events", event);
        }
    }
}
```

---

# Part 18: Build It Yourself — Daily Invoice Generation Batch Job

> **Goal:** Build a Spring Batch job that reads customers, generates invoices, and writes results — with scheduling and error handling.

## Concept Overview

```
Spring Batch Flow:
  @Scheduled → JobLauncher → Job → Step → Reader → Processor → Writer
                                          (DB)     (Calculate)  (DB)
```

| Component | What It Does | Why |
|---|---|---|
| `ItemReader` | Reads customers in pages | Prevents memory overflow |
| `ItemProcessor` | Calculates invoice amounts | Business logic transformation |
| `ItemWriter` | Saves invoices in batches | Performance optimization |
| Chunk processing | Groups of 100 per transaction | Limits rollback scope |

---

## Step 1: Add Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-batch</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

---

## Step 2: Define Entities

```java
@Entity @Table(name = "customers")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Customer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String email;
    private BigDecimal monthlyRate;
    private boolean active;
}

@Entity @Table(name = "invoices")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Invoice {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long customerId;
    private String invoiceNumber;
    private BigDecimal amount;
    private BigDecimal tax;
    private BigDecimal totalAmount;
    private String month;
    private LocalDateTime generatedAt;
}
```

---

## Step 3: Create the Batch Job Configuration

```java
@Configuration
public class InvoiceBatchConfig {

    // READER: Reads active customers in pages of 100
    @Bean
    public JpaPagingItemReader<Customer> customerReader(EntityManagerFactory emf) {
        return new JpaPagingItemReaderBuilder<Customer>()
            .name("customerReader")
            .entityManagerFactory(emf)
            .queryString("SELECT c FROM Customer c WHERE c.active = true")
            .pageSize(100)
            .build();
    }

    // PROCESSOR: Transforms Customer → Invoice (business logic)
    @Bean
    public ItemProcessor<Customer, Invoice> invoiceProcessor() {
        return customer -> {
            BigDecimal tax = customer.getMonthlyRate().multiply(new BigDecimal("0.18"));
            return Invoice.builder()
                .customerId(customer.getId())
                .invoiceNumber("INV-" + YearMonth.now() + "-" + customer.getId())
                .amount(customer.getMonthlyRate())
                .tax(tax)
                .totalAmount(customer.getMonthlyRate().add(tax))
                .month(YearMonth.now().toString())
                .generatedAt(LocalDateTime.now())
                .build();
        };
    }

    // WRITER: Saves invoices to database
    @Bean
    public JpaItemWriter<Invoice> invoiceWriter(EntityManagerFactory emf) {
        JpaItemWriter<Invoice> writer = new JpaItemWriter<>();
        writer.setEntityManagerFactory(emf);
        return writer;
    }

    // STEP: Read → Process → Write in chunks of 100
    @Bean
    public Step invoiceStep(JobRepository jobRepo, PlatformTransactionManager txMgr) {
        return new StepBuilder("invoiceStep", jobRepo)
            .<Customer, Invoice>chunk(100, txMgr)
            .reader(customerReader(null))
            .processor(invoiceProcessor())
            .writer(invoiceWriter(null))
            .faultTolerant()
            .skipLimit(50).skip(Exception.class)       // Skip bad records
            .retryLimit(3).retry(TransientDataAccessException.class)  // Retry on DB timeout
            .build();
    }

    // JOB: Container for steps
    @Bean
    public Job invoiceJob(JobRepository jobRepo, Step invoiceStep) {
        return new JobBuilder("invoiceJob", jobRepo)
            .start(invoiceStep)
            .build();
    }
}
```

---

## Step 4: Schedule the Job

```java
@Component
public class InvoiceJobScheduler {

    @Autowired private JobLauncher jobLauncher;
    @Autowired private Job invoiceJob;

    @Scheduled(cron = "0 0 0 1 * *")     // Midnight on 1st of every month
    public void triggerMonthlyInvoicing() {
        try {
            JobParameters params = new JobParametersBuilder()
                .addString("month", YearMonth.now().toString())
                .addLong("timestamp", System.currentTimeMillis())
                .toJobParameters();
            jobLauncher.run(invoiceJob, params);
        } catch (Exception e) {
            log.error("Invoice job failed!", e);
        }
    }
}
```

---

## Step 5: Configure and Run

```yaml
spring:
  batch:
    jdbc:
      initialize-schema: always
    job:
      enabled: false                   # Don't auto-run on startup
```

---

## Key Takeaways

| Concept | Remember |
|---|---|
| Chunk processing | Read-Process-Write in batch sizes (e.g., 100) |
| Each chunk = 1 transaction | Failure rolls back only that chunk |
| Skip/Retry | Bad records logged and skipped, job continues |
| Job Parameters | Make each run unique with timestamp |
| @Scheduled + JobLauncher | Fully automated batch processing |

---
