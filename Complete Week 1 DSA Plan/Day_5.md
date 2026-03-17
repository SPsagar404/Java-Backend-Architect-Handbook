# Day 5: Hashing & Prefix Sum Advanced

Welcome to Day 5! If Day 4 taught us how to query single elements in $O(1)$ time, Day 5 teaches us how to query **entire sub-ranges of history** in $O(1)$ time. This is where we master the `Prefix Array` logic combined with HashMaps. This logic is arguably the most requested array pattern for Senior-level Backend roles, as it perfectly mimics rolling log aggregations and distributed event stream analysis.

---

## 🔥 Problem 1: Largest Subarray with 0 Sum

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Microsoft, ByteDance
- **Frequency:** 🔥 High
- **Interview Context:** This tests your transition from "Two Pointers" to "Prefix Sums". Standard Two Pointers only works if the array is Monotonic (strictly positive integers). Once negative numbers are introduced, sliding windows break. You *must* recognize that algebraic equations on running totals are required.

### 🔹 1. Problem Explanation
Given an array containing both positive and negative integers, find the length of the longest subarray with a sum equal to 0.
- **Real-world analogy:** Finding the longest period where a company's financial profit and loss exactly canceled each other out to dead-even 0.
- **Input:** `nums = [15, -2, 2, -8, 1, 7, 10, 23]`
- **Output:** `5` (The subarray `[-2, 2, -8, 1, 7]` sums exactly to 0.)
- **Constraints:** Maximize time efficiency ($O(N)$ expected).

### 🔹 2. Data Structure Masterclass
- **DS Used:** `HashMap<Integer, Integer>` (Prefix Sum Map).
- **Why chosen:** We need to store mathematical states (the running sum) as the Key, and geographical points (the original index) as the Value.
- **Time complexity benefits:** Re-calculating `sum(i, j)` natively takes $O(N)$ time. By hashing `PrefixSum(j) - PrefixSum(i)`, we calculate range sums in $O(1)$ time.

### 🔹 3. Pattern Recognition
- **Pattern name:** Prefix Sum Hashing (Zero-Delta Tracking).
- **WHEN to use:** Questions asking for constraints on "Subarrays" when the array contains NEGATIVE numbers. (If only positives, use Sliding Window. If negatives, MUST use Prefix Sum Map).
- **HOW to identify:** "Subarray", "Sum equals K", "Sum equals 0".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** Check every single subarray boundary `[i...j]`. If the sum is 0, record length.
- **Complexity:** Time $O(N^2)$, Space $O(1)$. 

#### ✅ Approach 2: Optimal Approach (Prefix Sum Map)
- **Best solution idea:** Maintain a running cumulative sum as you iterate left-to-right. 
  - Stop and think: Let's say at index `2`, my running sum is `10`. I keep iterating. 
  - At index `7`, my running sum is *again* `10`. 
  - What does this mathematically prove? It proves that all the numbers I added *between* index `3` and `7` must have completely canceled each other out! The "Delta" between the two states is exactly `0`.
  - **The Algorithm:** As we calculate the running sum, insert `[RunningSum -> CurrentIndex]` into our HashMap. 
    1. If `RunningSum == 0`, the subarray from the absolute beginning to right now is a valid 0-sum.
    2. If `RunningSum` already exists in the HashMap, a cycle has occurred. The sequence between the old index and the current index sums exactly to 0. Distance = `CurrentIndex - OldIndex`.
- **Optimal Java Code:**
```java
import java.util.HashMap;

public class LargestSubarrayZeroSum {
    public int maxLenOptimal(int[] nums) {
        // Map stores (Cumulative Sum -> FIRST Index seen)
        HashMap<Integer, Integer> prefixMap = new HashMap<>();
        
        int maxLength = 0;
        int currentSum = 0;
        
        for (int i = 0; i < nums.length; i++) {
            currentSum += nums[i];
            
            // Case 1: The entire array from index 0 to i sums to 0
            if (currentSum == 0) {
                maxLength = i + 1;
            }
            
            // Case 2: We have seen this exact cumulative sum before
            if (prefixMap.containsKey(currentSum)) {
                // We do NOT update the map with the new index. 
                // We want the LONGEST subarray, so we must keep the oldest, leftmost index!
                int previousIndex = prefixMap.get(currentSum);
                maxLength = Math.max(maxLength, i - previousIndex);
            } else {
                // Case 3: We have never seen this sum. Record its first appearance.
                prefixMap.put(currentSum, i);
            }
        }
        
        return maxLength;
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [15, -2, 2, -8, 1, 7, 10]`
- init: `maxLen = 0`, `currentSum = 0`, map={}
1. `i = 0` (15): `sum = 15`. Map puts `(15 $\rightarrow$ 0)`.
2. `i = 1` (-2): `sum = 13`. Map puts `(13 $\rightarrow$ 1)`.
3. `i = 2` (2): `sum = 15`. Map HAS 15! 
   - We saw `sum=15` previously at index `0`. 
   - Distance: `i(2) - old(0) = 2`. `maxLen = max(0, 2) = 2`.
4. `i = 3` (-8): `sum = 7`. Map puts `(7 $\rightarrow$ 3)`.
5. `i = 4` (1): `sum = 8`. Map puts `(8 $\rightarrow$ 4)`.
6. `i = 5` (7): `sum = 15`. Map HAS 15! 
   - We saw `sum=15` at index `0` (notice we kept the oldest index!).
   - Distance: `i(5) - old(0) = 5`. `maxLen = max(2, 5) = 5`.
7. Loop ends. Output `5`.

### 🔹 6. Architectural Thinking
- **WHAT:** Stateful baseline anchoring.
- **WHERE:** Stream aggregation processing.
- **HOW:** Storing the earliest occurrence of a dimensional state allows us to identify cyclical net-zero deviations natively. 
- **WHEN:** Hashing the scalar value synchronously immediately blocks redundant index updating.
- **WHO:** This pattern of storing baseline offsets to calculate range differences is identical to Kafka Stream Commits tracking event consumptions!

### 🔹 7. Edge Cases
- **All zeroes (`[0, 0, 0]`):** 
  - `i=0, sum=0`. `max=1`. Map `(0->0)`. 
  - `i=1, sum=0`. Map has 0 (at 0). `max=max(1, 1-0) = 1` (Wait... this is wrong!).
  - Ah! Look at the code. `if (currentSum == 0)` runs BEFORE the map checks, and it sets `maxLength = i + 1`. This elegantly catches the 0-sum explicitly from the start, so `maxLength = 2` correctly!

### 🔹 8. Clean Code
- **Critical Control Flow:** Notice `else { prefixMap.put(...) }`. We explicitly ONLY place the sum into the map if it doesn't already exist. Since we want the *longest* line, overwriting a sum's index with a newer, closer index would physically shorten the resulting sequence.

### 🔹 9. Interview Training
- **Mistakes to avoid:** A Junior will try to solve this with a Sliding Window (Two Pointers squeezing together). When asked why it fails, immediately explain: *"Sliding Window boundaries operate by growing when the sum is too small, and shrinking when the sum is too big. Negative numbers destroy this logic, because growing the window might actually SHRINK the mathematical sum. Prefix Sum is mathematically mandatory here."*

---

## 🔥 Problem 2: Subarrays with XOR K

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Google, Meta 
- **Frequency:** ⚡ Medium
- **Interview Context:** This is the hardcore bitwise evolution of the Prefix Sum logic. It combines identical Hash Map logic with deeply computer-science specific boolean XOR (`^`) algebra. If you master this, you prove extreme theoretical competence over raw bytes.

### 🔹 1. Problem Explanation
Given an array of integers `nums` and an integer `K`, return the total *number* of continuous subarrays whose bitwise XOR evaluates exactly to `K`.
- **Bits Refresher:** XOR (`^`) returns `1` if the bits are different, and `0` if they are the same. A magical property of XOR is that $A \oplus A = 0$, and if $A \oplus B = C$, then absolutely $A \oplus C = B$.
- **Input:** `nums = [4, 2, 2, 6, 4]`, `k = 6`
- **Output:** `4` (The subarrays are `[4, 2]`, `[4, 2, 2, 6, 4]`, `[2, 2, 6]`, and `[6]`).

### 🔹 2. Data Structure Masterclass
- **DS Used:** `HashMap<Integer, Integer>` (Prefix XOR Frequency Map)
- **Why chosen:** Unlike the "0 Sum" problem that wanted maximum *Length* (storing older Indices), this problem wants total *Count* of valid arrays. The HashMap value must track `Frequency`, not Index!

### 🔹 3. Pattern Recognition
- **Pattern name:** Algebraic Prefix Frequency Map.
- **WHEN to use:** "Count of Subarrays" combined with "Sum K" or "XOR K". 
- **HOW to identify:** Keywords "subarrays evaluate to K", "Total count".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** Double `for` loop, XORing inner ranges continuously. 
- **Complexity:** Time $O(N^2)$, Space $O(1)$. 

#### ✅ Approach 2: Optimal Approach (Prefix XOR Map)
- **Best solution idea:** The math mirrors the Two-Sum / Prefix-Sum logic completely.
  - Let `currentXor` be the XOR of elements from index 0 to `i`.
  - We want to find some chunk in the history that leaves a remainder of exactly `K`.
  - Equation: `currentXor ^ historyXor = K`. 
  - Using XOR rules ($A \oplus B = C \implies A \oplus C = B$): `historyXor = currentXor ^ K`.
  - We just need to check: **"How many times have we seen the value `(currentXor ^ K)` in the past?"** Add that frequency to our total answer.
- **Optimal Java Code:**
```java
import java.util.HashMap;

public class SubarraysWithXorK {
    public int countSubarraysOptimal(int[] nums, int k) {
        // Map stores (Cumulative XOR -> Frequency Seen)
        HashMap<Integer, Integer> xorFreqMap = new HashMap<>();
        
        // Critical base case: The "empty prefix" before the array starts has an XOR of 0.
        // It has been seen exactly 1 time.
        xorFreqMap.put(0, 1);
        
        int currentXor = 0;
        int totalCount = 0;
        
        for (int num : nums) {
            currentXor = currentXor ^ num;
            
            // Equation: What prefix XOR do we mathematically need to chop off to leave exactly K?
            int requiredPrefixXor = currentXor ^ k;
            
            // If we've seen this prefix before, every recorded instance forms a valid subarray!
            if (xorFreqMap.containsKey(requiredPrefixXor)) {
                totalCount += xorFreqMap.get(requiredPrefixXor);
            }
            
            // Register this currentXor into history for future iterations to use
            xorFreqMap.put(currentXor, xorFreqMap.getOrDefault(currentXor, 0) + 1);
        }
        
        return totalCount;
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [4, 2, 2, 6, 4]`, `K = 6`. Map starts with `{0: 1}`. Total=0.
1. `num=4`: `current = 0^4 = 4`. Req = `4^6 = 2`. Map has 2? No. Add `4` to map $\implies$ `{0:1, 4:1}`.
2. `num=2`: `current = 4^2 = 6`. Req = `6^6 = 0`. Map has 0? YES, freq `1`! Total=1 (subarray `[4, 2]`). Add `6` $\implies$ `{0:1, 4:1, 6:1}`.
3. `num=2`: `current = 6^2 = 4`. Req = `4^6 = 2`. Map has 2? No. Add `4` $\implies$ `{0:1, 4:2, 6:1}`.
4. `num=6`: `current = 4^6 = 2`. Req = `2^6 = 4`. Map has 4? YES, freq `2`! Total=1+2=3. (subarray `[2, 2, 6]` and `[4, 2, 2, 6]`). Add `2` $\implies$ `{0:1, 4:2, 6:1, 2:1}`.
5. `num=4`: `current = 2^4 = 6`. Req = `6^6 = 0`. Map has 0? YES, freq `1`! Total=3+1=4. (subarray `[6]`). Add `6`.
Result: 4. Correct!

### 🔹 6. Architectural Thinking
- **WHAT:** Look-behind Frequency Accumulation.
- **WHERE:** Stateful iteration relying on Bitwise symmetric properties.
- **HOW:** Storing the occurrences of dimensional states natively acts as a Multiplier—one historical state matching our requirement proves $N$ intersecting boundaries.
- **WHEN:** We *must* initialize the baseline `0` state to `1`, otherwise valid subarrays starting precisely at index 0 will mathematically slip through the evaluation logic uncounted.
- **WHO:** XOR logic masking is how Cryptography (specifically stream ciphers and hashing salts) evaluates block permutations rapidly!

### 🔹 7. Edge Cases
- Subarray evaluates straight to `K` spanning from index 0. The initialization `xorFreqMap.put(0, 1)` perfectly isolates this. If `currentXor == K`, then `K ^ K = 0`. Map returns `1`. Perfectly captures it!

### 🔹 8. Clean Code
- `map.put(key, map.getOrDefault(key, 0) + 1)` is the gold standard in Java for updating frequency maps on one pristine line without ugly null-checking blocks.

### 🔹 9. Interview Training
- **Junior Pitfall:** Solving "Largest Subarray 0" by storing the `Index`, and then blindly trying to solve "Count XOR K" by storing the `Index` as well.
- **Senior Check:** "Wait, the interviewer wants TOTAL COUNT, not the physical boundary indices. Storing indices is mathematically useless here. I must flip my HashMap value schema to track raw integer Frequency instead."

---

## 🔥 Problem 3: Longest Substring Without Repeating Characters

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Apple, Meta, ByteDance
- **Frequency:** 🔥 High
- **Interview Context:** This introduces the true **Sliding Window** combined with Hashing. It transitions you from numeric arrays to `String` arrays (characters). This is perhaps the most heavily tested string algorithm on earth.

### 🔹 1. Problem Explanation
Given a string `s`, find the length of the longest substring without repeating characters.
- **Real-world analogy:** Scanning a streaming log of user IDs. You need the longest continuous block of logs where no user appears twice. Shrinking the block from the left the moment a duplicate enters from the right.
- **Input:** `s = "abcabcbb"`
- **Output:** `3` (The answer is "abc").
- **Constraints:** Solve in strictly $O(N)$ time. $O(N^2)$ inner-loop character checking fails instantly.

### 🔹 2. Data Structure Masterclass
- **DS Used:** Sliding Window (`left`, `right` pointers) + `HashMap<Character, Integer>`.
- **Why chosen:** Standard sliding windows expand right and shrink left linearly. By using a HashMap to store the `Last Seen Index` of each character, when a duplicate arrives, we don't need a `while` loop to shrink the window character-by-character... we can lazily jump the `left` pointer instantly past the old duplicate!

### 🔹 3. Pattern Recognition
- **Pattern name:** Variable Sliding Window (w/ Instant Shrinking).
- **WHEN to use:** Questions asking for constraints on purely *positive/monotonic* data structures without strict fixed lengths (e.g., "Longest continuous without X").
- **HOW to identify:** "Longest substring", "Without repeating".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: HashSet with Linear Shrink (Standard Sliding Window)
- **Idea:** Two pointers. Right expands. If HashSet contains `char[right]`, start incrementing `left` and removing `char[left]` from the set until `char[right]` is no longer in the set.
- **Complexity:** Time $O(2N) = O(N)$. Space $O(256)$. Completely acceptable logic, but we can do it in exactly 1-pass $O(N)$ without the inner `while` loop!

#### ✅ Approach 2: Optimal Approach (Instant Pointer Jumping)
- **Best solution idea:** Use a `HashMap` mapping Character $\to$ The Exact Index it was seen at.
  - If we see `'a'` at index `0`, map puts `('a' $\rightarrow$ 0)`.
  - Say we see `'a'` again at index `3`.
  - Instead of bumping `left` up by 1 slowly... we KNOW the last `'a'` was at index `0`. To fix the duplicate collision, `left` just needs to immediately jump to `LastIndex + 1` (index `1`)!
  - **CRITICAL CHECK:** What if `LastIndex + 1` is *behind* the `left` pointer's current position? We only jump `left` forward. We never let `left` jump backward in time!
- **Optimal Java Code:**
```java
import java.util.HashMap;

public class LongestSubstring {
    public int lengthOfLongestSubstringOptimal(String s) {
        if (s == null || s.length() == 0) return 0;
        
        // Map stores (Character -> Most recent index it was seen at)
        HashMap<Character, Integer> charIndexMap = new HashMap<>();
        
        int maxLength = 0;
        int left = 0;
        
        for (int right = 0; right < s.length(); right++) {
            char currentChar = s.charAt(right);
            
            // If we have seen this character, and its old index is inside our current sliding window...
            // ... we must jump the left pointer explicitly past the old index!
            if (charIndexMap.containsKey(currentChar)) {
                // Math.max guarantees 'left' never travels backwards if the duplicate 
                // character was actually found outside (behind) our active window bounds!
                left = Math.max(left, charIndexMap.get(currentChar) + 1);
            }
            
            // Register/overwrite the character's newest index location
            charIndexMap.put(currentChar, right);
            
            // Calculate the valid window length
            maxLength = Math.max(maxLength, right - left + 1);
        }
        
        return maxLength;
    }
}
```

### 🔹 5. Dry Run
Input: `"abba"`
- `L=0, R=0` (`'a'`). Map={a:0}. Max=1.
- `L=0, R=1` (`'b'`). Map={a:0, b:1}. Max=2.
- `L=0, R=2` (`'b'`). Collision! Map has 'b' at index 1. 
  - `L = max(0, 1 + 1) = 2`. 
  - Update map={a:0, b:2}. Length=`2-2+1` = 1. Max remains 2.
- `L=2, R=3` (`'a'`). Collision! Map has 'a' at index 0. 
  - `L = max(2, 0 + 1) = max(2, 1) = 2`. (Notice we didn't let `L` jump backwards to 1! The old 'a' is already outside our window safely).
  - Update map={a:3, b:2}. Length=`3-2+1` = 2. Max remains 2.
- Result: 2. Perfectly executed cyclic protection!

### 🔹 6. Architectural Thinking
- **WHAT:** Stateful Window Jumping via Index Caching.
- **WHERE:** Stream aggregation where node constraints break uniquely on individual elements.
- **HOW:** By caching the physical coordinate of the payload, we transform a linear $O(N)$ deletion retry-loop into an $O(1)$ coordinate transposition.
- **WHEN:** We strictly enforce forward-only temporal traversal (`Math.max(left, ...)`) to prevent resurrecting deleted historical bounds.
- **WHO:** This abstraction mimics TCP Sliding Window frame drops, immediately repositioning the validation pointer past the corrupted bit-frame!

### 🔹 7. Edge Cases
- `" "` (Single space): Handled perfectly as a valid char. Returns 1.
- `"au"`: Fails `contains` instantly. Max evaluates 2. Returns 2.
- **ASCII Optimization:** If the interviewer confirms string is strictly ASCII characters, building a `new int[256]` array and using the character's ASCII integer value as the index is massively faster than the JVM `HashMap` class overhead.

### 🔹 8. Clean Code
- Instead of maintaining a Set and writing a dirty inner `while(s.charAt(left) != s.charAt(right))` loop, indexing characters natively via Map reduces code branches and mathematically guarantees the minimal number of CPU cycles.

### 🔹 9. Interview Training
- **Senior Articulation:** When explaining your design, emphasize the `Math.max` mechanism. "A standard Set validation requires $O(2N)$ operations because in the worst case, the left pointer has to step individually over every char. By caching the physical Indices in a Map, I mathematically jump the left pointer to safety in strictly 1-pass execution, heavily prioritizing CPU efficiency."

---

## 📝 DAILY SUMMARY

### 🎯 Patterns Learned Today
1. **Mathematical Prefix Maps:** Leveraging standard variables as commutative history accumulators `(PrefixSum(j) - PrefixSum(i)) = Delta` to calculate continuous range matrices in $O(1)$ logic loops.
2. **Value Schema Evolution:** Learning that HashMap *Values* must change based on Output Requirements. If asking for physical `Length`, store `(Key $\to$ Index)`. If asking for mathematical `Total Count`, store `(Key $\to$ Frequency)`.
3. **Sliding Window Jumping:** Combining monotonically expanding window boundaries with Dictionary memory mappings to teleport the trailing pointer instantaneously past collision events, erasing nested loop bounds.

### ⚖️ Decision Rules
- If dealing with **Subarray Constraints** WITH NEGATIVE NUMBERS $\implies$ Discard Sliding Windows. Deploy Prefix Sum Maps natively.
- If finding **Maximum Lengths** inside Hash Maps $\implies$ DO NOT overwrite older map keys! You want the earliest index possible.
- If finding **String Subsequence Uniqueness** $\implies$ Map Character $\to$ Index and deploy `Math.max(L, oldIndex + 1)` teleporting.

### ⚠ Key Mistakes to Avoid
- **Longest 0-Sum Subarray:** Forgetting that if `currentSum` evaluates exactly to the required target natively, the length spans from absolute 0 to the current `i`. Explicitly validating this before the Map lookup is critical.
- **Longest Substring without Repeat:** Creating a Map collision and carelessly executing `left = map.get(char) + 1` without validation. If the old character sits physically *behind* the current sliding window, `left` will travel backwards in time, destroying the local sequence!

***See you tomorrow for Day 6: Array Math & Majority Algorithms!***
