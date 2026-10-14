import fs from 'fs';

const filePath = '/Users/pierrejuniorsamuel/python-practice/bank/boutique-rapo-github/public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Replace toLocaleDateString('fr-HT' with toLocaleDateString(['fr-HT', 'fr']
content = content.replace(/toLocaleDateString\('fr-HT'/g, "toLocaleDateString(['fr-HT', 'fr']");
content = content.replace(/toLocaleTimeString\('fr-HT'/g, "toLocaleTimeString(['fr-HT', 'fr']");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced all fr-HT locales with fallback array in public/index.html!');
