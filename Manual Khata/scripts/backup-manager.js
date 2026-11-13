/**
 * ============================================================================
 * SKIL LEDGER — BACKUP & RECOVERY MANAGER
 * Creates automated date-stamped backups and restores snapshots safely.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const storage = require('./storage-manager');

const BACKUPS_DIR = path.resolve(__dirname, '../backups');
const DAYBOOK_DIR = path.resolve(__dirname, '../daybook');
const TALLY_DATA_DIR = path.resolve(__dirname, '../tally-data');
const CONFIG_DIR = path.resolve(__dirname, '../config');

class BackupManager {
  constructor() {
    this.backupsDir = BACKUPS_DIR;
    storage.ensureDir(this.backupsDir);
  }

  // Create a backup snapshot
  createBackup(label = 'manual') {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `backup_${timestampStr}_${label}.json`;
    const fullPath = path.join(this.backupsDir, filename);

    // Harvest Tally Data
    const tallyData = {};
    if (fs.existsSync(TALLY_DATA_DIR)) {
      const files = fs.readdirSync(TALLY_DATA_DIR);
      files.forEach(f => {
        if (f.endsWith('.json')) {
          tallyData[f] = storage.readJson(path.join(TALLY_DATA_DIR, f));
        }
      });
    }

    // Harvest Daybook
    const daybookData = {};
    if (fs.existsSync(DAYBOOK_DIR)) {
      const dates = storage.listDirs(DAYBOOK_DIR);
      dates.forEach(d => {
        const dDir = path.join(DAYBOOK_DIR, d);
        const dayFiles = {};
        fs.readdirSync(dDir).forEach(f => {
          if (f.endsWith('.json')) {
            dayFiles[f] = storage.readJson(path.join(dDir, f));
          } else if (f.endsWith('.md')) {
            dayFiles[f] = storage.readText(path.join(dDir, f));
          }
        });
        daybookData[d] = dayFiles;
      });
    }

    // Settings
    const settings = storage.readJson(path.join(CONFIG_DIR, 'settings.json'), {});

    const snapshot = {
      meta: {
        version: '1.0.0',
        timestamp: now.toISOString(),
        label,
        filename,
        daybookDatesCount: Object.keys(daybookData).length,
        tallyFilesCount: Object.keys(tallyData).length
      },
      settings,
      tallyData,
      daybookData
    };

    storage.writeJson(fullPath, snapshot);

    console.log(`[BackupManager] Backup created successfully: ${filename}`);
    return snapshot.meta;
  }

  // List all available backups
  listBackups() {
    if (!fs.existsSync(this.backupsDir)) return [];
    return fs.readdirSync(this.backupsDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a))
      .map(filename => {
        const fullPath = path.join(this.backupsDir, filename);
        const stat = fs.statSync(fullPath);
        return {
          filename,
          sizeBytes: stat.size,
          sizeKb: Math.round(stat.size / 1024),
          createdAt: stat.mtime.toISOString()
        };
      });
  }

  // Restore from backup
  restoreBackup(filename) {
    const fullPath = path.join(this.backupsDir, filename);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Backup file "${filename}" does not exist.`);
    }

    const snapshot = storage.readJson(fullPath);
    if (!snapshot || !snapshot.meta) {
      throw new Error(`Invalid backup snapshot format in "${filename}".`);
    }

    // Restore tally data
    if (snapshot.tallyData) {
      storage.ensureDir(TALLY_DATA_DIR);
      Object.entries(snapshot.tallyData).forEach(([f, content]) => {
        storage.writeJson(path.join(TALLY_DATA_DIR, f), content);
      });
    }

    // Restore daybook data
    if (snapshot.daybookData) {
      storage.ensureDir(DAYBOOK_DIR);
      Object.entries(snapshot.daybookData).forEach(([d, dayFiles]) => {
        const dayDir = path.join(DAYBOOK_DIR, d);
        storage.ensureDir(dayDir);
        Object.entries(dayFiles).forEach(([f, content]) => {
          if (f.endsWith('.json')) {
            storage.writeJson(path.join(dayDir, f), content);
          } else if (f.endsWith('.md')) {
            storage.writeText(path.join(dayDir, f), content);
          }
        });
      });
    }

    console.log(`[BackupManager] Restored snapshot from: ${filename}`);
    return { success: true, filename, restoredAt: new Date().toISOString() };
  }
}

const backupMgr = new BackupManager();

if (require.main === module) {
  const meta = backupMgr.createBackup('cli');
  console.log('CLI Backup Summary:', JSON.stringify(meta, null, 2));
}

module.exports = backupMgr;
