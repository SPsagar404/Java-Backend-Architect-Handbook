# Day 6: Arrays - Math & Majority Elements

Welcome to Day 6! Today we delve into **Algorithmic Annihilation** and **Combinatorics**. You will learn Boyer-Moore's Voting Algorithm—one of the most elegant $O(1)$ space algorithms ever invented for data stream processing. We will also revisit spatial mathematics to solve 2D grid pathing without using recursion or Dynamic Programming matrices.

---

## 🔥 Problem 1: Majority Element ( $> \lfloor N/2 \rfloor$ )

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Google, Microsoft, Apple
- **Frequency:** 🔥 High
- **Interview Context:** This is the ultimate "Do you know the trick?" question. A Junior uses a HashMap to count frequencies ($O(N)$ space). A Senior uses Moore's Voting Algorithm to identify the absolute majority in strictly $O(1)$ space using a single pass.

### 🔹 1. Problem Explanation
Given an array `nums` of size `n`, return the majority element. The majority element is the element that appears **strictly more than** $\lfloor n / 2 \rfloor$ times. You may assume that the majority element always exists in the array.
- **Real-world analogy:** A political election. If one candidate has *more* than 50% of the total votes, even if every other candidate teams up against them, the majority candidate will still have votes left over.
- **Input:** `nums = [2, 2, 1, 1, 1, 2, 2]`
- **Output:** `2`
- **Constraints:** Must execute in $O(N)$ time and strictly $O(1)$ space.

### 🔹 2. Data Structure Masterclass
- **DS Used:** Primitive track variables (`majorityElement`, `count`).
- **Why chosen:** Required by $O(1)$ space limits.
- **Time complexity benefits:** We don't allocate Memory Heaps for HashMaps, meaning zero JVM Garbage Collection overhead during iteration.

### 🔹 3. Pattern Recognition
- **Pattern name:** Boyer-Moore Majority Voting Algorithm.
- **WHEN to use:** When asked to find an element appearing more than $N/2$ times.
- **HOW to identify:** "Majority Element", "more than n/2".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force / HashMap
- **Thinking:** Create a `HashMap<Integer, Integer>`. Count the frequency of every element. Iterate through the map and return the element with `freq > n/2`.
- **Complexity:** Time $O(N)$, Space $O(N)$. Highly inefficient for memory-constrained distributed systems analyzing millions of IP traffic logs.

#### ✅ Approach 2: Sorting
- **Thinking:** If an element appears more than $N/2$ times, and the array is SORTED, it will unquestionably occupy the exact middle index `nums[n/2]`, regardless of whether it's the smallest, largest, or middle physical value.
- **Code:** `Arrays.sort(nums); return nums[nums.length / 2];`
- **Complexity:** Time $O(N \log N)$, Space $O(1)$. 

#### ✅ Approach 3: Optimal Approach (Boyer-Moore Voting)
- **Best solution idea:** The "Annihilation" Principle.
  - Assume the first element is the majority candidate. Give it a `count` of 1.
  - If we see the SAME element again, `count++` (our candidate is getting stronger).
  - If we see a DIFFERENT element, `count--` (a rival voter cancels out one of our candidate's votes!).
  - If `count` hits `0`, our candidate was entirely annihilated. The very next element we see becomes the NEW candidate, starting at `count = 1`.
  - **Mathematical Guarantee:** Because the true majority element exists *more than* $N/2$ times, it physically cannot be annihilated by the minority elements. It will always survive at the end!
- **Optimal Java Code:**
```java
public class MajorityElement {
    public int majorityElementOptimal(int[] nums) {
        int candidate = 0;
        int count = 0;
        
        // Phase 1: Annihilation / Voting
        for (int num : nums) {
            if (count == 0) {
                // Previous candidate was annihilated. Crown a new one!
                candidate = num;
                count = 1;
            } else if (num == candidate) {
                // Same candidate, bolster defensive count
                count++;
            } else {
                // Rival candidate, mutual annihilation
                count--;
            }
        }
        
        // NOTE: The problem guarantees a majority element exists. 
        // If it didn't, we would need a Phase 2 here to loop the array 
        // one more time and explicitly verify that 'candidate' freq > N/2.
        return candidate;
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [7, 7, 5, 7, 5, 1, 5, 7, 5, 5, 7, 7, 7, 7, 7]`
- To save space, let's dry run `[2, 2, 1, 1, 1, 2, 2]`
1. `num = 2`: `count` is 0 $\implies$ `candidate=2`, `count=1`.
2. `num = 2`: Matches! `count=2`.
3. `num = 1`: Rival! `count=1`.
4. `num = 1`: Rival! `count=0`. (Candidate `2` has been temporarily overthrown).
5. `num = 1`: `count` is 0 $\implies$ `candidate=1`, `count=1`. (New king).
6. `num = 2`: Rival! `count=0` (Candidate `1` overthrown).
7. `num = 2`: `count` is 0 $\implies$ `candidate=2`, `count=1`. (King returns).
Result: `2` survives!

### 🔹 6. Architectural Thinking
- **WHAT:** Destructive interference state-tracking.
- **WHERE:** Stream processing where memory bounds must remain stringently $O(1)$.
- **HOW:** Allowing data packets to mutually destroy each other's weight metrics unearths the dominant recurring signal.
- **WHEN:** Checked sequentially, keeping only the surviving scalar value payload.
- **WHO:** This logic is deployed natively in Distributed Sensor Networks to determine the consensus reading from noisy hardware monitors!

### 🔹 7. Edge Cases
- **Array of length 1 (`[5]`):** `count=0`, `candidate=5`. Loops ends. Correct.
- **Problem variation (No Guarantee):** If the interviewer removes the "guaranteed to exist" clause, returning `candidate` blindly is a fatal bug. Example: `[1, 2, 3]`. `candidate` finishes as `3`. You MUST add a second `for()` loop to count occurrences of `candidate` and assert `freq > N/2`.

### 🔹 8. Clean Code
- Avoid convoluted ternary operators for the 3 distinct states (Empty, Match, Mismatch). Explicit `if / else if / else` proves your logical branching to the interviewer.

### 🔹 9. Interview Training
- **Senior Articulation:** "The algorithm operates on the principle of mutual destruction. Since a majority element occupies more than half the array, even in the absolute worst-case dispersion where every non-majority element strictly deducts from the majority's count, the majority's count will mathematically evaluate to at least $+1$ at termination."

---

## 🔥 Problem 2: Majority Element II ( $> \lfloor N/3 \rfloor$ )

### 🔹 0. Company Tagging
- **Asked in:** Google, Amazon, Meta
- **Frequency:** ⚡ Medium
- **Interview Context:** If you pass Moore's Voting for $N/2$, they will hit you immediately with $N/3$. Can you dynamically scale an algorithm? How many elements can physically appear $> N/3$ times? Exactly **TWO**. You must scale Moore's algorithm to track two simultaneous candidates.

### 🔹 1. Problem Explanation
Given an integer array of size `n`, find all elements that appear **strictly more than** $\lfloor n/3 \rfloor$ times.
- **Mathematical constraint:** In an array of 10 elements, $N/3 = 3$. You need elements appearing $\ge 4$ times. How many elements can fit? $4+4=8$. A third element would require $12$ spots! So, there is a maximum of **2** valid majority candidates.
- **Input:** `nums = [1, 1, 1, 3, 3, 2, 2, 2]` ($N=8$, target $>2$)
- **Output:** `[1, 2]`
- **Constraints:** O(N) time and O(1) space.

### 🔹 2. Data Structure Masterclass
- **DS Used:** Two Primitive track variables (`cand1`, `cand2`, `count1`, `count2`).
- **Why chosen:** Again, strictly complying with the $O(1)$ spacial requirement by explicitly declaring exactly 4 variables.

### 🔹 3. Pattern Recognition
- **Pattern name:** Extended Boyer-Moore Voting Algorithm.
- **WHEN to use:** "> N/3 Majority Element" searches.

### 🔹 4. Solution Evolution

#### ✅ Approach 1: HashMap
- **Thinking:** Same as before. Count everything. Iterate keys, if `freq > n/3`, add to result list.
- **Complexity:** Time $O(N)$, Space $O(N)$. Fails the spatial constraint.

#### ✅ Approach 2: Optimal Approach (Double Moore Voting)
- **Best solution idea:** Track two candidates. 
  - If `num == cand1`, `count1++`.
  - If `num == cand2`, `count2++`.
  - If `count1 == 0`, assign `cand1 = num`.
  - If `count2 == 0`, assign `cand2 = num`.
  - **The Annihilation Rule:** If `num` matches NEITHER candidate, it is a rebel third party! It attacks BOTH candidates. `count1--` AND `count2--`.
  - Because the problem does NOT guarantee existence, a Phase 2 manual frequency check is strictly required.
- **Optimal Java Code:**
```java
import java.util.ArrayList;
import java.util.List;

public class MajorityElementTwo {
    public List<Integer> majorityElementOptimal(int[] nums) {
        int cand1 = Integer.MIN_VALUE, cand2 = Integer.MIN_VALUE;
        int count1 = 0, count2 = 0;
        
        // Phase 1: Dual Annihilation
        for (int num : nums) {
            if (cand1 == num) {
                count1++;
            } else if (cand2 == num) {
                count2++;
            } else if (count1 == 0) {
                cand1 = num;
                count1 = 1;
            } else if (count2 == 0) {
                cand2 = num;
                count2 = 1;
            } else {
                // A third distinct element appears! Annihilate both leaders!
                count1--;
                count2--;
            }
        }
        
        // Phase 2: Verification (Strictly mandatory for N/3)
        List<Integer> result = new ArrayList<>();
        int freq1 = 0, freq2 = 0;
        
        for (int num : nums) {
            if (num == cand1) freq1++;
            else if (num == cand2) freq2++;
        }
        
        int n = nums.length;
        if (freq1 > n / 3) result.add(cand1);
        if (freq2 > n / 3) result.add(cand2);
        
        return result;
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [1, 2, 2, 3, 2, 1, 1, 3]`
1. (1): `cand1 = 1`, `c1 = 1`.
2. (2): `cand2 = 2`, `c2 = 1`.
3. (2): `cand2` matches! `c2++` (2).
4. (3): Matches neither! `c1=0, c2=1`. (Wait! `cand1` was zeroed!).
5. (2): `cand2` matches! `c2++` (2).
6. (1): Matches neither? No, `cand1` is still `1`, but its count is `0`. The `else if (count1 == 0)` fires! `cand1=1, c1=1`.
7. (1): `cand1` matches! `c1++` (2).
8. (3): Matches neither! `c1--` (1), `c2--` (1).
- **Candidates:** `cand1 = 1`, `cand2 = 2`.
- **Phase 2 (Counting):** `1` appears 3 times. `2` appears 3 times. $N=8$. Limit = $8/3 = 2$.
- $3 > 2$. Both are valid! Output `[1, 2]`.

### 🔹 6. Architectural Thinking
- **WHAT:** Multi-node consensus protocols.
- **WHERE:** Stream processing for fractional dominance thresholds.
- **HOW:** Extending the mathematical proof that $K$ candidates require $K$ trackers and simultaneously degrade under $K$-way node collisions.
- **WHO:** Used in Byzanatine Fault Tolerance protocols in block-chains, verifying if $>33\%$ of validator nodes agree on a corrupted hash without buffering the whole chain!

### 🔹 7. Edge Cases
- **Initialization Danger:** If the array contains `Integer.MIN_VALUE`, initializing candidates to `MIN_VALUE` without counting logic protection will trigger false positives! Fortunately, the `count` conditionals execute before arbitrary candidate value overwrites, buffering us from this hazard. 

### 🔹 8. Clean Code
- **Structure:** In Phase 2, `if (num == cand1)` followed by `**else** if (num == cand2)` is critical. If `cand1 == cand2` (due to some edge-case initialization flaw), avoiding double-counting the frequency ensures mathematically pure results.

### 🔹 9. Interview Training
- **Junior Pitfall:** Trying to decrement only ONE counter instead of BOTH counters during a Third-Party collision. If `A`, `B`, and `C` are competing, a vote for `C` mathematically hurts **both** `A`'s and `B`'s percentage threshold simultaneously!

---

## 🔥 Problem 3: Grid Unique Paths

### 🔹 0. Company Tagging
- **Asked in:** Google, Amazon, Microsoft
- **Frequency:** 🔥 High
- **Interview Context:** This is typically asked as a Dynamic Programming question. The interviewer wants to see you write the 2D DP matrix. However, an elite Senior engineer recognizes that this is purely **Combinatorics Math** (Permutations) and solves it in $O(N)$ time with $O(1)$ space without creating a DP grid!

### 🔹 1. Problem Explanation
There is a robot on an $m \times n$ grid. The robot is initially located at the **top-left corner** (i.e., `grid[0][0]`). The robot tries to move to the **bottom-right corner** (`grid[m - 1][n - 1]`). The robot can only move **either down or right** at any point in time. Return the number of possible unique paths.
- **Input:** `m = 3`, `n = 7`
- **Output:** `28`
- **Constraints:** Solve mathematically for Senior rating.

### 🔹 2. Data Structure Masterclass
- **DS Used:** None (Pure Mathematics).
- **Why chosen:** Standard $O(M \times N)$ recursive DP requires caching matrices. Math requires purely $O(1)$ primitives.

### 🔹 3. Pattern Recognition
- **Pattern name:** Pascal's Combinatorics ($nCr$).
- **WHEN to use:** "Count total paths" moving strictly Right/Down in an unblocked grid.
- **HOW to identify:** "Unique paths", "m x n grid".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Recursion (Disaster)
- **Thinking:** From `(0, 0)`, explore `(1, 0)` and `(0, 1)`. Recursively sum paths.
- **Complexity:** Time $O(2^{N \times M})$ Exponential explosion. Space $O(\text{Call Stack})$. Fails instantly on grids > 15x15.

#### ✅ Approach 2: Dynamic Programming (Standard Better)
- **Thinking:** Create a 2D matrix `dp[m][n]`. Every cell's path count is `dp[up] + dp[left]`.
  - Base case: Top row and Leftmost column are all `1`s.
  - Iterate: `dp[i][j] = dp[i-1][j] + dp[i][j-1]`
- **Complexity:** Time $O(M \times N)$, Space $O(M \times N)$. (This is generally acceptable, but we can do far better).

#### ✅ Approach 3: Optimal Approach (Mathematical $nCr$)
- **Best solution idea:** Look at a $3 \times 7$ grid.
  - To get from Start to End, how many times MUST we move physically `Down` (D)? To get to row 3, we MUST move down exactly $m-1 = 2$ times.
  - How many times MUST we move `Right` (R)? $n-1 = 6$ times.
  - Every valid path is just a scrambled string of exactly `2 D's` and `6 R's`. (e.g., `D-R-R-D-R-R-R-R`).
  - Total moves = $2 + 6 = 8$.
  - The mathematical question becomes: **"Out of 8 available step slots, how many unique ways can I choose exactly 2 slots to be my 'Down' steps?"**
  - That is $^8C_2$ combinations!
  - Formula: $\text{Total Steps} = M - 1 + N - 1 = M + N - 2$.
  - $\text{Choose} = \text{smaller of} (M-1, N-1)$.
  - $^nC_r = \text{ans} \times (n - \text{col}) / \text{col}$. 
- **Optimal Java Code:**
```java
public class UniquePaths {
    public int uniquePathsOptimal(int m, int n) {
        // Total physical steps required to reach the destination
        int N = m + n - 2; 
        
        // We can choose EITHER the 'Down' steps or 'Right' steps. 
        // Picking the smaller one shrinks our iteration timeframe!
        int R = Math.min(m - 1, n - 1);
        
        long ans = 1; // Use long to prevent multiplication overflow integer breaking
        
        // Calculate nCr math
        // Example: 8C2 = (8 * 7) / (1 * 2) = 28
        for (int i = 1; i <= R; i++) {
            ans = ans * (N - R + i);
            ans = ans / i;
        }
        
        return (int)ans;
    }
}
```

### 🔹 5. Dry Run
Input: `m=3`, `n=7`.
- `N = 3 + 7 - 2 = 8`.
- `R = min(2, 6) = 2`.
- Loop 1 (`i=1`): `ans = 1 * (8 - 2 + 1) = 7`. Wait, no.
  - Let's do the standard $N$ descending form instead to keep it simple natively.
  - Code: `ans * (N - R + i)` is mathematically valid, but easier notation:
  - `ans = ans * (N - i + 1) / i;`
  - Loop 1 (`i=1`): `ans = 1 * (8 - 1 + 1) / 1 = 8`.
  - Loop 2 (`i=2`): `ans = 8 * (8 - 2 + 1) / 2 = 8 * 7 / 2 = 28`.
- Result is 28. Perfect!

*(Note: In the code provided above, the loop iterates `ans * (N - R + i)`, which effectively computes the numerator backwards `(8-2+1 = 7, 8-2+2 = 8)`. Both versions calculate $nCr$ accurately, but the descending $N$ is slightly more intuitive).*

### 🔹 6. Architectural Thinking
- **WHAT:** Compressing 2D state matrices entirely into a declarative combinatorics formula.
- **WHERE:** O(1) mathematical execution.
- **HOW:** Relying on physical dimensional constraints (you *must* move right $X$ times) to prove that temporal pathing variations are just permutation anagrams!
- **WHEN:** We execute division natively *inside* the loop sequentially. `(8*7)/(1*2)`. This guarantees no massive intermediate floating-point overflow!
- **WHO:** Converting iterative state structures to combinatorial equations is the foundation of high-performance physics rendering engines minimizing compute loops!

### 🔹 7. Edge Cases
- **1x1 Grid:** `N = 0`, `R = 0`. Loop skips. Returns `1`. Correct (1 path, standing still).
- **1xN Grid:** `R = min(0, n) = 0`. Loop skips. Returns `1`. Correct (just a straight line).

### 🔹 8. Clean Code
- `long ans = 1`. If $N$ is large, multiplying `ans * N` will shatter the 32-bit Java `int` limit before the division slash can shrink it back down! You must utilize 64-bit `long` internally to safely calculate the numerator.

### 🔹 9. Interview Training
- **The Optimal Stratagem:** When asked Grid Unique Paths, ALWAYS start by writing the $O(M \times N)$ DP solution first. This proves you understand Matrix mapping and base cases. 
- *After* writing it, stop and say: *"I notice a pattern. Every cell is the exact sum of the cell above and left of it. This is literally generating Pascal's Triangle diagonally. Because of that, I can discard this entire DP matrix and calculate the final destination cell using $^nC_r$ Combinatorics in $O(N)$ time."* The interviewer will be blown away.

---

## 📝 DAILY SUMMARY

### 🎯 Patterns Learned Today
1. **Moore's Voting Algorithm:** Solving fractional subset queries in $O(1)$ spacial complexity via localized aggressive annihilation mechanics.
2. **Double Moore Validation:** Expanding the framework to handle $>N/3$ counts using isolated multi-trackers, highlighting the strict requirement for Phase-2 secondary assertion checks.
3. **Combinatorial DP Eradication:** Identifying when recursive state maps (like Grid Paths) natively produce Pascal's Triangle structures, allowing complete replacement with singular $^nC_r$ algebra loops.

### ⚖️ Decision Rules
- If dealing with **Majority Elements** representing distinct physical entities $\implies$ Utilize **Annihilation Voting**. Reject HashMaps.
- If evaluating **Path Options across an empty matrix** $\implies$ Do not execute pathfinding algorithms (DFS/DP). Compute dynamically using $^nC_r$ factorizations.

### ⚠ Key Mistakes to Avoid
- **$N/3$ Majority:** Failing to reset candidates correctly. The `else if` chaining must sequentially test if `count1` is 0 BEFORE testing if `count2` is 0, to prevent a single new element from simultaneously overwriting both tracking slots!
- **Grid Paths $nCr$:** Declaring `ans` as a standard `int`. Calculating permutations creates monstrous intermediate integers. Without `long`, your logic is flawlessly correct but will generate negative overflow garbage output.

***See you tomorrow for Day 7: Two Pointer Advanced, and our Weekly Revision Guide!***
