const fs = require('fs');
const path = require('path');
const db = require('./database');
const TallyClient = require('./tally-client');

async function runAudit() {
  console.log('=====================================================');
  console.log('   SKIL LIFESTYLE LLP — PURCHASE vs SALES & STOCK AUDIT');
  console.log('=====================================================\n');

  const vouchers = Object.values(db.vouchers);
  const stockItems = Object.values(db.stockItems);

  console.log(`Loaded from sync-engine database:`);
  console.log(`- Total Vouchers: ${vouchers.length}`);
  console.log(`- Total Stock Items Master: ${stockItems.length}\n`);

  // 1. Separate vouchers by type
  const purchases = vouchers.filter(v => v.voucherType === 'Purchase');
  const sales = vouchers.filter(v => v.voucherType === 'Sales');
  const debitNotes = vouchers.filter(v => v.voucherType === 'Debit Note');
  const creditNotes = vouchers.filter(v => v.voucherType === 'Credit Note');

  console.log(`Voucher Counts:`);
  console.log(`- Purchases: ${purchases.length}`);
  console.log(`- Sales: ${sales.length}`);
  console.log(`- Debit Notes: ${debitNotes.length}`);
  console.log(`- Credit Notes: ${creditNotes.length}\n`);

  // Sort purchases and sales by voucher number
  const cleanVchNo = (no) => {
    if (!no) return 0;
    const match = String(no).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  purchases.sort((a, b) => cleanVchNo(a.voucherNumber) - cleanVchNo(b.voucherNumber));
  sales.sort((a, b) => cleanVchNo(a.voucherNumber) - cleanVchNo(b.voucherNumber));

  // 2. Check 1-to-1 Purchase to Sales Matching
  console.log('-----------------------------------------------------');
  console.log('1. ONE-TO-ONE PURCHASE vs SALES VOUCHER MATCHING');
  console.log('-----------------------------------------------------');

  const purchaseMap = new Map();
  purchases.forEach(p => {
    const num = cleanVchNo(p.voucherNumber);
    purchaseMap.set(num, p);
  });

  const salesMap = new Map();
  sales.forEach(s => {
    const num = cleanVchNo(s.voucherNumber);
    salesMap.set(num, s);
  });

  const allNumbers = new Set([...purchaseMap.keys(), ...salesMap.keys()]);
  const sortedNumbers = Array.from(allNumbers).sort((a, b) => a - b);

  let matchedCount = 0;
  let unmatchedPurchases = [];
  let unmatchedSales = [];
  let matchingDetails = [];

  for (const num of sortedNumbers) {
    const p = purchaseMap.get(num);
    const s = salesMap.get(num);

    if (p && s) {
      matchedCount++;
      matchingDetails.push({
        num,
        purchaseVchNo: p.voucherNumber,
        purchaseRef: p.reference || 'N/A',
        purchaseDate: p.date,
        supplier: p.partyName,
        purchaseAmt: p.amount,
        salesVchNo: s.voucherNumber,
        salesRef: s.reference || 'N/A',
        salesDate: s.date,
        customer: s.partyName,
        salesAmt: s.amount,
        purchaseItemsCount: (p.inventoryEntries || []).length,
        salesItemsCount: (s.inventoryEntries || []).length
      });
    } else if (p && !s) {
      unmatchedPurchases.push({
        num,
        voucherNumber: p.voucherNumber,
        reference: p.reference,
        date: p.date,
        party: p.partyName,
        amount: p.amount
      });
    } else if (!p && s) {
      unmatchedSales.push({
        num,
        voucherNumber: s.voucherNumber,
        reference: s.reference,
        date: s.date,
        party: s.partyName,
        amount: s.amount
      });
    }
  }

  console.log(`Total Number Slots Analyzed: ${sortedNumbers.length}`);
  console.log(`- Perfectly Matched (1-to-1 Purchase & Sales pair exists): ${matchedCount}`);
  console.log(`- Purchases WITHOUT Sales: ${unmatchedPurchases.length}`);
  console.log(`- Sales WITHOUT Purchases: ${unmatchedSales.length}\n`);

  if (unmatchedPurchases.length > 0) {
    console.log('UNMATCHED PURCHASES (Purchased but no sales bill):');
    console.log(JSON.stringify(unmatchedPurchases, null, 2));
  }

  if (unmatchedSales.length > 0) {
    console.log('UNMATCHED SALES (Sold but no purchase bill):');
    console.log(JSON.stringify(unmatchedSales, null, 2));
  }

  // 3. Inventory Quantities Check (Inward vs Outward)
  console.log('-----------------------------------------------------');
  console.log('2. INVENTORY MOVEMENTS: INWARD QTY vs OUTWARD QTY');
  console.log('-----------------------------------------------------');

  // Helper to parse quantity string (e.g., "48 Pairs = 1 Box" or "48 Pairs" or "-48 Pairs")
  function parsePairs(qtyStr) {
    if (!qtyStr) return 0;
    if (typeof qtyStr === 'number') return qtyStr;
    const match = String(qtyStr).match(/(-?\d+(?:\.\d+)?)\s*(?:Pairs|Pair|Pcs|Boxes|Box|PRS|prs)/i);
    if (match) {
      return parseFloat(match[1]);
    }
    const numMatch = String(qtyStr).match(/-?\d+(?:\.\d+)?/);
    return numMatch ? parseFloat(numMatch[0]) : 0;
  }

  const itemStockTracker = {}; // itemName -> { inwardPairs, outwardPairs, inwardBoxes, outwardBoxes, vouchers: [] }

  function getTracker(name) {
    if (!itemStockTracker[name]) {
      itemStockTracker[name] = {
        name,
        inwardPairs: 0,
        outwardPairs: 0,
        purchasesCount: 0,
        salesCount: 0,
        debitNotesCount: 0,
        creditNotesCount: 0,
        history: []
      };
    }
    return itemStockTracker[name];
  }

  // Track all vouchers
  vouchers.forEach(vch => {
    if (!vch.inventoryEntries || vch.inventoryEntries.length === 0) return;

    vch.inventoryEntries.forEach(ie => {
      const itemName = (ie.stockItemName || '').trim();
      if (!itemName) return;

      const tracker = getTracker(itemName);
      const billedQtyPairs = parsePairs(ie.billedQty || ie.actualQty);
      const actualQtyPairs = parsePairs(ie.actualQty || ie.billedQty);
      const pairs = billedQtyPairs || actualQtyPairs;

      if (vch.voucherType === 'Purchase') {
        tracker.inwardPairs += pairs;
        tracker.purchasesCount++;
        tracker.history.push({
          type: 'Purchase',
          vchNo: vch.voucherNumber,
          date: vch.date,
          pairs,
          rate: ie.rateNumeric,
          amount: ie.amount
        });
      } else if (vch.voucherType === 'Sales') {
        tracker.outwardPairs += pairs;
        tracker.salesCount++;
        tracker.history.push({
          type: 'Sales',
          vchNo: vch.voucherNumber,
          date: vch.date,
          pairs,
          rate: ie.rateNumeric,
          amount: ie.amount
        });
      } else if (vch.voucherType === 'Debit Note') {
        // Debit note to supplier = return to supplier (outward) OR adjustment
        // Let's see whether debit note has positive or negative qty
        tracker.outwardPairs += pairs;
        tracker.debitNotesCount++;
        tracker.history.push({
          type: 'Debit Note',
          vchNo: vch.voucherNumber,
          date: vch.date,
          pairs,
          rate: ie.rateNumeric,
          amount: ie.amount
        });
      } else if (vch.voucherType === 'Credit Note') {
        // Credit note from customer = return from customer (inward)
        tracker.inwardPairs += pairs;
        tracker.creditNotesCount++;
        tracker.history.push({
          type: 'Credit Note',
          vchNo: vch.voucherNumber,
          date: vch.date,
          pairs,
          rate: ie.rateNumeric,
          amount: ie.amount
        });
      }
    });
  });

  const trackedItems = Object.values(itemStockTracker);
  console.log(`Total Distinct Stock Items used in Vouchers: ${trackedItems.length}`);

  const nonZeroStockItems = trackedItems.filter(item => {
    const net = Math.round((item.inwardPairs - item.outwardPairs) * 100) / 100;
    return Math.abs(net) > 0.001;
  });

  console.log(`Stock Items with ZERO Net Movement (Inward == Outward): ${trackedItems.length - nonZeroStockItems.length}`);
  console.log(`Stock Items with NON-ZERO Net Movement: ${nonZeroStockItems.length}\n`);

  if (nonZeroStockItems.length > 0) {
    console.log('--- NON-ZERO STOCK ITEMS FOUND IN TRANSACTION LEDGERS ---');
    nonZeroStockItems.forEach(item => {
      const net = Math.round((item.inwardPairs - item.outwardPairs) * 100) / 100;
      console.log(`\nItem: "${item.name}"`);
      console.log(`  Inward: ${item.inwardPairs} Pairs | Outward: ${item.outwardPairs} Pairs | Net Balance: ${net} Pairs`);
      console.log(`  History (${item.history.length} entries):`);
      item.history.forEach(h => {
        console.log(`    - ${h.type} #${h.vchNo} (${h.date}): ${h.pairs} Pairs @ ${h.rate} = ₹${h.amount}`);
      });
    });
  }

  // 4. Live Tally Check: Closing Balance directly from Tally
  console.log('\n-----------------------------------------------------');
  console.log('3. LIVE TALLY QUERY: CLOSING BALANCE FROM TALLY PRIME');
  console.log('-----------------------------------------------------');

  try {
    const tc = new TallyClient();
    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>LiveStockClosing</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>SKIL LIFESTYLE LLP</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="LiveStockClosing">
            <TYPE>StockItem</TYPE>
            <FETCH>Name, ClosingBalance, ClosingValue, ClosingRate, InwardQuantity, OutwardQuantity</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const xmlRes = await tc.post(xml);
    const { XMLParser } = require('fast-xml-parser');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xmlRes);

    let tallyItems = [];
    const coll = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM || parsed?.ENVELOPE?.BODY?.COLLECTION?.STOCKITEM;
    if (coll) {
      tallyItems = Array.isArray(coll) ? coll : [coll];
    }

    console.log(`Fetched ${tallyItems.length} Stock Items from live Tally instance.`);

    const tallyNonZero = [];
    tallyItems.forEach(item => {
      const name = item['@_NAME'] || item.NAME;
      const closingBal = item.CLOSINGBALANCE;
      const closingVal = item.CLOSINGVALUE;
      const closingBalText = typeof closingBal === 'object' ? (closingBal['#text'] || '') : String(closingBal || '');
      const closingValNum = typeof closingVal === 'object' ? parseFloat(closingVal['#text'] || 0) : parseFloat(closingVal || 0);

      if (closingBalText.trim() !== '' || Math.abs(closingValNum) > 0.01) {
        tallyNonZero.push({
          name,
          closingBalance: closingBalText,
          closingValue: closingValNum,
          closingRate: item.CLOSINGRATE
        });
      }
    });

    console.log(`Live Tally Items with Non-Zero Closing Balance: ${tallyNonZero.length}`);
    if (tallyNonZero.length > 0) {
      console.log('Tally Non-Zero Items:');
      console.log(JSON.stringify(tallyNonZero, null, 2));
    }
  } catch (err) {
    console.error('Could not query live Tally ClosingBalance:', err.message);
  }

  // 5. Per-Bill 1-to-1 Item-by-Item Matching Check
  console.log('\n-----------------------------------------------------');
  console.log('4. BILL-BY-BILL ITEM DISCREPANCY AUDIT');
  console.log('-----------------------------------------------------');

  let billsWithItemMismatches = [];

  for (const match of matchingDetails) {
    const p = purchaseMap.get(match.num);
    const s = salesMap.get(match.num);

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

    const allItemNames = new Set([...Object.keys(pItems), ...Object.keys(sItems)]);
    const itemDiffs = [];

    for (const name of allItemNames) {
      const pQty = pItems[name] || 0;
      const sQty = sItems[name] || 0;
      if (Math.abs(pQty - sQty) > 0.001) {
        itemDiffs.push({
          itemName: name,
          purchaseQty: pQty,
          salesQty: sQty,
          diff: pQty - sQty
        });
      }
    }

    if (itemDiffs.length > 0) {
      billsWithItemMismatches.push({
        num: match.num,
        purchaseVchNo: match.purchaseVchNo,
        purchaseRef: match.purchaseRef,
        salesVchNo: match.salesVchNo,
        customer: match.customer,
        itemDiffs
      });
    }
  }

  console.log(`Bills with Exact Item-Level Quantity Matching: ${matchingDetails.length - billsWithItemMismatches.length} / ${matchingDetails.length}`);
  console.log(`Bills with Item-Level Discrepancies: ${billsWithItemMismatches.length}`);

  if (billsWithItemMismatches.length > 0) {
    console.log('\n--- BILLS WITH ITEM-LEVEL MISMATCHES ---');
    console.log(JSON.stringify(billsWithItemMismatches, null, 2));
  }
}

runAudit().catch(console.error);
