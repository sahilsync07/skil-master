const fs = require('fs');
const path = require('path');
const agingService = require('./aging-service');
const { pushAllToSupabase } = require('./supabase-sync');

const ROOT = path.resolve(__dirname, '..');
const MK_TALLY = path.join(__dirname, 'manual-khata', 'tally-data');
const MK_DAYBOOK = path.join(__dirname, 'manual-khata', 'daybook');

const CLIENT_DATA_DIRS = [
  path.join(ROOT, 'web', 'data'),
  path.join(ROOT, 'android-app', 'www', 'data'),
  path.join(__dirname, 'public', 'data')
];

function extractCleanCity(ledger) {
  const addr = ledger.address || '';
  const name = ledger.name || '';
  const state = ledger.state || '';

  const cityMatch = addr.match(/City\/Town\/Village\s*:\s*([^,\n]+)/i);
  if (cityMatch && cityMatch[1].trim()) return cityMatch[1].trim();

  const knownCities = [
    'Rayagada', 'Malkangiri', 'Parvathipuram', 'Parvatipuram', 'Srikakulam',
    'Vizianagaram', 'Visakhapatnam', 'Rajamahendravaram', 'Rajahmundry',
    'Anakapalli', 'Dhenkanal', 'Sarang', 'Jajpur Road', 'Jajpur',
    'Brajrajnagar', 'Jharsuguda', 'Nayagarh', 'Rajam', 'Kozhikode', 'Kolkata'
  ];
  for (const c of knownCities) {
    if (addr.toLowerCase().includes(c.toLowerCase()) || name.toLowerCase().includes(c.toLowerCase())) {
      if (c === 'Parvatipuram') return 'Parvathipuram';
      if (c === 'Rajamahendravaram') return 'Rajahmundry';
      return c;
    }
  }
  return state || 'Odisha';
}

function toCompactDate(d) {
  if (!d) return '';
  return String(d).replace(/-/g, '').slice(0, 8);
}

function toIsoDate(d) {
  const s = toCompactDate(d);
  if (s.length !== 8) return '';
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function formatReadableDate(iso) {
  if (!iso || iso.length < 10) return iso || '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const y = iso.slice(0, 4);
  const m = parseInt(iso.slice(5, 7), 10) - 1;
  const d = iso.slice(8, 10);
  return `${d}-${months[m] || iso.slice(5, 7)}-${y}`;
}

function addDaysIso(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function build45DayStatement(ledgersList, vouchersList, groupParent = 'Sundry Debtors', endIso = '2026-11-12') {
  const startIso = addDaysIso(endIso, -45); // Fixed past 45 days window
  const parties = ledgersList.filter(l => l.parent === groupParent);

  const rows = parties.map(p => {
    const pVchs = vouchersList.filter(v =>
      (v.partyName && v.partyName.toLowerCase() === p.name.toLowerCase()) ||
      (v.ledgerEntries || []).some(le => le.ledgerName && le.ledgerName.toLowerCase() === p.name.toLowerCase())
    ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Determine opening balance before Tally book start (raw openingBalance: negative = Dr)
    const rawBookOpen = Number(p.openingBalance) || 0;
    let preDr = rawBookOpen < 0 ? Math.abs(rawBookOpen) : 0;
    let preCr = rawBookOpen > 0 ? rawBookOpen : 0;

    const preBills = [];
    const windowBills = [];
    const windowPayments = [];

    for (const v of pVchs) {
      const iso = toIsoDate(v.date);
      const entries = (v.ledgerEntries || []).filter(
        le => le.ledgerName && le.ledgerName.toLowerCase() === p.name.toLowerCase()
      );

      // In Tally: rawAmount < 0 is Dr (deemedPositive=true); > 0 is Cr.
      let deltaDr = 0;
      if (entries.length > 0) {
        for (const le of entries) {
          if (le.rawAmount !== undefined) {
            deltaDr += -(Number(le.rawAmount) || 0);
          } else {
            const sign = le.isDeemedPositive ? 1 : -1;
            deltaDr += sign * Math.abs(Number(le.amount) || 0);
          }
        }
      } else {
        const amt = Number(v.amount) || 0;
        const isDr = v.voucherType === 'Sales' || v.voucherType === 'Payment' || v.voucherType === 'Debit Note';
        deltaDr = isDr ? amt : -amt;
      }

      // Normalize from party perspective:
      // For Debtor: positive net = Customer owes SKIL (Dr - Cr)
      // For Creditor: positive net = SKIL owes Supplier (Cr - Dr)
      const signedImpact = groupParent === 'Sundry Debtors' ? deltaDr : -deltaDr;

      // Detect bank/cash mode hint for receipts/payments
      const otherLedger = (v.ledgerEntries || []).find(
        le => le.ledgerName && le.ledgerName.toLowerCase() !== p.name.toLowerCase()
      )?.ledgerName || '';
      const nar = v.narration || '';
      let modeHint = '';
      if (/upi/i.test(nar)) modeHint = 'UPI';
      else if (/rtgs|neft|imps/i.test(nar)) modeHint = 'NEFT/RTGS';
      else if (/cash discount|cd/i.test(nar) && v.voucherType.includes('Note')) modeHint = '5% CD';
      else if (/cash/i.test(otherLedger)) modeHint = 'Cash';
      else if (/union bank/i.test(otherLedger)) modeHint = 'Bank';

      const ctnMatch = nar.match(/(\d+)\s*(?:CTN|BOX|CS|CARTON)/i);
      const cartons = ctnMatch ? parseInt(ctnMatch[1], 10) : null;

      if (iso < startIso) {
        if (signedImpact > 0) {
          preDr += signedImpact;
          preBills.push({
            date: iso,
            voucherType: v.voucherType,
            voucherNumber: v.voucherNumber,
            originalAmount: Math.round(signedImpact * 100) / 100,
            remainingAmount: Math.round(signedImpact * 100) / 100,
            cartons
          });
        } else if (signedImpact < 0) {
          preCr += Math.abs(signedImpact);
        }
      } else if (iso <= endIso) {
        if (signedImpact > 0) {
          windowBills.push({
            date: iso,
            voucherType: v.voucherType,
            voucherNumber: v.voucherNumber,
            amount: Math.round(signedImpact * 100) / 100,
            cartons,
            narration: nar
          });
        } else if (signedImpact < 0) {
          windowPayments.push({
            date: iso,
            voucherType: v.voucherType,
            voucherNumber: v.voucherNumber,
            amount: Math.round(Math.abs(signedImpact) * 100) / 100,
            modeHint,
            narration: nar
          });
        }
      }
    }

    // Account-level Opening Balance (as of startIso)
    const preNetOpening = Math.round((preDr - preCr) * 100) / 100;

    // FIFO match preCr against preBills so unpaid pre-window bills sum exactly to Opening Balance
    let creditPool = preCr;
    for (const b of preBills) {
      if (creditPool <= 0) break;
      const alloc = Math.min(b.remainingAmount, creditPool);
      b.remainingAmount = Math.round((b.remainingAmount - alloc) * 100) / 100;
      creditPool = Math.round((creditPool - alloc) * 100) / 100;
    }

    const openingBills = preBills.filter(b => b.remainingAmount > 0.01);
    const billsTotal45d = Math.round(windowBills.reduce((s, b) => s + b.amount, 0) * 100) / 100;
    const paymentsTotal45d = Math.round(windowPayments.reduce((s, c) => s + c.amount, 0) * 100) / 100;
    const closingBalance = Math.round((preNetOpening + billsTotal45d - paymentsTotal45d) * 100) / 100;

    return {
      partyName: p.name,
      city: p.city || extractCleanCity(p),
      state: p.state || '',
      gstin: p.gstin || '',
      mobile: p.mobile || '',
      openingBalance: preNetOpening,
      openingBills,
      openingBillsSum: Math.round(openingBills.reduce((s, b) => s + b.remainingAmount, 0) * 100) / 100,
      bills45d: windowBills,
      billsTotal45d,
      payments45d: windowPayments,
      paymentsTotal45d,
      closingBalance
    };
  });

  // Sort by Closing Balance descending, keeping active accounts first
  rows.sort((a, b) => b.closingBalance - a.closingBalance);

  return {
    company: 'SKIL LIFESTYLE LLP',
    location: 'Rayagada, Odisha',
    group: groupParent,
    periodStartIso: startIso,
    periodEndIso: endIso,
    periodLabel: `${startIso.split('-').reverse().join('/')} to ${endIso.split('-').reverse().join('/')}`,
    durationDays: 45,
    generatedAt: new Date().toISOString(),
    rows
  };
}

async function main() {
  console.log('=== SKIL Master Unified Data Sync (v221 Vouchers + 45 Ledgers) ===');

  const mkVouchersRaw = JSON.parse(fs.readFileSync(path.join(MK_TALLY, 'tally-vouchers.json'), 'utf8'));
  const mkLedgersRaw = JSON.parse(fs.readFileSync(path.join(MK_TALLY, 'tally-ledgers.json'), 'utf8'));
  const mkSyncMeta = JSON.parse(fs.readFileSync(path.join(MK_TALLY, 'last-sync.json'), 'utf8'));
  const syncVouchersExisting = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'vouchers.json'), 'utf8'));

  // Index sync-engine raw fields by GUID so we keep sync-engine/data intact while adding latest vouchers
  const rawLookup = new Map();
  Object.values(syncVouchersExisting).forEach(sv => {
    rawLookup.set(sv.id, sv);
  });

  const syncEngineVouchersMap = {};
  const clientVouchersList = [];

  const mkVchArray = Object.values(mkVouchersRaw).sort((a, b) =>
    toCompactDate(a.rawDate || a.date).localeCompare(toCompactDate(b.rawDate || b.date))
  );

  for (const v of mkVchArray) {
    const guid = v.guid || v.id.replace(/^TALLY-GUID-/, '');
    const compactDate = toCompactDate(v.rawDate || v.date);

    // Fix split-entry top-level amount cleanly if party entries exist
    const partyEntries = (v.ledgerEntries || []).filter(
      le => v.partyName && le.ledgerName && le.ledgerName.toLowerCase() === v.partyName.toLowerCase()
    );
    const fixedAmount = partyEntries.length > 0
      ? partyEntries.reduce((s, le) => s + (Math.abs(Number(le.amount)) || 0), 0)
      : (Number(v.amount) || 0);

    const normalizedClientVoucher = {
      id: guid,
      guid,
      date: compactDate,
      isoDate: toIsoDate(compactDate),
      voucherType: v.voucherType,
      voucherNumber: v.voucherNumber,
      reference: v.reference || '',
      partyName: v.partyName || '',
      amount: Math.round(fixedAmount * 100) / 100,
      narration: v.narration || '',
      alterId: v.alterId || 0,
      ledgerEntries: (v.ledgerEntries || []).map(le => ({
        ledgerName: le.ledgerName,
        amount: Number(le.amount) || 0,
        rawAmount: le.rawAmount !== undefined ? Number(le.rawAmount) : (le.isDeemedPositive ? -Math.abs(Number(le.amount) || 0) : Math.abs(Number(le.amount) || 0)),
        isDeemedPositive: !!le.isDeemedPositive,
        isPartyLedger: !!le.isPartyLedger
      })),
      inventoryEntries: (v.inventoryEntries || []).filter(ie => ie.stockItemName)
    };

    clientVouchersList.push(normalizedClientVoucher);

    const existing = rawLookup.get(guid);
    syncEngineVouchersMap[guid] = {
      ...normalizedClientVoucher,
      ...(existing?.raw ? { raw: existing.raw } : {})
    };
  }

  // Normalize Ledgers
  const syncEngineLedgersMap = {};
  const clientLedgersList = [];
  for (const l of Object.values(mkLedgersRaw)) {
    const city = extractCleanCity(l);
    const cleanLedger = {
      id: l.id || l.name,
      name: l.name,
      parent: l.parent || '',
      category: l.category || '',
      city,
      state: l.state || '',
      gstin: l.gstin || '',
      mobile: l.mobile || l.phone || '',
      address: l.address || '',
      openingBalance: Number(l.openingBalance) || 0,
      closingBalance: Number(l.closingBalance) || 0,
      currentOutstanding: Number(l.currentOutstanding) || 0,
      balanceType: l.balanceType || 'Dr',
      alterId: l.alterId || 0
    };
    clientLedgersList.push(cleanLedger);
    syncEngineLedgersMap[l.name] = cleanLedger;
  }

  // Write unified data into sync-engine/data/
  fs.writeFileSync(path.join(__dirname, 'data', 'vouchers.json'), JSON.stringify(syncEngineVouchersMap, null, 2));
  fs.writeFileSync(path.join(__dirname, 'data', 'ledgers.json'), JSON.stringify(syncEngineLedgersMap, null, 2));

  // Build Daybook Notes JSON from Manual Khata/daybook
  const daybookNotes = [];
  if (fs.existsSync(MK_DAYBOOK)) {
    const folders = fs.readdirSync(MK_DAYBOOK).sort().reverse();
    for (const folder of folders) {
      const folderPath = path.join(MK_DAYBOOK, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const remPath = path.join(folderPath, 'remarks.md');
      const txPath = path.join(folderPath, 'transactions.json');
      const remarks = fs.existsSync(remPath) ? fs.readFileSync(remPath, 'utf8') : '';
      let transactions = [];
      if (fs.existsSync(txPath)) {
        try { transactions = JSON.parse(fs.readFileSync(txPath, 'utf8')); } catch {}
      }
      daybookNotes.push({ date: folder, remarks, transactions });
    }
  }

  // Build updated status.json
  const statusObj = {
    tallyOnline: false,
    openCompanies: [{ name: 'SKIL LIFESTYLE LLP', isGstOn: true, numGstTaxUnit: 1 }],
    isCompanyLoaded: true,
    error: null,
    stats: {
      activeCompany: 'SKIL LIFESTYLE LLP',
      companyInfo: {
        name: 'SKIL LIFESTYLE LLP',
        startingFrom: '20260401',
        booksFrom: '20260401',
        gstin: '37AAYFS7178L1Z9',
        stateName: 'Andhra Pradesh'
      },
      lastSyncTimestamp: mkSyncMeta.timestamp || new Date().toISOString(),
      latestVoucherDate: clientVouchersList[clientVouchersList.length - 1]?.isoDate || '2026-11-10',
      totalSyncRuns: 22,
      cursors: {
        masterAlterId: mkSyncMeta.cursors?.lastMasterAlterId || 929,
        stockAlterId: 795,
        voucherAlterId: mkSyncMeta.cursors?.lastVoucherAlterId || 393
      },
      counts: {
        ledgers: clientLedgersList.length,
        stockItems: 362,
        vouchers: clientVouchersList.length,
        units: 3,
        groups: 28
      },
      voucherBreakdown: mkSyncMeta.totals?.breakdown || {},
      autoSync: { enabled: false, intervalSec: 30 }
    }
  };

  // Precompute 45-Day Statement snapshot (Debtors & Creditors) as of today 2026-11-12
  const statement45d = {
    debtors: build45DayStatement(clientLedgersList, clientVouchersList, 'Sundry Debtors', '2026-11-12'),
    creditors: build45DayStatement(clientLedgersList, clientVouchersList, 'Sundry Creditors', '2026-11-12')
  };

  // Write compact JSONs to all client directories
  const vouchersPayload = {
    total: clientVouchersList.length,
    lastUpdated: statusObj.stats.lastSyncTimestamp,
    items: clientVouchersList
  };

  for (const dir of CLIENT_DATA_DIRS) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'vouchers.json'), JSON.stringify(vouchersPayload));
    fs.writeFileSync(path.join(dir, 'ledgers.json'), JSON.stringify(clientLedgersList, null, 2));
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(statusObj, null, 2));
    fs.writeFileSync(path.join(dir, 'daybook-notes.json'), JSON.stringify(daybookNotes, null, 2));
    fs.writeFileSync(path.join(dir, 'statement-45d.json'), JSON.stringify(statement45d, null, 2));
    console.log('Updated client data dir:', dir);
  }

  // Re-run AgingService with fixed multi-line entry logic cleanly
  // Re-require fresh database after updating sync-engine/data/
  delete require.cache[require.resolve('./database')];
  delete require.cache[require.resolve('./aging-service')];
  const freshAging = require('./aging-service');
  const agingResult = freshAging.saveAgingFiles('2026-11-12');
  console.log('Recalculated Aging as of 2026-11-12 -> Debtors Outstanding:', agingResult.debtors.summary.totalOutstanding, 'Open Parties:', agingResult.debtors.summary.openPartiesCount);

  // Attempt Supabase Push
  console.log('\n=== Attempting Supabase Cloud Push ===');
  const supaRes = await pushAllToSupabase(path.join(ROOT, 'web', 'data'));
  console.log('Supabase result:', JSON.stringify(supaRes, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
