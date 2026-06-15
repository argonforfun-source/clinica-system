/**
 * ARGON MEDICAL OS — Backup Engine v3.0
 * نظام النسخ الاحتياطي المتقدم
 * 
 * الميزات:
 *   - نسخ يومية (آخر 30 يوم)
 *   - نسخ شهرية (آخر 12 شهر)
 *   - التحقق من سلامة البيانات (SHA-256 Hash)
 *   - حماية ضد حفظ نسخ فارغة أو تالفة
 *   - سجل تفصيلي لكل عملية
 * 
 * الاستخدام:
 *   node argon-backup.js
 *   أو عبر cron job / Windows Task Scheduler
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ══════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════
const FIREBASE_URL = 'https://clinica-system-e71b9-default-rtdb.firebaseio.com/.json';
const BACKUP_DIR = path.join(__dirname, 'backups');
const LOGS_DIR = path.join(BACKUP_DIR, 'logs');
const MAX_DAILY = 30;
const MAX_MONTHLY = 12;
const MIN_VALID_SIZE = 100; // bytes — أي نسخة أصغر من هذا تُعتبر فارغة/تالفة
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// ══════════════════════════════════════════
// Create directories
// ══════════════════════════════════════════
[BACKUP_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ══════════════════════════════════════════
// Logging
// ══════════════════════════════════════════
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const monthStr = dateStr.substring(0, 7);
const logFile = path.join(LOGS_DIR, `backup_${dateStr}.log`);

function log(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

// ══════════════════════════════════════════
// SHA-256 Hash for integrity verification
// ══════════════════════════════════════════
function computeHash(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

// ══════════════════════════════════════════
// Download with retry
// ══════════════════════════════════════════
function downloadDatabase(attempt = 1) {
  return new Promise((resolve, reject) => {
    log('INFO', `Attempt ${attempt}/${MAX_RETRIES}: Downloading database...`);

    const req = https.get(FIREBASE_URL, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 60 seconds'));
    });
  });
}

async function downloadWithRetry() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await downloadDatabase(attempt);
    } catch (err) {
      log('WARN', `Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        log('INFO', `Waiting ${RETRY_DELAY_MS / 1000}s before retry...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw err;
      }
    }
  }
}

// ══════════════════════════════════════════
// Validate backup data
// ══════════════════════════════════════════
function validateBackup(data) {
  // Check minimum size
  if (!data || data.length < MIN_VALID_SIZE) {
    throw new Error(`Backup too small (${data ? data.length : 0} bytes). Possible empty database or error response.`);
  }

  // Validate JSON
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    throw new Error('Invalid JSON received. Database might be protected or URL is wrong.');
  }

  // Check it's an object (not null, not a string error message)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Received non-object data. Expected database snapshot.');
  }

  // Check for Firebase error response
  if (parsed.error) {
    throw new Error(`Firebase error: ${parsed.error}`);
  }

  return parsed;
}

// ══════════════════════════════════════════
// Save backup with integrity hash
// ══════════════════════════════════════════
function saveBackup(filepath, data) {
  const hash = computeHash(data);
  const hashFile = filepath + '.sha256';

  // Check if a backup already exists for today
  if (fs.existsSync(filepath)) {
    const existingHash = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : null;
    const newHash = hash;
    if (existingHash === newHash) {
      log('INFO', `Backup unchanged since last save. Skipping: ${path.basename(filepath)}`);
      return false;
    }
    log('INFO', `Database changed since last backup. Overwriting: ${path.basename(filepath)}`);
  }

  // Write data
  fs.writeFileSync(filepath, data, 'utf8');
  // Write hash
  fs.writeFileSync(hashFile, hash, 'utf8');

  // Verify the written file
  const writtenData = fs.readFileSync(filepath, 'utf8');
  const writtenHash = computeHash(writtenData);
  if (writtenHash !== hash) {
    throw new Error(`CRITICAL: Written file hash mismatch! Expected ${hash}, got ${writtenHash}. Possible disk corruption.`);
  }

  const sizeMB = (Buffer.byteLength(data, 'utf8') / (1024 * 1024)).toFixed(2);
  log('OK', `Saved: ${path.basename(filepath)} (${sizeMB} MB, SHA-256: ${hash.substring(0, 16)}...)`);
  return true;
}

// ══════════════════════════════════════════
// Rotate old backups
// ══════════════════════════════════════════
function rotateBackups() {
  log('INFO', 'Running rotation policy...');
  const files = fs.readdirSync(BACKUP_DIR);

  const rotateGroup = (prefix, maxKeep) => {
    const group = files.filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort().reverse();
    if (group.length > maxKeep) {
      const toDelete = group.slice(maxKeep);
      toDelete.forEach(f => {
        const filepath = path.join(BACKUP_DIR, f);
        const hashpath = filepath + '.sha256';
        fs.unlinkSync(filepath);
        if (fs.existsSync(hashpath)) fs.unlinkSync(hashpath);
        log('INFO', `Rotated out: ${f}`);
      });
    }
    return Math.min(group.length, maxKeep);
  };

  const dailyKept = rotateGroup('backup_daily_', MAX_DAILY);
  const monthlyKept = rotateGroup('backup_monthly_', MAX_MONTHLY);
  log('OK', `Rotation complete. Daily kept: ${dailyKept}, Monthly kept: ${monthlyKept}`);
}

// ══════════════════════════════════════════
// Main execution
// ══════════════════════════════════════════
async function main() {
  log('INFO', '══════════════════════════════════════════');
  log('INFO', 'ARGON BACKUP ENGINE v3.0 — Starting...');
  log('INFO', `Date: ${now.toISOString()}`);
  log('INFO', '══════════════════════════════════════════');

  try {
    // 1. Download
    const rawData = await downloadWithRetry();

    // 2. Validate
    validateBackup(rawData);
    log('OK', `Data validated. Size: ${(rawData.length / 1024).toFixed(1)} KB`);

    // 3. Save daily backup
    const dailyFile = path.join(BACKUP_DIR, `backup_daily_${dateStr}.json`);
    saveBackup(dailyFile, rawData);

    // 4. Save monthly backup (first day of month or if missing)
    const monthlyFile = path.join(BACKUP_DIR, `backup_monthly_${monthStr}.json`);
    if (!fs.existsSync(monthlyFile)) {
      saveBackup(monthlyFile, rawData);
    }

    // 5. Rotate
    rotateBackups();

    log('OK', '══════════════════════════════════════════');
    log('OK', 'BACKUP COMPLETED SUCCESSFULLY');
    log('OK', '══════════════════════════════════════════');
    process.exit(0);

  } catch (err) {
    log('CRITICAL', `BACKUP FAILED: ${err.message}`);
    log('CRITICAL', '══════════════════════════════════════════');
    log('CRITICAL', 'ACTION REQUIRED: Check network and Firebase access.');
    log('CRITICAL', '══════════════════════════════════════════');
    process.exit(1);
  }
}

main();
