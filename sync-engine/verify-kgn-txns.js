const fs = require('fs');
const vchs = Object.values(JSON.parse(fs.readFileSync('sync-engine/data/vouchers.json')));
const db = require('./database');

const ledgers = db.getLedgers({ limit: 500 }).items || [];
const kgn = ledgers.find(l => l.name.includes('K G N'));

const pVchs = vchs.filter(v => 
  (v.partyName && v.partyName.toLowerCase() === kgn.name.toLowerCase()) ||
  v.ledgerEntries?.some(l => l.ledgerName.toLowerCase() === kgn.name.toLowerCase())
).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

console.log('--- ALL TRANSACTIONS FOR KGN ---');
pVchs.forEach(v => {
  console.log(`${v.date} | ${v.voucherType} #${v.voucherNumber} | Amount: ₹${v.amount} | Nar: ${v.narration}`);
});
