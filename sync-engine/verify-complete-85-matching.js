const db = require('./database');

const vouchers = Object.values(db.vouchers);
const purchases = vouchers.filter(v => v.voucherType === 'Purchase');
const sales = vouchers.filter(v => v.voucherType === 'Sales');

function parsePairs(qtyStr) {
  if (!qtyStr) return 0;
  if (typeof qtyStr === 'number') return qtyStr;
  const match = String(qtyStr).match(/(-?\d+(?:\.\d+)?)\s*(?:Pairs|Pair|Pcs|Boxes|Box|PRS|prs)/i);
  if (match) return parseFloat(match[1]);
  const numMatch = String(qtyStr).match(/-?\d+(?:\.\d+)?/);
  return numMatch ? parseFloat(numMatch[0]) : 0;
}

// Clean reference: trim, remove spaces, lowercase
const cleanRef = (r) => String(r || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

console.log('========================================================================================');
console.log('   COMPLETE 1-TO-1 PURCHASE BILL TO SALES BILL RECONCILIATION (ALL 85 PURCHASES)');
console.log('========================================================================================\n');

const results = [];

// For bills 1 to 85
for (let pNum = 1; pNum <= 85; pNum++) {
  const p = purchases.find(v => {
    const m = String(v.voucherNumber).match(/\d+/);
    return m && parseInt(m[0], 10) === pNum;
  });

  if (!p) {
    results.push({ pNum, status: 'MISSING PURCHASE VOUCHER' });
    continue;
  }

  // Find sales voucher:
  // For pNum = 71, there are two sales vouchers: SKIL-071 (cancelled) and SKIL-078 (re-billed)
  // For pNum 1..70, it is SKIL-001..SKIL-070
  // For pNum 72..77, it is SKIL-072..SKIL-077
  // For pNum 78..85, it is SKIL-079..SKIL-086
  let matchingSales = [];
  if (pNum === 71) {
    const s71 = sales.find(s => s.voucherNumber === 'SKIL-071');
    const s78 = sales.find(s => s.voucherNumber === 'SKIL-078');
    if (s71) matchingSales.push(s71);
    if (s78) matchingSales.push(s78);
  } else if (pNum < 78) {
    const targetNo = 'SKIL-' + String(pNum).padStart(3, '0');
    const s = sales.find(v => v.voucherNumber === targetNo);
    if (s) matchingSales.push(s);
  } else {
    // pNum >= 78 -> SKIL-(pNum + 1)
    const targetNo = 'SKIL-' + String(pNum + 1).padStart(3, '0');
    const s = sales.find(v => v.voucherNumber === targetNo);
    if (s) matchingSales.push(s);
  }

  // Compare quantities and items
  const pItems = {};
  let pTotalPairs = 0;
  (p.inventoryEntries || []).forEach(ie => {
    const name = (ie.stockItemName || '').trim();
    const qty = parsePairs(ie.billedQty || ie.actualQty);
    pItems[name] = (pItems[name] || 0) + qty;
    pTotalPairs += qty;
  });

  // Effective sales for this purchase (for 71, s78 is the final sale, s71 was cancelled by CN-8)
  const activeSale = pNum === 71 ? matchingSales.find(s => s.voucherNumber === 'SKIL-078') : matchingSales[0];

  const sItems = {};
  let sTotalPairs = 0;
  if (activeSale) {
    (activeSale.inventoryEntries || []).forEach(ie => {
      const name = (ie.stockItemName || '').trim();
      const qty = parsePairs(ie.billedQty || ie.actualQty);
      sItems[name] = (sItems[name] || 0) + qty;
      sTotalPairs += qty;
    });
  }

  const allItems = new Set([...Object.keys(pItems), ...Object.keys(sItems)]);
  let diffCount = 0;
  allItems.forEach(name => {
    const pq = pItems[name] || 0;
    const sq = sItems[name] || 0;
    if (Math.abs(pq - sq) > 0.001) diffCount++;
  });

  results.push({
    pNum,
    pDate: p.date,
    pRef: p.reference,
    supplier: p.partyName.replace(' (India) Pvt. Ltd.', '').replace(' (INDIA) PRIVATE LIMITED', '').replace(' LLP', ''),
    pAmt: p.amount,
    pPairs: pTotalPairs,
    salesVch: matchingSales.map(s => s.voucherNumber).join(' & '),
    activeSaleVch: activeSale ? activeSale.voucherNumber : 'NONE',
    customer: activeSale ? activeSale.partyName : 'NONE',
    sAmt: activeSale ? activeSale.amount : 0,
    sPairs: sTotalPairs,
    isRefMatched: activeSale ? cleanRef(p.reference) === cleanRef(activeSale.reference) : false,
    diffCount,
    status: (diffCount === 0 && activeSale && pTotalPairs === sTotalPairs) ? 'EXACT MATCH (100% SOLD)' : 'MISMATCH'
  });
}

const exactMatches = results.filter(r => r.status === 'EXACT MATCH (100% SOLD)');
console.log(`Summary of 85 Purchase Bills:`);
console.log(`- Exact Matches (100% Sold, 0 Item Discrepancies): ${exactMatches.length} / 85`);
console.log(`- Mismatches: ${results.length - exactMatches.length}\n`);

// Print all 85 lines in clean tabular form
console.log(
  'P#'.padEnd(4) +
  'Pch Date'.padEnd(11) +
  'Supplier Inv Ref'.padEnd(18) +
  'Supplier'.padEnd(18) +
  'Pch Amt (₹)'.padStart(12) +
  'Pairs'.padStart(8) +
  '  ' +
  'Sales Vch'.padEnd(14) +
  'Customer / Consignee'.padEnd(36) +
  'Sales Amt (₹)'.padStart(14) +
  'Status'.padStart(24)
);
console.log('─'.repeat(160));

results.forEach(r => {
  const dStr = `${r.pDate.substring(6,8)}-${r.pDate.substring(4,6)}-${r.pDate.substring(0,4)}`;
  console.log(
    `#${String(r.pNum).padStart(2)}  ` +
    `${dStr}  ` +
    `${(r.pRef || '').padEnd(18)}` +
    `${r.supplier.slice(0, 16).padEnd(18)}` +
    `${r.pAmt.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(12)}` +
    `${r.pPairs.toString().padStart(8)}  ` +
    `${r.salesVch.padEnd(14)}` +
    `${r.customer.slice(0, 34).padEnd(36)}` +
    `${r.sAmt.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(14)}` +
    `${r.status.padStart(24)}`
  );
});
