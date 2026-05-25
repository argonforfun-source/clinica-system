/**
 * 🏥 ARGON Medical OS - Enterprise Core Architecture
 * Multi-Tenant Security, Session Management, License Provisioning, Maintenance Lockout, Zero Data Loss
 */

// ── Firebase Configuration (Single Source of Truth) ──
const ARGON_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCDT_H-1klxbtuVR5n5GOVHKlxcmvY_2GA",
    authDomain: "clinica-system-e71b9.firebaseapp.com",
    databaseURL: "https://clinica-system-e71b9-default-rtdb.firebaseio.com",
    projectId: "clinica-system-e71b9",
    storageBucket: "clinica-system-e71b9.firebasestorage.app",
    messagingSenderId: "833103541884",
    appId: "1:833103541884:web:f8ee6ca4b3d8400cf0fbf9"
};

// Initialize only if not already initialized
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(ARGON_FIREBASE_CONFIG);
}

const db = typeof firebase !== 'undefined' ? firebase.database() : null;

// ── Context (Tenant Identification) ──
const urlParams = new URLSearchParams(window.location.search);
let CLINIC_ID = urlParams.get('id') || localStorage.getItem('argon_id') || '1';
if (urlParams.get('id')) localStorage.setItem('argon_id', CLINIC_ID);
const CLINIC_BASE = 'clinics/' + CLINIC_ID;

window.ArgonCore = {
  
  // ── 1. MEDICAL AUDIT LOG ──
  logAudit: function(action, details, moduleName = 'SYSTEM') {
    if (!db) return;
    const auditRef = db.ref(`${CLINIC_BASE}/audit_logs`).push();
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
  AutoSave: {
    saveDraft: function(draftKey, dataObj) {
      try {
        const payload = JSON.stringify({ data: dataObj, savedAt: new Date().toISOString() });
        localStorage.setItem(`argon_draft_${draftKey}`, payload);
      } catch (e) {
        console.error("ArgonCore AutoSave: Quota exceeded or error", e);
      }
    },
    loadDraft: function(draftKey) {
      try {
        const payload = localStorage.getItem(`argon_draft_${draftKey}`);
        return payload ? JSON.parse(payload) : null;
      } catch (e) { return null; }
    },
    clearDraft: function(draftKey) {
      localStorage.removeItem(`argon_draft_${draftKey}`);
    }
  },

  // ── 3. BACKGROUND SYNC MANAGER ──
  SyncManager: {
    init: function() {
      window.addEventListener('online', () => {
        console.log("🟢 ArgonCore: Network is ONLINE.");
        if(typeof toast === 'function') toast('عاد الاتصال بالإنترنت. جاري مزامنة البيانات...', 'ok');
      });
      window.addEventListener('offline', () => {
        console.warn("🔴 ArgonCore: Network is OFFLINE.");
        if(typeof toast === 'function') toast('⚠️ انقطع الاتصال! النظام يحفظ بياناتك محلياً بشكل آمن.', 'err');
      });
    }
  },

  // ── 4. SMART NOTIFICATION CENTER ──
  NotificationCenter: {
    init: function() {
      if (!db) return;
      const notificationsRef = db.ref(`${CLINIC_BASE}/notifications`);
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
        playTone(880, 0, 0.15);
        playTone(1046.5, 0.2, 0.2);
      } catch(e) { console.log("Audio blocked by browser."); }
    },
    flashScreen: function() {
      const flash = document.createElement('div');
      flash.style.position = 'fixed';
      flash.style.top = '0'; flash.style.left = '0';
      flash.style.width = '100vw'; flash.style.height = '100vh';
      flash.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
      flash.style.pointerEvents = 'none'; flash.style.zIndex = '999999';
      flash.style.transition = 'opacity 0.5s ease-out';
      document.body.appendChild(flash);
      setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => document.body.removeChild(flash), 500);
      }, 300);
    }
  }
};

// ── 5. SESSION MANAGEMENT & SECURITY ──
window.ArgonSession = {
    KEY: 'argon_auth_session',
    start: function(role, username) {
        const payload = {
            clinicId: CLINIC_ID,
            role: role,
            username: username,
            timestamp: Date.now(),
            fingerprint: navigator.userAgent + "|" + window.screen.colorDepth
        };
        sessionStorage.setItem(this.KEY, JSON.stringify(payload));
    },
    get: function() {
        try { return JSON.parse(sessionStorage.getItem(this.KEY)); } catch(e) { return null; }
    },
    isValid: function(requiredRole = null) {
        const s = this.get();
        if (!s || s.clinicId !== CLINIC_ID) return false;
        if (Date.now() - s.timestamp > 8 * 3600000) { this.clear(); return false; } // 8 hours
        if (requiredRole && s.role !== requiredRole && s.role !== 'admin') return false;
        return true;
    },
    clear: function() {
        sessionStorage.removeItem(this.KEY);
        window.location.href = `index.html?id=${CLINIC_ID}`;
    }
};

// ── 6. LICENSE ENGINE (Single vs Complex) ──
window.ArgonLicense = {
    type: 'single', // default
    init: function(callback) {
        if (!db) return;
        db.ref(`${CLINIC_BASE}/settings/type`).on('value', snap => {
            const t = snap.val();
            if (t) {
                this.type = t;
                document.body.classList.remove('license-single', 'license-complex');
                document.body.classList.add(`license-${t}`);
                if (callback) callback(t);
            }
        });
    },
    isComplex: function() { return this.type === 'complex'; }
};

// ── 7. MAINTENANCE LOCKOUT ENGINE ──
window.ArgonMaintenance = {
    init: function() {
        if (!db) return;
        const isInternalApp = window.location.pathname.includes('dashboard') || 
                              window.location.pathname.includes('emr') || 
                              window.location.pathname.includes('pharmacy') || 
                              window.location.pathname.includes('lab') || 
                              window.location.pathname.includes('radiology');
        if (!isInternalApp) return;

        db.ref(`${CLINIC_BASE}/settings/status`).on('value', snap => {
            const status = snap.val() || 'active';
            if (status === 'suspended' || status === 'maintenance') {
                this.showLockoutScreen(status);
            } else {
                this.hideLockoutScreen();
            }
        });
    },
    showLockoutScreen: function(status) {
        let overlay = document.getElementById('argon-lockout-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'argon-lockout-overlay';
            overlay.innerHTML = `
                <div class="lockout-content">
                    <div class="lockout-icon">🏥</div>
                    <div class="lockout-title">النظام متوقف حالياً</div>
                    <div class="lockout-sub">يرجى المحاولة لاحقاً أو التواصل مع الإدارة.</div>
                </div>
            `;
            const style = document.createElement('style');
            style.textContent = `
                #argon-lockout-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    z-index: 9999999; display: flex; align-items: center; justify-content: center;
                    font-family: 'Tajawal', sans-serif; direction: rtl;
                }
                .lockout-content {
                    background: rgba(255, 255, 255, 0.05); padding: 50px 40px;
                    border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1);
                    text-align: center; color: white; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                    max-width: 400px; width: 90%;
                }
                .lockout-icon { font-size: 80px; margin-bottom: 20px; filter: drop-shadow(0 0 20px rgba(255,255,255,0.2)); }
                .lockout-title { font-size: 28px; font-weight: 800; margin-bottom: 15px; color: #f87171; }
                .lockout-sub { font-size: 16px; color: #cbd5e1; line-height: 1.6; }
            `;
            document.head.appendChild(style);
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    },
    hideLockoutScreen: function() {
        const overlay = document.getElementById('argon-lockout-overlay');
        if (overlay) overlay.style.display = 'none';
    }
};

// Initialize Core Systems
document.addEventListener('DOMContentLoaded', () => {
  ArgonCore.SyncManager.init();
  ArgonCore.NotificationCenter.init();
  ArgonMaintenance.init();
});
