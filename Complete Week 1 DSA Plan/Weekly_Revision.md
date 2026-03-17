# Week 1 DSA Mastery: Revision Cheatsheet

Welcome to your End-of-Week Revision! This document synthesizes all the architectural patterns, algorithmic rules, and decision structures you've learned over the past 7 days. Review this sheet before any interview where Arrays, Hashing, or Pointers are involved.

---

## 1. The Ultimate Pattern Decision Tree

When confronted with an Array/Pointer problem in an interview, trace down this logic tree:

1. **Does the problem ask to find a specific Sum/Target (`K`) or XOR?**
   - **Are the numbers strictly positive?** $\implies$ **Sliding Window** (Expand right, shrink left).
   - **Are there negative numbers?** $\implies$ **Prefix Sum + HashMap** (`History = Current - K`).
   - **Does it ask for subsets/pairs of a specific size (2Sum, 4Sum)?** $\implies$ Sort array, anchor loops, use **Two Pointers (Left/Right convergence)** to close the gap.
2. **Does the problem ask for "Continuous Subarrays" or "Substrings"?**
   - **"Longest without repeating characters"?** $\implies$ **HashMap Teleporting Window** (`Math.max(L, oldIndex + 1)`).
   - **"Largest Sum (negatives included)"?** $\implies$ **Kadane's Algorithm** (Aggressively reset running sum to `0` if it drops `< 0`).
3. **Does the problem involve "Modifying in-place", "Keeping relative order", or "Memory restrictions"?**
   - **"Sort EXACTLY 3 categories (0s, 1s, 2s) in-place"?** $\implies$ **Dutch National Flag (Dijkstra's 3-Way Partition)**.
   - **"Remove Duplicates in-place"?** $\implies$ **Slow & Fast Pointers** (Scout with Fast, overwrite with Slow).
   - **"Modify Matrix Zeroes in $O(1)$ space"?** $\implies$ **Dummy Caching** (Hijack the 1st row and 1st column as your boolean tracker arrays).
4. **Does the problem involve specific Mathematical Guarantees?**
   - **"Element appears $> N/2$ or $> N/3$ times"?** $\implies$ **Moore's Voting Algorithm** (Mutual Annihilation).
   - **"Next Permutation / dictionary order"?** $\implies$ **Lexical Suffix Peak Finding** (Find break `i < i+1`, swap minimal upgrade, reverse tail).
   - **"Count Paths in grid"?** $\implies$ **Combinatorics Math ($^nC_r$)** (Destroy the 2D DP matrix!).

---

## 2. Core Array "Cheat Codes"

### The Dual-Bottleneck Cheat Code (Rain Water)
To mathematically lock volumetric boundaries locally:
```java
// If left is structurally weaker, it governs the maximum ceiling
if (leftWall <= rightWall) {
    if (current >= leftMax) leftMax = current;
    else water += leftMax - current;
    left++;
}
```

### The In-Place Swap Cheat Code
Used universally in Two Pointers, Next Permutation, and DNF Sorting partitions:
```java
private void swap(int[] arr, int i, int j) {
    int temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
}
```

### The Duplicate Skip Cheat Code (K-Sum)
Whenever filtering permutations or unique combinations using Sorted Two Pointers:
```java
while (left < right && nums[left] == nums[left - 1]) left++; // Skips adjacent identicals
```

### The Prefix HashMap Frequency Cheat Code
When counting total valid subarrays instead of just finding the longest:
```java
// Initialize the mathematical zero-state before the loop!
map.put(0, 1); 
// Update frequency without NullPointerExceptions
map.put(sum, map.getOrDefault(sum, 0) + 1);
```

---

## 3. Complexity Matrix

| Core Pattern | General Time | General Space | Architectural Analogy |
| :--- | :--- | :--- | :--- |
| **Two Pointers (Sorted Convergence)** | $O(N \log N)$ (due to sort) | $O(1)$ | Dual-Thread Validation |
| **Sliding Window (Variable)** | $O(N)$ | $O(\text{Dictionary})$ | TCP Packet Resets / Frame drops |
| **Prefix Sum/XOR (Hash)**| $O(N)$ | $O(N)$ | Kafka Stream Event Offsets |
| **Kadane's Algorithm** | $O(N)$ | $O(1)$ | Greedy Congestion Avoidance |
| **Boyer-Moore's Voting** | $O(N)$ | $O(1)$ | Byzantine Fault Tolerance Consensus |
| **Dutch National Flag (3-Way)** | $O(N)$ | $O(1)$ | Garbage Collection Partitioning |
| **Prefix Sequence Hashing** | $O(N)$ | $O(N)$ | Disjoint Graph Root Evaluation |
| **Linear Algebra Transposition** | $O(N^2)$ | $O(1)$ | GPU Texture Matrix Coordinate Swaps |
| **Merge Sort Overriding** | $O(N \log N)$ | $O(N)$ | Spatial Pre-computation Interception |

---

## 4. Senior Developer Traps (Pitfalls to Avoid)

1. **The Sliding Window on Negatives Trap**: 
   - A Junior thinks: "I want a sum of 5. My current window sum is 6. I will shrink the left side to reduce the sum." 
   - *Reality:* What if the left-side number you just removed was `-50`? By removing `-50`, your sum just skyrocketed to `56`! Monotonic windows ONLY work on positive integers. Always pivot to **Prefix Sum + HashMap** if negatives exist.
2. **The K-Sum Integer Overflow Trap**:
   - FAANG testers will explicitly deploy arrays with `Integer.MAX_VALUE`. Adding four of them up in `4Sum` (`[a]+[b]+[c]+[d]`) instantly shatters the 32-bit `int` boundary into negative garbage.
   - *Fix:* Always cast the execution block: `long sum = (long)nums[a] + nums[b] + nums[c] + nums[d];`
3. **The Matrix Scanning Desync**:
   - In *Set Matrix Zeroes*, if you mark your boolean triggers in the 0th Row and 0th Col during Phase 1... and then during Phase 2 you iterate from Top-Left to Bottom-Right, you will instantly overwrite your own trigger columns with `0`s before you ever read them.
   - *Fix:* Always iterate the mutation phase backwards (`Bottom-Right` $\to$ `Top-Left`).
4. **The False Majority Assumption**:
   - In *Majority Element II ($>N/3$)*, just because 2 elements survived the Boyer-Moore mutual annihilation phase does NOT mean they actually appear $>N/3$ times. They might just be the "least attacked" minorities. 
   - *Fix:* If the problem statement does not explicitly guarantee validity, a Phase-2 secondary assertion loop is strictly mandatory.

---

### Final Week 1 Summary
You have evolved significantly. You no longer build nested $O(N^2)$ loops. You now manipulate spatial memory limits natively in $O(1)$, execute algebraic complements dynamically against stream caches, and destroy dimensionality using $K$-Sum sorting tricks. You are now thinking like a Principal Engineer.

Get ready for Week 2! (Typically featuring Fast/Slow Pointers on Linked Lists, and Deep Binary Search).
