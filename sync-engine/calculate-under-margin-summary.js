const fs = require('fs');
const path = require('path');
const vchsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'vouchers.json'), 'utf8'));
const vchs = Object.values(vchsData);

const ajantaPurchases = vchs.filter(v => 
  v.voucherType === 'Purchase' && 
  (v.partyName?.toLowerCase().includes('ajanta') || v.ledgerEntries?.some(l => l.ledgerName?.toLowerCase().includes('ajanta')))
).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

const items = [];

ajantaPurchases.forEach(pv => {
  const invEntries = pv.inventoryEntries || [];
  invEntries.forEach(item => {
    const name = item.stockItemName || '';
    const mrpMatch = name.match(/MRP\s*(\d+(?:\.\d+)?)/i);
    if (!mrpMatch) return;
    const mrp = parseFloat(mrpMatch[1]);
    if (!mrp || mrp <= 0) return;

    let rate = 0;
    if (typeof item.rate === 'number') rate = item.rate;
    else if (typeof item.rate === 'string') {
      const rm = item.rate.match(/(\d+(?:\.\d+)?)/);
      rate = rm ? parseFloat(rm[1]) : 0;
    }
    if (!rate && item.amount) {
      rate = item.amount / (parseFloat(item.billedQty) || 1);
    }

    let pairs = 0;
    if (typeof item.billedQty === 'string') {
      const qm = item.billedQty.match(/(\d+)\s*Pairs/i);
      pairs = qm ? parseInt(qm[1], 10) : parseInt(item.billedQty, 10);
    } else if (typeof item.billedQty === 'number') {
      pairs = item.billedQty;
    }
    if (!pairs) pairs = 1;

    // Landed cost with 5% GST
    const landedCost = Math.round(rate * 1.05 * 100) / 100;
    const actualDiscountPct = Math.round((1 - (landedCost / mrp)) * 10000) / 100;

    // Contractual expected: 
    // Basic = MRP * (1 - 0.4048) = MRP * 0.5952
    // Landed (with 5% GST) = Basic * 1.05 = MRP * 0.62496 (~37.50% discount)
    const expectedBasic = Math.round(mrp * 0.5952 * 100) / 100;
    const expectedLanded = Math.round(expectedBasic * 1.05 * 100) / 100;

    if (actualDiscountPct < 37.40) {
      const rateDiffPerPair = Math.round((rate - expectedBasic) * 100) / 100;
      const landedDiffPerPair = Math.round((landedCost - expectedLanded) * 100) / 100;
      const totalTaxableDiff = Math.round(rateDiffPerPair * pairs * 100) / 100;
      const totalLandedDiff = Math.round(landedDiffPerPair * pairs * 100) / 100;

      if (totalTaxableDiff > 0 || totalLandedDiff > 0) {
        items.push({
          month: pv.date.substring(4, 6),
          date: pv.date,
          vchNo: pv.voucherNumber,
          invNo: pv.reference,
          item: name,
          pairs,
          mrp,
          billedRate: rate,
          billedLanded: landedCost,
          actualDisc: actualDiscountPct,
          contractualRate: expectedBasic,
          contractualLanded: expectedLanded,
          taxableDiffPair: rateDiffPerPair,
          landedDiffPair: landedDiffPerPair,
          totalTaxableDiff,
          totalLandedDiff
        });
      }
    }
  });
});

console.log('SUMMARY BY MONTH:');
const byMonth = {};
items.forEach(it => {
  if (!byMonth[it.month]) byMonth[it.month] = { count: 0, pairs: 0, taxable: 0, landed: 0, invoices: new Set() };
  byMonth[it.month].count++;
  byMonth[it.month].pairs += it.pairs;
  byMonth[it.month].taxable += it.totalTaxableDiff;
  byMonth[it.month].landed += it.totalLandedDiff;
  byMonth[it.month].invoices.add(it.invNo);
});

for (const [m, stat] of Object.entries(byMonth)) {
  console.log(`Month ${m}: ${stat.count} items, ${stat.pairs} pairs across ${stat.invoices.size} invoices (${Array.from(stat.invoices).join(', ')})`);
  console.log(`   Taxable Claim: ₹${stat.taxable.toFixed(2)} | Landed Claim (incl GST): ₹${stat.landed.toFixed(2)}`);
}

console.log('\n--- DETAILED BREAKDOWN OF PENDING (SEP & OCT) ---');
const pending = items.filter(it => it.month === '09' || it.month === '10');
pending.forEach((x, i) => {
  console.log(`${i+1}. [${x.date}] Inv #${x.invNo} (Vch ${x.vchNo}) - ${x.item}`);
  console.log(`   Qty: ${x.pairs} prs | MRP: ₹${x.mrp} | Billed Rate: ₹${x.billedRate} (Landed ₹${x.billedLanded}, ${x.actualDisc}%) | Agreed Rate: ₹${x.contractualRate} (Landed ₹${x.contractualLanded}, 37.50%)`);
  console.log(`   Diff/Pr: Taxable ₹${x.taxableDiffPair} (Landed ₹${x.landedDiffPair}) | Line Claim: Taxable ₹${x.totalTaxableDiff.toFixed(2)} | Landed ₹${x.totalLandedDiff.toFixed(2)}`);
});
