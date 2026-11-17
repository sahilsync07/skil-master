const TallyClient = require('./tally-client');
const normalizer = require('./normalizer');

async function analyzeAllVouchers() {
  const tc = new TallyClient();
  const xml = await tc.getVouchers('SKIL LIFESTYLE LLP', 0);
  const vchs = normalizer.normalizeVouchers(xml);

  const purchases = vchs.filter(v => v.voucherType === 'Purchase');
  const sales = vchs.filter(v => v.voucherType === 'Sales');

  console.log(`Live Tally: Purchases = ${purchases.length}, Sales = ${sales.length}`);

  // Let's list all purchases
  console.log('\n--- ALL PURCHASES (Sorted by VoucherNumber) ---');
  purchases.sort((a,b) => {
    const ma = parseInt(String(a.voucherNumber).match(/\d+/)[0], 10);
    const mb = parseInt(String(b.voucherNumber).match(/\d+/)[0], 10);
    return ma - mb;
  }).forEach(p => {
    console.log(`Pch #${p.voucherNumber.padEnd(3)} | Date: ${p.date} | Ref: ${(p.reference || '').padEnd(16)} | Party: ${p.partyName.padEnd(32)} | Amt: ${p.amount} | Items: ${(p.inventoryEntries||[]).length}`);
  });

  console.log('\n--- ALL SALES (Sorted by VoucherNumber) ---');
  sales.sort((a,b) => {
    const ma = parseInt(String(a.voucherNumber).match(/\d+/)[0], 10);
    const mb = parseInt(String(b.voucherNumber).match(/\d+/)[0], 10);
    return ma - mb;
  }).forEach(s => {
    console.log(`Sales #${s.voucherNumber.padEnd(8)} | Date: ${s.date} | Ref: ${(s.reference || '').padEnd(16)} | Party: ${s.partyName.padEnd(36)} | Amt: ${s.amount} | Items: ${(s.inventoryEntries||[]).length}`);
  });
}

analyzeAllVouchers().catch(console.error);
