const fs = require('fs');
const path = require('path');
const db = require('./database');

const purchasesDir = path.resolve('user-documents-read-only-access/Purchases - last updated on 16-11-2026 at 18-44 hrs');
const files = fs.readdirSync(purchasesDir);

console.log('Total files in Purchases folder:', files.length);

const activeFiles = files.filter(f => !f.startsWith('CANCELLED') && f.endsWith('.pdf'));
const cancelledFiles = files.filter(f => f.startsWith('CANCELLED'));

console.log('Active PDF files:', activeFiles.length);
console.log('Cancelled files:', cancelledFiles.length);

const vouchers = Object.values(db.vouchers);
const pchVouchers = vouchers.filter(v => v.voucherType === 'Purchase');

console.log('Purchase Vouchers in Tally:', pchVouchers.length);

// Check if all 85 active files match the 85 Tally purchase vouchers
const fileMap = new Map();
activeFiles.forEach(f => {
  const parts = f.split(' - ');
  const pfx = parseInt(parts[0], 10);
  fileMap.set(pfx, f);
});

console.log('\nChecking 1 to 85 file coverage:');
let missingFiles = [];
for (let i = 1; i <= 85; i++) {
  if (!fileMap.has(i)) {
    missingFiles.push(i);
  }
}
console.log('Missing file numbers (1-85):', missingFiles.length === 0 ? 'None (All 1-85 exist!)' : missingFiles);

// Compare references
let refMismatches = [];
for (let i = 1; i <= 85; i++) {
  const vch = pchVouchers.find(v => {
    const m = String(v.voucherNumber).match(/\d+/);
    return m && parseInt(m[0], 10) === i;
  });
  const fn = fileMap.get(i);
  if (vch && fn) {
    const parts = fn.split(' - ');
    const refInFile = parts[1].trim();
    const refInVch = (vch.reference || '').trim();
    if (!refInFile.includes(refInVch) && !refInVch.includes(refInFile)) {
      refMismatches.push({ i, refInFile, refInVch });
    }
  }
}
console.log('Reference mismatches between PDF filename and Tally voucher:', refMismatches.length === 0 ? 'None (All 100% match!)' : refMismatches);
