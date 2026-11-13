const fs = require('fs');
const path = require('path');

const vchsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'vouchers.json'), 'utf8'));
const vchs = Object.values(vchsData);

const ajantaPurchases = vchs.filter(v => 
  v.voucherType === 'Purchase' && 
  (v.partyName?.toLowerCase().includes('ajanta') || v.ledgerEntries?.some(l => l.ledgerName?.toLowerCase().includes('ajanta')))
).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

console.log('Total Ajanta Purchase Vouchers in Tally:', ajantaPurchases.length);

const underMarginItems = [];
let totalOvercharge = 0;

ajantaPurchases.forEach(pv => {
  const invEntries = pv.inventoryEntries || [];
  invEntries.forEach(item => {
    const name = item.stockItemName || '';
    const mrpMatch = name.match(/MRP\s*(\d+(?:\.\d+)?)/i);
    if (!mrpMatch) return;
    const mrp = parseFloat(mrpMatch[1]);
    if (!mrp || mrp <= 0) return;

    // Parse rate and qty
    let rate = 0;
    if (typeof item.rate === 'number') {
      rate = item.rate;
    } else if (typeof item.rate === 'string') {
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

    // Contractual threshold for standard footwear is 37.50%
    // If actual discount is less than 37.40% (allowing small rounding), it's under-margin!
    if (actualDiscountPct < 37.40) {
      const expectedLanded = Math.round(mrp * 0.625 * 100) / 100; // 37.5% net discount
      const diffPerPair = Math.round((landedCost - expectedLanded) * 100) / 100;
      const totalDiff = Math.round(diffPerPair * pairs * 100) / 100;

      if (totalDiff > 0) {
        underMarginItems.push({
          voucherNumber: pv.voucherNumber,
          reference: pv.reference,
          date: pv.date,
          itemName: name,
          mrp,
          rate,
          landedCost,
          actualDiscountPct,
          expectedLanded,
          diffPerPair,
          pairs,
          totalDiff
        });
        totalOvercharge += totalDiff;
      }
    }
  });
});

console.log('Total Under-Margin Line Items found:', underMarginItems.length);
console.log('Total Overcharge (Rate Difference Claim): ₹' + totalOvercharge.toFixed(2));
console.log('\n--- LINE-BY-LINE AUDIT DETAILS ---');
underMarginItems.forEach((x, idx) => {
  console.log(`${idx + 1}. Vch #${x.voucherNumber} (Inv ${x.reference}) dt ${x.date} | ${x.itemName}`);
  console.log(`   MRP: ₹${x.mrp} | Landed: ₹${x.landedCost} (${x.actualDiscountPct}%) | Contractual Landed @ 37.5%: ₹${x.expectedLanded}`);
  console.log(`   Diff/Pair: ₹${x.diffPerPair} | Pairs: ${x.pairs} | Claim Amount: ₹${x.totalDiff.toFixed(2)}`);
});
