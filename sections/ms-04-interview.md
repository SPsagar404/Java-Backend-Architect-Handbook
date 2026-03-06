
# Part 18: Microservices Best Practices

## 18.1 API Design Best Practices

### RESTful Naming Conventions
```
GOOD:
  GET    /api/orders              List orders
  GET    /api/orders/123          Get order 123
  POST   /api/orders              Create order
  PUT    /api/orders/123          Update order 123
  DELETE /api/orders/123          Delete order 123
  GET    /api/orders/123/items    Get items of order 123

BAD:
  GET  /api/getOrders
  POST /api/createOrder
  GET  /api/order/getById?id=123
```

### Standard Response Format
```java
public class ApiResponse<T> {
    private boolean success;
    private T data;
    private String message;
    private String errorCode;
    private Instant timestamp;
}

// Success: { "success": true, "data": { ... }, "timestamp": "..." }
// Error:   { "success": false, "message": "Order not found",
//            "errorCode": "ORDER_404", "timestamp": "..." }
```

### HTTP Status Codes
| Code | Meaning | Use |
|---|---|---|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected failure |
| 503 | Service Unavailable | Service down |

## 18.2 API Versioning

```
Strategy 1: URL Path (most common)
  GET /api/v1/orders
  GET /api/v2/orders

Strategy 2: Header
  GET /api/orders
  Header: Accept: application/vnd.myapp.v2+json

Strategy 3: Query Parameter
  GET /api/orders?version=2
```

Recommendation: Use **URL path versioning** for simplicity and cacheability.

## 18.3 Error Handling Strategy

```java
// Global exception handler
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(404).body(
            ApiResponse.error(ex.getMessage(), "RESOURCE_NOT_FOUND"));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex) {
        return ResponseEntity.status(422).body(
            ApiResponse.error(ex.getMessage(), ex.getErrorCode()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(
            MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e ->
            errors.put(e.getField(), e.getDefaultMessage()));
        return ResponseEntity.status(400).body(
            ApiResponse.error("Validation failed", "VALIDATION_ERROR", errors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(500).body(
            ApiResponse.error("Internal server error", "INTERNAL_ERROR"));
    }
}
```

## 18.4 Database Design Rules

| Rule | Description |
|---|---|
| Each service owns its DB | Never access another service's database directly |
| Use Flyway for migrations | Version control your schema changes |
| Don't use ddl-auto in prod | Use `validate` or `none` |
| Index frequently queried columns | Profile and optimize slow queries |
| Use connection pooling | HikariCP with appropriate pool sizes |
| Read replicas for read-heavy services | Separate write and read traffic |

## 18.5 General Best Practices

| Practice | Why |
|---|---|
| Design around business capabilities | Services align with domain boundaries |
| Keep services small and focused | Easier to understand, test, and deploy |
| Stateless services | Enables horizontal scaling |
| Config externalization | Change behavior without redeployment |
| Health checks | Kubernetes knows when to restart/route traffic |
| Graceful shutdown | Finish in-flight requests before stopping |
| Idempotent operations | Safe to retry on failure |
| Contract-first API design | Define API before implementation |
| Independent deployment | Deploy services without coordinating with other teams |
| Automated CI/CD | Every push is tested and deployed automatically |

---

# Part 19: Interview Questions (100+)

## Fundamentals (Q1-Q20)

**Q1. What are microservices?**
An architectural style where an application is built as a collection of small, independent, loosely coupled services, each running in its own process and communicating over lightweight protocols like HTTP or messaging.

**Q2. Monolith vs Microservices?**
Monolith: single deployable unit, shared database, one tech stack. Microservices: independently deployed services, database per service, polyglot technology. Monolith is simpler; microservices scale better and enable team autonomy.

**Q3. When should you NOT use microservices?**
Small teams (< 5), simple domains, startups/MVPs, unclear domain boundaries, no DevOps maturity. Microservices add complexity that must be justified by scale/team size.

**Q4. What is bounded context?**
A DDD concept where each service owns a specific business domain with clear boundaries. Example: "Order" in Order Service vs "Order" in Shipping Service may have different attributes.

**Q5. How do microservices communicate?**
Synchronous: REST APIs, gRPC, Feign Client. Asynchronous: Message brokers (Kafka, RabbitMQ). Choose sync when response is needed immediately; async for fire-and-forget.

**Q6. What is an API Gateway?**
Single entry point for all clients. Handles routing, authentication, rate limiting, load balancing, and request aggregation. Examples: Spring Cloud Gateway, Kong, AWS API Gateway.

**Q7. What is service discovery?**
A mechanism for services to register themselves and discover other services dynamically. Eliminates hardcoded URLs. Examples: Eureka, Consul, Kubernetes DNS.

**Q8. What is a Config Server?**
Centralizes configuration for all services. Services fetch config on startup from a Git-backed config server. Enables changing config without redeployment.

**Q9. What are the 12-Factor App principles relevant to microservices?**
Codebase (one per service), dependencies (declared explicitly), config (in environment), backing services (attached resources), build-release-run (strict separation), processes (stateless), port binding (self-contained), concurrency (scale out), disposability (fast startup/shutdown), dev-prod parity, logs (event streams), admin processes.

**Q10. What is Domain-Driven Design (DDD)?**
A design approach where software models are tightly aligned with business domains. Key concepts: bounded contexts, aggregates, entities, value objects, domain events. Essential for defining microservice boundaries.

**Q11. How to decompose a monolith into microservices?**
1. Identify bounded contexts using DDD. 2. Start with clear domain boundaries. 3. Use Strangler pattern for gradual migration. 4. Extract one service at a time. 5. Ensure independent deployability.

**Q12. What is the difference between orchestration and choreography?**
Orchestration: a central coordinator (orchestrator) directs the workflow. Choreography: each service reacts to events independently without a central controller. Orchestration is simpler to understand; choreography is more decoupled.

**Q13. What is eventual consistency?**
Data across services may be temporarily inconsistent but will converge to a consistent state over time. Opposite of strong consistency (ACID transactions).

**Q14. What is a sidecar pattern?**
Deploying a helper container alongside the main container in the same pod. The sidecar handles cross-cutting concerns like logging, mTLS, traffic management (Envoy proxy).

**Q15. What is service mesh?**
Infrastructure layer that handles service-to-service communication, including load balancing, encryption, observability. Examples: Istio, Linkerd. Uses sidecar proxies.

**Q16. What is contract testing?**
Testing that verifies the API contract between consumer and provider services. Tools: Pact. Ensures changes in one service don't break others.

**Q17. What is the strangler fig pattern?**
Gradually replacing monolith modules with microservices. Route requests to new services via API Gateway while keeping monolith for unchanged functionality.

**Q18. What is the backend for frontend (BFF) pattern?**
A dedicated API Gateway per frontend type (web, mobile, IoT). Each BFF aggregates and transforms data specifically for its frontend.

**Q19. How do you handle shared libraries across services?**
Keep them minimal. Use versioned Maven/Gradle dependencies. Avoid tight coupling through shared domain models. Prefer duplication over coupling.

**Q20. What is the difference between microservices and SOA?**
SOA: enterprise-wide services using ESB (Enterprise Service Bus), SOAP, centralized governance. Microservices: smaller services, REST/messaging, decentralized governance, DevOps-oriented.

## Communication & Data (Q21-Q40)

**Q21. REST vs gRPC for inter-service communication?**
REST: text-based (JSON), human-readable, HTTP/1.1, widely supported. gRPC: binary (protobuf), faster, HTTP/2, streaming support. Use gRPC for internal high-performance calls; REST for public APIs.

**Q22. What is OpenFeign?**
Declarative REST client by Spring Cloud. Define an interface with annotations; Spring generates the HTTP client implementation. Supports load balancing and circuit breakers.

**Q23. How does Kafka differ from RabbitMQ?**
Kafka: distributed log, high throughput, ordered within partition, persistent storage, consumer pull. RabbitMQ: traditional message queue, push-based, flexible routing, lower throughput. Use Kafka for event streaming; RabbitMQ for task queues.

**Q24. What is the Outbox Pattern?**
Write business data and event to the database in the same transaction (outbox table). A separate process reads the outbox and publishes to the message broker. Guarantees at-least-once event delivery.

**Q25. What is idempotency and why is it important?**
An operation is idempotent if executing it multiple times has the same result as once. Critical because network failures cause retries, and duplicate messages are unavoidable. Implement using unique idempotency keys.

**Q26. How to handle distributed transactions?**
Use the Saga pattern (choreography or orchestration). Avoid two-phase commit (2PC) in microservices -- it's slow and creates tight coupling.

**Q27. What is CQRS?**
Command Query Responsibility Segregation. Separate write model (normalized, optimized for writes) from read model (denormalized, optimized for queries). Sync via events.

**Q28. What is event sourcing?**
Store all state changes as a sequence of events rather than current state. Rebuild state by replaying events. Provides complete audit trail and temporal queries.

**Q29. What is a dead letter queue?**
A queue where messages that fail processing are sent after exhausting retries. Allows manual inspection and reprocessing of failed messages.

**Q30. How to ensure message ordering in Kafka?**
Messages within a single partition are ordered. Use a consistent partition key (e.g., orderId) to ensure events for the same entity go to the same partition.

**Q31. What is the database per service pattern?**
Each service has its own dedicated database. No direct cross-service DB access. Services communicate via APIs or events. Enables independent scaling and technology choice.

**Q32. How to handle JOINs across services?**
You can't. Options: 1. API composition (call multiple services and join in code). 2. CQRS (maintain denormalized read model). 3. Data duplication (cache subset of needed data).

**Q33. What is API composition?**
A pattern where a composite service calls multiple downstream services and aggregates results. Used to replace cross-service database JOINs.

**Q34. How to implement search across multiple services?**
Use Elasticsearch. Each service publishes events; a search service consumes events and indexes data in Elasticsearch.

**Q35. What is the Circuit Breaker pattern?**
Prevents cascading failures. States: CLOSED (normal), OPEN (fail fast), HALF_OPEN (test recovery). Implemented with Resilience4j or Hystrix.

**Q36. What is bulkhead pattern?**
Isolate resources (thread pools, connections) per dependency. If one dependency fails, only its resources are affected, not the entire service.

**Q37. What is a correlation ID?**
A unique ID generated at the entry point (API Gateway) and passed through all service calls. Enables tracing a single user request across the entire system.

**Q38. How to handle data migration in microservices?**
Use Flyway or Liquibase per service. Version migrations in Git. Run migrations during deployment. Use backward-compatible changes (add columns, never remove).

**Q39. What is the publish-subscribe pattern?**
A messaging pattern where a publisher sends messages to a topic without knowing subscribers. Multiple subscribers can consume the same message. Kafka topics implement this.

**Q40. What is back-pressure in reactive systems?**
A mechanism where consumers tell producers to slow down when overwhelmed. Prevents out-of-memory errors. Implemented in reactive streams (Project Reactor, RxJava).

## Architecture & Design (Q41-Q65)

**Q41. How to design a fault-tolerant microservices system?**
Circuit breakers, retries with exponential backoff, bulkheads, timeouts, fallback mechanisms, health checks, graceful degradation, redundant instances, chaos engineering.

**Q42. How to implement rate limiting?**
At API Gateway level using token bucket or sliding window algorithm. Store counters in Redis for distributed rate limiting. Spring Cloud Gateway has built-in support.

**Q43. How to handle API versioning?**
URL path (`/api/v1/...`), custom header (`Accept-Version: v2`), or content negotiation (`Accept: application/vnd.app.v2+json`). URL path is simplest and most common.

**Q44. How to implement health checks?**
Spring Boot Actuator provides `/actuator/health`. Configure liveness probe (is the app alive?) and readiness probe (can it handle traffic?) for Kubernetes.

**Q45. What is graceful shutdown?**
When a service receives SIGTERM, it stops accepting new requests, finishes in-flight requests, and shuts down cleanly. Configure with `server.shutdown=graceful` in Spring Boot.

**Q46. How to handle configuration across environments?**
Spring Cloud Config Server backed by Git. Profile-specific files (`application-dev.yml`, `application-prod.yml`). Secrets via Vault or Kubernetes Secrets.

**Q47. How to implement distributed caching?**
Redis cluster as shared cache. Use `@Cacheable` for read caching, `@CacheEvict` for invalidation. Consider cache-aside pattern for consistency.

**Q48. What is a service registry?**
A database of available service instances and their locations. Services register on startup and deregister on shutdown. Clients query the registry to discover services.

**Q49. How to handle cross-cutting concerns?**
Use API Gateway for external concerns (auth, rate limiting). Use Spring AOP or sidecar proxies for internal concerns (logging, metrics, tracing).

**Q50. What is the Ambassador pattern?**
A proxy that runs alongside a service and handles outgoing connections. Similar to sidecar but specifically for outbound traffic routing, retries, and circuit breaking.

**Q51. How to design microservices for high availability?**
Multiple instances per service, load balancing, health checks, auto-scaling, multi-AZ deployment, circuit breakers, graceful degradation.

**Q52. What is a canary deployment?**
Deploy new version to a small percentage of instances (5%). Monitor for errors. If healthy, gradually increase to 100%. Rollback if issues detected.

**Q53. What is blue-green deployment?**
Maintain two identical environments (blue = current, green = new). Switch traffic from blue to green after testing. Instant rollback by switching back.

**Q54. How to handle secrets in microservices?**
HashiCorp Vault, Kubernetes Secrets, AWS Secrets Manager. Never hardcode secrets. Rotate regularly. Inject via environment variables.

**Q55. What is the decompose by business capability pattern?**
Define services based on business functions (orders, payments, shipping) rather than technical layers (database service, email service).

**Q56. What is the decompose by subdomain pattern?**
Use DDD subdomains: core domain (critical business logic), supporting domain (necessary but not differentiating), generic domain (commodity functions like email, auth).

**Q57. How to test microservices?**
Unit tests (per class), integration tests (per service with real DB), contract tests (API contracts between services), end-to-end tests (full system), chaos tests (failure scenarios).

**Q58. What is the testing pyramid for microservices?**
Many unit tests at the base, fewer integration tests in the middle, minimal end-to-end tests at the top. Emphasize contract testing between services.

**Q59. How to implement a distributed lock?**
Redis `SETNX` with expiry (Redisson). Use when only one service instance should execute a task (e.g., scheduled job in a cluster).

**Q60. What is the External Configuration Store pattern?**
Store configuration in a centralized, external system (Config Server, Consul KV, AWS Parameter Store) rather than in application files.

**Q61. How to handle database schema changes without downtime?**
Use expand-contract pattern: 1. Add new column (backward compatible). 2. Deploy code that writes to both old and new. 3. Migrate data. 4. Remove old column.

**Q62. What is the Retry pattern best practices?**
Retry only transient failures (timeouts, 503). Use exponential backoff (1s, 2s, 4s). Add jitter to prevent thundering herd. Set max retry limit.

**Q63. How to implement request aggregation?**
API Gateway or BFF service calls multiple downstream services, combines results, and returns a single response to the client. Reduces client-side complexity.

**Q64. What is the Anti-Corruption Layer (ACL)?**
A translation layer between a new microservice and a legacy system. Prevents legacy concepts from leaking into the new service's domain model.

**Q65. How to handle service versioning in production?**
Support at least N-1 versions. Deprecate with advance notice. Use API version headers. Monitor which versions clients are using. Remove old versions after migration period.

## Production & Operations (Q66-Q85)

**Q66. How to monitor microservices in production?**
Metrics (Prometheus + Grafana), logs (ELK Stack), traces (Zipkin/Jaeger), alerts (PagerDuty/OpsGenie), dashboards per service and business metrics.

**Q67. What SLIs, SLOs, and SLAs are?**
SLI (Service Level Indicator): measurable metric (latency, availability). SLO (Objective): target for SLI (99.9% uptime). SLA (Agreement): contractual commitment based on SLOs.

**Q68. How to handle cascading failures?**
Circuit breaker on every inter-service call. Timeout on all external calls. Bulkhead isolation. Fallback responses. Graceful degradation.

**Q69. What is chaos engineering?**
Deliberately introducing failures to test system resilience. Tools: Netflix Chaos Monkey, Litmus Chaos. Practices: kill random instances, inject network latency, simulate region failure.

**Q70. How to scale microservices?**
Horizontal scaling (more instances). Kubernetes HPA based on CPU/memory/custom metrics. Scale services independently based on load patterns.

**Q71. How to handle log aggregation?**
All services emit structured JSON logs. Collect via Fluentd/Filebeat. Store in Elasticsearch. Query via Kibana. Include correlationId, service name, trace ID in every log.

**Q72. What is distributed tracing?**
Tracking a request as it flows through multiple services. Each service generates a span; all spans in a request share a trace ID. Tools: Zipkin, Jaeger, OpenTelemetry.

**Q73. How to implement auto-scaling?**
Kubernetes HPA watches metrics (CPU, memory, custom). When threshold exceeded, adds pods. When load decreases, removes pods. Configure min/max replicas.

**Q74. How to implement zero-downtime deployment?**
Rolling update (replace instances gradually). Readiness probes (only route traffic to ready instances). Graceful shutdown (finish in-flight requests). Database backward compatibility.

**Q75. How to handle network partitions?**
Accept that partitions happen (CAP theorem). Design for eventual consistency. Use retry with backoff. Implement compensating transactions. Monitor network health.

**Q76. What metrics should every microservice expose?**
Request rate, error rate, latency (p50, p95, p99), JVM metrics (heap, GC), connection pool stats, custom business metrics.

**Q77. How to implement feature flags in microservices?**
Use tools like LaunchDarkly, Unleash, or Spring Cloud Config. Store flags externally. Evaluate at runtime. Enable gradual rollouts without deployment.

**Q78. How to handle data backup in microservices?**
Each service responsible for its own database backup. Automated backups with point-in-time recovery. Cross-region replication for disaster recovery.

**Q79. How to implement a kill switch?**
Feature flag that disables a feature instantly without deployment. Useful for disabling a misbehaving feature in production.

**Q80. What is the importance of health check endpoints?**
Kubernetes uses liveness probes to restart unhealthy pods and readiness probes to stop routing traffic to unready pods. Without them, dead pods receive traffic.

**Q81. How to handle service discovery failure?**
Cache last known service locations. Use DNS-based discovery as fallback. Multiple Eureka servers for HA. Kubernetes DNS is highly available by default.

**Q82. How to implement log-based alerting?**
ELK + ElastAlert: define rules like "alert if ERROR count > 10 in 5 minutes for service X." Send alerts to Slack, PagerDuty, email.

**Q83. How to handle memory leaks in containerized microservices?**
Set JVM heap limits matching container limits. Monitor with Prometheus JVM exporter. Use `-XX:+ExitOnOutOfMemoryError` flag. Kubernetes restarts OOM-killed pods.

**Q84. How to implement request tracing across async (Kafka) boundaries?**
Pass trace ID in Kafka message headers. Consumer extracts trace ID and sets it as parent span. This links producer and consumer traces in Zipkin.

**Q85. What is the difference between liveness and readiness probes?**
Liveness: "Is the process alive?" Restart if not. Readiness: "Can it handle traffic?" Stop routing traffic if not. A service can be alive but not ready (still starting up).

## Architect-Level Questions (Q86-Q105)

**Q86. Design a microservices architecture for an e-commerce platform.**
Services: User, Product, Order, Payment, Inventory, Notification, Search, Review. API Gateway for routing and auth. Kafka for events. Redis for caching. Saga for order processing.

**Q87. How would you migrate a monolith to microservices?**
1. Identify bounded contexts (DDD). 2. Extract one service at a time (Strangler pattern). 3. Use API Gateway to route between monolith and services. 4. Share data via events, not DB. 5. CI/CD per service.

**Q88. Design an event-driven order processing system.**
Order Service creates order, publishes OrderCreated. Inventory Service reserves stock, publishes StockReserved. Payment Service charges, publishes PaymentProcessed. On failure, compensating events undo operations (Saga).

**Q89. How to handle data consistency across microservices?**
Accept eventual consistency. Use Saga pattern for distributed transactions. Outbox pattern for reliable event publishing. Idempotent consumers for safe retries.

**Q90. Design a caching strategy for a product catalog service.**
Cache products in Redis (cache-aside). TTL of 1 hour. Invalidate on product update events. Use read-through for popular items. Multi-level cache (local + distributed).

**Q91. How to implement multi-tenant microservices?**
Tenant ID in JWT claims. Filter data in every query by tenant ID. Separate databases per tenant (highest isolation) or shared database with tenant column.

**Q92. Design a notification system as a microservice.**
Kafka consumer for events. Template engine for messages. Provider abstraction (email, SMS, push). Retry queue for failed deliveries. User preferences for notification channels.

**Q93. How to handle service discovery in Kubernetes vs Eureka?**
Kubernetes: built-in DNS-based discovery, no extra infrastructure. Eureka: works outside Kubernetes, more features (metadata, health checks). In K8s, use native discovery.

**Q94. Design a CI/CD pipeline for microservices.**
Each service has its own pipeline. Stages: build, unit test, integration test, Docker build, push to registry, deploy to staging, run smoke tests, deploy to production (canary).

**Q95. How to implement a distributed scheduler in microservices?**
Use ShedLock with Redis/DB to ensure only one instance runs a scheduled task. Or use Kubernetes CronJob for stateless batch tasks.

**Q96. Design security for a microservices system.**
API Gateway validates JWT. Auth Service issues tokens. Services extract user info from headers (set by Gateway). RBAC per endpoint. mTLS for service-to-service. Secrets in Vault.

**Q97. How to handle API rate limiting across instances?**
Use distributed counter in Redis. Token bucket or sliding window algorithm. Rate limit key: client IP, API key, or user ID. Return 429 with Retry-After header.

**Q98. Design a monitoring and alerting architecture.**
Metrics: Micrometer -> Prometheus -> Grafana. Logs: Logback -> Fluentd -> Elasticsearch -> Kibana. Traces: Micrometer Tracing -> Zipkin. Alerts: Grafana/Prometheus Alertmanager -> PagerDuty.

**Q99. How to implement a saga with compensating transactions?**
Orchestrator calls services sequentially. On failure at any step, call compensating actions for all completed steps in reverse order. Log all saga steps for debugging.

**Q100. Design a real-time analytics pipeline with microservices.**
Business services publish events to Kafka. Stream processing (Kafka Streams/Flink) aggregates in real-time. Store in time-series DB (InfluxDB) or Elasticsearch. Visualize in Grafana.

**Q101. How to handle database migration in a blue-green deployment?**
Use expand-contract: add new columns before deploying new code. Both old and new code work with the schema. After full migration, remove old columns.

**Q102. Design a content delivery system using microservices.**
Upload Service -> Object Storage (S3). CDN (CloudFront) for delivery. Metadata Service for file metadata. Thumbnail Service for image processing. Event-driven processing pipeline.

**Q103. How to implement request deduplication?**
Client sends idempotency key in header. Service stores key -> response mapping in Redis. If duplicate key, return cached response. TTL on keys prevents indefinite storage.

**Q104. Design a real-time chat system using microservices.**
Connection Service (WebSocket management). Message Service (store and deliver). Presence Service (online status). Notification Service (push for offline users). Kafka for message routing.

**Q105. How would you evaluate whether to break a monolith into microservices?**
Evaluate: team size (> 8 people?), deployment frequency (weekly?), scaling needs (different components?), technology constraints, domain complexity. Calculate cost of distributed system complexity vs benefits of independence.

---

# Part 20: Hands-on Exercises

## Exercise 1: Build an API Gateway

Build a Spring Cloud Gateway that:
- Routes `/api/users/**` to user-service
- Routes `/api/orders/**` to order-service
- Validates JWT on every request
- Returns 401 for invalid/missing tokens

```java
@SpringBootApplication
public class GatewayApp {
    public static void main(String[] args) {
        SpringApplication.run(GatewayApp.class, args);
    }
}
```

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-route
          uri: http://localhost:8081
          predicates:
            - Path=/api/users/**
        - id: order-route
          uri: http://localhost:8082
          predicates:
            - Path=/api/orders/**
```

## Exercise 2: Implement Service Discovery

1. Create a Eureka Server on port 8761
2. Register two services (user-service, order-service)
3. Use service names for inter-service calls

```yaml
# user-service/application.yml
spring:
  application:
    name: user-service
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
```

## Exercise 3: Implement Kafka Messaging

Producer (Order Service):
```java
@Service
public class OrderEventProducer {
    @Autowired private KafkaTemplate<String, OrderEvent> kafka;

    public void publishOrderCreated(Order order) {
        kafka.send("order-events", order.getId().toString(),
            new OrderEvent("ORDER_CREATED", order.getId(),
                order.getCustomerId(), order.getTotalAmount()));
    }
}
```

Consumer (Notification Service):
```java
@KafkaListener(topics = "order-events", groupId = "notification-group")
public void handleOrderEvent(OrderEvent event) {
    if ("ORDER_CREATED".equals(event.getType())) {
        emailService.sendOrderConfirmation(event.getCustomerId());
    }
}
```

## Exercise 4: Implement Redis Caching

```java
@Configuration
@EnableCaching
public class RedisConfig {
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        return RedisCacheManager.builder(factory)
            .cacheDefaults(RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(30)))
            .build();
    }
}

@Service
public class ProductService {
    @Cacheable(value = "products", key = "#id")
    public Product getProduct(Long id) {
        return productRepository.findById(id).orElseThrow();
    }

    @CacheEvict(value = "products", key = "#id")
    public Product updateProduct(Long id, ProductRequest req) {
        Product p = productRepository.findById(id).orElseThrow();
        p.setName(req.getName());
        return productRepository.save(p);
    }
}
```

## Exercise 5: Implement Circuit Breaker

```java
@CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
@Retry(name = "paymentService")
public PaymentResponse processPayment(PaymentRequest request) {
    return paymentClient.process(request);
}

private PaymentResponse paymentFallback(PaymentRequest req, Throwable t) {
    log.warn("Payment service down: {}", t.getMessage());
    return new PaymentResponse("QUEUED", "Will process later");
}
```

## Exercise 6: Implement Feign Client with Fallback

```java
@FeignClient(name = "inventory-service",
             fallbackFactory = InventoryFallbackFactory.class)
public interface InventoryClient {
    @GetMapping("/api/inventory/{productId}")
    InventoryResponse getStock(@PathVariable Long productId);

    @PostMapping("/api/inventory/reserve")
    InventoryResponse reserveStock(@RequestBody ReserveRequest request);
}

@Component
public class InventoryFallbackFactory
        implements FallbackFactory<InventoryClient> {
    @Override
    public InventoryClient create(Throwable cause) {
        return new InventoryClient() {
            @Override
            public InventoryResponse getStock(Long productId) {
                return new InventoryResponse(productId, -1, "UNKNOWN");
            }
            @Override
            public InventoryResponse reserveStock(ReserveRequest req) {
                throw new ServiceUnavailableException("Inventory service down");
            }
        };
    }
}
```

## Exercise 7: Implement Saga Orchestrator

```java
@Service
public class OrderSaga {
    public OrderResult execute(OrderRequest request) {
        Order order = createOrder(request);              // Step 1
        try {
            reserveInventory(order);                     // Step 2
            processPayment(order);                       // Step 3
            confirmOrder(order);                         // Step 4
            return OrderResult.success(order);
        } catch (InventoryException e) {
            cancelOrder(order, "Insufficient stock");    // Compensate 1
            return OrderResult.failed(order);
        } catch (PaymentException e) {
            releaseInventory(order);                     // Compensate 2
            cancelOrder(order, "Payment failed");        // Compensate 1
            return OrderResult.failed(order);
        }
    }
}
```

## Exercise 8: Implement Health Checks

```java
@Component
public class DatabaseHealthIndicator implements HealthIndicator {
    @Autowired private DataSource dataSource;

    @Override
    public Health health() {
        try (Connection conn = dataSource.getConnection()) {
            return Health.up()
                .withDetail("database", "Reachable")
                .build();
        } catch (Exception e) {
            return Health.down()
                .withException(e)
                .build();
        }
    }
}
```

## Exercise 9: Implement Distributed Tracing

```yaml
# application.yml
management:
  tracing:
    sampling:
      probability: 1.0
  zipkin:
    tracing:
      endpoint: http://localhost:9411/api/v2/spans
```

## Exercise 10: Docker Compose for Full System

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    ports: ["9092:9092"]

  zipkin:
    image: openzipkin/zipkin
    ports: ["9411:9411"]

  api-gateway:
    build: ./api-gateway
    ports: ["8080:8080"]

  user-service:
    build: ./user-service
    depends_on: [postgres, redis]

  order-service:
    build: ./order-service
    depends_on: [postgres, kafka, redis]
```

---

*End of Guide*

**Document Version:** 1.0
**Last Updated:** March 2026
**Topics Covered:** 20 Parts, 105 Interview Questions, 10 Hands-on Exercises
