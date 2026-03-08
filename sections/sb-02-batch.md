
# Part 7: Spring Batch Architecture

### What is Spring Batch?
Spring Batch is an enterprise-grade framework for **batch processing** — the automated, unattended processing of large volumes of data. It provides reusable components for reading, processing, and writing data with built-in transaction management, error handling, and restart capability.

### Why Spring Batch Over Custom Solutions
| Custom batch code | Spring Batch |
|---|---|
| Manual loop over records | Chunk-based processing with automatic transactions |
| No restart capability | Restart from last successful chunk after failure |
| Manual error handling | Skip, retry, and error policies built-in |
| No execution tracking | Full execution metadata (JobRepository) |
| Custom scheduling | Integration with Spring Scheduler, Quartz |

### When to Use Spring Batch
- Processing **thousands to millions of records** (invoices, statements, reports)
- **Nightly/scheduled jobs** (data migration, ETL, reconciliation)
- When you need **restartability** after failures
- When you need **audit trails** of batch executions

### When NOT to Use Spring Batch
- **Real-time processing** — use event-driven (Kafka) or reactive (WebFlux)
- **Simple cron tasks** with no large data processing — use `@Scheduled` instead
- **Streaming data** — use Kafka Streams or Spring Cloud Stream

## 7.1 Core Architecture

```
+---------------------------------------------------------------+
|                         JobLauncher                            |
|                    (Triggers job execution)                    |
+---------------------------------------------------------------+
         |                                       |
         v                                       v
+------------------+                    +------------------+
|       Job        |                    |  JobRepository   |
| (Batch workflow) |                    | (Execution       |
|                  |                    |  metadata store)  |
+------------------+                    +------------------+
         |
         v
+------------------+
|      Step 1      |  (Each step = one unit of work)
+------------------+
         |
         v
+------------------+     +------------------+     +------------------+
|   ItemReader     | --> |  ItemProcessor   | --> |   ItemWriter     |
| (Read data)      |     | (Transform data) |     | (Write data)     |
+------------------+     +------------------+     +------------------+
         |
         v
+------------------+
|      Step 2      |  (Jobs can have multiple steps)
+------------------+
         |
         v
+------------------+     +------------------+     +------------------+
|   ItemReader     | --> |  ItemProcessor   | --> |   ItemWriter     |
+------------------+     +------------------+     +------------------+
```

## 7.2 Chunk-Oriented Processing

Spring Batch processes data in **chunks**. A chunk is a group of items read, processed, and written together within a single transaction.

```
Chunk Processing Flow (chunk-size = 100):

1. READ Phase:
   Reader reads 100 items one by one
   [item1, item2, item3, ... item100]

2. PROCESS Phase:
   Processor transforms each item
   [processed1, processed2, ... processed100]

3. WRITE Phase:
   Writer writes all 100 items in one batch
   [write all 100 to database in single transaction]

4. COMMIT Transaction

5. Repeat for next chunk until no more items
```

### Why Chunk Processing?
- **Memory efficient** -- only one chunk in memory at a time
- **Transaction boundary** -- each chunk is one transaction
- **Failure recovery** -- restart from the last successful chunk
- **Performance** -- batch writes are faster than individual writes

---

# Part 8: Spring Batch Components

### Component Overview
Every Spring Batch job follows the **Reader → Processor → Writer** pattern (inspired by the ETL pattern from data warehousing). Each component has a single responsibility:

| Component | Responsibility | Analogy |
|---|---|---|
| **Job** | The entire batch workflow | A recipe |
| **Step** | One phase of the workflow | One cooking step |
| **ItemReader** | Read one item at a time from source | Get ingredients |
| **ItemProcessor** | Transform/validate one item | Prepare ingredients |
| **ItemWriter** | Write a batch of items to target | Cook and plate |
| **JobRepository** | Store execution metadata | Chef's journal |
| **JobLauncher** | Trigger job execution | Starting the timer |

## 8.1 Job

**What:** The top-level container for a batch process. A Job is composed of one or more Steps.

**Internal:** `Job` interface is implemented by `SimpleJob` (sequential steps) or `FlowJob` (conditional flow).

```java
@Bean
public Job invoiceGenerationJob(JobRepository jobRepository,
                                 Step calculateStep,
                                 Step generatePdfStep,
                                 Step sendEmailStep) {
    return new JobBuilder("invoiceGenerationJob", jobRepository)
        .start(calculateStep)
        .next(generatePdfStep)
        .next(sendEmailStep)
        .build();
}
```

## 8.2 Step

**What:** A single phase of a Job. Each Step has exactly one `ItemReader`, `ItemProcessor`, and `ItemWriter`.

**Types:**
- **Chunk-oriented Step** -- reads, processes, writes in chunks (most common)
- **Tasklet Step** -- executes a single task (cleanup, file deletion, etc.)

```java
@Bean
public Step calculateChargesStep(JobRepository jobRepository,
                                  PlatformTransactionManager txManager) {
    return new StepBuilder("calculateChargesStep", jobRepository)
        .<Customer, Invoice>chunk(100, txManager)  // Chunk size = 100
        .reader(customerReader())
        .processor(invoiceProcessor())
        .writer(invoiceWriter())
        .build();
}

// Tasklet Step (for simple tasks)
@Bean
public Step cleanupStep(JobRepository jobRepository,
                         PlatformTransactionManager txManager) {
    return new StepBuilder("cleanupStep", jobRepository)
        .tasklet((contribution, chunkContext) -> {
            fileService.deleteTemporaryFiles();
            return RepeatStatus.FINISHED;
        }, txManager)
        .build();
}
```

## 8.3 ItemReader

**What:** Reads data from a source (database, file, queue, API). Returns one item at a time; returns `null` when no more items.

**Built-in Readers:**

| Reader | Source | Use Case |
|---|---|---|
| `JdbcCursorItemReader` | Database (JDBC cursor) | Small-medium datasets |
| `JdbcPagingItemReader` | Database (paging queries) | Large datasets |
| `JpaPagingItemReader` | Database (JPA paging) | JPA-based applications |
| `FlatFileItemReader` | CSV/text files | File processing |
| `JsonItemReader` | JSON files | JSON data import |
| `StaxEventItemReader` | XML files | XML data import |

```java
@Bean
public JpaPagingItemReader<Customer> customerReader(EntityManagerFactory emf) {
    return new JpaPagingItemReaderBuilder<Customer>()
        .name("customerReader")
        .entityManagerFactory(emf)
        .queryString("SELECT c FROM Customer c WHERE c.active = true")
        .pageSize(100)
        .build();
}
```

## 8.4 ItemProcessor

**What:** Transforms or filters items. Takes one item, returns a transformed item (or `null` to skip).

```java
@Component
public class InvoiceProcessor implements ItemProcessor<Customer, Invoice> {

    @Autowired
    private PricingService pricingService;

    @Override
    public Invoice process(Customer customer) throws Exception {
        // Skip inactive customers
        if (!customer.isActive()) {
            return null; // Returning null = skip this item
        }

        Invoice invoice = new Invoice();
        invoice.setCustomerId(customer.getId());
        invoice.setAmount(pricingService.calculate(customer));
        invoice.setDueDate(LocalDate.now().plusDays(30));
        invoice.setStatus(InvoiceStatus.GENERATED);
        return invoice;
    }
}
```

## 8.5 ItemWriter

**What:** Writes a list of items (one chunk) to the target (database, file, API).

```java
@Bean
public JpaItemWriter<Invoice> invoiceWriter(EntityManagerFactory emf) {
    JpaItemWriter<Invoice> writer = new JpaItemWriter<>();
    writer.setEntityManagerFactory(emf);
    return writer;
}

// Custom writer for complex scenarios
@Component
public class NoticeWriter implements ItemWriter<Notice> {

    @Autowired
    private NoticeRepository noticeRepository;
    @Autowired
    private PdfService pdfService;

    @Override
    public void write(Chunk<? extends Notice> notices) throws Exception {
        for (Notice notice : notices) {
            byte[] pdf = pdfService.generate(notice);
            notice.setPdfContent(pdf);
            notice.setGeneratedAt(Instant.now());
        }
        noticeRepository.saveAll(notices.getItems());
    }
}
```

## 8.6 JobRepository

**What:** Stores metadata about job executions (status, parameters, start/end times). Uses database tables (BATCH_JOB_INSTANCE, BATCH_JOB_EXECUTION, etc.).

## 8.7 JobLauncher

**What:** Starts a Job with given parameters. Can run synchronously or asynchronously.

```java
@Autowired
private JobLauncher jobLauncher;

@Autowired
private Job invoiceJob;

public void triggerJob() throws Exception {
    JobParameters params = new JobParametersBuilder()
        .addString("date", LocalDate.now().toString())
        .addLong("timestamp", System.currentTimeMillis())
        .toJobParameters();

    JobExecution execution = jobLauncher.run(invoiceJob, params);
    log.info("Job Status: {}", execution.getStatus());
}
```

## 8.8 ExecutionContext

**What:** Key-value store for sharing data between steps or across restarts.

```java
// In Step 1: Store data
chunkContext.getStepContext().getStepExecution()
    .getJobExecution().getExecutionContext()
    .put("totalProcessed", count);

// In Step 2: Retrieve data
int totalProcessed = chunkContext.getStepContext()
    .getStepExecution().getJobExecution()
    .getExecutionContext().getInt("totalProcessed");
```

---

# Part 9: Spring Batch Project Structure

## 9.1 Recommended Production Structure

```
src/main/java/com/company/batchservice/
|
+-- config/
|   +-- BatchConfig.java              // Job and Step bean definitions
|   +-- DataSourceConfig.java         // Database configuration
|   +-- SchedulerConfig.java          // Scheduler thread pool config
|
+-- job/
|   +-- InvoiceGenerationJobConfig.java    // Job definition
|   +-- EligibilityJobConfig.java
|   +-- ReconciliationJobConfig.java
|
+-- reader/
|   +-- CustomerItemReader.java
|   +-- TransactionItemReader.java
|   +-- CsvFileItemReader.java
|
+-- processor/
|   +-- InvoiceProcessor.java
|   +-- EligibilityProcessor.java
|   +-- DataTransformProcessor.java
|
+-- writer/
|   +-- InvoiceItemWriter.java
|   +-- NoticeItemWriter.java
|   +-- CsvFileItemWriter.java
|
+-- scheduler/
|   +-- BatchJobScheduler.java         // Cron triggers for jobs
|
+-- listener/
|   +-- JobCompletionListener.java     // Job lifecycle callbacks
|   +-- StepExecutionListener.java
|
+-- entity/
|   +-- Customer.java
|   +-- Invoice.java
|   +-- Notice.java
|
+-- repository/
|   +-- CustomerRepository.java
|   +-- InvoiceRepository.java
|
+-- service/
|   +-- PricingService.java
|   +-- PdfService.java
|   +-- EmailService.java
|
+-- controller/
|   +-- BatchJobController.java        // REST endpoints to trigger jobs
|
+-- exception/
    +-- BatchProcessingException.java
```

## 9.2 Purpose of Each Package

| Package | Purpose |
|---|---|
| `config/` | Spring configuration classes, data sources, thread pools |
| `job/` | Job definitions with steps, flows, and conditional logic |
| `reader/` | Custom ItemReader implementations |
| `processor/` | Business logic for data transformation |
| `writer/` | Custom ItemWriter implementations |
| `scheduler/` | Cron-based job triggers |
| `listener/` | Job and Step lifecycle callbacks (logging, alerts) |
| `entity/` | JPA entity classes |
| `repository/` | Spring Data JPA repositories |
| `service/` | Shared business services |
| `controller/` | REST APIs for manual job triggers |

---

# Part 10: Complete Batch Job Implementation

### Step-by-Step: Building a Batch Job
This section demonstrates building a complete invoice generation job. Before writing code, understand the data flow:

```
Data Flow:
  Database (Customer table)
       │
  [ItemReader] reads one Customer at a time
       │
  [ItemProcessor] calculates invoice for that Customer
       │
  [ItemWriter] saves batch of Invoices to database
       │
  Repeat until all Customers processed
```

### Design Decisions for This Job
| Decision | Choice | Why |
|---|---|---|
| Reader type | JpaPagingItemReader | Large dataset, paging avoids OOM |
| Chunk size | 100 | Balance between speed and memory |
| Error handling | Skip up to 10, retry 3x | Resilient to transient failures |
| Listener | JobCompletionListener | Send email report after job |

## 10.1 Entity

```java
@Entity
@Table(name = "customers")
public class Customer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String email;
    private String plan; // BASIC, PREMIUM, ENTERPRISE
    private BigDecimal usageAmount;
    private boolean active;
    private LocalDate billingCycleStart;

    // Getters and setters
}

@Entity
@Table(name = "invoices")
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long customerId;
    private String customerName;
    private String customerEmail;
    private BigDecimal amount;
    private BigDecimal tax;
    private BigDecimal totalAmount;
    private LocalDate invoiceDate;
    private LocalDate dueDate;
    private String status; // GENERATED, SENT, PAID

    // Getters and setters
}
```

## 10.2 Reader

```java
@Configuration
public class CustomerReaderConfig {

    @Bean
    public JpaPagingItemReader<Customer> activeCustomerReader(
            EntityManagerFactory entityManagerFactory) {
        return new JpaPagingItemReaderBuilder<Customer>()
            .name("activeCustomerReader")
            .entityManagerFactory(entityManagerFactory)
            .queryString("SELECT c FROM Customer c WHERE c.active = true " +
                         "ORDER BY c.id")
            .pageSize(200)
            .build();
    }
}
```

## 10.3 Processor

```java
@Component
public class InvoiceGenerationProcessor
        implements ItemProcessor<Customer, Invoice> {

    private static final Map<String, BigDecimal> PLAN_RATES = Map.of(
        "BASIC", new BigDecimal("29.99"),
        "PREMIUM", new BigDecimal("79.99"),
        "ENTERPRISE", new BigDecimal("199.99")
    );
    private static final BigDecimal TAX_RATE = new BigDecimal("0.18");

    @Override
    public Invoice process(Customer customer) throws Exception {
        if (!customer.isActive()) {
            return null; // Skip inactive
        }

        BigDecimal baseAmount = PLAN_RATES.getOrDefault(
            customer.getPlan(), BigDecimal.ZERO);
        BigDecimal usage = customer.getUsageAmount() != null
            ? customer.getUsageAmount() : BigDecimal.ZERO;
        BigDecimal subtotal = baseAmount.add(usage);
        BigDecimal tax = subtotal.multiply(TAX_RATE)
            .setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(tax);

        Invoice invoice = new Invoice();
        invoice.setCustomerId(customer.getId());
        invoice.setCustomerName(customer.getName());
        invoice.setCustomerEmail(customer.getEmail());
        invoice.setAmount(subtotal);
        invoice.setTax(tax);
        invoice.setTotalAmount(total);
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(30));
        invoice.setStatus("GENERATED");
        return invoice;
    }
}
```

## 10.4 Writer

```java
@Component
public class InvoiceItemWriter implements ItemWriter<Invoice> {

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Override
    public void write(Chunk<? extends Invoice> invoices) throws Exception {
        invoiceRepository.saveAll(invoices.getItems());
        log.info("Written {} invoices to database", invoices.size());
    }
}
```

## 10.5 Job Configuration

```java
@Configuration
public class InvoiceJobConfig {

    @Bean
    public Job invoiceGenerationJob(JobRepository jobRepository,
                                     Step invoiceStep,
                                     JobCompletionListener listener) {
        return new JobBuilder("invoiceGenerationJob", jobRepository)
            .listener(listener)
            .start(invoiceStep)
            .build();
    }

    @Bean
    public Step invoiceStep(JobRepository jobRepository,
                            PlatformTransactionManager transactionManager,
                            JpaPagingItemReader<Customer> activeCustomerReader,
                            InvoiceGenerationProcessor processor,
                            InvoiceItemWriter writer) {
        return new StepBuilder("invoiceStep", jobRepository)
            .<Customer, Invoice>chunk(100, transactionManager)
            .reader(activeCustomerReader)
            .processor(processor)
            .writer(writer)
            .faultTolerant()
            .skipLimit(10)
            .skip(Exception.class)
            .retryLimit(3)
            .retry(TransientDataAccessException.class)
            .build();
    }
}
```

## 10.6 Job Completion Listener

```java
@Component
public class JobCompletionListener implements JobExecutionListener {

    @Autowired
    private EmailService emailService;

    @Override
    public void beforeJob(JobExecution jobExecution) {
        log.info("Job {} STARTED at {}",
            jobExecution.getJobInstance().getJobName(),
            jobExecution.getStartTime());
    }

    @Override
    public void afterJob(JobExecution jobExecution) {
        BatchStatus status = jobExecution.getStatus();
        String jobName = jobExecution.getJobInstance().getJobName();

        if (status == BatchStatus.COMPLETED) {
            log.info("Job {} COMPLETED successfully", jobName);
            emailService.sendJobReport(jobName, "SUCCESS",
                jobExecution.getStepExecutions());
        } else if (status == BatchStatus.FAILED) {
            log.error("Job {} FAILED", jobName);
            emailService.sendJobAlert(jobName, "FAILURE",
                jobExecution.getAllFailureExceptions());
        }
    }
}
```

---

# Part 11: Real-Time Production Scenario

## 11.1 Daily Client Notice Generation System

### Business Requirement
A financial services company needs to:
1. Every night at midnight, check all client accounts
2. Identify clients whose eligibility status changed
3. Generate PDF notices for each affected client
4. Store the PDF in the document management system
5. Send email notifications to clients

### Architecture

```
+----------------------------------------------------------------------+
|                     Notice Generation System                          |
|                                                                       |
|  [Scheduler]                                                          |
|  cron: 0 0 0 * * *   --trigger-->                                    |
|                                                                       |
|  +------------------------------- JOB ----------------------------+   |
|  |                                                                 |   |
|  |  STEP 1: Eligibility Check                                     |   |
|  |  +----------+    +-----------+    +----------+                  |   |
|  |  | Client   | -> | Eligib.   | -> | Status   |                 |   |
|  |  | Reader   |    | Processor |    | Writer   |                 |   |
|  |  |(Database)|    |(Rules Eng)|    |(Database)|                  |   |
|  |  +----------+    +-----------+    +----------+                  |   |
|  |                                                                 |   |
|  |  STEP 2: Notice Generation                                     |   |
|  |  +----------+    +-----------+    +----------+                  |   |
|  |  | Changed  | -> | PDF       | -> | Notice   |                 |   |
|  |  | Clients  |    | Generator |    | Writer   |                 |   |
|  |  | Reader   |    | Processor |    |(DB+Email)|                  |   |
|  |  +----------+    +-----------+    +----------+                  |   |
|  |                                                                 |   |
|  +-----------------------------------------------------------------+   |
+----------------------------------------------------------------------+
```

### Implementation

```java
// Step 1: Check eligibility changes
@Bean
public Step eligibilityCheckStep(JobRepository jobRepository,
        PlatformTransactionManager txManager) {
    return new StepBuilder("eligibilityCheckStep", jobRepository)
        .<Client, Client>chunk(200, txManager)
        .reader(allActiveClientsReader())
        .processor(eligibilityCheckProcessor())
        .writer(statusUpdateWriter())
        .build();
}

// Step 2: Generate notices for changed statuses
@Bean
public Step noticeGenerationStep(JobRepository jobRepository,
        PlatformTransactionManager txManager) {
    return new StepBuilder("noticeGenerationStep", jobRepository)
        .<Client, Notice>chunk(50, txManager)
        .reader(changedStatusClientsReader())
        .processor(noticeGenerationProcessor())
        .writer(noticeWriter())
        .build();
}

// Job: Wire both steps
@Bean
public Job dailyNoticeJob(JobRepository jobRepository,
                           Step eligibilityCheckStep,
                           Step noticeGenerationStep) {
    return new JobBuilder("dailyNoticeJob", jobRepository)
        .start(eligibilityCheckStep)
        .next(noticeGenerationStep)
        .build();
}

// Processor: Generate PDF notice
@Component
public class NoticeGenerationProcessor
        implements ItemProcessor<Client, Notice> {

    @Autowired
    private PdfService pdfService;

    @Override
    public Notice process(Client client) throws Exception {
        Notice notice = new Notice();
        notice.setClientId(client.getId());
        notice.setClientEmail(client.getEmail());
        notice.setType(determineNoticeType(client));
        notice.setContent(buildNoticeContent(client));
        notice.setPdfBytes(pdfService.generateNoticePdf(notice));
        notice.setGeneratedAt(Instant.now());
        notice.setStatus("GENERATED");
        return notice;
    }
}

// Writer: Save notice + Send email
@Component
public class NoticeAndEmailWriter implements ItemWriter<Notice> {

    @Autowired private NoticeRepository noticeRepository;
    @Autowired private EmailService emailService;

    @Override
    public void write(Chunk<? extends Notice> notices) throws Exception {
        List<Notice> saved = noticeRepository.saveAll(notices.getItems());
        for (Notice notice : saved) {
            try {
                emailService.sendNoticeEmail(
                    notice.getClientEmail(),
                    notice.getType(),
                    notice.getPdfBytes()
                );
                notice.setStatus("SENT");
            } catch (Exception e) {
                notice.setStatus("EMAIL_FAILED");
                log.error("Email failed for client {}", notice.getClientId(), e);
            }
        }
        noticeRepository.saveAll(saved);
    }
}
```

---

# Part 12: Handling Large Datasets

## 12.1 Chunk Processing

The fundamental strategy. Configure chunk size based on dataset and memory:

```java
// Small dataset (< 10K records): larger chunks
.<Entity, Entity>chunk(500, txManager)

// Medium dataset (10K - 1M): moderate chunks
.<Entity, Entity>chunk(100, txManager)

// Large dataset (> 1M): smaller chunks
.<Entity, Entity>chunk(50, txManager)
```

| Chunk Size | Memory Usage | Transaction Size | Restart Granularity |
|---|---|---|---|
| 10 | Very Low | Small | Fine-grained |
| 100 | Low | Medium | Balanced |
| 500 | Medium | Large | Coarse |
| 1000 | High | Very Large | Very Coarse |

## 12.2 Paging vs Cursor Reading

### Paging Reader (Recommended for Large Datasets)
```java
@Bean
public JpaPagingItemReader<Transaction> transactionReader(
        EntityManagerFactory emf) {
    return new JpaPagingItemReaderBuilder<Transaction>()
        .name("transactionReader")
        .entityManagerFactory(emf)
        .queryString("SELECT t FROM Transaction t WHERE t.status = 'PENDING'")
        .pageSize(500) // Fetches 500 records per DB query
        .build();
}
// How it works:
// Page 0: SELECT ... LIMIT 500 OFFSET 0
// Page 1: SELECT ... LIMIT 500 OFFSET 500
// Page 2: SELECT ... LIMIT 500 OFFSET 1000
// ...until no more results
```

### Cursor Reader (For Medium Datasets)
```java
@Bean
public JdbcCursorItemReader<Transaction> cursorReader(DataSource ds) {
    return new JdbcCursorItemReaderBuilder<Transaction>()
        .name("cursorReader")
        .dataSource(ds)
        .sql("SELECT * FROM transactions WHERE status = 'PENDING'")
        .rowMapper(new TransactionRowMapper())
        .fetchSize(100) // JDBC fetch size
        .build();
}
// Opens a DB cursor, streams results row by row
// Lower memory but holds DB connection longer
```

## 12.3 Multi-Threaded Step

```java
@Bean
public Step multiThreadedStep(JobRepository jobRepo,
                               PlatformTransactionManager txManager) {
    return new StepBuilder("multiThreadedStep", jobRepo)
        .<Customer, Invoice>chunk(100, txManager)
        .reader(customerReader())   // Must be thread-safe!
        .processor(invoiceProcessor())
        .writer(invoiceWriter())
        .taskExecutor(new SimpleAsyncTaskExecutor())
        .throttleLimit(8) // 8 concurrent threads
        .build();
}
```

## 12.4 Partitioning

Split data into independent partitions, each processed by a separate thread:

```java
@Bean
public Step partitionedStep(JobRepository jobRepo,
                             Step workerStep) {
    return new StepBuilder("partitionedStep", jobRepo)
        .partitioner("workerStep", rangePartitioner())
        .step(workerStep)
        .gridSize(8)  // 8 partitions
        .taskExecutor(new SimpleAsyncTaskExecutor())
        .build();
}

@Bean
public Partitioner rangePartitioner() {
    return gridSize -> {
        Map<String, ExecutionContext> partitions = new HashMap<>();
        long min = customerRepository.findMinId();
        long max = customerRepository.findMaxId();
        long range = (max - min) / gridSize + 1;

        for (int i = 0; i < gridSize; i++) {
            ExecutionContext context = new ExecutionContext();
            context.putLong("minId", min + (i * range));
            context.putLong("maxId", min + ((i + 1) * range) - 1);
            partitions.put("partition" + i, context);
        }
        return partitions;
    };
}
```

---
