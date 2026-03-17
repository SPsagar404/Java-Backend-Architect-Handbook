# Part 6: Collectors Deep Dive

## 6.1 Collectors.toList()

Collects stream elements into a `List`. The most commonly used collector.

```java
List<String> names = employees.stream()
    .map(Employee::getName)
    .collect(Collectors.toList());

// Java 16+: Shorthand using Stream.toList() -- returns unmodifiable list
List<String> names = employees.stream()
    .map(Employee::getName)
    .toList();
```

## 6.2 Collectors.toSet()

Collects into a `Set`, automatically removing duplicates.

```java
Set<String> departments = employees.stream()
    .map(Employee::getDepartment)
    .collect(Collectors.toSet());
// Duplicates removed automatically
```

## 6.3 Collectors.toMap()

Collects into a `Map` with key and value mapping functions.

```java
// Basic: Employee ID -> Employee Name
Map<Long, String> idToName = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Employee::getName));

// With value being the object itself
Map<Long, Employee> idToEmployee = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Function.identity()));

// Handle duplicate keys with merge function
Map<String, Integer> deptToMaxSalary = employees.stream()
    .collect(Collectors.toMap(
        Employee::getDepartment,
        Employee::getSalary,
        Integer::max  // If duplicate key, keep the higher salary
    ));

// Specify map implementation
Map<String, Employee> sortedMap = employees.stream()
    .collect(Collectors.toMap(
        Employee::getName,
        Function.identity(),
        (e1, e2) -> e1,      // Merge function for duplicates
        TreeMap::new           // Use TreeMap for sorted keys
    ));
```

> **Interview Tip:** Without a merge function, `toMap()` throws `IllegalStateException` if duplicate keys exist. Always provide a merge function when keys might not be unique.

## 6.4 Collectors.groupingBy()

Groups elements by a classifier function. Returns a `Map<K, List<T>>`.

```java
// Group employees by department
Map<String, List<Employee>> byDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment));
// Output: {IT=[emp1, emp2], HR=[emp3], Finance=[emp4, emp5]}

// Group by department and count
Map<String, Long> deptCount = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.counting()
    ));
// Output: {IT=2, HR=1, Finance=2}

// Group by department and get average salary
Map<String, Double> avgSalaryByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.averagingDouble(Employee::getSalary)
    ));

// Group by department, then get names
Map<String, List<String>> namesByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.mapping(Employee::getName, Collectors.toList())
    ));

// Multi-level grouping: Department -> City -> List<Employee>
Map<String, Map<String, List<Employee>>> multiLevel = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.groupingBy(Employee::getCity)
    ));

// Group by department and find max salary employee
Map<String, Optional<Employee>> highestPaid = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.maxBy(Comparator.comparing(Employee::getSalary))
    ));
```

### Real-World Example: Analytics Dashboard

```java
// Group orders by status and calculate total amounts
Map<OrderStatus, BigDecimal> revenueByStatus = orders.stream()
    .collect(Collectors.groupingBy(
        Order::getStatus,
        Collectors.reducing(
            BigDecimal.ZERO,
            Order::getAmount,
            BigDecimal::add
        )
    ));
```

## 6.5 Collectors.partitioningBy()

Splits elements into two groups based on a predicate. Returns `Map<Boolean, List<T>>`.

```java
// Partition employees by salary threshold
Map<Boolean, List<Employee>> partitioned = employees.stream()
    .collect(Collectors.partitioningBy(e -> e.getSalary() > 50000));

List<Employee> highPaid = partitioned.get(true);   // Salary > 50000
List<Employee> lowPaid = partitioned.get(false);    // Salary <= 50000

// Partition with downstream collector
Map<Boolean, Long> counts = employees.stream()
    .collect(Collectors.partitioningBy(
        e -> e.getSalary() > 50000,
        Collectors.counting()
    ));

// Partition even/odd numbers
Map<Boolean, List<Integer>> evenOdd = numbers.stream()
    .collect(Collectors.partitioningBy(n -> n % 2 == 0));
```

> **Interview Tip:** `partitioningBy()` always returns a map with both `true` and `false` keys (even if one group is empty). `groupingBy()` only includes keys that have at least one element.

## 6.6 Collectors.joining()

Concatenates stream elements into a single `String`.

```java
// Simple join
String names = List.of("Alice", "Bob", "Charlie").stream()
    .collect(Collectors.joining());
// Output: "AliceBobCharlie"

// Join with delimiter
String csv = List.of("Alice", "Bob", "Charlie").stream()
    .collect(Collectors.joining(", "));
// Output: "Alice, Bob, Charlie"

// Join with delimiter, prefix, and suffix
String json = List.of("Alice", "Bob", "Charlie").stream()
    .collect(Collectors.joining("\", \"", "[\"", "\"]"));
// Output: ["Alice", "Bob", "Charlie"]

// Real-world: Build SQL IN clause
String inClause = ids.stream()
    .map(String::valueOf)
    .collect(Collectors.joining(", ", "SELECT * FROM users WHERE id IN (", ")"));
```

## 6.7 Collectors.summarizingInt() / summarizingDouble() / summarizingLong()

Provides summary statistics (count, sum, min, max, average) in one pass.

```java
IntSummaryStatistics stats = employees.stream()
    .collect(Collectors.summarizingInt(Employee::getSalary));

System.out.println("Count:   " + stats.getCount());    // 5
System.out.println("Sum:     " + stats.getSum());       // 275000
System.out.println("Min:     " + stats.getMin());       // 35000
System.out.println("Max:     " + stats.getMax());       // 85000
System.out.println("Average: " + stats.getAverage());   // 55000.0

// For double values
DoubleSummaryStatistics doubleStats = products.stream()
    .collect(Collectors.summarizingDouble(Product::getPrice));
```

## 6.8 Collectors.mapping()

Adapts a collector to accept elements of a different type by applying a mapping function first.

```java
// Get names grouped by department
Map<String, List<String>> namesByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.mapping(Employee::getName, Collectors.toList())
    ));

// Get comma-separated names by department
Map<String, String> nameStringByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.mapping(
            Employee::getName,
            Collectors.joining(", ")
        )
    ));
```

### Collectors Summary Table

| Collector | Returns | Purpose |
|---|---|---|
| `toList()` | `List<T>` | Collect to list |
| `toSet()` | `Set<T>` | Collect to set (unique elements) |
| `toMap()` | `Map<K,V>` | Collect to key-value map |
| `groupingBy()` | `Map<K, List<T>>` | Group elements by classifier |
| `partitioningBy()` | `Map<Boolean, List<T>>` | Split into two groups |
| `joining()` | `String` | Concatenate elements |
| `summarizingInt()` | `IntSummaryStatistics` | Compute statistics |
| `mapping()` | Depends on downstream | Transform before collecting |
| `counting()` | `Long` | Count elements in group |
| `reducing()` | `T` / `Optional<T>` | Custom reduction |

---

# Part 7: Functional Interfaces (Complete Guide)

> A **Functional Interface** is an interface with exactly ONE abstract method. It can have multiple default and static methods. The `@FunctionalInterface` annotation is optional but recommended.

## 7.1 Predicate<T>

### Definition and Method Signature

```java
@FunctionalInterface
public interface Predicate<T> {
    boolean test(T t);

    // Default methods
    default Predicate<T> and(Predicate<? super T> other);
    default Predicate<T> or(Predicate<? super T> other);
    default Predicate<T> negate();

    // Static method
    static <T> Predicate<T> isEqual(Object targetRef);
}
```

### Where It Is Used

- `Stream.filter(Predicate)`
- `Collection.removeIf(Predicate)`
- `Optional.filter(Predicate)`

### Real Examples

```java
// Simple predicate
Predicate<Integer> isPositive = n -> n > 0;
Predicate<String> isNotEmpty = s -> s != null && !s.isEmpty();

// Combining predicates
Predicate<Employee> isHighPaid = e -> e.getSalary() > 80000;
Predicate<Employee> isIT = e -> "IT".equals(e.getDepartment());
Predicate<Employee> isHighPaidIT = isHighPaid.and(isIT);

// Using in stream
employees.stream()
    .filter(isHighPaidIT)
    .collect(Collectors.toList());

// Negation
Predicate<Employee> isNotIT = isIT.negate();
```

> **Interview Question:** *How do you compose multiple Predicates?*
> Use `.and()`, `.or()`, and `.negate()` for logical AND, OR, and NOT operations. E.g., `predicate1.and(predicate2).or(predicate3)`.

## 7.2 Function<T, R>

### Definition and Method Signature

```java
@FunctionalInterface
public interface Function<T, R> {
    R apply(T t);

    default <V> Function<V, R> compose(Function<? super V, ? extends T> before);
    default <V> Function<T, V> andThen(Function<? super R, ? extends V> after);
    static <T> Function<T, T> identity();
}
```

### Where It Is Used

- `Stream.map(Function)`
- `Map.computeIfAbsent(key, Function)`
- `Optional.map(Function)`

### Real Examples

```java
// Transform Employee to DTO
Function<Employee, EmployeeDTO> toDTO = emp -> new EmployeeDTO(
    emp.getId(), emp.getName(), emp.getSalary()
);

// Function composition
Function<String, String> trim = String::trim;
Function<String, String> upperCase = String::toUpperCase;
Function<String, String> trimAndUpper = trim.andThen(upperCase);

String result = trimAndUpper.apply("  hello  ");  // "HELLO"

// Using identity
Map<Long, Employee> map = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Function.identity()));
```

> **Interview Question:** *What does `Function.identity()` do?*
> Returns a function that always returns its input argument unchanged. `Function.identity()` is equivalent to `t -> t`. It's used when you need to pass the element itself as a value (e.g., in `toMap()`).

## 7.3 Consumer<T>

### Definition and Method Signature

```java
@FunctionalInterface
public interface Consumer<T> {
    void accept(T t);

    default Consumer<T> andThen(Consumer<? super T> after);
}
```

### Where It Is Used

- `Stream.forEach(Consumer)`
- `Stream.peek(Consumer)`
- `Iterable.forEach(Consumer)`
- `Optional.ifPresent(Consumer)`

### Real Examples

```java
Consumer<Employee> printEmployee = e -> System.out.println(e.getName());
Consumer<Employee> saveToDb = e -> employeeRepository.save(e);
Consumer<Employee> sendEmail = e -> emailService.sendWelcome(e.getEmail());

// Chain consumers
Consumer<Employee> onboard = saveToDb.andThen(sendEmail).andThen(printEmployee);

// Apply to each new employee
newEmployees.forEach(onboard);
```

## 7.4 Supplier<T>

### Definition and Method Signature

```java
@FunctionalInterface
public interface Supplier<T> {
    T get();
}
```

### Where It Is Used

- `Stream.generate(Supplier)`
- `Optional.orElseGet(Supplier)`
- `Objects.requireNonNull(obj, Supplier<String>)`
- Factory patterns

### Real Examples

```java
// Lazy initialization
Supplier<Connection> connectionSupplier = () -> dataSource.getConnection();
Supplier<LocalDateTime> now = LocalDateTime::now;
Supplier<UUID> idGenerator = UUID::randomUUID;

// Used with Optional (lazy evaluation)
Optional<Employee> emp = findById(id);
Employee result = emp.orElseGet(() -> createDefaultEmployee());
// The default employee is only created if emp is empty

// Stream generation
List<String> ids = Stream.generate(() -> UUID.randomUUID().toString())
    .limit(100)
    .collect(Collectors.toList());
```

> **Interview Question:** *What's the difference between `orElse()` and `orElseGet()`?*
> `orElse(value)` always evaluates the argument (even if Optional has a value). `orElseGet(Supplier)` only evaluates the Supplier if the Optional is empty. Use `orElseGet()` when the default value is expensive to create.

## 7.5 UnaryOperator<T>

### Definition and Method Signature

```java
@FunctionalInterface
public interface UnaryOperator<T> extends Function<T, T> {
    // Inherits apply(T t) from Function
    static <T> UnaryOperator<T> identity();
}
```

A specialized `Function` where input and output types are the same.

### Real Examples

```java
UnaryOperator<String> toUpper = String::toUpperCase;
UnaryOperator<Integer> doubleIt = n -> n * 2;

// Used in Stream.iterate
Stream.iterate(1, n -> n * 2)  // UnaryOperator<Integer>
    .limit(10)
    .forEach(System.out::println);

// List.replaceAll
List<String> names = new ArrayList<>(Arrays.asList("alice", "bob"));
names.replaceAll(String::toUpperCase);  // ["ALICE", "BOB"]
```

## 7.6 BinaryOperator<T>

### Definition and Method Signature

```java
@FunctionalInterface
public interface BinaryOperator<T> extends BiFunction<T, T, T> {
    // Inherits apply(T t1, T t2) from BiFunction
    static <T> BinaryOperator<T> minBy(Comparator<? super T> comparator);
    static <T> BinaryOperator<T> maxBy(Comparator<? super T> comparator);
}
```

A specialized `BiFunction` where both inputs and output are the same type.

### Real Examples

```java
BinaryOperator<Integer> sum = Integer::sum;
BinaryOperator<Integer> max = Integer::max;
BinaryOperator<String> concat = String::concat;

// Used in reduce()
int total = numbers.stream().reduce(0, Integer::sum);

// BinaryOperator.maxBy
BinaryOperator<Employee> highestPaid =
    BinaryOperator.maxBy(Comparator.comparing(Employee::getSalary));
```

### Functional Interfaces Summary Table

| Interface | Method | Input | Output | Used In |
|---|---|---|---|---|
| `Predicate<T>` | `test(T)` | T | boolean | filter, removeIf |
| `Function<T,R>` | `apply(T)` | T | R | map, computeIfAbsent |
| `Consumer<T>` | `accept(T)` | T | void | forEach, peek |
| `Supplier<T>` | `get()` | none | T | generate, orElseGet |
| `UnaryOperator<T>` | `apply(T)` | T | T | iterate, replaceAll |
| `BinaryOperator<T>` | `apply(T,T)` | T, T | T | reduce, merge |

### Primitive Specializations

| Generic | int | long | double |
|---|---|---|---|
| `Predicate<T>` | `IntPredicate` | `LongPredicate` | `DoublePredicate` |
| `Function<T,R>` | `IntFunction<R>` | `LongFunction<R>` | `DoubleFunction<R>` |
| `Consumer<T>` | `IntConsumer` | `LongConsumer` | `DoubleConsumer` |
| `Supplier<T>` | `IntSupplier` | `LongSupplier` | `DoubleSupplier` |
| `UnaryOperator<T>` | `IntUnaryOperator` | `LongUnaryOperator` | `DoubleUnaryOperator` |
| `BinaryOperator<T>` | `IntBinaryOperator` | `LongBinaryOperator` | `DoubleBinaryOperator` |

> These primitive specializations avoid autoboxing overhead and should be used when working with primitive types in performance-sensitive code.

---

# Part 8: Method References

## 8.1 What Are Method References?

Method references are shorthand for lambdas that call a single existing method. They make code cleaner and more readable.

```
Lambda Expression              ->  Method Reference
(s) -> s.toUpperCase()         ->  String::toUpperCase
(s) -> System.out.println(s)   ->  System.out::println
(s) -> Integer.parseInt(s)     ->  Integer::parseInt
() -> new ArrayList<>()        ->  ArrayList::new
```

## 8.2 Static Method Reference

### Syntax: `ClassName::staticMethod`

```java
// Lambda
Function<String, Integer> parse = s -> Integer.parseInt(s);
// Method reference
Function<String, Integer> parse = Integer::parseInt;

// In streams
List<Integer> numbers = List.of("1", "2", "3").stream()
    .map(Integer::parseInt)
    .collect(Collectors.toList());

// Multiple examples
BinaryOperator<Integer> maxOp = Math::max;
Function<Double, Double> sqrt = Math::sqrt;
```

## 8.3 Instance Method Reference

### Two Forms

**Form 1: `instance::method`** -- Reference to a method of a specific object

```java
PrintStream out = System.out;
Consumer<String> printer = out::println;

employees.stream()
    .map(Employee::getName)
    .forEach(System.out::println);
```

**Form 2: `ClassName::instanceMethod`** -- Reference to an instance method of an arbitrary object

```java
Function<String, String> upper = String::toUpperCase;
Function<String, Integer> length = String::length;

List<String> upperNames = names.stream()
    .map(String::toUpperCase)  // same as: s -> s.toUpperCase()
    .collect(Collectors.toList());

// Comparator using method reference
List<String> sorted = names.stream()
    .sorted(String::compareToIgnoreCase)
    .collect(Collectors.toList());
```

## 8.4 Constructor Reference

### Syntax: `ClassName::new`

```java
// Lambda
Supplier<List<String>> listFactory = () -> new ArrayList<>();
// Constructor reference
Supplier<List<String>> listFactory = ArrayList::new;

// With parameters
Function<String, Employee> empFactory = Employee::new;

// In streams -- creating objects
List<Employee> employees = names.stream()
    .map(Employee::new)               // calls new Employee(name)
    .collect(Collectors.toList());

// Array constructor reference
String[] names = stream.toArray(String[]::new);
```

## 8.5 Method Reference Best Practices

| Guideline | Example |
|---|---|
| Use when lambda calls a single method | `s -> s.length()` -> `String::length` |
| Don't use when lambda has additional logic | Keep `s -> s.length() > 5` as lambda |
| Prefer method references for readability | `Employee::getName` over `e -> e.getName()` |
| Use constructor references for factories | `ArrayList::new` over `() -> new ArrayList<>()` |

### Method Reference Types Summary

| Type | Syntax | Lambda Equivalent | Example |
|---|---|---|---|
| Static method | `ClassName::method` | `(args) -> ClassName.method(args)` | `Integer::parseInt` |
| Instance (bound) | `instance::method` | `(args) -> instance.method(args)` | `System.out::println` |
| Instance (unbound) | `ClassName::method` | `(obj, args) -> obj.method(args)` | `String::toUpperCase` |
| Constructor | `ClassName::new` | `(args) -> new ClassName(args)` | `ArrayList::new` |

---
