const fs = require('fs');
const path = require('path');
const db = require('./database');

const asOf = new Date('2026-11-05T00:00:00Z');
const ledgersData = db.getLedgers({ limit: 500 }).items || [];
const allVouchers = db.getVouchers({ limit: 1000 }).items || [];

const debtors = ledgersData.filter(l => l.parent === 'Sundry Debtors');

function parseTallyDate(dStr) {
  if (!dStr || dStr.length !== 8) return null;
  const y = parseInt(dStr.slice(0, 4), 10);
  const m = parseInt(dStr.slice(4, 6), 10) - 1;
  const d = parseInt(dStr.slice(6, 8), 10);
  return new Date(Date.UTC(y, m, d));
}

function formatDateObj(d) {
  if (!d) return '—';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

debtors.forEach(p => {
  const pVchs = allVouchers.filter(v => 
    (v.partyName && v.partyName.toLowerCase() === p.name.toLowerCase()) ||
    v.ledgerEntries?.some(l => l.ledgerName.toLowerCase() === p.name.toLowerCase())
  ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const sales = pVchs.filter(v => v.voucherType === 'Sales');
  if (sales.length === 0) return;

  const credits = pVchs.filter(v => v.voucherType === 'Receipt' || v.voucherType === 'Credit Note');
  const refunds = pVchs.filter(v => v.voucherType === 'Payment');

  // Group into sessions
  const sessions = [];
  sales.forEach(s => {
    const sDate = parseTallyDate(s.date);
    const taxable = s.ledgerEntries?.find(l => l.ledgerName && l.ledgerName.includes('Sales'))?.amount || (s.amount / 1.05);
    const ctnM = (s.narration || '').match(/(\d+)\s*(?:CTN|BOX|CS|CARTON)/i);
    const ctns = ctnM ? parseInt(ctnM[1], 10) : (s.inventoryEntries?.length || 1);
    const daysElapsed = sDate ? Math.max(0, Math.floor((asOf - sDate) / 86400000)) : 0;

    const bObj = {
      voucherType: s.voucherType,
      voucherNumber: s.voucherNumber,
      date: s.date,
      formattedDate: formatDateObj(sDate),
      amount: s.amount,
      taxableAmount: Math.round(taxable * 100) / 100,
      cartons: ctns,
      daysElapsed,
      dateTime: sDate,
      settledAmount: 0,
      unpaidAmount: s.amount,
      status: 'OPEN'
    };

    let sess = sessions.find(sn => {
      const diffDays = Math.abs((sDate - sn.latestDate) / 86400000);
      return diffDays <= 4;
    });

    if (sess) {
      sess.bills.push(bObj);
      if (sDate > sess.latestDate) {
        sess.latestDate = sDate;
        sess.latestDateStr = s.date;
        sess.latestBillNo = s.voucherNumber;
      }
    } else {
      sessions.push({
        sessionNumber: sessions.length + 1,
        earliestDate: sDate,
        latestDate: sDate,
        latestDateStr: s.date,
        latestBillNo: s.voucherNumber,
        bills: [bObj],
        creditsApplied: 0,
        payments: [],
        creditNotes: []
      });
    }
  });

  // Calculate session properties
  sessions.forEach(sess => {
    sess.grossAmount = sess.bills.reduce((sum, b) => sum + b.amount, 0);
    sess.taxableAmount = Math.round(sess.bills.reduce((sum, b) => sum + b.taxableAmount, 0) * 100) / 100;
    sess.cdAmount = Math.round(sess.taxableAmount * 0.05 * 100) / 100;
    sess.cdDueDate = new Date(sess.latestDate.getTime() + 30 * 86400000);
    sess.cdDueDateFormatted = formatDateObj(sess.cdDueDate);
    sess.daysElapsed = Math.max(0, Math.floor((asOf - sess.latestDate) / 86400000));
    sess.daysToDueDate = Math.floor((sess.cdDueDate - asOf) / 86400000);
  });

  // Process credits & refunds
  // First, check narration matches
  const unhandledCredits = [];
  credits.forEach(cr => {
    let matched = false;
    const nar = cr.narration || '';
    sessions.forEach(sess => {
      const match = sess.bills.some(b => nar.includes(b.voucherNumber) || (b.voucherNumber.startsWith('SKIL-') && nar.includes(b.voucherNumber.replace('SKIL-', ''))));
      if (match) {
        sess.creditsApplied += cr.amount;
        if (cr.voucherType === 'Receipt') sess.payments.push({ no: cr.voucherNumber, date: cr.date, amount: cr.amount, nar });
        else sess.creditNotes.push({ no: cr.voucherNumber, date: cr.date, amount: cr.amount, nar });
        matched = true;
      }
    });
    if (!matched) unhandledCredits.push(cr);
  });

  // For unhandled credits, allocate chronologically to sessions that have pending amounts
  unhandledCredits.forEach(cr => {
    let crRemaining = cr.amount;
    for (const sess of sessions) {
      const sessPending = sess.grossAmount - sess.creditsApplied;
      if (sessPending > 0) {
        const alloc = Math.min(crRemaining, sessPending);
        sess.creditsApplied += alloc;
        crRemaining -= alloc;
        if (cr.voucherType === 'Receipt') sess.payments.push({ no: cr.voucherNumber, date: cr.date, amount: alloc, nar: cr.narration });
        else sess.creditNotes.push({ no: cr.voucherNumber, date: cr.date, amount: alloc, nar: cr.narration });
        if (crRemaining <= 0) break;
      }
    }
    // If credit exceeds all sessions, it's customer advance
    if (crRemaining > 0) {
      // Advance
    }
  });

  // If there are customer refunds (Payment vouchers)
  refunds.forEach(rf => {
    // Deduct from latest session or advance
    // In KGN's case, refund was matched against error receipt #5
  });

  // Distribute within sessions to individual bills and calculate aging buckets
  let under30 = 0, d31to45 = 0, d46to60 = 0, over60 = 0;
  sessions.forEach(sess => {
    sess.unpaidAmount = Math.max(0, sess.grossAmount - sess.creditsApplied);
    sess.status = sess.unpaidAmount === 0 ? 'PAID' : (sess.creditsApplied > 0 ? 'PARTIAL' : 'OPEN');

    let pool = sess.creditsApplied;
    sess.bills.forEach(b => {
      const settled = Math.min(b.amount, Math.max(0, pool));
      pool -= settled;
      b.settledAmount = settled;
      b.unpaidAmount = b.amount - settled;
      b.status = b.unpaidAmount === 0 ? 'PAID' : (b.settledAmount > 0 ? 'PARTIAL' : 'OPEN');

      if (b.unpaidAmount > 0) {
        if (b.daysElapsed <= 30) under30 += b.unpaidAmount;
        else if (b.daysElapsed <= 45) d31to45 += b.unpaidAmount;
        else if (b.daysElapsed <= 60) d46to60 += b.unpaidAmount;
        else over60 += b.unpaidAmount;
      }
    });
  });

  const totalOutstanding = under30 + d31to45 + d46to60 + over60;
  console.log(`Party: ${p.name.padEnd(30)} | NetDue: ₹${totalOutstanding.toString().padStart(8)} | <30: ₹${under30} | 31-45: ₹${d31to45} | 46-60: ₹${d46to60} | >60: ₹${over60}`);
});
