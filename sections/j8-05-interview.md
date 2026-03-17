# Part 12: 50+ Coding Interview Problems Using Streams

## Easy Problems

### Problem 1: Find Duplicate Elements in a List

**Problem:** Given a list of integers, find all duplicate elements.

```java
// Brute Force
public List<Integer> findDuplicatesBrute(List<Integer> list) {
    List<Integer> duplicates = new ArrayList<>();
    Set<Integer> seen = new HashSet<>();
    for (int num : list) {
        if (!seen.add(num)) {
            if (!duplicates.contains(num)) duplicates.add(num);
        }
    }
    return duplicates;
}

// Stream Solution
public List<Integer> findDuplicatesStream(List<Integer> list) {
    Set<Integer> seen = new HashSet<>();
    return list.stream()
        .filter(n -> !seen.add(n))  // add() returns false if already present
        .distinct()
        .collect(Collectors.toList());
}

// Alternative: Using groupingBy
public List<Integer> findDuplicatesGrouping(List<Integer> list) {
    return list.stream()
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
        .entrySet().stream()
        .filter(e -> e.getValue() > 1)
        .map(Map.Entry::getKey)
        .collect(Collectors.toList());
}
```

### Problem 2: Find First Non-Repeated Character in a String

**Problem:** Given a string, find the first character that does not repeat.

```java
// Brute Force
public Character firstNonRepeatedBrute(String str) {
    Map<Character, Integer> countMap = new LinkedHashMap<>();
    for (char c : str.toCharArray()) {
        countMap.merge(c, 1, Integer::sum);
    }
    for (Map.Entry<Character, Integer> entry : countMap.entrySet()) {
        if (entry.getValue() == 1) return entry.getKey();
    }
    return null;
}

// Stream Solution
public Character firstNonRepeatedStream(String str) {
    return str.chars()
        .mapToObj(c -> (char) c)
        .collect(Collectors.groupingBy(Function.identity(),
            LinkedHashMap::new, Collectors.counting()))
        .entrySet().stream()
        .filter(e -> e.getValue() == 1)
        .map(Map.Entry::getKey)
        .findFirst()
        .orElse(null);
}
```

### Problem 3: Remove Duplicates from a List

**Problem:** Remove duplicate elements from a list while preserving order.

```java
// Stream Solution
List<Integer> unique = list.stream()
    .distinct()
    .collect(Collectors.toList());
```

### Problem 4: Find the Second Highest Number

**Problem:** Find the second largest number in a list.

```java
// Brute Force
public int secondHighestBrute(List<Integer> list) {
    int first = Integer.MIN_VALUE, second = Integer.MIN_VALUE;
    for (int n : list) {
        if (n > first) { second = first; first = n; }
        else if (n > second && n != first) { second = n; }
    }
    return second;
}

// Stream Solution
public Optional<Integer> secondHighestStream(List<Integer> list) {
    return list.stream()
        .distinct()
        .sorted(Comparator.reverseOrder())
        .skip(1)
        .findFirst();
}
```

### Problem 5: Count Occurrences of Each Character

**Problem:** Given a string, count the frequency of each character.

```java
// Stream Solution
public Map<Character, Long> charFrequency(String str) {
    return str.chars()
        .mapToObj(c -> (char) c)
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
}
```

### Problem 6: Find the Longest String in a List

```java
Optional<String> longest = strings.stream()
    .max(Comparator.comparingInt(String::length));
```

### Problem 7: Convert List of Strings to Uppercase

```java
List<String> upper = strings.stream()
    .map(String::toUpperCase)
    .collect(Collectors.toList());
```

### Problem 8: Find Sum of All Even Numbers

```java
int sum = numbers.stream()
    .filter(n -> n % 2 == 0)
    .mapToInt(Integer::intValue)
    .sum();
```

### Problem 9: Check if All Elements are Positive

```java
boolean allPositive = numbers.stream().allMatch(n -> n > 0);
```

### Problem 10: Flatten a List of Lists

```java
List<Integer> flat = listOfLists.stream()
    .flatMap(Collection::stream)
    .collect(Collectors.toList());
```

## Medium Problems

### Problem 11: Group Employees by Department

```java
// Group and get names per department
Map<String, List<String>> namesByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.mapping(Employee::getName, Collectors.toList())
    ));
```

### Problem 12: Sort a Map by Value

```java
Map<String, Integer> sortedByValue = unsortedMap.entrySet().stream()
    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
    .collect(Collectors.toMap(
        Map.Entry::getKey,
        Map.Entry::getValue,
        (e1, e2) -> e1,
        LinkedHashMap::new
    ));
```

### Problem 13: Find Average Salary by Department

```java
Map<String, Double> avgSalary = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.averagingDouble(Employee::getSalary)
    ));
```

### Problem 14: Partition Numbers into Even and Odd

```java
Map<Boolean, List<Integer>> partitioned = numbers.stream()
    .collect(Collectors.partitioningBy(n -> n % 2 == 0));

List<Integer> evens = partitioned.get(true);
List<Integer> odds = partitioned.get(false);
```

### Problem 15: Find Common Elements Between Two Lists

```java
List<Integer> common = list1.stream()
    .filter(list2::contains)
    .distinct()
    .collect(Collectors.toList());

// More efficient with Set
Set<Integer> set2 = new HashSet<>(list2);
List<Integer> common = list1.stream()
    .filter(set2::contains)
    .collect(Collectors.toList());
```

### Problem 16: Convert List to Map (id -> object)

```java
Map<Long, Employee> employeeMap = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Function.identity()));
```

### Problem 17: Find the Most Frequent Element

```java
Optional<Integer> mostFrequent = list.stream()
    .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
    .entrySet().stream()
    .max(Map.Entry.comparingByValue())
    .map(Map.Entry::getKey);
```

### Problem 18: Join List of Strings with Delimiter

```java
String result = List.of("Java", "Streams", "API").stream()
    .collect(Collectors.joining(" - "));
// Output: "Java - Streams - API"
```

### Problem 19: Find Employee with Highest Salary in Each Department

```java
Map<String, Optional<Employee>> highestPaidByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.maxBy(Comparator.comparingDouble(Employee::getSalary))
    ));
```

### Problem 20: Merge Two Maps

```java
Map<String, Integer> merged = Stream.of(map1, map2)
    .flatMap(map -> map.entrySet().stream())
    .collect(Collectors.toMap(
        Map.Entry::getKey,
        Map.Entry::getValue,
        Integer::sum  // Merge function: sum values for duplicate keys
    ));
```

### Problem 21: Find All Palindromes in a List of Strings

```java
List<String> palindromes = strings.stream()
    .filter(s -> s.equals(new StringBuilder(s).reverse().toString()))
    .collect(Collectors.toList());
```

### Problem 22: Create a Frequency Map from a String Array

```java
Map<String, Long> frequency = Arrays.stream(words)
    .collect(Collectors.groupingBy(
        String::toLowerCase,
        Collectors.counting()
    ));
```

### Problem 23: Find Strings Starting with a Specific Letter

```java
List<String> startsWithA = strings.stream()
    .filter(s -> s.startsWith("A"))
    .collect(Collectors.toList());
```

### Problem 24: Find Numbers at Even Indices

```java
List<Integer> evenIndexed = IntStream.range(0, list.size())
    .filter(i -> i % 2 == 0)
    .mapToObj(list::get)
    .collect(Collectors.toList());
```

### Problem 25: Calculate Product of All Elements

```java
int product = numbers.stream()
    .reduce(1, (a, b) -> a * b);
```

### Problem 26: Find Nth Highest Salary

```java
public Optional<Double> nthHighestSalary(List<Employee> employees, int n) {
    return employees.stream()
        .map(Employee::getSalary)
        .distinct()
        .sorted(Comparator.reverseOrder())
        .skip(n - 1)
        .findFirst();
}
```

### Problem 27: Reverse Each Word in a Sentence

```java
String reversed = Arrays.stream(sentence.split(" "))
    .map(word -> new StringBuilder(word).reverse().toString())
    .collect(Collectors.joining(" "));
```

### Problem 28: Find Employees Who Joined in a Specific Year

```java
List<Employee> joined2024 = employees.stream()
    .filter(e -> e.getJoiningDate().getYear() == 2024)
    .sorted(Comparator.comparing(Employee::getJoiningDate))
    .collect(Collectors.toList());
```

### Problem 29: Sum Salary by Department

```java
Map<String, Double> deptSalary = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.summingDouble(Employee::getSalary)
    ));
```

### Problem 30: Find the Kth Smallest Element

```java
public Optional<Integer> kthSmallest(List<Integer> list, int k) {
    return list.stream()
        .distinct()
        .sorted()
        .skip(k - 1)
        .findFirst();
}
```

## Hard Problems

### Problem 31: Find All Pairs That Sum to a Target

```java
public List<int[]> findPairsWithSum(List<Integer> list, int target) {
    Set<Integer> seen = new HashSet<>();
    return list.stream()
        .filter(n -> {
            boolean hasPair = seen.contains(target - n);
            seen.add(n);
            return hasPair;
        })
        .map(n -> new int[]{target - n, n})
        .collect(Collectors.toList());
}
```

### Problem 32: Flatten Deeply Nested List

```java
// Recursive flattening using streams
public <T> Stream<T> flatten(List<?> list) {
    return list.stream()
        .flatMap(item -> item instanceof List
            ? flatten((List<?>) item)
            : Stream.of((T) item));
}

// Usage
List<Integer> flat = flatten(deeplyNested).collect(Collectors.toList());
```

### Problem 33: Group Anagrams Together

```java
Map<String, List<String>> anagrams = words.stream()
    .collect(Collectors.groupingBy(word -> {
        char[] chars = word.toLowerCase().toCharArray();
        Arrays.sort(chars);
        return new String(chars);
    }));
// Input:  ["eat", "tea", "tan", "ate", "nat", "bat"]
// Output: {aet=[eat, tea, ate], ant=[tan, nat], abt=[bat]}
```

### Problem 34: Longest Consecutive Sequence

```java
public int longestConsecutive(List<Integer> nums) {
    Set<Integer> set = new HashSet<>(nums);
    return set.stream()
        .filter(n -> !set.contains(n - 1))  // Start of a sequence
        .mapToInt(n -> {
            int count = 0;
            while (set.contains(n + count)) count++;
            return count;
        })
        .max()
        .orElse(0);
}
```

### Problem 35: Top N Salaries Across All Departments

```java
Map<String, List<Employee>> topNByDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment))
    .entrySet().stream()
    .collect(Collectors.toMap(
        Map.Entry::getKey,
        e -> e.getValue().stream()
            .sorted(Comparator.comparingDouble(Employee::getSalary).reversed())
            .limit(3)
            .collect(Collectors.toList())
    ));
```

### Problem 36: Find the Intersection of Multiple Lists

```java
public <T> List<T> intersection(List<List<T>> lists) {
    return lists.stream()
        .map(HashSet::new)
        .reduce((set1, set2) -> {
            set1.retainAll(set2);
            return set1;
        })
        .map(ArrayList::new)
        .orElse(new ArrayList<>());
}
```

### Problem 37: Matrix Transposition Using Streams

```java
int[][] matrix = {{1,2,3},{4,5,6},{7,8,9}};
int[][] transposed = IntStream.range(0, matrix[0].length)
    .mapToObj(col -> IntStream.range(0, matrix.length)
        .map(row -> matrix[row][col])
        .toArray())
    .toArray(int[][]::new);
```

### Problem 38: Generate Fibonacci Series Using Streams

```java
List<Long> fibonacci = Stream.iterate(new long[]{0, 1}, f -> new long[]{f[1], f[0] + f[1]})
    .limit(20)
    .map(f -> f[0])
    .collect(Collectors.toList());
// Output: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, ...]
```

### Problem 39: Word Count from File

```java
public Map<String, Long> wordCount(String filePath) throws IOException {
    try (Stream<String> lines = Files.lines(Paths.get(filePath))) {
        return lines
            .flatMap(line -> Arrays.stream(line.split("\\W+")))
            .filter(word -> !word.isEmpty())
            .map(String::toLowerCase)
            .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
    }
}
```

### Problem 40: Find Employees with Duplicate Names

```java
List<String> duplicateNames = employees.stream()
    .collect(Collectors.groupingBy(Employee::getName, Collectors.counting()))
    .entrySet().stream()
    .filter(e -> e.getValue() > 1)
    .map(Map.Entry::getKey)
    .collect(Collectors.toList());
```

### Problem 41: Custom Collector - Collect to ImmutableList

```java
public static <T> Collector<T, ?, List<T>> toImmutableList() {
    return Collectors.collectingAndThen(
        Collectors.toList(),
        Collections::unmodifiableList
    );
}

List<String> immutable = names.stream()
    .filter(n -> n.length() > 3)
    .collect(toImmutableList());
```

### Problem 42: Sliding Window Average

```java
public List<Double> slidingWindowAverage(List<Integer> list, int windowSize) {
    return IntStream.rangeClosed(0, list.size() - windowSize)
        .mapToObj(i -> list.subList(i, i + windowSize).stream()
            .mapToInt(Integer::intValue)
            .average()
            .orElse(0.0))
        .collect(Collectors.toList());
}
```

### Problem 43: Find All Substrings of Length N

```java
List<String> substrings = IntStream.rangeClosed(0, str.length() - n)
    .mapToObj(i -> str.substring(i, i + n))
    .distinct()
    .collect(Collectors.toList());
```

### Problem 44: Zip Two Lists Together

```java
public <A, B> List<Map.Entry<A, B>> zip(List<A> list1, List<B> list2) {
    return IntStream.range(0, Math.min(list1.size(), list2.size()))
        .mapToObj(i -> Map.entry(list1.get(i), list2.get(i)))
        .collect(Collectors.toList());
}
```

### Problem 45: Running Total (Cumulative Sum)

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);
List<Integer> runningTotal = new ArrayList<>();
numbers.stream().reduce(0, (sum, n) -> {
    int newSum = sum + n;
    runningTotal.add(newSum);
    return newSum;
});
// Output: [1, 3, 6, 10, 15]
```

### Problem 46: Find the Longest Common Prefix

```java
public String longestCommonPrefix(List<String> strings) {
    return strings.stream()
        .reduce((s1, s2) -> {
            int minLen = Math.min(s1.length(), s2.length());
            int i = 0;
            while (i < minLen && s1.charAt(i) == s2.charAt(i)) i++;
            return s1.substring(0, i);
        })
        .orElse("");
}
```

### Problem 47: Convert Nested Map to Flat Map

```java
Map<String, Map<String, Integer>> nested = // ...
Map<String, Integer> flat = nested.entrySet().stream()
    .flatMap(outer -> outer.getValue().entrySet().stream()
        .map(inner -> Map.entry(
            outer.getKey() + "." + inner.getKey(),
            inner.getValue()
        )))
    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
```

### Problem 48: Prime Number Check and Filtering

```java
Predicate<Integer> isPrime = n -> n > 1 &&
    IntStream.rangeClosed(2, (int) Math.sqrt(n))
        .noneMatch(i -> n % i == 0);

List<Integer> primes = IntStream.rangeClosed(2, 100)
    .filter(n -> isPrime.test(n))
    .boxed()
    .collect(Collectors.toList());
```

### Problem 49: Cartesian Product of Two Lists

```java
List<String> cartesian = list1.stream()
    .flatMap(a -> list2.stream().map(b -> a + "-" + b))
    .collect(Collectors.toList());
// [1,2] x [A,B] -> [1-A, 1-B, 2-A, 2-B]
```

### Problem 50: Complex Employee Report

```java
// Generate a report: Department -> {average salary, employee count, names}
Map<String, Map<String, Object>> report = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment))
    .entrySet().stream()
    .collect(Collectors.toMap(
        Map.Entry::getKey,
        e -> {
            List<Employee> deptEmps = e.getValue();
            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("count", deptEmps.size());
            stats.put("avgSalary", deptEmps.stream()
                .mapToDouble(Employee::getSalary).average().orElse(0));
            stats.put("maxSalary", deptEmps.stream()
                .mapToDouble(Employee::getSalary).max().orElse(0));
            stats.put("employees", deptEmps.stream()
                .map(Employee::getName).collect(Collectors.joining(", ")));
            return stats;
        }
    ));
```

### Problem 51: Find Missing Numbers in a Range

```java
Set<Integer> existing = new HashSet<>(list);
List<Integer> missing = IntStream.rangeClosed(1, 100)
    .filter(n -> !existing.contains(n))
    .boxed()
    .collect(Collectors.toList());
```

### Problem 52: Character with Maximum Occurrences

```java
Optional<Map.Entry<Character, Long>> maxChar = str.chars()
    .mapToObj(c -> (char) c)
    .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
    .entrySet().stream()
    .max(Map.Entry.comparingByValue());
```

---

# Part 13: Stream Best Practices

## 13.1 When NOT to Use Streams

```
DO NOT use streams when:
  1. Simple operations -- a for loop is clearer for simple iterations
  2. Performance-critical code -- streams add overhead for small datasets
  3. You need index-based access -- streams don't support indexing
  4. You need to modify the source -- streams are for read-only processing
  5. Complex stateful operations -- state management in streams leads to bugs
  6. Exception handling is required -- checked exceptions in lambdas are messy
```

### Example: When a For Loop is Better

```java
// Stream -- overcomplicated for this simple case
boolean found = list.stream().anyMatch(item -> item.equals(target));

// Simple contains -- clearer
boolean found = list.contains(target);

// Stream -- poor for indexed operations
IntStream.range(0, list.size())
    .forEach(i -> list.set(i, list.get(i) * 2));

// For loop -- clearer and more natural
for (int i = 0; i < list.size(); i++) {
    list.set(i, list.get(i) * 2);
}
```

## 13.2 Readability Considerations

```java
// BAD: Dense, unreadable stream
var r = emps.stream().filter(e->e.getS()>50000&&e.getD().equals("IT")).map(e->e.getN()).sorted().limit(5).collect(Collectors.toList());

// GOOD: Well-formatted, readable stream
List<String> topITEmployees = employees.stream()
    .filter(emp -> emp.getSalary() > 50000)
    .filter(emp -> "IT".equals(emp.getDepartment()))
    .map(Employee::getName)
    .sorted()
    .limit(5)
    .collect(Collectors.toList());

// GOOD: Extract complex predicates
Predicate<Employee> isHighPaidIT = emp ->
    emp.getSalary() > 50000 && "IT".equals(emp.getDepartment());

List<String> topITEmployees = employees.stream()
    .filter(isHighPaidIT)
    .map(Employee::getName)
    .sorted()
    .limit(5)
    .collect(Collectors.toList());
```

## 13.3 Performance Pitfalls

| Pitfall | Problem | Solution |
|---|---|---|
| Unnecessary boxing | `Stream<Integer>` instead of `IntStream` | Use `mapToInt()`, `IntStream.range()` |
| Sorting before filtering | Sorts entire dataset unnecessarily | Place `filter()` before `sorted()` |
| Using `stream().count()` for size | Creates a stream just to count | Use `collection.size()` |
| `forEach` for accumulation | Not thread-safe, not functional | Use `collect()` |
| Not closing resource streams | Memory/resource leak with `Files.lines()` | Always use try-with-resources |
| Overusing parallel streams | Thread overhead > computation benefit | Only for large CPU-bound work |

## 13.4 Debugging Streams

```java
// Technique 1: Use peek() for logging
List<String> result = employees.stream()
    .peek(e -> log.debug("Before filter: {}", e))
    .filter(e -> e.getSalary() > 50000)
    .peek(e -> log.debug("After filter: {}", e))
    .map(Employee::getName)
    .peek(n -> log.debug("After map: {}", n))
    .collect(Collectors.toList());

// Technique 2: Break pipeline into steps
Stream<Employee> filtered = employees.stream()
    .filter(e -> e.getSalary() > 50000);

Stream<String> mapped = filtered.map(Employee::getName);

List<String> result = mapped.collect(Collectors.toList());

// Technique 3: Use IDE debugger (IntelliJ's Stream Debugger)
// IntelliJ IDEA: Run -> Debug, then click "Trace Current Stream Chain"
```

---

# Part 14: Common Interview Questions

## Q1: What is lazy evaluation in Java Streams?

**Answer:** Lazy evaluation means intermediate operations (like `filter()`, `map()`, `sorted()`) are NOT executed immediately when called. They are only executed when a terminal operation (like `collect()`, `forEach()`, `count()`) is invoked. This allows the stream pipeline to optimize execution -- for example, if `findFirst()` is the terminal operation, the stream stops processing after finding the first matching element rather than processing the entire collection.

## Q2: Difference between `map()` and `flatMap()`?

**Answer:**
- `map()`: One-to-one transformation. Each element maps to exactly one result. `Stream<T>` -> `Stream<R>`.
- `flatMap()`: One-to-many transformation + flattening. Each element maps to a stream of zero or more results, and all resulting streams are merged into one. `Stream<T>` -> `Stream<R>` (flattened).

Example: If you have a list of sentences and want individual words, `map(s -> s.split(" "))` gives `Stream<String[]>`, while `flatMap(s -> Arrays.stream(s.split(" ")))` gives `Stream<String>`.

## Q3: Difference between `findFirst()` and `findAny()`?

**Answer:**
- `findFirst()`: Always returns the first element in encounter order. In parallel streams, it constrains processing to maintain order, reducing parallelism.
- `findAny()`: Returns any element, whichever is found first. In parallel streams, it can return whichever element any thread finds first, providing better performance.
- In sequential streams, both behave identically.

## Q4: Difference between `reduce()` and `collect()`?

**Answer:**
- `reduce()`: Immutable reduction. Combines elements by replacing the accumulator (good for sum, product, concatenation).
- `collect()`: Mutable reduction. Accumulates into a mutable container like `ArrayList`, `StringBuilder`, `HashMap`.
- Use `reduce()` for computing single values. Use `collect()` for building collections or complex results.

## Q5: Difference between `stream()` and `parallelStream()`?

**Answer:**
- `stream()`: Sequential processing. Elements are processed one at a time in a single thread.
- `parallelStream()`: Parallel processing. Data is split into chunks and processed concurrently using the ForkJoinPool.
- `parallelStream()` is NOT always faster -- it adds thread management overhead. Use it only for large datasets (>10K elements) with CPU-intensive operations.

## Q6: Can a stream be reused?

**Answer:** No. Once a terminal operation is called on a stream, it is consumed and cannot be reused. Attempting to reuse it throws `IllegalStateException`. To process the same data again, create a new stream from the source.

## Q7: What is the difference between intermediate and terminal operations?

**Answer:**
- **Intermediate operations**: Return a new `Stream`, are lazy (not executed until terminal), and can be chained. Examples: `filter()`, `map()`, `sorted()`.
- **Terminal operations**: Trigger pipeline execution, produce a result or side effect, and consume the stream. Examples: `collect()`, `forEach()`, `reduce()`.

## Q8: What are stateful vs stateless operations?

**Answer:**
- **Stateless**: Process each element independently -- `filter()`, `map()`, `flatMap()`, `peek()`.
- **Stateful**: Need to see all elements or maintain state -- `sorted()`, `distinct()`, `limit()`, `skip()`.
- Stateful operations can be less efficient in parallel streams because they may require synchronization.

## Q9: How does `Optional` relate to streams?

**Answer:** Several terminal operations return `Optional` to safely handle potentially empty results: `findFirst()`, `findAny()`, `min()`, `max()`, `reduce()` (without identity). `Optional` forces the caller to handle the absence of a value, preventing `NullPointerException`.

## Q10: What is short-circuit evaluation in streams?

**Answer:** Some operations don't need to process all elements:
- `findFirst()`, `findAny()`: Stop after finding one match
- `anyMatch()`: Stops at first `true`
- `allMatch()`: Stops at first `false`
- `noneMatch()`: Stops at first `true`
- `limit(n)`: Stops after n elements

This optimization is especially valuable on large or infinite streams.

## Q11: How to handle checked exceptions in streams?

**Answer:** Lambdas in streams don't support checked exceptions directly. Solutions:
1. Wrap in try-catch inside the lambda
2. Create a wrapper method that converts checked to unchecked exceptions
3. Use a utility function

```java
// Wrapper approach
private <T, R> Function<T, R> wrap(ThrowingFunction<T, R> fn) {
    return t -> {
        try { return fn.apply(t); }
        catch (Exception e) { throw new RuntimeException(e); }
    };
}

list.stream().map(wrap(this::methodThatThrows)).collect(Collectors.toList());
```

## Q12: What is the difference between `Collection.stream()` and `Stream.of()`?

**Answer:**
- `Collection.stream()`: Creates a stream from an existing collection (List, Set, etc.)
- `Stream.of()`: Creates a stream from explicitly provided elements or an array
- Both create sequential streams; the source differs.

---

# Part 15: Practice Section

## 30 Additional Coding Problems (Without Solutions)

Solve these problems using Java Streams to test your mastery.

### Easy

1. Given a list of integers, find the maximum value.
2. Given a list of strings, filter those that contain a specific substring.
3. Given a list of integers, find the count of numbers greater than a given threshold.
4. Given a list of employee objects, find the names of employees in a specific department.
5. Convert a list of integers to a comma-separated string.
6. Given a list of strings, find the shortest string.
7. Given two lists of integers, find elements present in the first but not in the second.
8. Square each element in a list and collect to a new list.
9. Given a list of strings, remove all null and empty values.
10. Find the sum of digits of a number using streams.

### Medium

11. Given a list of transactions, find total transaction amount per customer.
12. Find the top 3 most expensive products from a product list.
13. Given a list of sentences, find the total word count.
14. Generate a list of the first 50 prime numbers using streams.
15. Given a map of student names to grades, find students with grades above 90.
16. Given a list of orders, group by month and calculate total revenue per month.
17. Implement a case-insensitive distinct operation on a list of strings.
18. Given a list of employees, find the department with the highest average salary.
19. Create a stream pipeline that reads a CSV file, parses it, filters by a column value, and writes matching rows to a new file.
20. Given a list of strings, find the most common starting letter.

### Hard

21. Implement a custom `Collector` that collects elements into an unmodifiable `Map`.
22. Given a list of integers, find all sub-arrays of length K that have an average greater than a threshold.
23. Given a tree structure represented as nested objects, flatten it into a list using streams.
24. Implement a parallel stream-based solution to count word frequencies in multiple files simultaneously.
25. Create a stream-based solution for the "Top K Frequent Elements" problem.
26. Implement a lazy paginator that fetches and processes records in chunks using streams.
27. Given a list of JSON strings, parse them, validate, transform, and group by a field -- all using streams.
28. Create a custom spliterator for iterating a binary tree in-order as a stream.
29. Implement a stream-based solution for detecting cyclic dependencies in a directed graph.
30. Build a data pipeline that reads from multiple sources (files, database, API), merges, deduplicates, transforms, and writes to a unified output -- using streams.

---

# Appendix: Quick Reference Card

## Stream Pipeline

```
Source -> [filter -> map -> sorted -> ...] -> Terminal Operation -> Result
         \___ Intermediate (LAZY) ___/     \____ EAGER ____/
```

## Most Used Patterns

```java
// Filter + Map + Collect
list.stream().filter(predicate).map(function).collect(Collectors.toList());

// Group By
list.stream().collect(Collectors.groupingBy(classifier));

// Sort + Limit (Top N)
list.stream().sorted(comparator.reversed()).limit(n).collect(Collectors.toList());

// Reduce (Aggregate)
list.stream().mapToInt(mapper).sum();

// Any/All/None Match
list.stream().anyMatch(predicate);

// Find First
list.stream().filter(predicate).findFirst().orElse(defaultValue);
```

## Key Rules

| Rule | Explanation |
|---|---|
| Streams are lazy | Intermediate ops execute only when terminal op is called |
| Streams are consumable | A stream can be used only ONCE |
| Don't modify source | Stream operations should not modify the source collection |
| filter before map | Reduces elements to transform, improving performance |
| Use primitive streams | `IntStream`, `LongStream` avoid boxing overhead |
| Close resource streams | Use try-with-resources for `Files.lines()` |
| Avoid side effects | Keep stream operations pure and functional |

---

*End of Guide -- Mastering Java Streams and Functional Programming*
