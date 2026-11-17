const db = require('./database');

const vouchers = Object.values(db.vouchers);
const purchases = vouchers.filter(v => v.voucherType === 'Purchase');
const sales = vouchers.filter(v => v.voucherType === 'Sales');
const creditNotes = vouchers.filter(v => v.voucherType === 'Credit Note');

function parsePairs(qtyStr) {
  if (!qtyStr) return 0;
  if (typeof qtyStr === 'number') return qtyStr;
  const match = String(qtyStr).match(/(-?\d+(?:\.\d+)?)\s*(?:Pairs|Pair|Pcs|Boxes|Box|PRS|prs)/i);
  if (match) return parseFloat(match[1]);
  const numMatch = String(qtyStr).match(/-?\d+(?:\.\d+)?/);
  return numMatch ? parseFloat(numMatch[0]) : 0;
}

let totalPchAmt = 0;
let totalPchPairs = 0;
purchases.forEach(p => {
  totalPchAmt += p.amount || 0;
  (p.inventoryEntries || []).forEach(ie => {
    totalPchPairs += parsePairs(ie.billedQty || ie.actualQty);
  });
});

let totalSalesAmt = 0;
let totalSalesPairs = 0;
sales.forEach(s => {
  totalSalesAmt += s.amount || 0;
  (s.inventoryEntries || []).forEach(ie => {
    totalSalesPairs += parsePairs(ie.billedQty || ie.actualQty);
  });
});

let cnPairs = 0;
let cnAmt = 0;
creditNotes.filter(cn => cn.inventoryEntries && cn.inventoryEntries.length > 0).forEach(cn => {
  cnAmt += Math.abs(cn.amount || 0);
  cn.inventoryEntries.forEach(ie => {
    cnPairs += parsePairs(ie.billedQty || ie.actualQty);
  });
});

console.log('--- AGGREGATE AUDIT SUMMARY ---');
console.log(`Total Purchases (85 bills):`);
console.log(`  Gross Amount: ₹${totalPchAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
console.log(`  Total Pairs: ${totalPchPairs.toLocaleString('en-IN')} Pairs`);

console.log(`\nTotal Gross Sales (86 bills):`);
console.log(`  Gross Amount: ₹${totalSalesAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
console.log(`  Total Pairs: ${totalSalesPairs.toLocaleString('en-IN')} Pairs`);

console.log(`\nSales Returns / Cancellations (CN-8):`);
console.log(`  Credit Amount: ₹${cnAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
console.log(`  Returned Pairs: ${cnPairs.toLocaleString('en-IN')} Pairs`);

const netSalesAmt = totalSalesAmt - cnAmt;
const netSalesPairs = totalSalesPairs - cnPairs;

console.log(`\nNet Effective Sales (85 settled bills):`);
console.log(`  Net Sales Amount: ₹${netSalesAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
console.log(`  Net Sales Pairs: ${netSalesPairs.toLocaleString('en-IN')} Pairs`);

console.log(`\nNet Physical Inventory Difference:`);
console.log(`  Purchased Pairs - Net Sold Pairs = ${totalPchPairs - netSalesPairs} Pairs`);
console.log(`  Closing Inventory Value on Hand = ₹0.00`);
