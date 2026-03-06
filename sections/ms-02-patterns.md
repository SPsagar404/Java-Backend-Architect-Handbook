
# Part 8: Event-Driven Architecture

## 8.1 What is Event-Driven Architecture?

A pattern where services communicate by producing and consuming **events** rather than making direct calls. An event represents something that happened: "Order was created", "Payment was processed", "Inventory was updated".

```
+----------+                            +----------+
| Order    |  --OrderCreatedEvent-->    | Inventory|
| Service  |                            | Service  |
| (Producer|  --OrderCreatedEvent-->    +----------+
|          |                            +----------+
+----------+  --OrderCreatedEvent-->    | Notif.   |
                                        | Service  |
              [Kafka Topic:             +----------+
               order-events]            +----------+
                                        | Analytics|
                                        | Service  |
                                        +----------+

Key difference from REST:
- REST: Order Service CALLS Inventory Service directly (coupled)
- Events: Order Service PUBLISHES event, doesn't know who consumes it (decoupled)
```

## 8.2 Kafka Architecture

```
+---------+     +---------+     +---------+
|Producer1|     |Producer2|     |Producer3|
|(Order)  |     |(Payment)|     |(User)   |
+---------+     +---------+     +---------+
     |               |               |
     v               v               v
+--------------------------------------------------+
|                  KAFKA CLUSTER                    |
|                                                    |
|  Topic: order-events                              |
|  +----------+ +----------+ +----------+           |
|  |Partition0| |Partition1| |Partition2|           |
|  +----------+ +----------+ +----------+           |
|                                                    |
|  Topic: payment-events                            |
|  +----------+ +----------+                        |
|  |Partition0| |Partition1|                        |
|  +----------+ +----------+                        |
+--------------------------------------------------+
     |               |               |
     v               v               v
+---------+     +---------+     +---------+
|Consumer1|     |Consumer2|     |Consumer3|
|(Notif.) |     |(Invent.)|     |(Analyt.)|
+---------+     +---------+     +---------+
```

## 8.3 Event Classes

```java
// Base event
public abstract class BaseEvent {
    private String eventId;
    private String eventType;
    private Instant timestamp;
    private String source;
}

// Order events
public class OrderCreatedEvent extends BaseEvent {
    private Long orderId;
    private Long customerId;
    private List<OrderItemDTO> items;
    private BigDecimal totalAmount;
    private String shippingAddress;
}

public class OrderCancelledEvent extends BaseEvent {
    private Long orderId;
    private String reason;
}

// Payment events
public class PaymentProcessedEvent extends BaseEvent {
    private Long paymentId;
    private Long orderId;
    private BigDecimal amount;
    private String status; // SUCCESS, FAILED
    private String transactionId;
}

// Inventory events
public class InventoryUpdatedEvent extends BaseEvent {
    private Long productId;
    private int previousQuantity;
    private int newQuantity;
    private String updateReason; // ORDER, RESTOCK, ADJUSTMENT
}
```

## 8.4 Kafka Configuration

```yaml
# application.yml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      acks: all
      retries: 3
    consumer:
      group-id: ${spring.application.name}
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "com.app.event"
```

## 8.5 Real-World Event Flow: Order Placement

```
Step 1: Client places order
        POST /api/orders { items, address, paymentMethod }

Step 2: Order Service creates order (status: PENDING)
        Publishes: OrderCreatedEvent to "order-events"

Step 3: Inventory Service consumes OrderCreatedEvent
        Reserves stock for each item
        Publishes: InventoryReservedEvent to "inventory-events"

Step 4: Payment Service consumes OrderCreatedEvent
        Charges customer's payment method
        Publishes: PaymentProcessedEvent to "payment-events"

Step 5: Order Service consumes PaymentProcessedEvent
        If SUCCESS: updates order status to CONFIRMED
        If FAILED: updates order status to PAYMENT_FAILED
                   Publishes: OrderCancelledEvent

Step 6: Notification Service consumes all events
        Sends email/SMS for each status change
```

---

# Part 9: Distributed Data Management

## 9.1 Database Per Service Pattern

Each microservice owns its data and exposes it only through its API. No direct cross-service database access.

```
+---------+     +---------+     +---------+
| User    |     | Order   |     | Product |
| Service |     | Service |     | Service |
+---------+     +---------+     +---------+
     |               |               |
+---------+     +---------+     +---------+
| UserDB  |     | OrderDB |     |ProductDB|
|PostgreSQL|    | MySQL   |     |MongoDB  |
+---------+     +---------+     +---------+

Rules:
1. Only User Service accesses UserDB
2. Order Service CANNOT query UserDB directly
3. If Order Service needs user info, it calls User Service API
4. Each service can use different database technology
```

## 9.2 Challenges

### Distributed Transactions
In monolith: single database transaction across all tables.
In microservices: order creation + payment + inventory involve 3 different databases.

### Data Consistency
Without shared DB, you can't use JOINs or foreign keys across services. Data may be temporarily inconsistent (eventual consistency).

## 9.3 Saga Pattern

A sequence of local transactions where each service publishes events to trigger the next step. If one step fails, compensating transactions undo previous steps.

### Choreography-Based Saga
```
Order Service         Inventory Service      Payment Service
     |                       |                      |
     | OrderCreated          |                      |
     +---------------------->|                      |
     |                       | StockReserved        |
     |                       +--------------------->|
     |                       |                      | PaymentProcessed
     |<---------------------+----------------------+
     | Update to CONFIRMED   |                      |
     |                       |                      |

FAILURE (Payment fails):
     |                       |                      |
     |                       |        PaymentFailed |
     |                       |<---------------------+
     |                       | Release stock        |
     | OrderCancelled        | (Compensating txn)   |
     |<----------------------+                      |
```

### Orchestration-Based Saga
```java
@Service
public class OrderSagaOrchestrator {

    @Autowired private OrderRepository orderRepository;
    @Autowired private InventoryServiceClient inventoryClient;
    @Autowired private PaymentServiceClient paymentClient;
    @Autowired private NotificationServiceClient notificationClient;

    @Transactional
    public OrderResult executeOrderSaga(OrderRequest request) {
        // Step 1: Create order
        Order order = orderRepository.save(new Order(request, OrderStatus.PENDING));

        try {
            // Step 2: Reserve inventory
            InventoryResponse inv = inventoryClient.reserve(order.getItems());
            if (!inv.isSuccess()) {
                order.setStatus(OrderStatus.FAILED);
                order.setFailureReason("Insufficient stock");
                return OrderResult.failed(order);
            }

            // Step 3: Process payment
            PaymentResponse pay = paymentClient.process(
                new PaymentRequest(order.getId(), order.getTotalAmount()));
            if (!pay.isSuccess()) {
                // Compensate: release inventory
                inventoryClient.release(order.getItems());
                order.setStatus(OrderStatus.PAYMENT_FAILED);
                return OrderResult.failed(order);
            }

            // Step 4: Confirm order
            order.setStatus(OrderStatus.CONFIRMED);
            order.setPaymentId(pay.getTransactionId());
            orderRepository.save(order);

            // Step 5: Notify customer
            notificationClient.sendConfirmation(order.getCustomerId(), order.getId());

            return OrderResult.success(order);

        } catch (Exception e) {
            // Compensate all previous steps
            compensate(order);
            throw new OrderProcessingException("Saga failed", e);
        }
    }

    private void compensate(Order order) {
        try { inventoryClient.release(order.getItems()); } catch (Exception ignored) {}
        try { paymentClient.refund(order.getId()); } catch (Exception ignored) {}
        order.setStatus(OrderStatus.FAILED);
        orderRepository.save(order);
    }
}
```

## 9.4 CQRS (Command Query Responsibility Segregation)

Separate the write model (commands) from the read model (queries).

```
Commands (Write):                    Queries (Read):
POST /api/orders                     GET /api/orders?status=PENDING
PUT /api/orders/{id}/cancel          GET /api/orders/dashboard

+----------+     Publish      +-----------+
| Command  | --- Event -----> | Query     |
| Service  |                  | Service   |
| (Write)  |                  | (Read)    |
+----------+                  +-----------+
| Normalized|                 |Denormalized|
| PostgreSQL|                 |MongoDB /   |
|           |                 |Elasticsearch|
+-----------+                 +-----------+
```

## 9.5 Event Sourcing

Instead of storing current state, store all events that led to the current state.

```
Traditional: Account table row -> { id: 1, balance: 500 }

Event Sourcing: Event log
  Event 1: AccountCreated  { amount: 0 }
  Event 2: MoneyDeposited  { amount: 1000 }
  Event 3: MoneyWithdrawn  { amount: 300 }
  Event 4: MoneyWithdrawn  { amount: 200 }
  Current state: 0 + 1000 - 300 - 200 = 500

Benefits:
- Complete audit trail
- Can rebuild state at any point in time
- Can replay events to debug issues
```

---

# Part 10: Caching Architecture

## 10.1 Why Caching in Microservices?

```
WITHOUT Cache:
  Client -> API -> Service -> Database (every time)
  Response time: 50-200ms

WITH Cache:
  Client -> API -> Service -> Redis (cache hit)
  Response time: 1-5ms

  Client -> API -> Service -> Redis (cache miss) -> Database
  Response time: 50-200ms (first time only)
```

## 10.2 Cache Strategies

### Cache-Aside (Lazy Loading)
```java
@Service
public class ProductService {

    @Autowired private ProductRepository productRepository;
    @Autowired private RedisTemplate<String, Product> redisTemplate;

    public Product getProduct(Long id) {
        String key = "product:" + id;

        // 1. Check cache first
        Product cached = redisTemplate.opsForValue().get(key);
        if (cached != null) {
            return cached; // Cache hit
        }

        // 2. Cache miss -- load from database
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Product not found"));

        // 3. Store in cache for future requests
        redisTemplate.opsForValue().set(key, product, Duration.ofMinutes(30));

        return product;
    }

    // Invalidate cache on update
    public Product updateProduct(Long id, ProductUpdateRequest request) {
        Product product = productRepository.findById(id).orElseThrow();
        product.setName(request.getName());
        product.setPrice(request.getPrice());
        Product saved = productRepository.save(product);

        // Invalidate cache
        redisTemplate.delete("product:" + id);

        return saved;
    }
}
```

### Write-Through Cache
```java
// Data is written to cache AND database simultaneously
public Product saveProduct(Product product) {
    Product saved = productRepository.save(product);    // Write to DB
    redisTemplate.opsForValue().set(                     // Write to cache
        "product:" + saved.getId(), saved, Duration.ofHours(1));
    return saved;
}
```

### Write-Behind Cache (Write-Back)
```
Data written to cache first, then asynchronously persisted to database.
- Faster writes (cache is in-memory)
- Risk of data loss if cache crashes before DB write
- Used for high-throughput write scenarios
```

## 10.3 Spring Boot + Redis Configuration

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 2000ms
  cache:
    type: redis
    redis:
      time-to-live: 3600000  # 1 hour in ms
```

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))
            .disableCachingNullValues()
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()));

        return RedisCacheManager.builder(factory)
            .cacheDefaults(config)
            .withCacheConfiguration("products",
                RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(Duration.ofHours(1)))
            .withCacheConfiguration("users",
                RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(Duration.ofMinutes(15)))
            .build();
    }
}

// Usage with @Cacheable
@Service
public class ProductService {

    @Cacheable(value = "products", key = "#id")
    public Product getProduct(Long id) {
        return productRepository.findById(id).orElseThrow();
    }

    @CacheEvict(value = "products", key = "#id")
    public void updateProduct(Long id, ProductUpdateRequest request) {
        Product product = productRepository.findById(id).orElseThrow();
        product.setName(request.getName());
        productRepository.save(product);
    }

    @CacheEvict(value = "products", allEntries = true)
    public void clearProductCache() { }
}
```

---

# Part 11: Microservices Design Patterns

## 11.1 API Gateway Pattern

Already covered in Part 5. Single entry point for all clients, handles routing, auth, rate limiting.

## 11.2 Circuit Breaker Pattern

**Problem:** If Payment Service is down, Order Service keeps sending requests, wasting resources and degrading user experience.

**Solution:** Circuit breaker detects failures and stops calling the failing service temporarily.

```
States:
  CLOSED  --> Requests flow normally
              If failure threshold exceeded --> OPEN

  OPEN    --> All requests fail immediately (fast fail)
              After wait duration --> HALF_OPEN

  HALF_OPEN -> Allow limited requests to test recovery
               If success --> CLOSED
               If failure --> OPEN

Timeline:
  |---CLOSED---|---OPEN---|---HALF_OPEN---|---CLOSED---|
  normal calls   fast fail   test calls     back to normal
```

## 11.3 Bulkhead Pattern

**Problem:** One slow service consumes all threads, blocking other services.

**Solution:** Isolate thread pools per service call.

```
WITHOUT Bulkhead:
  [Thread Pool: 200 threads]
  All service calls share same pool
  If Payment Service is slow -> all 200 threads blocked -> entire app hangs

WITH Bulkhead:
  [Pool A: 50 threads] -> Payment Service calls
  [Pool B: 50 threads] -> Inventory Service calls
  [Pool C: 100 threads] -> Other calls
  If Payment Service is slow -> only 50 threads blocked -> rest works fine
```

## 11.4 Saga Pattern

Already covered in Part 9. Manages distributed transactions across services.

## 11.5 Strangler Pattern

**Problem:** How to migrate from monolith to microservices without a big-bang rewrite.

**Solution:** Gradually replace monolith functionality with microservices.

```
Phase 1: All traffic goes to monolith
  Client -> [Monolith with all features]

Phase 2: New features built as microservices, old ones still in monolith
  Client -> [API Gateway]
                |
         +------+------+
         |             |
    [New user     [Monolith
     service]      (orders, payments, etc.)]

Phase 3: Gradually move features out
  Client -> [API Gateway]
         |         |         |
    [User Svc] [Order Svc] [Monolith (remaining)]

Phase 4: Monolith fully replaced
  Client -> [API Gateway]
         |         |         |
    [User Svc] [Order Svc] [Payment Svc]
```

## 11.6 Sidecar Pattern

Deploy helper functionality alongside the main service in the same container/pod.

```
+-----------------------------------+
| Pod / Host                        |
|  +-------------+  +------------+  |
|  | Main        |  | Sidecar    |  |
|  | Application |  | (Envoy     |  |
|  | (Java)      |  |  proxy)    |  |
|  +-------------+  +------------+  |
|        |                |         |
|        +---local net----+         |
+-----------------------------------+
Sidecar handles:
  - mTLS between services
  - Logging agent
  - Health checking
  - Traffic management
```

---

# Part 12: Resilience and Fault Tolerance

## 12.1 Resilience4j Circuit Breaker

```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
</dependency>
```

```yaml
resilience4j:
  circuitbreaker:
    instances:
      paymentService:
        registerHealthIndicator: true
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 10s
        permittedNumberOfCallsInHalfOpenState: 3
        slidingWindowType: COUNT_BASED
```

```java
@Service
public class OrderService {

    @CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
    public PaymentResponse processPayment(PaymentRequest request) {
        return paymentServiceClient.process(request);
    }

    // Fallback when circuit is open
    private PaymentResponse paymentFallback(PaymentRequest request, Throwable t) {
        log.warn("Payment service unavailable, queuing for later: {}", t.getMessage());
        paymentQueue.enqueue(request); // Queue for retry later
        return new PaymentResponse("PENDING", "Payment queued for processing");
    }
}
```

## 12.2 Retry

```yaml
resilience4j:
  retry:
    instances:
      inventoryService:
        maxAttempts: 3
        waitDuration: 500ms
        retryExceptions:
          - java.io.IOException
          - java.net.SocketTimeoutException
        ignoreExceptions:
          - com.app.exception.BusinessException
```

```java
@Retry(name = "inventoryService", fallbackMethod = "inventoryFallback")
public InventoryResponse checkStock(Long productId) {
    return inventoryClient.getStock(productId);
}
```

## 12.3 Rate Limiter

```yaml
resilience4j:
  ratelimiter:
    instances:
      externalApi:
        limitForPeriod: 50
        limitRefreshPeriod: 1s
        timeoutDuration: 500ms
```

```java
@RateLimiter(name = "externalApi")
public ExternalData callExternalApi(String param) {
    return externalApiClient.getData(param);
}
```

## 12.4 Timeout

```java
@TimeLimiter(name = "paymentService", fallbackMethod = "timeoutFallback")
public CompletableFuture<PaymentResponse> processPaymentAsync(PaymentRequest request) {
    return CompletableFuture.supplyAsync(() -> paymentClient.process(request));
}
```

```yaml
resilience4j:
  timelimiter:
    instances:
      paymentService:
        timeoutDuration: 3s
        cancelRunningFuture: true
```

## 12.5 Combining Patterns

```java
// Order of execution: Retry -> CircuitBreaker -> RateLimiter -> TimeLimiter
@CircuitBreaker(name = "paymentService", fallbackMethod = "fallback")
@Retry(name = "paymentService")
@RateLimiter(name = "paymentService")
public PaymentResponse processPayment(PaymentRequest request) {
    return paymentServiceClient.process(request);
}
```

---

# Part 13: Microservices Deployment Architecture

## 13.1 Docker

### Dockerfile for Spring Boot Service
```dockerfile
# Multi-stage build
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

# Non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
```

## 13.2 Docker Compose (Development)

```yaml
version: '3.8'
services:
  # Infrastructure
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin123
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    ports: ["9092:9092"]
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,EXTERNAL://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  # Services
  eureka-server:
    build: ./eureka-server
    ports: ["8761:8761"]

  config-server:
    build: ./config-server
    ports: ["8888:8888"]
    depends_on: [eureka-server]

  api-gateway:
    build: ./api-gateway
    ports: ["8080:8080"]
    depends_on: [eureka-server, config-server]

  user-service:
    build: ./user-service
    depends_on: [postgres, eureka-server, config-server]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/userdb

  order-service:
    build: ./order-service
    depends_on: [postgres, kafka, eureka-server, config-server]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/orderdb

  payment-service:
    build: ./payment-service
    depends_on: [postgres, kafka, eureka-server, config-server]

  notification-service:
    build: ./notification-service
    depends_on: [kafka, eureka-server]

volumes:
  postgres_data:
```

## 13.3 Kubernetes Deployment

```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
        - name: order-service
          image: myregistry/order-service:1.2.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 5
          env:
            - name: SPRING_DATASOURCE_URL
              valueFrom:
                secretKeyRef:
                  name: order-db-secret
                  key: url
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service
  ports:
    - port: 8080
      targetPort: 8080
  type: ClusterIP
---
# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---
