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

console.log('=====================================================');
console.log('   MAPPING BY SUPPLIER REFERENCE (INVOICE NUMBER)');
console.log('=====================================================\n');

// Clean reference: trim, remove spaces, lowercase
const cleanRef = (r) => String(r || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const salesByRef = new Map();
sales.forEach(s => {
  const refKey = cleanRef(s.reference);
  if (refKey) {
    if (!salesByRef.has(refKey)) salesByRef.set(refKey, []);
    salesByRef.get(refKey).push(s);
  }
});

let matchedByRef = 0;
let itemMismatchCount = 0;
const unmatchedPurchases = [];

purchases.forEach(p => {
  const refKey = cleanRef(p.reference);
  const matchedSalesList = salesByRef.get(refKey) || [];

  if (matchedSalesList.length === 0) {
    unmatchedPurchases.push(p);
  } else {
    matchedByRef++;
    const s = matchedSalesList[0];

    // Check items
    const pItems = {};
    (p.inventoryEntries || []).forEach(ie => {
      const name = (ie.stockItemName || '').trim();
      const qty = parsePairs(ie.billedQty || ie.actualQty);
      pItems[name] = (pItems[name] || 0) + qty;
    });

    const sItems = {};
    (s.inventoryEntries || []).forEach(ie => {
      const name = (ie.stockItemName || '').trim();
      const qty = parsePairs(ie.billedQty || ie.actualQty);
      sItems[name] = (sItems[name] || 0) + qty;
    });

    const allItems = new Set([...Object.keys(pItems), ...Object.keys(sItems)]);
    const diffs = [];
    allItems.forEach(name => {
      const pQty = pItems[name] || 0;
      const sQty = sItems[name] || 0;
      if (Math.abs(pQty - sQty) > 0.001) {
        diffs.push({ name, pQty, sQty, diff: pQty - sQty });
      }
    });

    if (diffs.length > 0) {
      itemMismatchCount++;
      console.log(`MISMATCH in Ref: ${p.reference} (Pch #${p.voucherNumber} vs Sales #${s.voucherNumber}):`);
      console.log(`  Customer: ${s.partyName}`);
      console.log(`  Diffs:`, JSON.stringify(diffs));
    }
  }
});

console.log(`\nResults when matching by Supplier Invoice Reference:`);
console.log(`- Total Purchases: ${purchases.length}`);
console.log(`- Purchases Matched to Sales: ${matchedByRef}`);
console.log(`- Purchases Unmatched: ${unmatchedPurchases.length}`);
console.log(`- Pairs with Item Quantity Mismatches: ${itemMismatchCount}`);

// Also check sales without purchases
const purchaseByRef = new Map();
purchases.forEach(p => {
  const refKey = cleanRef(p.reference);
  if (refKey) {
    if (!purchaseByRef.has(refKey)) purchaseByRef.set(refKey, []);
    purchaseByRef.get(refKey).push(p);
  }
});

const unmatchedSales = [];
sales.forEach(s => {
  const refKey = cleanRef(s.reference);
  if (!purchaseByRef.has(refKey)) {
    unmatchedSales.push(s);
  }
});

console.log(`- Sales Unmatched to Purchases: ${unmatchedSales.length}`);
if (unmatchedSales.length > 0) {
  console.log('Unmatched Sales details:', JSON.stringify(unmatchedSales.map(s => ({ vchNo: s.voucherNumber, ref: s.reference, party: s.partyName, amt: s.amount })), null, 2));
}
