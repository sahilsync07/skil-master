const fs = require('fs');
const vchs = Object.values(JSON.parse(fs.readFileSync('sync-engine/data/vouchers.json')));
const db = require('./database');

const ledgers = db.getLedgers({ limit: 500 }).items || [];
const debtors = ledgers.filter(l => l.parent === 'Sundry Debtors');

function parseDate(dStr) {
  if (!dStr || dStr.length !== 8) return null;
  const y = parseInt(dStr.substring(0, 4));
  const m = parseInt(dStr.substring(4, 6)) - 1;
  const d = parseInt(dStr.substring(6, 8));
  return new Date(y, m, d);
}

function formatDate(dStr) {
  if (!dStr || dStr.length !== 8) return dStr;
  return `${dStr.substring(6, 8)}-${dStr.substring(4, 6)}-${dStr.substring(0, 4)}`;
}

function addDays(d, days) {
  return new Date(d.getTime() + days * 86400000);
}

const asOf = new Date('2026-11-05T00:00:00Z');

debtors.forEach(p => {
  const pVchs = vchs.filter(v => 
    (v.partyName && v.partyName.toLowerCase() === p.name.toLowerCase()) ||
    v.ledgerEntries?.some(l => l.ledgerName.toLowerCase() === p.name.toLowerCase())
  ).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  const sales = pVchs.filter(v => v.voucherType === 'Sales');
  if (sales.length === 0) return;

  // 1. Group into Sessions (invoices within 4 days of each other)
  const sessions = [];
  sales.forEach(s => {
    const sDate = parseDate(s.date);
    const taxable = s.ledgerEntries?.find(l => l.ledgerName && l.ledgerName.includes('Sales'))?.amount || (s.amount / 1.05);
    const ctnM = (s.narration || '').match(/(\d+)\s*(?:CTN|BOX|CS|CARTON)/i);
    const ctns = ctnM ? parseInt(ctnM[1], 10) : (s.inventoryEntries?.length || 1);

    const billObj = {
      voucherNumber: s.voucherNumber,
      date: s.date,
      formattedDate: formatDate(s.date),
      dateTime: sDate,
      amount: s.amount,
      taxableAmount: Math.round(taxable * 100) / 100,
      cartons: ctns,
      settledAmount: 0,
      unpaidAmount: s.amount,
      status: 'OPEN'
    };

    let sess = sessions.find(sn => {
      const diffDays = Math.abs((sDate - sn.latestDate) / 86400000);
      return diffDays <= 4;
    });

    if (sess) {
      sess.bills.push(billObj);
      if (sDate > sess.latestDate) {
        sess.latestDate = sDate;
        sess.latestDateStr = s.date;
      }
    } else {
      sessions.push({
        sessionNumber: sessions.length + 1,
        earliestDate: sDate,
        latestDate: sDate,
        latestDateStr: s.date,
        bills: [billObj],
        creditsApplied: 0,
        payments: [],
        creditNotes: []
      });
    }
  });

  // Calculate session totals and 5% CD due dates (30 days from latest bill)
  sessions.forEach(sess => {
    sess.grossAmount = sess.bills.reduce((sum, b) => sum + b.amount, 0);
    sess.taxableAmount = Math.round(sess.bills.reduce((sum, b) => sum + b.taxableAmount, 0) * 100) / 100;
    sess.cdAmount = Math.round(sess.taxableAmount * 0.05 * 100) / 100;
    sess.cdDueDate = addDays(sess.latestDate, 30);
    sess.cdDueDateStr = formatDate(sess.cdDueDate.toISOString().slice(0, 10).replace(/-/g, ''));
    sess.daysElapsed = Math.floor((asOf - sess.latestDate) / 86400000);
  });

  // 2. Allocate Receipts and Credit Notes
  const receipts = pVchs.filter(v => v.voucherType === 'Receipt');
  const creditNotes = pVchs.filter(v => v.voucherType === 'Credit Note');
  const allCredits = [...receipts, ...creditNotes].sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  allCredits.forEach(cr => {
    let handled = false;
    // Check if narration specifies bills
    const nar = cr.narration || '';
    sessions.forEach(sess => {
      const matchBill = sess.bills.some(b => nar.includes(b.voucherNumber) || (nar.includes('SKIL-') && nar.includes(b.voucherNumber.replace('SKIL-', ''))));
      if (matchBill) {
        sess.creditsApplied += cr.amount;
        if (cr.voucherType === 'Receipt') sess.payments.push({ no: cr.voucherNumber, date: cr.date, amount: cr.amount });
        else sess.creditNotes.push({ no: cr.voucherNumber, date: cr.date, amount: cr.amount });
        handled = true;
      }
    });

    if (!handled) {
      // Apply to oldest session with pending balance
      for (const sess of sessions) {
        const sessPending = sess.grossAmount - sess.creditsApplied;
        if (sessPending > 0) {
          const alloc = Math.min(cr.amount, sessPending);
          sess.creditsApplied += alloc;
          if (cr.voucherType === 'Receipt') sess.payments.push({ no: cr.voucherNumber, date: cr.date, amount: alloc });
          else sess.creditNotes.push({ no: cr.voucherNumber, date: cr.date, amount: alloc });
          break;
        }
      }
    }
  });

  // 3. Update session pending and bill unpaid amounts
  sessions.forEach(sess => {
    sess.unpaidAmount = Math.max(0, sess.grossAmount - sess.creditsApplied);
    sess.status = sess.unpaidAmount === 0 ? 'PAID' : (sess.creditsApplied > 0 ? 'PARTIAL' : 'OPEN');
    
    // Distribute settled amount to bills within session
    let pool = sess.creditsApplied;
    sess.bills.forEach(b => {
      const settled = Math.min(b.amount, Math.max(0, pool));
      pool -= settled;
      b.settledAmount = settled;
      b.unpaidAmount = b.amount - settled;
      b.status = b.unpaidAmount === 0 ? 'PAID' : (b.settledAmount > 0 ? 'PARTIAL' : 'OPEN');
    });
  });

  if (p.name.includes('K G N')) {
    console.log(`\n=== RESULTS FOR ${p.name} ===`);
    sessions.forEach((s, idx) => {
      console.log(`Session ${idx + 1} (${formatDate(s.latestDateStr)}): Gross: ₹${s.grossAmount} | Credits: ₹${s.creditsApplied} | Unpaid: ₹${s.unpaidAmount} | Status: ${s.status}`);
      console.log(`   Latest Bill: ${formatDate(s.latestDateStr)} | 5% CD Due Date: ${s.cdDueDateStr} (${s.daysElapsed}d elapsed) | CD: ₹${s.cdAmount}`);
      s.bills.forEach(b => {
        console.log(`     - #${b.voucherNumber} (${b.cartons} CTN): ₹${b.amount} | Unpaid: ₹${b.unpaidAmount} (${b.status})`);
      });
    });
  }
});
