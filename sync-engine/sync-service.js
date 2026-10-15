const TallyClient = require('./tally-client');
const normalizer = require('./normalizer');
const db = require('./database');
const folderUpdater = require('./folder-updater');

class SyncService {
  constructor() {
    this.client = new TallyClient();
    this.isSyncing = false;
    this.timer = null;
  }

  // Initialize and restore auto-sync if previously enabled
  init() {
    const state = db.getState();
    if (state.autoSyncEnabled) {
      this.startAutoSync(state.autoSyncIntervalSec || 30);
    }
  }

  async runSync({ full = false } = {}) {
    if (this.isSyncing) {
      return { status: 'busy', message: 'A sync cycle is already in progress.' };
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const syncType = full ? 'full' : 'incremental';

    try {
      // 1. Handshake & Health Check
      const healthXml = await this.client.checkHealth();
      const companies = normalizer.normalizeCompanies(healthXml);
      
      if (companies.length === 0) {
        throw new Error('No company is currently open in Tally. Please open SKIL LIFESTYLE LLP in TallyPrime first.');
      }

      let companyName = db.getState().activeCompany;
      const match = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
      if (match) {
        companyName = match.name;
      } else {
        companyName = companies[0].name;
      }
      db.saveState({ activeCompany: companyName });

      // 2. Fetch Company Info
      try {
        const infoXml = await this.client.getCompanyInfo(companyName);
        const info = normalizer.normalizeCompanyInfo(infoXml);
        if (info) {
          db.saveState({ companyInfo: info });
        }
      } catch (err) {
        console.warn('Could not fetch company info:', err.message);
      }

      if (full) {
        db.resetCursors();
      }

      const state = db.getState();
      const minMasterAlter = full ? 0 : (state.lastMasterAlterId || 0);
      const minStockAlter = full ? 0 : (state.lastStockAlterId || 0);
      const minVoucherAlter = full ? 0 : (state.lastVoucherAlterId || 0);

      // 3. Fetch Units and Groups on full sync or if empty
      if (full || db.units.length === 0) {
        try {
          const unitsXml = await this.client.getUnits(companyName);
          const units = normalizer.normalizeUnits(unitsXml);
          db.saveUnits(units);

          const groupsXml = await this.client.getGroups(companyName);
          const groups = normalizer.normalizeGroups(groupsXml);
          db.saveGroups(groups);
        } catch (err) {
          console.warn('Could not fetch units/groups:', err.message);
        }
      }

      // 4. Fetch Ledgers (Incremental)
      const ledgersXml = await this.client.getLedgers(companyName, minMasterAlter);
      const rawLedgers = normalizer.normalizeLedgers(ledgersXml);
      const ledgersResult = db.upsertLedgers(rawLedgers);

      // 5. Fetch Stock Items (Incremental)
      const stockXml = await this.client.getStockItems(companyName, minStockAlter);
      const rawStock = normalizer.normalizeStockItems(stockXml);
      const stockResult = db.upsertStockItems(rawStock);

      // 6. Fetch Vouchers (Incremental)
      const vouchersXml = await this.client.getVouchers(companyName, minVoucherAlter);
      const rawVouchers = normalizer.normalizeVouchers(vouchersXml);
      const vouchersResult = db.upsertVouchers(rawVouchers);

      const durationMs = Date.now() - startTime;
      const totalNew = ledgersResult.count + stockResult.count + vouchersResult.count;

      if (vouchersResult.count > 0 || full) {
        this.triggerAjantaDiscountExcelUpdate();
      }

      db.saveState({
        lastSyncTimestamp: new Date().toISOString(),
        totalSyncRuns: (state.totalSyncRuns || 0) + 1
      });

      // Update Tally Files snapshot and update all folder timestamps
      let folderUpdates = [];
      try {
        folderUpdates = folderUpdater.updateAll();
      } catch (fErr) {
        console.warn('[SyncService] Could not update folder timestamps:', fErr.message);
      }

      const logEntry = {
        type: syncType,
        status: 'success',
        durationMs,
        company: companyName,
        fetched: {
          ledgers: ledgersResult.count,
          stockItems: stockResult.count,
          vouchers: vouchersResult.count
        },
        cursors: {
          masterAlterId: ledgersResult.maxAlterId,
          stockAlterId: stockResult.maxAlterId,
          voucherAlterId: vouchersResult.maxAlterId
        }
      };
      db.addLog(logEntry);

      return {
        status: 'success',
        type: syncType,
        company: companyName,
        durationMs,
        recordsUpdated: totalNew,
        details: logEntry.fetched,
        folders: folderUpdates,
        stats: db.getStats()
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      db.addLog({
        type: syncType,
        status: 'error',
        durationMs,
        error: err.message
      });
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  startAutoSync(intervalSec = 30) {
    this.stopAutoSync();
    const intervalMs = Math.max(5, intervalSec) * 1000;
    db.saveState({ autoSyncEnabled: true, autoSyncIntervalSec: intervalSec });

    this.timer = setInterval(async () => {
      try {
        await this.runSync({ full: false });
      } catch (err) {
        console.error('Auto-sync cycle error:', err.message);
      }
    }, intervalMs);

    console.log(`Auto-sync started with interval ${intervalSec}s`);
  }

  stopAutoSync() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    db.saveState({ autoSyncEnabled: false });
    console.log('Auto-sync stopped');
  }

  triggerAjantaDiscountExcelUpdate() {
    const { exec } = require('child_process');
    const path = require('path');
    const scriptPath = path.resolve('c:/Projects/SKIL Master/misc/SKIL Purchase Supplier Invoices/Processing_Scripts/generate_discount_excel.py');
    const cwd = path.resolve('c:/Projects/SKIL Master/misc/SKIL Purchase Supplier Invoices');
    exec(`python "${scriptPath}"`, { cwd }, (err, stdout, stderr) => {
      if (err) {
        console.warn('[SyncService] Could not auto-update Ajanta Excel:', err.message);
      } else {
        console.log('[SyncService] Auto-updated Ajanta discount Excel successfully.');
      }
    });
  }
}

module.exports = new SyncService();