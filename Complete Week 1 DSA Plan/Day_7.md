# Day 7: Two Pointer Advanced & Architectural Arrays

Welcome to Day 7, the final day of Week 1! Today we conquer the pinnacle of Array manipulation: Multi-layered Pointer architectures and Divide & Conquer math. *Trapping Rain Water* is arguably the hardest "pure array" problem deployed by FAANG. *Reverse Pairs* introduces you to the concept of piggy-backing algorithmic logic onto pre-existing Sorting frameworks (Merge Sort) to achieve mathematical impossibilities. 

---

## 🔥 Problem 1: Remove Duplicates from Sorted Array

### 🔹 0. Company Tagging
- **Asked in:** Microsoft, Apple, Meta
- **Frequency:** ⚡ Medium
- **Interview Context:** This problem is a fundamental warmup. It explicitly tests if you understand how to mutate an array in-place without allocating a secondary buffer list.

### 🔹 1. Problem Explanation
Given an integer array `nums` sorted in non-decreasing order, remove the duplicates **in-place** such that each unique element appears only once. The relative order of the elements should be kept the same. Return the number of unique elements `k`.
- **Real-world analogy:** Compacting a fragmented hard-drive partition. You move the valid data sequentially to the front, completely ignoring the garbage data left behind at the end of the partition.
- **Input:** `nums = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4]`
- **Output:** `5` (The array is modified to `[0, 1, 2, 3, 4, _, _, _, _, _]`).
- **Constraints:** $O(1)$ extra space.

### 🔹 2. Data Structure Masterclass
- **DS Used:** Raw Array + 2 Pointers (`Slow` and `Fast`).
- **Why chosen:** Required for $O(1)$ spacial limits.
- **Internal working:** The `Slow` pointer tracks the boundary of the "Unique, Valid" array. The `Fast` pointer acts as a scout, continuously scanning into the unknown right-hand side.

### 🔹 3. Pattern Recognition
- **Pattern name:** Fast & Slow Pointers (In-place Compaction).
- **WHEN to use:** "Remove in-place", "Compact array", "Sorted array duplicates".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: HashSet (Brute Force)
- **Thinking:** Dump the array into a `LinkedHashSet` (to preserve order while killing duplicates). Unload the Set back into the array from index 0.
- **Complexity:** Time $O(N)$, Space $O(N)$. Fails the $O(1)$ space constraint instantly.

#### ✅ Approach 2: Optimal Approach (Two Pointers)
- **Best solution idea:** Both pointers start at the beginning.
  - The first element `nums[0]` is naturally unique. So our `Slow` pointer (the writer) stays at index `0`.
  - Let our `Fast` pointer (the scanner) go out and look for the next distinct element.
  - While `nums[Fast] == nums[Slow]`, it's a duplicate. Ignore it. `Fast++`.
  - The moment `nums[Fast] != nums[Slow]`, we found a new unique number! 
  - We must save it! We increment `Slow` (to expand our unique territory) and then WRITE the new number over the old garbage: `nums[Slow] = nums[Fast]`.
- **Optimal Java Code:**
```java
public class RemoveDuplicates {
    public int removeDuplicatesOptimal(int[] nums) {
        if (nums.length == 0) return 0;
        
        // 'insertIndex' acts as the Slow Pointer. It demarcates the boundary of the unique array.
        // It starts at 0 because nums[0] is inherently the first unique element.
        int insertIndex = 0;
        
        // 'i' acts as the Fast Pointer traversing the entire array.
        for (int i = 1; i < nums.length; i++) {
            // If the scout finds a number different from the LAST unique number we locked in...
            if (nums[i] != nums[insertIndex]) {
                // Expand our valid territory boundary
                insertIndex++;
                // Overwrite the garbage data at the new boundary with the found unique number
                nums[insertIndex] = nums[i];
            }
        }
        
        // The array is 0-indexed. If insertIndex is at index 4, there are 5 unique elements.
        return insertIndex + 1;
    }
}
```

### 🔹 5. Dry Run
Input: `nums = [1, 1, 2]`
- Init: `insertIndex = 0`.
- Loop `i = 1`: `nums[1] (1) == nums[0] (1)`. Match! Duplicate. Loop skips, `i` becomes `2`.
- Loop `i = 2`: `nums[2] (2) != nums[0] (1)`. New element!
  - `insertIndex++` becomes `1`.
  - `nums[1] = nums[2]` $\implies$ `nums[1] = 2`. array is `[1, 2, 2]`.
- Loop ends. Returns `insertIndex + 1` = `2`. (The first 2 elements `[1, 2]` are perfectly unique).

### 🔹 6. Architectural Thinking
- **WHAT:** Destructive contiguous compaction.
- **WHERE:** Linear read-write operations inside a singular memory block.
- **HOW:** Because the `Fast` read-head strictly moves equal-to or faster than the `Slow` write-head, it mathematically guarantees we will *never* overwrite data we haven't read yet!
- **WHO:** This precise loop is exactly how the OS Defragmentation routines compact logical disk blocks!

### 🔹 7. Edge Cases
- **Empty Array (`[]`):** Guard clause `if length == 0 return 0` handles the `NullPointer`/`IndexOutOfBounds` risk perfectly.
- **Fully Unique Array (`[1, 2, 3]`):** `insertIndex` increments synchronously with `i`. The code executes `nums[1] = nums[1]`, which is slightly redundant computation, but writing an `if (i != insertIndex)` check is actually slower due to CPU branch prediction failures. The redundant write is optimal!

### 🔹 8. Clean Code
- Notice we don't return the array itself; we return the `Count`. In C/Java, you cannot physically resize a native integer array block. Returning the valid bounding length allows the caller function to know exactly which subset of the array to read.

### 🔹 9. Interview Training
- **Mistakes to avoid:** A Junior will desperately try to pull the right-side elements to the left by writing nested `for` loops shifting $N$ elements every time a duplicate is found resulting in catastrophic $O(N^2)$ time. Remember: you don't need to "delete" the duplicates, you just "overwrite" them and update your boundary pointer!

---

## 🔥 Problem 2: Trapping Rain Water

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Google, Meta, Bloomberg
- **Frequency:** 🔥 High
- **Interview Context:** This is the ultimate boss of the Two Pointer paradigm. It tests spatial reasoning. Can you identify the strict bounding constraints (Left Wall vs Right Wall) that physically allow a 2D volumetric state (Water) to exist?

### 🔹 1. Problem Explanation
Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.
- **Real-world analogy:** Pouring water into an uneven bowl. For water to physically pool at any specific column, there MUST be a taller pillar somewhere to its left, AND a taller pillar somewhere to its right. The water level is bottlenecked entirely by whichever of those two enclosing walls is *shorter*.
- **Input:** `height = [0,1,0,2,1,0,1,3,2,1,2,1]`
- **Output:** `6`

### 🔹 2. Data Structure Masterclass
- **DS Used:** Two Pointers (`left` and `right`) + Bounding trackers (`leftMax`, `rightMax`).
- **Why chosen:** Required for $O(1)$ space. 

### 🔹 3. Pattern Recognition
- **Pattern name:** Bottleneck Convergence (Dual Peak Pointers).
- **WHEN to use:** Questions asking for Area, Volume, "Trapping", or "Largest Rectangle" utilizing variable heights.

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** For every single index `i`, run a loop to the left to find its absolute highest peak. Run a loop to the right to find its absolute highest peak. Water at exactly `i` = `Math.min(maxLeft, maxRight) - height[i]`.
- **Complexity:** Time $O(N^2)$, Space $O(1)$. 

#### ✅ Approach 2: Better Approach (Prefix/Suffix Arrays)
- **Idea:** Pre-compute the highest left and highest right walls! 
  - `leftMaxArray[]` tracks the max height seen from $0 \to i$. 
  - `rightMaxArray[]` tracks the max height seen from $N-1 \to i$.
  - Loop one final time: `water += Math.min(leftMax[i], rightMax[i]) - height[i]`.
- **Complexity:** Time $O(3N) = O(N)$. Space $O(2N) = O(N)$. Fantastic, but the interviewer will demand $O(1)$ space.

#### ✅ Approach 3: Optimal Approach (Two Pointers)
- **Best solution idea:** The formula is strictly `min(leftMax, rightMax)`.
  - Put a pointer at the absolute `left` and `right` sides of the array. Track `leftMax` and `rightMax`.
  - If `leftMax < rightMax`, we know with 100% mathematical certainty that the bottleneck for the `left` pointer relies purely on `leftMax`. Even if there is a 500ft wall hiding somewhere in the chaotic middle of the array, `leftMax` enforces a strict ceiling. Therefore, we can confidently calculate the water trapped exactly at `left`, and move `left++`!
  - If `rightMax < leftMax`, the right side is the bottleneck. Calculate water at `right`, and move `right--`!
- **Optimal Java Code:**
```java
public class TrappingRainWater {
    public int trapOptimal(int[] height) {
        if (height == null || height.length <= 2) return 0;
        
        int left = 0;
        int right = height.length - 1;
        
        int leftMax = 0;
        int rightMax = 0;
        
        int totalWater = 0;
        
        while (left < right) {
            // The LEFT side is the structural bottleneck
            if (height[left] <= height[right]) {
                // Have we found a new structural wall?
                if (height[left] >= leftMax) {
                    leftMax = height[left];
                } else {
                    // Current block is smaller than the wall. It traps water to the top of the wall!
                    totalWater += leftMax - height[left];
                }
                left++;
            } 
            // The RIGHT side is the structural bottleneck
            else {
                // Have we found a new structural wall?
                if (height[right] >= rightMax) {
                    rightMax = height[right];
                } else {
                    totalWater += rightMax - height[right];
                }
                right--;
            }
        }
        
        return totalWater;
    }
}
```

### 🔹 5. Dry Run
Input: `[0, 1, 0, 2, 1, 0, 1, 3]`
- `L=0` (0), `R=7` (3). `lMax=0`, `rMax=0`. `total=0`.
- `L(0) <= R(3)`: `botL`. `h[L] >= lMax` ($0 \ge 0$). `lMax=0`. `L++`(1).
- `L(1) <= R(3)`: `botL`. `h[L] >= lMax` ($1 \ge 0$). `lMax=1`. `L++`(2).
- `L(2) <= R(3)`: `botL`. `h[L] < lMax` ($0 < 1$). Water += `1 - 0` = 1. `L++`(3).
- `L(3) <= R(3)`: `botL`. `h[L] >= lMax` ($2 \ge 1$). `lMax=2`. `L++`(4).
- `L(4) <= R(3)`: `botL`. `h[L] < lMax` ($1 < 2$). Water += `2 - 1` = 1. (Total=2). `L++`(5).
- `L(5) <= R(3)`: `botL`. `h[L] < lMax` ($0 < 2$). Water += `2 - 0` = 2. (Total=4). `L++`(6).
- `L(6) <= R(3)`: `botL`. `h[L] < lMax` ($1 < 2$). Water += `2 - 1` = 1. (Total=5). `L++`(7).
- `L` and `R` collide at index 7. Loop breaks. Output = 5. (Wait, is the result exactly 5 for this chunk? Yes, my manual dry run logic executed flawlessly on the sub-section provided!)

### 🔹 6. Architectural Thinking
- **WHAT:** Simultaneous bidirectional convergence exploiting variable ceilings.
- **WHERE:** Executed entirely iteratively with $O(1)$ memory.
- **HOW:** By definitively establishing whichever side is structurally weaker (`height[left] <= height[right]`), we deduce that any internal chaotic spikes are mathematically irrelevant to the capacity of the weaker node, allowing $O(1)$ calculations.
- **WHEN:** We calculate incrementally on every inward movement step.
- **WHO:** This localized bottleneck calculation translates cleanly into Supply Chain route optimizations, figuring out the maximum throughput constraints across divergent graph node pipelines.

### 🔹 7. Edge Cases
- **Flat terrain / Decreasing terrain (`[5, 4, 3]`, `[1, 1, 1]`):** The `leftMax` and `rightMax` continuously update and overwrite without the `else` block ever firing. Output is cleanly `0` trapped water.

### 🔹 8. Clean Code
- **Defensive Check:** `if (height.length <= 2) return 0;`. You physically cannot trap water with only 2 pillars. This simple line saves arbitrary null pointer faults effortlessly.

### 🔹 9. Interview Training
- **Senior Check:** To prove your mastery, explain exactly *why* this works to the interviewer. *"Because `MIN(leftMax, rightMax)` governs the water level, checking `height[left] <= height[right]` ensures that `leftMax` acts as the strict bottleneck. Even if there are infinitely tall walls further into the center, they cannot raise the water level at my current `left` position beyond `leftMax`."*

---

## 🔥 Problem 3: Reverse Pairs (Divide & Conquer)

### 🔹 0. Company Tagging
- **Asked in:** Google, Amazon, Meta
- **Frequency:** ❄️ Hard/Rare (Usually for L5+ Roles)
- **Interview Context:** This is fundamentally a Merge Sort algorithms test. A Junior reads "Pairs" and assumes Two Pointers. A Senior reads "Pairs where `i < j` and `nums[i] > 2 * nums[j]`" and immediately recognizes the properties of Inversion Counting via Divide & Conquer sorting logic.

### 🔹 1. Problem Explanation
Given an integer array `nums`, return the number of reverse pairs. A reverse pair is a pair `(i, j)` where `0 <= i < j < nums.length` and `nums[i] > 2 * nums[j]`.
- **Analogy:** Ranking algorithmic speeds. We are trying to find instances where the trailing array element is less than *half* the size of the preceding element. 
- **Input:** `nums = [1,3,2,3,1]`
- **Output:** `2` (Pairs are `(1) 3 > 2*1` and `(3) 3 > 2*1`).

### 🔹 2. Data Structure Masterclass
- **DS Used:** Merge Sort Recursion Tree + Temporary array allocation. 
- **Why chosen:** Traversing all pairs is $O(N^2)$. But if we divide the array in half, and sort the halves... we can linearly $O(N)$ count the reverse pairs between the Left-Half and Right-Half identically during the Merge Step, resulting in an $O(N \log N)$ execution!

### 🔹 3. Pattern Recognition
- **Pattern name:** Modified Merge Sort (Inversion Counting).
- **WHEN to use:** "Count pairs where $A[i] > K * A[j]$ with $i < j$".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** Double loops! Note: $!nums[i] > 2 * nums[j]$ requires casting to `(long)` to prevent $2 \times MAX\_VALUE$ integer overflow logic bombs!
- **Complexity:** Time $O(N^2)$, Space $O(1)$. TLE guarantee.

#### ✅ Approach 2: Optimal Approach (Merge Sort Inversion Checking)
- **Best solution idea:** Piggyback on `MergeSort()`. 
  - Standard MergeSort recursively divides the array into Left and Right halves, then merges them in sorted order.
  - Assume the Left Half `[4, 6, 8]` is sorted. Assume Right Half `[1, 2, 3]` is sorted.
  - Before we merge them, perform the Reverse Pair check! 
  - Iterate `i` over the Left Half. Iterate `j` over the Right Half. 
  - If `Left[i] > 2 * Right[j]`, then *every element to the right of `i` in the Left Half will ALSO be greater than `2 * Right[j]`* because the Left Half is already sorted! No need to check them individually! Just add `(mid - i + 1)` to the total count and move `j` forward!
- **Optimal Java Code:**
```java
public class ReversePairs {
    public int reversePairs(int[] nums) {
        if (nums == null || nums.length < 2) return 0;
        return mergeSort(nums, 0, nums.length - 1);
    }
    
    // Core Divide & Conquer logic
    private int mergeSort(int[] nums, int left, int right) {
        if (left >= right) return 0;
        
        int mid = left + (right - left) / 2;
        int count = 0;
        
        // Sum inversions from left half + right half + cross inversions
        count += mergeSort(nums, left, mid);
        count += mergeSort(nums, mid + 1, right);
        count += countPairs(nums, left, mid, right);
        
        // Standard merge process to keep the arrays sorted for the next layer up
        merge(nums, left, mid, right);
        
        return count;
    }
    
    // The magical linear counting logic
    private int countPairs(int[] nums, int left, int mid, int right) {
        int count = 0;
        int j = mid + 1; // Start of right array
        
        for (int i = left; i <= mid; i++) {
            // Traverse j linearly rightwards as long as the condition holds
            while (j <= right && (long)nums[i] > 2L * (long)nums[j]) {
                j++;
            }
            // All elements from (mid+1) up to (j-1) satisfy the condition!
            count += (j - (mid + 1));
        }
        return count;
    }
    
    // Standard Merge Sort Array merging
    private void merge(int[] nums, int left, int mid, int right) {
        int[] temp = new int[right - left + 1];
        int i = left, j = mid + 1, k = 0;
        
        while (i <= mid && j <= right) {
            if (nums[i] <= nums[j]) {
                temp[k++] = nums[i++];
            } else {
                temp[k++] = nums[j++];
            }
        }
        
        while (i <= mid) temp[k++] = nums[i++];
        while (j <= right) temp[k++] = nums[j++];
        
        for (int p = 0; p < temp.length; p++) {
            nums[left + p] = temp[p];
        }
    }
}
```

### 🔹 5. Dry Run & Architectural Insight
- **WHAT:** By injecting the `countPairs()` function between the `divide` recursive block and the `merge` execution block, we intercept the sorted sub-arrays when they are fully evaluated chronologically but haven't been spatially joined yet.
- **HOW:** Because the Left sub-array sits functionally *before* the Right sub-array chronologically, every interaction between them perfectly replicates $i < j$, yet because they are internally sorted, we can execute mathematical jump-counting `O(N)` instead of nested loops.
- **Result:** We solve an $O(N^2)$ permutation problem natively at $O(N \log N)$ sorting speeds!

---

## 📝 DAILY SUMMARY

### 🎯 Patterns Learned Today
1. **Destructive Pointer Writes:** Understanding how to compact arrays natively in $O(1)$ space by allowing a faster read pointer to override garbage data trailing behind a structurally safe write pointer. 
2. **Dual-Bottleneck Constraint Validation:** Using bounding variables from both extremities of an array to mathematically seal interior volumetric potentials, rendering interior layout variations irrelevant (Trapping Rain Water).
3. **Divide & Conquer Data Interception:** Modifying standard foundational frameworks (Merge Sort) to execute analytical evaluation on fractional sorted states before memory compaction natively strips temporal indices.

### ⚖️ Decision Rules
- If given **"Remove Elements In-Place"** $\implies$ Dedicate `Index 0` as the baseline. Put your Write Pointer at 0, your Scouter pointer at 1, and only Write when Scouter proves uniqueness.
- If asked about **Physical Volumes / Area Trapping** $\implies$ Run absolute limits inward from `index[0]` and `index[N-1]` tracking `globalMaxes`.
- If asked about **Relational Pair Counts $(i < j \text{ and } A[i] > K*A[j])$** $\implies$ NEVER Two Pointer. Piggyback entirely onto Merge Sort Recursive divisions!

### 🏆 Week 1 Complete!
Congratulations. You are now wielding Array logic like an absolute Principal Engineer. You command mathematical bounds, Hash Frequency mappings, Combinatorics, and destructive pointer algorithms over arbitrary loops. 

Next up, we will synthesize all of this logic into a single **PDF-Ready Revision Cheatsheet**!
