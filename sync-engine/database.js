const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  state: path.join(DATA_DIR, 'state.json'),
  ledgers: path.join(DATA_DIR, 'ledgers.json'),
  stockItems: path.join(DATA_DIR, 'stock_items.json'),
  vouchers: path.join(DATA_DIR, 'vouchers.json'),
  units: path.join(DATA_DIR, 'units.json'),
  groups: path.join(DATA_DIR, 'groups.json'),
  logs: path.join(DATA_DIR, 'sync_logs.json')
};

function readJson(file, defaultVal) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
  return defaultVal;
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${file}:`, err.message);
  }
}

class Database {
  constructor() {
    this.state = readJson(FILES.state, {
      activeCompany: 'SKIL LIFESTYLE LLP',
      companyInfo: null,
      lastMasterAlterId: 0,
      lastStockAlterId: 0,
      lastVoucherAlterId: 0,
      lastSyncTimestamp: null,
      totalSyncRuns: 0,
      autoSyncEnabled: false,
      autoSyncIntervalSec: 30
    });

    this.ledgers = readJson(FILES.ledgers, {});
    this.stockItems = readJson(FILES.stockItems, {});
    this.vouchers = readJson(FILES.vouchers, {});
    this.units = readJson(FILES.units, []);
    this.groups = readJson(FILES.groups, []);
    this.logs = readJson(FILES.logs, []);
  }

  getState() {
    return { ...this.state };
  }

  saveState(updates) {
    this.state = { ...this.state, ...updates };
    writeJson(FILES.state, this.state);
  }

  resetCursors() {
    this.saveState({
      lastMasterAlterId: 0,
      lastStockAlterId: 0,
      lastVoucherAlterId: 0
    });
  }

  upsertLedgers(list) {
    let updatedCount = 0;
    let maxAlterId = this.state.lastMasterAlterId;

    list.forEach(item => {
      if (item.name) {
        this.ledgers[item.name] = item;
        updatedCount++;
        if (item.alterId > maxAlterId) {
          maxAlterId = item.alterId;
        }
      }
    });

    writeJson(FILES.ledgers, this.ledgers);
    this.saveState({ lastMasterAlterId: maxAlterId });
    return { count: updatedCount, maxAlterId };
  }

  upsertStockItems(list) {
    let updatedCount = 0;
    let maxAlterId = this.state.lastStockAlterId;

    list.forEach(item => {
      if (item.name) {
        this.stockItems[item.name] = item;
        updatedCount++;
        if (item.alterId > maxAlterId) {
          maxAlterId = item.alterId;
        }
      }
    });

    writeJson(FILES.stockItems, this.stockItems);
    this.saveState({ lastStockAlterId: maxAlterId });
    return { count: updatedCount, maxAlterId };
  }

  upsertVouchers(list) {
    let updatedCount = 0;
    let maxAlterId = this.state.lastVoucherAlterId;

    list.forEach(v => {
      if (v.id) {
        this.vouchers[v.id] = v;
        updatedCount++;
        if (v.alterId > maxAlterId) {
          maxAlterId = v.alterId;
        }
      }
    });

    writeJson(FILES.vouchers, this.vouchers);
    this.saveState({ lastVoucherAlterId: maxAlterId });
    return { count: updatedCount, maxAlterId };
  }

  saveUnits(units) {
    this.units = units;
    writeJson(FILES.units, this.units);
  }

  saveGroups(groups) {
    this.groups = groups;
    writeJson(FILES.groups, this.groups);
  }

  addLog(entry) {
    const log = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.logs.unshift(log);
    if (this.logs.length > 200) {
      this.logs = this.logs.slice(0, 200);
    }
    writeJson(FILES.logs, this.logs);
  }

  getStats() {
    const voucherList = Object.values(this.vouchers);
    const voucherTypeCounts = {};
    voucherList.forEach(v => {
      const type = v.voucherType || 'Other';
      voucherTypeCounts[type] = (voucherTypeCounts[type] || 0) + 1;
    });

    return {
      activeCompany: this.state.activeCompany,
      companyInfo: this.state.companyInfo,
      lastSyncTimestamp: this.state.lastSyncTimestamp,
      totalSyncRuns: this.state.totalSyncRuns,
      cursors: {
        masterAlterId: this.state.lastMasterAlterId,
        stockAlterId: this.state.lastStockAlterId,
        voucherAlterId: this.state.lastVoucherAlterId
      },
      counts: {
        ledgers: Object.keys(this.ledgers).length,
        stockItems: Object.keys(this.stockItems).length,
        vouchers: voucherList.length,
        units: this.units.length,
        groups: this.groups.length
      },
      voucherBreakdown: voucherTypeCounts,
      autoSync: {
        enabled: this.state.autoSyncEnabled,
        intervalSec: this.state.autoSyncIntervalSec
      }
    };
  }

  getLedgers({ search = '', group = '', limit = 100, page = 1 } = {}) {
    let list = Object.values(this.ledgers);
    if (group) {
      list = list.filter(l => l.parent.toLowerCase() === group.toLowerCase());
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(l => 
        l.name.toLowerCase().includes(s) || 
        (l.gstin && l.gstin.toLowerCase().includes(s)) ||
        (l.parent && l.parent.toLowerCase().includes(s))
      );
    }
    const total = list.length;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);
    return { total, page, limit, items: paginated };
  }

  getStockItems({ search = '', group = '', limit = 100, page = 1 } = {}) {
    let list = Object.values(this.stockItems);
    if (group) {
      list = list.filter(i => i.stockGroup.toLowerCase() === group.toLowerCase());
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(i => 
        i.name.toLowerCase().includes(s) || 
        (i.stockGroup && i.stockGroup.toLowerCase().includes(s))
      );
    }
    const total = list.length;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);
    return { total, page, limit, items: paginated };
  }

  getVouchers({ type = '', search = '', limit = 50, page = 1 } = {}) {
    let list = Object.values(this.vouchers);
    // Sort descending by date and voucher number
    list.sort((a, b) => {
      const dComp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dComp !== 0) return dComp;
      return (parseInt(b.voucherNumber) || 0) - (parseInt(a.voucherNumber) || 0);
    });

    if (type) {
      list = list.filter(v => String(v.voucherType || '').toLowerCase() === type.toLowerCase());
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(v => 
        String(v.partyName || '').toLowerCase().includes(s) ||
        String(v.voucherNumber || '').toLowerCase().includes(s) ||
        String(v.reference || '').toLowerCase().includes(s) ||
        String(v.narration || '').toLowerCase().includes(s)
      );
    }
    const total = list.length;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);
    return { total, page, limit, items: paginated };
  }

  getVoucherById(id) {
    return this.vouchers[id] || null;
  }

  getLogs(limit = 20) {
    return this.logs.slice(0, limit);
  }

  getExportData() {
    return {
      exportedAt: new Date().toISOString(),
      company: this.state.companyInfo || { name: this.state.activeCompany },
      units: this.units,
      groups: this.groups,
      ledgers: Object.values(this.ledgers),
      stockItems: Object.values(this.stockItems),
      vouchers: Object.values(this.vouchers)
    };
  }
}

module.exports = new Database();