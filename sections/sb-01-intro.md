# Mastering Spring Boot Batch Processing & Scheduling -- Internals, Architecture, and Enterprise Usage Guide

---

**Author:** Senior Java Architect
**Target Audience:** Java developers with 3+ years of experience aiming for senior/architect-level roles
**Prerequisites:** Core Java, Spring Boot, Spring Data JPA, REST APIs, Microservices basics

---

# Table of Contents

1. Introduction to Batch Processing
2. Spring Boot Scheduler
3. Spring Scheduling Architecture
4. Spring Boot Scheduler Implementation
5. Cron Expressions
6. Spring Boot Batch Processing
7. Spring Batch Architecture
8. Spring Batch Components
9. Spring Batch Project Structure
10. Complete Batch Job Implementation
11. Real-Time Production Scenario
12. Handling Large Datasets
13. Error Handling in Batch Jobs
14. Job Monitoring
15. Spring Batch Database Tables
16. Spring Batch + Scheduler Integration
17. Microservice Architecture with Batch
18. Production Best Practices
19. Performance Optimization
20. Common Production Issues
21. Interview Questions (50+)
22. Coding Exercises (15+)

---

# Part 1: Introduction to Batch Processing

## 1.1 What is Batch Processing?

**Batch processing** is the execution of a series of tasks (jobs) on a collection of data without manual intervention. Jobs run at scheduled times or when triggered, processing bulk data in a single operation rather than handling individual records one at a time.

Key characteristics:
- **Non-interactive** -- no user input required during execution
- **Volume-oriented** -- processes large datasets (thousands to millions of records)
- **Scheduled** -- runs at specific times (nightly, hourly, weekly)
- **Automated** -- no human intervention after trigger
- **Transactional** -- supports rollback on failure

## 1.2 Why Batch Processing is Required in Enterprise Systems

| Requirement | Why Batch Processing? |
|---|---|
| Monthly payroll for 50,000 employees | Cannot process in real-time; requires bulk salary calculation |
| Daily bank statement generation | Millions of accounts need statements generated overnight |
| Government benefits eligibility | Nightly recalculation for eligibility changes |
| Insurance premium recalculation | Quarterly bulk recalculation for all policyholders |
| Data warehouse ETL | Extract, transform, load millions of records from source systems |
| Regulatory reporting | Generate compliance reports from aggregated data |

## 1.3 Batch vs Real-Time vs Event-Driven Processing

| Feature | Batch Processing | Real-Time Processing | Event-Driven Processing |
|---|---|---|---|
| **When it runs** | Scheduled (cron, timer) | Immediately on request | On event occurrence |
| **Data volume** | Large (bulk) | Single record | Single event |
| **Latency** | Minutes to hours | Milliseconds | Milliseconds to seconds |
| **Example** | Nightly payroll | REST API response | Kafka consumer |
| **User waits?** | No | Yes | No |
| **Tools** | Spring Batch, Quartz | Spring MVC, WebFlux | Kafka, RabbitMQ |
| **Use case** | Report generation | Order placement | Order status notification |

## 1.4 Real-World Enterprise Examples

### Bank Transaction Processing
```
Nightly Job (2:00 AM):
1. Read all transactions from the day
2. Calculate interest for savings accounts
3. Apply fees and charges
4. Generate account statements
5. Update account balances
6. Generate regulatory reports
```

### Government Benefits System
```
Daily Eligibility Job (12:00 AM):
1. Read all citizen records with status changes
2. Verify income thresholds
3. Check document validity
4. Calculate benefit amounts
5. Generate eligibility notices
6. Queue notices for mailing
```

### Invoice Generation System
```
Monthly Job (1st of every month):
1. Read all customer accounts
2. Calculate usage charges
3. Apply discounts and taxes
4. Generate PDF invoices
5. Store in document management system
6. Send email notifications
```

---

# Part 2: Spring Boot Scheduler

## 2.1 What is Scheduling?

**Scheduling** is the mechanism to execute a task automatically at a specific time, at fixed intervals, or based on a cron expression. Spring Boot provides a lightweight, annotation-based scheduling framework built into the core.

## 2.2 Why Scheduling is Used

| Scenario | Scheduling Need |
|---|---|
| Cache refresh | Refresh distributed cache every 15 minutes |
| Database cleanup | Delete expired sessions every hour |
| Report generation | Generate daily sales report at midnight |
| Health checks | Ping dependent services every 30 seconds |
| Notification emails | Send digest emails every morning at 8 AM |
| Data synchronization | Sync data with external API every 5 minutes |
| Log archival | Archive and compress old logs weekly |
| Reconciliation | Match payment records with bank at end of day |

## 2.3 Common Production Jobs

### Daily Report Generation
```java
@Scheduled(cron = "0 0 6 * * *") // Every day at 6:00 AM
public void generateDailySalesReport() {
    LocalDate yesterday = LocalDate.now().minusDays(1);
    List<Order> orders = orderRepository.findByDate(yesterday);
    ReportData report = reportService.buildSalesReport(orders);
    pdfService.generate(report);
    emailService.sendToManagement(report);
}
```

### Cache Refresh
```java
@Scheduled(fixedRate = 900000) // Every 15 minutes
public void refreshProductCache() {
    List<Product> products = productRepository.findAllActive();
    cacheManager.getCache("products").clear();
    products.forEach(p -> cacheManager.getCache("products").put(p.getId(), p));
    log.info("Product cache refreshed with {} items", products.size());
}
```

### Database Cleanup
```java
@Scheduled(cron = "0 0 3 * * *") // Every day at 3:00 AM
public void cleanupExpiredSessions() {
    Instant cutoff = Instant.now().minus(Duration.ofHours(24));
    int deleted = sessionRepository.deleteByLastAccessBefore(cutoff);
    log.info("Cleaned up {} expired sessions", deleted);
}
```

---

# Part 3: Spring Scheduling Architecture

## 3.1 Architecture Overview

```
+-------------------------------------------------------------+
|                  Spring Boot Application                     |
|                                                              |
|  +------------------+    +-------------------------------+   |
|  |   @Scheduled     |    |     TaskScheduler             |   |
|  |   Methods         |--->|   (ThreadPoolTaskScheduler)   |   |
|  +------------------+    +-------------------------------+   |
|         |                          |                         |
|         v                          v                         |
|  +------------------+    +-------------------------------+   |
|  |  Service Layer   |    |   ScheduledExecutorService    |   |
|  |  (Business Logic)|    |   (Thread Pool: 1 by default) |   |
|  +------------------+    +-------------------------------+   |
|         |                                                    |
|         v                                                    |
|  +------------------+                                        |
|  |   Repository     |                                        |
|  |   (Data Access)  |                                        |
|  +------------------+                                        |
|         |                                                    |
|         v                                                    |
|  +------------------+                                        |
|  |   Database       |                                        |
|  +------------------+                                        |
+-------------------------------------------------------------+
```

## 3.2 How @Scheduled Works Internally

1. **Application Startup**: Spring scans for `@EnableScheduling` annotation
2. **Bean Post Processing**: `ScheduledAnnotationBeanPostProcessor` finds all `@Scheduled` methods
3. **Task Registration**: Each method is registered as a `ScheduledTask` with the `TaskScheduler`
4. **Thread Pool**: By default, Spring uses a **single-threaded** `ScheduledExecutorService`
5. **Execution**: At trigger time, the executor runs the method in its thread pool
6. **Repeat**: The scheduler re-schedules based on fixedRate, fixedDelay, or cron

**WARNING:** Default thread pool size is **1**. If you have multiple scheduled tasks, they will execute sequentially, not in parallel!

### Configuring Thread Pool
```java
@Configuration
public class SchedulerConfig implements SchedulingConfigurer {

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(5); // 5 threads for scheduled tasks
        scheduler.setThreadNamePrefix("scheduler-");
        scheduler.setErrorHandler(t ->
            log.error("Scheduled task error", t));
        scheduler.initialize();
        registrar.setTaskScheduler(scheduler);
    }
}
```

---

# Part 4: Spring Boot Scheduler Implementation

## 4.1 Enable Scheduling

```java
@SpringBootApplication
@EnableScheduling
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

## 4.2 @Scheduled Types

### fixedRate -- Execute at Fixed Intervals

**What:** Executes the method at a fixed interval, measured from the **start** of the previous execution.

**When to use:** When you need consistent execution frequency regardless of task duration.

**Production Example:** Health check pings
```java
@Component
public class HealthCheckScheduler {

    @Autowired
    private List<ServiceHealthCheck> healthChecks;

    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void checkServiceHealth() {
        healthChecks.forEach(check -> {
            try {
                boolean healthy = check.ping();
                metricsService.recordHealth(check.getName(), healthy);
                if (!healthy) {
                    alertService.sendAlert(check.getName() + " is DOWN");
                }
            } catch (Exception e) {
                log.error("Health check failed for {}", check.getName(), e);
            }
        });
    }
}
```

### fixedDelay -- Execute After Previous Completes

**What:** Waits for the previous execution to **complete**, then waits the specified delay before starting the next.

**When to use:** When tasks must not overlap, and the next run depends on the previous one finishing.

**Production Example:** Data synchronization
```java
@Component
public class DataSyncScheduler {

    @Scheduled(fixedDelay = 60000) // 60 seconds after previous completes
    public void syncWithExternalSystem() {
        log.info("Starting sync at {}", Instant.now());
        List<Record> unsyncedRecords = recordRepository.findUnsynced();

        for (Record record : unsyncedRecords) {
            try {
                externalApi.push(record);
                record.setSynced(true);
                recordRepository.save(record);
            } catch (Exception e) {
                log.error("Sync failed for record {}", record.getId(), e);
            }
        }
        log.info("Sync completed. Processed {} records", unsyncedRecords.size());
    }
}
```

### cron -- Execute Based on Cron Expression

**What:** Executes at times defined by a cron expression (most flexible).

**When to use:** Specific times of day, specific days of week/month.

**Production Example:** End-of-day reconciliation
```java
@Component
public class ReconciliationScheduler {

    @Scheduled(cron = "0 0 23 * * MON-FRI") // 11 PM on weekdays
    public void runDailyReconciliation() {
        LocalDate today = LocalDate.now();
        log.info("Starting reconciliation for {}", today);

        List<Transaction> ourRecords = transactionRepo.findByDate(today);
        List<BankTransaction> bankRecords = bankApi.getTransactions(today);

        ReconciliationResult result = reconciliationService
            .reconcile(ourRecords, bankRecords);

        reportService.generateReconciliationReport(result);

        if (result.hasDiscrepancies()) {
            alertService.notifyFinanceTeam(result.getDiscrepancies());
        }
    }
}
```

### Comparison

| Feature | fixedRate | fixedDelay | cron |
|---|---|---|---|
| Timer starts from | Start of previous | End of previous | Absolute time |
| Overlap possible? | Yes (if task is slow) | No | Depends |
| Best for | Periodic polling | Sequential processing | Specific schedules |
| Example | Health checks | Data sync | Nightly reports |

---

# Part 5: Cron Expressions

## 5.1 Cron Syntax (Spring Format)

Spring uses a **6-field** cron expression:

```
+------------ Second (0-59)
| +---------- Minute (0-59)
| | +-------- Hour (0-23)
| | | +------ Day of Month (1-31)
| | | | +---- Month (1-12 or JAN-DEC)
| | | | | +-- Day of Week (0-7 or SUN-SAT, 0 and 7 are both Sunday)
| | | | | |
* * * * * *
```

## 5.2 Special Characters

| Character | Meaning | Example |
|---|---|---|
| `*` | Every value | `* * * * * *` = every second |
| `,` | List of values | `0 0 8,12,18 * * *` = at 8AM, 12PM, 6PM |
| `-` | Range | `0 0 9-17 * * *` = every hour 9AM-5PM |
| `/` | Increment | `0 */15 * * * *` = every 15 minutes |
| `?` | No specific value | Used in Day-of-Month or Day-of-Week |
| `MON-FRI` | Named days | `0 0 9 * * MON-FRI` = weekdays at 9AM |

## 5.3 Common Cron Expressions

| Cron Expression | Description |
|---|---|
| `0 * * * * *` | Every minute |
| `0 0 * * * *` | Every hour |
| `0 0 0 * * *` | Every midnight |
| `0 0 6 * * *` | Every day at 6:00 AM |
| `0 0 0 * * SUN` | Every Sunday at midnight |
| `0 0 0 1 * *` | First day of every month |
| `0 0 0 L * *` | Last day of every month |
| `0 0 22 * * MON-FRI` | Weekdays at 10:00 PM |
| `0 */30 * * * *` | Every 30 minutes |
| `0 0 9-17 * * MON-FRI` | Every hour 9AM-5PM weekdays |
| `0 0 0 1 1,4,7,10 *` | First day of each quarter |

## 5.4 Externalized Cron in Production
```java
// application.yml
scheduler:
  reconciliation-cron: "0 0 23 * * MON-FRI"
  cleanup-cron: "0 0 3 * * *"
  report-cron: "0 0 6 * * *"

// Scheduler class
@Scheduled(cron = "${scheduler.reconciliation-cron}")
public void runReconciliation() { ... }

@Scheduled(cron = "${scheduler.cleanup-cron}")
public void runCleanup() { ... }
```

---

# Part 6: Spring Boot Batch Processing

## 6.1 What is Spring Batch?

**Spring Batch** is a lightweight, comprehensive framework for developing robust batch applications. It provides reusable functions for processing large volumes of records, including:

- Reading from databases, files, queues
- Processing/transforming data
- Writing to databases, files, services
- Transaction management
- Job restart and retry
- Chunk-based processing
- Parallel execution

### Maven Dependency
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

## 6.2 Why Spring Batch?

| Challenge | Spring Batch Solution |
|---|---|
| Processing millions of records | Chunk-based processing (configurable chunk size) |
| Transaction management | Automatic transaction per chunk |
| Failure recovery | Built-in restart, skip, retry mechanisms |
| Job monitoring | JobRepository tracks execution history |
| Scalability | Partitioning, multi-threaded steps, remote chunking |
| Reusability | Pre-built readers/writers for files, DB, JMS |

## 6.3 Real-World Scenarios

### Processing Millions of Records
```
Scenario: Insurance Company Premium Recalculation
- 2 million active policies
- Each policy needs:
  1. Risk factor recalculation
  2. Premium amount calculation
  3. Discount application
  4. Notice generation
- Must complete in 4-hour batch window (2 AM - 6 AM)
- Solution: Spring Batch with chunk size 500, 8 partitions
  -> 2,000,000 / 500 = 4,000 chunks
  -> 4,000 / 8 partitions = 500 chunks per partition
  -> ~30 minutes total processing time
```

### Daily Benefit Eligibility
```
Scenario: Government Benefits Portal
- 500,000 citizens enrolled
- Daily recalculation based on:
  1. Income changes
  2. Family size changes
  3. Employment status
  4. Age thresholds
- Generate eligibility notices for status changes
- Solution: Spring Batch reads citizens, processes eligibility rules,
  writes updated records and generates notices
```

### Bank Settlement Processing
```
Scenario: End-of-Day Settlement
- Process all inter-bank transactions
- Net settlement calculations
- Generate SWIFT messages
- Update general ledger
- Regulatory reporting
- Must complete before next business day opening
```

---
