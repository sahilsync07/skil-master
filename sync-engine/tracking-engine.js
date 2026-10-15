const path = require('path');
const fs = require('fs');
const db = require('./database');

/**
 * SKIL Master Tracking Engine
 * Designed for Inventory-less / Zero-Inventory Drop-Shipping Business Model
 */

class TrackingEngine {
  constructor() {
    this.truthDataPath = path.resolve('c:/Projects/SKIL Master/misc/SKIL Purchase Supplier Invoices/Truth_Data_Sources/invoice.json');
  }

  // Helper: Format YYYYMMDD to DD-MM-YYYY
  formatDate(d) {
    if (!d) return '';
    const str = String(d).trim();
    if (str.length === 8 && /^\d{8}$/.test(str)) {
      return `${str.substring(6, 8)}-${str.substring(4, 6)}-${str.substring(0, 4)}`;
    }
    return str;
  }

  // Helper: Calculate days between two dates (YYYYMMDD or today)
  daysBetween(d1, d2) {
    if (!d1) return 0;
    const parse = (s) => {
      if (typeof s === 'string' && s.length === 8) {
        return new Date(parseInt(s.substring(0, 4)), parseInt(s.substring(4, 6)) - 1, parseInt(s.substring(6, 8)));
      }
      return new Date(s);
    };
    const date1 = parse(d1);
    const date2 = d2 ? parse(d2) : new Date();
    const diffTime = date2.getTime() - date1.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // 1. Get Drop-Ship 1:1 Matches
  getDropShipMatches(filterMonth = 'all', statusFilter = 'all') {
    const vouchers = Object.values(db.vouchers || {});
    const purchases = {};
    const sales = {};

    for (const v of vouchers) {
      const vt = v.voucherType;
      const vno = String(v.voucherNumber || '');
      if (vt === 'Purchase') {
        const num = parseInt(vno, 10);
        if (!isNaN(num)) purchases[num] = v;
      } else if (vt === 'Sales') {
        const num = parseInt(vno.replace('SKIL-', ''), 10);
        if (!isNaN(num)) sales[num] = v;
      }
    }

    const allIndices = Array.from(new Set([...Object.keys(purchases), ...Object.keys(sales)]))
      .map(Number)
      .sort((a, b) => a - b);

    const matches = [];

    for (const i of allIndices) {
      const p = purchases[i];
      const s = sales[i];

      const pDate = p ? p.date : '';
      const sDate = s ? s.date : '';
      const dateToUse = sDate || pDate || '';

      // Month filter: e.g. '2026-08', '2026-09'
      if (filterMonth && filterMonth !== 'all') {
        const prefix = filterMonth.replace('-', ''); // '202608'
        if (!dateToUse.startsWith(prefix)) {
          continue;
        }
      }

      const pAmt = p ? Math.abs(parseFloat(p.amount || 0)) : 0;
      const sAmt = s ? Math.abs(parseFloat(s.amount || 0)) : 0;

      // Extract cartons from narration
      const pNarr = p ? p.narration || '' : '';
      const sNarr = s ? s.narration || '' : '';
      const mPctn = pNarr.match(/(\d+)\s*CTN/i);
      const mSctn = sNarr.match(/(\d+)\s*CTN/i);
      const pCtn = mPctn ? parseInt(mPctn[1], 10) : 0;
      const sCtn = mSctn ? parseInt(mSctn[1], 10) : 0;

      // Extract pairs
      let pPairs = 0;
      if (p && p.inventoryEntries) {
        for (const it of p.inventoryEntries) {
          const m = String(it.billedQty || '').match(/(\d+)/);
          if (m) pPairs += parseInt(m[1], 10);
        }
      }

      let sPairs = 0;
      if (s && s.inventoryEntries) {
        for (const it of s.inventoryEntries) {
          const m = String(it.billedQty || '').match(/(\d+)/);
          if (m) sPairs += parseInt(m[1], 10);
        }
      }

      // Customer party name
      let customer = s ? s.partyLedgerName : '';
      if (!customer || customer === 'None') {
        if (s && s.ledgerEntries) {
          for (const le of s.ledgerEntries) {
            const ln = le.ledgerName || '';
            if (!ln.toUpperCase().includes('GST') &&
                !ln.toUpperCase().includes('SALES') &&
                !ln.toUpperCase().includes('DISCOUNT') &&
                !ln.toUpperCase().includes('ROUND')) {
              customer = ln;
              break;
            }
          }
        }
      }

      // Supplier
      const supplier = (p && p.reference && p.reference.includes('XPL')) 
        ? 'Xpania Footcare LLP' 
        : 'Ajanta Shoes India Pvt. Ltd.';

      const variance = Math.round((sAmt - pAmt) * 100) / 100;
      const marginPct = sAmt > 0 ? Math.round((variance / sAmt) * 10000) / 100 : 0;

      let status = 'MATCHED';
      let statusLabel = '100% Matched';
      let statusSeverity = 'success';

      if (!p) {
        status = 'UNMAPPED_SALE';
        statusLabel = 'Sale Missing Purchase';
        statusSeverity = 'danger';
      } else if (!s) {
        status = 'UNBILLED_PURCHASE';
        statusLabel = 'Purchase Unbilled (Orphan)';
        statusSeverity = 'danger';
      } else if (i === 16) {
        status = 'INTERCHANGED_REF';
        statusLabel = 'Sales Ref Typo (1900405157)';
        statusSeverity = 'warning';
      } else if (i === 19) {
        status = 'NARRATION_CTN_TYPO';
        statusLabel = 'Purchase Narration Typo (11 CTN)';
        statusSeverity = 'warning';
      } else if (Math.abs(variance) > 20) {
        status = 'MARGIN_VARIANCE';
        statusLabel = variance > 0 ? `Trade Profit (+₹${variance.toLocaleString('en-IN')})` : `Rate Shortfall (-₹${Math.abs(variance).toLocaleString('en-IN')})`;
        statusSeverity = variance > 0 ? 'info' : 'danger';
      }

      if (statusFilter && statusFilter !== 'all') {
        if (status !== statusFilter) continue;
      }

      matches.push({
        pairNo: i,
        purchaseVoucher: p ? p.voucherNumber : null,
        salesVoucher: s ? s.voucherNumber : null,
        purchaseRef: p ? p.reference : null,
        salesRef: s ? s.reference : null,
        purchaseDate: this.formatDate(pDate),
        salesDate: this.formatDate(sDate),
        rawDate: dateToUse,
        supplier,
        customer,
        cartons: sCtn || pCtn,
        purchaseCartons: pCtn,
        salesCartons: sCtn,
        pairs: sPairs || pPairs,
        purchaseAmount: pAmt,
        salesAmount: sAmt,
        variance,
        marginPct,
        status,
        statusLabel,
        statusSeverity
      });
    }

    return {
      totalPairsMatched: matches.length,
      matchedCount: matches.filter(m => m.status === 'MATCHED').length,
      varianceCount: matches.filter(m => m.status === 'MARGIN_VARIANCE').length,
      discrepancyCount: matches.filter(m => m.statusSeverity === 'danger' || m.statusSeverity === 'warning').length,
      matches
    };
  }

  // 1B. Comprehensive Master Drop-Ship Grid (Single-Row Full Lifecycle View)
  getMasterGrid(filterMonth = 'all') {
    const vouchers = Object.values(db.vouchers || {});
    const purchases = {};
    const sales = {};

    for (const v of vouchers) {
      const vt = v.voucherType;
      const vno = String(v.voucherNumber || '');
      if (vt === 'Purchase') {
        const num = parseInt(vno, 10);
        if (!isNaN(num)) purchases[num] = v;
      } else if (vt === 'Sales') {
        const num = parseInt(vno.replace('SKIL-', ''), 10);
        if (!isNaN(num)) sales[num] = v;
      }
    }

    const allIndices = Array.from(new Set([...Object.keys(purchases), ...Object.keys(sales)]))
      .map(Number)
      .sort((a, b) => a - b);

    const rows = [];

    for (const i of allIndices) {
      const p = purchases[i];
      const s = sales[i];

      const pDate = p ? p.date : '';
      const sDate = s ? s.date : '';
      const dateToUse = sDate || pDate || '';

      if (filterMonth && filterMonth !== 'all') {
        const prefix = filterMonth.replace('-', '');
        if (!dateToUse.startsWith(prefix)) continue;
      }

      const pAmt = p ? Math.abs(parseFloat(p.amount || 0)) : 0;
      const sAmt = s ? Math.abs(parseFloat(s.amount || 0)) : 0;

      // Cartons
      const pNarr = p ? p.narration || '' : '';
      const sNarr = s ? s.narration || '' : '';
      const mPctn = pNarr.match(/(\d+)\s*CTN/i);
      const mSctn = sNarr.match(/(\d+)\s*CTN/i);
      const pCtn = mPctn ? parseInt(mPctn[1], 10) : 0;
      const sCtn = mSctn ? parseInt(mSctn[1], 10) : 0;

      // Pairs
      let pPairs = 0;
      if (p && p.inventoryEntries) {
        for (const it of p.inventoryEntries) {
          const m = String(it.billedQty || '').match(/(\d+)/);
          if (m) pPairs += parseInt(m[1], 10);
        }
      }
      let sPairs = 0;
      if (s && s.inventoryEntries) {
        for (const it of s.inventoryEntries) {
          const m = String(it.billedQty || '').match(/(\d+)/);
          if (m) sPairs += parseInt(m[1], 10);
        }
      }

      // Customer
      let customer = s ? s.partyLedgerName : '';
      if (!customer || customer === 'None') {
        if (s && s.ledgerEntries) {
          for (const le of s.ledgerEntries) {
            const ln = le.ledgerName || '';
            if (!ln.toUpperCase().includes('GST') && !ln.toUpperCase().includes('SALES') && !ln.toUpperCase().includes('DISCOUNT') && !ln.toUpperCase().includes('ROUND')) {
              customer = ln; break;
            }
          }
        }
      }

      // Supplier
      const supplier = (p && p.reference && p.reference.includes('XPL')) ? 'Xpania Footcare LLP' : 'Ajanta Shoes India Pvt. Ltd.';
      const isAjanta = !supplier.includes('Xpania');

      // Wholesale Trade Margin
      const tradeMargin = Math.round((sAmt - pAmt) * 100) / 100;
      const tradeMarginPct = sAmt > 0 ? Math.round((tradeMargin / sAmt) * 10000) / 100 : 0;

      // Supplier Rebates (Ajanta)
      const isAugust = dateToUse.startsWith('202608');
      const suppCd3 = isAjanta ? Math.round(pAmt * (0.03 / 1.05) * 100) / 100 : 0;
      const suppScheme378 = isAjanta ? Math.round(pAmt * 0.0378 * 100) / 100 : 0;
      const suppTotalClaim = Math.round((suppCd3 + suppScheme378) * 100) / 100;
      const suppClaimStatus = isAugust ? 'SETTLED' : 'PENDING_DEBIT_NOTE';
      const suppDocLabel = isAugust ? 'Settled (DN#1 to #4)' : 'Statement 93081.pdf (3 CNs Pending)';

      // Customer 5% Cash Discount
      let taxableSales = 0;
      if (s && s.ledgerEntries) {
        for (const le of s.ledgerEntries) {
          if ((le.ledgerName || '').includes('Sales')) {
            taxableSales += Math.abs(parseFloat(le.amount || 0));
          }
        }
      }
      taxableSales = Math.round(taxableSales * 100) / 100;
      const custCd5 = Math.round(taxableSales * 0.05 * 100) / 100;
      const custNetPayable = Math.round((sAmt - custCd5) * 100) / 100;
      const custCnStatus = isAugust ? 'ISSUED' : 'PENDING_IN_TALLY';

      // 30-Day Due Date & Aging
      const daysElapsed = this.daysBetween(dateToUse);
      let dueDate = '';
      if (dateToUse && dateToUse.length === 8) {
        const y = parseInt(dateToUse.substring(0, 4));
        const m = parseInt(dateToUse.substring(4, 6)) - 1;
        const d = parseInt(dateToUse.substring(6, 8));
        const dt = new Date(y, m, d + 30);
        dueDate = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
      }

      let paymentStatus = 'PENDING';
      let paymentLabel = 'Payment Pending';
      if (s && s.voucherNumber === 'SKIL-002') {
        paymentStatus = 'CLEARED';
        paymentLabel = 'Cleared (NEFT 30-Sep)';
      } else if (['SKIL-004', 'SKIL-005', 'SKIL-006'].includes(s?.voucherNumber)) {
        paymentStatus = 'SHORTFALL';
        paymentLabel = 'Partially Paid (Shortfall ₹6,113)';
      } else if (isAugust) {
        paymentStatus = 'CLEARED';
        paymentLabel = 'Cleared / Adjusted';
      } else {
        if (daysElapsed > 30) {
          paymentStatus = 'OVERDUE';
          paymentLabel = `${daysElapsed}d Overdue`;
        } else {
          paymentStatus = 'ELIGIBLE';
          paymentLabel = `${30 - daysElapsed}d Left for CD`;
        }
      }

      // Net Realized LLP Profit on this Single Transaction
      const netRealizedProfit = Math.round((tradeMargin + suppTotalClaim - custCd5) * 100) / 100;
      const netProfitMarginPct = sAmt > 0 ? Math.round((netRealizedProfit / sAmt) * 10000) / 100 : 0;

      rows.push({
        pairNo: i,
        date: this.formatDate(dateToUse),
        rawDate: dateToUse,
        month: isAugust ? 'August 2026' : 'September 2026',
        
        // Purchase (Supplier)
        supplier,
        purchaseRef: p ? p.reference : '—',
        purchaseVoucher: p ? p.voucherNumber : '—',
        purchaseAmount: pAmt,
        cartons: sCtn || pCtn,
        pairs: sPairs || pPairs,

        // Sales (Customer)
        salesVoucher: s ? s.voucherNumber : '—',
        customer: customer || 'Unknown',
        salesAmount: sAmt,

        // Wholesale Trade Margin
        tradeMargin,
        tradeMarginPct,

        // Inbound Supplier Schemes
        suppCd3,
        suppScheme378,
        suppTotalClaim,
        suppClaimStatus,
        suppDocLabel,

        // Outbound Customer 5% CD
        taxableSales,
        custCd5,
        custNetPayable,
        custCnStatus,

        // Payment & Aging
        dueDate,
        daysElapsed,
        paymentStatus,
        paymentLabel,

        // Net Realized Profit
        netRealizedProfit,
        netProfitMarginPct
      });
    }

    // Group into Dispatch Stints (Same Customer + Same Dispatch Date)
    const stintsMap = new Map();

    for (const r of rows) {
      const key = `${r.rawDate}__${r.customer}`;
      if (!stintsMap.has(key)) {
        stintsMap.set(key, {
          stintId: `stint_${r.rawDate}_${stintsMap.size + 1}`,
          stintNo: stintsMap.size + 1,
          date: r.date,
          rawDate: r.rawDate,
          month: r.month,
          customer: r.customer,
          billsCount: 0,
          purchaseRefs: [],
          salesVouchers: [],
          suppliers: new Set(),
          cartons: 0,
          pairs: 0,
          purchaseAmount: 0,
          salesAmount: 0,
          tradeMargin: 0,
          suppCd3: 0,
          suppScheme378: 0,
          suppTotalClaim: 0,
          suppClaimStatus: 'SETTLED',
          taxableSales: 0,
          custCd5: 0,
          custNetPayable: 0,
          custCnStatus: 'ISSUED',
          dueDate: r.dueDate,
          daysElapsed: r.daysElapsed,
          paymentStatus: r.paymentStatus,
          paymentLabel: r.paymentLabel,
          netRealizedProfit: 0,
          bills: []
        });
      }

      const st = stintsMap.get(key);
      st.billsCount++;
      if (r.purchaseRef && r.purchaseRef !== '—') st.purchaseRefs.push(r.purchaseRef);
      if (r.salesVoucher && r.salesVoucher !== '—') st.salesVouchers.push(r.salesVoucher);
      st.suppliers.add(r.supplier.includes('Xpania') ? 'Xpania' : 'Ajanta');
      st.cartons += r.cartons;
      st.pairs += r.pairs;
      st.purchaseAmount += r.purchaseAmount;
      st.salesAmount += r.salesAmount;
      st.tradeMargin += r.tradeMargin;
      st.suppCd3 += r.suppCd3;
      st.suppScheme378 += r.suppScheme378;
      st.suppTotalClaim += r.suppTotalClaim;
      st.taxableSales += r.taxableSales;
      st.custCd5 += r.custCd5;
      st.custNetPayable += r.custNetPayable;
      st.netRealizedProfit += r.netRealizedProfit;

      // Aggregate status flags
      if (r.suppClaimStatus !== 'SETTLED') st.suppClaimStatus = 'PENDING_DEBIT_NOTE';
      if (r.custCnStatus !== 'ISSUED') st.custCnStatus = 'PENDING_IN_TALLY';
      if (r.paymentStatus === 'SHORTFALL') {
        st.paymentStatus = 'SHORTFALL';
        st.paymentLabel = 'Partially Paid (Shortfall ₹6,113)';
      } else if (r.paymentStatus === 'OVERDUE' && st.paymentStatus !== 'SHORTFALL') {
        st.paymentStatus = 'OVERDUE';
        st.paymentLabel = `${r.daysElapsed}d Overdue`;
      } else if (r.paymentStatus === 'ELIGIBLE' && st.paymentStatus !== 'SHORTFALL' && st.paymentStatus !== 'OVERDUE') {
        st.paymentStatus = 'ELIGIBLE';
        st.paymentLabel = `${30 - r.daysElapsed}d Left for CD`;
      }

      st.bills.push(r);
    }

    const stints = Array.from(stintsMap.values()).map((st, idx) => {
      st.stintNo = idx + 1;
      st.suppliersList = Array.from(st.suppliers).join(', ');
      st.purchaseAmount = Math.round(st.purchaseAmount * 100) / 100;
      st.salesAmount = Math.round(st.salesAmount * 100) / 100;
      st.tradeMargin = Math.round(st.tradeMargin * 100) / 100;
      st.tradeMarginPct = st.salesAmount > 0 ? Math.round((st.tradeMargin / st.salesAmount) * 10000) / 100 : 0;
      st.suppCd3 = Math.round(st.suppCd3 * 100) / 100;
      st.suppScheme378 = Math.round(st.suppScheme378 * 100) / 100;
      st.suppTotalClaim = Math.round(st.suppTotalClaim * 100) / 100;
      st.taxableSales = Math.round(st.taxableSales * 100) / 100;
      st.custCd5 = Math.round(st.custCd5 * 100) / 100;
      st.custNetPayable = Math.round(st.custNetPayable * 100) / 100;
      st.netRealizedProfit = Math.round(st.netRealizedProfit * 100) / 100;
      st.netProfitMarginPct = st.salesAmount > 0 ? Math.round((st.netRealizedProfit / st.salesAmount) * 10000) / 100 : 0;

      // Readable invoice range summaries
      if (st.salesVouchers.length > 2) {
        st.salesVoucherSummary = `${st.salesVouchers[0]} .. ${st.salesVouchers[st.salesVouchers.length - 1]}`;
      } else {
        st.salesVoucherSummary = st.salesVouchers.join(', ');
      }

      if (st.purchaseRefs.length > 2) {
        st.purchaseRefSummary = `${st.purchaseRefs[0]} .. ${st.purchaseRefs[st.purchaseRefs.length - 1]}`;
      } else {
        st.purchaseRefSummary = st.purchaseRefs.join(', ');
      }

      return st;
    });

    return {
      totalRows: rows.length,
      totalStints: stints.length,
      totals: {
        totalPurchases: Math.round(rows.reduce((s, r) => s + r.purchaseAmount, 0) * 100) / 100,
        totalSales: Math.round(rows.reduce((s, r) => s + r.salesAmount, 0) * 100) / 100,
        totalTradeMargin: Math.round(rows.reduce((s, r) => s + r.tradeMargin, 0) * 100) / 100,
        totalSuppRebates: Math.round(rows.reduce((s, r) => s + r.suppTotalClaim, 0) * 100) / 100,
        totalCustDiscounts: Math.round(rows.reduce((s, r) => s + r.custCd5, 0) * 100) / 100,
        totalNetProfit: Math.round(rows.reduce((s, r) => s + r.netRealizedProfit, 0) * 100) / 100,
        totalCartons: rows.reduce((s, r) => s + r.cartons, 0),
        totalPairs: rows.reduce((s, r) => s + r.pairs, 0)
      },
      stints,
      rows
    };
  }

  // 2. Get Credit Notes & Schemes Tracker
  getCreditNotesTracker() {
    const vouchers = Object.values(db.vouchers || {});
    
    // Inbound Supplier Claims (Ajanta)
    const supplierClaims = [
      // August 2026
      {
        month: 'August 2026',
        category: 'Cash Discount (3%)',
        description: '3% CD on August Ajanta Purchases as per agreement',
        expectedAmount: 37552.12,
        settledAmount: 37552.12,
        status: 'SETTLED',
        tallyVoucher: 'Debit Note #2',
        supplierDocNo: '160005126',
        settledDate: '16-09-2026'
      },
      {
        month: 'August 2026',
        category: 'Retail Scheme (3.78%)',
        description: 'HW+FTW Retail Scheme @ 3.78% on August Purchases',
        expectedAmount: 45896.00,
        settledAmount: 45896.00,
        status: 'SETTLED',
        tallyVoucher: 'Debit Note #3',
        supplierDocNo: '160005123',
        settledDate: '16-09-2026'
      },
      {
        month: 'August 2026',
        category: 'Scratch Coupon Scheme',
        description: 'Non-Bengal Scratch Coupon Scheme for August 2026',
        expectedAmount: 25727.00,
        settledAmount: 25727.00,
        status: 'SETTLED',
        tallyVoucher: 'Debit Note #1',
        supplierDocNo: '160005179',
        settledDate: '16-09-2026'
      },
      {
        month: 'August 2026',
        category: 'Rate Difference Claim',
        description: 'Rebate on article UL 979E/CH+M (Invoices 1900405893 & 1900402693)',
        expectedAmount: 2773.95,
        settledAmount: 2773.95,
        status: 'SETTLED',
        tallyVoucher: 'Debit Note #4',
        supplierDocNo: '160005127',
        settledDate: '16-09-2026'
      },
      // September 2026
      {
        month: 'September 2026',
        category: 'Retail Scheme (3.78%)',
        description: 'HW+FTW Retail Scheme @ 3.78% on September Purchases',
        expectedAmount: 39584.00,
        settledAmount: 0.0,
        status: 'PENDING_ENTRY_IN_TALLY',
        tallyVoucher: 'Pending Debit Note',
        supplierDocNo: '160005610',
        settledDate: '30-09-2026 (In Statement)'
      },
      {
        month: 'September 2026',
        category: 'Scratch Coupon / Volume Scheme',
        description: 'Volume / Scratch Scheme discount for September 2026',
        expectedAmount: 26180.00,
        settledAmount: 0.0,
        status: 'PENDING_ENTRY_IN_TALLY',
        tallyVoucher: 'Pending Debit Note',
        supplierDocNo: '160005580',
        settledDate: '30-09-2026 (In Statement)'
      },
      {
        month: 'September 2026',
        category: 'Cash Discount',
        description: 'Cash Discount on September Ajanta Purchases',
        expectedAmount: 20943.00,
        settledAmount: 0.0,
        status: 'PENDING_ENTRY_IN_TALLY',
        tallyVoucher: 'Pending Debit Note',
        supplierDocNo: '160005562',
        settledDate: '30-09-2026 (In Statement)'
      },
      {
        month: 'September 2026',
        category: 'Rate Difference Claim',
        description: 'Under-margin billing claim on LMB 07, L-ORTHO SOFT, CEL 1023 (300 pairs)',
        expectedAmount: 235.20,
        settledAmount: 0.0,
        status: 'PENDING_CLAIM_WITH_SUPPLIER',
        tallyVoucher: 'Pending Claim',
        supplierDocNo: 'Pending Ajanta CN',
        settledDate: 'Pending Claim'
      }
    ];

    // Outbound Customer Discounts (5% on Taxable Value)
    const customerDiscounts = [
      // August 2026
      {
        month: 'August 2026',
        party: 'K G N FOOTWARE',
        invoices: 'SKIL-004 to SKIL-006',
        taxableValue: 108413.25,
        discountPct: 5.0,
        discountAmount: 5421.00,
        status: 'ISSUED',
        tallyVoucher: 'Credit Note #1',
        issueDate: '19-09-2026'
      },
      {
        month: 'August 2026',
        party: 'M/S.SHREE FOOTWEAR',
        invoices: 'SKIL-011 to SKIL-020',
        taxableValue: 530779.33,
        discountPct: 5.0,
        discountAmount: 26539.00,
        status: 'ISSUED',
        tallyVoucher: 'Credit Note #2',
        issueDate: '22-09-2026'
      },
      {
        month: 'August 2026',
        party: 'DELIGHT FOOT WEAR',
        invoices: 'SKIL-002',
        taxableValue: 148727.81,
        discountPct: 5.0,
        discountAmount: 7436.00,
        status: 'ISSUED',
        tallyVoucher: 'Credit Note #3',
        issueDate: '30-09-2026'
      },
      {
        month: 'August 2026',
        party: 'M/s Sri Brundabana Enterprises, Rayagada',
        invoices: 'SKIL-001, 003, 007-010, 021, 022',
        taxableValue: 409608.89,
        discountPct: 5.0,
        discountAmount: 20480.00,
        status: 'ISSUED',
        tallyVoucher: 'Credit Note #4',
        issueDate: '30-09-2026'
      },
      // September 2026
      {
        month: 'September 2026',
        party: 'SRI SHARVANI TRADERS',
        invoices: 'SKIL-040, SKIL-042, SKIL-043, SKIL-047',
        taxableValue: 415349.01,
        discountPct: 5.0,
        discountAmount: 20767.00,
        status: 'PENDING_IN_TALLY',
        tallyVoucher: 'Pending Credit Note',
        issueDate: 'Due Now'
      },
      {
        month: 'September 2026',
        party: 'K G N FOOTWARE',
        invoices: 'SKIL-027 to SKIL-029',
        taxableValue: 137743.28,
        discountPct: 5.0,
        discountAmount: 6887.00,
        status: 'PENDING_IN_TALLY',
        tallyVoucher: 'Pending Credit Note',
        issueDate: 'Due Now'
      },
      {
        month: 'September 2026',
        party: 'M/S.SHREE FOOTWEAR',
        invoices: 'SKIL-031 to 034, 036, 037, 049, 051, 053',
        taxableValue: 129961.23,
        discountPct: 5.0,
        discountAmount: 6498.00,
        status: 'PENDING_IN_TALLY',
        tallyVoucher: 'Pending Credit Note',
        issueDate: 'Due Now'
      },
      {
        month: 'September 2026',
        party: 'JYOTHI FOOT WEAR',
        invoices: 'SKIL-024 to 026, 030, 041',
        taxableValue: 122708.85,
        discountPct: 5.0,
        discountAmount: 6135.00,
        status: 'PENDING_IN_TALLY',
        tallyVoucher: 'Pending Credit Note',
        issueDate: 'Due Now'
      },
      {
        month: 'September 2026',
        party: 'M/s Sri Brundabana Enterprises, Rayagada',
        invoices: 'SKIL-038, 039, 044 to 046',
        taxableValue: 99682.08,
        discountPct: 5.0,
        discountAmount: 4984.00,
        status: 'PENDING_IN_TALLY',
        tallyVoucher: 'Pending Credit Note',
        issueDate: 'Due Now'
      },
      {
        month: 'September 2026',
        party: 'M/S SRI BRUNDABAN ENTERPRISES, MALKANGIRI',
        invoices: 'SKIL-048, 050, 052',
        taxableValue: 95621.23,
        discountPct: 5.0,
        discountAmount: 4781.00,
        status: 'PENDING_IN_TALLY',
        tallyVoucher: 'Pending Credit Note',
        issueDate: 'Due Now'
      },
      {
        month: 'September 2026',
        party: 'MAHAVIR SHOE HOUSE (XPL)',
        invoices: 'SKIL-035',
        taxableValue: 254563.80,
        discountPct: 5.0,
        discountAmount: 12728.00,
        status: 'PENDING_IN_TALLY',
        tallyVoucher: 'Pending Credit Note',
        issueDate: 'Due Now'
      },
      {
        month: 'September 2026',
        party: 'M/S SUSHILA BOOT HOUSE (XPL)',
        invoices: 'SKIL-023',
        taxableValue: 162196.34,
        discountPct: 5.0,
        discountAmount: 8110.00,
        status: 'PENDING_IN_TALLY',
        tallyVoucher: 'Pending Credit Note',
        issueDate: 'Due Now'
      }
    ];

    const totalSupplierClaimsExpected = supplierClaims.reduce((s, c) => s + c.expectedAmount, 0);
    const totalSupplierClaimsSettled = supplierClaims.reduce((s, c) => s + c.settledAmount, 0);
    const totalSupplierClaimsPending = totalSupplierClaimsExpected - totalSupplierClaimsSettled;

    const totalCustomerDiscounts = customerDiscounts.reduce((s, c) => s + c.discountAmount, 0);
    const totalCustomerDiscountsIssued = customerDiscounts.filter(c => c.status === 'ISSUED').reduce((s, c) => s + c.discountAmount, 0);
    const totalCustomerDiscountsPending = customerDiscounts.filter(c => c.status === 'PENDING_IN_TALLY').reduce((s, c) => s + c.discountAmount, 0);

    const netSchemeMarginSpread = totalSupplierClaimsExpected - totalCustomerDiscounts;

    return {
      summary: {
        totalSupplierClaimsExpected,
        totalSupplierClaimsSettled,
        totalSupplierClaimsPending,
        totalCustomerDiscounts,
        totalCustomerDiscountsIssued,
        totalCustomerDiscountsPending,
        netSchemeMarginSpread
      },
      supplierClaims,
      customerDiscounts
    };
  }

  // 3. Get Payment Aging & 30-Day CD Tracker
  getPaymentAgingTracker() {
    const vouchers = Object.values(db.vouchers || {});
    const salesVouchers = vouchers
      .filter(v => v.voucherType === 'Sales')
      .sort((a, b) => parseInt(String(a.voucherNumber).replace('SKIL-', ''), 10) - parseInt(String(b.voucherNumber).replace('SKIL-', ''), 10));

    // Ledger balances as of now
    const ledgerBalances = {};
    for (const v of vouchers) {
      for (const le of (v.ledgerEntries || [])) {
        const ln = le.ledgerName;
        const amt = parseFloat(le.amount || 0);
        ledgerBalances[ln] = (ledgerBalances[ln] || 0) + amt;
      }
    }

    const bills = [];

    for (const s of salesVouchers) {
      const vno = s.voucherNumber;
      const dateStr = s.date;
      const formattedDate = this.formatDate(dateStr);
      const amount = Math.abs(parseFloat(s.amount || 0));

      let taxable = 0;
      for (const le of (s.ledgerEntries || [])) {
        if ((le.ledgerName || '').includes('Sales')) {
          taxable += Math.abs(parseFloat(le.amount || 0));
        }
      }

      let party = s.partyLedgerName;
      if (!party || party === 'None') {
        for (const le of (s.ledgerEntries || [])) {
          const ln = le.ledgerName || '';
          if (!ln.toUpperCase().includes('GST') && !ln.toUpperCase().includes('SALES') && !ln.toUpperCase().includes('DISCOUNT') && !ln.toUpperCase().includes('ROUND')) {
            party = ln; break;
          }
        }
      }

      // Calculate days elapsed from bill date
      const daysElapsed = this.daysBetween(dateStr);
      const cd5 = Math.round(taxable * 0.05 * 100) / 100;
      const netPayableWithCd = Math.round(amount - cd5);

      // Determine 30-Day Due Date
      let dueDate = '';
      if (dateStr && dateStr.length === 8) {
        const y = parseInt(dateStr.substring(0, 4));
        const m = parseInt(dateStr.substring(4, 6)) - 1;
        const d = parseInt(dateStr.substring(6, 8));
        const dt = new Date(y, m, d + 30);
        dueDate = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
      }

      let paymentStatus = 'PENDING';
      let statusLabel = 'Payment Pending';
      let statusBadge = 'warning';

      // Check known settlement for August
      if (vno === 'SKIL-002') {
        paymentStatus = 'SETTLED';
        statusLabel = 'Settled via NEFT (30-Sep)';
        statusBadge = 'success';
      } else if (['SKIL-004', 'SKIL-005', 'SKIL-006'].includes(vno)) {
        paymentStatus = 'PARTIALLY_SETTLED';
        statusLabel = 'Partially Paid (Shortfall ₹6,113)';
        statusBadge = 'info';
      } else if (parseInt(vno.replace('SKIL-', ''), 10) <= 22) {
        // August bills
        paymentStatus = 'SETTLED';
        statusLabel = 'Settled / Adjusted';
        statusBadge = 'success';
      } else {
        // September bills
        if (daysElapsed > 30) {
          paymentStatus = 'OVERDUE';
          statusLabel = `${daysElapsed} Days (Overdue — CD Expiring)`;
          statusBadge = 'danger';
        } else {
          paymentStatus = 'CURRENT';
          statusLabel = `${daysElapsed} Days (${30 - daysElapsed} days left for CD)`;
          statusBadge = 'primary';
        }
      }

      bills.push({
        salesVoucher: vno,
        date: formattedDate,
        rawDate: dateStr,
        dueDate,
        customer: party,
        amount,
        taxable,
        cd5,
        netPayableWithCd,
        daysElapsed,
        paymentStatus,
        statusLabel,
        statusBadge
      });
    }

    return {
      totalBills: bills.length,
      currentOutstandingDebtors: Object.entries(ledgerBalances)
        .filter(([ln, bal]) => bal < -1 && !ln.toUpperCase().includes('AJANTA') && !ln.toUpperCase().includes('XPANIA') && !ln.toUpperCase().includes('BANK') && !ln.toUpperCase().includes('CAPITAL'))
        .map(([ln, bal]) => ({ party: ln, balance: Math.abs(bal) })),
      bills
    };
  }

  // 4. Monthly Executive Profit Analyzer
  getMonthlyProfitAnalyzer() {
    const dropShipData = this.getDropShipMatches('all', 'all').matches;
    const creditNotesData = this.getCreditNotesTracker();

    const monthlySummary = {};

    for (const match of dropShipData) {
      const monthKey = (match.rawDate || '').substring(0, 6); // '202608' or '202609'
      const monthName = monthKey === '202608' ? 'August 2026' : (monthKey === '202609' ? 'September 2026' : 'October 2026');

      if (!monthlySummary[monthName]) {
        monthlySummary[monthName] = {
          month: monthName,
          billsCount: 0,
          cartons: 0,
          pairs: 0,
          purchaseCogs: 0,
          salesRevenue: 0,
          tradingMargin: 0,
          supplierSchemes: 0,
          customerDiscounts: 0,
          netOperatingProfit: 0
        };
      }

      monthlySummary[monthName].billsCount++;
      monthlySummary[monthName].cartons += match.cartons;
      monthlySummary[monthName].pairs += match.pairs;
      monthlySummary[monthName].purchaseCogs += match.purchaseAmount;
      monthlySummary[monthName].salesRevenue += match.salesAmount;
      monthlySummary[monthName].tradingMargin += match.variance;
    }

    // Allocate schemes & discounts by month
    for (const sc of creditNotesData.supplierClaims) {
      if (monthlySummary[sc.month]) {
        monthlySummary[sc.month].supplierSchemes += (sc.settledAmount || sc.expectedAmount);
      }
    }

    for (const cd of creditNotesData.customerDiscounts) {
      if (monthlySummary[cd.month]) {
        monthlySummary[cd.month].customerDiscounts += cd.discountAmount;
      }
    }

    // Calculate Net Profit
    for (const m of Object.values(monthlySummary)) {
      m.netOperatingProfit = Math.round((m.tradingMargin + m.supplierSchemes - m.customerDiscounts) * 100) / 100;
      m.netProfitMarginPct = m.salesRevenue > 0 ? Math.round((m.netOperatingProfit / m.salesRevenue) * 10000) / 100 : 0;
      m.tradingMarginPct = m.salesRevenue > 0 ? Math.round((m.tradingMargin / m.salesRevenue) * 10000) / 100 : 0;
    }

    return {
      months: Object.values(monthlySummary).sort((a, b) => a.month.localeCompare(b.month))
    };
  }

  // 5. Consolidated Overview Dashboard Data
  getOverview() {
    const dropShip = this.getDropShipMatches('all', 'all');
    const creditNotes = this.getCreditNotesTracker();
    const paymentAging = this.getPaymentAgingTracker();
    const monthly = this.getMonthlyProfitAnalyzer();

    const totalPurchases = dropShip.matches.reduce((s, m) => s + m.purchaseAmount, 0);
    const totalSales = dropShip.matches.reduce((s, m) => s + m.salesAmount, 0);
    const totalTradeMargin = Math.round((totalSales - totalPurchases) * 100) / 100;

    return {
      kpi: {
        totalPurchases,
        totalSales,
        totalTradeMargin,
        totalTradeMarginPct: totalSales > 0 ? Math.round((totalTradeMargin / totalSales) * 10000) / 100 : 0,
        totalPairs: dropShip.matches.reduce((s, m) => s + m.pairs, 0),
        totalCartons: dropShip.matches.reduce((s, m) => s + m.cartons, 0),
        pendingSupplierClaims: creditNotes.summary.totalSupplierClaimsPending,
        pendingCustomerDiscounts: creditNotes.summary.totalCustomerDiscountsPending,
        netSchemeRecovery: creditNotes.summary.netSchemeMarginSpread
      },
      dropShipSummary: {
        totalPairsMatched: dropShip.totalPairsMatched,
        matchedCount: dropShip.matchedCount,
        varianceCount: dropShip.varianceCount,
        discrepancyCount: dropShip.discrepancyCount
      },
      monthlySummary: monthly.months
    };
  }
}

module.exports = new TrackingEngine();
