/**
 * ============================================================================
 * SKIL LEDGER — DAYBOOK MANAGER
 * Authoritative manager for date-wise physical directories:
 * Manual Khata/daybook/YYYY-MM-DD/
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const storage = require('./storage-manager');

const DAYBOOK_DIR = path.resolve(__dirname, '../daybook');

class DaybookManager {
  constructor() {
    this.baseDir = DAYBOOK_DIR;
    storage.ensureDir(this.baseDir);
  }

  // Get day directory path
  getDayDir(dateStr) {
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
    }
    const dayDir = path.join(this.baseDir, dateStr);
    storage.ensureDir(dayDir);
    return dayDir;
  }

  // Check if daybook exists for date
  hasDaybook(dateStr) {
    return fs.existsSync(path.join(this.baseDir, dateStr));
  }

  // List all daybook dates
  listDates() {
    const dates = storage.listDirs(this.baseDir)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort((a, b) => b.localeCompare(a)); // Descending chronological

    return dates.map(d => {
      const summary = this.getDaySummary(d);
      const hasRemarks = storage.exists(path.join(this.baseDir, d, 'remarks.md'));
      return {
        date: d,
        transactionCount: summary?.transactionCount || 0,
        totalSales: summary?.totalSales || 0,
        totalPurchases: summary?.totalPurchases || 0,
        totalReceipts: summary?.totalReceipts || 0,
        totalPayments: summary?.totalPayments || 0,
        hasRemarks,
        hasManual: summary?.hasManual || false
      };
    });
  }

  // Get day summary
  getDaySummary(dateStr) {
    const summaryFile = path.join(this.getDayDir(dateStr), 'day-summary.json');
    return storage.readJson(summaryFile, null);
  }

  // Get day transactions
  getDayTransactions(dateStr) {
    const txnFile = path.join(this.getDayDir(dateStr), 'transactions.json');
    return storage.readJson(txnFile, []);
  }

  // Get day remarks
  getDayRemarks(dateStr) {
    const remarksFile = path.join(this.getDayDir(dateStr), 'remarks.md');
    return storage.readText(remarksFile, '');
  }

  // Save day remarks
  saveDayRemarks(dateStr, content) {
    const remarksFile = path.join(this.getDayDir(dateStr), 'remarks.md');
    storage.writeText(remarksFile, content);
    return { success: true, date: dateStr };
  }

  // Single authoritative transaction writer & synchronizer for a given date
  syncDayFiles(dateStr, transactions) {
    const dayDir = this.getDayDir(dateStr);

    // 1. Sort transactions chronologically
    transactions.sort((a, b) => (a.createdAt || a.date || '').localeCompare(b.createdAt || b.date || ''));

    // 2. Filter subsets
    const activeTxns = transactions.filter(t => t.status !== 'cancelled');

    const bills = transactions.filter(t => ['sales_bill', 'sales_return'].includes(t.type));
    const purchases = transactions.filter(t => ['purchase_bill', 'purchase_return'].includes(t.type));
    const payments = transactions.filter(t => ['receipt', 'payment', 'cash_receipt', 'bank_receipt', 'bank_payment'].includes(t.type));
    const creditNotes = transactions.filter(t => t.type === 'credit_note');
    const debitNotes = transactions.filter(t => t.type === 'debit_note');

    // 3. Compute Totals
    let totalSales = 0;
    let totalPurchases = 0;
    let totalReceipts = 0;
    let totalPayments = 0;
    let totalCreditNotes = 0;
    let totalDebitNotes = 0;
    let cashIn = 0;
    let cashOut = 0;
    let bankIn = 0;
    let bankOut = 0;
    let hasManual = false;

    activeTxns.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.source === 'manual') hasManual = true;

      if (t.type === 'sales_bill') totalSales += amt;
      else if (t.type === 'purchase_bill') totalPurchases += amt;
      else if (t.type === 'credit_note') totalCreditNotes += amt;
      else if (t.type === 'debit_note') totalDebitNotes += amt;

      // Receipts & Payments
      if (['receipt', 'cash_receipt', 'bank_receipt'].includes(t.type)) {
        totalReceipts += amt;
        if (t.paymentMode === 'Cash' || t.type === 'cash_receipt') cashIn += amt;
        else bankIn += amt;
      } else if (['payment', 'bank_payment'].includes(t.type)) {
        totalPayments += amt;
        if (t.paymentMode === 'Cash') cashOut += amt;
        else bankOut += amt;
      }
    });

    // 4. Build Day Summary
    const daySummary = {
      date: dateStr,
      generatedAt: new Date().toISOString(),
      transactionCount: transactions.length,
      activeCount: activeTxns.length,
      cancelledCount: transactions.length - activeTxns.length,
      hasManual,
      totalSales: Math.round(totalSales * 100) / 100,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalReceipts: Math.round(totalReceipts * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      creditNotes: Math.round(totalCreditNotes * 100) / 100,
      debitNotes: Math.round(totalDebitNotes * 100) / 100,
      cashSummary: {
        inflow: Math.round(cashIn * 100) / 100,
        outflow: Math.round(cashOut * 100) / 100,
        net: Math.round((cashIn - cashOut) * 100) / 100
      },
      bankSummary: {
        inflow: Math.round(bankIn * 100) / 100,
        outflow: Math.round(bankOut * 100) / 100,
        net: Math.round((bankIn - bankOut) * 100) / 100
      }
    };

    // 5. Atomic File Writes
    storage.writeJson(path.join(dayDir, 'transactions.json'), transactions);
    storage.writeJson(path.join(dayDir, 'day-summary.json'), daySummary);
    storage.writeJson(path.join(dayDir, 'bills.json'), bills);
    storage.writeJson(path.join(dayDir, 'purchases.json'), purchases);
    storage.writeJson(path.join(dayDir, 'payments.json'), payments);
    storage.writeJson(path.join(dayDir, 'credit-notes.json'), creditNotes);
    storage.writeJson(path.join(dayDir, 'debit-notes.json'), debitNotes);

    // Initialize remarks.md if missing
    const remarksFile = path.join(dayDir, 'remarks.md');
    if (!storage.exists(remarksFile)) {
      const template = `# Business Diary & Remarks — ${dateStr}\n\n*Document notes, verbal commitments, customer discussions, stock issues, or special adjustments for this date below.*\n\n---\n`;
      storage.writeText(remarksFile, template);
    }

    return daySummary;
  }

  // Add Manual Transaction
  addTransaction(payload) {
    const {
      date,
      type,
      partyName,
      partyType = 'debtor',
      particulars,
      reference = '',
      amount,
      paymentMode = 'Bank',
      againstBill = '',
      remarks = '',
      attachment = '',
      author = 'Sahil Kumar'
    } = payload;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Valid date (YYYY-MM-DD) is required.');
    }
    if (!partyName || partyName.trim().length === 0) {
      throw new Error('Party Name is required.');
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Amount must be a positive number.');
    }

    const currentTxns = this.getDayTransactions(date);

    // Generate unique sequential ID
    const count = currentTxns.length + 1;
    const cleanDate = date.replace(/-/g, '');
    const id = `TXN-MAN-${cleanDate}-${String(count).padStart(3, '0')}`;

    const newTxn = {
      id,
      date,
      type: type || 'sales_bill',
      partyName: partyName.trim(),
      partyType, // 'debtor' | 'creditor' | 'other'
      particulars: particulars ? particulars.trim() : `${type} recorded`,
      reference: reference ? reference.trim() : '',
      amount: Math.round(numAmount * 100) / 100,
      paymentMode, // 'Cash' | 'Bank' | 'Credit' | 'Other'
      againstBill: againstBill ? againstBill.trim() : '',
      remarks: remarks ? remarks.trim() : '',
      attachment: attachment || '',
      source: 'manual',
      status: 'active', // 'active' | 'cancelled'
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: author,
      history: []
    };

    currentTxns.push(newTxn);
    this.syncDayFiles(date, currentTxns);

    return newTxn;
  }

  // Edit Manual Transaction
  updateTransaction(id, updates, author = 'Sahil Kumar', reason = 'Manual correction') {
    // Find transaction date
    const allDates = storage.listDirs(this.baseDir);
    let targetDate = null;
    let targetTxns = null;
    let targetIndex = -1;

    for (const d of allDates) {
      const txns = this.getDayTransactions(d);
      const idx = txns.findIndex(t => t.id === id);
      if (idx !== -1) {
        targetDate = d;
        targetTxns = txns;
        targetIndex = idx;
        break;
      }
    }

    if (!targetTxns || targetIndex === -1) {
      throw new Error(`Transaction with ID "${id}" not found.`);
    }

    const original = targetTxns[targetIndex];
    if (original.source !== 'manual') {
      throw new Error('Tally-imported accounting transactions cannot be modified through the manual daybook editor.');
    }

    // Capture audit history snapshot
    const historyEntry = {
      modifiedAt: new Date().toISOString(),
      modifiedBy: author,
      reason,
      previousState: {
        particulars: original.particulars,
        amount: original.amount,
        reference: original.reference,
        paymentMode: original.paymentMode,
        remarks: original.remarks,
        status: original.status
      }
    };

    const updatedTxn = {
      ...original,
      particulars: updates.particulars !== undefined ? updates.particulars.trim() : original.particulars,
      reference: updates.reference !== undefined ? updates.reference.trim() : original.reference,
      amount: updates.amount !== undefined ? Math.round(parseFloat(updates.amount) * 100) / 100 : original.amount,
      paymentMode: updates.paymentMode !== undefined ? updates.paymentMode : original.paymentMode,
      againstBill: updates.againstBill !== undefined ? updates.againstBill : original.againstBill,
      remarks: updates.remarks !== undefined ? updates.remarks.trim() : original.remarks,
      attachment: updates.attachment !== undefined ? updates.attachment : original.attachment,
      status: updates.status !== undefined ? updates.status : original.status,
      updatedAt: new Date().toISOString(),
      history: [...(original.history || []), historyEntry]
    };

    targetTxns[targetIndex] = updatedTxn;
    this.syncDayFiles(targetDate, targetTxns);

    return updatedTxn;
  }

  // Cancel Transaction (Non-Destructive)
  cancelTransaction(id, author = 'Sahil Kumar', reason = 'Cancelled by user') {
    return this.updateTransaction(id, { remarks: `[CANCELLED: ${reason}]`, status: 'cancelled' }, author, reason);
  }

  // Get Calendar Matrix for Month (YYYY-MM)
  getCalendarData(year, month) {
    const padMonth = String(month).padStart(2, '0');
    const prefix = `${year}-${padMonth}`;
    const allDates = this.listDates().filter(d => d.date.startsWith(prefix));

    const dateMap = {};
    allDates.forEach(d => { dateMap[d.date] = d; });

    // Days in month
    const totalDays = new Date(year, month, 0).getDate();
    const days = [];

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${padMonth}-${String(day).padStart(2, '0')}`;
      const entry = dateMap[dateStr] || {
        date: dateStr,
        transactionCount: 0,
        totalSales: 0,
        totalPurchases: 0,
        totalReceipts: 0,
        totalPayments: 0,
        hasRemarks: false,
        hasManual: false
      };
      days.push(entry);
    }

    return {
      year,
      month,
      prefix,
      days
    };
  }

  // Global Search across Daybooks
  search(query, filters = {}) {
    const q = (query || '').toLowerCase().trim();
    const allDates = this.listDates();
    const results = [];

    allDates.forEach(d => {
      const txns = this.getDayTransactions(d.date);
      txns.forEach(t => {
        // Apply Filters
        if (filters.partyType && t.partyType !== filters.partyType) return;
        if (filters.type && t.type !== filters.type) return;
        if (filters.source && t.source !== filters.source) return;
        if (filters.fromDate && t.date < filters.fromDate) return;
        if (filters.toDate && t.date > filters.toDate) return;
        if (filters.minAmount && t.amount < parseFloat(filters.minAmount)) return;
        if (filters.maxAmount && t.amount > parseFloat(filters.maxAmount)) return;

        // Apply text match
        if (!q) {
          results.push(t);
          return;
        }

        const match =
          (t.partyName && t.partyName.toLowerCase().includes(q)) ||
          (t.particulars && t.particulars.toLowerCase().includes(q)) ||
          (t.reference && t.reference.toLowerCase().includes(q)) ||
          (t.remarks && t.remarks.toLowerCase().includes(q)) ||
          (t.id && t.id.toLowerCase().includes(q)) ||
          String(t.amount).includes(q);

        if (match) results.push(t);
      });
    });

    return results;
  }
}

module.exports = new DaybookManager();
