# Part 3: Stream Creation Methods

## 3.1 Collection.stream()

### Syntax & Explanation

Creates a sequential stream from any `Collection` (List, Set, Queue, etc.).

```java
List<String> names = Arrays.asList("Alice", "Bob", "Charlie");
Stream<String> stream = names.stream();
```

### Real-World Use Case

```java
// Processing a list of orders from database
List<Order> orders = orderRepository.findAll();

List<OrderDTO> activeOrders = orders.stream()
    .filter(order -> order.getStatus() == OrderStatus.ACTIVE)
    .map(order -> new OrderDTO(order.getId(), order.getAmount(), order.getCustomerName()))
    .sorted(Comparator.comparing(OrderDTO::getAmount).reversed())
    .collect(Collectors.toList());
```

> **Interview Tip:** `stream()` is the most commonly used stream creation method. It creates a sequential stream, meaning elements are processed one at a time in encounter order.

## 3.2 Collection.parallelStream()

### Syntax & Explanation

Creates a parallel stream that can process elements concurrently using the ForkJoinPool.

```java
List<String> names = Arrays.asList("Alice", "Bob", "Charlie");
Stream<String> parallelStream = names.parallelStream();
```

### Real-World Use Case

```java
// Processing large dataset -- CPU-intensive transformation
List<Report> monthlyReports = rawDataList.parallelStream()
    .filter(data -> data.getYear() == 2024)
    .map(data -> generateReport(data))    // CPU-intensive operation
    .collect(Collectors.toList());
```

> **Interview Discussion:** `parallelStream()` uses a shared `ForkJoinPool.commonPool()` by default. Be cautious: it can actually be SLOWER for small datasets or I/O-bound operations due to thread management overhead. The threshold is typically around 10,000+ elements with CPU-intensive operations.

## 3.3 Stream.of()

### Syntax & Explanation

Creates a stream from explicitly listed elements.

```java
// Single element
Stream<String> single = Stream.of("Hello");

// Multiple elements
Stream<String> multiple = Stream.of("Alice", "Bob", "Charlie");

// From array
String[] arr = {"A", "B", "C"};
Stream<String> fromArray = Stream.of(arr);
```

### Real-World Use Case

```java
// Combining multiple configuration sources
Stream<String> configSources = Stream.of(
    "application.yml",
    "application-dev.yml",
    "application-local.yml"
);

List<Properties> configs = configSources
    .map(this::loadConfig)
    .filter(Objects::nonNull)
    .collect(Collectors.toList());
```

> **Interview Tip:** `Stream.of()` is useful for creating small, known streams. For empty streams, use `Stream.empty()`. For a single element, `Stream.of(element)` is preferred over creating a list.

## 3.4 Arrays.stream()

### Syntax & Explanation

Creates a stream from an array. Supports both object arrays and primitive arrays.

```java
// Object array
String[] names = {"Alice", "Bob", "Charlie"};
Stream<String> nameStream = Arrays.stream(names);

// Primitive array -- returns IntStream, LongStream, or DoubleStream
int[] numbers = {1, 2, 3, 4, 5};
IntStream intStream = Arrays.stream(numbers);

// Partial array (start inclusive, end exclusive)
IntStream partial = Arrays.stream(numbers, 1, 4);  // [2, 3, 4]
```

### Real-World Use Case

```java
// Processing CSV row data
String[] csvRow = line.split(",");
Map<String, String> rowMap = IntStream.range(0, headers.length)
    .boxed()
    .collect(Collectors.toMap(
        i -> headers[i].trim(),
        i -> i < csvRow.length ? csvRow[i].trim() : ""
    ));
```

> **Interview Discussion:** For primitive arrays, `Arrays.stream()` returns specialized streams (`IntStream`, `LongStream`, `DoubleStream`) which avoid autoboxing overhead and provide additional methods like `sum()`, `average()`.

## 3.5 Files.lines()

### Syntax & Explanation

Creates a stream of lines from a file. Each line becomes an element in the stream. The stream is lazy -- lines are read on demand.

```java
// Basic usage (must handle IOException)
try (Stream<String> lines = Files.lines(Paths.get("data.txt"))) {
    lines.filter(line -> !line.isEmpty())
         .map(String::trim)
         .forEach(System.out::println);
}

// With charset
try (Stream<String> lines = Files.lines(Paths.get("data.txt"), StandardCharsets.UTF_8)) {
    long count = lines.count();
}
```

### Real-World Use Case

```java
// Analyzing log files for error patterns
try (Stream<String> logLines = Files.lines(Paths.get("/var/log/app.log"))) {
    Map<String, Long> errorCounts = logLines
        .filter(line -> line.contains("ERROR"))
        .map(line -> line.substring(line.indexOf("ERROR") + 6).split(":")[0].trim())
        .collect(Collectors.groupingBy(
            Function.identity(),
            Collectors.counting()
        ));

    errorCounts.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .limit(10)
        .forEach(e -> System.out.println(e.getKey() + ": " + e.getValue()));
}
```

> **Interview Tip:** Always use try-with-resources with `Files.lines()` because it opens a file handle. Forgetting to close can cause resource leaks. The stream is lazy, so the entire file is NOT loaded into memory.

## 3.6 Stream.generate()

### Syntax & Explanation

Creates an infinite stream by repeatedly invoking a `Supplier`. Must be limited with `limit()` to avoid infinite processing.

```java
// Generate infinite stream of random numbers
Stream<Double> randoms = Stream.generate(Math::random);

// Always use limit() with generate()
List<Double> fiveRandoms = Stream.generate(Math::random)
    .limit(5)
    .collect(Collectors.toList());

// Generate UUIDs
List<String> uuids = Stream.generate(() -> UUID.randomUUID().toString())
    .limit(100)
    .collect(Collectors.toList());
```

### Real-World Use Case

```java
// Generating test data for load testing
List<Employee> testEmployees = Stream.generate(() -> new Employee(
        "Emp-" + ThreadLocalRandom.current().nextInt(10000),
        departments[ThreadLocalRandom.current().nextInt(departments.length)],
        30000 + ThreadLocalRandom.current().nextInt(70000)
    ))
    .limit(10000)
    .collect(Collectors.toList());
```

> **Interview Discussion:** `Stream.generate()` creates an **unordered** infinite stream. It has no concept of previous elements. For ordered sequences, use `Stream.iterate()`.

## 3.7 Stream.iterate()

### Syntax & Explanation

Creates an infinite ordered stream by iteratively applying a function to a seed value.

```java
// Java 8: Two-argument iterate (infinite, must limit)
Stream<Integer> powers = Stream.iterate(1, n -> n * 2);
// 1, 2, 4, 8, 16, 32, ...

List<Integer> firstTen = Stream.iterate(1, n -> n * 2)
    .limit(10)
    .collect(Collectors.toList());

// Java 9+: Three-argument iterate (with predicate -- like a for loop)
Stream<Integer> range = Stream.iterate(1, n -> n <= 100, n -> n + 1);
// Equivalent to: for (int n = 1; n <= 100; n++)
```

### Real-World Use Case

```java
// Generating date ranges for a report
List<LocalDate> last30Days = Stream.iterate(
        LocalDate.now(),
        date -> date.isAfter(LocalDate.now().minusDays(30)),
        date -> date.minusDays(1)
    )
    .collect(Collectors.toList());

// Fibonacci sequence
Stream.iterate(new long[]{0, 1}, f -> new long[]{f[1], f[0] + f[1]})
    .limit(20)
    .map(f -> f[0])
    .forEach(System.out::println);
```

> **Interview Tip:** `Stream.iterate()` differs from `Stream.generate()` in that each element depends on the previous one. The Java 9 version with a predicate replaces many `for` loop patterns.

### Stream Creation Summary Table

| Method | Source | Finite/Infinite | Returns | Use Case |
|---|---|---|---|---|
| `collection.stream()` | Collection | Finite | `Stream<T>` | Most common -- process lists/sets |
| `collection.parallelStream()` | Collection | Finite | `Stream<T>` | Large datasets, CPU-bound work |
| `Stream.of(...)` | Explicit values | Finite | `Stream<T>` | Small, known element sets |
| `Arrays.stream(arr)` | Array | Finite | `Stream<T>` / `IntStream` | Process arrays |
| `Files.lines(path)` | File | Finite | `Stream<String>` | File processing, log analysis |
| `Stream.generate(supplier)` | Supplier function | Infinite | `Stream<T>` | Random data, test data generation |
| `Stream.iterate(seed, fn)` | Seed + unary operator | Infinite | `Stream<T>` | Sequences, ranges, progressions |

---

# Part 4: All Intermediate Stream Operations

> **Key Rule:** Intermediate operations are LAZY -- they are not executed until a terminal operation is invoked. They always return a new `Stream`, allowing method chaining.

## 4.1 map()

### What It Does

Transforms each element in the stream by applying a function. The function takes one element and returns one transformed element. The stream size remains the same.

### Method Signature

```java
<R> Stream<R> map(Function<? super T, ? extends R> mapper)
```

### When to Use

- Converting objects from one type to another (Entity -> DTO)
- Extracting a field from objects (Employee -> name)
- Applying a transformation to each element

### When NOT to Use

- When the mapping function returns a collection and you want to flatten it (use `flatMap()`)
- When you just need side effects without transformation (use `forEach()`)

### Time Complexity

O(n) -- applies the function once per element.

### Real-World Example

```java
// Entity to DTO conversion in a REST API service layer
public List<EmployeeDTO> getAllEmployees() {
    return employeeRepository.findAll().stream()
        .map(entity -> new EmployeeDTO(
            entity.getId(),
            entity.getFirstName() + " " + entity.getLastName(),
            entity.getDepartment().getName(),
            entity.getSalary()
        ))
        .collect(Collectors.toList());
}
```

### Code Example

```java
// Transform strings to their lengths
List<Integer> lengths = List.of("Java", "Stream", "API").stream()
    .map(String::length)
    .collect(Collectors.toList());
// Output: [4, 6, 3]

// Convert to uppercase
List<String> upper = List.of("hello", "world").stream()
    .map(String::toUpperCase)
    .collect(Collectors.toList());
// Output: ["HELLO", "WORLD"]
```

> **Interview Question:** *What is the difference between `map()` and `flatMap()`?*
> `map()` performs a one-to-one transformation (each element maps to exactly one result). `flatMap()` performs a one-to-many transformation and flattens the results (each element can map to zero or more results, and the resulting streams are merged into one).

---

## 4.2 flatMap()

### What It Does

Transforms each element into a stream of elements, then **flattens** all the resulting streams into a single stream. Used when each element maps to multiple elements.

### Method Signature

```java
<R> Stream<R> flatMap(Function<? super T, ? extends Stream<? extends R>> mapper)
```

### When to Use

- Flattening nested collections (List of Lists -> single List)
- When `map()` would produce `Stream<Stream<T>>` and you want `Stream<T>`
- Processing nested data structures

### When NOT to Use

- Simple one-to-one transformations (use `map()`)
- When you don't need to flatten (use `map()`)

### Time Complexity

O(n - m) where n is the number of elements and m is the average size of each sub-stream.

### Real-World Example

```java
// Flatten orders from multiple customers
List<Order> allOrders = customers.stream()
    .flatMap(customer -> customer.getOrders().stream())
    .collect(Collectors.toList());

// Extract all tags from blog posts
List<String> allTags = blogPosts.stream()
    .flatMap(post -> post.getTags().stream())
    .distinct()
    .sorted()
    .collect(Collectors.toList());
```

### Code Example

```java
// Flatten nested lists
List<List<Integer>> nested = List.of(
    List.of(1, 2, 3),
    List.of(4, 5),
    List.of(6, 7, 8, 9)
);

List<Integer> flat = nested.stream()
    .flatMap(Collection::stream)
    .collect(Collectors.toList());
// Output: [1, 2, 3, 4, 5, 6, 7, 8, 9]

// Split sentences into words
List<String> sentences = List.of("Hello World", "Java Streams");
List<String> words = sentences.stream()
    .flatMap(sentence -> Arrays.stream(sentence.split(" ")))
    .collect(Collectors.toList());
// Output: ["Hello", "World", "Java", "Streams"]
```

### Visual: map() vs flatMap()

```
map() -- One-to-One:
  [A, B, C]  ->  map(x -> transform(x))  ->  [A', B', C']
  Size stays the same

flatMap() -- One-to-Many (then flatten):
  [A, B]  ->  flatMap(x -> Stream.of(x1, x2))  ->  [A1, A2, B1, B2]
  Size may change

Example:
  map:     ["Hello World", "Java"]  -> map(s -> s.split(" "))    -> [["Hello","World"], ["Java"]]
           Result: Stream<String[]>   NOT what we want!

  flatMap: ["Hello World", "Java"]  -> flatMap(s -> Arrays.stream(s.split(" ")))
           -> ["Hello", "World", "Java"]
           Result: Stream<String>   Flattened! [ok]
```

> **Interview Question:** *Can you explain a scenario where using `map()` would be incorrect and you must use `flatMap()`?*
> When each element maps to a collection. E.g., getting all line items from a list of orders. `map()` would give `Stream<List<LineItem>>`, but `flatMap()` gives `Stream<LineItem>`.

---

## 4.3 filter()

### What It Does

Returns a stream containing only the elements that match a given predicate. Elements for which the predicate returns `false` are excluded.

### Method Signature

```java
Stream<T> filter(Predicate<? super T> predicate)
```

### When to Use

- Removing unwanted elements from a dataset
- Applying business rules to exclude records
- Searching for elements matching criteria

### When NOT to Use

- When you need the index of elements (use a traditional loop)
- When filtering logic has side effects (violates functional principles)

### Time Complexity

O(n) -- predicate is evaluated once per element.

### Real-World Example

```java
// Filter active premium customers with outstanding balance
List<Customer> targetCustomers = customerRepository.findAll().stream()
    .filter(Customer::isActive)
    .filter(c -> c.getMembershipType() == MembershipType.PREMIUM)
    .filter(c -> c.getOutstandingBalance().compareTo(BigDecimal.ZERO) > 0)
    .sorted(Comparator.comparing(Customer::getOutstandingBalance).reversed())
    .collect(Collectors.toList());
```

### Code Example

```java
// Filter even numbers
List<Integer> evens = List.of(1, 2, 3, 4, 5, 6).stream()
    .filter(n -> n % 2 == 0)
    .collect(Collectors.toList());
// Output: [2, 4, 6]

// Filter non-null and non-empty strings
List<String> valid = Arrays.asList("Hello", null, "", "World", null).stream()
    .filter(Objects::nonNull)
    .filter(s -> !s.isEmpty())
    .collect(Collectors.toList());
// Output: ["Hello", "World"]

// Chaining multiple filters vs single complex filter
// Option 1: Multiple filters (more readable)
stream.filter(e -> e.getSalary() > 50000)
      .filter(e -> e.getAge() > 25)
      .filter(e -> "IT".equals(e.getDepartment()));

// Option 2: Single combined filter (slightly more performant)
stream.filter(e -> e.getSalary() > 50000 && e.getAge() > 25 && "IT".equals(e.getDepartment()));
```

> **Interview Question:** *Is it better to use multiple `filter()` calls or one combined `filter()`?*
> Multiple filters are more readable and maintainable. A single filter avoids creating intermediate stream objects. For most cases, readability wins. The JVM's loop fusion optimization minimizes the performance difference.

---

## 4.4 distinct()

### What It Does

Returns a stream with duplicate elements removed. Uses `equals()` and `hashCode()` to determine uniqueness.

### Method Signature

```java
Stream<T> distinct()
```

### When to Use

- Removing duplicate entries from data
- Getting unique values from a collection

### When NOT to Use

- When objects don't properly implement `equals()` and `hashCode()`
- When you need to control which duplicate is kept (use `Collectors.toMap()` with merge function)

### Time Complexity

O(n) on average -- uses a `LinkedHashSet` internally.

### Code Example

```java
// Remove duplicate integers
List<Integer> unique = List.of(1, 2, 2, 3, 3, 3, 4).stream()
    .distinct()
    .collect(Collectors.toList());
// Output: [1, 2, 3, 4]

// Get unique departments
List<String> departments = employees.stream()
    .map(Employee::getDepartment)
    .distinct()
    .sorted()
    .collect(Collectors.toList());
```

> **Interview Question:** *What happens if you call `distinct()` on objects that don't override `equals()` and `hashCode()`?*
> It uses the default `Object.equals()` which compares references (memory addresses). Two different objects with the same field values will NOT be considered duplicates. Always override `equals()` and `hashCode()` for custom objects used with `distinct()`.

---

## 4.5 sorted()

### What It Does

Returns a stream with elements sorted. Can use natural ordering or a custom `Comparator`.

### Method Signature

```java
Stream<T> sorted()                          // Natural ordering (Comparable)
Stream<T> sorted(Comparator<? super T> comparator)  // Custom ordering
```

### When to Use

- Ordering results before returning to the client
- Finding top-N elements (combine with `limit()`)
- Preparing data for display

### When NOT to Use

- On infinite streams (will never terminate!)
- When order doesn't matter (unnecessary processing)
- On parallel streams with large datasets (sorting requires synchronization)

### Time Complexity

O(n log n) -- uses a modified merge sort internally.

### Code Example

```java
// Natural ordering
List<String> sorted = List.of("Charlie", "Alice", "Bob").stream()
    .sorted()
    .collect(Collectors.toList());
// Output: [Alice, Bob, Charlie]

// Custom comparator -- sort by salary descending
List<Employee> topPaid = employees.stream()
    .sorted(Comparator.comparing(Employee::getSalary).reversed())
    .limit(5)
    .collect(Collectors.toList());

// Multi-field sorting
List<Employee> sorted = employees.stream()
    .sorted(Comparator.comparing(Employee::getDepartment)
            .thenComparing(Employee::getSalary).reversed()
            .thenComparing(Employee::getName))
    .collect(Collectors.toList());
```

> **Interview Question:** *Can you sort a stream of custom objects without implementing Comparable?*
> Yes, by passing a Comparator to `sorted()`. E.g., `stream.sorted(Comparator.comparing(Employee::getSalary))`. If you use `sorted()` without arguments on objects that don't implement Comparable, you'll get a `ClassCastException`.

---

## 4.6 peek()

### What It Does

Performs an action on each element as it passes through the pipeline, **without modifying the stream**. Primarily used for debugging.

### Method Signature

```java
Stream<T> peek(Consumer<? super T> action)
```

### When to Use

- Debugging stream pipelines (logging element values)
- Adding diagnostic logging in production (sparingly)

### When NOT to Use

- As a replacement for `forEach()` (it's an intermediate operation, not terminal)
- To modify elements (violates the functional contract)
- In production code for business logic (side effects in a pipeline make code harder to reason about)

### Code Example

```java
// Debugging: see what passes through each stage
List<String> result = List.of("one", "two", "three", "four").stream()
    .filter(s -> s.length() > 3)
    .peek(s -> System.out.println("After filter: " + s))
    .map(String::toUpperCase)
    .peek(s -> System.out.println("After map: " + s))
    .collect(Collectors.toList());

// Output:
//   After filter: three
//   After map: THREE
//   After filter: four
//   After map: FOUR
```

> **Interview Question:** *Is `peek()` guaranteed to execute?*
> No! Because streams are lazy, if the terminal operation doesn't consume all elements (e.g., `findFirst()`), `peek()` won't be called for unconsumed elements. Also, the JVM may optimize away `peek()` calls in some scenarios.

---

## 4.7 limit()

### What It Does

Returns a stream containing at most the first `n` elements. If the stream has fewer than `n` elements, all elements are returned.

### Method Signature

```java
Stream<T> limit(long maxSize)
```

### When to Use

- Implementing pagination
- Getting top N results
- Truncating infinite streams

### When NOT to Use

- When you need elements from the middle or end (combine with `skip()`)

### Time Complexity

O(n) in the worst case, but short-circuits -- stops processing after `n` elements.

### Code Example

```java
// Get top 3 highest-paid employees
List<Employee> top3 = employees.stream()
    .sorted(Comparator.comparing(Employee::getSalary).reversed())
    .limit(3)
    .collect(Collectors.toList());

// Truncate infinite stream
List<Integer> first10Squares = Stream.iterate(1, n -> n + 1)
    .map(n -> n * n)
    .limit(10)
    .collect(Collectors.toList());
// Output: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
```

---

## 4.8 skip()

### What It Does

Returns a stream that skips the first `n` elements. If the stream has fewer than `n` elements, an empty stream is returned.

### Method Signature

```java
Stream<T> skip(long n)
```

### When to Use

- Implementing pagination (combine with `limit()`)
- Skipping header rows in file processing

### When NOT to Use

- With unordered parallel streams (elements skipped are unpredictable)

### Code Example

```java
// Pagination: Page 3, 10 items per page
int page = 3, size = 10;
List<Employee> page3 = employees.stream()
    .skip((long)(page - 1) * size)  // Skip first 20
    .limit(size)                     // Take next 10
    .collect(Collectors.toList());

// Skip header row in CSV processing
try (Stream<String> lines = Files.lines(Paths.get("data.csv"))) {
    List<String[]> data = lines
        .skip(1)  // Skip header row
        .map(line -> line.split(","))
        .collect(Collectors.toList());
}
```

### Intermediate Operations Summary Table

| Operation | Purpose | Returns | Stateful? | Short-circuits? |
|---|---|---|---|---|
| `map()` | Transform elements | `Stream<R>` | No | No |
| `flatMap()` | Transform & flatten | `Stream<R>` | No | No |
| `filter()` | Keep matching elements | `Stream<T>` | No | No |
| `distinct()` | Remove duplicates | `Stream<T>` | Yes | No |
| `sorted()` | Sort elements | `Stream<T>` | Yes | No |
| `peek()` | Debug/inspect | `Stream<T>` | No | No |
| `limit()` | Truncate stream | `Stream<T>` | Yes | Yes |
| `skip()` | Skip first N | `Stream<T>` | Yes | No |

> **Stateful** operations need to see all elements before producing output (like sorting requires all elements). **Stateless** operations process each element independently.

---

# Part 5: All Terminal Stream Operations

> **Key Rule:** Terminal operations trigger the execution of the entire stream pipeline. After a terminal operation, the stream is consumed and cannot be reused.

## 5.1 forEach()

### Syntax & How It Works

```java
void forEach(Consumer<? super T> action)
```

Performs an action on each element. It does NOT return a value. **Order is not guaranteed** in parallel streams.

### Use Cases

```java
// Print all elements
employees.stream()
    .forEach(e -> System.out.println(e.getName()));

// Using method reference
employees.stream().forEach(System.out::println);

// Sending notifications to each user
activeUsers.stream()
    .filter(User::isSubscribed)
    .forEach(user -> notificationService.send(user, message));
```

### Performance Notes

- `forEach()` is a terminal operation -- it triggers pipeline execution
- For parallel streams, use `forEachOrdered()` if order matters
- Avoid using `forEach()` to add elements to external collections (use `collect()` instead)

### forEachOrdered() for Parallel Streams

```java
// forEach on parallel stream -- order NOT guaranteed
List.of(1, 2, 3, 4, 5).parallelStream()
    .forEach(System.out::print);       // Output: 35214 (random order)

// forEachOrdered on parallel stream -- order IS guaranteed
List.of(1, 2, 3, 4, 5).parallelStream()
    .forEachOrdered(System.out::print); // Output: 12345 (encounter order)
```

## 5.2 collect()

### Syntax & How It Works

```java
<R, A> R collect(Collector<? super T, A, R> collector)
<R> R collect(Supplier<R> supplier, BiConsumer<R, ? super T> accumulator, BiConsumer<R, R> combiner)
```

The most versatile terminal operation. Transforms stream elements into a different form -- typically a collection, string, or aggregated value. Uses the **Mutable Reduction** pattern.

### Use Cases

```java
// Collect to List
List<String> names = stream.collect(Collectors.toList());

// Collect to Set (removes duplicates)
Set<String> uniqueNames = stream.collect(Collectors.toSet());

// Collect to Map
Map<Long, String> idToName = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Employee::getName));

// Collect to String
String csv = names.stream().collect(Collectors.joining(", "));
```

> See **Part 6: Collectors Deep Dive** for comprehensive `collect()` patterns.

## 5.3 reduce()

### Syntax & How It Works

```java
// Variant 1: With identity
T reduce(T identity, BinaryOperator<T> accumulator)

// Variant 2: Without identity (returns Optional)
Optional<T> reduce(BinaryOperator<T> accumulator)

// Variant 3: With identity, accumulator, and combiner (for parallel)
<U> U reduce(U identity, BiFunction<U, ? super T, U> accumulator, BinaryOperator<U> combiner)
```

Combines all elements into a single result by repeatedly applying a binary operation.

### How It Works Internally

```
reduce(0, (a, b) -> a + b)  on  [1, 2, 3, 4]

Step 1: result = 0 (identity)
Step 2: result = 0 + 1 = 1
Step 3: result = 1 + 2 = 3
Step 4: result = 3 + 3 = 6
Step 5: result = 6 + 4 = 10
Final:  10
```

### Use Cases

```java
// Sum of numbers
int sum = List.of(1, 2, 3, 4, 5).stream()
    .reduce(0, Integer::sum);           // 15

// Without identity -- returns Optional (handles empty stream)
Optional<Integer> sum = List.of(1, 2, 3).stream()
    .reduce(Integer::sum);              // Optional[6]

// Find maximum salary
Optional<Integer> maxSalary = employees.stream()
    .map(Employee::getSalary)
    .reduce(Integer::max);

// Concatenate strings
String combined = List.of("Hello", " ", "World").stream()
    .reduce("", String::concat);        // "Hello World"

// Complex reduction: Total revenue
BigDecimal totalRevenue = orders.stream()
    .map(Order::getAmount)
    .reduce(BigDecimal.ZERO, BigDecimal::add);
```

> **Interview Question:** *Difference between `reduce()` and `collect()`?*
> `reduce()` produces an **immutable** result by combining elements (good for sum, min, max, string concat). `collect()` produces a **mutable** result container (good for building collections, StringBuilder). Use `collect()` for mutable reductions (lists, maps) and `reduce()` for value computations.

## 5.4 count()

### Syntax & How It Works

```java
long count()
```

Returns the number of elements in the stream. This is a terminal operation.

```java
long total = employees.stream().count();

long activeCount = employees.stream()
    .filter(Employee::isActive)
    .count();

// Counting unique departments
long deptCount = employees.stream()
    .map(Employee::getDepartment)
    .distinct()
    .count();
```

### Performance Notes

For simple counts on collections, `collection.size()` is O(1) and more efficient than `stream().count()`.

## 5.5 min() and max()

### Syntax & How It Works

```java
Optional<T> min(Comparator<? super T> comparator)
Optional<T> max(Comparator<? super T> comparator)
```

Returns the minimum or maximum element according to the provided comparator. Returns `Optional.empty()` if the stream is empty.

```java
// Find youngest employee
Optional<Employee> youngest = employees.stream()
    .min(Comparator.comparing(Employee::getAge));

// Find highest salary
Optional<Integer> maxSalary = employees.stream()
    .map(Employee::getSalary)
    .max(Comparator.naturalOrder());

// Find longest string
Optional<String> longest = List.of("Java", "Streams", "API").stream()
    .max(Comparator.comparingInt(String::length));
// Output: Optional[Streams]
```

## 5.6 findFirst() and findAny()

### Syntax & How It Works

```java
Optional<T> findFirst()   // Returns first element in encounter order
Optional<T> findAny()     // Returns any element (optimized for parallel)
```

Both are **short-circuiting** terminal operations -- they don't need to process the entire stream.

```java
// Find first employee with salary > 100000
Optional<Employee> first = employees.stream()
    .filter(e -> e.getSalary() > 100000)
    .findFirst();

// findAny is better for parallel streams
Optional<Employee> any = employees.parallelStream()
    .filter(e -> e.getSalary() > 100000)
    .findAny();

// Using with orElse
String name = employees.stream()
    .filter(e -> e.getDepartment().equals("Engineering"))
    .map(Employee::getName)
    .findFirst()
    .orElse("Not Found");
```

> **Interview Question:** *When would you use `findAny()` over `findFirst()`?*
> In parallel streams, `findFirst()` is constrained to return the first element in encounter order, which reduces parallelism. `findAny()` can return whichever element is found first by any thread, providing better parallel performance. In sequential streams, both behave identically.

## 5.7 anyMatch(), allMatch(), noneMatch()

### Syntax & How It Works

```java
boolean anyMatch(Predicate<? super T> predicate)   // true if ANY element matches
boolean allMatch(Predicate<? super T> predicate)    // true if ALL elements match
boolean noneMatch(Predicate<? super T> predicate)   // true if NO elements match
```

All three are **short-circuiting** -- they return as soon as the answer is determined.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);

boolean hasEven = numbers.stream().anyMatch(n -> n % 2 == 0);     // true
boolean allPositive = numbers.stream().allMatch(n -> n > 0);       // true
boolean noneNegative = numbers.stream().noneMatch(n -> n < 0);     // true

// Real-world: Check if any order is overdue
boolean hasOverdue = orders.stream()
    .anyMatch(order -> order.getDueDate().isBefore(LocalDate.now())
                    && order.getStatus() != OrderStatus.COMPLETED);

// Check if all employees have valid email
boolean allValid = employees.stream()
    .allMatch(e -> e.getEmail() != null && e.getEmail().contains("@"));
```

### Short-Circuit Behavior

```
anyMatch: stops at FIRST true  -> [false, false, TRUE, ...] -> stops at 3rd element
allMatch: stops at FIRST false -> [true, true, FALSE, ...] -> stops at 3rd element  
noneMatch: stops at FIRST true -> [false, false, TRUE, ...] -> stops at 3rd element
```

## 5.8 toArray()

### Syntax & How It Works

```java
Object[] toArray()                              // Returns Object[]
<A> A[] toArray(IntFunction<A[]> generator)     // Returns typed array
```

Converts stream elements to an array.

```java
// To Object array
Object[] arr = List.of("A", "B", "C").stream().toArray();

// To typed array (preferred)
String[] names = employees.stream()
    .map(Employee::getName)
    .toArray(String[]::new);

// To int array
int[] numbers = IntStream.rangeClosed(1, 10).toArray();
```

### Terminal Operations Summary Table

| Operation | Returns | Short-Circuit? | Purpose |
|---|---|---|---|
| `forEach()` | `void` | No | Side effects (print, send, save) |
| `collect()` | `R` | No | Accumulate into collection/result |
| `reduce()` | `T` / `Optional<T>` | No | Combine elements into single value |
| `count()` | `long` | No | Count elements |
| `min()` | `Optional<T>` | No | Find minimum element |
| `max()` | `Optional<T>` | No | Find maximum element |
| `findFirst()` | `Optional<T>` | Yes | Find first matching element |
| `findAny()` | `Optional<T>` | Yes | Find any matching element |
| `anyMatch()` | `boolean` | Yes | Check if any element matches |
| `allMatch()` | `boolean` | Yes | Check if all elements match |
| `noneMatch()` | `boolean` | Yes | Check if no elements match |
| `toArray()` | `T[]` | No | Convert to array |

---
