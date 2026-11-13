const fs = require('fs');
const vchs = Object.values(JSON.parse(fs.readFileSync('sync-engine/data/vouchers.json')));
const db = require('./database');

const ledgers = db.getLedgers({ limit: 500 }).items || [];
const kgn = ledgers.find(l => l.name.includes('K G N'));

const pVchs = vchs.filter(v => 
  (v.partyName && v.partyName.toLowerCase() === kgn.name.toLowerCase()) ||
  v.ledgerEntries?.some(l => l.ledgerName.toLowerCase() === kgn.name.toLowerCase())
).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

// Session 1: SKIL-004 to 006 (12-08-2026)
// Session 2: SKIL-027 to 029 (11-09-2026)
// Session 3: SKIL-068 to 069 (31-10-2026)

console.log('--- RECONCILED SESSIONS ---');
const s1Gross = 52432 + 55796 + 5606; // 113,834
const s1Paid = 102300 + 5421; // 107,721
const s1OldBal = s1Gross - s1Paid; // 6,113

const s2Gross = 53430 + 57056 + 34144; // 144,630
const s2Paid = 25000;
const s2Bal = s2Gross - s2Paid; // 119,630
const s2Taxable = Math.round((50886 + 54339.53 + 32517.75) * 100) / 100; // 137,743.28
const s2CD = Math.round(s2Taxable * 0.05 * 100) / 100; // 6,887.16
const s2NetPayable = s2Gross - s2CD - s2Paid + s1OldBal; // 118,855.84 -> 118,856

const s3Gross = 81114 + 10275; // 91,389
const s3Paid = 0;
const s3Bal = s3Gross;
const s3Taxable = Math.round((77251.5 + 9786) * 100) / 100; // 87,037.50
const s3CD = Math.round(s3Taxable * 0.05 * 100) / 100; // 4,351.88

console.log('Session 1 (August): Gross ₹' + s1Gross + ' | Paid ₹' + s1Paid + ' | Pending Old Balance: ₹' + s1OldBal);
console.log('Session 2 (September): Gross ₹' + s2Gross + ' | Paid ₹' + s2Paid + ' | Pending: ₹' + s2Bal);
console.log('   Taxable: ₹' + s2Taxable + ' | 5% CD: ₹' + s2CD + ' | Net to Transfer (with Aug): ₹' + s2NetPayable);
console.log('Session 3 (October): Gross ₹' + s3Gross + ' | Paid ₹' + s3Paid + ' | Pending: ₹' + s3Bal);
console.log('   Taxable: ₹' + s3Taxable + ' | 5% CD: ₹' + s3CD);
console.log('Total Ledger Outstanding: ₹' + (s1OldBal + s2Bal + s3Bal));
