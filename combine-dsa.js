const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const sectionsDir = path.join(dir, 'Day 1 to 7 DSA Plan');
const outputFile = path.join(dir, 'DSA-Week1-Mastering-Guide.md');

const frontmatter = `---
pdf_options:
  format: A4
  margin:
    top: 20mm
    bottom: 20mm
    left: 15mm
    right: 15mm
---

<style>
body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11pt; line-height: 1.6; }
h1 { page-break-before: always; color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 8px; }
h1:first-of-type { page-break-before: avoid; }
h2 { color: #283593; margin-top: 20px; }
h3 { color: #3949ab; }
h4 { color: #5c6bc0; }
code { font-family: 'Consolas', 'Courier New', monospace; font-size: 9pt; }
pre { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 9pt; line-height: 1.4; }
pre code { font-family: 'Consolas', 'Courier New', monospace; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
th { background: #1a237e; color: white; padding: 8px 12px; text-align: left; }
td { border: 1px solid #e0e0e0; padding: 6px 12px; }
tr:nth-child(even) { background: #f5f5f5; }
blockquote { border-left: 4px solid #ff9800; background: #fff3e0; padding: 8px 16px; }
</style>

# Mastering Data Structures & Algorithms using Java

---

**Author:** Senior Java Software Engineer
**Target Audience:** Java developers preparing for FAANG-level technical interviews
**Focus:** Arrays & Foundational Patterns (Week 1)
**Prerequisites:** Java Basics

---

# Table of Contents
1. Day 1: Array Basics (Iteration & Math)
2. Day 2: Array Modification & State
3. Day 3: Two Pointers Pattern
4. Day 4: Prefix Sum Pattern
5. Day 5: Sliding Window Pattern
6. Day 6: Array Logic Foundations & Essential Algorithms
7. Day 7: Kadane's Algorithm & Array Logic
8. Weekly Revision Cheatsheet

---

`;

const files = [
    'Day_1.md',
    'Day_2.md',
    'Day_3.md',
    'Day_4.md',
    'Day_5.md',
    'Day_6.md',
    'Day_7.md',
    'Weekly_Revision.md'
];

function run() {
    console.log('Starting compilation process for DSA Guide...');
    let combined = frontmatter;

    for (const file of files) {
        const filePath = path.join(sectionsDir, file);
        if (fs.existsSync(filePath)) {
            console.log(`Reading ${file}...`);
            const content = fs.readFileSync(filePath, 'utf8');
            combined += content + '\n\n';
        } else {
            console.warn(`Warning: File not found: ${file}`);
        }
    }

    // Adjusting math block formatting for md-to-pdf if necessary, 
    // replacing $...$ with `...` (inline code) if md-to-pdf doesn't support latex
    combined = combined.replace(/\$([^\$]+)\$/g, '`$1`');
    // Also fixing inline right arrows
    combined = combined.replace(/\\rightarrow/g, '->');
    combined = combined.replace(/\\leq/g, '<=');
    combined = combined.replace(/\\neq/g, '!=');
    combined = combined.replace(/\\min/g, 'min');
    combined = combined.replace(/\\max/g, 'max');
    combined = combined.replace(/\\times/g, 'x');
    combined = combined.replace(/\\oplus/g, '^');
    combined = combined.replace(/\\implies/g, '=>');

    fs.writeFileSync(outputFile, combined, 'utf8');
    console.log(`Successfully created ${outputFile}`);
}

run();
