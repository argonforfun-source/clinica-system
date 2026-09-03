/**
 * ARGON MEDICAL OS — Cloud Functions v1.0
 * Server-Side Role-Based Access Control (RBAC) & Persistent Backups
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Sync custom claims when a staff member is created or updated
 * Trigger Path: clinics/{clinicId}/staff/{uid}
 */
exports.syncStaffClaims = functions.database
  .ref("/clinics/{clinicId}/staff/{uid}")
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const clinicId = context.params.clinicId;

    // If staff was deleted, we might want to remove custom claims
    if (!change.after.exists()) {
      try {
        await admin.auth().setCustomUserClaims(uid, null);
        console.log(`Removed claims for deleted staff: ${uid}`);
      } catch (err) {
        console.error(`Failed to remove claims for ${uid}:`, err);
      }
      return null;
    }

    const staffData = change.after.val();
    const role = staffData.role || "staff";

    try {
      // Set custom user claims on Firebase Auth token
      await admin.auth().setCustomUserClaims(uid, {
        role: role,
        clinicId: clinicId,
      });
      console.log(`Successfully set claim {role: ${role}, clinicId: ${clinicId}} for staff ${uid}`);
    } catch (err) {
      console.error(`Error setting claims for staff ${uid}:`, err);
    }
    return null;
  });

/**
 * Sync custom claims when a doctor is created or updated
 * Trigger Path: clinics/{clinicId}/doctors/{uid}
 */
exports.syncDoctorClaims = functions.database
  .ref("/clinics/{clinicId}/doctors/{uid}")
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const clinicId = context.params.clinicId;

    // If doctor was deleted
    if (!change.after.exists()) {
      try {
        await admin.auth().setCustomUserClaims(uid, null);
        console.log(`Removed claims for deleted doctor: ${uid}`);
      } catch (err) {
        console.error(`Failed to remove claims for ${uid}:`, err);
      }
      return null;
    }

    try {
      // Set custom user claims: Doctor role is fixed
      await admin.auth().setCustomUserClaims(uid, {
        role: "doctor",
        clinicId: clinicId,
      });
      console.log(`Successfully set claim {role: doctor, clinicId: ${clinicId}} for doctor ${uid}`);
    } catch (err) {
      console.error(`Error setting claims for doctor ${uid}:`, err);
    }
    return null;
  });

/**
 * ============================================================================
 * SERVER-SIDE PERSISTENT CLOUD BACKUP ENGINE
 * ============================================================================
 * Runs every hour, checks clinic backup_settings, and performs backups for 
 * clinics that are due. Guarantees browser-independence and tenant isolation.
 */
exports.scheduledCloudBackup = functions.pubsub.schedule("every 1 hours").onRun(async (context) => {
  console.log("Starting scheduledCloudBackup sweep...");
  const db = admin.database();
  const bucket = admin.storage().bucket();
  
  try {
    const clinicsSnap = await db.ref("clinics").once("value");
    if (!clinicsSnap.exists()) {
      console.log("No clinics found.");
      return null;
    }
    
    const clinics = clinicsSnap.val();
    const now = Date.now();
    
    for (const clinicId of Object.keys(clinics)) {
      const clinicData = clinics[clinicId];
      // Note: we assume backup_settings is stored inside clinicData.backup_settings
      const settings = clinicData.backup_settings || {};
      
      // 1. Is Cloud Backup Enabled?
      if (!settings.cloudEnabled) continue;
      
      // 2. Schedule Check (intervalMinutes)
      const intervalMs = (settings.cloudIntervalMinutes || 60) * 60 * 1000;
      const lastBackupAt = settings.lastCloudBackupAt ? new Date(settings.lastCloudBackupAt).getTime() : 0;
      
      if (now - lastBackupAt < intervalMs) {
        // Not due yet
        continue;
      }
      
      console.log(`[BackupScheduler] Clinic ${clinicId} is due for a backup.`);
      
      // 3. Serialize Data (Tenant Isolation: only this clinic's data)
      // Remove sensitive transient data
      const cleanData = { ...clinicData };
      delete cleanData.active_sessions;
      delete cleanData.presence;
      delete cleanData.active_logins;
      
      const payload = {
        _meta: {
          clinicId: clinicId,
          timestamp: new Date().toISOString(),
          engine: "ArgonServerBackupEngine"
        },
        data: cleanData
      };
      
      const jsonString = JSON.stringify(payload);
      
      // Generate Filename
      const dateStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, "-");
      const fileName = `ARGON_BACKUP_${clinicId}_${dateStr}_${timeStr}.json`;
      const filePath = `backups/${clinicId}/${fileName}`;
      
      const fileRef = bucket.file(filePath);
      
      try {
        // 4. Write New Backup First
        await fileRef.save(jsonString, {
          metadata: {
            contentType: "application/json",
            metadata: {
              clinicId: clinicId,
              status: "verified"
            }
          }
        });
        
        // 5. Verify Integrity (check if exists and size > 0)
        const [metadata] = await fileRef.getMetadata();
        if (metadata.size <= 0) {
           throw new Error("Backup file size is 0 bytes");
        }
        
        console.log(`[BackupScheduler] Successfully verified backup ${fileName} for clinic ${clinicId}`);
        
        // 6. Update Last Known Good Metadata
        await db.ref(`clinics/${clinicId}/backup_settings`).update({
          lastCloudBackupAt: new Date().toISOString(),
          lastCloudBackupFile: fileName,
          lastCloudBackupSizeMB: (metadata.size / (1024 * 1024)).toFixed(3),
          lastCloudBackupStatus: "success"
        });
        
        // 7. Apply Retention Policy (Delete old backups only AFTER new one is verified)
        // Keep max 15 backups
        const maxBackups = 15;
        const [files] = await bucket.getFiles({ prefix: `backups/${clinicId}/ARGON_BACKUP_` });
        
        if (files.length > maxBackups) {
          // Sort oldest first
          files.sort((a, b) => {
            const timeA = new Date(a.metadata.timeCreated).getTime();
            const timeB = new Date(b.metadata.timeCreated).getTime();
            return timeA - timeB;
          });
          
          const excess = files.length - maxBackups;
          for (let i = 0; i < excess; i++) {
            await files[i].delete().catch(e => console.error(`Failed to delete old backup ${files[i].name}:`, e));
            console.log(`[BackupScheduler] Deleted old backup ${files[i].name} due to retention policy.`);
          }
        }
        
      } catch (backupError) {
        console.error(`[BackupScheduler] Failed to write/verify backup for clinic ${clinicId}:`, backupError);
        // Ensure failure is recorded, but Last Known Good remains untouched
        await db.ref(`clinics/${clinicId}/backup_settings`).update({
          lastCloudBackupStatus: "failed",
          lastCloudBackupError: backupError.message,
          lastFailedAttemptAt: new Date().toISOString()
        });
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error in scheduledCloudBackup sweep:", error);
    return null;
  }
});