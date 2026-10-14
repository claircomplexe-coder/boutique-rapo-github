import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync('/Users/pierrejuniorsamuel/python-practice/bank/boutique-rapo-github/public/index.html', 'utf8');
const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  const code = match[1];
  count++;
  try {
    new vm.Script(code);
    console.log(`Script ${count} compiled successfully!`);
  } catch (err) {
    console.error(`Script ${count} compilation failed:`, err);
  }
}
