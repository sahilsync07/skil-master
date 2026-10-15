const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve('c:/Projects/SKIL Master');
const USER_DOCS_DIR = path.join(ROOT_DIR, 'user-documents-read-only-access');

class FolderUpdater {
  constructor() {
    this.rootDir = ROOT_DIR;
    this.userDocsDir = USER_DOCS_DIR;
  }

  // Format Date in IST (+05:30) as 'DD-MM-YYYY at HH-mm hrs'
  formatTimestamp(date) {
    if (!date) return '';
    const d = new Date(date);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    return `${map.day}-${map.month}-${map.year} at ${map.hour}-${map.minute} hrs`;
  }

  // Dynamic directory locator: finds any subfolder matching prefix
  resolveDynamicDir(parentDir, prefix) {
    if (!fs.existsSync(parentDir)) {
      return path.join(parentDir, prefix);
    }
    const cleanPrefix = prefix.trim().toLowerCase();
    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const entLower = ent.name.toLowerCase();
        if (entLower === cleanPrefix || entLower.startsWith(cleanPrefix + ' -') || entLower.startsWith(cleanPrefix + ' (')) {
          return path.join(parentDir, ent.name);
        }
      }
    }
    return path.join(parentDir, prefix);
  }

  // Helper getters for specific dynamic folders
  getPurchasesDir() {
    return this.resolveDynamicDir(this.userDocsDir, 'Purchases');
  }

  getBankDir() {
    return this.resolveDynamicDir(this.userDocsDir, 'Bank');
  }

  getTallyFilesDir() {
    return this.resolveDynamicDir(this.rootDir, 'Tally Files');
  }

  getOfficialDocsDir() {
    return this.resolveDynamicDir(this.userDocsDir, 'Official Documentation');
  }

  // Recursively scans a directory for the latest file modification time and file count
  scanFolderLatestTime(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return { latestTime: null, count: 0, latestFile: null };
    }

    let latestTime = null;
    let latestFile = null;
    let count = 0;

    const traverse = (currentDir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch (err) {
        return;
      }

      for (const ent of entries) {
        // Skip hidden and system files
        if (ent.name.startsWith('.') || ent.name === 'desktop.ini' || ent.name === 'Thumbs.db') {
          continue;
        }

        const fullPath = path.join(currentDir, ent.name);
        if (ent.isDirectory()) {
          traverse(fullPath);
        } else if (ent.isFile()) {
          count++;
          try {
            const stat = fs.statSync(fullPath);
            if (!latestTime || stat.mtime > latestTime) {
              latestTime = stat.mtime;
              latestFile = ent.name;
            }
          } catch (e) {
            // ignore read stat errors
          }
        }
      }
    };

    traverse(dirPath);
    return { latestTime, count, latestFile };
  }

  // Safely renames a directory with retry logic
  safeRenameDir(oldPath, newPath) {
    if (oldPath === newPath) return true;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        fs.renameSync(oldPath, newPath);
        return true;
      } catch (err) {
        if (attempt === 3) {
          console.warn(`[FolderUpdater] Could not rename ${oldPath} -> ${newPath}:`, err.message);
          return false;
        }
        // Brief synchronous wait before retrying (100ms)
        const waitTill = Date.now() + 100;
        while (Date.now() < waitTill) { /* busy wait */ }
      }
    }
    return false;
  }

  // Update a single folder's timestamp
  updateFolder(parentDir, prefix, customTime = null) {
    const currentPath = this.resolveDynamicDir(parentDir, prefix);
    if (!fs.existsSync(currentPath)) {
      return {
        prefix,
        currentPath,
        name: path.basename(currentPath),
        count: 0,
        latestTime: null,
        status: 'not_found'
      };
    }

    const { latestTime, count, latestFile } = this.scanFolderLatestTime(currentPath);
    const effectiveTime = customTime || latestTime;

    let targetName = prefix;
    if (count > 0 && effectiveTime) {
      targetName = `${prefix} - last updated on ${this.formatTimestamp(effectiveTime)}`;
    } else if (customTime) {
      targetName = `${prefix} - last updated on ${this.formatTimestamp(customTime)}`;
    }

    const targetPath = path.join(parentDir, targetName);
    let finalPath = currentPath;
    let renamed = false;

    if (path.basename(currentPath) !== targetName) {
      const success = this.safeRenameDir(currentPath, targetPath);
      if (success) {
        finalPath = targetPath;
        renamed = true;
      }
    }

    return {
      prefix,
      currentPath: finalPath,
      name: path.basename(finalPath),
      count,
      latestTime: effectiveTime ? this.formatTimestamp(effectiveTime) : null,
      latestFile,
      renamed
    };
  }

  // Exports a live Tally snapshot into Tally Files/Raw and updates folder timestamp
  updateTallyFiles(customSyncDate = null) {
    const db = require('./database');
    const tallyDir = this.getTallyFilesDir();
    
    // Ensure Raw folder exists
    const rawDir = path.join(tallyDir, 'Raw');
    try {
      fs.mkdirSync(rawDir, { recursive: true });

      // Save summary snapshot
      const vouchers = Object.values(db.vouchers || {});
      const ledgers = Object.values(db.ledgers || {});
      const state = db.getState();
      
      const summary = {
        exportedAt: new Date().toISOString(),
        company: state.activeCompany || 'SKIL LIFESTYLE LLP',
        totalVouchers: vouchers.length,
        totalLedgers: ledgers.length,
        lastSyncTimestamp: state.lastSyncTimestamp || null
      };

      fs.writeFileSync(path.join(rawDir, 'tally_summary.json'), JSON.stringify(summary, null, 2), 'utf8');

      // Export light voucher summary
      const voucherLight = vouchers.map(v => ({
        id: v.id,
        voucherNumber: v.voucherNumber,
        voucherType: v.voucherType,
        date: v.date,
        partyName: v.partyName,
        amount: v.amount
      }));
      fs.writeFileSync(path.join(rawDir, 'vouchers_snapshot.json'), JSON.stringify(voucherLight, null, 2), 'utf8');
    } catch (err) {
      console.warn('[FolderUpdater] Error saving snapshot to Tally Files:', err.message);
    }

    // Determine timestamp
    const state = db.getState();
    const effectiveDate = customSyncDate || (state.lastSyncTimestamp ? new Date(state.lastSyncTimestamp) : new Date());

    return this.updateFolder(this.rootDir, 'Tally Files', effectiveDate);
  }

  // Update all managed folders in project
  updateAll(customSyncDate = null) {
    const results = [];

    // 1. Tally Files in Root
    results.push(this.updateTallyFiles(customSyncDate));

    // 2. User Document Subfolders
    const userDocsPrefixes = [
      'Purchases',
      'Bank',
      'Official Documentation',
      'Vendor Ledgers',
      'Sales',
      'Credit Notes',
      'Debit Notes',
      'GST Docs'
    ];

    for (const prefix of userDocsPrefixes) {
      results.push(this.updateFolder(this.userDocsDir, prefix));
    }

    return results;
  }

  // Get status of all managed folders without necessarily renaming
  getStatus() {
    const folders = [];

    // Tally Files
    const tallyPath = this.getTallyFilesDir();
    const tallyScan = this.scanFolderLatestTime(tallyPath);
    folders.push({
      prefix: 'Tally Files',
      name: path.basename(tallyPath),
      path: tallyPath,
      count: tallyScan.count,
      latestTime: tallyScan.latestTime ? this.formatTimestamp(tallyScan.latestTime) : null,
      latestFile: tallyScan.latestFile
    });

    // User Docs
    const userDocsPrefixes = [
      'Purchases',
      'Bank',
      'Official Documentation',
      'Vendor Ledgers',
      'Sales',
      'Credit Notes',
      'Debit Notes',
      'GST Docs'
    ];

    for (const prefix of userDocsPrefixes) {
      const folderPath = this.resolveDynamicDir(this.userDocsDir, prefix);
      const exists = fs.existsSync(folderPath);
      const scan = exists ? this.scanFolderLatestTime(folderPath) : { count: 0, latestTime: null, latestFile: null };
      folders.push({
        prefix,
        name: path.basename(folderPath),
        path: folderPath,
        count: scan.count,
        latestTime: scan.latestTime ? this.formatTimestamp(scan.latestTime) : null,
        latestFile: scan.latestFile,
        exists
      });
    }

    return folders;
  }
}

module.exports = new FolderUpdater();
