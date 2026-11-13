const fs = require('fs');

const text66 = fs.readFileSync('sync-engine/inv66_text.txt', 'utf8');
const text73 = fs.readFileSync('sync-engine/inv73_text.txt', 'utf8');

// Let's inspect the lines in text66 that correspond to our 22 items
const lines66 = text66.split('\n').map(l => l.trim()).filter(Boolean);
console.log('--- Lines from Inv 66 ---');
lines66.forEach((l, idx) => {
  if (l.includes('CARINA') || l.includes('CEL') || l.includes('FEMINA')) {
    console.log(idx + ': ' + l);
  }
});

console.log('\n--- Lines from Inv 73 ---');
const lines73 = text73.split('\n').map(l => l.trim()).filter(Boolean);
lines73.forEach((l, idx) => {
  if (l.includes('CEL')) {
    console.log(idx + ': ' + l);
  }
});
