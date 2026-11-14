/**
 * ============================================================================
 * SKIL LEDGER — BACKEND SERVER & API BRIDGE
 * Port: 9050 (or process.env.PORT)
 * Local bridge connecting single-file frontend to Tally XML API and Daybook storage.
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');

// Support fallback node_modules resolution
module.paths.push(path.resolve(__dirname, '../sync-engine/node_modules'));
module.paths.push(path.resolve(__dirname, 'node_modules'));

const express = require('express');
const cors = require('cors');

const storage = require('./scripts/storage-manager');
const daybookManager = require('./scripts/daybook-manager');
const tallySync = require('./scripts/tally-sync');
const backupManager = require('./scripts/backup-manager');

const app = express();
const SETTINGS_PATH = path.resolve(__dirname, 'config/settings.json');
const settings = storage.readJson(SETTINGS_PATH, {
  server: { port: 9050 },
  company: { name: 'SKIL LIFESTYLE LLP' },
  financialYear: { start: '2026-04-01', end: '2027-03-31' }
});

const PORT = process.env.PORT || settings.server?.port || 9050;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend HTML directly on root
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'skil-ledger.html'));
});

// Serve static assets in Manual Khata directory if needed
app.use('/static', express.static(__dirname));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTallyData() {
  const tallyDataDir = path.resolve(__dirname, 'tally-data');
  const ledgersMap = storage.readJson(path.join(tallyDataDir, 'tally-ledgers.json'), {});
  const vouchersMap = storage.readJson(path.join(tallyDataDir, 'tally-vouchers.json'), {});
  const master = storage.readJson(path.join(tallyDataDir, 'tally-master.json'), null);
  const lastSync = storage.readJson(path.join(tallyDataDir, 'last-sync.json'), null);

  return {
    ledgers: Object.values(ledgersMap),
    ledgersMap,
    vouchers: Object.values(vouchersMap),
    vouchersMap,
    master,
    lastSync
  };
}

function getAllManualTransactions() {
  const dates = daybookManager.listDates();
  const allTxns = [];
  dates.forEach(d => {
    const txns = daybookManager.getDayTransactions(d.date);
    allTxns.push(...txns);
  });
  return allTxns;
}

// Format currency as Indian Rupee (₹ xx,xx,xxx.xx)
function formatINR(val) {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Party Name Normalization & Fuzzy Matcher
function normalizePartyKey(name) {
  return (name || '')
    .toLowerCase()
    .replace(/^m\/s\.?\s*/i, '')
    .replace(/footware/g, 'footwear')
    .replace(/shoes/g, 'shoe')
    .replace(/enterprises/g, 'enterprise')
    .replace(/[^a-z0-9]/g, '');
}

function partyNamesMatch(name1, name2) {
  if (!name1 || !name2) return false;
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  if (n1 === n2) return true;

  const k1 = normalizePartyKey(name1);
  const k2 = normalizePartyKey(name2);
  if (k1 && k2 && k1 === k2) return true;

  if (k1.length >= 6 && k2.length >= 6) {
    if (k1.includes(k2) || k2.includes(k1)) return true;
  }
  return false;
}

// ============================================================================
// 1. SYSTEM & STATUS APIS
// ============================================================================

app.get('/api/status', async (req, res) => {
  try {
    let tallyOnline = false;
    let tallyCompany = null;
    let tallyError = null;

    try {
      tallyCompany = await tallySync.checkHealth();
      tallyOnline = true;
    } catch (err) {
      tallyOnline = false;
      tallyError = err.message;
    }

    const { ledgers, vouchers, lastSync, master } = getTallyData();
    const debtors = ledgers.filter(l => l.category === 'debtor');
    const creditors = ledgers.filter(l => l.category === 'creditor');
    const daybookDates = daybookManager.listDates();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      tally: {
        online: tallyOnline,
        company: tallyCompany || master,
        endpoint: `http://${tallySync.host}:${tallySync.port}`,
        error: tallyError,
        isSyncing: tallySync.isSyncing,
        lastSync
      },
      counts: {
        totalLedgers: ledgers.length,
        debtorsCount: debtors.length,
        creditorsCount: creditors.length,
        vouchersCount: vouchers.length,
        daybookDatesCount: daybookDates.length
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    const isFull = req.body?.full === true;
    const result = await tallySync.runSync({ full: isFull });
    res.json({ status: 'ok', result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 2. DASHBOARD KPI & SUMMARY
// ============================================================================

app.get('/api/dashboard', (req, res) => {
  try {
    const { ledgers, vouchers, lastSync } = getTallyData();
    const manualTxns = getAllManualTransactions().filter(t => t.status !== 'cancelled');

    // Aggregate Debtors & Creditors
    const debtors = ledgers.filter(l => l.category === 'debtor');
    const creditors = ledgers.filter(l => l.category === 'creditor');

    let totalDebtorsOutstanding = 0;
    let totalCreditorsOutstanding = 0;

    debtors.forEach(d => {
      const type = d.balanceType || (d.closingBalance < 0 ? 'Dr' : 'Cr');
      if (type === 'Dr') {
        totalDebtorsOutstanding += Math.abs(d.currentOutstanding || d.closingBalance || 0);
      }
    });

    creditors.forEach(c => {
      totalCreditorsOutstanding += Math.abs(c.currentOutstanding || c.closingBalance || 0);
    });

    // Today's Date in YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySummary = daybookManager.getDaySummary(todayStr) || {
      totalSales: 0,
      totalPurchases: 0,
      totalReceipts: 0,
      totalPayments: 0
    };

    // Calculate Tally transactions for today if any
    const todayTally = vouchers.filter(v => v.date === todayStr);
    let todayTallySales = 0;
    let todayTallyReceipts = 0;
    let todayTallyPurchases = 0;
    let todayTallyPayments = 0;

    todayTally.forEach(v => {
      if (v.voucherType === 'Sales') todayTallySales += v.amount;
      else if (v.voucherType === 'Purchase') todayTallyPurchases += v.amount;
      else if (v.voucherType === 'Receipt') todayTallyReceipts += v.amount;
      else if (v.voucherType === 'Payment') todayTallyPayments += v.amount;
    });

    // Top 5 Debtors by Outstanding (Receivables)
    const topDebtors = [...debtors]
      .filter(d => (d.balanceType || (d.closingBalance < 0 ? 'Dr' : 'Cr')) === 'Dr')
      .sort((a, b) => (b.currentOutstanding || 0) - (a.currentOutstanding || 0))
      .slice(0, 5)
      .map(d => ({
        name: d.name,
        outstanding: d.currentOutstanding || 0,
        mobile: d.mobile,
        gstin: d.gstin
      }));

    // Top 5 Creditors by Outstanding
    const topCreditors = [...creditors]
      .sort((a, b) => (b.currentOutstanding || 0) - (a.currentOutstanding || 0))
      .slice(0, 5)
      .map(c => ({
        name: c.name,
        outstanding: c.currentOutstanding || 0,
        mobile: c.mobile,
        gstin: c.gstin
      }));

    // Recent 10 Combined Transactions
    const combinedRecent = [];

    // Add manual
    manualTxns.forEach(t => {
      combinedRecent.push({
        id: t.id,
        date: t.date,
        type: t.type,
        partyName: t.partyName,
        partyType: t.partyType,
        particulars: t.particulars,
        reference: t.reference,
        amount: t.amount,
        paymentMode: t.paymentMode,
        source: 'manual',
        status: t.status,
        timestamp: t.createdAt || t.date
      });
    });

    // Add Tally recent vouchers
    vouchers.forEach(v => {
      combinedRecent.push({
        id: v.id,
        date: v.date,
        type: v.voucherType,
        partyName: v.partyName,
        partyType: debtors.some(d => d.name === v.partyName) ? 'debtor' : creditors.some(c => c.name === v.partyName) ? 'creditor' : 'other',
        particulars: `${v.voucherType} #${v.voucherNumber}`,
        reference: v.reference || v.voucherNumber,
        amount: v.amount,
        paymentMode: v.voucherType === 'Receipt' || v.voucherType === 'Payment' ? 'Bank' : 'Credit',
        source: 'tally',
        status: 'active',
        timestamp: v.date + 'T12:00:00.000Z'
      });
    });

    combinedRecent.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recentActivity = combinedRecent.slice(0, 10);

    // Monthly stats (current month)
    const currentMonthPrefix = todayStr.slice(0, 7);
    let mtdSales = 0;
    let mtdPurchases = 0;
    let mtdCollections = 0;
    let mtdPayments = 0;

    vouchers.filter(v => v.date && v.date.startsWith(currentMonthPrefix)).forEach(v => {
      if (v.voucherType === 'Sales') mtdSales += v.amount;
      else if (v.voucherType === 'Purchase') mtdPurchases += v.amount;
      else if (v.voucherType === 'Receipt') mtdCollections += v.amount;
      else if (v.voucherType === 'Payment') mtdPayments += v.amount;
    });

    manualTxns.filter(t => t.date && t.date.startsWith(currentMonthPrefix)).forEach(t => {
      if (t.type === 'sales_bill') mtdSales += t.amount;
      else if (t.type === 'purchase_bill') mtdPurchases += t.amount;
      else if (['receipt', 'cash_receipt', 'bank_receipt'].includes(t.type)) mtdCollections += t.amount;
      else if (['payment', 'bank_payment'].includes(t.type)) mtdPayments += t.amount;
    });

    res.json({
      status: 'ok',
      kpis: {
        totalDebtorsOutstanding: Math.round(totalDebtorsOutstanding * 100) / 100,
        totalCreditorsOutstanding: Math.round(totalCreditorsOutstanding * 100) / 100,
        todaySales: Math.round((todaySummary.totalSales + todayTallySales) * 100) / 100,
        todayReceipts: Math.round((todaySummary.totalReceipts + todayTallyReceipts) * 100) / 100,
        todayPurchases: Math.round((todaySummary.totalPurchases + todayTallyPurchases) * 100) / 100,
        todayPayments: Math.round((todaySummary.totalPayments + todayTallyPayments) * 100) / 100,
        mtdSales: Math.round(mtdSales * 100) / 100,
        mtdPurchases: Math.round(mtdPurchases * 100) / 100,
        mtdCollections: Math.round(mtdCollections * 100) / 100,
        mtdPayments: Math.round(mtdPayments * 100) / 100
      },
      topDebtors,
      topCreditors,
      recentActivity,
      lastSync
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 3. LEDGER & PARTY VIEWS (DEBTORS & CREDITORS)
// ============================================================================

app.get('/api/ledgers', (req, res) => {
  try {
    const { category, search } = req.query;
    const { ledgers, vouchers } = getTallyData();
    const manualTxns = getAllManualTransactions().filter(t => t.status !== 'cancelled');

    // Build map of transaction counts per party
    const partyStats = {};

    vouchers.forEach(v => {
      if (v.partyName) {
        const matched = ledgers.find(l => partyNamesMatch(l.name, v.partyName));
        const canonical = matched ? matched.name : v.partyName;
        if (!partyStats[canonical]) partyStats[canonical] = { txnCount: 0, lastTxnDate: '', manualBills: 0, manualPayments: 0 };
        partyStats[canonical].txnCount++;
        if (!partyStats[canonical].lastTxnDate || v.date > partyStats[canonical].lastTxnDate) {
          partyStats[canonical].lastTxnDate = v.date;
        }
      }
    });

    manualTxns.forEach(t => {
      if (t.partyName) {
        const matched = ledgers.find(l => partyNamesMatch(l.name, t.partyName));
        const canonical = matched ? matched.name : t.partyName;
        if (!partyStats[canonical]) partyStats[canonical] = { txnCount: 0, lastTxnDate: '', manualBills: 0, manualPayments: 0 };
        partyStats[canonical].txnCount++;
        if (!partyStats[canonical].lastTxnDate || t.date > partyStats[canonical].lastTxnDate) {
          partyStats[canonical].lastTxnDate = t.date;
        }
        if (['sales_bill', 'purchase_bill', 'debit_note'].includes(t.type)) {
          partyStats[canonical].manualBills += (Number(t.amount) || 0);
        } else if (['receipt', 'payment', 'credit_note', 'cash_receipt', 'bank_receipt'].includes(t.type)) {
          partyStats[canonical].manualPayments += (Number(t.amount) || 0);
        }
      }
    });

    let results = ledgers.map(l => {
      const stats = partyStats[l.name] || { txnCount: 0, lastTxnDate: '', manualBills: 0, manualPayments: 0 };
      const baseBalance = l.currentOutstanding || Math.abs(l.closingBalance || 0);
      const effectiveOutstanding = Math.round((baseBalance + stats.manualBills - stats.manualPayments) * 100) / 100;
      return {
        ...l,
        txnCount: stats.txnCount,
        lastTxnDate: stats.lastTxnDate,
        currentOutstanding: effectiveOutstanding
      };
    });

    // Also include any parties created solely in manual transactions if not in Tally
    const manualOnlyParties = {};

    manualTxns.forEach(t => {
      const isExistingTally = ledgers.some(l => partyNamesMatch(l.name, t.partyName));
      if (!isExistingTally) {
        const key = normalizePartyKey(t.partyName);
        if (!manualOnlyParties[key]) {
          const stats = partyStats[t.partyName] || { txnCount: 1, lastTxnDate: t.date, manualBills: 0, manualPayments: 0 };
          const balance = Math.round((stats.manualBills - stats.manualPayments) * 100) / 100;
          manualOnlyParties[key] = {
            id: `MAN-PARTY-${t.partyName.replace(/\s+/g, '-').toUpperCase()}`,
            name: t.partyName,
            parent: t.partyType === 'creditor' ? 'Sundry Creditors' : 'Sundry Debtors',
            category: t.partyType || 'debtor',
            isDebtor: t.partyType !== 'creditor',
            isCreditor: t.partyType === 'creditor',
            openingBalance: 0,
            closingBalance: balance,
            currentOutstanding: Math.abs(balance),
            balanceType: balance >= 0 ? (t.partyType === 'creditor' ? 'Cr' : 'Dr') : (t.partyType === 'creditor' ? 'Dr' : 'Cr'),
            gstin: '',
            state: '',
            mobile: '',
            phone: '',
            address: '',
            source: 'manual',
            txnCount: stats.txnCount,
            lastTxnDate: stats.lastTxnDate
          };
        }
      }
    });

    results = results.concat(Object.values(manualOnlyParties));

    // Filter by Category
    if (category === 'debtor') {
      results = results.filter(l => l.category === 'debtor');
    } else if (category === 'creditor') {
      results = results.filter(l => l.category === 'creditor');
    }

    // Filter by search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.gstin && l.gstin.toLowerCase().includes(q)) ||
        (l.mobile && l.mobile.includes(q)) ||
        (l.state && l.state.toLowerCase().includes(q))
      );
    }

    // Sort by name
    results.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      status: 'ok',
      totalCount: results.length,
      ledgers: results
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Single Party Running Ledger Statement
app.get('/api/ledgers/:partyName', (req, res) => {
  try {
    const rawPartyName = decodeURIComponent(req.params.partyName).trim();
    const { fromDate, toDate, source } = req.query;

    const { ledgers, vouchers } = getTallyData();
    const manualTxns = getAllManualTransactions().filter(t => t.status !== 'cancelled');

    // Find party in Tally or Manual with fuzzy matching
    const matchedLedger = ledgers.find(l => partyNamesMatch(l.name, rawPartyName));
    const canonicalName = matchedLedger ? matchedLedger.name : rawPartyName;

    const party = matchedLedger || {
      id: `PARTY-${canonicalName}`,
      name: canonicalName,
      category: 'debtor',
      isDebtor: true,
      isCreditor: false,
      openingBalance: 0,
      currentOutstanding: 0,
      balanceType: 'Dr',
      gstin: '',
      mobile: '',
      address: '',
      source: 'manual'
    };

    const isDebtor = party.category === 'debtor' || party.isDebtor;
    const isCreditor = party.category === 'creditor' || party.isCreditor;

    // 1. Gather all transactions for this party
    const partyRows = [];

    // Tally Vouchers
    if (source !== 'manual') {
      vouchers.forEach(v => {
        const matchesParty =
          partyNamesMatch(v.partyName, canonicalName) ||
          (v.ledgerEntries && v.ledgerEntries.some(le => partyNamesMatch(le.ledgerName, canonicalName)));

        if (matchesParty) {
          let billsAmt = 0;
          let paymentAmt = 0;
          let particularText = `${v.voucherType} #${v.voucherNumber}`;

          if (isDebtor) {
            // Debtors Bahi Khata:
            // CR (Bills) increases receivable
            // DR (Payment) decreases receivable
            if (v.voucherType === 'Sales') {
              billsAmt = v.amount;
              particularText = `Sales Bill #${v.voucherNumber}`;
            } else if (v.voucherType === 'Receipt') {
              paymentAmt = v.amount;
              particularText = `Receipt / Payment Received`;
            } else if (v.voucherType === 'Payment') {
              // Payment/Refund to customer debits customer (increases receivable or reduces advance)
              billsAmt = v.amount;
              particularText = `Payment / Refund #${v.voucherNumber}`;
            } else if (v.voucherType === 'Credit Note') {
              paymentAmt = v.amount; // decreases what debtor owes
              particularText = `Credit Note #${v.voucherNumber}`;
            } else if (v.voucherType === 'Debit Note') {
              billsAmt = v.amount; // increases what debtor owes
              particularText = `Debit Note #${v.voucherNumber}`;
            } else if (v.voucherType === 'Journal') {
              // Journal check party entry
              const entry = v.ledgerEntries?.find(le => partyNamesMatch(le.ledgerName, canonicalName));
              if (entry && entry.isDeemedPositive) billsAmt = Math.abs(entry.amount);
              else if (entry) paymentAmt = Math.abs(entry.amount);
            }
          } else {
            // Creditors Bahi Khata:
            // DR (Purchases) increases payable
            // CR (Payment) decreases payable
            if (v.voucherType === 'Purchase') {
              billsAmt = v.amount; // Purchases
              particularText = `Purchase Bill #${v.voucherNumber}`;
            } else if (v.voucherType === 'Payment') {
              paymentAmt = v.amount; // Payment made
              particularText = `Payment Made`;
            } else if (v.voucherType === 'Receipt') {
              // Refund from supplier decreases payable
              paymentAmt = v.amount;
              particularText = `Receipt / Refund #${v.voucherNumber}`;
            } else if (v.voucherType === 'Debit Note') {
              paymentAmt = v.amount; // decreases payable
              particularText = `Debit Note #${v.voucherNumber}`;
            } else if (v.voucherType === 'Credit Note') {
              billsAmt = v.amount; // increases payable
              particularText = `Credit Note #${v.voucherNumber}`;
            } else if (v.voucherType === 'Journal') {
              const entry = v.ledgerEntries?.find(le => partyNamesMatch(le.ledgerName, canonicalName));
              if (entry && !entry.isDeemedPositive) billsAmt = Math.abs(entry.amount);
              else if (entry) paymentAmt = Math.abs(entry.amount);
            }
          }

          partyRows.push({
            id: v.id,
            date: v.date,
            type: v.voucherType,
            reference: v.voucherNumber || v.reference,
            supplierRef: v.reference || '',
            particulars: particularText,
            narration: v.narration || '',
            bills: billsAmt,
            payment: paymentAmt,
            amount: v.amount,
            source: 'tally',
            status: 'active',
            inventory: v.inventoryEntries || []
          });
        }
      });
    }

    // Manual Transactions
    if (source !== 'tally') {
      manualTxns.forEach(t => {
        if (t.partyName && partyNamesMatch(t.partyName, canonicalName)) {
          let billsAmt = 0;
          let paymentAmt = 0;

          if (isDebtor) {
            if (['sales_bill', 'debit_note', 'payment', 'cash_payment', 'bank_payment'].includes(t.type)) {
              billsAmt = t.amount;
            } else if (['receipt', 'cash_receipt', 'bank_receipt', 'credit_note'].includes(t.type)) {
              paymentAmt = t.amount;
            }
          } else {
            if (['purchase_bill', 'credit_note'].includes(t.type)) {
              billsAmt = t.amount;
            } else if (['payment', 'cash_payment', 'bank_payment', 'debit_note'].includes(t.type)) {
              paymentAmt = t.amount;
            }
          }

          partyRows.push({
            id: t.id,
            date: t.date,
            type: t.type,
            reference: t.reference || '',
            particulars: t.particulars || `${t.type} recorded`,
            narration: t.remarks || '',
            bills: billsAmt,
            payment: paymentAmt,
            amount: t.amount,
            source: 'manual',
            status: t.status,
            paymentMode: t.paymentMode,
            history: t.history || []
          });
        }
      });
    }

    // 2. Sort chronologically
    partyRows.sort((a, b) => {
      const cmp = (a.date || '').localeCompare(b.date || '');
      if (cmp !== 0) return cmp;
      return (a.id || '').localeCompare(b.id || '');
    });

    // 3. Running Balance Calculation
    let runningBalance = Math.abs(party.openingBalance || 0);
    if ((isDebtor && party.balanceType === 'Cr') || (isCreditor && party.balanceType === 'Dr')) {
      runningBalance = -runningBalance;
    }
    let totalBills = 0;
    let totalPayments = 0;

    const statementRows = partyRows.map(row => {
      totalBills += row.bills;
      totalPayments += row.payment;

      // Both Debtor and Creditor:
      // runningBalance = previous + additions (bills) - deductions (payment)
      runningBalance = Math.round((runningBalance + row.bills - row.payment) * 100) / 100;

      const balanceType = isDebtor
        ? (runningBalance >= 0 ? 'Dr' : 'Cr')
        : (runningBalance >= 0 ? 'Cr' : 'Dr');

      return {
        ...row,
        balance: Math.abs(runningBalance),
        balanceSigned: runningBalance,
        balanceType
      };
    });

    // 4. Filter by Date range if requested
    let filteredStatement = statementRows;
    if (fromDate) filteredStatement = filteredStatement.filter(r => r.date >= fromDate);
    if (toDate) filteredStatement = filteredStatement.filter(r => r.date <= toDate);

    // 5. Generate Standardized WhatsApp Payment Reminder (GEMINI.md Rule Compliant)
    let whatsappReminder = '';
    if (isDebtor) {
      // Find unpaid sales bills (or last 5 bills)
      const salesBills = partyRows.filter(r => r.bills > 0);
      const grossSubtotal = salesBills.reduce((sum, b) => sum + b.bills, 0);
      // Taxable value estimate @ 95% (standard GST rate on footwear)
      const taxableSubtotal = Math.round((grossSubtotal / 1.05) * 100) / 100;
      const cdDiscount = Math.round((taxableSubtotal * 0.05) * 100) / 100;
      const netPayable = Math.round((grossSubtotal - cdDiscount) * 100) / 100;

      const billLines = salesBills.map(b => `• #${b.reference || b.id.slice(-6)}: *${formatINR(b.bills)}*`).join('\n');

      whatsappReminder = [
        `Dear ${party.name},`,
        ``,
        `Please find the settlement details for your pending bills:`,
        ``,
        `📦 *${salesBills.length} Invoices:*`,
        billLines || `• Pending Balance: *${formatINR(Math.abs(runningBalance))}*`,
        `────────────────────────`,
        `*Total of ${salesBills.length} Bills: ${formatINR(grossSubtotal)}*`,
        `*Less: 5% CD on Taxable (${formatINR(taxableSubtotal)}): -${formatINR(cdDiscount)}*`,
        `👉 *Net for ${salesBills.length} Bills: ${formatINR(netPayable)}*`,
        `────────────────────────`,
        `*👉 TOTAL TO TRANSFER: ${formatINR(netPayable)}*`,
        `────────────────────────`,
        ``,
        `*Bank Details:*`,
        `SKIL LIFESTYLE LLP`,
        `Union Bank of India | Rayagada`,
        `A/c: *348621010000129*`,
        `IFSC: *UBIN0934861*`,
        ``,
        `Please process the transfer and share the screenshot so we can issue your CD credit note. Thank you! 🙏`
      ].join('\n');
    }

    res.json({
      status: 'ok',
      party: {
        ...party,
        isDebtor,
        isCreditor,
        calculatedClosingBalance: Math.abs(runningBalance),
        closingBalanceType: isDebtor ? (runningBalance >= 0 ? 'Dr' : 'Cr') : (runningBalance >= 0 ? 'Cr' : 'Dr'),
        totalBills: Math.round(totalBills * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        transactionsCount: partyRows.length
      },
      statement: filteredStatement,
      whatsappReminder
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 4. DAYBOOK APIS (DATE-WISE KHATA & DIARY)
// ============================================================================

// List all dates
app.get('/api/daybook/dates', (req, res) => {
  try {
    const daybookDates = daybookManager.listDates();
    const { vouchers } = getTallyData();

    // Group Tally vouchers by date
    const tallyDatesMap = {};
    vouchers.forEach(v => {
      if (!v.date) return;
      if (!tallyDatesMap[v.date]) {
        tallyDatesMap[v.date] = { count: 0, sales: 0, purchases: 0, receipts: 0, payments: 0 };
      }
      tallyDatesMap[v.date].count++;
      if (v.voucherType === 'Sales') tallyDatesMap[v.date].sales += v.amount;
      else if (v.voucherType === 'Purchase') tallyDatesMap[v.date].purchases += v.amount;
      else if (v.voucherType === 'Receipt') tallyDatesMap[v.date].receipts += v.amount;
      else if (v.voucherType === 'Payment') tallyDatesMap[v.date].payments += v.amount;
    });

    // Merge dates
    const allDateSet = new Set([
      ...daybookDates.map(d => d.date),
      ...Object.keys(tallyDatesMap)
    ]);

    const combinedList = Array.from(allDateSet).sort((a, b) => b.localeCompare(a)).map(dateStr => {
      const daybookInfo = daybookDates.find(d => d.date === dateStr);
      const tallyInfo = tallyDatesMap[dateStr] || { count: 0, sales: 0, purchases: 0, receipts: 0, payments: 0 };

      return {
        date: dateStr,
        manualTxnCount: daybookInfo?.transactionCount || 0,
        tallyTxnCount: tallyInfo.count,
        totalTxnCount: (daybookInfo?.transactionCount || 0) + tallyInfo.count,
        totalSales: Math.round(((daybookInfo?.totalSales || 0) + tallyInfo.sales) * 100) / 100,
        totalPurchases: Math.round(((daybookInfo?.totalPurchases || 0) + tallyInfo.purchases) * 100) / 100,
        totalReceipts: Math.round(((daybookInfo?.totalReceipts || 0) + tallyInfo.receipts) * 100) / 100,
        totalPayments: Math.round(((daybookInfo?.totalPayments || 0) + tallyInfo.payments) * 100) / 100,
        hasRemarks: daybookInfo?.hasRemarks || false,
        hasManual: daybookInfo?.hasManual || false
      };
    });

    res.json({
      status: 'ok',
      totalDates: combinedList.length,
      dates: combinedList
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Single Daybook Date Details
app.get('/api/daybook/:date', (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ status: 'error', message: 'Invalid date format. Expected YYYY-MM-DD.' });
    }

    const { vouchers, ledgers } = getTallyData();
    const manualTxns = daybookManager.getDayTransactions(date);
    const daySummary = daybookManager.getDaySummary(date) || {
      date,
      transactionCount: 0,
      activeCount: 0,
      totalSales: 0,
      totalPurchases: 0,
      totalReceipts: 0,
      totalPayments: 0,
      cashSummary: { inflow: 0, outflow: 0, net: 0 },
      bankSummary: { inflow: 0, outflow: 0, net: 0 }
    };

    const remarks = daybookManager.getDayRemarks(date);

    // Tally vouchers for that date
    const tallyForDate = vouchers.filter(v => v.date === date).map(v => {
      const isDebtor = ledgers.some(l => l.name === v.partyName && l.category === 'debtor');
      const isCreditor = ledgers.some(l => l.name === v.partyName && l.category === 'creditor');

      return {
        id: v.id,
        date: v.date,
        type: v.voucherType,
        partyName: v.partyName,
        partyType: isDebtor ? 'debtor' : isCreditor ? 'creditor' : 'other',
        particulars: `${v.voucherType} #${v.voucherNumber}`,
        reference: v.reference || v.voucherNumber,
        amount: v.amount,
        paymentMode: ['Receipt', 'Payment'].includes(v.voucherType) ? 'Bank' : 'Credit',
        narration: v.narration || '',
        source: 'tally',
        status: 'active',
        inventory: v.inventoryEntries || [],
        ledgerEntries: v.ledgerEntries || []
      };
    });

    // Combined list
    const combined = [
      ...manualTxns,
      ...tallyForDate
    ];

    res.json({
      status: 'ok',
      date,
      summary: daySummary,
      remarks,
      manualTransactions: manualTxns,
      tallyVouchers: tallyForDate,
      combinedTransactions: combined
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Update Daybook Remarks Diary
app.post('/api/daybook/:date/remarks', (req, res) => {
  try {
    const { date } = req.params;
    const { content } = req.body;
    daybookManager.saveDayRemarks(date, content || '');
    res.json({ status: 'ok', date, message: 'Remarks saved successfully.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 5. TRANSACTION MUTATION APIS (MANUAL KHATA ENTRIES)
// ============================================================================

app.post('/api/transactions/manual', (req, res) => {
  try {
    const newTxn = daybookManager.addTransaction(req.body);
    res.json({ status: 'ok', transaction: newTxn });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

app.put('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { author, reason, ...updates } = req.body;
    const updated = daybookManager.updateTransaction(id, updates, author || 'Sahil Kumar', reason || 'Manual update');
    res.json({ status: 'ok', transaction: updated });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

app.post('/api/transactions/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { author, reason } = req.body;
    const cancelled = daybookManager.cancelTransaction(id, author || 'Sahil Kumar', reason || 'Cancelled by user');
    res.json({ status: 'ok', transaction: cancelled });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 6. CALENDAR MATRIX & SEARCH
// ============================================================================

app.get('/api/calendar/:year/:month', (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    const calData = daybookManager.getCalendarData(year, month);

    // Overlay Tally stats
    const { vouchers } = getTallyData();
    calData.days.forEach(day => {
      const tallyForDay = vouchers.filter(v => v.date === day.date);
      tallyForDay.forEach(v => {
        day.transactionCount++;
        if (v.voucherType === 'Sales') day.totalSales += v.amount;
        else if (v.voucherType === 'Purchase') day.totalPurchases += v.amount;
        else if (v.voucherType === 'Receipt') day.totalReceipts += v.amount;
        else if (v.voucherType === 'Payment') day.totalPayments += v.amount;
      });
    });

    res.json({ status: 'ok', calendar: calData });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/search', (req, res) => {
  try {
    const { q, partyType, type, source, fromDate, toDate, minAmount, maxAmount } = req.query;
    const manualResults = daybookManager.search(q, { partyType, type, source, fromDate, toDate, minAmount, maxAmount });

    let tallyResults = [];
    if (source !== 'manual') {
      const { vouchers, ledgers } = getTallyData();
      const queryLower = (q || '').toLowerCase().trim();

      tallyResults = vouchers.filter(v => {
        if (fromDate && v.date < fromDate) return false;
        if (toDate && v.date > toDate) return false;
        if (minAmount && v.amount < parseFloat(minAmount)) return false;
        if (maxAmount && v.amount > parseFloat(maxAmount)) return false;

        const isDebtor = ledgers.some(l => l.name === v.partyName && l.category === 'debtor');
        const isCreditor = ledgers.some(l => l.name === v.partyName && l.category === 'creditor');
        const partyCategory = isDebtor ? 'debtor' : isCreditor ? 'creditor' : 'other';

        if (partyType && partyCategory !== partyType) return false;

        if (!queryLower) return true;

        return (
          (v.partyName && v.partyName.toLowerCase().includes(queryLower)) ||
          (v.voucherNumber && v.voucherNumber.toLowerCase().includes(queryLower)) ||
          (v.reference && v.reference.toLowerCase().includes(queryLower)) ||
          (v.narration && v.narration.toLowerCase().includes(queryLower)) ||
          String(v.amount).includes(queryLower)
        );
      }).map(v => ({
        id: v.id,
        date: v.date,
        type: v.voucherType,
        partyName: v.partyName,
        partyType: ledgers.some(l => l.name === v.partyName && l.category === 'debtor') ? 'debtor' : 'creditor',
        particulars: `${v.voucherType} #${v.voucherNumber}`,
        reference: v.reference || v.voucherNumber,
        amount: v.amount,
        paymentMode: ['Receipt', 'Payment'].includes(v.voucherType) ? 'Bank' : 'Credit',
        source: 'tally',
        status: 'active'
      }));
    }

    const combined = [...manualResults, ...tallyResults].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    res.json({
      status: 'ok',
      count: combined.length,
      results: combined
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 7. FINANCIAL REPORTS & AUDIT LOGS
// ============================================================================

app.get('/api/reports/:reportType', (req, res) => {
  try {
    const { reportType } = req.params;
    const { ledgers, vouchers } = getTallyData();
    const manualTxns = getAllManualTransactions().filter(t => t.status !== 'cancelled');

    if (reportType === 'debtors-outstanding') {
      const debtors = ledgers
        .filter(l => l.category === 'debtor')
        .map(d => ({
          name: d.name,
          balance: d.currentOutstanding || d.closingBalance || 0,
          type: d.balanceType || (d.closingBalance < 0 ? 'Dr' : 'Cr'),
          gstin: d.gstin,
          mobile: d.mobile,
          state: d.state,
          address: d.address
        }))
        .filter(d => d.balance > 0 && d.type === 'Dr')
        .sort((a, b) => b.balance - a.balance);

      const totalReceivable = debtors.reduce((sum, d) => sum + d.balance, 0);

      return res.json({
        status: 'ok',
        reportType,
        title: 'Sundry Debtors Outstanding Register',
        totalAmount: Math.round(totalReceivable * 100) / 100,
        recordsCount: debtors.length,
        records: debtors
      });
    }

    if (reportType === 'creditors-outstanding') {
      const creditors = ledgers
        .filter(l => l.category === 'creditor')
        .map(c => ({
          name: c.name,
          balance: c.currentOutstanding || c.closingBalance || 0,
          type: 'Cr',
          gstin: c.gstin,
          mobile: c.mobile,
          state: c.state,
          address: c.address
        }))
        .filter(c => c.balance > 0)
        .sort((a, b) => b.balance - a.balance);

      const totalPayable = creditors.reduce((sum, c) => sum + c.balance, 0);

      return res.json({
        status: 'ok',
        reportType,
        title: 'Sundry Creditors Outstanding Register',
        totalAmount: Math.round(totalPayable * 100) / 100,
        recordsCount: creditors.length,
        records: creditors
      });
    }

    if (reportType === 'daily-sales') {
      const sales = [];
      vouchers.filter(v => v.voucherType === 'Sales').forEach(v => {
        sales.push({
          date: v.date,
          invoiceNo: v.voucherNumber,
          reference: v.reference,
          partyName: v.partyName,
          amount: v.amount,
          source: 'tally'
        });
      });
      manualTxns.filter(t => t.type === 'sales_bill').forEach(t => {
        sales.push({
          date: t.date,
          invoiceNo: t.reference || t.id,
          reference: t.reference,
          partyName: t.partyName,
          amount: t.amount,
          source: 'manual'
        });
      });
      sales.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const total = sales.reduce((s, r) => s + r.amount, 0);

      return res.json({
        status: 'ok',
        reportType,
        title: 'Sales Register',
        totalAmount: Math.round(total * 100) / 100,
        recordsCount: sales.length,
        records: sales
      });
    }

    if (reportType === 'daily-purchases') {
      const purchases = [];
      vouchers.filter(v => v.voucherType === 'Purchase').forEach(v => {
        purchases.push({
          date: v.date,
          billNo: v.voucherNumber,
          reference: v.reference,
          partyName: v.partyName,
          amount: v.amount,
          source: 'tally'
        });
      });
      manualTxns.filter(t => t.type === 'purchase_bill').forEach(t => {
        purchases.push({
          date: t.date,
          billNo: t.reference || t.id,
          reference: t.reference,
          partyName: t.partyName,
          amount: t.amount,
          source: 'manual'
        });
      });
      purchases.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const total = purchases.reduce((s, r) => s + r.amount, 0);

      return res.json({
        status: 'ok',
        reportType,
        title: 'Purchase Register',
        totalAmount: Math.round(total * 100) / 100,
        recordsCount: purchases.length,
        records: purchases
      });
    }

    if (reportType === 'audit-trail') {
      const auditRecords = [];
      const allTxns = getAllManualTransactions();
      allTxns.forEach(t => {
        if (t.history && t.history.length > 0) {
          t.history.forEach(h => {
            auditRecords.push({
              transactionId: t.id,
              date: t.date,
              partyName: t.partyName,
              modifiedAt: h.modifiedAt,
              modifiedBy: h.modifiedBy,
              reason: h.reason,
              previousState: h.previousState,
              currentState: {
                particulars: t.particulars,
                amount: t.amount,
                status: t.status
              }
            });
          });
        }
      });

      auditRecords.sort((a, b) => (b.modifiedAt || '').localeCompare(a.modifiedAt || ''));

      return res.json({
        status: 'ok',
        reportType,
        title: 'Manual Khata Audit Trail',
        recordsCount: auditRecords.length,
        records: auditRecords
      });
    }

    res.status(400).json({ status: 'error', message: `Unknown report type "${reportType}".` });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// 8. BACKUP & RESTORE APIS
// ============================================================================

app.get('/api/backups', (req, res) => {
  try {
    const list = backupManager.listBackups();
    res.json({ status: 'ok', backups: list });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/backups', (req, res) => {
  try {
    const label = req.body?.label || 'manual';
    const meta = backupManager.createBackup(label);
    res.json({ status: 'ok', backup: meta });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, '127.0.0.1', () => {
  console.log(`=======================================================`);
  console.log(` SKIL LEDGER — DIGITAL MANUAL BAHI KHATA SERVER`);
  console.log(` Server running at: http://127.0.0.1:${PORT}`);
  console.log(` Tally XML Bridge:  http://${tallySync.host}:${tallySync.port}`);
  console.log(` Company:           ${settings.company?.name || 'SKIL LIFESTYLE LLP'}`);
  console.log(`=======================================================`);
});
