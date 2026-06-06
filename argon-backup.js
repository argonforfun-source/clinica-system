const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const FIREBASE_URL = 'https://clinica-system-c33b4-default-rtdb.firebaseio.com/.json';
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_DAILY = 30;
const MAX_MONTHLY = 12;

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

// Generate Filenames
const now = new Date();
const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
const monthStr = dateStr.substring(0, 7); // YYYY-MM
const dailyFilename = path.join(BACKUP_DIR, `backup_daily_${dateStr}.json`);
const monthlyFilename = path.join(BACKUP_DIR, `backup_monthly_${monthStr}.json`);

console.log(`[Argon Backup] Starting database backup...`);

https.get(FIREBASE_URL, (res) => {
  let data = '';

  // A chunk of data has been received.
  res.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received.
  res.on('end', () => {
    try {
      // Validate JSON to ensure we didn't get an error page
      JSON.parse(data);
      
      // Save Daily Backup
      fs.writeFileSync(dailyFilename, data);
      console.log(`[Argon Backup] Successfully saved daily backup: ${dailyFilename}`);

      // Save Monthly Backup (if not exists for this month)
      if (!fs.existsSync(monthlyFilename)) {
        fs.writeFileSync(monthlyFilename, data);
        console.log(`[Argon Backup] Successfully saved monthly backup: ${monthlyFilename}`);
      }

      // Run Rotation (Cleanup old backups)
      rotateBackups();

    } catch (e) {
      console.error('[Argon Backup] Error: Invalid JSON received. Database might be protected or URL is wrong.');
      console.error(e.message);
    }
  });

}).on("error", (err) => {
  console.error(`[Argon Backup] Network Error: ${err.message}`);
});


function rotateBackups() {
  console.log(`[Argon Backup] Running rotation policy...`);
  const files = fs.readdirSync(BACKUP_DIR);
  
  const dailyFiles = files.filter(f => f.startsWith('backup_daily_')).sort().reverse();
  const monthlyFiles = files.filter(f => f.startsWith('backup_monthly_')).sort().reverse();

  // Delete old daily backups (Keep latest 30)
  if (dailyFiles.length > MAX_DAILY) {
    const toDelete = dailyFiles.slice(MAX_DAILY);
    toDelete.forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`[Argon Backup] Deleted old daily backup: ${f}`);
    });
  }

  // Delete old monthly backups (Keep latest 12)
  if (monthlyFiles.length > MAX_MONTHLY) {
    const toDelete = monthlyFiles.slice(MAX_MONTHLY);
    toDelete.forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`[Argon Backup] Deleted old monthly backup: ${f}`);
    });
  }
  
  console.log(`[Argon Backup] Rotation complete. Daily kept: ${Math.min(dailyFiles.length, MAX_DAILY)}, Monthly kept: ${Math.min(monthlyFiles.length, MAX_MONTHLY)}`);
}
