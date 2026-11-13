const fs = require('fs');
const vchs = Object.values(JSON.parse(fs.readFileSync('sync-engine/data/vouchers.json')));
const db = require('./database');

const ledgers = db.getLedgers({ limit: 500 }).items || [];
const debtors = ledgers.filter(l => l.parent === 'Sundry Debtors');

console.log('Total Debtors:', debtors.length);

debtors.forEach(d => {
  const pVchs = vchs.filter(v => 
    (v.partyName && v.partyName.toLowerCase() === d.name.toLowerCase()) ||
    v.ledgerEntries?.some(l => l.ledgerName.toLowerCase() === d.name.toLowerCase())
  ).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  const sales = pVchs.filter(v => v.voucherType === 'Sales');
  if (sales.length === 0) return;

  console.log(`\n=== Party: ${d.name} (${sales.length} Sales Bills) ===`);
  
  // Group sales into sessions (same date or within 4 days)
  const sessions = [];
  sales.forEach(s => {
    const sDate = s.date;
    const year = parseInt(sDate.substring(0, 4));
    const month = parseInt(sDate.substring(4, 6)) - 1;
    const day = parseInt(sDate.substring(6, 8));
    const dt = new Date(year, month, day);

    let foundSession = sessions.find(sess => {
      const diffDays = Math.abs((dt - sess.latestDate) / (1000 * 60 * 60 * 24));
      return diffDays <= 4;
    });

    if (foundSession) {
      foundSession.bills.push(s);
      if (dt > foundSession.latestDate) {
        foundSession.latestDate = dt;
        foundSession.latestDateStr = sDate;
      }
    } else {
      sessions.push({
        id: `sess-${sessions.length + 1}`,
        earliestDate: dt,
        latestDate: dt,
        latestDateStr: sDate,
        bills: [s]
      });
    }
  });

  sessions.forEach((sess, idx) => {
    const billNos = sess.bills.map(b => b.voucherNumber).join(', ');
    const totalAmt = sess.bills.reduce((sum, b) => sum + b.amount, 0);
    console.log(`  Session ${idx + 1} (${sess.latestDateStr}): Bills [${billNos}] Total: ₹${totalAmt}`);
  });

  const receipts = pVchs.filter(v => v.voucherType === 'Receipt');
  const creditNotes = pVchs.filter(v => v.voucherType === 'Credit Note');
  const payments = pVchs.filter(v => v.voucherType === 'Payment');
  console.log(`  Receipts: ${receipts.length} (₹${receipts.reduce((a,b)=>a+b.amount,0)}) | CNs: ${creditNotes.length} (₹${creditNotes.reduce((a,b)=>a+b.amount,0)}) | Refunds: ${payments.length}`);
});
