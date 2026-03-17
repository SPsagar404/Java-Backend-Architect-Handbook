const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const sectionsDir = path.join(dir, 'Complete Week 1 DSA Plan');
const outputFile = path.join(dir, 'Complete-Week1-DSA-Mastery-Guide.md');

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

# Ultra-Detailed Week 1 DSA Mastery Guide
**Target:** FAANG/Product-Based Senior Engineer Interviews
**Focus Topics:** Arrays, Hashing, Two-Pointers, Advanced Math
**Core References:** TUF (Striver), Cracking the Coding Interview

---

# Table of Contents
1. Day 1: Arrays - Matrices & Logic
2. Day 2: Arrays - Pre-computation & Operations
3. Day 3: Arrays - Rotations & Merging
4. Day 4: Hashing & Two Pointers Fundamentals
5. Day 5: Hashing & Prefix Sum Advanced
6. Day 6: Arrays - Math & Majority Elements
7. Day 7: Two Pointer Advanced & Architectural Arrays
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
    console.log('Starting compilation process for Complete Week 1 DSA Guide...');
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

    // Adjusting math representations for standard md-to-pdf since native LaTeX isn't always supported natively without plugins
    combined = combined.replace(/\\lfloor/g, '');
    combined = combined.replace(/\\rfloor/g, '');
    combined = combined.replace(/\\log/g, 'log');
    combined = combined.replace(/\$O\(([^$]+)\)\$/g, '`O($1)`'); // O(N) inline replacement
    combined = combined.replace(/\$\^nC_r\$/g, '`nCr`');
    combined = combined.replace(/\$\^8C_2\$/g, '`8C2`');
    combined = combined.replace(/\$([A-Za-z0-9_ +\-/*=>\^]+)\$/g, '`$1`'); // Any remaining inline math equations
    combined = combined.replace(/\\implies/g, '=>');
    combined = combined.replace(/\\times/g, 'x');
    combined = combined.replace(/\\ge/g, '>=');
    combined = combined.replace(/\\to/g, '->');
    combined = combined.replace(/\\rightarrow/g, '->');
    combined = combined.replace(/\\oplus/g, '^');

    fs.writeFileSync(outputFile, combined, 'utf8');
    console.log(`Successfully created ${outputFile}`);
}

run();
