const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const sectionsDir = path.join(dir, 'sections');
const outputFile = path.join(dir, 'Java-8-Mastering-Guide.md');

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

# Mastering Java Streams & Functional Programming -- Complete Professional Guide

---

**Author:** Senior Java Backend Architect
**Target Audience:** Java developers with 1--5 years of experience aiming for mastery in functional programming and Java Streams
**Prerequisites:** Core Java, OOP fundamentals, Java Collections basics
**Java Version:** Java 8+ (with modern best practices up to Java 17+)

---

# Table of Contents

1. Introduction to Functional Programming in Java
2. Java Stream API Overview
3. Stream Creation Methods
4. All Intermediate Stream Operations
5. All Terminal Stream Operations
6. Collectors Deep Dive
7. Functional Interfaces (Complete Guide)
8. Method References
9. Comparable vs Comparator (Deep Guide)
10. Advanced Stream Topics
11. Real-World Use Cases
12. 50+ Coding Interview Problems Using Streams
13. Stream Best Practices
14. Common Interview Questions
15. Practice Section

---

`;

const files = [
    'j8-01-intro.md',
    'j8-02-streams-core.md',
    'j8-03-functional.md',
    'j8-04-advanced.md',
    'j8-05-interview.md'
];

function run() {
    console.log('Starting compilation process...');
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

    // Applying Unicode Box Drawing parsing back to ASCII exactly like other files
    combined = combined
        .replace(/\u250C/g, '+').replace(/\u2510/g, '+').replace(/\u2514/g, '+').replace(/\u2518/g, '+')
        .replace(/\u251C/g, '+').replace(/\u2524/g, '+').replace(/\u252C/g, '+').replace(/\u2534/g, '+')
        .replace(/\u2500/g, '-').replace(/\u2502/g, '|').replace(/\u253C/g, '+')
        .replace(/\u2190/g, '<-').replace(/\u2192/g, '->').replace(/\u2193/g, 'v').replace(/\u2191/g, '^')
        .replace(/\u25BA/g, '>').replace(/\u25C4/g, '<')
        .replace(/\u00D7/g, 'x')
        .replace(/\u2026/g, '...')
        .replace(/\u2013/g, '-').replace(/\u2014/g, '--')
        .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
        .replace(/\u2018/g, "'").replace(/\u2019/g, "'");

    fs.writeFileSync(outputFile, combined, 'utf8');
    console.log(`Successfully created ${outputFile}`);
}

run();
