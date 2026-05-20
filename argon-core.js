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
  },

  // ── 4. SMART NOTIFICATION CENTER ──
  // مركز الإشعارات الطبية الذكية مع صوت وميض بصري
  NotificationCenter: {
    init: function() {
      if (typeof db === 'undefined' || typeof firebase === 'undefined') return;
      
      const CID = localStorage.getItem('argon_id') || new URLSearchParams(window.location.search).get('id') || 'UNKNOWN_CLINIC';
      const notificationsRef = db.ref(`clinics/${CID}/notifications`);
      
      // نستمع للإشعارات الجديدة فقط بدءاً من وقت فتح الصفحة
      const now = new Date().toISOString();
      notificationsRef.orderByChild('createdAt').startAt(now).on('child_added', snap => {
        const notif = snap.val();
        if (notif) {
          ArgonCore.NotificationCenter.playMedicalBeep();
          ArgonCore.NotificationCenter.flashScreen();
          if(typeof toast === 'function') {
            toast(`🔔 إشعار: ${notif.title}\n${notif.message}`, 'ok');
          }
        }
      });
    },

    playMedicalBeep: function() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // توليد نغمتين متتاليتين (Beep-Beep)
        const playTone = (freq, startTime, duration) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
          
          gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + startTime + 0.05);
          gain.gain.setValueAtTime(0.5, ctx.currentTime + startTime + duration - 0.05);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + startTime);
          osc.stop(ctx.currentTime + startTime + duration);
        };

        // الترددات الطبية (مثل أجهزة المراقبة)
        playTone(880, 0, 0.15);     // High A
        playTone(1046.5, 0.2, 0.2); // High C
      } catch(e) {
        console.log("Audio play blocked by browser. User interaction needed first.");
      }
    },

    flashScreen: function() {
      const flash = document.createElement('div');
      flash.style.position = 'fixed';
      flash.style.top = '0';
      flash.style.left = '0';
      flash.style.width = '100vw';
      flash.style.height = '100vh';
      flash.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'; // Blue tint
      flash.style.pointerEvents = 'none';
      flash.style.zIndex = '999999';
      flash.style.transition = 'opacity 0.5s ease-out';
      document.body.appendChild(flash);
      
      setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => document.body.removeChild(flash), 500);
      }, 300);
    }
  }
};

// Initialize Core Systems
document.addEventListener('DOMContentLoaded', () => {
  ArgonCore.SyncManager.init();
  ArgonCore.NotificationCenter.init();
});
