# Day 1: Arrays - Matrices & Logic

Welcome to Day 1 of your DSA Masterclass! As a Principal Engineer, I am not here to just teach you code; I am here to teach you **how to think**. Product-based companies (FAANG) don't just want working code—they want developers who understand memory, time-space trade-offs, and state management. Today, we conquer 2D Arrays (Matrices) and Array Logic permutations from the TUF (Striver) SDE Sheet.

---

## 🔥 Problem 1: Set Matrix Zeroes

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Microsoft, Meta
- **Frequency:** 🔥 High
- **Interview Context:** Why do interviewers ask this? It tests your ability to incrementally optimize **Space Complexity**. Anyone can solve it with $O(M \times N)$ extra space. A Senior Engineer solves it in $O(1)$ space by using the data structure *itself* as memory storage.

### 🔹 1. Problem Explanation
Given an `m x n` integer matrix, if an element is `0`, set its entire row and column to `0`'s. You must do it **in-place**.
- **Real-world analogy:** Imagine a spreadsheet of server statuses. If one server goes down (status `0`), the entire network rack (row) and power grid line (column) MUST be marked as inactive.
- **Input:** `matrix = [[1,1,1],[1,0,1],[1,1,1]]`
- **Output:** `[[1,0,1],[0,0,0],[1,0,1]]`
- **Constraints:** You cannot modify the matrix sequentially while scanning, otherwise a cascading effect will turn the *entire* matrix to 0s instantly!

### 🔹 2. Data Structure Masterclass
- **DS Used:** 2D Array / Matrix.
- **Why chosen:** Hardware architecture stores 2D arrays in contiguous memory (Row-Major format). 
- **Time complexity benefits:** Scanning by rows benefits from CPU Cache Spatial Locality ($O(1)$ cache hits).
- **Trade-offs:** 2D arrays are rigid in size. Inserting/Deleting rows is disastrous ($O(M \times N)$ shifting).

### 🔹 3. Pattern Recognition
- **Pattern name:** Dummy Array State Tracking / In-place Hashing.
- **WHEN to use:** When you need to track state changes but modifying the array sequentially ruins the original state.
- **HOW to identify:** Keywords like "Matrix", "Set entire row/col", "In-place". 

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** I'll duplicate the entire matrix. I'll scan the original. If I see a `0`, I'll write `0`s to the duplicate matrix's row and col. Copy the duplicate back at the end.
- **Code:** Too trivial to write out.
- **Complexity:** Time $O(N \times M \times (N + M))$, Space $O(N \times M)$ (Full matrix copy).
- **Why it's bad:** Disastrous memory allocation. If the matrix is 10,000x10,000, you just blew up the JVM Heap.

#### ✅ Approach 2: Better Approach (Dummy Arrays)
- **Idea:** We don't need a whole matrix to remember what to zero out. We just need two boolean lists: one for rows, one for columns.
- **Code:**
```java
public void setZeroesBetter(int[][] matrix) {
    int rows = matrix.length;
    int cols = matrix[0].length;
    
    int[] dummyRow = new int[rows];
    int[] dummyCol = new int[cols];
    
    // Pass 1: Tag the rows and cols that need to be zeroed
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            if (matrix[i][j] == 0) {
                dummyRow[i] = 1;
                dummyCol[j] = 1;
            }
        }
    }
    
    // Pass 2: Actually set the zeroes based on our dummy arrays
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            if (dummyRow[i] == 1 || dummyCol[j] == 1) {
                matrix[i][j] = 0;
            }
        }
    }
}
```
- **Improvement:** Space drops from $O(N \times M)$ to $O(N + M)$! Time is strictly $O(N \times M)$. This is good enough to pass most interviews, but a Senior aims for perfection.

#### ✅ Approach 3: Optimal Approach ($O(1)$ Space)
- **Best solution idea:** The interviewer explicitly asks for $O(1)$ space. Where do we find $O(N+M)$ free memory? **Inside the matrix itself!** 
  - We use the *first row* and *first column* of the matrix as our `dummyRow` and `dummyCol`.
  - **The Catch:** The first row and first column intersect at `matrix[0][0]`. We'd have a collision! 
  - **The Fix:** `matrix[0][0]` tracks the 0th row. We create exactly *one extra variable* `col0` to track the 0th column.
- **Optimal Java Code:**
```java
public class SetMatrixZeroes {
    public void setZeroesOptimal(int[][] matrix) {
        int col0 = 1; // 1 means safe, 0 means zero-out the 0th column
        int rows = matrix.length;
        int cols = matrix[0].length;

        // Step 1: Scan and tag state in the first row / col
        for (int i = 0; i < rows; i++) {
            if (matrix[i][0] == 0) col0 = 0; // Mark the special col0 tracker
            for (int j = 1; j < cols; j++) {
                if (matrix[i][j] == 0) {
                    matrix[i][0] = 0; // Mark the row head
                    matrix[0][j] = 0; // Mark the col head
                }
            }
        }

        // Step 2: Mutate the matrix from BOTTOM-RIGHT to TOP-LEFT 
        // We traverse backward so we don't accidentally overwrite our row/col headers too early!
        for (int i = rows - 1; i >= 0; i--) {
            for (int j = cols - 1; j >= 1; j--) {
                // If either the row head or col head is 0, make it 0
                if (matrix[i][0] == 0 || matrix[0][j] == 0) {
                    matrix[i][j] = 0;
                }
            }
            // Finally, process the 0th column separately using col0 variable
            if (col0 == 0) {
                matrix[i][0] = 0;
            }
        }
    }
}
```

### 🔹 5. Dry Run
Let `matrix = [[1, 1, 1], [1, 0, 1], [1, 1, 1]]`
1. **P1 (i=0):** `matrix[0][0]`!=0. `col0=1`.
2. **P1 (i=1):** `matrix[1][0]`!=0. `j=1`: Ah! `matrix[1][1]` is 0! 
   - Tag row: `matrix[1][0] = 0`. Tag col: `matrix[0][1] = 0`.
3. **P1 (i=2):** No zeros.
4. Current Matrix headers: Row 0 is `[1, 0, 1]`. Col 0 is `[1, 0, 1]`. `col0=1`.
5. **P2 (Backward Scan):**
   - We hit `i=2, j=2`: checks heads, both 1. Leaves it.
   - We hit `i=1, j=1`: checks `matrix[1][0] == 0`. Sets it to 0. (Correct!)
   - At the very end, `col0` is 1, so the 0th column is left alone (Correct!).

### 🔹 6. Architectural Thinking
- **WHAT:** Using data structure boundaries as caching layers.
- **WHERE:** Flow moves from establishing invariants (headers) to aggressively mutating downward dependent nodes.
- **HOW:** Backward scanning forces dependencies to resolve perfectly, preventing state-corruption race conditions!
- **WHO:** This pattern of "stealing the first 64 bytes for header metadata" is exactly how Network Packets and OS Page Tables work. Software architecture mimics low-level hardware memory layouts!

### 🔹 7. Edge Cases
- **Completely empty matrix (`[]`):** Null check needed in production.
- **First cell `[0][0]` is already 0:** Setting `col0=0` gracefully handles it without blowing up logic.
- **Matrix consisting of only one row / one col:** Handled perfectly by loop bounds.

### 🔹 8. Clean Code (Java Best Practices)
- Single variable definitions (`int rows`, `int cols`) prevent recalculating `.length` arrays within tight nested loops. JVM Hotspot might optimize it, but explicit scoping shows architectural intent.

### 🔹 9. Interview Training
- **How to explain:** "A brute force copy takes $O(MN)$ space. We can flatten the state into two boundary arrays of size $M$ and $N$. But to go $O(1)$ space, I want to hijack the first row and column of the matrix itself to act as my state arrays, using one primitive integer to resolve the corner collision."
- **Mistakes to avoid:** Do NOT scan Phase 2 from top-left to bottom-right! You will erase your own header tags instantly. Scan backwards.

---

## 🔥 Problem 2: Pascal's Triangle

### 🔹 0. Company Tagging
- **Asked in:** Google, Amazon
- **Frequency:** ⚡ Medium
- **Interview Context:** This isn't just about loops. The interviewer is testing if you recognize **Combinatorics Math** (nCr). An amateur uses additive logic (`row[i] = prev[i] + prev[i-1]`). A master uses Math permutations inside an $O(N^2)$ algorithm for blazingly fast pure generation.

### 🔹 1. Problem Explanation
Given an integer `numRows`, generate the first `numRows` of Pascal's triangle. 
In Pascal's triangle, each number is the sum of the two numbers directly above it.
- **Output (numRows=5):** `[[1], [1,1], [1,2,1], [1,3,3,1], [1,4,6,4,1]]`

There are three variations they could ask:
1. Print the exact element at row `R` and col `C`.
2. Print the entire `R-th` row.
3. Print the entire triangle.

We will focus on the ultimate generation (Variation 3).

### 🔹 2. Data Structure Masterclass
- **DS Used:** `List<List<Integer>>` (Dynamic jagged arrays).
- **Why chosen:** Java arrays are fixed size. Pascal's triangle rows grow by 1 each iteration. `ArrayList` is required.
- **Time complexity benefits:** `ArrayList` appends are amortized $O(1)$. 

### 3. Pattern Recognition
- **Pattern name:** Dynamic Programming (Pre-computation) OR Combinatorics ($nCr$).
- **WHEN to use:** Generating sequences where $State_{N}$ strictly relies on $State_{N-1}$.

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Additive Method (Standard / Better)
- **Idea:** Just mimic the definition. Row 5 is built by looking at Row 4. Loop through previous row, add adjacent elements.
- **Code:**
```java
public List<List<Integer>> generate(int numRows) {
    List<List<Integer>> result = new ArrayList<>();
    if (numRows == 0) return result;

    result.add(new ArrayList<>());
    result.get(0).add(1); // Row 1

    for (int i = 1; i < numRows; i++) {
        List<Integer> prevRow = result.get(i - 1);
        List<Integer> currRow = new ArrayList<>();

        currRow.add(1); // First element is always 1
        for (int j = 1; j < i; j++) {
            currRow.add(prevRow.get(j - 1) + prevRow.get(j));
        }
        currRow.add(1); // Last element is always 1

        result.add(currRow);
    }
    return result;
}
```
- **Complexity:** Time $O(N^2)$, Space $O(N^2)$ to hold the triangle. This is totally valid and expected!

#### ✅ Approach 2: Optimal Row Generation (The Mathematical Approach)
- **Idea:** What if the interviewer says: "Given `N = 100`, just print the 100th row. Do not generate the first 99 rows."
- **The Magic:** Any cell in Pascal's Triangle is exactly given by the permutation formula: $^nC_r$ (n Choose r).
  - Row 4 is: $^4C_0$, $^4C_1$, $^4C_2$, $^4C_3$, $^4C_4$
  - We can generate the *entire row* mathematically in $O(N)$ time, skipping all previous rows!
  - $^nC_r$ formula simplified trick: `ans = ans * (row - col) / col`
- **Optimal Math Code (Generates 1 single row instantly):**
```java
public List<Integer> generateRow(int row) {
    long ans = 1; // Use long to prevent massive permutation overflow
    List<Integer> ansRow = new ArrayList<>();
    ansRow.add(1); // 0th element is 1
    
    // Formula: For row=5, generating dynamically:
    // element 1: 1 * (5-1) / 1 = 4
    // element 2: 4 * (5-2) / 2 = 6
    for (int col = 1; col < row; col++) {
        ans = ans * (row - col);
        ans = ans / col;
        ansRow.add((int)ans);
    }
    return ansRow;
}
```
- **Putting it together for the Full Triangle:** You just loop `0` to `numRows` calling `generateRow(i)`. Both approaches yield $O(N^2)$ time. But the Math approach requires strictly zero memory lookups!

### 🔹 5. Dry Run (Math Approach for Row 5)
- Row=5. First element = `1`.
- Col=1: `ans = 1 * (5-1) / 1 = 4`. Row = `[1, 4]`
- Col=2: `ans = 4 * (5-2) / 2 = 6`. Row = `[1, 4, 6]`
- Col=3: `ans = 6 * (5-3) / 3 = 4`. Row = `[1, 4, 6, 4]`
- Col=4: `ans = 4 * (5-4) / 4 = 1`. Row = `[1, 4, 6, 4, 1]`. Correct!

### 🔹 6. Architectural Thinking
- **WHAT:** Decoupling dependent algorithms into independent mathematical assertions.
- **WHERE:** We abstracted row-calculations away from State-Tracking (the DP method).
- **HOW:** Math formulas ($nCr$) operate without Context (without needing the prior row).
- **WHO:** Stateful APIs rely on caching. Stateless APIs calculate via pure math functions. The Math Approach is identical to modern Stateless Lambda functions in distributed environments!

### 🔹 7. Edge Cases
- Huge row calculations > ~row 35 will overflow integer boundaries. Moving to `long` is mandated, and for truly huge numbers, Java `BigInteger` is needed. Explain this explicitly to the interviewer.

### 🔹 8. Clean Code
- When writing math-bound logic, avoid zero-division. We start the `col` iteration at `1` specifically to avoid `col=0` division explosions.

### 🔹 9. Interview Training
- Provide the Additive Approach first. Usually, that's what they want.
- If asked "Give me row 50 only, space optimized", immediately deploy the $^nC_r$ formula loop. It obliterates the competition.

---

## 🔥 Problem 3: Next Permutation

### 🔹 0. Company Tagging
- **Asked in:** Google, Meta, Bloomberg
- **Frequency:** 🔥 High
- **Interview Context:** Why? This tests whether you "know the trick" or if you can logically deduce suffix patterns. If you attempt brute force permutations (generating all factorial $N!$ states), you immediately signal junior-level thinking.

### 🔹 1. Problem Explanation
Given an array representing a number (`[1, 2, 3]`), find the numerically "next" largest permutation (`[1, 3, 2]`). If it's already the highest possible configuration (`[3, 2, 1]`), reset it back to the lowest (`[1, 2, 3]`).
- **Analogy:** A combination lock spinning one definitive "click" upwards in lexical dictionary order.

### 🔹 2. Data Structure Masterclass
- **DS Used:** Array.
- **Why chosen:** Required for element swapping. Memory efficiency relies *heavily* on tracking index points without making substring copies.

### 🔹 3. Pattern Recognition
- **Pattern name:** Lexicographical Peak Finding (Lexical Suffix algorithm).
- **WHEN to use:** Anytime the word "dictionary order" or "next permutation" appears.

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Idea:** Recursively generate all permutations of the array. Sort them in ascending order. Find where the given input is, output the one element right after it.
- **Complexity:** Generating permutations takes $O(N! \times N)$ time. For $N=20$, that's $20!$ (quintillions of operations). The universe will end before the test case finishes.

#### ✅ Approach 2 & 3: Optimal (Direct Math Sweep)
- **Visualizing the math:** Look at `2 1 5 4 3 0 0`. What is the NEXT larger number? 
- We naturally read numbers left to right, but changes must happen right to left. 
- Look from the right: `0, 0, 3, 4, 5`... that sequence is strictly increasing (right-to-left). A sequence in decreasing order (left-to-right) is at its MAXIMUM possible value. It cannot be increased further!
- We find the first digit that breaks this rule ("The Breakpoint"). Here, moving right-to-left: `5` > `4` > `3` > `0` > `0`, suddenly we hit `1`! Ah! `1 < 5`. The `1` is the bottleneck.
- **The Algorithm:**
  1. Scan R-to-L. Find first `arr[i] < arr[i+1]`. This is the `breakPoint`.
  2. If there is no breakPoint, the array is `[5,4,3,2,1]`. Simply reverse it to `[1,2,3,4,5]` and exit.
  3. Scan R-to-L again. Find the first element strictly larger than `arr[breakPoint]`.
  4. Swap them.
  5. The suffix to the right of the breakPoint will now be in perfectly descending order. To make it the *smallest* possible "next" sequence, simply reverse the suffix to ascending order!

- **Clean Java Code:**
```java
public class NextPermutation {
    public void nextPermutation(int[] nums) {
        if (nums == null || nums.length <= 1) return;
        
        int i = nums.length - 2;
        // 1. Find the breakpoint
        while (i >= 0 && nums[i] >= nums[i + 1]) {
            i--;
        }
        
        // 2. If breakpoint exists, find the swapper and swap
        if (i >= 0) {
            int j = nums.length - 1;
            while (nums[j] <= nums[i]) {
                j--;
            }
            swap(nums, i, j);
        }
        
        // 3. Reverse everything from the breakpoint + 1 to the end
        // If array was fully maxed (i = -1), this reverses the entire array
        reverse(nums, i + 1, nums.length - 1);
    }
    
    private void swap(int[] nums, int i, int j) {
        int temp = nums[i];
        nums[i] = nums[j];
        nums[j] = temp;
    }
    
    private void reverse(int[] nums, int start, int end) {
        while (start < end) {
            swap(nums, start, end);
            start++;
            end--;
        }
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [1, 3, 5, 4, 2]`
- **Step 1:** Right loop. `2` < `4` (No). `4` < `5` (No). `5` > `3` (YES!). Breakpoint `i=1` (value `3`).
- **Step 2:** Right loop again to find $>3$. `2` > 3 (No). `4` > 3 (YES). Swap index `j=3` (value `4`).
- **Swap:** Swap index 1 and 3. Array becomes `[1, 4, 5, 3, 2]`.
- **Reverse:** Reverse everything right of index 1 (the suffix `[5, 3, 2]`). It becomes `[2, 3, 5]`.
- **Result:** `[1, 4, 2, 3, 5]`. Exact dictionary next!

### 🔹 6. Architectural Thinking
- **WHAT:** Operating on suffixes based on numerical polarity.
- **WHERE:** Utilizing the right-hand (least-significant) side of the integer constraint.
- **HOW:** Swapping the minimal upgrade digit and wiping the trailing digits to zero-state (ascending).
- **WHEN:** In precisely three linear sweeps.
- **WHO:** This permutation generation is exactly how C++ `std::next_permutation` is written natively in hardware compilers!

### 🔹 7. Edge Cases
- **Duplicate Numbers (`[1, 5, 1]`).** Standard `<` operators fail in duplicates. You MUST use `>=` in `while(nums[i] >= nums[i+1])` to gracefully step past grouped dupes.
- **Already maximum (`[3, 2, 1]`).** The `i >= 0` check protects the swap. It skips right into reversing the array from index `0`. Perfectly handles cyclic arrays.

### 🔹 8. Clean Code
- By extracting `swap` and `reverse` into extremely tight helper variables, the structural code reads exactly like the 3-step proof. Always modularize operations inside complex loop bounds!

### 🔹 9. Interview Training
- **How to explain:** Start immediately by drawing out a number sequence on the whiteboard. "If we have `1432`, we read backwards to find the drop. `2` to `3` is smooth. `3` to `4` is smooth. `4` dropping to `1` is the bottleneck..." This shows genuine comprehension, not just memorized code.

---

## 📝 DAILY SUMMARY

### 🎯 Patterns Learned Today
1. **State Matrix Boundary Hashing:** Using `matrix[0][n]` and `matrix[m][0]` as bit-flags to solve 2D mapping problems in strictly $O(1)$ space.
2. **Combinatorics Magic:** Memorizing the $^nC_r$ DP formula transforms matrix DP mapping from an intensive loop algorithm into a purely stateless mathematical calculation.
3. **Lexicographical Sequence Manipulation:** To augment dictionary combinations, isolate the longest descending suffix, swap the node just prior with its closest larger relative, and reverse the suffix.

### ⚖️ Decision Rules
- If given a **Matrix** with state-flag requirements and an $O(1)$ space limit $\implies$ Exploit the first row and column natively.
- If asked for **Combinations/Pascal** specifically targeting one deep row $\implies$ Use pure math (`ans = ans * (row - col) / col`).
- If given a numbers-array and asked for **"Next Order"** $\implies$ Right-to-Left suffix algorithm (Never Bruite force factorials).

### ⚠ Key Mistakes to Avoid
- **Set Matrix Zeroes:** Setting the first row/column header markers in Phase 1, and then in Phase 2, accidentally scanning Top-Left to Bottom-Right. The top-left `0` will overwrite your column markers instantly before you even read them! *Always scan Phase 2 from Bottom-Right to Top-Left.* 
- **Next Permutation:** Forgetting the `=` sign in `>=`. Array duplicates will infinite-loop or logic-fail.

***See you tomorrow for Day 2: Array Sums & Kadane's!***
