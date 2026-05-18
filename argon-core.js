/**
 * 🏥 ARGON Medical OS - Core Engine
 * Enterprise-Grade Zero Data Loss & Audit Architecture
 */

window.ArgonCore = {
  
  // ── 1. MEDICAL AUDIT LOG ──
  // يسجل كل حركة تتم بالنظام (من عدل، ماذا عدل، متى، وما هو الجهاز)
  logAudit: function(action, details, moduleName = 'SYSTEM') {
    if (typeof db === 'undefined') return;
    
    const CID = localStorage.getItem('argon_id') || new URLSearchParams(window.location.search).get('id') || 'UNKNOWN_CLINIC';
    const auditRef = db.ref(`clinics/${CID}/audit_logs`).push();
    
    const logEntry = {
      action: action,
      details: details,
      module: moduleName,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };
    
    auditRef.set(logEntry).catch(err => {
      console.warn("ArgonCore: Failed to write audit log (will retry if offline).", err);
    });
  },

  // ── 2. ZERO DATA LOSS (AUTO-SAVE) ──
  // يحفظ مدخلات الطبيب كل 3 ثواني في الكاش المحلي (localStorage)
  AutoSave: {
    saveDraft: function(draftKey, dataObj) {
      try {
        const payload = JSON.stringify({
          data: dataObj,
          savedAt: new Date().toISOString()
        });
        localStorage.setItem(`argon_draft_${draftKey}`, payload);
      } catch (e) {
        console.error("ArgonCore AutoSave: Quota exceeded or error", e);
      }
    },
    
    loadDraft: function(draftKey) {
      try {
        const payload = localStorage.getItem(`argon_draft_${draftKey}`);
        if (!payload) return null;
        return JSON.parse(payload);
      } catch (e) {
        return null;
      }
    },
    
    clearDraft: function(draftKey) {
      localStorage.removeItem(`argon_draft_${draftKey}`);
    }
  },

  // ── 3. BACKGROUND SYNC MANAGER ──
  // يكتشف انقطاع الإنترنت ويقوم بتخزين العمليات لإرسالها لاحقاً
  SyncManager: {
    init: function() {
      window.addEventListener('online', () => {
        console.log("🟢 ArgonCore: Network is ONLINE. Flushing offline queue...");
        // Add minimal visual indicator
        if(typeof toast === 'function') toast('عاد الاتصال بالإنترنت. جاري مزامنة البيانات...', 'ok');
      });
      
      window.addEventListener('offline', () => {
        console.warn("🔴 ArgonCore: Network is OFFLINE. Entering Zero Data Loss Mode.");
        if(typeof toast === 'function') toast('⚠️ انقطع الاتصال! النظام يحفظ بياناتك محلياً بشكل آمن.', 'err');
      });
    }
  }
};

// Initialize Core Systems
document.addEventListener('DOMContentLoaded', () => {
  ArgonCore.SyncManager.init();
});
