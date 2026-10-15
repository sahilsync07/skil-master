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
        // For Debtors: Sales debits the customer (receivable), Receipt credits the customer.
        // For Creditors: Purchase credits supplier (payable), Payment debits supplier.
        if (partyType === 'debtor') {
          if (v.voucherType === 'Sales') {
            bills.push({
              voucherType: v.voucherType,
              voucherNumber: v.voucherNumber,
              date: v.date,
              formattedDate: this.formatDate(v.date),
              amount: v.amount,
              daysElapsed,
              bucket: this.getBucket(daysElapsed)
            });
            totalDebits += v.amount;
          } else if (v.voucherType === 'Receipt') {
            totalCredits += v.amount;
          } else if (v.voucherType === 'Payment') {
            // Customer refund (e.g. Salim Khan) debits customer account
            totalDebits += v.amount;
          }
        } else {
          // Creditor
          if (v.voucherType === 'Purchase') {
            bills.push({
              voucherType: v.voucherType,
              voucherNumber: v.voucherNumber,
              date: v.date,
              formattedDate: this.formatDate(v.date),
              amount: v.amount,
              daysElapsed,
              bucket: this.getBucket(daysElapsed)
            });
            totalCredits += v.amount;
          } else if (v.voucherType === 'Payment') {
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

      // FIFO Bill Settlement Tracking (First In, First Out against oldest bills)
      let paymentPool = partyType === 'debtor' ? totalCredits : totalDebits;
      bills.forEach(bill => {
        const settled = Math.min(bill.amount, Math.max(0, paymentPool));
        paymentPool -= settled;
        bill.settledAmount = Math.round(settled * 100) / 100;
        bill.unpaidAmount = Math.round((bill.amount - settled) * 100) / 100;
        if (bill.unpaidAmount === 0) {
          bill.status = 'PAID';
        } else if (bill.settledAmount > 0) {
          bill.status = 'PARTIAL';
        } else {
          bill.status = 'OPEN';
        }
      });

      const openBills = bills.filter(b => b.unpaidAmount > 0);
      const settledBills = bills.filter(b => b.status === 'PAID');

      let under30 = 0;
      let d30to60 = 0;
      let d60to90 = 0;
      let over90 = 0;
      let isAdvance = false;

      if (netDue > 0) {
        // Bucket the open unpaid portion of each bill
        openBills.forEach(bill => {
          const amt = bill.unpaidAmount;
          if (bill.daysElapsed < 30) under30 += amt;
          else if (bill.daysElapsed < 60) d30to60 += amt;
          else if (bill.daysElapsed < 90) d60to90 += amt;
          else over90 += amt;
        });

        totalOutstanding += netDue;
        totalBucketUnder30 += under30;
        totalBucket30To60 += d30to60;
        totalBucket60To90 += d60to90;
        totalBucketOver90 += over90;
      } else if (netDue < 0) {
        isAdvance = true;
        totalAdvance += Math.abs(netDue);
      }

      // Oldest bill
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
        under30: Math.round(under30 * 100) / 100,
        d30to60: Math.round(d30to60 * 100) / 100,
        d60to90: Math.round(d60to90 * 100) / 100,
        over90: Math.round(over90 * 100) / 100,
        oldestBillDays: oldestBill ? oldestBill.daysElapsed : 0,
        totalInvoices: bills.length,
        openBillsCount: openBills.length,
        settledBillsCount: settledBills.length,
        bills
      };
    });

    // Sort descending by netDue
    items.sort((a, b) => b.netDue - a.netDue);

    return {
      summary: {
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalAdvance: Math.round(totalAdvance * 100) / 100,
        under30: Math.round(totalBucketUnder30 * 100) / 100,
        d30to60: Math.round(totalBucket30To60 * 100) / 100,
        d60to90: Math.round(totalBucket60To90 * 100) / 100,
        over90: Math.round(totalBucketOver90 * 100) / 100,
        partiesCount: parties.length
      },
      parties: items
    };
  }

  getBucket(days) {
    if (days < 30) return '<30';
    if (days < 60) return '30-60';
    if (days < 90) return '60-90';
    return '90+';
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
}

module.exports = new AgingService();
