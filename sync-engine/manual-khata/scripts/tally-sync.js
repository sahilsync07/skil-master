/**
 * ============================================================================
 * SKIL LEDGER — TALLY PRIME SYNC BRIDGE
 * Communicates with Tally Prime XML API (Port 9000), manages full & incremental sync,
 * and maintains dedicated tally-data/ storage with zero leakage into manual records.
 * ============================================================================
 */

const http = require('http');
const path = require('path');
const storage = require('./storage-manager');
const parser = require('./tally-parser');

const SETTINGS_PATH = path.resolve(__dirname, '../config/settings.json');
const TALLY_DATA_DIR = path.resolve(__dirname, '../tally-data');

class TallySyncBridge {
  constructor() {
    this.settings = storage.readJson(SETTINGS_PATH, {
      tally: {
        host: '127.0.0.1',
        port: 9000,
        timeoutMs: 10000,
        companyName: 'SKIL LIFESTYLE LLP',
        retryAttempts: 3
      }
    });

    this.host = this.settings.tally?.host || '127.0.0.1';
    this.port = this.settings.tally?.port || 9000;
    this.timeout = this.settings.tally?.timeoutMs || 10000;
    this.companyName = this.settings.tally?.companyName || 'SKIL LIFESTYLE LLP';
    this.retryAttempts = this.settings.tally?.retryAttempts || 3;
    this.isSyncing = false;
  }

  // Raw HTTP POST to Tally with auto-retry
  async post(xmlPayload) {
    let attempt = 0;
    let lastError = null;

    while (attempt < this.retryAttempts) {
      attempt++;
      try {
        return await this._executeRequest(xmlPayload);
      } catch (err) {
        lastError = err;
        if (err.message.includes('ECONNRESET') || err.message.includes('socket hang up') || err.message.includes('ECONNREFUSED')) {
          await new Promise(r => setTimeout(r, 150 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  _executeRequest(xmlPayload) {
    return new Promise((resolve, reject) => {
      const trimmed = (xmlPayload || '').trim();
      const payloadBuffer = Buffer.from(trimmed, 'utf-8');

      const req = http.request({
        hostname: this.host,
        port: this.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': payloadBuffer.length,
          'Connection': 'close'
        },
        timeout: this.timeout
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`Tally returned HTTP ${res.statusCode}: ${body.slice(0, 180)}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Tally request timed out after ${this.timeout}ms`));
      });

      req.on('error', (err) => {
        reject(new Error(`Tally connection error (${this.host}:${this.port}): ${err.message}`));
      });

      req.write(payloadBuffer);
      req.end();
    });
  }

  // Health check
  async checkHealth() {
    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CompanySummary</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CompanySummary">
            <TYPE>Company</TYPE>
            <FETCH>Name, BooksFrom, StartingFrom, CompanyNumber, GSTIN, StateName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
    const response = await this.post(xml);
    return parser.normalizeCompany(response);
  }

  // Fetch all Ledgers
  async fetchLedgers(minAlterId = 0) {
    const filterXml = minAlterId > 0 ? `<FILTER>AlterFilter</FILTER>` : '';
    const formulaXml = minAlterId > 0 ? `<SYSTEM TYPE="Formulae" NAME="AlterFilter">$AlterID > ${minAlterId}</SYSTEM>` : '';

    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SyncLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${this.companyName}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SyncLedgers">
            <TYPE>Ledger</TYPE>
            <FETCH>Name, Parent, OpeningBalance, ClosingBalance, PartyGSTIN, StateName, PriorStateName, Email, MobileNo, LedgerMobile, LedgerPhone, Pincode, AlterID, Guid, LedGSTRegDetails.*, LedMailingDetails.*, ContactDetails.*</FETCH>
            ${filterXml}
          </COLLECTION>
          ${formulaXml}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const response = await this.post(xml);
    return parser.normalizeLedgers(response);
  }

  // Fetch all Vouchers
  async fetchVouchers(minAlterId = 0) {
    const filterXml = minAlterId > 0 ? `<FILTER>AlterFilter</FILTER>` : '';
    const formulaXml = minAlterId > 0 ? `<SYSTEM TYPE="Formulae" NAME="AlterFilter">$AlterID > ${minAlterId}</SYSTEM>` : '';

    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SyncVouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${this.companyName}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SyncVouchers">
            <TYPE>Voucher</TYPE>
            <FETCH>Date, EffectiveDate, VoucherTypeName, VoucherNumber, Reference, PartyLedgerName, Amount, Narration, AlterID, Guid, MasterID, AllLedgerEntries.*, AllInventoryEntries.*</FETCH>
            ${filterXml}
          </COLLECTION>
          ${formulaXml}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const response = await this.post(xml);
    return parser.normalizeVouchers(response);
  }

  // Run Synchronization
  async runSync({ full = false } = {}) {
    if (this.isSyncing) {
      return { status: 'busy', message: 'A synchronization is already in progress.' };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    const lastSyncFile = path.join(TALLY_DATA_DIR, 'last-sync.json');
    const existingSync = storage.readJson(lastSyncFile, {
      lastSyncTimestamp: null,
      lastMasterAlterId: 0,
      lastVoucherAlterId: 0,
      syncRuns: 0
    });

    try {
      console.log(`[TallySync] Initiating ${full ? 'FULL' : 'INCREMENTAL'} sync with TallyPrime (${this.companyName})...`);

      // 1. Health check & Company validation
      const companyInfo = await this.checkHealth();
      if (!companyInfo || !companyInfo.name) {
        throw new Error('Unable to connect to active Tally company. Please ensure Tally Prime is running.');
      }
      console.log(`[TallySync] Connected to Company: ${companyInfo.name}`);

      // 2. Fetch Ledgers
      const minMasterAlterId = full ? 0 : (existingSync.lastMasterAlterId || 0);
      const incomingLedgers = await this.fetchLedgers(minMasterAlterId);
      console.log(`[TallySync] Received ${incomingLedgers.length} ledger records from Tally.`);

      // 3. Fetch Vouchers
      const minVoucherAlterId = full ? 0 : (existingSync.lastVoucherAlterId || 0);
      const incomingVouchers = await this.fetchVouchers(minVoucherAlterId);
      console.log(`[TallySync] Received ${incomingVouchers.length} vouchers from Tally.`);

      // 4. Load & Merge Data in tally-data/
      const masterFile = path.join(TALLY_DATA_DIR, 'tally-master.json');
      const ledgersFile = path.join(TALLY_DATA_DIR, 'tally-ledgers.json');
      const vouchersFile = path.join(TALLY_DATA_DIR, 'tally-vouchers.json');

      let currentLedgers = full ? {} : (storage.readJson(ledgersFile, {}));
      let currentVouchers = full ? {} : (storage.readJson(vouchersFile, {}));

      let maxMasterAlterId = existingSync.lastMasterAlterId || 0;
      let maxVoucherAlterId = existingSync.lastVoucherAlterId || 0;

      // Upsert Ledgers (Keyed by party name for fast lookup)
      incomingLedgers.forEach(l => {
        currentLedgers[l.name] = l;
        if (l.alterId > maxMasterAlterId) maxMasterAlterId = l.alterId;
      });

      // Upsert Vouchers (Keyed by stable ID to prevent duplicates)
      incomingVouchers.forEach(v => {
        currentVouchers[v.id] = v;
        if (v.alterId > maxVoucherAlterId) maxVoucherAlterId = v.alterId;
      });

      // 5. Persist to tally-data/
      storage.writeJson(masterFile, companyInfo);
      storage.writeJson(ledgersFile, currentLedgers);
      storage.writeJson(vouchersFile, currentVouchers);

      const allLedgersList = Object.values(currentLedgers);
      const allVouchersList = Object.values(currentVouchers);

      // Voucher Breakdown
      const voucherBreakdown = {};
      allVouchersList.forEach(v => {
        voucherBreakdown[v.voucherType] = (voucherBreakdown[v.voucherType] || 0) + 1;
      });

      const syncResult = {
        status: 'success',
        type: full ? 'full' : 'incremental',
        company: companyInfo.name,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        recordsUpdated: {
          ledgers: incomingLedgers.length,
          vouchers: incomingVouchers.length
        },
        totals: {
          totalLedgers: allLedgersList.length,
          totalDebtors: allLedgersList.filter(l => l.isDebtor).length,
          totalCreditors: allLedgersList.filter(l => l.isCreditor).length,
          totalVouchers: allVouchersList.length,
          breakdown: voucherBreakdown
        },
        cursors: {
          lastMasterAlterId: maxMasterAlterId,
          lastVoucherAlterId: maxVoucherAlterId
        },
        syncRuns: (existingSync.syncRuns || 0) + 1
      };

      storage.writeJson(lastSyncFile, syncResult);
      console.log(`[TallySync] Sync completed in ${syncResult.durationMs}ms. Vouchers: ${allVouchersList.length}, Ledgers: ${allLedgersList.length}.`);

      return syncResult;
    } catch (err) {
      console.error('[TallySync] Sync Error:', err.message);
      const errorLog = {
        status: 'error',
        error: err.message,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime
      };
      storage.writeJson(lastSyncFile, { ...existingSync, lastError: errorLog });
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  // Get current snapshot
  getSnapshot() {
    const masterFile = path.join(TALLY_DATA_DIR, 'tally-master.json');
    const ledgersFile = path.join(TALLY_DATA_DIR, 'tally-ledgers.json');
    const vouchersFile = path.join(TALLY_DATA_DIR, 'tally-vouchers.json');
    const lastSyncFile = path.join(TALLY_DATA_DIR, 'last-sync.json');

    return {
      master: storage.readJson(masterFile, null),
      ledgers: Object.values(storage.readJson(ledgersFile, {})),
      vouchers: Object.values(storage.readJson(vouchersFile, {})),
      lastSync: storage.readJson(lastSyncFile, null)
    };
  }
}

const bridge = new TallySyncBridge();

// CLI invocation support
if (require.main === module) {
  const isFull = process.argv.includes('--full');
  bridge.runSync({ full: isFull })
    .then(r => console.log('CLI Sync Result:', JSON.stringify(r, null, 2)))
    .catch(e => {
      console.error('CLI Sync Failed:', e.message);
      process.exit(1);
    });
}

module.exports = bridge;
