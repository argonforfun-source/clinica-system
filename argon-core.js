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

const _argonDb = typeof firebase !== 'undefined' ? firebase.database() : null;

// ── Global Time Formatter ──
window.argonTimeAgo = function(isoDate) {
  if (!isoDate) return '';
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 10) return 'وصل للتو ⚡';
  if (diff < 60) return `قبل ${diff} ثانية`;
  const mins = Math.floor(diff / 60);
  if (mins === 1) return 'قبل دقيقة';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return 'قبل ساعة';
  if (hrs < 24) return `قبل ${hrs} ساعات`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'أمس';
  return `قبل ${days} أيام`;
};


// ── Context (Tenant Identification) ──
const urlParams = new URLSearchParams(window.location.search);
let CLINIC_ID = urlParams.get('id') || localStorage.getItem('argon_id') || '1';
if (urlParams.get('id')) localStorage.setItem('argon_id', CLINIC_ID);
const CLINIC_BASE = 'clinics/' + CLINIC_ID;

window.ArgonCore = {
  
  // ── 1. MEDICAL AUDIT LOG ──
  logAudit: function(action, details, moduleName = 'SYSTEM') {
    if (!_argonDb) return;
    const auditRef = _argonDb.ref(`${CLINIC_BASE}/audit_logs`).push();
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
      if (!_argonDb) return;
      const notificationsRef = _argonDb.ref(`${CLINIC_BASE}/notifications`);
      const now = new Date().toISOString();
      notificationsRef.orderByChild('createdAt').startAt(now).on('child_added', snap => {
        const notif = snap.val();
        if (notif) {
          const session = window.ArgonSession ? window.ArgonSession.get() : null;
          if (!session) return;
          
          let shouldNotify = false;
          if (session.role === 'doctor' && notif.role === 'doctor' && notif.docKey === session.staffId) {
            shouldNotify = true;
          } else if (session.role === 'lab' && notif.role === 'lab') {
            shouldNotify = true;
          } else if (session.role === 'radiology' && notif.role === 'radiology') {
            shouldNotify = true;
          } else if (session.role === 'pharmacist' && notif.role === 'pharmacist') {
            shouldNotify = true;
          } else if (session.role === 'admin') {
            shouldNotify = true;
          }
          
          if (shouldNotify) {
            ArgonCore.NotificationCenter.playMedicalBeep();
            ArgonCore.NotificationCenter.flashScreen();
            if(typeof toast === 'function') {
              toast(`🔔 إشعار: ${notif.title}\n${notif.message}`, 'ok');
            }
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
// ── 5. SESSION MANAGEMENT & ENTERPRISE SECURITY (V8.4) ──
window.ArgonSession = {
    KEY: 'argon_auth_session',
    start: function(payload) {
        payload.issuedAt = Date.now();
        payload.deviceFingerprint = navigator.userAgent + "|" + window.screen.colorDepth;
        sessionStorage.setItem(this.KEY, JSON.stringify(payload));
    },
    get: function() {
        try { return JSON.parse(sessionStorage.getItem(this.KEY)); } catch(e) { return null; }
    },
    isValid: function(requiredRole = null) {
        const s = this.get();
        if (!s || s.clinicId !== CLINIC_ID) return false;
        if (Date.now() - s.issuedAt > 8 * 3600000) { this.clear(); return false; } // 8 hours
        if (requiredRole && s.role !== requiredRole && s.role !== 'admin') return false;
        return true;
    },
    clear: function() {
        sessionStorage.removeItem(this.KEY);
    },
    logout: function() {
        this.clear();
        window.location.assign(window.location.pathname + window.location.search);
    }
};

window.ArgonEnterpriseAuth = {
    hashPassword: async function(rawPassword) {
        const encoder = new TextEncoder();
        const data = encoder.encode(rawPassword + "ARGON_SALT");
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    setStaffCredentials: async function(uid, rawPassword, isDoctor = false) {
        const hash = await this.hashPassword(rawPassword);
        const basePath = isDoctor ? `${CLINIC_BASE}/doctors/${uid}` : `${CLINIC_BASE}/staff/${uid}`;
        await _argonDb.ref(`${basePath}/enterpriseAuth`).update({
            passwordHash: hash,
            sessionVersion: 1,
            updatedAt: Date.now()
        });
        ArgonCore.logAudit('PASSWORD_CHANGED', `Password updated for ${uid}`, 'AUTH');
    },
    login: async function(uid, rawPassword, role, isDoctor = false) {
        const basePath = isDoctor ? `${CLINIC_BASE}/doctors/${uid}` : `${CLINIC_BASE}/staff/${uid}`;
        const snap = await _argonDb.ref(basePath).once('value');
        const user = snap.val();
        if (!user) {
            ArgonCore.logAudit('LOGIN_FAILED', `User not found: ${uid}`, 'AUTH');
            return false;
        }

        const inputHash = await this.hashPassword(rawPassword);
        
        if (!user.enterpriseAuth || !user.enterpriseAuth.passwordHash) {
             ArgonCore.logAudit('LOGIN_FAILED', `No enterprise auth setup for: ${uid}`, 'AUTH');
             return false;
        }

        if (user.enterpriseAuth.passwordHash === inputHash) {
            ArgonCore.logAudit('LOGIN_SUCCESS', `User logged in: ${uid}`, 'AUTH');
            ArgonSession.start({
                sessionId: 'sess_' + Date.now() + Math.floor(Math.random()*1000),
                staffId: uid,
                role: role,
                displayName: user.displayName || user.name || uid,
                sessionVersion: user.enterpriseAuth.sessionVersion || 1,
                clinicId: CLINIC_ID
            });
            return true;
        }

        ArgonCore.logAudit('LOGIN_FAILED', `Invalid password for: ${uid}`, 'AUTH');
        return false;
    }
};

window.ArgonPortalACL = {
    authorizePortal: function(portalName) {
        let requiredRole = null;
        if (portalName === 'emr') requiredRole = 'doctor';
        else if (portalName === 'pharmacy') requiredRole = 'pharmacist';
        else if (portalName === 'lab') requiredRole = 'lab';
        else if (portalName === 'radiology') requiredRole = 'radiology';

        const valid = ArgonSession.isValid(requiredRole);
        if (!valid) ArgonCore.logAudit('UNAUTHORIZED_ACCESS', `Attempted access to ${portalName}`, 'AUTH');
        return valid;
    }
};

window.ArgonPortalRuntime = {
    init: function(portalName) {
        const isAuth = ArgonPortalACL.authorizePortal(portalName);
        if (!isAuth) {
            this.injectEnterpriseLoginOverlay(portalName);
            return false; 
        }
        ArgonCore.logAudit('PORTAL_ENTRY', `Entered portal ${portalName}`, 'AUTH');
        return true; 
    },
    injectEnterpriseLoginOverlay: function(portalName) {
        let overlay = document.getElementById('enterprise-login-overlay');
        if (overlay) return;

        let roleLabel = "موظف";
        let isDoctor = false;
        if (portalName === 'emr') { roleLabel = "طبيب"; isDoctor = true; }
        else if (portalName === 'pharmacy') roleLabel = "صيدلي";
        else if (portalName === 'lab') roleLabel = "فني مختبر";
        else if (portalName === 'radiology') roleLabel = "فني أشعة";

        overlay = document.createElement('div');
        overlay.id = 'enterprise-login-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(3, 11, 10, 0.95); z-index: 999999; display: flex;
            align-items: center; justify-content: center; font-family: 'Tajawal', sans-serif; direction: rtl;
        `;
        
        overlay.innerHTML = `
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 24px; padding: 40px; width: 90%; max-width: 450px; text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,0.5);">
                <div style="font-size: 3.5rem; margin-bottom: 12px;">🏥</div>
                <h2 style="color: white; margin-bottom: 5px; font-weight: 900;">تسجيل دخول الطاقم</h2>
                <p style="color: #94a3b8; margin-bottom: 24px; font-size: 0.9rem;">بوابة وصول: ${roleLabel}</p>
                
                <div id="entLoginStep1">
                    <select id="entUserSelect" style="width: 100%; padding: 12px; background: #1e293b; border: 1px solid #334155; border-radius: 10px; color: white; font-family: inherit; font-size: 1rem; margin-bottom: 15px; outline: none;">
                        <option value="">جاري تحميل القائمة...</option>
                    </select>
                    <button onclick="ArgonPortalRuntime.nextStep()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #0d9488, #0ea5e9); border: none; border-radius: 10px; color: white; font-family: inherit; font-weight: 800; cursor: pointer; font-size: 1rem;">متابعة</button>
                </div>

                <div id="entLoginStep2" style="display: none;">
                    <h3 id="entUserName" style="color: #5eead4; margin-bottom: 15px; font-size: 1.1rem;"></h3>
                    <input type="password" id="entPass" placeholder="كلمة المرور الخاصة بك" style="width: 100%; padding: 12px; background: #1e293b; border: 1px solid #334155; border-radius: 10px; color: white; font-family: inherit; font-size: 1rem; margin-bottom: 15px; text-align: center; outline: none;" onkeyup="if(event.key==='Enter')ArgonPortalRuntime.doLogin('${portalName}', ${isDoctor})">
                    <button onclick="ArgonPortalRuntime.doLogin('${portalName}', ${isDoctor})" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #0d9488, #0ea5e9); border: none; border-radius: 10px; color: white; font-family: inherit; font-weight: 800; cursor: pointer; font-size: 1rem; margin-bottom: 10px;">تسجيل الدخول</button>
                    <button onclick="ArgonPortalRuntime.prevStep()" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: none; border-radius: 10px; color: white; font-family: inherit; cursor: pointer; font-size: 0.9rem;">رجوع</button>
                    <div id="entErr" style="display: none; color: #fca5a5; font-size: 0.85rem; margin-top: 10px; background: rgba(239,68,68,0.1); padding: 8px; border-radius: 8px;">كلمة المرور غير صحيحة أو غير معينة.</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const reqRole = portalName === 'emr' ? 'doctor' : (portalName === 'pharmacy' ? 'pharmacist' : (portalName === 'lab' ? 'lab' : 'radiology'));
        const basePath = isDoctor ? `${CLINIC_BASE}/doctors` : `${CLINIC_BASE}/staff`;
        
        _argonDb.ref(basePath).once('value', snap => {
            const data = snap.val() || {};
            const select = document.getElementById('entUserSelect');
            select.innerHTML = '<option value="">-- اختر هويتك --</option>';
            select.innerHTML += '<option value="admin">الإدارة (Admin)</option>'; 
            
            Object.entries(data).forEach(([id, user]) => {
                if (!isDoctor && user.role !== reqRole) return;
                const name = user.displayName || user.name || id;
                select.innerHTML += `<option value="${id}">${name}</option>`;
            });
        });
    },
    nextStep: function() {
        const select = document.getElementById('entUserSelect');
        if (!select.value) return;
        const name = select.options[select.selectedIndex].text;
        document.getElementById('entUserName').textContent = 'دخول: ' + name;
        document.getElementById('entLoginStep1').style.display = 'none';
        document.getElementById('entLoginStep2').style.display = 'block';
        document.getElementById('entPass').focus();
    },
    prevStep: function() {
        document.getElementById('entLoginStep2').style.display = 'none';
        document.getElementById('entLoginStep1').style.display = 'block';
        document.getElementById('entErr').style.display = 'none';
        document.getElementById('entPass').value = '';
    },
    doLogin: async function(portalName, isDoctor) {
        const uid = document.getElementById('entUserSelect').value;
        const pass = document.getElementById('entPass').value;
        const reqRole = portalName === 'emr' ? 'doctor' : (portalName === 'pharmacy' ? 'pharmacist' : (portalName === 'lab' ? 'lab' : 'radiology'));

        let success = false;
        if (uid === 'admin') {
            const snap = await _argonDb.ref(`${CLINIC_BASE}/settings/password`).once('value');
            if (snap.val() === pass) {
                ArgonSession.start({
                    sessionId: 'sess_admin_' + Date.now(),
                    staffId: 'admin',
                    role: 'admin',
                    displayName: 'الإدارة',
                    sessionVersion: 1,
                    clinicId: CLINIC_ID
                });
                success = true;
            }
        } else {
            success = await ArgonEnterpriseAuth.login(uid, pass, reqRole, isDoctor);
        }

        if (success) {
            document.getElementById('enterprise-login-overlay').remove();
            window.dispatchEvent(new Event('argon-ready'));
        } else {
            document.getElementById('entErr').style.display = 'block';
        }
    }
};

window.waitForArgonReady = function(portalName) {
    return new Promise((resolve) => {
        if (typeof _argonDb !== 'undefined' && ArgonPortalRuntime.init(portalName)) {
            resolve(ArgonSession.get());
            return;
        }
        
        window.addEventListener('argon-ready', () => {
            resolve(ArgonSession.get());
        }, { once: true });
    });
};

// ── 6. LICENSE ENGINE (Single vs Complex) ──
window.ArgonLicense = {
    type: 'single', // default
    init: function(callback) {
        if (!_argonDb) return;
        _argonDb.ref(`${CLINIC_BASE}/settings/type`).on('value', snap => {
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
        if (!_argonDb) return;
        const isInternalApp = window.location.pathname.includes('dashboard') || 
                              window.location.pathname.includes('emr') || 
                              window.location.pathname.includes('pharmacy') || 
                              window.location.pathname.includes('lab') || 
                              window.location.pathname.includes('radiology');
        if (!isInternalApp) return;

        _argonDb.ref(`${CLINIC_BASE}/settings/status`).on('value', snap => {
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
