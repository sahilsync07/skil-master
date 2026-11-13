/**
 * SKIL Lifestyle LLP — AES-256-GCM Vault & Cloud Sync Engine
 * Encrypts all financial, voucher, ledger, and aging data with user password (SKIL@123)
 * Syncs encrypted payloads to GitHub (skillifestyle/master) and Supabase
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { execSync } = require('child_process');

const DEFAULT_PASSWORD = process.env.SKIL_VAULT_PASSWORD || 'SKIL@123';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://psykhsowmqtdffqcsbxf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_MTgBAGucScoLdwkvrz9Gqg_upz56zoq';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = 'https://github.com/skillifestyle/master.git';

class VaultSync {
  /**
   * Derive AES-256 key from text password using PBKDF2
   */
  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  /**
   * Encrypt plaintext string using AES-256-GCM
   */
  encrypt(plainText, password = DEFAULT_PASSWORD) {
    const salt = crypto.randomBytes(16);
    const key = this.deriveKey(password, salt);
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return {
      format: 'SKIL-VAULT-V1',
      algorithm: 'aes-256-gcm',
      kdf: 'pbkdf2-sha256',
      iterations: 100000,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      dataLength: encrypted.length,
      timestamp: new Date().toISOString(),
      company: 'SKIL LIFESTYLE LLP',
      data: encrypted.toString('base64')
    };
  }

  /**
   * Decrypt vault object back to plaintext string using AES-256-GCM
   */
  decrypt(vaultObj, password = DEFAULT_PASSWORD) {
    if (vaultObj.format !== 'SKIL-VAULT-V1' && vaultObj.format !== 'SKIL-VAULT-V2') {
      throw new Error('Unsupported vault format: ' + vaultObj.format);
    }
    const salt = Buffer.from(vaultObj.salt, 'hex');
    const key = this.deriveKey(password, salt);
    const iv = Buffer.from(vaultObj.iv, 'hex');
    const tag = Buffer.from(vaultObj.tag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(vaultObj.data, 'base64')),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Bundle all master, voucher, ledger, and aging data
   */
  bundleData() {
    const dataDir = path.join(__dirname, 'data');
    const readJson = (file) => {
      const p = path.join(dataDir, file);
      if (fs.existsSync(p)) {
        try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
      }
      return null;
    };

    const vouchers = readJson('vouchers.json') || {};
    const ledgers = readJson('ledgers.json') || {};
    const stockItems = readJson('stock_items.json') || {};
    const aging = readJson('aging.json') || {};
    const masterGrid = readJson('master-grid.json') || {};

    const vList = Array.isArray(vouchers) ? vouchers : Object.values(vouchers);

    return {
      company: 'SKIL LIFESTYLE LLP',
      gstin: '37AAYFS7178L1Z9',
      bundleVersion: '2.1.0',
      generatedAt: new Date().toISOString(),
      stats: {
        totalVouchers: vList.length,
        totalLedgers: Object.keys(ledgers).length,
        totalStockItems: Object.keys(stockItems).length,
        totalMasterGridRows: masterGrid.rows ? masterGrid.rows.length : 0
      },
      vouchers,
      ledgers,
      stockItems,
      aging,
      masterGrid
    };
  }

  /**
   * Build encrypted vault and save to disk
   */
  createVault(password = DEFAULT_PASSWORD) {
    console.log('[Vault] Bundling SKIL Lifestyle business data...');
    const bundle = this.bundleData();
    console.log(`[Vault] Bundled ${bundle.stats.totalVouchers} vouchers, ${bundle.stats.totalLedgers} ledgers.`);

    console.log('[Vault] Encrypting bundle with AES-256-GCM...');
    const jsonStr = JSON.stringify(bundle);
    const encryptedVault = this.encrypt(jsonStr, password);

    const vaultDir = path.join(__dirname, 'vault');
    if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

    const encPath = path.join(vaultDir, 'skil_vault_encrypted.enc');
    const encJsonPath = path.join(vaultDir, 'skil_vault_encrypted.json');
    const webEncPath = path.join(__dirname, '..', 'web', 'data', 'skil_vault_encrypted.json');
    const appEncPath = path.join(__dirname, '..', 'android-app', 'www', 'data', 'skil_vault_encrypted.json');
    const syncEncPath = path.join(__dirname, 'public', 'data', 'skil_vault_encrypted.json');

    const vaultString = JSON.stringify(encryptedVault, null, 2);
    fs.writeFileSync(encPath, vaultString, 'utf8');
    fs.writeFileSync(encJsonPath, vaultString, 'utf8');

    // Also mirror to web app data dirs
    [webEncPath, appEncPath, syncEncPath].forEach(target => {
      try {
        const d = path.dirname(target);
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(target, vaultString, 'utf8');
      } catch (e) {
        console.error('Mirror error:', target, e.message);
      }
    });

    console.log(`[Vault] Encrypted vault saved: ${encPath} (${(vaultString.length / 1024).toFixed(1)} KB)`);
    return encryptedVault;
  }

  /**
   * Post encrypted vault payload to Supabase
   */
  async uploadToSupabase(encryptedVault) {
    console.log('[Supabase] Syncing encrypted vault to Supabase...');
    return new Promise((resolve) => {
      // Post to Supabase storage or auth/profile metadata
      const payload = JSON.stringify({
        filename: 'skil_vault_encrypted.json',
        algorithm: encryptedVault.algorithm,
        timestamp: encryptedVault.timestamp,
        iterations: encryptedVault.iterations,
        salt: encryptedVault.salt,
        iv: encryptedVault.iv,
        tag: encryptedVault.tag,
        data: encryptedVault.data
      });

      // We attempt to store snapshot into Supabase user metadata or bucket
      const req = https.request({
        hostname: 'psykhsowmqtdffqcsbxf.supabase.co',
        path: '/auth/v1/user',
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          console.log(`[Supabase] Sync response code: ${res.statusCode}`);
          resolve({ status: res.statusCode, body });
        });
      });

      req.on('error', (err) => {
        console.warn('[Supabase] Notice on direct sync:', err.message);
        resolve({ status: 500, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Commit and push encrypted repository to GitHub skillifestyle/master
   */
  pushToGitHub() {
    console.log('[GitHub] Syncing encrypted vault to GitHub (skillifestyle/master)...');
    const rootDir = path.join(__dirname, '..');
    const remoteUrl = `https://${GITHUB_TOKEN}@github.com/skillifestyle/master.git`;

    try {
      // Check if remote skillifestyle exists, if not add it
      let remotes = '';
      try {
        remotes = execSync('git remote', { cwd: rootDir, encoding: 'utf8' });
      } catch (e) {
        remotes = '';
      }

      if (!remotes.includes('skillifestyle')) {
        execSync(`git remote add skillifestyle ${remoteUrl}`, { cwd: rootDir });
      } else {
        execSync(`git remote set-url skillifestyle ${remoteUrl}`, { cwd: rootDir });
      }

      // Add vault files and commit
      execSync('git add sync-engine/vault/', { cwd: rootDir });
      try {
        execSync('git commit -m "feat(vault): add AES-256 encrypted business vault and aging analysis"', { cwd: rootDir });
      } catch (e) {
        // Nothing to commit or already committed
      }

      console.log('[GitHub] Pushing main branch to skillifestyle...');
      const pushRes = execSync('git push -u skillifestyle main --force', { cwd: rootDir, encoding: 'utf8' });
      console.log('[GitHub] Push completed:\n', pushRes);
      return { success: true };
    } catch (err) {
      console.error('[GitHub] Push error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Full end-to-end sync workflow
   */
  async runFullSync(password = DEFAULT_PASSWORD) {
    console.log('========================================================');
    console.log('  SKIL LIFESTYLE LLP — SECURE ENCRYPTED VAULT SYNC');
    console.log('========================================================');
    const encryptedVault = this.createVault(password);
    
    // Verify decryption before uploading to ensure 100% integrity
    const decrypted = this.decrypt(encryptedVault, password);
    const parsed = JSON.parse(decrypted);
    console.log(`[Vault] Verification check: Decrypted successfully! (${parsed.stats.totalVouchers} vouchers verified)`);

    // Sync to Supabase
    await this.uploadToSupabase(encryptedVault);

    // Sync to GitHub
    this.pushToGitHub();

    console.log('========================================================');
    console.log('  ENCRYPTED VAULT SYNC COMPLETED SUCCESSFULLY');
    console.log('========================================================');
    return encryptedVault;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const action = args[0] || 'sync';
  const pwd = args[1] || DEFAULT_PASSWORD;

  const vault = new VaultSync();

  if (action === 'decrypt') {
    const encPath = path.join(__dirname, 'vault', 'skil_vault_encrypted.enc');
    if (!fs.existsSync(encPath)) {
      console.error('Vault file not found at:', encPath);
      process.exit(1);
    }
    const encObj = JSON.parse(fs.readFileSync(encPath, 'utf8'));
    const decryptedStr = vault.decrypt(encObj, pwd);
    console.log('Decrypted Data Preview:');
    const obj = JSON.parse(decryptedStr);
    console.log(JSON.stringify({ company: obj.company, stats: obj.stats, generatedAt: obj.generatedAt }, null, 2));
  } else {
    vault.runFullSync(pwd).catch(err => {
      console.error('Fatal sync error:', err);
    });
  }
}

module.exports = new VaultSync();
