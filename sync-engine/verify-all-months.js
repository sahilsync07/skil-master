const fs = require('fs');
const vchs = Object.values(JSON.parse(fs.readFileSync('sync-engine/data/vouchers.json')));

function auditMonth(mStr) {
  const purchases = vchs.filter(v => 
    v.voucherType === 'Purchase' && 
    (v.partyName?.toLowerCase().includes('ajanta') || v.ledgerEntries?.some(l => l.ledgerName?.toLowerCase().includes('ajanta'))) && 
    v.date.startsWith('2026' + mStr)
  );

  console.log(`=== AUDIT FOR MONTH 2026-${mStr} (Total Purchases: ${purchases.length}) ===`);
  const found = [];
  purchases.forEach(pv => {
    (pv.inventoryEntries || []).forEach(item => {
      const name = item.stockItemName || '';
      const mrpMatch = name.match(/MRP\s*(\d+(?:\.\d+)?)/i);
      if (!mrpMatch) return;
      const mrp = parseFloat(mrpMatch[1]);
      
      let rate = 0;
      if (typeof item.rate === 'number') rate = item.rate;
      else if (typeof item.rate === 'string') {
        const rm = item.rate.match(/(\d+(?:\.\d+)?)/);
        rate = rm ? parseFloat(rm[1]) : 0;
      }
      if (!rate && item.amount) rate = item.amount / (parseFloat(item.billedQty) || 1);

      let pairs = 0;
      if (typeof item.billedQty === 'string') {
        const qm = item.billedQty.match(/(\d+)\s*Pairs/i);
        pairs = qm ? parseInt(qm[1], 10) : parseInt(item.billedQty, 10);
      } else if (typeof item.billedQty === 'number') {
        pairs = item.billedQty;
      }
      if (!pairs) pairs = 1;

      const landed = Math.round(rate * 1.05 * 100) / 100;
      const netMargin = (mrp - landed) / mrp;
      const expectedBuyRate = Math.round(mrp * 0.625 * 100) / 100;
      const diff = Math.round((expectedBuyRate - landed) * 100) / 100;
      const totalDiff = Math.round(diff * pairs * 100) / 100;

      if (netMargin < 0.3745) {
        found.push({
          inv: pv.reference,
          item: name,
          mrp,
          rate,
          landed,
          netMarginPct: (netMargin * 100).toFixed(2) + '%',
          expectedBuyRate,
          diff,
          pairs,
          totalDiff
        });
      }
    });
  });

  found.forEach((x, i) => {
    console.log(`${i+1}. Inv: ${x.inv} | Item: ${x.item} | MRP: ${x.mrp} | Landed: ${x.landed} | Margin: ${x.netMarginPct} | Expected: ${x.expectedBuyRate} | Diff: ${x.diff} | Pairs: ${x.pairs} | Total: ${x.totalDiff}`);
  });
  const sumTotal = found.reduce((acc, curr) => acc + curr.totalDiff, 0);
  console.log(`TOTAL DIFFERENCE FOR MONTH ${mStr}: ${sumTotal.toFixed(2)}\n`);
}

auditMonth('08');
auditMonth('09');
auditMonth('10');
