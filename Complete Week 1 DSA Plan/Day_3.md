# Day 3: Arrays - Rotations & Merging

Welcome to Day 3! Today we tackle **Intervals and Dimensional Geometry**. These problems define the boundary between Junior developers (who use $O(N^2)$ nested logic) and Senior developers (who use mathematical abstractions like Transposition and Gap calculations). Merging Intervals is heavily used in real-world system design for calendar scheduling and resource allocation.

---

## 🔥 Problem 1: Rotate Image (Matrix) by 90 Degrees

### 🔹 0. Company Tagging
- **Asked in:** Amazon, Microsoft, Apple
- **Frequency:** 🔥 High
- **Interview Context:** This problem tests your mathematical manipulation of 2D arrays. Allocating a second matrix to hold the rotated values is trivial. Manipulating the Cartesian coordinates *in-place* proves you understand memory addresses and linear algebra transpositions.

### 🔹 1. Problem Explanation
You are given an `n x n` 2D matrix representing an image. Rotate the image by **90 degrees clockwise**. You MUST rotate the image in-place, which means you have to modify the input 2D matrix directly. 
- **Real-world analogy:** Rotating a photo on your iPhone. The software doesn't duplicate the 5MB photo in memory (which would crash low-RAM devices). It shifts the RGB pixel coordinates mathematically inside the existing RAM block.
- **Input:** `matrix = [[1,2,3],[4,5,6],[7,8,9]]`
- **Output:** `[[7,4,1],[8,5,2],[9,6,3]]`
- **Constraints:** Do NOT allocate another 2D matrix.

### 🔹 2. Data Structure Masterclass
- **DS Used:** 2D Array
- **Why chosen:** Required by problem for visual geometry representation.
- **Internal working:** Accessing `arr[i][j]` maps algebraically to $P_{row} + P_{col}$ memory offsets.

### 🔹 3. Pattern Recognition
- **Pattern name:** Mathematical Transposition + Reflection.
- **WHEN to use:** Any "Rotation" or "Mirroring" of a 2D grid.
- **HOW to identify:** Keywords "Rotate 90 degrees", "rotate matrix in-place".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** Create a dummy matrix `ans`. Map the elements: rule is that the *first row* of original becomes the *last column* of the rotated matrix. So, `ans[j][n - 1 - i] = matrix[i][j]`.
- **Complexity:** Time $O(N^2)$, Space $O(N^2)$ extra memory. Fails the "in-place" requirement visually.

#### ✅ Approach 2: Optimal Approach (Linear Algebra Transposition)
- **Best solution idea:** This is a famous Linear Algebra trick. 
  - To rotate a matrix 90 degrees clockwise:
  - **Step 1:** Transpose the matrix (swap `[i][j]` with `[j][i]`). This flips the matrix diagonally.
  - **Step 2:** Reverse every row independently. 
  - That's it! 
- **Optimal Java Code:**
```java
public class RotateMatrix {
    public void rotateOptimal(int[][] matrix) {
        int n = matrix.length;
        
        // Step 1: Transpose the matrix
        // Iterate only the upper triangle (j > i) to prevent double-swapping!
        for (int i = 0; i < n; i++) {
            for (int j = i; j < n; j++) {
                int temp = matrix[i][j];
                matrix[i][j] = matrix[j][i];
                matrix[j][i] = temp;
            }
        }
        
        // Step 2: Reverse every row
        for (int i = 0; i < n; i++) {
            // Standard 1D array reversal using Left/Right pointers
            int left = 0;
            int right = n - 1;
            while (left < right) {
                int temp = matrix[i][left];
                matrix[i][left] = matrix[i][right];
                matrix[i][right] = temp;
                left++;
                right--;
            }
        }
    }
}
```

### 🔹 5. Dry Run
Input: `[[1,2,3], [4,5,6], [7,8,9]]`
- **Transpose Step:**
  - `i=0, j=1`: Swap 2 and 4. $\implies$ Row 1 starts `[1, 4, 3]`, Row 2 starts `[2, 5, 6]`.
  - `i=0, j=2`: Swap 3 and 7.
  - `i=1, j=2`: Swap 6 and 8.
  - Transposed Matrix: `[[1,4,7], [2,5,8], [3,6,9]]`.
- **Reverse Rows Step:**
  - Row 0 (`[1,4,7]`): Swap 1 and 7. $\implies$ `[7,4,1]`
  - Row 1 (`[2,5,8]`): Swap 2 and 8. $\implies$ `[8,5,2]`
  - Row 2 (`[3,6,9]`): Swap 3 and 9. $\implies$ `[9,6,3]`
- **Result:** `[[7,4,1], [8,5,2], [9,6,3]]`. Perfect 90 deg clockwise.

### 🔹 6. Architectural Thinking
- **WHAT:** Decoupling a complex geometric shift into two simple 1D mirror actions.
- **WHERE:** Executed sequentially via memory-pointer swapping.
- **HOW:** Transposing handles the column $\rightarrow$ row transition. Reversing handles the direction vector (clockwise).
- **WHEN:** Checked sequentially, row by row.
- **WHO:** This abstraction is used everywhere in Game Development rendering engines to prevent allocating GPU memory for sprites!

### 🔹 7. Edge Cases
- **1x1 Matrix (`[[1]]`):** Both `for` loops safely skip or execute instantly without breaking.
- **Non-square Matrix (M x N)?** Rotating an `m x n` matrix in-place natively is impossible in hardware because the row/col memory chunk lengths physically change (A $2 \times 3$ becomes $3 \times 2$, requiring a different physical memory block).

### 🔹 8. Clean Code
- Notice the transposition inner loop starts at `j = i`. If you start at `j = 0`, you will swap the elements, and then when the loop reaches the mirrored element later, you will swap them BACK to their original positions.

### 🔹 9. Interview Training
- **Mistakes to avoid:** Do not try to trace individual coordinates circularly (e.g., `temp = top_left; top_left = bottom_left...`). While technically $O(1)$ space and $O(N^2)$ time, the coordinate logic mapping is a nightmare to code bug-free on a whiteboard. Transpose + Reverse is mathematically elegant and physically impossible to mess up if you know how to reverse a 1D array.

---

## 🔥 Problem 2: Merge Overlapping Intervals

### 🔹 0. Company Tagging
- **Asked in:** Google, Amazon, Meta, Microsoft
- **Frequency:** 🔥 High
- **Interview Context:** This is the quintessential calendar scheduling problem. It tests if you understand how Sorting groups relational concepts physically together, enabling $O(N)$ linear evaluations instead of $O(N^2)$ relation checking.

### 🔹 1. Problem Explanation
Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.
- **Real-world analogy:** Merging overlapping calendar meetings. If Meeting A is 1:00-3:00, and Meeting B is 2:00-4:00, your total "Busy block" is 1:00-4:00.
- **Input:** `intervals = [[1,3],[2,6],[8,10],[15,18]]`
- **Output:** `[[1,6],[8,10],[15,18]]` (Since 1-3 and 2-6 overlap, they merged into 1-6).

### 🔹 2. Data Structure Masterclass
- **DS Used:** `List<int[]>`
- **Why chosen:** The output size is dynamic. We don't know how many intervals will merge. An ArrayList is necessary to buffer the output.
- **Time complexity benefits:** Sorting the array takes $O(N \log N)$. Once sorted, overlapping intervals are guaranteed to sit adjacent to each other physically in the array!

### 🔹 3. Pattern Recognition
- **Pattern name:** Sorted Interval Merging.
- **WHEN to use:** Questions asking about chronological overlaps, meeting rooms, or range intersections.
- **HOW to identify:** Keywords "overlapping", "intervals".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force
- **Thinking:** Check every interval against every other interval. If they overlap, create a new interval and delete the old ones.
- **Complexity:** Time $O(N^2)$, Space $O(1)$. Tricky to implement, deletions cause array shifting.

#### ✅ Approach 2: Optimal Approach (Sort + Line Sweep)
- **Best solution idea:** The chaotic problem is that `[1,3]` could be at index 0, and `[2,4]` could be at index 1000. 
  - If we SORT the intervals based on their **Start Times**, overlapping intervals are forced to be next to each other.
  - We pick up the first interval. We look at the next interval. 
  - If `Next.start <= Current.end`, they OVERLAP! The new interval is `[Current.start, MAX(Current.end, Next.end)]`.
  - If `Next.start > Current.end`, they DON'T overlap. We push the `Current` interval to the Answer List, and "pick up" the `Next` interval to start checking.
- **Optimal Java Code:**
```java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MergeIntervals {
    public int[][] mergeOptimal(int[][] intervals) {
        if (intervals.length <= 1) return intervals;

        // 1. Sort the intervals based on START TIME
        // Using an anonymous Comparator lambda
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));

        List<int[]> merged = new ArrayList<>();
        
        // Pick up the very first interval to act as our baseline tracker
        int[] currentInterval = intervals[0];
        merged.add(currentInterval); // Add reference to list (we will mutate its End Time later!)
        
        for (int[] nextInterval : intervals) {
            int currentEnd = currentInterval[1];
            int nextStart = nextInterval[0];
            int nextEnd = nextInterval[1];
            
            if (nextStart <= currentEnd) {
                // Overlap! Mutate the End Time of the interval currently sitting in the List
                currentInterval[1] = Math.max(currentEnd, nextEnd);
            } else {
                // No Overlap! Pick up the next interval and add it to the list
                currentInterval = nextInterval;
                merged.add(currentInterval);
            }
        }
        
        // Convert List<int[]> back to a primitive 2D matrix
        return merged.toArray(new int[merged.size()][]);
    }
}
```

### 🔹 5. Dry Run
Input: `[[1,3], [2,6], [8,10], [15,18]]`. (Already sorted!).
- Load `[1, 3]` into list. `currentInterval` tracks `[1, 3]`.
- Loop 1 (`[1,3]`): `1 <= 3` (Overlap). End `max(3, 3)` = 3. (`[1,3]` remains `[1,3]`).
- Loop 2 (`[2,6]`): `2 <= 3` (Overlap!). Mutate End `max(3, 6)` = 6. List now holds `[[1,6]]`.
- Loop 3 (`[8,10]`): `8 > 6` (No Overlap). New distinct block! Add `[8,10]` to List. `currentInterval` tracks `[8,10]`.
- Loop 4 (`[15,18]`): `15 > 10` (No Overlap). Add `[15,18]`. `currentInterval` tracks `[15,18]`.
- Return `[[1,6],[8,10],[15,18]]`.

### 🔹 6. Architectural Thinking
- **WHAT:** Sequential Line-Sweeping via physical grouping.
- **WHERE:** Tracking state using an independent reference pointer mutated dynamically.
- **HOW:** Sorting enforces chronological monotonicity. After sorting, timeline breaks are strictly disjoint!
- **WHEN:** The reference interval acts as an accumulator until a chronological anomaly (gap) severs the accumulation.
- **WHO:** Sorting is the Ultimate "Pre-computation" mechanism in System Design databases to group similar metadata nodes together.

### 🔹 7. Edge Cases
- **Complete engulfing (`[[1, 10], [2, 3]]`):** The `Math.max(10, 3)` cleanly keeps `10`, merging the smaller interval seamlessly.
- **Negative timestamps?** Handled natively by `<` comparisons.

### 🔹 8. Clean Code
- **Pro-tip:** `merged.add(currentInterval)` adds the *memory reference* to the list. When we do `currentInterval[1] = ...`, it mutates the array *inside* the List instantly without needing a `.set()` or removal hook! This is extremely elegant Java pointer manipulation.

### 🔹 9. Interview Training
- **Junior Move:** Writing a custom Merge Sort or Quick Sort from scratch to sort the 2D array.
- **Senior Move:** using `Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]))`. This lambda implicitly creates a highly optimized Comparator. Never write a sorting loop in production unless explicitly asked "implement a sorting function."

---

## 🔥 Problem 3: Merge Two Sorted Arrays Without Extra Space

### 🔹 0. Company Tagging
- **Asked in:** Google, Amazon, Microsoft
- **Frequency:** 🔥 High
- **Interview Context:** This is an edge-case test on spatial manipulation. If you use a third array to merge $O(M+N)$ space, you fail. The problem is testing if you can conceptually "Shift" numbers backwards, or use advanced mathematical gap logic (Shell sort).

### 🔹 1. Problem Explanation
Given two sorted integer arrays `nums1` and `nums2`, merge `nums2` into `nums1` as one sorted array.
The number of elements initialized in `nums1` and `nums2` are `m` and `n` respectively. `nums1` has a size equal to `m + n` such that it has enough space to hold all elements from `nums2`.
- **Real-world analogy:** You have two sorted filing cabinets. Cabinet A has empty space in the back. You need to pull files from B and weave them into A without placing any files on the floor (no extra memory buffer).
- **Constraints:** Maximize time efficiency, $O(1)$ space.

### 🔹 2. Data Structure Masterclass
- **DS Used:** Two 1D Primitive Arrays.
- **Why chosen:** Fixed block manipulation.
- **Time complexity benefits:** Modifying arrays backwards avoids $O(N)$ index-shifting penalties.

### 🔹 3. Pattern Recognition
- **Pattern name:** Three-Pointer Backward Merging.
- **WHEN to use:** "Merge sorted lists inside an existing buffer" or "Avoid index shifting".

### 🔹 4. Solution Evolution

#### ✅ Approach 1: Brute Force (Better than standard Brute)
- **Thinking:** Put all elements of `nums2` into the empty slots of `nums1`. Then run `Arrays.sort(nums1)`.
- **Complexity:** Time $O((M+N) \log(M+N))$, Space $O(1)$ (ignoring native sorting heap). This is technically $O(1)$ space, but the time is heavily suboptimal.

#### ✅ Approach 2: Optimal Approach (Backward Pointers)
- **Best solution idea:** If we iterate from the *front* (`index 0`), if `nums2` has a small element, we have to shove it into `nums1[0]` and then shift EVERY other element in `nums1` to the right, taking $O(M \times N)$ time.
  - BUT... the back of `nums1` is completely empty (filled with `0`s)! 
  - If we compare the *largest* element of `nums1` vs the *largest* element of `nums2`, we know EXACTLY which one belongs at the very end of the result array (`nums1[m+n-1]`). 
  - By writing data from the back to the front, we never overwrite data we haven't processed yet!
- **Optimal Java Code:**
```java
public class MergeSortedArrays {
    public void mergeOptimal(int[] nums1, int m, int[] nums2, int n) {
        // Pointers for the valid data sections
        int p1 = m - 1; 
        int p2 = n - 1;
        // Pointer for writing into the padded empty zeros at the rear of nums1
        int pMerge = m + n - 1;
        
        // While there is data in BOTH trackers
        while (p1 >= 0 && p2 >= 0) {
            // Pick the strictly LARGEST element and place it in the rear
            if (nums1[p1] > nums2[p2]) {
                nums1[pMerge] = nums1[p1];
                p1--;
            } else {
                nums1[pMerge] = nums2[p2];
                p2--;
            }
            pMerge--;
        }
        
        // If nums1 is exhausted, but nums2 still has small elements remaining,
        // we must copy them over. (If nums2 is exhausted, nums1's remaining elements 
        // are already in their correct sorted positions!)
        while (p2 >= 0) {
            nums1[pMerge] = nums2[p2];
            p2--;
            pMerge--;
        }
    }
}
```

### 🔹 5. Dry Run
Input: `nums1 = [1, 2, 3, 0, 0, 0]`, `m = 3`. `nums2 = [2, 5, 6]`, `n = 3`.
- `p1 = 2` (val=3). `p2 = 2` (val=6). `pMerge = 5`.
- Compare 3 & 6. 6 is bigger. `nums1[5] = 6`. `p2--` (now points to 5). `pMerge--` (now 4).
- `p1(3)` vs `p2(5)`. 5 is bigger. `nums1[4] = 5`. `p2--`. `pMerge--`.
- `p1(3)` vs `p2(2)`. 3 is bigger. `nums1[3] = 3`. `p1--`. `pMerge--`.
- `p1(2)` vs `p2(2)`. Equal. `else` block places `nums2[2]`. `nums1[2] = 2`. `p2--`.
- `p2` is now -1. Exhausted!
- `nums2` loop skips. Result: `[1, 2, 2, 3, 5, 6]`. Done!

### 🔹 6. Architectural Thinking
- **WHAT:** Reverse Traversal Overlap Prevention.
- **WHERE:** Operating from the highest-indexed unallocated buffer downward.
- **HOW:** The memory layout guarantees the unused buffer is large enough to absorb all incoming data without colliding with the read-pointer `p1`.
- **WHEN:** Synchronized comparison loops.
- **WHO:** Moving elements backwards is a fundamental low-level optimization in Assembly Language to execute `memcpy` on overlapping blocks! 

### 🔹 7. Edge Cases
- **`nums1` is empty initially (`m=0`):** `p1 = -1`. First `while` loop completely skips. Second `while` loop executes wildly, copying all of `nums2` into `nums1`. Perfect.
- **`nums2` is empty (`n=0`):** `p2 = -1`. Second `while` skips. `nums1` is untouched. Perfect.

### 🔹 8. Clean Code
- Adding `0` padding is universally how empty buffer space is allocated in C/Java statically. Trusting the bounds variables `m` and `n` instead of `.length` ensures we only map actual data payloads. 

### 🔹 9. Interview Training
- **The Junior Pitfall:** The junior thinks: "Shift the array elements right using a `for` loop to make space for `nums2[i]`". That runs in $O(M^2)$. 
- **The Senior Insight:** Write from the back! Always remember: if an array has padded zeros at the back, it's begging you to iterate backward.

---

## 📝 DAILY SUMMARY

### 🎯 Patterns Learned Today
1. **Mathematical Spatial Mapping:** Using native array Transpose and Reverse procedures to physically rotate states `O(N)` without allocating new geometry boards (`Rotate Image`).
2. **Lambda Pre-sorting Monotonicity:** Applying Custom `Comparators` onto complex multidimensional types to force chronological adjacency `[Merge Intervals]`.
3. **Backward Pointer Collision Avoidance:** Exploiting "Trailing Zeros" space to safely merge distinct arrays asynchronously into native buffer slots `[Merge Sorted Arrays]`.

### ⚖️ Decision Rules
- If manipulating **2D Matrix Coordinates** $\implies$ Look for mathematical transposition rules. Do not manually swap complex corner pointers.
- If dealing with **Intervals or Ranges** $\implies$ ALWAYS sort by the `Start Time`. Monotonic sorting trivially collapses intersections via simple `max()` End Time tracking.
- If asked to **Merge Arrays implicitly** without allocating new ones $\implies$ Run pointers backwards.

### ⚠ Key Mistakes to Avoid
- **Rotate Image:** Initializing the inner `j` loop of the Transpose equation to `0`. It must start at `i` (the diagonal), otherwise, you `[i][j] = [j][i]` and then immediately reverse it later on `[j][i] = [i][j]`, resulting in no change!
- **Merge Intervals:** Forgetting to mutate the `int[]` interval *reference* sitting inside the ArrayList to mathematically expand the final bounding box. 

***See you tomorrow for Day 4: Hashing & Two Pointers Fundamentals!***
