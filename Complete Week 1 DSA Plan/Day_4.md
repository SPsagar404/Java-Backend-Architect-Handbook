# Day 4: Hashing & Two Pointers Fundamentals

Welcome to Day 4! Today marks a paradigm shift. So far, we have manipulated data exclusively within contiguous memory constraints (Arrays). Today, we introduce **Hashing**—sacrificing predictable $O(N)$ Space to achieve instantaneous $O(1)$ Time lookups. Combining Hashing with strict sequential logic (Two Pointers) creates the most ubiquitous problem-solving framework in all of Software Engineering. 

---

## 🔥 Problem 1: Two Sum

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Google, Apple, Meta
- **Frequency:** 🔥 High
- **Interview Context:** This is arguably the most famous interview question on earth (LeetCode #1). It tests a very specific conceptual leap: Can you transition from a "Look-Ahead" mentality ($O(N^2)$ brute force) to a "Look-Behind" mentality using structural caching?

### 🔹 1. Problem Explanation
Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume exactly one solution exists, and you may not use the same element twice.
- **Real-world analogy:** You have $100. You need to buy exactly two items from a store that equal exactly $100. You pick up a $40 shirt. Instead of searching the whole store again for a $60 item, you ask the cashier: "Hey, have you already seen a $60 item today?"
- **Input:** `nums = [2, 7, 11, 15]`, `target = 9`
- **Output:** `[0, 1]`
- **Constraints:** Must be slower than $O(N^2)$, optimally $O(N)$.

### 🔹 2. Data Structure Masterclass
- **DS Used:** `HashMap<Integer, Integer>`
- **Why chosen:** Arrays only allow $O(1)$ retrieval if you know the *Index*. HashMaps allow $O(1)$ retrieval using the *Value itself* as the Key!
- **Internal working:** The integer Key is passed through Java's `.hashCode()` formula to generate a bucket index. The Value (the array index) is stored there.
- **Trade-offs:** We allocate $O(N)$ extra memory on the Heap. Hardware caches (L1/L2) hate HashMaps compared to contiguous Arrays due to pointer indirection.

### 🔹 3. Pattern Recognition
- **Pattern name:** Algebraic Complement Hashing (Look-Behind Cache).
- **WHEN to use:** When searching for independent pairs that satisfy a mathematical formula (`A + B = Target`) in an **UNSORTED** array.
- **HOW to identify:** Keywords "Two elements", "Sum to target", "Return indices".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force (Look-Ahead)
- **Thinking:** For every number `A`, scan the rest of the array looking for `Target - A`. 
- **Code:**
```java
public int[] twoSumBruteForce(int[] nums, int target) {
    for (int i = 0; i < nums.length; i++) {
        for (int j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] == target) {
                return new int[]{i, j};
            }
        }
    }
    return new int[]{};
}
```
- **Complexity:** Time $O(N^2)$, Space $O(1)$.

#### ✅ Approach 2: Better Approach (Sorting + Two Pointers)
- **Idea:** What if we sort the array? Then we can put a pointer at `left=0` and `right=N-1` and squeeze inward!
- **Fatal Flaw:** The problem asks to return the *original indices*. Sorting the array scrambles the original indices! You would have to create a custom `Node` class containing `{value, originalIndex}`, sort an array of Nodes, and then Two-Pointer it.
- **Complexity:** Time $O(N \log N)$, Space $O(N)$ (for the Node array). If we are using $O(N)$ space anyway, we can do faster than $O(N \log N)$!

#### ✅ Approach 3: Optimal Approach (One-Pass HashMap)
- **Best solution idea:** Create an algebraic equation. `CurrentValue + X = Target` mathematically means `X = Target - CurrentValue`. 
  - As we iterate through the array, we check: "Is `X` in my HashMap of past numbers?"
  - If YES: We found it! We return `[Map.get(X), CurrentIndex]`.
  - If NO: We store `[CurrentValue, CurrentIndex]` into the Map for future numbers to find!
- **Optimal Java Code:**
```java
import java.util.HashMap;

public class TwoSum {
    public int[] twoSumOptimal(int[] nums, int target) {
        // Map stores (Number Value -> Original Index)
        HashMap<Integer, Integer> map = new HashMap<>();
        
        for (int i = 0; i < nums.length; i++) {
            int currentNum = nums[i];
            int requiredComplement = target - currentNum;
            
            // Look-Behind: Did we already see the required number?
            if (map.containsKey(requiredComplement)) {
                return new int[]{map.get(requiredComplement), i};
            }
            
            // Record current state for the future
            map.put(currentNum, i);
        }
        
        throw new IllegalArgumentException("No two sum solution");
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [3, 2, 4]`, `target = 6`
1. `i = 0` (val `3`). `complement = 6 - 3 = 3`. Map has 3? No. Map.put(`3 $\rightarrow$ 0`).
2. `i = 1` (val `2`). `complement = 6 - 2 = 4`. Map has 4? No. Map.put(`2 $\rightarrow$ 1`).
3. `i = 2` (val `4`). `complement = 6 - 4 = 2`. Map has 2? YES! Value is index `1`.
4. Return `[1, 2]`.

### 🔹 6. Architectural Thinking
- **WHAT:** $O(1)$ Historical state querying via Hash Indexing.
- **WHERE:** Stream processing data lazily.
- **HOW:** Storing the inverse-computational requirement dynamically. We don't store "what we need", we store "what we have", and query "what we need" against it.
- **WHEN:** Checked synchronously *before* the current state is committed to memory to prevent a number from matching against itself!
- **WHO:** This pattern mimics Session Caching mechanisms in stateless web servers!

### 🔹 7. Edge Cases
- **Duplicate Elements (`[3, 3]`, target 6):** The order of operations is brilliant here. At `i=0` (val 3), map is empty, we put `3->0`. At `i=1` (val 3), complement `3` is IN the map! It returns `[0, 1]` without ever overwriting the map with `3->1`.
- **Negatives (`[-1, -2, 3]`, target 1):** Math `-1 + 2 = 1` natively. Java handles signed integers automatically.

### 🔹 8. Clean Code
- **Throwing Exceptions:** In production, if a method guarantees a return array but the loop finishes without finding one, throwing an `IllegalArgumentException` is vastly superior to returning `null` or `new int[]{}` which causes silent NullPointerExceptions upstream.

### 🔹 9. Interview Training
- **Senior Insight:** Interviewers might ask: "Is the HashMap ALWAYS better?" 
  - Answer: "Actually, no. If the array is massive and memory is highly constrained (embedded systems), allocating $O(N)$ Heap space for a Map might trigger an OutOfMemoryError. In that scenario, the Sorting + Two Pointers approach ($O(N \log N)$ Time, $O(1)$ Space) is architecturally safer despite being mathematically slower. Best tool for the specific constraint."

---

## 🔥 Problem 2: 4Sum

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Apple, Meta
- **Frequency:** ⚡ Medium
- **Interview Context:** Anyone can solve Two Sum. This problem tests your ability to abstract higher-order complexity (K-Sum) down into fundamental primitives. It strictly tests your mastery of avoiding duplicates without using excessive HashSets.

### 🔹 1. Problem Explanation
Given an array `nums` of `n` integers, return an array of all the **unique** quadruplets `[nums[a], nums[b], nums[c], nums[d]]` such that they sum to `target`.
- **Real-world analogy:** Combining exactly 4 specific ingredients from a pantry to make a recipe weighing exactly 10 lbs. You don't want to list "Flour, Sugar, Eggs, Milk" and then again "Eggs, Flour, Milk, Sugar" as two different recipes.
- **Constraints:** `a, b, c, d` are distinct indices. Output must NOT contain duplicate quadruplets.

### 🔹 2. Data Structure Masterclass
- **DS Used:** `List<List<Integer>>` + Sorted Array.
- **Why chosen:** Sorting intrinsically groups duplicates ($1, 4, 4, 4, 7$). This allows us to use simple `if (nums[i] == nums[i-1]) skip` logic instead of buffering millions of heavy `String` hashes into a Set.

### 🔹 3. Pattern Recognition
- **Pattern name:** K-Sum Reduction (Anchor loops + Two Pointers).
- **WHEN to use:** Asking for 3, 4, or K elements summing to a target, demanding Unique Sets.
- **HOW to identify:** "Unique quadruplets", "4Sum", "Target".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** 4 nested loops. Sum everything. To ensure randomness is killed, sort every matching quadruplet and add to a `HashSet`.
- **Complexity:** Time $O(N^4)$, Space $O(K)$ for HashSet. Awful.

#### ✅ Approach 2: Better Approach (3 Loops + Binary Search/HashSet)
- **Thinking:** Fix 3 elements with loops. Use Binary Search ($O(\log N)$) or a HashMap to find the 4th element.
- **Complexity:** Time $O(N^3 \log N)$, Space $O(N)$. Still very slow.

#### ✅ Approach 3: Optimal Approach (Sort + Two Pointers)
- **Best solution idea:** The 2Sum problem took 2 pointers ($L, R$). The 3Sum problem took 1 anchor loop `i`, plus 2 pointers ($L, R$). Following the fractal pattern, 4Sum takes 2 anchor loops (`i`, `j`), plus 2 pointers ($L, R$)!
  - Step 1: Sort the array.
  - Step 2: Loop `i` from $0 \to N-3$. (Skip duplicates).
  - Step 3: Loop `j` from $i+1 \to N-2$. (Skip duplicates).
  - Step 4: The problem is now reduced to 2Sum! Target is `target - (nums[i] + nums[j])`. Squeeze `L` and `R` inward.
- **Optimal Java Code:**
```java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class FourSum {
    public List<List<Integer>> fourSumOptimal(int[] nums, int target) {
        List<List<Integer>> result = new ArrayList<>();
        int n = nums.length;
        if (n < 4) return result;
        
        // 1. Sort the array to group duplicates and enable L/R convergence
        Arrays.sort(nums);
        
        for (int i = 0; i < n - 3; i++) {
            // Skip duplicate anchor i
            if (i > 0 && nums[i] == nums[i - 1]) continue;
            
            for (int j = i + 1; j < n - 2; j++) {
                // Skip duplicate anchor j
                if (j > i + 1 && nums[j] == nums[j - 1]) continue;
                
                int left = j + 1;
                int right = n - 1;
                
                while (left < right) {
                    // Use long to prevent integer overflow adding 4 large numbers
                    long sum = (long)nums[i] + nums[j] + nums[left] + nums[right];
                    
                    if (sum == target) {
                        result.add(Arrays.asList(nums[i], nums[j], nums[left], nums[right]));
                        
                        // Shrink pointers
                        left++;
                        right--;
                        
                        // Skip duplicates for left and right
                        while (left < right && nums[left] == nums[left - 1]) left++;
                        while (left < right && nums[right] == nums[right + 1]) right--;
                        
                    } else if (sum < target) {
                        left++;
                    } else {
                        right--;
                    }
                }
            }
        }
        return result;
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [1, 0, -1, 0, -2, 2]`, `target = 0`
- Sort: `[-2, -1, 0, 0, 1, 2]`
- `i=0` (-2). `j=1` (-1). 
  - `L=2`(0), `R=5`(2). Sum: `-2 -1 + 0 + 2 = -1 < 0`. `L++`.
  - `L=3`(0), `R=5`(2). Sum: `-2 -1 + 0 + 2 = -1 < 0`. `L++`.
  - `L=4`(1), `R=5`(2). Sum: `-2 -1 + 1 + 2 = 0`. MATCH! Add `[-2, -1, 1, 2]`. 
- `i=0` (-2). `j=2` (0).
  - `L=3`(0), `R=5`(2). Sum: `-2 + 0 + 0 + 2 = 0`. MATCH! Add `[-2, 0, 0, 2]`.
- (The loops natively leap over the duplicate `0`s due to the `continue` and inner `while` checks, producing strictly unique answers!)

### 🔹 6. Architectural Thinking
- **WHAT:** Dimensionality Reduction via loop fixing.
- **WHERE:** Operating recursively on sub-arrays (`j+1 \to N-1`).
- **HOW:** Iteratively locking higher-dimensional variables to collapse an $O(N^4)$ problem space strictly down into the foundational $O(N)$ 2Sum paradigm.
- **WHEN:** Duplicate stripping is handled synchronously as pointers traverse the data.
- **WHO:** This abstraction is the architectural core of compiling relational SQL JOIN queries!

### 🔹 7. Edge Cases
- **Integer Overflows:** The test cases famously feature Arrays with `Integer.MAX_VALUE`. Adding them up overflows instantly. Casting to `(long)` during the `sum` calculation is a strictly Senior-level requirement.

### 🔹 8. Clean Code
- **Readability:** Keep the 4 inner skipping mechanisms visually distinct.
- `if (i > 0 && nums[i] == nums[i - 1])`
- `if (j > i + 1 && nums[j] == nums[j - 1])`
- `while (left < right && nums[left] == nums[left - 1])`
- `while (left < right && nums[right] == nums[right + 1])`

### 🔹 9. Interview Training
- **Mistakes to avoid:** Using a `HashSet<List<Integer>>` to filter duplicates at the return statement. Interviewers view this as lazy and inefficient. Mastering the adjacent duplicate skipping logic (`if a == a-1 continue`) proves raw algorithmic mastery.

---

## 🔥 Problem 3: Longest Consecutive Sequence

### 🔹 0. Company Tagging
- **Asked in:** Google, Amazon, Microsoft
- **Frequency:** 🔥 High
- **Interview Context:** This problem seems impossible on paper. "Find the longest sequence in $O(N)$ time in an UN-SORTED array". It tests if you understand how to utilize HashSets not just for searching, but as isolated Graph nodes.

### 🔹 1. Problem Explanation
Given an unsorted array of integers `nums`, return the length of the longest consecutive elements sequence.
- **Real-world analogy:** You have a scattered pile of puzzle pieces with numbers on them. You want to snap together the longest connected chain (`100, 101, 102`). Finding them one by one in the pile takes forever.
- **Input:** `nums = [100, 4, 200, 1, 3, 2]`
- **Output:** `4` (The sequence is `[1, 2, 3, 4]`).
- **Constraints:** Must execute strictly in $O(N)$ time!

### 🔹 2. Data Structure Masterclass
- **DS Used:** `HashSet<Integer>`
- **Why chosen:** Lookups take exactly $O(1)$ time. 
- **Time complexity benefits:** We can theoretically check if `current_number + 1` exists in the array instantly without scanning the array!

### 🔹 3. Pattern Recognition
- **Pattern name:** Intelligent Sequence Building (Disjoint Set abstraction).
- **WHEN to use:** "Consecutive Sequence", "Unsorted array", "O(N) time constraint".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** For every number, linearly check if `num+1` exists in the array, then `num+2`, etc.
- **Complexity:** Time $O(N^3)$ worst case. Disaster.

#### ✅ Approach 2: Better Approach (Sorting)
- **Thinking:** Just sort the array! Then run one loop counting how many adjacent elements increase by exactly $1$.
- **Complexity:** Time $O(N \log N)$ (violates $O(N)$ rule). Space $O(1)$. It's actually a very decent fallback if you forget the optimal approach in an interview, but won't get you a "Strong Hire" rating at Google.

#### ✅ Approach 3: Optimal Approach (HashSet Sequence Builder)
- **Best solution idea:** 
  - Dump all numbers into a `HashSet`. This gives us $O(1)$ lookups.
  - Iterate over the Set. Pick a number (like `100`).
  - **The Genius Move:** *Is `100` the START of a sequence?* How do we know? If `99` exists in the set, then `100` is NOT the start! It's just a middle piece! We skip it instantly.
  - If `99` does NOT exist in the set, then `100` IS the start of a sequence! From there, we use a `while(set.contains(num + 1))` loop to count upwards (`101`, `102`...).
- **Why does this beat $O(N^2)$?** The inner `while` loop ONLY triggers if the number is the absolute start of a sequence. This guarantees every number is visited exactly twice overall (once building the map, once evaluated in the inner loop). $O(2N) = O(N)$.
- **Optimal Java Code:**
```java
import java.util.HashSet;

public class LongestConsecutive {
    public int longestConsecutiveOptimal(int[] nums) {
        if (nums == null || nums.length == 0) return 0;
        
        HashSet<Integer> set = new HashSet<>();
        for (int num : nums) {
            set.add(num);
        }
        
        int longestStreak = 0;
        
        for (int num : set) { // Iterate over set to avoid duplicate start-points
            // Look-Behind: Is this number the true start of a sequence?
            // If num - 1 exists, this 'num' is just a middle piece. Skip it!
            if (!set.contains(num - 1)) {
                
                int currentNum = num;
                int currentStreak = 1;
                
                // Look-Ahead: Count upwards as long as the chain connects
                while (set.contains(currentNum + 1)) {
                    currentNum += 1;
                    currentStreak += 1;
                }
                
                longestStreak = Math.max(longestStreak, currentStreak);
            }
        }
        
        return longestStreak;
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [100, 4, 200, 1, 3, 2]`
- Map state: `{100, 4, 200, 1, 3, 2}`
- Loop `num=100`: Concept check: Does 99 exist? No! Sequence bounds `[100]`. Loop checks 101. Doesn't exist. Max=1.
- Loop `num=4`: Does 3 exist? YES! It's not a start. Skip!
- Loop `num=200`: Does 199 exist? No! Bounds `[200]`. 201 missing. Max=1.
- Loop `num=1`: Does 0 exist? No! It's a start!
  - `while(contains(1 + 1))`: found 2. Streak=2.
  - `while(contains(2 + 1))`: found 3. Streak=3.
  - `while(contains(3 + 1))`: found 4. Streak=4.
  - `while(contains(4 + 1))`: not found. End. Max=4.
- Loop `num=3`: Does 2 exist? Yes! Skip.
- Result: 4.

### 🔹 6. Architectural Thinking
- **WHAT:** Graph theory Connected Components via Dictionary abstractions.
- **WHERE:** Uncoupled nodes floating in a Hash table.
- **HOW:** Exploiting the `!contains(n-1)` check as a theoretical "Root Node" finder for disconnected graph chains. By only traversing starting from root nodes, we prevent redundant loop cycles!
- **WHEN:** Stream evaluation mapped directly to hash space.
- **WHO:** Using Sets to natively group continuous memory segments is exactly how Garbage Collectors evaluate contiguous Heap blocks!

### 🔹 7. Edge Cases
- **Empty Array:** Triggers `length == 0` guard clause. Returns 0.
- **Duplicate Sequences (`[1, 2, 0, 1]`):** The `HashSet` ingests duplicates silently (`{1, 2, 0}`). It processes `0`, finds `1` and `2`, yielding length 3 seamlessly.

### 🔹 8. Clean Code
- **Readability:** Iterating `for (int num : set)` instead of `for (int num : nums)` is a massive micro-optimization. If the input is `[0, 0, 0, 0]`, iterating the set triggers the outer loop exactly once. Iterating `nums` triggers it four times needlessly.

### 🔹 9. Interview Training
- **Senior Check:** The interviewer WILL ask: *"You have a `for` loop, and an inner `while` loop. Are you SURE this is $O(N)$ time?"*
- **The Golden Answer:** *"Yes. The `if (!set.contains(num - 1))` is a mathematical gatekeeper. It guarantees the inner `while` loop ONLY executes for the very first element of any sequence. Therefore, across the entire duration of the program, the `while` loop will only step over each array element exactly once. Over $N$ iterations, the inner loop fires cumulatively $N$ times, making it strictly $O(N + N) = O(N)$."*

---

## 📝 DAILY SUMMARY

### 🎯 Patterns Learned Today
1. **Look-Behind Caching (Two Sum):** Flipping calculations backwards to turn $O(N^2)$ look-aheads into $O(1)$ historical Hash queries.
2. **K-Sum Dimensional Collisions (4Sum):** Utilizing monotonic sorting and skip-logic to compress 4 degrees of freedom into 2 anchored loops and a linear squeeze.
3. **Graph Root Identification (Longest Sequence):** Applying rule-based bounds `!contains(n-1)` to logically identify the head of a sequence amidst pure random distribution, circumventing Sorting matrices entirely.

### ⚖️ Decision Rules
- If given a math problem and **Target K** in an **unsorted** array $\implies$ Think `HashMap (Current + X = K)`.
- If requested to provide combinations of **Unique Sub-elements** $\implies$ ALWAYS sort the array, and use strict indexing skips (`a == a-1`). HashSets for duplicate removal are inefficient crutches.
- If finding the **Longest Sequence** in an $O(N)$ constraint $\implies$ Dump to a HashSet, and logically hunt exclusively for the "Start Nodes" of the sequences.

### ⚠ Key Mistakes to Avoid
- **Two Sum:** Using the same element twice. Always check the hashmap *before* putting the current element into the hashmap!
- **4Sum:** Overlooking the Integer Overflow bug when adding 4 array elements together. Use `(long)` carefully!
- **Longest Consecutive Sequence:** Forgetting the `!contains(n-1)` check. Without it, the solution deteriorates back into a catastrophic $O(N^2)$ timeframe.

***See you tomorrow for Day 5: Hashing & Prefix Sum Advanced!***
