# Part 1: Introduction to Functional Programming in Java

## 1.1 What is Functional Programming?

### Concept Explanation

**Functional Programming (FP)** is a programming paradigm that treats computation as the evaluation of mathematical functions. Instead of changing state and mutating data, FP emphasizes **pure functions**, **immutability**, and **declarative expressions**.

### Core Principles of Functional Programming

| Principle | Description | Java Example |
|---|---|---|
| **Pure Functions** | Same input always produces same output, no side effects | `x -> x * 2` |
| **Immutability** | Data does not change after creation | `List.of(1, 2, 3)` (unmodifiable) |
| **First-Class Functions** | Functions can be passed as arguments and returned | `Function<Integer, Integer> fn = x -> x + 1;` |
| **Higher-Order Functions** | Functions that take or return other functions | `list.stream().map(fn)` |
| **Declarative Style** | Describe WHAT to do, not HOW | `stream.filter().map().collect()` |
| **No Side Effects** | Functions don't modify external state | No global variable mutation |

## 1.2 Why Java Introduced Functional Programming

### The Problem Before Java 8

```
Before Java 8:
  X Verbose anonymous inner classes for simple operations
  X No way to pass behavior (functions) as parameters easily
  X Imperative loops for collection processing
  X No built-in parallel processing for collections
  X Boilerplate code for simple data transformations

After Java 8:
  [ok] Lambda expressions for concise function definitions
  [ok] Functional interfaces (Predicate, Function, Consumer, Supplier)
  [ok] Stream API for declarative data processing
  [ok] Method references for even cleaner code
  [ok] Built-in parallel stream support
```

### Before vs After Java 8

```java
// X BEFORE Java 8: Verbose, imperative
List<String> names = new ArrayList<>();
for (Employee emp : employees) {
    if (emp.getSalary() > 50000) {
        names.add(emp.getName().toUpperCase());
    }
}
Collections.sort(names);

// [ok] AFTER Java 8: Concise, declarative
List<String> names = employees.stream()
    .filter(emp -> emp.getSalary() > 50000)
    .map(emp -> emp.getName().toUpperCase())
    .sorted()
    .collect(Collectors.toList());
```

## 1.3 Imperative vs Declarative Programming

### Side-by-Side Comparison

| Aspect | Imperative | Declarative (Functional) |
|---|---|---|
| **Focus** | HOW to do it | WHAT to do |
| **State** | Mutable variables | Immutable transformations |
| **Control** | Loops (for, while) | Stream operations (map, filter) |
| **Readability** | Step-by-step instructions | Pipeline of transformations |
| **Parallelism** | Manual thread management | `parallelStream()` built-in |
| **Side Effects** | Common and expected | Minimized or eliminated |

### Example: Find the sum of squares of even numbers

```java
// IMPERATIVE: Tell the computer HOW
int sum = 0;
for (int n : numbers) {
    if (n % 2 == 0) {
        sum += n * n;
    }
}

// DECLARATIVE: Tell the computer WHAT
int sum = numbers.stream()
    .filter(n -> n % 2 == 0)
    .mapToInt(n -> n * n)
    .sum();
```

## 1.4 Key Concepts in Functional Programming

### Lambda Expressions

A **lambda expression** is a concise way to represent an anonymous function.

```java
// Syntax: (parameters) -> expression
// Or:     (parameters) -> { statements; }

// No parameters
Runnable task = () -> System.out.println("Running");

// One parameter (parentheses optional)
Function<String, Integer> length = s -> s.length();

// Multiple parameters
BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;

// Multiple statements
Comparator<String> comp = (s1, s2) -> {
    int lenDiff = s1.length() - s2.length();
    return lenDiff != 0 ? lenDiff : s1.compareTo(s2);
};
```

### Effectively Final Variables

Lambda expressions can access local variables only if they are **effectively final** (not modified after initialization).

```java
int threshold = 50000;  // Effectively final -- never reassigned

// [ok] Works: threshold is effectively final
employees.stream()
    .filter(e -> e.getSalary() > threshold)
    .collect(Collectors.toList());

// X Compilation error: threshold is modified
// threshold = 60000;
// employees.stream().filter(e -> e.getSalary() > threshold);
```

## 1.5 Benefits in Real Systems

| Benefit | How It Helps |
|---|---|
| **Readability** | Pipelines read like English: "filter employees, map to names, collect to list" |
| **Conciseness** | 10 lines of imperative code -> 3 lines with streams |
| **Parallelism** | Switch `stream()` to `parallelStream()` for free parallelism |
| **Composability** | Chain operations easily: filter -> map -> sort -> collect |
| **Testability** | Pure functions are trivially testable |
| **Maintainability** | Declarative code is easier to understand and modify |

## 1.6 Real-World Use Cases

```
1. DATA PROCESSING PIPELINES
   API Response -> Filter invalid -> Transform -> Group -> Return
   Example: Process 10,000 API records, filter nulls, transform to DTOs

2. MICROSERVICE DATA TRANSFORMATION
   Service A Response -> Map to Internal DTO -> Validate -> Persist
   Example: Transform external payment gateway response to internal model

3. REPORTING & ANALYTICS
   Database Results -> Group by category -> Aggregate -> Sort -> Export
   Example: Monthly sales report grouped by region

4. LOG PROCESSING
   Log entries -> Filter by severity -> Extract patterns -> Count occurrences
   Example: Analyze error logs to find most frequent exceptions

5. CONFIGURATION PROCESSING
   Raw configs -> Validate -> Filter active -> Convert to runtime objects
   Example: Process feature flags from config server
```

---

# Part 2: Java Stream API Overview

## 2.1 What are Streams?

### Concept Explanation

A **Stream** is a sequence of elements that supports functional-style aggregate operations. It is NOT a data structure -- it does not store data. Instead, it provides a declarative pipeline for processing data from a source (like a collection, array, or I/O channel).

### Streams vs Collections

| Aspect | Collection | Stream |
|---|---|---|
| **Purpose** | Store and manage data | Process and compute data |
| **Storage** | Holds elements in memory | Does NOT store elements |
| **Consumption** | Can be iterated multiple times | Can be consumed ONLY ONCE |
| **Modification** | Elements can be added/removed | Does NOT modify the source |
| **Evaluation** | Eager (immediate) | Lazy (deferred until terminal op) |
| **Size** | Finite | Can be infinite |
| **Iteration** | External (you control loop) | Internal (stream controls iteration) |

### Key Characteristics

```
Stream Characteristics:
  1. NO STORAGE        -> Streams don't store data, they pipeline it
  2. FUNCTIONAL        -> Operations produce results without modifying source
  3. LAZY              -> Intermediate operations are not executed until terminal op
  4. POSSIBLY UNBOUNDED -> Streams can be infinite (Stream.generate, Stream.iterate)
  5. CONSUMABLE        -> A stream can only be traversed once; create a new one to re-traverse
  6. PIPELINE          -> Operations are chained into a pipeline: source -> intermediate -> terminal
```

## 2.2 Why Streams are Used

```
Problem: Process a list of 100,000 employees

Without Streams (Imperative):
  Step 1: Loop through all employees
  Step 2: Check salary > 50000 (if statement)
  Step 3: Create name string (string operation)
  Step 4: Add to temporary list
  Step 5: Sort the temporary list
  Step 6: Take first 10
  -> 15+ lines of code, 3 temporary variables, hard to parallelize

With Streams (Declarative):
  employees.stream()
      .filter(e -> e.getSalary() > 50000)
      .map(Employee::getName)
      .sorted()
      .limit(10)
      .collect(Collectors.toList());
  -> 6 lines, no temporary variables, trivially parallelizable
```

## 2.3 Internal vs External Iteration

```
EXTERNAL ITERATION (Traditional):
  You (the programmer) control the iteration:

  for (Employee emp : employees) {     // YOU iterate
      if (emp.getSalary() > 50000) {   // YOU filter
          names.add(emp.getName());     // YOU collect
      }
  }

INTERNAL ITERATION (Streams):
  The Stream API controls the iteration:

  employees.stream()                   // Stream iterates internally
      .filter(e -> e.getSalary() > 50000)  // Stream filters
      .map(Employee::getName)               // Stream maps
      .collect(Collectors.toList());        // Stream collects

  Why Internal Iteration is Better:
  [ok] Stream can optimize iteration order
  [ok] Stream can parallelize automatically
  [ok] Stream can short-circuit (stop early when result is found)
  [ok] Stream can fuse operations (filter + map in single pass)
```

## 2.4 Lazy Evaluation

### How Lazy Evaluation Works

```
Given this pipeline:
  List<String> result = names.stream()     // Source: ["Alice", "Bob", "Charlie", "David"]
      .filter(n -> n.length() > 3)          // Intermediate (LAZY)
      .map(String::toUpperCase)             // Intermediate (LAZY)
      .collect(Collectors.toList());         // Terminal (TRIGGERS execution)

Execution with Lazy Evaluation:
  "Alice"   -> filter(length > 3) -> YES -> map(toUpperCase) -> "ALICE" -> add to result
  "Bob"     -> filter(length > 3) -> NO  -> SKIP (map never called)
  "Charlie" -> filter(length > 3) -> YES -> map(toUpperCase) -> "CHARLIE" -> add to result
  "David"   -> filter(length > 3) -> YES -> map(toUpperCase) -> "DAVID" -> add to result

Key Insight:
  [ok] "Bob" was filtered out -- map() was NEVER called for "Bob"
  [ok] Each element is fully processed through the pipeline before the next element starts
  [ok] Without terminal operation, NOTHING executes
  [ok] This is called "loop fusion" -- multiple operations are combined into a single pass
```

### Demonstrating Laziness

```java
// This does NOTHING -- no terminal operation triggers execution
Stream<String> stream = names.stream()
    .filter(n -> {
        System.out.println("Filtering: " + n);  // Never printed!
        return n.length() > 3;
    })
    .map(n -> {
        System.out.println("Mapping: " + n);    // Never printed!
        return n.toUpperCase();
    });
// No output! Stream operations are lazy.

// NOW add terminal operation -- execution is triggered
List<String> result = stream.collect(Collectors.toList());
// Output:
//   Filtering: Alice
//   Mapping: Alice
//   Filtering: Bob         filtered out, map not called
//   Filtering: Charlie
//   Mapping: Charlie
//   Filtering: David
//   Mapping: David
```

## 2.5 Stream Pipeline Architecture

### Pipeline Structure

```
+------------------+      +------------------------+      +------------------+
|      SOURCE      | ---> |   INTERMEDIATE OPS     | ---> |   TERMINAL OP    |
|                  |      |   (0 or more, LAZY)    |      |   (exactly 1)    |
+------------------+      +------------------------+      +------------------+
|                  |      |                        |      |                  |
| Collection       |      | filter()               |      | collect()        |
| Array            |      | map()                  |      | forEach()        |
| I/O Channel      |      | flatMap()              |      | reduce()         |
| Generator        |      | sorted()               |      | count()          |
|                  |      | distinct()             |      | min() / max()    |
|                  |      | peek()                 |      | findFirst()      |
|                  |      | limit() / skip()       |      | anyMatch()       |
+------------------+      +------------------------+      +------------------+

RULES:
  1. A pipeline must have exactly ONE source
  2. A pipeline may have ZERO or MORE intermediate operations
  3. A pipeline must have exactly ONE terminal operation
  4. Intermediate operations return a new Stream (allowing chaining)
  5. Terminal operations produce a result or side effect (NOT a Stream)
  6. After a terminal operation, the stream is CONSUMED and cannot be reused
```

### Stream Reuse Error

```java
Stream<String> stream = names.stream().filter(n -> n.length() > 3);

// First terminal operation -- OK
List<String> result1 = stream.collect(Collectors.toList());

// Second terminal operation -- IllegalStateException!
// long count = stream.count();  // X Stream already consumed!

// Solution: Create a new stream
long count = names.stream().filter(n -> n.length() > 3).count();
```

---
