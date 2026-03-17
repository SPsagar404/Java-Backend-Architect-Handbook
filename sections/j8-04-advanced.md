# Part 9: Comparable vs Comparator (Deep Guide)

## 9.1 Comparable Interface

### Definition

`Comparable<T>` defines the **natural ordering** of objects. The class itself decides how it should be compared.

```java
public interface Comparable<T> {
    int compareTo(T o);
    // Returns:
    //   negative  -> this < o
    //   zero      -> this == o
    //   positive  -> this > o
}
```

### Implementation Example

```java
public class Employee implements Comparable<Employee> {
    private String name;
    private int salary;
    private int age;

    @Override
    public int compareTo(Employee other) {
        return Integer.compare(this.salary, other.salary);  // Natural order: by salary
    }
}

// Usage -- sorting uses compareTo automatically
List<Employee> sorted = employees.stream()
    .sorted()  // Uses compareTo (natural ordering = by salary)
    .collect(Collectors.toList());

Collections.sort(employees);  // Also uses compareTo
```

## 9.2 Comparator Interface

### Definition

`Comparator<T>` defines **custom ordering** externally. The comparison logic is separate from the class.

```java
@FunctionalInterface
public interface Comparator<T> {
    int compare(T o1, T o2);

    // Key static/default methods:
    static <T, U extends Comparable<? super U>> Comparator<T>
        comparing(Function<T, U> keyExtractor);
    default Comparator<T> reversed();
    default Comparator<T> thenComparing(Comparator<? super T> other);
    static <T> Comparator<T> naturalOrder();
    static <T> Comparator<T> reverseOrder();
    static <T> Comparator<T> nullsFirst(Comparator<? super T> comparator);
    static <T> Comparator<T> nullsLast(Comparator<? super T> comparator);
}
```

## 9.3 Comparable vs Comparator Differences

| Aspect | Comparable | Comparator |
|---|---|---|
| **Package** | `java.lang` | `java.util` |
| **Method** | `compareTo(T o)` | `compare(T o1, T o2)` |
| **Implementation** | Inside the class being compared | External class or lambda |
| **Ordering** | Defines ONE natural ordering | Defines MULTIPLE custom orderings |
| **Modification** | Requires modifying the original class | No modification needed |
| **Number of orderings** | Only one per class | Unlimited per class |
| **Functional Interface?** | No | Yes |

## 9.4 When to Use Which

| Scenario | Use |
|---|---|
| The class has an obvious, single natural ordering | `Comparable` |
| You need multiple different orderings | `Comparator` |
| The class is from a library (you can't modify it) | `Comparator` |
| Sorting is a primary feature of the domain object | `Comparable` |
| Ad-hoc sorting in specific use cases | `Comparator` |

## 9.5 Custom Sorting Examples

### Sort by Single Field

```java
// By salary ascending
employees.stream()
    .sorted(Comparator.comparing(Employee::getSalary))
    .collect(Collectors.toList());

// By salary descending
employees.stream()
    .sorted(Comparator.comparing(Employee::getSalary).reversed())
    .collect(Collectors.toList());

// By name (case-insensitive)
employees.stream()
    .sorted(Comparator.comparing(Employee::getName, String.CASE_INSENSITIVE_ORDER))
    .collect(Collectors.toList());

// By age ascending (using primitive comparator for performance)
employees.stream()
    .sorted(Comparator.comparingInt(Employee::getAge))
    .collect(Collectors.toList());
```

### Multi-Field Sorting

```java
// Sort by department, then by salary (descending), then by name
Comparator<Employee> multiSort = Comparator
    .comparing(Employee::getDepartment)
    .thenComparing(Employee::getSalary, Comparator.reverseOrder())
    .thenComparing(Employee::getName);

List<Employee> sorted = employees.stream()
    .sorted(multiSort)
    .collect(Collectors.toList());
```

### Handling Nulls

```java
// Nulls first
employees.stream()
    .sorted(Comparator.comparing(Employee::getName,
        Comparator.nullsFirst(Comparator.naturalOrder())))
    .collect(Collectors.toList());

// Nulls last
employees.stream()
    .sorted(Comparator.comparing(Employee::getManager,
        Comparator.nullsLast(Comparator.naturalOrder())))
    .collect(Collectors.toList());
```

### Real-World Example: Complex Employee Sorting

```java
// Sort employees:
// 1. Active employees first, then inactive
// 2. Within each group, by department alphabetically
// 3. Within each department, by salary descending
// 4. If salary is same, by name alphabetically

Comparator<Employee> complexSort = Comparator
    .comparing(Employee::isActive, Comparator.reverseOrder())
    .thenComparing(Employee::getDepartment)
    .thenComparing(Employee::getSalary, Comparator.reverseOrder())
    .thenComparing(Employee::getName);

List<Employee> result = employees.stream()
    .sorted(complexSort)
    .collect(Collectors.toList());
```

---

# Part 10: Advanced Stream Topics

## 10.1 Parallel Streams

### What Are Parallel Streams?

Parallel streams split the data into multiple chunks and process them concurrently using the **ForkJoinPool**. This can significantly improve performance for CPU-intensive operations on large datasets.

```
Sequential Stream:
  [1, 2, 3, 4, 5, 6, 7, 8]
  Thread 1: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
  Time: 8 units

Parallel Stream (4 cores):
  [1, 2, 3, 4, 5, 6, 7, 8]
  Thread 1: [1, 2]    Thread 2: [3, 4]    Thread 3: [5, 6]    Thread 4: [7, 8]
  Time: ~2 units (4x faster)
```

### Creating Parallel Streams

```java
// From collection
List<Integer> list = List.of(1, 2, 3, 4, 5);
list.parallelStream()
    .filter(n -> n > 2)
    .collect(Collectors.toList());

// Convert sequential to parallel
list.stream()
    .parallel()
    .map(n -> n * 2)
    .collect(Collectors.toList());

// Check if stream is parallel
boolean isParallel = list.parallelStream().isParallel();  // true
```

### When to Use Parallel Streams

| Use Parallel When | Avoid Parallel When |
|---|---|
| Dataset > 10,000 elements | Dataset < 1,000 elements |
| CPU-intensive operations | I/O-bound operations (DB calls, API calls) |
| Independent operations (no shared state) | Operations with side effects |
| Simple, stateless transformations | Order-dependent processing |
| Splittable data sources (ArrayList, arrays) | Hard-to-split sources (LinkedList, Streams) |

### When NOT to Use Parallel Streams

```java
// BAD: Shared mutable state
List<Integer> results = new ArrayList<>();  // NOT thread-safe!
numbers.parallelStream()
    .filter(n -> n > 0)
    .forEach(results::add);  // Race condition! Elements may be lost or duplicated

// GOOD: Use collect instead
List<Integer> results = numbers.parallelStream()
    .filter(n -> n > 0)
    .collect(Collectors.toList());  // Thread-safe

// BAD: I/O-bound operations block ForkJoinPool
users.parallelStream()
    .forEach(user -> sendEmail(user));  // Blocks shared ForkJoinPool threads!

// BAD: Small dataset -- overhead > benefit
List.of(1, 2, 3).parallelStream()
    .map(n -> n * 2)   // Thread management overhead exceeds computation time
    .collect(Collectors.toList());
```

### Custom ForkJoinPool for Parallel Streams

```java
// Use custom pool to avoid blocking the shared ForkJoinPool
ForkJoinPool customPool = new ForkJoinPool(8);
try {
    List<Result> results = customPool.submit(() ->
        largeDataset.parallelStream()
            .map(this::heavyComputation)
            .collect(Collectors.toList())
    ).get();
} finally {
    customPool.shutdown();
}
```

## 10.2 Primitive Streams: IntStream, LongStream, DoubleStream

### Why Primitive Streams Exist

```
Problem with Stream<Integer>:
  1. Each int is BOXED into Integer object (autoboxing)
  2. Each Integer is UNBOXED back to int for operations (autounboxing)
  3. Creates garbage objects that need GC
  4. Significant performance overhead for numeric operations

Solution: Primitive Streams
  IntStream, LongStream, DoubleStream
  - Work directly with primitive types
  - No boxing/unboxing
  - Provide specialized numeric methods (sum, average, etc.)
```

### IntStream Methods

```java
// Creating IntStream
IntStream range = IntStream.range(1, 10);          // 1 to 9 (exclusive end)
IntStream rangeClosed = IntStream.rangeClosed(1, 10); // 1 to 10 (inclusive end)
IntStream fromArray = IntStream.of(1, 2, 3, 4, 5);
IntStream fromArray2 = Arrays.stream(new int[]{1, 2, 3});

// Specialized operations
int sum = IntStream.rangeClosed(1, 100).sum();                    // 5050
OptionalDouble avg = IntStream.of(10, 20, 30).average();          // OptionalDouble[20.0]
OptionalInt max = IntStream.of(10, 20, 30).max();                 // OptionalInt[30]
IntSummaryStatistics stats = IntStream.of(10, 20, 30).summaryStatistics();

// Converting between Stream<Integer> and IntStream
List<Integer> list = List.of(1, 2, 3);
IntStream intStream = list.stream().mapToInt(Integer::intValue);  // Stream -> IntStream
Stream<Integer> boxed = intStream.boxed();                         // IntStream -> Stream

// IntStream for character processing
String str = "Hello World";
IntStream chars = str.chars();                                     // IntStream of char values
str.chars()
    .filter(Character::isUpperCase)
    .forEach(c -> System.out.print((char) c));  // "HW"
```

### LongStream and DoubleStream

```java
// LongStream -- for large numeric ranges
long sum = LongStream.rangeClosed(1, 1_000_000_000L).sum();

// DoubleStream -- for floating-point operations
double average = DoubleStream.of(1.5, 2.5, 3.5, 4.5).average().orElse(0.0);

// Converting mapToInt, mapToLong, mapToDouble
double totalSalary = employees.stream()
    .mapToDouble(Employee::getSalary)  // Stream<Employee> -> DoubleStream
    .sum();

// Statistics
DoubleSummaryStatistics stats = employees.stream()
    .mapToDouble(Employee::getSalary)
    .summaryStatistics();
```

### Boxing vs Primitive Streams Performance

| Operation | `Stream<Integer>` | `IntStream` |
|---|---|---|
| Storage | Boxed Integer objects on heap | Primitive int values |
| Memory | ~16 bytes per element | 4 bytes per element |
| Sum | `reduce(0, Integer::sum)` | `sum()` -- built-in |
| Average | Manual calculation needed | `average()` -- built-in |
| Performance | Slower (boxing/unboxing + GC) | Faster (no overhead) |

## 10.3 Performance Considerations

### Stream Performance Guidelines

```
1. AVOID UNNECESSARY BOXING
   BAD:  list.stream().map(n -> n * 2).reduce(0, Integer::sum)
   GOOD: list.stream().mapToInt(n -> n * 2).sum()

2. PLACE filter() BEFORE map()
   BAD:  stream.map(expensive).filter(simple)     // Maps ALL, then filters
   GOOD: stream.filter(simple).map(expensive)     // Filters first, maps fewer

3. USE SHORT-CIRCUIT OPERATIONS
   BAD:  stream.filter(predicate).count() > 0     // Processes ALL elements
   GOOD: stream.anyMatch(predicate)               // Stops at first match

4. AVOID sorted() ON LARGE STREAMS WITH limit()
   BAD:  stream.sorted().limit(10)                // Sorts ALL, takes 10
   Consider: Use a min-heap/PriorityQueue instead

5. PREFER collect() OVER forEach() + ADD
   BAD:  list = new ArrayList<>(); stream.forEach(list::add)
   GOOD: list = stream.collect(Collectors.toList())
```

---

# Part 11: Real-World Use Cases

## 11.1 Filtering Large Datasets

```java
// E-commerce: Filter products based on multiple criteria
public List<ProductDTO> searchProducts(SearchCriteria criteria) {
    return productRepository.findAll().stream()
        .filter(p -> criteria.getCategory() == null
            || p.getCategory().equals(criteria.getCategory()))
        .filter(p -> criteria.getMinPrice() == null
            || p.getPrice().compareTo(criteria.getMinPrice()) >= 0)
        .filter(p -> criteria.getMaxPrice() == null
            || p.getPrice().compareTo(criteria.getMaxPrice()) <= 0)
        .filter(p -> criteria.isInStock() == null || p.getStock() > 0)
        .sorted(Comparator.comparing(Product::getPrice))
        .skip((long) criteria.getPage() * criteria.getSize())
        .limit(criteria.getSize())
        .map(this::toDTO)
        .collect(Collectors.toList());
}
```

## 11.2 Transforming API Responses

```java
// Microservice: Transform external API response to internal model
public List<InternalOrder> fetchAndTransformOrders(String customerId) {
    ExternalApiResponse response = externalApi.getOrders(customerId);

    return response.getData().stream()
        .filter(order -> order.getStatus() != null)
        .map(extOrder -> InternalOrder.builder()
            .orderId(extOrder.getId())
            .customerName(extOrder.getCustomer().getFullName())
            .totalAmount(extOrder.getItems().stream()
                .mapToDouble(item -> item.getPrice() * item.getQuantity())
                .sum())
            .itemCount(extOrder.getItems().size())
            .status(mapStatus(extOrder.getStatus()))
            .createdAt(Instant.parse(extOrder.getTimestamp()))
            .build())
        .sorted(Comparator.comparing(InternalOrder::getCreatedAt).reversed())
        .collect(Collectors.toList());
}
```

## 11.3 Grouping Database Results

```java
// HR Analytics: Department-wise salary analysis
public Map<String, DepartmentStats> getDepartmentAnalytics() {
    List<Employee> employees = employeeRepository.findAll();

    return employees.stream()
        .collect(Collectors.groupingBy(
            Employee::getDepartment,
            Collectors.collectingAndThen(
                Collectors.toList(),
                emps -> new DepartmentStats(
                    emps.size(),
                    emps.stream().mapToDouble(Employee::getSalary).average().orElse(0),
                    emps.stream().mapToDouble(Employee::getSalary).max().orElse(0),
                    emps.stream().mapToDouble(Employee::getSalary).min().orElse(0),
                    emps.stream().mapToDouble(Employee::getSalary).sum()
                )
            )
        ));
}
```

## 11.4 Analytics Calculations

```java
// Sales analytics: Monthly revenue trends
public Map<YearMonth, BigDecimal> getMonthlyRevenue(List<Order> orders) {
    return orders.stream()
        .filter(o -> o.getStatus() == OrderStatus.COMPLETED)
        .collect(Collectors.groupingBy(
            o -> YearMonth.from(o.getCompletedDate()),
            TreeMap::new,  // Sorted by month
            Collectors.reducing(
                BigDecimal.ZERO,
                Order::getAmount,
                BigDecimal::add
            )
        ));
}

// Top selling products
public List<ProductSalesDTO> getTopSellingProducts(int topN) {
    return orderItemRepository.findAll().stream()
        .collect(Collectors.groupingBy(
            OrderItem::getProductId,
            Collectors.summingLong(OrderItem::getQuantity)
        ))
        .entrySet().stream()
        .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
        .limit(topN)
        .map(entry -> new ProductSalesDTO(entry.getKey(), entry.getValue()))
        .collect(Collectors.toList());
}
```

## 11.5 Log Processing

```java
// Process application logs and generate error summary
public Map<String, Long> analyzeErrors(String logFilePath) throws IOException {
    try (Stream<String> lines = Files.lines(Paths.get(logFilePath))) {
        return lines
            .filter(line -> line.contains("ERROR") || line.contains("EXCEPTION"))
            .map(line -> {
                // Extract exception class name
                int idx = line.indexOf("Exception");
                if (idx > 0) {
                    int start = line.lastIndexOf(' ', idx) + 1;
                    return line.substring(start, idx + "Exception".length());
                }
                return "UnknownError";
            })
            .collect(Collectors.groupingBy(
                Function.identity(),
                Collectors.counting()
            ))
            .entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .collect(Collectors.toMap(
                Map.Entry::getKey,
                Map.Entry::getValue,
                (e1, e2) -> e1,
                LinkedHashMap::new  // Preserve sorted order
            ));
    }
}
```

---
