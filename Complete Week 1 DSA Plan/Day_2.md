# Day 2: Arrays - Pre-computation & Operations

Welcome to Day 2! Today we focus on algorithms that rely on **Pre-computation and State Carry-over**. In Junior development, arrays are scanned redundantly $O(N^2)$ times. In Senior development, arrays are scanned exactly once $O(N)$ by carrying the optimal history forward. We will master Kadane’s Algorithm, Dijkstra's 3-Way Partitioning, and localized difference tracking.

---

## 🔥 Problem 1: Maximum Subarray Sum (Kadane's Algorithm)

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Microsoft, LinkedIn, Apple
- **Frequency:** 🔥 High
- **Interview Context:** This is the quintessential Dynamic Programming (DP) question masked as an Array question. Interviewers use it to see if you intuitively understand how to aggressively discard toxic data (negative sums) to optimize future sequences.

### 🔹 1. Problem Explanation
Given an integer array `nums` containing both positive and negative integers, find the contiguous subarray (containing at least one number) which has the largest sum, and return its sum.
- **Real-world analogy:** Tracking the highest net-profit stretch for a volatile stock. If a sequence of days loses you so much money that your net running total goes net-negative, that specific stretch is mathematically poisoned. It can *never* help a future sequence reach a high score.
- **Input:** `nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]`
- **Output:** `6` (from subarray `[4, -1, 2, 1]`)
- **Constraints:** Must be $O(N)$ time.

### 🔹 2. Data Structure Masterclass
- **DS Used:** Primitive track variables (`maxSum`, `currentSum`).
- **Why chosen:** Standard 1D DP requires an entire $O(N)$ array to track history. But since Kadane's only relies on the strictly *immediate preceding* state, we can compress the $O(N)$ DP array into a single $O(1)$ primitive integer.
- **Trade-offs:** We lose the ability to lookup the optimal sequence sum at *any* arbitrary past index, but we save exponential memory allocation.

### 🔹 3. Pattern Recognition
- **Pattern name:** Kadane's Algorithm (Greedy State Resetting).
- **WHEN to use:** When asked for maximum/minimum contiguous sums/products in arrays with negative numbers.
- **HOW to identify:** Keywords like "largest sum", "contiguous", "subarray", "contains negatives".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** I'll check every single possible subarray block. Start at `0`, sum to `N`. Start at `1`, sum to `N`. Track maximum.
- **Complexity:** Time $O(N^2)$, Space $O(1)$. 
- **Why it's bad:** Time Limit Exceeded (TLE) on arrays larger than $10^5$. Redundantly calculating `sum(A..C)` when you already knew `sum(A..B)` in the previous loop iteration.

#### ✅ Approach 2: Better Approach
- Technically, the $O(N^2)$ prefix-sum nested loop *is* the better approach compared to the catastrophic $O(N^3)$ triple loop. But there is no real middle-ground pattern here. You either know Kadane's or you fail the time constraints.

#### ✅ Approach 3: Optimal Approach (Kadane's)
- **Best solution idea:** Carry a running sum. Ask one simple question at every step: **"Does adding my running sum to the current element make it bigger, or is my running sum so toxic (negative) that the current element is better off starting a brand new sequence by itself?"**
- **Optimal Java Code:**
```java
public class MaximumSubarray {
    public int maxSubArray(int[] nums) {
        // Initialize max extremely small to handle arrays with ALL negative numbers
        int maxSum = Integer.MIN_VALUE; 
        int currentSum = 0;
        
        for (int num : nums) {
            // 1. Add current element to the running state
            currentSum += num;
            
            // 2. Did we achieve a new global high score?
            if (currentSum > maxSum) {
                maxSum = currentSum;
            }
            
            // 3. The Greedy Cut-off: If our running total dropped below zero, 
            // it is mathematically useless for the future. Reset it.
            if (currentSum < 0) {
                currentSum = 0;
            }
        }
        
        return maxSum;
    }
}
```

### 🔹 5. Dry Run
Input: `[-2, 1, -3, 4, -1, 2, 1, -5, 4]` // Initial: `max = MIN`, `curr = 0`
1. `num = -2`: `curr`=-2. `max`=-2. `curr < 0` $\implies$ `curr=0`. (Drop the toxic past)
2. `num = 1`: `curr`=1. `max`=1. 
3. `num = -3`: `curr`=-2. `max`=1 (unchanged). `curr < 0` $\implies$ `curr=0`.
4. `num = 4`: `curr`=4. `max`=4.
5. `num = -1`: `curr`=3. `max`=4. (Notice we keep the 3! A minor dip is fine as long as `curr` > 0).
6. `num = 2`: `curr`=5. `max`=5.
7. `num = 1`: `curr`=6. `max`=6. (New Peak!)
8. `num = -5`: `curr`=1. `max`=6.
9. `num = 4`: `curr`=5. `max`=6.
Result: `6`.

### 🔹 6. Architectural Thinking
- **WHAT:** Aggressive sequence termination constraint.
- **WHERE:** Executed continuously across linear data streaming.
- **HOW:** By severing the historical payload (resetting to 0) the moment the aggregated weight mathematically harms the possibility of future growth.
- **WHEN:** Checked strictly *after* evaluating if the current dip was part of a new high score.
- **WHO:** This principle is identical to TCP packet windowing resets when congestion drops below acceptable thresholds!

### 🔹 7. Edge Cases
- **All Negative Numbers (`[-5, -2, -9]`):** If you initialized `maxSum = 0`, your logic would return `0` (wrong!). Initializing to `Integer.MIN_VALUE` guarantees it correctly identifies `-2` as the maximum possible subarray (size 1).

### 🔹 8. Clean Code
- Maintain the strict ordering of the internal `if` statements. Adding to `currentSum`, checking `maxSum`, and *then* aggressively resetting `currentSum < 0` is the most resilient, cleanly readable format.

### 🔹 9. Interview Training
- **Follow-up Question:** "What if I want the START and END indices of the subarray, not just the sum?"
- **Senior Answer:** "I will add a `tempStart` variable initialized to 0. Whenever `currentSum` resets to 0, I set `tempStart = i + 1`. Whenever `currentSum > maxSum`, I update the final `globalStart = tempStart` and `globalEnd = i`. This tracks the physical bounds effortlessly in $O(1)$ space."

---

## 🔥 Problem 2: Sort Colors (0s, 1s, and 2s)

### 🔹 0. Company Tagging
- **Asked in:** Microsoft, Amazon, Adobe
- **Frequency:** ⚡ Medium
- **Interview Context:** This problem tests if you can implement the **Dutch National Flag (DNF)** algorithm. If you sort the array ($O(N \log N)$), you fail the space/time check. If you count frequencies and overwrite ($O(2N)$), you pass, but the interviewer will push for a strict 1-Pass $O(N)$ solution.

### 🔹 1. Problem Explanation
Given an array containing only `0`, `1`, and `2`, sort them in-place so all 0s are first, 1s in the middle, and 2s at the end.
- **Real-world analogy:** An assembly line sorting defective objects (0), acceptable objects (1), and premium objects (2). You only have one robotic arm and must push items to their respective zones in a single sweep without additional bins.
- **Constraints:** Solve in exactly 1 pass ($O(N)$ time), $O(1)$ space.

### 🔹 2. Data Structure Masterclass
- **DS Used:** Array (In-place pointers).
- **Why chosen:** Required by problem for $O(1)$ modifications.
- **Internal working:** Using 3 pointers to define rigid territory boundaries inside the contiguous memory block.

### 🔹 3. Pattern Recognition
- **Pattern name:** Dijkstra’s 3-Way Partitioning (Dutch National Flag).
- **WHEN to use:** When categorically segregating elements into exactly 3 groups.
- **HOW to identify:** Keywords "sort 0 1 2", "three colors", "one pass".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Counting Sort (Better)
- **Thinking:** Two passes. Pass 1: count how many 0s, 1s, and 2s exist. Pass 2: Overwrite the array from index `0` sequentially based on the counts.
- **Complexity:** Time $O(2N)$, Space $O(1)$. Good, but not 1 pass.

#### ✅ Approach 3: Optimal Approach (Dutch National Flag)
- **Best solution idea:** Use 3 pointers (`low`, `mid`, `high`). 
  - `0` to `low-1` holds purely `0`s. 
  - `high+1` to `N` holds purely `2`s. 
  - `mid` is our aggressive scanner. Everything between `mid` and `high` is unknown territory.
  - If `mid` hits a 0, we swap it to the `low` territory and advance both `low` and `mid`.
  - If `mid` hits a 1, it belongs in the middle anyway! Just advance `mid`.
  - If `mid` hits a 2, we swap it to the `high` territory and shrink `high`. **CRITICAL:** Do NOT advance `mid` here, because the element swapped back *from* `high` is unverified!
- **Optimal Java Code:**
```java
public class SortColors {
    public void sortColors(int[] nums) {
        int low = 0;
        int mid = 0;
        int high = nums.length - 1;

        while (mid <= high) {
            if (nums[mid] == 0) {
                swap(nums, low, mid);
                low++;
                mid++;
            } else if (nums[mid] == 1) {
                mid++;
            } else { // nums[mid] == 2
                swap(nums, mid, high);
                high--; // Notice: mid does NOT increment here
            }
        }
    }

    private void swap(int[] arr, int i, int j) {
        int temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [2, 0, 2, 1, 1, 0]` 
- `low=0`, `mid=0`, `high=5`.
1. `mid(0) == 2`: Swap `mid`(0) & `high`(5). `nums=[0, 0, 2, 1, 1, 2]`. `high--`(4). (Notice `mid` stays `0`!)
2. `mid(0) == 0`: Swap `mid`(0) & `low`(0). `low++`(1), `mid++`(1).
3. `mid(1) == 0`: Swap `mid`(1) & `low`(1). `low++`(2), `mid++`(2).
4. `mid(2) == 2`: Swap `mid`(2) & `high`(4). `nums=[0, 0, 1, 1, 2, 2]`. `high--`(3). (`mid` stays `2`).
5. `mid(2) == 1`: Leave it. `mid++`(3).
6. `mid(3) == 1`: Leave it. `mid++`(4).
7. `mid(4) > high(3)`: Loop breaks. Sorted!

### 🔹 6. Architectural Thinking
- **WHAT:** Terrritorial Memory Partitioning.
- **WHERE:** Expanding solid safe-zones (`0`s on left, `2`s on right) while collapsing the chaotic unknown zone in the middle.
- **HOW:** Destructive in-place swapping driven purely by categorical `if/else` routing.
- **WHO:** This 3-way partition logic is exactly how the legendary "QuickSort" algorithm prevents $O(N^2)$ worst-case explosions when arrays feature massive numbers of duplicates!

### 🔹 7. Edge Cases
- All 1s (`[1, 1, 1]`): `mid` races to the end, zero swaps execute. Optimal.
- Array already sorted (`[0, 1, 2]`): 0 swaps, 1 swap, loop ends.

### 🔹 8. Clean Code
- Abstracting the `.swap()` logic keeps the core loop elegantly readable and protects against accidental index overwrites.

### 🔹 9. Interview Training
- **Optimization Hint:** If the interviewer questions why you aren't incrementing `mid` when encountering a `2`, state boldly: "Because `high` represents unverified territory. Swapping an element from `high` to `mid` means my `mid` pointer is now looking at a completely unknown number. If I increment `mid` blindly, I permanently leave an unverified element in the middle zone, corrupting the array."

---

## 🔥 Problem 3: Best Time to Buy and Sell Stock

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Google, Meta, Bloomberg
- **Frequency:** 🔥 High
- **Interview Context:** This is the foundational problem for greedy state accumulation. Finding the maximum difference between two elements where the smaller element must precede the larger element.

### 🔹 1. Problem Explanation
Given an array `prices` where `prices[i]` is the price of a stock on the `ith` day, maximize your profit by choosing exactly one day to buy and one future day to sell. 
- **Real-world analogy:** Literal Stock Market day trading. You must buy before you can sell. You want the highest peak that occurs *after* the deepest valley.
- **Input:** `prices = [7, 1, 5, 3, 6, 4]`
- **Output:** `5` (Buy at 1 on Day 2, Sell at 6 on Day 5). 
- **Constraints:** Cannot buy at 7 and sell at 1 for profit (time travels forward only).

### 🔹 2. Data Structure Masterclass
- **DS Used:** Array with primitive trackers.
- **Why chosen:** Pure sequential linear scan.
- **Time complexity benefits:** We don't need $O(N^2)$ to compare every combination. $O(N)$ allows real-time metric updates.

### 🔹 3. Pattern Recognition
- **Pattern name:** Greedy State Tracking (Min/Max synchronization).
- **WHEN to use:** When asked to find a maximum difference or maximum profit following a strict chronological order.
- **HOW to identify:** Keywords "buy and sell", "max profit", "one transaction".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** Use a double loop. For every day, check every subsequent day to see the profit margin. Track the maximum.
- **Complexity:** Time $O(N^2)$, Space $O(1)$. TLE on $10^5$ constraints.

#### ✅ Approach 2: Optimal Approach
- **Best solution idea:** I don't need to look ahead redundantly. As I scan day by day, what is my ultimate operational rule? **"To make maximum profit today, I should have bought the stock at the lowest price seen so far in history."** 
  - So, use a variable `minPrice` to track the lowest historical price encountered. 
  - On any day, `potentialProfit = currentPrice - minPrice`. 
  - Update `maxProfit` if `potentialProfit` is higher.
- **Optimal Java Code:**
```java
public class StockBuySell {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE; // Track lowest price seen so far
        int maxProfit = 0;                // Track absolute best profit achievable
        
        for (int price : prices) {
            // Can we buy cheaper today?
            if (price < minPrice) {
                minPrice = price;
            } 
            // If not buying today, let's see what happens if we sell today
            else {
                int currentProfit = price - minPrice;
                if (currentProfit > maxProfit) {
                    maxProfit = currentProfit;
                }
            }
        }
        
        return maxProfit;
    }
}
```

### 🔹 5. Dry Run
Input: `prices = [7, 1, 5, 3, 6, 4]`
- Init: `minPrice = INF`, `maxProfit = 0`
1. `p = 7`: `p < min` $\implies$ `minPrice = 7`.
2. `p = 1`: `p < min` $\implies$ `minPrice = 1`. (New absolute low!).
3. `p = 5`: `p > min`. `profit = 5 - 1 = 4`. `maxProfit = 4`.
4. `p = 3`: `p > min`. `profit = 3 - 1 = 2`. `maxProfit` stays 4.
5. `p = 6`: `p > min`. `profit = 6 - 1 = 5`. `maxProfit = 5`.
6. `p = 4`: `p > min`. `profit = 4 - 1 = 3`. `maxProfit` stays 5.
Result: 5.

### 🔹 6. Architectural Thinking
- **WHAT:** Decoupling Future evaluation from Past dependencies via Caching.
- **WHERE:** A single chronological pass over time-series data.
- **HOW:** By persisting the optimal foundational state (`minPrice`) globally, every future node only needs an $O(1)$ computation against cache, deleting the need for an inner loop!
- **WHEN:** Checked sequentially on every tick.
- **WHO:** This maps directly to High-Frequency Trading (HFT) stream processing algorithms that calculate deltas over rolling windows without buffering arrays!

### 🔹 7. Edge Cases
- **Descending Array (`[7, 6, 4, 3, 1]`):** `minPrice` updates constantly, but the `else` block NEVER executes because price never goes up. `maxProfit` remains `0`. You correctly lose no money. Correct behavior!

### 🔹 8. Clean Code
- **Readability:** Using pure `if/else` branching visually perfectly segregates "Buying Logic" from "Selling Logic". Avoid ternary operator bloat for this specific problem to keep the logic undeniably clear to reviewers.

### 🔹 9. Interview Training
- **Common follow-up:** "What if you can buy and sell multiple times?" (Stock Buy and Sell II).
  - Answer: "Then my strategy fundamentally flips from tracking global minimums to aggregating localized deltas. I would just add `prices[i] - prices[i-1]` to my absolute profit every time the price goes strictly up, turning it into a localized greedy accumulator!"

---

## 📝 DAILY SUMMARY

### 🎯 Patterns Learned Today
1. **Kadane's Aggressive Termination:** Resetting accumulators to absolute zeroes immediately when payload goes critically negative.
2. **Dijkstra's Dutch National Flag:** Swapping into solid territorial boundaries (`low`, `high`) while leaving unverified edge insertions dynamically in the testing loop (`mid`).
3. **Chronological Greedy State (Buy/Sell):** Resolving nested loop dependencies by maintaining a strictly historical $O(1)$ marker (`min_history`) to instantaneously calculate $O(1)$ operational deltas (`current - min_history`).

### ⚖️ Decision Rules
- If dealing with **Contiguous Subarray sums** featuring negatives $\implies$ Use **Kadane's**.
- If dealing with **3 Distinct Element Categories** $\implies$ Use **3-pointer DNF**.
- If doing **Maximum Delta / Profit** restricted chronologically $\implies$ Use **Greedy Min Tracker**.

### ⚠ Key Mistakes to Avoid
- **Kadane's:** Returning `0` instead of `-1` on arrays with all negative numbers because you initialized `maxSum=0`. Always use `MIN_VALUE`.
- **Sort Colors:** Incrementing the `mid` pointer after swapping with `high`. If you swapped a `0` back from the end of the array to `mid` and skip it, your array will be permanently corrupted.

***See you tomorrow for Day 3: Array Rotations & Merging!***
