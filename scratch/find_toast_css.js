import fs from 'fs';

const html = fs.readFileSync('/Users/pierrejuniorsamuel/python-practice/bank/boutique-rapo-github/public/index.html', 'utf8');
const styleRegex = /<style>([\s\S]*?)<\/style>/gi;
let match;
while ((match = styleRegex.exec(html)) !== null) {
  const css = match[1];
  const lines = css.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('toast')) {
      console.log(`Line ${index + 1}: ${line}`);
    }
  });
}
