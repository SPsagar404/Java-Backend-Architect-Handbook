
# Part 14: Microservices Observability

## 14.1 Three Pillars of Observability

```
+------------------------------------------------------------------+
|                     OBSERVABILITY                                 |
|                                                                    |
|  +------------------+  +-----------------+  +-----------------+   |
|  |     LOGGING      |  |    METRICS      |  |   TRACING       |   |
|  |                  |  |                 |  |                 |   |
|  | What happened?   |  | How is the      |  | Where did the   |   |
|  | Error details    |  | system doing?   |  | request go?     |   |
|  |                  |  |                 |  |                 |   |
|  | Tools:           |  | Tools:          |  | Tools:          |   |
|  | ELK Stack        |  | Prometheus      |  | Zipkin          |   |
|  | (Elasticsearch,  |  | Grafana         |  | Jaeger          |   |
|  |  Logstash,       |  | Micrometer      |  | OpenTelemetry   |   |
|  |  Kibana)         |  |                 |  |                 |   |
|  +------------------+  +-----------------+  +-----------------+   |
+------------------------------------------------------------------+
```

## 14.2 Centralized Logging (ELK Stack)

```
+---------+     +---------+     +---------+
| User    |     | Order   |     | Payment |
| Service |     | Service |     | Service |
| (logs)  |     | (logs)  |     | (logs)  |
+---------+     +---------+     +---------+
     |               |               |
     v               v               v
+--------------------------------------------------+
|               Logstash / Fluentd                  |
|         (Collects and transforms logs)            |
+--------------------------------------------------+
                      |
                      v
+--------------------------------------------------+
|              Elasticsearch                        |
|          (Indexes and stores logs)                |
+--------------------------------------------------+
                      |
                      v
+--------------------------------------------------+
|                 Kibana                            |
|        (Search, visualize, dashboard)             |
+--------------------------------------------------+
```

### Structured Logging Configuration
```yaml
# logback-spring.xml
<configuration>
  <appender name="JSON" class="net.logstash.logback.appender.LogstashTcpSocketAppender">
    <destination>logstash:5000</destination>
    <encoder class="net.logstash.logback.encoder.LogstashEncoder">
      <customFields>{"service":"${spring.application.name}"}</customFields>
    </encoder>
  </appender>

  <root level="INFO">
    <appender-ref ref="JSON" />
  </root>
</configuration>
```

### Correlation ID for Request Tracing
```java
@Component
public class CorrelationIdFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                          FilterChain chain) throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String correlationId = httpRequest.getHeader("X-Correlation-Id");
        if (correlationId == null) {
            correlationId = UUID.randomUUID().toString();
        }
        MDC.put("correlationId", correlationId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove("correlationId");
        }
    }
}
```

## 14.3 Metrics (Prometheus + Grafana)

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health, metrics, prometheus
  metrics:
    export:
      prometheus:
        enabled: true
    tags:
      application: ${spring.application.name}
```

```java
// Custom business metrics
@Service
public class OrderService {

    private final Counter orderCounter;
    private final Timer orderProcessingTimer;

    public OrderService(MeterRegistry registry) {
        this.orderCounter = Counter.builder("orders.created")
            .tag("service", "order-service")
            .description("Total orders created")
            .register(registry);

        this.orderProcessingTimer = Timer.builder("orders.processing.time")
            .tag("service", "order-service")
            .description("Order processing duration")
            .register(registry);
    }

    public Order createOrder(OrderRequest request) {
        return orderProcessingTimer.record(() -> {
            Order order = processOrder(request);
            orderCounter.increment();
            return order;
        });
    }
}
```

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|---|---|---|
| `http_server_requests_seconds` | Request latency | p99 > 2s |
| `jvm_memory_used_bytes` | JVM heap usage | > 80% of max |
| `hikaricp_connections_active` | Active DB connections | > 80% of pool |
| `system_cpu_usage` | CPU utilization | > 70% sustained |
| `orders.created` | Business metric: orders | Sudden drop |
| `http_server_requests_seconds_count` | Request rate | Sudden spike or drop |

## 14.4 Distributed Tracing (Zipkin)

```yaml
# application.yml (Spring Boot 3+)
management:
  tracing:
    sampling:
      probability: 1.0  # Sample 100% of traces (0.1 = 10% in production)
  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans
```

```
Trace Example: Place Order
Trace ID: abc123

  [API Gateway]        12ms
    [Order Service]      85ms
      [Inventory Svc]      15ms  (Feign call)
      [Payment Svc]        45ms  (Feign call)
      [Kafka Publish]       3ms
    [Notification Svc]     8ms   (Kafka consumer)

Zipkin UI shows this waterfall view, making it easy to identify:
- Which service is slow
- Where errors occur
- Total end-to-end latency
```

---

# Part 15: Production Challenges in Microservices

## 15.1 Network Latency

**Problem:** Every service call adds network overhead (1-10ms per hop). A request touching 5 services accumulates 5-50ms of pure network time.

**Solutions:**
- Minimize synchronous call chains (prefer async events)
- Use gRPC instead of REST for internal calls (binary protocol, faster)
- Co-locate frequently communicating services
- Cache data locally to avoid repeated calls

## 15.2 Service Failures

**Problem:** In a system with 20 services, the probability of at least one being down is high.

**Solutions:**
| Strategy | How |
|---|---|
| Circuit Breaker | Stop calling failing services, use fallback |
| Retry with backoff | Retry transient failures with exponential delay |
| Bulkhead | Isolate resources per dependency |
| Graceful degradation | Serve partial data if a service is down |
| Health checks | Kubernetes readiness/liveness probes |

## 15.3 Distributed Debugging

**Problem:** A user complaint like "my order failed" could involve 7 services. Finding the root cause requires tracing across all of them.

**Solutions:**
- **Correlation ID:** Single request ID passed through all services
- **Distributed tracing:** Zipkin/Jaeger shows the full call chain
- **Centralized logging:** All logs in ELK, searchable by correlation ID
- **Structured logs:** JSON format with service name, trace ID, span ID

## 15.4 Data Consistency

**Problem:** Order is created but payment fails. Without shared transactions, data is inconsistent across services.

**Solutions:**
| Pattern | Description |
|---|---|
| Saga | Compensating transactions undo failed steps |
| Outbox pattern | Write event to DB then publish (at-least-once delivery) |
| Idempotent consumers | Handle duplicate events gracefully |
| Eventual consistency | Accept temporary inconsistency, reconcile later |

## 15.5 Scaling Challenges

**Problem:** Different services have different scaling needs. Order Service needs 10 instances during a sale; User Service needs only 2.

**Solutions:**
- Kubernetes HPA (Horizontal Pod Autoscaler) per service
- Scale based on custom metrics (queue depth, request rate)
- Database connection pool limits per service instance
- Stateless services for easy horizontal scaling

---

# Part 16: Complete Sample Microservices Project

## 16.1 Order Processing System

### Service Responsibilities

| Service | Responsibility | Database | Communication |
|---|---|---|---|
| **Auth Service** | User registration, login, JWT generation | PostgreSQL | REST |
| **User Service** | User profiles, addresses, preferences | PostgreSQL | REST + Kafka |
| **Product Service** | Product catalog, pricing, search | PostgreSQL + Redis | REST |
| **Order Service** | Order creation, tracking, history | PostgreSQL | REST + Kafka |
| **Inventory Service** | Stock management, reservation | PostgreSQL | REST + Kafka |
| **Payment Service** | Payment processing, refunds | PostgreSQL | REST + Kafka |
| **Notification Service** | Email, SMS, push notifications | MongoDB | Kafka consumer |

### System Flow: Place an Order

```
1. Client: POST /api/orders { items, address, paymentMethod }
             |
2. API Gateway: Validate JWT, route to Order Service
             |
3. Order Service:
   a. Create order (PENDING) in OrderDB
   b. Call Product Service --> get item prices
   c. Call Inventory Service --> check/reserve stock
   d. Call Payment Service --> process payment
   e. If all succeed: status = CONFIRMED
   f. Publish OrderConfirmedEvent to Kafka
             |
4. Kafka Consumers:
   - Notification Service: send confirmation email
   - Analytics Service: update dashboards
   - Inventory Service: confirm stock reservation
```

### API Endpoints

```
Auth Service (port 8081):
  POST  /api/auth/register       Register new user
  POST  /api/auth/login          Login, get JWT
  POST  /api/auth/refresh        Refresh JWT token

User Service (port 8082):
  GET   /api/users/{id}          Get user profile
  PUT   /api/users/{id}          Update user profile
  GET   /api/users/{id}/addresses Get user addresses

Product Service (port 8083):
  GET   /api/products            List products (paginated)
  GET   /api/products/{id}       Get product details
  GET   /api/products/search     Search products
  POST  /api/products            Create product (ADMIN)

Order Service (port 8084):
  POST  /api/orders              Place new order
  GET   /api/orders/{id}         Get order details
  GET   /api/orders/my-orders    Get current user's orders
  PUT   /api/orders/{id}/cancel  Cancel order

Inventory Service (port 8085):
  GET   /api/inventory/{productId}     Check stock
  POST  /api/inventory/reserve         Reserve stock
  POST  /api/inventory/release         Release reserved stock

Payment Service (port 8086):
  POST  /api/payments            Process payment
  GET   /api/payments/{orderId}  Get payment status
  POST  /api/payments/{id}/refund Refund payment

Notification Service (port 8087):
  (No REST APIs -- purely Kafka consumer)
```

---

# Part 17: Full Project Structures

## 17.1 Standard Microservice Project Structure

```
order-service/
|
+-- src/main/java/com/app/orderservice/
|   |
|   +-- OrderServiceApplication.java
|   |
|   +-- controller/
|   |   +-- OrderController.java         // REST endpoints
|   |
|   +-- service/
|   |   +-- OrderService.java            // Business logic
|   |   +-- OrderSagaOrchestrator.java   // Saga coordination
|   |
|   +-- repository/
|   |   +-- OrderRepository.java         // JPA repository
|   |
|   +-- entity/
|   |   +-- Order.java                   // JPA entity
|   |   +-- OrderItem.java
|   |   +-- OrderStatus.java             // Enum
|   |
|   +-- dto/
|   |   +-- OrderRequest.java            // Request DTO
|   |   +-- OrderResponse.java           // Response DTO
|   |   +-- OrderItemDTO.java
|   |
|   +-- client/
|   |   +-- PaymentServiceClient.java    // Feign client
|   |   +-- InventoryServiceClient.java  // Feign client
|   |   +-- ProductServiceClient.java    // Feign client
|   |
|   +-- event/
|   |   +-- OrderCreatedEvent.java       // Kafka event
|   |   +-- OrderEventPublisher.java     // Kafka producer
|   |   +-- PaymentEventConsumer.java    // Kafka consumer
|   |
|   +-- config/
|   |   +-- KafkaConfig.java
|   |   +-- FeignConfig.java
|   |   +-- SecurityConfig.java
|   |
|   +-- exception/
|   |   +-- OrderNotFoundException.java
|   |   +-- InsufficientStockException.java
|   |   +-- GlobalExceptionHandler.java  // @ControllerAdvice
|   |
|   +-- mapper/
|       +-- OrderMapper.java             // Entity <-> DTO mapping
|
+-- src/main/resources/
|   +-- application.yml
|   +-- application-dev.yml
|   +-- application-prod.yml
|
+-- src/test/java/com/app/orderservice/
|   +-- controller/
|   |   +-- OrderControllerTest.java
|   +-- service/
|   |   +-- OrderServiceTest.java
|   +-- repository/
|       +-- OrderRepositoryTest.java
|
+-- Dockerfile
+-- pom.xml
```

## 17.2 Why Each Layer Exists

| Layer | Purpose | Example |
|---|---|---|
| **Controller** | Handle HTTP requests, validate input, return responses | `@RestController`, `@PostMapping` |
| **Service** | Business logic, orchestration, transaction management | `@Service`, `@Transactional` |
| **Repository** | Data access abstraction | `JpaRepository<Order, Long>` |
| **Entity** | Database table mapping | `@Entity`, `@Table` |
| **DTO** | Data transfer between layers; decouple API from entities | Request/Response classes |
| **Client** | Communication with other microservices | `@FeignClient` interfaces |
| **Event** | Asynchronous event publishing and consumption | Kafka producer/consumer |
| **Config** | Spring configuration beans | `@Configuration` classes |
| **Exception** | Custom exceptions and global error handling | `@ControllerAdvice` |
| **Mapper** | Convert between entities and DTOs | Manual mapping or MapStruct |

## 17.3 Infrastructure Services Structure

```
infrastructure/
|
+-- eureka-server/
|   +-- src/main/java/.../EurekaServerApplication.java
|   +-- src/main/resources/application.yml
|   +-- Dockerfile
|
+-- config-server/
|   +-- src/main/java/.../ConfigServerApplication.java
|   +-- src/main/resources/application.yml
|   +-- Dockerfile
|
+-- api-gateway/
|   +-- src/main/java/.../
|   |   +-- ApiGatewayApplication.java
|   |   +-- filter/JwtAuthenticationFilter.java
|   |   +-- filter/RateLimitFilter.java
|   |   +-- config/GatewayConfig.java
|   +-- src/main/resources/application.yml
|   +-- Dockerfile
|
+-- docker-compose.yml
+-- docker-compose-infra.yml  (just infra: DB, Kafka, Redis)
```

---

# Part 18: Build It Yourself — Order Processing Microservices

> **Goal:** Build a minimal microservices system with 3 services (Order, Payment, Notification) + API Gateway + Service Discovery — step by step.

## Concept Overview

```
Client → API Gateway → Order Service → Payment Service (REST)
                                     → Kafka → Notification Service (consumer)
                   ↑
              Eureka (Service Discovery)
```

| Service | Role | Port |
|---|---|---|
| Eureka Server | Service registry | 8761 |
| API Gateway | Routes, JWT validation | 8080 |
| Order Service | Order CRUD, orchestrates payment | 8081 |
| Payment Service | Payment processing | 8082 |
| Notification Service | Sends emails (Kafka consumer) | 8083 |

---

## Step 1: Create Eureka Server (Service Discovery)

**Concept:** Eureka Server is a registry where services register themselves. Other services can discover and call them by name instead of hardcoded URLs.

```java
@SpringBootApplication
@EnableEurekaServer                          // Activates Eureka Server
public class EurekaServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}
```
```yaml
# application.yml
server:
  port: 8761
eureka:
  client:
    register-with-eureka: false             # Don't register itself
    fetch-registry: false
```

---

## Step 2: Create API Gateway

**Concept:** API Gateway is the single entry point. It routes requests to services by name (resolved via Eureka).

```yaml
server:
  port: 8080
spring:
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://ORDER-SERVICE             # lb:// = load-balanced via Eureka
          predicates:
            - Path=/api/orders/**
        - id: payment-service
          uri: lb://PAYMENT-SERVICE
          predicates:
            - Path=/api/payments/**
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka
```

---

## Step 3: Create Order Service

**Concept:** Order Service handles order CRUD and calls Payment Service via Feign Client (service-to-service REST call).

```java
// Feign Client — calls Payment Service by name (resolved via Eureka)
@FeignClient(name = "PAYMENT-SERVICE")
public interface PaymentClient {
    @PostMapping("/api/payments")
    PaymentResponse processPayment(@RequestBody PaymentRequest request);
}

// Service
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentClient paymentClient;       // Feign auto-proxy
    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;

    @Transactional
    public OrderDTO createOrder(OrderRequest request) {
        Order order = orderRepository.save(new Order(request, OrderStatus.PENDING));

        // Call Payment Service via Feign
        PaymentResponse payment = paymentClient.processPayment(
            new PaymentRequest(order.getId(), order.getTotalAmount()));

        order.setStatus(payment.isSuccess() ? OrderStatus.CONFIRMED : OrderStatus.FAILED);

        // Publish event to Kafka for Notification Service
        kafkaTemplate.send("order-events",
            new OrderEvent(order.getId(), order.getStatus(), request.getEmail()));

        return OrderDTO.from(order);
    }
}
```

---

## Step 4: Create Notification Service (Kafka Consumer)

**Concept:** This service has NO REST APIs. It only listens to Kafka events and sends notifications.

```java
@Service
public class NotificationConsumer {

    @KafkaListener(topics = "order-events", groupId = "notification-group")
    public void handleOrderEvent(OrderEvent event) {
        if (event.getStatus() == OrderStatus.CONFIRMED) {
            emailService.sendOrderConfirmation(event.getEmail(), event.getOrderId());
        }
        log.info("Notification sent for order: {}", event.getOrderId());
    }
}
```

---

## Step 5: Run Everything

```bash
# Start in order:
1. Eureka Server    → mvn spring-boot:run (port 8761)
2. Kafka            → docker-compose up kafka zookeeper
3. Order Service    → mvn spring-boot:run (port 8081)
4. Payment Service  → mvn spring-boot:run (port 8082)
5. Notification Svc → mvn spring-boot:run (port 8083)
6. API Gateway      → mvn spring-boot:run (port 8080)

# Test via Gateway:
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"items": [{"productId": 1, "qty": 2}], "email": "user@test.com"}'
```

---

## Key Takeaways

| Pattern | What It Solves |
|---|---|
| Eureka | Services discover each other by name, no hardcoded URLs |
| API Gateway | Single entry point, routing, cross-cutting concerns |
| Feign Client | Type-safe REST client for service-to-service calls |
| Kafka | Async event-driven communication (decoupled services) |
| Each service has its own DB | Data isolation, independent deployment |

---
