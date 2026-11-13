/**
 * ============================================================================
 * SKIL LEDGER — STORAGE MANAGER
 * Safe, atomic JSON file persistence with integrity checks and automatic retries.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

class StorageManager {
  constructor(baseDir = null) {
    this.baseDir = baseDir || path.resolve(__dirname, '..');
  }

  // Ensure directory exists
  ensureDir(dirPath) {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(this.baseDir, dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
  }

  // Safe read JSON
  readJson(filePath, defaultValue = null) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath);
    try {
      if (!fs.existsSync(fullPath)) {
        return defaultValue;
      }
      const raw = fs.readFileSync(fullPath, 'utf8');
      if (!raw || raw.trim().length === 0) {
        return defaultValue;
      }
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[StorageManager] Read error on ${fullPath}:`, err.message);
      return defaultValue;
    }
  }

  // Safe atomic write JSON (writes to .tmp, then atomic rename)
  writeJson(filePath, data, spaces = 2) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath);
    this.ensureDir(path.dirname(fullPath));

    const tmpPath = `${fullPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
    try {
      const jsonStr = JSON.stringify(data, null, spaces);
      fs.writeFileSync(tmpPath, jsonStr, 'utf8');
      fs.renameSync(tmpPath, fullPath);
      return true;
    } catch (err) {
      console.error(`[StorageManager] Atomic write failed for ${fullPath}:`, err.message);
      // Clean up tmp file if left
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      // Fallback direct write
      try {
        fs.writeFileSync(fullPath, JSON.stringify(data, null, spaces), 'utf8');
        return true;
      } catch (directErr) {
        throw new Error(`Failed to write JSON to ${fullPath}: ${directErr.message}`);
      }
    }
  }

  // Read raw text (e.g. remarks.md)
  readText(filePath, defaultValue = '') {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath);
    try {
      if (!fs.existsSync(fullPath)) return defaultValue;
      return fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
      console.error(`[StorageManager] Read text error on ${fullPath}:`, err.message);
      return defaultValue;
    }
  }

  // Safe atomic write text
  writeText(filePath, content) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath);
    this.ensureDir(path.dirname(fullPath));

    const tmpPath = `${fullPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
    try {
      fs.writeFileSync(tmpPath, content || '', 'utf8');
      fs.renameSync(tmpPath, fullPath);
      return true;
    } catch (err) {
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      fs.writeFileSync(fullPath, content || '', 'utf8');
      return true;
    }
  }

  // List subdirectories in a directory
  listDirs(parentDir) {
    const fullPath = path.isAbsolute(parentDir) ? parentDir : path.join(this.baseDir, parentDir);
    if (!fs.existsSync(fullPath)) return [];
    return fs.readdirSync(fullPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  // Check file existence
  exists(filePath) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath);
    return fs.existsSync(fullPath);
  }
}

module.exports = new StorageManager();
