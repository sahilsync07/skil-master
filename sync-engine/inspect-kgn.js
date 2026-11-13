const fs = require('fs');
const vchs = Object.values(JSON.parse(fs.readFileSync('sync-engine/data/vouchers.json')));
const kgnVchs = vchs.filter(v => 
  (v.partyName && (v.partyName.toLowerCase().includes('k g n') || v.partyName.toLowerCase().includes('kgn'))) ||
  (v.ledgerEntries && v.ledgerEntries.some(l => l.ledgerName && (l.ledgerName.toLowerCase().includes('k g n') || l.ledgerName.toLowerCase().includes('kgn'))))
).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

console.log('Total KGN Vouchers in Tally:', kgnVchs.length);
kgnVchs.forEach(v => {
  const partyEntry = v.ledgerEntries?.find(l => l.ledgerName?.toLowerCase().includes('k g n') || l.ledgerName?.toLowerCase().includes('kgn'));
  console.log(`[${v.date}] Type: ${v.voucherType} | No: ${v.voucherNumber} | Amount: ${v.amount} | PartyAmt: ${partyEntry?.amount} | isPositive: ${partyEntry?.isDeemedPositive} | Ref: ${v.reference || ''} | Nar: ${v.narration || ''}`);
});
