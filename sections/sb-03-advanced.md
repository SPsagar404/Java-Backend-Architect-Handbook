
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
