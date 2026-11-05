const fs = require('fs');
const path = require('path');
const db = require('./database');

class AgingService {
  /**
   * Calculate Debtors and Creditors aging analysis
   * @param {string|Date} asOfDateParam 
   */
  calculateAging(asOfDateParam = null) {
    const asOf = asOfDateParam ? new Date(asOfDateParam) : new Date();
    const ledgersData = db.getLedgers({ limit: 500 }).items || [];
    const allVouchers = db.getVouchers({ limit: 1000 }).items || [];

    const debtors = ledgersData.filter(l => l.parent === 'Sundry Debtors');
    const creditors = ledgersData.filter(l => l.parent === 'Sundry Creditors');

    const debtorsAging = this.processPartiesAging(debtors, allVouchers, 'debtor', asOf);
    const creditorsAging = this.processPartiesAging(creditors, allVouchers, 'creditor', asOf);

    return {
      asOfDate: asOf.toISOString(),
      debtors: debtorsAging,
      creditors: creditorsAging
    };
  }

  processPartiesAging(parties, vouchers, partyType, asOf) {
    let totalOutstanding = 0;
    let totalBucketUnder30 = 0;
    let totalBucket31To45 = 0;
    let totalBucket46To60 = 0;
    let totalBucketOver60 = 0;
    let totalBucket30To60 = 0;
    let totalBucket60To90 = 0;
    let totalBucketOver90 = 0;
    let totalAdvance = 0;

    const items = parties.map(p => {
      // Find all transactions associated with this party
      const pVchs = vouchers.filter(v => 
        (v.partyName && v.partyName.toLowerCase() === p.name.toLowerCase()) ||
        v.ledgerEntries?.some(l => l.ledgerName.toLowerCase() === p.name.toLowerCase())
      );

      // Sort chronological
      pVchs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      // Calculate debits, credits, and net closing
      let totalDebits = 0;
      let totalCredits = 0;
      const bills = [];

      pVchs.forEach(v => {
        const vDate = this.parseTallyDate(v.date);
        const daysElapsed = vDate ? Math.max(0, Math.floor((asOf - vDate) / (1000 * 60 * 60 * 24))) : 0;
        
        let partyDrCr = 0;
        v.ledgerEntries?.forEach(le => {
          if (le.ledgerName.toLowerCase() === p.name.toLowerCase()) {
            partyDrCr = le.amount;
          }
        });

        // In Tally:
        // For Debtors: Sales debits customer, Receipt credits customer, Credit Note credits customer, Payment (refund) debits customer.
        // For Creditors: Purchase credits supplier, Payment debits supplier, Debit Note debits supplier, Receipt (refund) credits supplier.
        if (partyType === 'debtor') {
          if (v.voucherType === 'Sales') {
            const taxable = v.ledgerEntries?.find(l => l.ledgerName && l.ledgerName.includes('Sales'))?.amount || (v.amount / 1.05);
            const ctnM = (v.narration || '').match(/(\d+)\s*(?:CTN|BOX|CS|CARTON)/i);
            const ctns = ctnM ? parseInt(ctnM[1], 10) : (v.inventoryEntries?.length || 1);
            const dueDateObj = vDate ? new Date(vDate.getTime() + 30 * 86400000) : null;

            bills.push({
              voucherType: v.voucherType,
              voucherNumber: v.voucherNumber,
              date: v.date,
              formattedDate: this.formatDate(v.date),
              amount: v.amount,
              taxableAmount: Math.round(taxable * 100) / 100,
              cartons: ctns,
              daysElapsed,
              bucket: this.getBucket(daysElapsed),
              dueDate: dueDateObj ? dueDateObj.toISOString().slice(0, 10) : '',
              formattedDueDate: dueDateObj ? this.formatDateObj(dueDateObj) : '',
              cdEligible: daysElapsed <= 30,
              cdAmount: Math.round(taxable * 0.05 * 100) / 100
            });
            totalDebits += v.amount;
          } else if (v.voucherType === 'Receipt' || v.voucherType === 'Credit Note') {
            totalCredits += v.amount;
          } else if (v.voucherType === 'Payment') {
            // Customer refund (e.g. Salim Khan) debits customer account
            totalDebits += v.amount;
          }
        } else {
          // Creditor
          if (v.voucherType === 'Purchase') {
            const taxable = v.ledgerEntries?.find(l => l.ledgerName && l.ledgerName.includes('Purchase'))?.amount || (v.amount / 1.05);
            const dueDateObj = vDate ? new Date(vDate.getTime() + 30 * 86400000) : null;
            bills.push({
              voucherType: v.voucherType,
              voucherNumber: v.voucherNumber,
              date: v.date,
              formattedDate: this.formatDate(v.date),
              amount: v.amount,
              taxableAmount: Math.round(taxable * 100) / 100,
              daysElapsed,
              bucket: this.getBucket(daysElapsed),
              dueDate: dueDateObj ? dueDateObj.toISOString().slice(0, 10) : '',
              formattedDueDate: dueDateObj ? this.formatDateObj(dueDateObj) : '',
              cdEligible: daysElapsed <= 30,
              cdAmount: Math.round(taxable * 0.03 * 100) / 100
            });
            totalCredits += v.amount;
          } else if (v.voucherType === 'Payment' || v.voucherType === 'Debit Note') {
            totalDebits += v.amount;
          } else if (v.voucherType === 'Receipt') {
            // Supplier refund credits supplier account
            totalCredits += v.amount;
          }
        }
      });

      // Calculate net balance
      // For debtor: net receivable = debits - credits
      // For creditor: net payable = credits - debits
      const netDue = partyType === 'debtor' ? (totalDebits - totalCredits) : (totalCredits - totalDebits);

      // Group bills into Sessions (invoices within 4 days of each other)
      const sessions = [];
      bills.forEach(bill => {
        const bDate = this.parseTallyDate(bill.date);
        let sess = sessions.find(sn => {
          const diffDays = Math.abs((bDate - sn.latestDate) / 86400000);
          return diffDays <= 4;
        });

        if (sess) {
          sess.bills.push(bill);
          if (bDate > sess.latestDate) {
            sess.latestDate = bDate;
            sess.latestDateStr = bill.date;
            sess.latestBillNo = bill.voucherNumber;
          }
        } else {
          sessions.push({
            sessionNumber: sessions.length + 1,
            earliestDate: bDate,
            latestDate: bDate,
            latestDateStr: bill.date,
            latestBillNo: bill.voucherNumber,
            bills: [bill],
            creditsApplied: 0,
            payments: [],
            creditNotes: []
          });
        }
      });

      // Calculate session properties & 5% CD due dates (30 days from latest bill in session)
      sessions.forEach(sess => {
        sess.grossAmount = sess.bills.reduce((sum, b) => sum + b.amount, 0);
        sess.taxableAmount = Math.round(sess.bills.reduce((sum, b) => sum + (b.taxableAmount || (b.amount / 1.05)), 0) * 100) / 100;
        sess.cdAmount = Math.round(sess.taxableAmount * (partyType === 'debtor' ? 0.05 : 0.03) * 100) / 100;
        sess.cdDueDate = new Date(sess.latestDate.getTime() + 30 * 86400000);
        sess.cdDueDateFormatted = this.formatDateObj(sess.cdDueDate);
        sess.daysElapsed = Math.max(0, Math.floor((asOf - sess.latestDate) / 86400000));
        sess.daysToDueDate = Math.floor((sess.cdDueDate - asOf) / 86400000);
        sess.cdEligible = true; // Always allow active session CD in prompt settlement
      });

      // Allocate credits (Receipts/CNs for debtors; Payments/DNs for creditors)
      const creditVchs = pVchs.filter(v => 
        partyType === 'debtor' ? (v.voucherType === 'Receipt' || v.voucherType === 'Credit Note') : (v.voucherType === 'Payment' || v.voucherType === 'Debit Note')
      ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      // Check narration matches first (e.g. "SKIL-004 to SKIL-006")
      const unallocatedCredits = [];
      creditVchs.forEach(cr => {
        let matched = false;
        const nar = cr.narration || '';
        sessions.forEach(sess => {
          const match = sess.bills.some(b => nar.includes(b.voucherNumber) || (b.voucherNumber.startsWith('SKIL-') && nar.includes(b.voucherNumber.replace('SKIL-', ''))));
          if (match) {
            sess.creditsApplied += cr.amount;
            if (cr.voucherType === 'Receipt' || cr.voucherType === 'Payment') {
              sess.payments.push({ no: cr.voucherNumber, date: cr.date, amount: cr.amount, nar });
            } else {
              sess.creditNotes.push({ no: cr.voucherNumber, date: cr.date, amount: cr.amount, nar });
            }
            matched = true;
          }
        });
        if (!matched) unallocatedCredits.push(cr);
      });

      // For unallocated credits, allocate chronologically to active sessions
      // Exception: If a prior session already had its CD Credit Note issued, its settlement is finalized
      // leaving any remaining balance as frozen old balance; subsequent payments apply to subsequent sessions!
      unallocatedCredits.forEach(cr => {
        let crRemaining = cr.amount;
        const crDate = this.parseTallyDate(cr.date);

        for (const sess of sessions) {
          // If this session had a CD credit note issued before this credit, don't overwrite its frozen old balance
          const hasCdFinalized = sess.creditNotes.some(cn => cn.nar?.toLowerCase().includes('cash discount') || cn.nar?.toLowerCase().includes('cd'));
          if (hasCdFinalized && crDate && crDate > sess.latestDate) {
            continue; // Keep old balance frozen as historical prior balance!
          }

          const sessPending = sess.grossAmount - sess.creditsApplied;
          if (sessPending > 0) {
            const alloc = Math.min(crRemaining, sessPending);
            sess.creditsApplied += alloc;
            crRemaining -= alloc;
            if (cr.voucherType === 'Receipt' || cr.voucherType === 'Payment') {
              sess.payments.push({ no: cr.voucherNumber, date: cr.date, amount: alloc, nar: cr.narration });
            } else {
              sess.creditNotes.push({ no: cr.voucherNumber, date: cr.date, amount: alloc, nar: cr.narration });
            }
            if (crRemaining <= 0) break;
          }
        }
      });

      // Distribute settled amount to bills within each session
      sessions.forEach(sess => {
        sess.unpaidAmount = Math.max(0, Math.round((sess.grossAmount - sess.creditsApplied) * 100) / 100);
        sess.status = sess.unpaidAmount === 0 ? 'PAID' : (sess.creditsApplied > 0 ? 'PARTIAL' : 'OPEN');

        let pool = sess.creditsApplied;
        sess.bills.forEach(b => {
          const settled = Math.min(b.amount, Math.max(0, pool));
          pool -= settled;
          b.settledAmount = Math.round(settled * 100) / 100;
          b.unpaidAmount = Math.round((b.amount - settled) * 100) / 100;
          b.status = b.unpaidAmount === 0 ? 'PAID' : (b.settledAmount > 0 ? 'PARTIAL' : 'OPEN');
          b.sessionId = `sess-${sess.sessionNumber}`;
          b.sessionDueDate = sess.cdDueDateFormatted;
        });
      });

      const openBills = bills.filter(b => b.unpaidAmount > 0);
      const settledBills = bills.filter(b => b.status === 'PAID');

      let under30 = 0;
      let d31to45 = 0;
      let d46to60 = 0;
      let over60 = 0;

      let d30to60 = 0;
      let d60to90 = 0;
      let over90 = 0;
      let isAdvance = false;

      if (netDue > 0) {
        // Bucket the open unpaid portion of each bill
        openBills.forEach(bill => {
          const amt = bill.unpaidAmount;
          // 4-category analysis (user standard: 30 days, 45 days, 60 days, >60 days)
          if (bill.daysElapsed <= 30) under30 += amt;
          else if (bill.daysElapsed <= 45) d31to45 += amt;
          else if (bill.daysElapsed <= 60) d46to60 += amt;
          else over60 += amt;

          // Legacy 30/60/90 compatibility
          if (bill.daysElapsed < 30) {}
          else if (bill.daysElapsed < 60) d30to60 += amt;
          else if (bill.daysElapsed < 90) d60to90 += amt;
          else over90 += amt;
        });

        totalOutstanding += netDue;
        totalBucketUnder30 += under30;
        totalBucket31To45 += d31to45;
        totalBucket46To60 += d46to60;
        totalBucketOver60 += over60;

        totalBucket30To60 += d30to60;
        totalBucket60To90 += d60to90;
        totalBucketOver90 += over90;
      } else if (netDue < 0) {
        isAdvance = true;
        totalAdvance += Math.abs(netDue);
      }

      // Oldest open bill
      const oldestBill = openBills.length > 0 ? openBills[0] : (bills.length > 0 ? bills[0] : null);

      return {
        partyName: p.name,
        gstin: p.gstin || '',
        state: p.state || '',
        totalBilled: Math.round((partyType === 'debtor' ? totalDebits : totalCredits) * 100) / 100,
        totalPaid: Math.round((partyType === 'debtor' ? totalCredits : totalDebits) * 100) / 100,
        netDue: Math.round(netDue * 100) / 100,
        isAdvance,
        advanceAmount: isAdvance ? Math.abs(Math.round(netDue * 100) / 100) : 0,
        // Standard 4 buckets (0-30d, 31-45d, 46-60d, >60d)
        under30: Math.round(under30 * 100) / 100,
        d31to45: Math.round(d31to45 * 100) / 100,
        d46to60: Math.round(d46to60 * 100) / 100,
        over60: Math.round(over60 * 100) / 100,
        // Legacy buckets
        d30to60: Math.round(d30to60 * 100) / 100,
        d60to90: Math.round(d60to90 * 100) / 100,
        over90: Math.round(over90 * 100) / 100,
        oldestBillDays: oldestBill ? oldestBill.daysElapsed : 0,
        oldestBillDate: oldestBill ? oldestBill.formattedDate : '—',
        totalInvoices: bills.length,
        openBillsCount: openBills.length,
        settledBillsCount: settledBills.length,
        bills,
        sessions: sessions.map(sn => ({
          sessionNumber: sn.sessionNumber,
          earliestDate: this.formatDate(sn.latestDateStr),
          latestDate: this.formatDate(sn.latestDateStr),
          latestBillNo: sn.latestBillNo,
          billNumbers: sn.bills.map(b => b.voucherNumber),
          billsCount: sn.bills.length,
          totalCartons: sn.bills.reduce((sum, b) => sum + (b.cartons || 1), 0),
          grossAmount: sn.grossAmount,
          taxableAmount: sn.taxableAmount,
          cdAmount: sn.cdAmount,
          cdDueDate: sn.cdDueDateFormatted,
          daysElapsed: sn.daysElapsed,
          daysToDueDate: sn.daysToDueDate,
          creditsApplied: sn.creditsApplied,
          unpaidAmount: sn.unpaidAmount,
          status: sn.status
        }))
      };
    });

    // Sort descending by netDue
    items.sort((a, b) => b.netDue - a.netDue);

    return {
      summary: {
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalAdvance: Math.round(totalAdvance * 100) / 100,
        under30: Math.round(totalBucketUnder30 * 100) / 100,
        d31to45: Math.round(totalBucket31To45 * 100) / 100,
        d46to60: Math.round(totalBucket46To60 * 100) / 100,
        over60: Math.round(totalBucketOver60 * 100) / 100,
        d30to60: Math.round(totalBucket30To60 * 100) / 100,
        d60to90: Math.round(totalBucket60To90 * 100) / 100,
        over90: Math.round(totalBucketOver90 * 100) / 100,
        partiesCount: parties.length,
        openPartiesCount: items.filter(i => i.netDue > 0).length,
        clearedPartiesCount: items.filter(i => i.netDue <= 0).length
      },
      parties: items
    };
  }

  getBucket(days) {
    if (days <= 30) return '<30';
    if (days <= 45) return '31-45';
    if (days <= 60) return '46-60';
    return '>60';
  }

  parseTallyDate(dStr) {
    if (!dStr || dStr.length !== 8) return null;
    const y = parseInt(dStr.slice(0, 4), 10);
    const m = parseInt(dStr.slice(4, 6), 10) - 1;
    const d = parseInt(dStr.slice(6, 8), 10);
    return new Date(Date.UTC(y, m, d));
  }

  formatDate(dStr) {
    if (!dStr || dStr.length !== 8) return dStr || '-';
    return `${dStr.slice(6, 8)}-${dStr.slice(4, 6)}-${dStr.slice(0, 4)}`;
  }

  formatDateObj(d) {
    if (!d) return '—';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  saveAgingFiles(asOfParam = null) {
    const data = this.calculateAging(asOfParam);
    const jsonStr = JSON.stringify(data, null, 2);
    const paths = [
      path.join(__dirname, 'data', 'aging.json'),
      path.join(__dirname, 'public', 'data', 'aging.json'),
      path.join(__dirname, '..', 'android-app', 'www', 'data', 'aging.json'),
      path.join(__dirname, '..', 'data', 'aging.json')
    ];
    paths.forEach(p => {
      try {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(p, jsonStr, 'utf8');
      } catch (e) {
        console.error('Error writing aging file:', p, e.message);
      }
    });
    return data;
  }
}

module.exports = new AgingService();
