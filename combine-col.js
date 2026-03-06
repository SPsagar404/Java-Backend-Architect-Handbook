const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const sectionsDir = path.join(dir, 'sections');

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
code { font-family: 'Consolas', 'Courier New', monospace; font-size: 9pt; }
pre { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 9pt; line-height: 1.4; }
pre code { font-family: 'Consolas', 'Courier New', monospace; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
th { background: #1a237e; color: white; padding: 8px 12px; text-align: left; }
td { border: 1px solid #e0e0e0; padding: 6px 12px; }
tr:nth-child(even) { background: #f5f5f5; }
blockquote { border-left: 4px solid #ff9800; background: #fff3e0; padding: 8px 16px; }
</style>

`;

const files = [
    'col-01-intro.md',
    'col-02-interfaces.md',
    'col-03-implementations.md',
    'col-04-maps.md',
    'col-05-advanced.md',
    'col-06-interview.md'
];

let combined = frontmatter;

for (const file of files) {
    const content = fs.readFileSync(path.join(sectionsDir, file), 'utf8');
    combined += content + '\n\n';
}

// Replace Unicode box-drawing characters with simple ASCII equivalents
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

fs.writeFileSync(path.join(dir, 'Java-Collections-Mastering-Guide.md'), combined, 'utf8');
console.log('Collections guide combined successfully with fixed characters.');
