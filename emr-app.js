// 🏥 ARGON EMR — Medical Records Engine v1.0
const firebaseConfig = {
  apiKey: "AIzaSyCDT_H-1klxbtuVR5n5GOVHKlxcmvY_2GA",
  authDomain: "clinica-system-e71b9.firebaseapp.com",
  databaseURL: "https://clinica-system-e71b9-default-rtdb.firebaseio.com",
  projectId: "clinica-system-e71b9",
  storageBucket: "clinica-system-e71b9.firebasestorage.app",
  messagingSenderId: "833103541884",
  appId: "1:833103541884:web:f8ee6ca4b3d8400cf0fbf9",
  measurementId: "G-KGN7CPYKTR"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const storage = firebase.storage();

// State
let CID = new URLSearchParams(window.location.search).get('id') || '';
let BASE = 'clinics/' + CID;
let _sets = null;
let _patients = {};
let _doctors = {};
let _depts = {};
let activePatientId = null;

window.EMRContext = {
    activePatientId: null,
    activeBookingId: null,
    activeDoctorId: null,
    sessionLock: false,
    renderToken: null,
    renderVersion: 0,
    initialized: false,
    lastOpenedAt: 0
};

window.AuditAPI = {
    log(type, payload={}){
        console.log('[AUDIT]', type, payload);
    }
};

// ── SOFT LOCK CLEANUP ON TAB CLOSE ──
window.addEventListener('beforeunload', () => {
    if (window.EMRContext && window.EMRContext.activePatientId && typeof BASE !== 'undefined') {
        db.ref(`${BASE}/active_sessions/${window.EMRContext.activePatientId}`).remove();
    }
});
let rxItems = [];
let uploadAttachments = [];
let _labOrders = {};
let _radOrders = {};
let activeEmrTab = 'timeline-tab';
let _referrals = {};
let currentReferralsFilter = 'all';
let _pharmacyInventory = {};
let _liveBookings = {};
let _myNotifications = [];

let npPhotoData = '';
let epPhotoData = '';

// ── AUDIT LOGGING ENGINE ──
function logAudit(action, details, module = 'EMR') {
  const logId = db.ref().child('audit_logs').push().key;
  db.ref(`${BASE}/audit_logs/${logId}`).set({
    action,
    details,
    module,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  }).catch(err => console.error("Audit log failed: ", err));
}

// ── COMPRESS & PREVIEW PATIENT PHOTO ──
function previewPatientPhoto(event, prefix) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 120, 120);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      if (prefix === 'np') {
        npPhotoData = dataUrl;
        document.getElementById('npPhotoPreview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        epPhotoData = dataUrl;
        document.getElementById('epPhotoPreview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── DYNAMIC DUPLICATE ALERT ──
function detectNewPatDuplicates() {
  const name = document.getElementById('npName').value.trim().toLowerCase();
  const phone = cleanPhone(document.getElementById('npPhone').value);
  const warningDiv = document.getElementById('npDupWarning');
  
  if (!name && !phone) {
    warningDiv.style.display = 'none';
    return;
  }
  
  const matches = Object.entries(_patients).filter(([uid, p]) => {
    const info = p.info || {};
    const matchName = name && (info.name || '').trim().toLowerCase().includes(name);
    const matchPhone = phone && cleanPhone(info.phone || '') === phone;
    return matchName || matchPhone;
  });
  
  if (matches.length > 0) {
    let html = `<div style="font-weight:800;margin-bottom:6px"><i class="fas fa-exclamation-triangle"></i> تـنبيه: تم العثور على ملفات مشابهة (${matches.length})</div>`;
    html += matches.map(([uid, p]) => {
      const info = p.info || {};
      return `<div style="display:flex;justify-content:space-between;margin-top:4px;padding:4px 0;border-top:1px dashed rgba(245,158,11,0.15)">
        <span>👤 ${sanitize(info.name)} (MRN: ${info.mrn || '—'})</span>
        <span>📞 ${sanitize(info.phone || '')}</span>
      </div>`;
    }).join('');
    warningDiv.innerHTML = html;
    warningDiv.style.display = 'block';
  } else {
    warningDiv.style.display = 'none';
  }
}

// DOM Loaded
window.addEventListener('DOMContentLoaded', () => {
  if (!CID) {
    alert("خطأ: معرف العيادة غير موجود! يرجى فتح الصفحة من لوحة التحكم.");
    window.location.href = "super.html";
    return;
  }
  
  // Load Theme
  const savedTheme = localStorage.getItem('argon_theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // Bind EMR Login and settings
  db.ref(BASE + '/settings').on('value', snap => {
    _sets = snap.val();
    if (_sets) {
      _sets.mode = (_sets.type === 'complex' || _sets.mode === 'medical_complex') ? 'medical_complex' : 'single_clinic';
      checkAndSeedDefaultDepartments();
      const elClinicName = document.getElementById('lClinicName');
      const elTopName = document.getElementById('topName');
      const elTlogo = document.getElementById('tlogo');
      if (elClinicName) elClinicName.textContent = _sets.name || 'العيادة الطبية';
      // Only set clinic name in topbar if doctor hasn't logged in yet
      if (elTopName && !window._doctorLoggedIn) elTopName.textContent = _sets.name || 'العيادة الطبية';
      if (elTlogo) elTlogo.textContent = _sets.emoji ? `ARGON ${_sets.emoji}` : 'ARGON EMR';
    } else {
      const elClinicName = document.getElementById('lClinicName');
      if (elClinicName) elClinicName.textContent = 'العيادة غير موجودة';
    }
  });

  // Wait for Enterprise Runtime
  window.waitForArgonReady('emr').then(session => {
    window._doctorLoggedIn = true;
    const clinicName = _sets?.name || '';
    const docName = session.displayName || '';
    document.getElementById('topName').innerHTML = `<span style="color:var(--teal);font-weight:800">د. ${docName}</span><span style="margin:0 8px;opacity:0.3">|</span><span style="opacity:0.6;font-size:0.8rem">${clinicName}</span>`;
    initEMR();
  });

  // Load Doctors for dropdowns
  let _doctorsLoaded = false;
  db.ref(BASE + '/doctors').on('value', snap => {
    _doctors = snap.val() || {};
    _doctorsLoaded = true;
  });

  // Load Departments
  db.ref(BASE + '/departments').on('value', snap => {
    _depts = snap.val() || {};
    if (activePatientId && _patients[activePatientId]) {
      viewPatientFile(activePatientId);
    }
  });

  // Load Lab Orders in EMR
  db.ref(BASE + '/lab_orders').on('value', snap => {
    _labOrders = snap.val() || {};
    if (activePatientId && _patients[activePatientId]) {
      viewPatientFile(activePatientId);
    }
  });

  // Load Radiology Orders in EMR
  db.ref(BASE + '/radiology_orders').on('value', snap => {
    _radOrders = snap.val() || {};
    if (activePatientId && _patients[activePatientId]) {
      viewPatientFile(activePatientId);
    }
  });
});
// EMR Initialization
function initEMR() {
  toast('مرحباً بك في نظام السجلات الطبية', 'ok');
  // Run legacy phone-key migration silently on first load
  setTimeout(() => migratePhoneKeyedPatients(), 3000);
  // Load Patients List directly from Firebase
  db.ref(BASE + '/patients').on('value', snap => {
    _patients = snap.val() || {};
    
    // Auto-load patient from URL param on first load
    if (!activePatientId) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPid = urlParams.get('pid');
      const urlPhone = urlParams.get('phone');
      
      const targetId = urlPid || urlPhone;
      if (targetId && _patients[targetId]) {
        viewPatientFile(targetId);
        window.history.replaceState({}, document.title, window.location.pathname + '?id=' + CID);
      }
    }
    
    filterPatients();
  });

  // Load Bookings for Waiting Room
  let bookingLoadTimer = null;
  db.ref(BASE + '/bookings').on('child_added', snap => {
    _liveBookings[snap.key] = snap.val();
    renderWaitingRoom();
    
    // Debounce the patient list filter so it renders correctly after the initial batch of bookings arrives
    clearTimeout(bookingLoadTimer);
    bookingLoadTimer = setTimeout(() => filterPatients(), 300);
  });
  db.ref(BASE + '/bookings').on('child_changed', snap => {
    _liveBookings[snap.key] = snap.val();
    renderWaitingRoom();
  });
  db.ref(BASE + '/bookings').on('child_removed', snap => {
    delete _liveBookings[snap.key];
    renderWaitingRoom();
  });

  // Real-time Notification Engine for Doctors
  const sessionData = window.ArgonSession ? window.ArgonSession.get() : null;
  const sessionUid = sessionData ? sessionData.staffId : null;
  let isInitNotify = true;
  
  db.ref(BASE + '/notifications').orderByChild('createdAt').limitToLast(50).on('child_added', snap => {
    const n = snap.val();
    n.key = snap.key;
    
    // STRICT ISOLATION: Only process notifications targeting this specific doctor
    if (n && n.role === 'doctor' && n.docKey === sessionUid) {
      if (!_myNotifications.find(x => x.key === n.key)) {
        _myNotifications.unshift(n);
        _myNotifications.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        renderDoctorNotifications();
        
        if (!isInitNotify) {
          playNotificationSound();
          toast(`🔔 ${n.title}`, 'ok');
        }
      }
    }
  });

  setTimeout(() => { isInitNotify = false; }, 3000);

// --- DOCTOR NOTIFICATIONS SIDEBAR ---

function renderDoctorNotifications() {
  const notifBadge = document.getElementById('notifBadge');
  const notifList = document.getElementById('notifList');
  const notifTitle = document.getElementById('notifSidebarTitle');
  
  if (!notifBadge || !notifList) return;
  
  if (notifTitle) {
    const docName = window.ArgonSession ? window.ArgonSession.get()?.displayName : '';
    notifTitle.innerHTML = `<i class="fas fa-bell" style="color:var(--amber)"></i> إشعارات د. ${docName || 'الطبيب'}`;
  }

  if (_myNotifications.length > 0) {
    notifBadge.textContent = _myNotifications.length;
    notifBadge.style.display = 'block';
    
    notifList.innerHTML = _myNotifications.map(n => {
      const isLab = (n.title || '').includes('تحاليل') || (n.title || '').includes('🔬');
      const isRad = (n.title || '').includes('أشعة') || (n.title || '').includes('🩻');
      const typeIcon = isLab ? '🧪' : isRad ? '🩻' : '🔔';
      const typeLabel = isLab ? 'نتيجة مختبر' : isRad ? 'نتيجة أشعة' : 'إشعار';
      const typeBg = isLab ? 'rgba(16,185,129,0.15)' : isRad ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.05)';
      const typeBorder = isLab ? 'rgba(16,185,129,0.4)' : isRad ? 'rgba(14,165,233,0.4)' : 'var(--border)';
      const typeColor = isLab ? '#10b981' : isRad ? '#0ea5e9' : 'var(--amber)';
      const ago = window.argonTimeAgo(n.createdAt);
      const isNew = n.createdAt && (Date.now() - new Date(n.createdAt).getTime()) < 120000;
      
      return `
        <div style="background:${typeBg};border:1px solid ${typeBorder};border-radius:12px;padding:14px;cursor:pointer;transition:0.2s;${isNew ? 'animation:notifPulse 2s ease infinite;' : ''}" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'" onclick="openNotification('${n.patientId || ''}', '${n.key}')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:0.75rem;background:${typeColor};color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold">${typeIcon} ${typeLabel}</span>
            <span style="font-size:0.7rem;color:${isNew ? 'var(--amber)' : 'var(--muted)'};font-weight:${isNew ? 'bold' : 'normal'}"><i class="far fa-clock"></i> ${ago}</span>
          </div>
          <div style="font-size:0.85rem;color:var(--text);line-height:1.5;margin-top:4px">${n.message}</div>
        </div>
      `;
    }).join('');
  } else {
    notifBadge.style.display = 'none';
    notifList.innerHTML = `
      <div style="text-align:center;color:var(--muted);margin-top:40px">
        <i class="fas fa-inbox" style="font-size:2rem;opacity:0.3"></i><br>لا يوجد إشعارات حالياً
      </div>
    `;
  }
}

// Auto-refresh relative timestamps every 30 seconds
setInterval(() => { if (_myNotifications.length > 0) renderDoctorNotifications(); }, 30000);

window.toggleNotifications = function() {
  const sidebar = document.getElementById('notifSidebar');
  if (sidebar) {
    if (sidebar.style.left === '0px') {
      sidebar.style.left = '-400px';
    } else {
      sidebar.style.left = '0px';
    }
  }
};

window.openNotification = function(patientId, notifKey) {
  window.toggleNotifications();
  
  if (patientId && patientId !== 'undefined') {
    // 1. Switch sidebar active menu manually
    document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
    const patFileMenu = document.querySelectorAll('.ni')[1]; // 'ملف المريض'
    if (patFileMenu) patFileMenu.classList.add('on');
    
    // 2. Switch main section
    sw('patFile');
    
    // 3. Load Patient Profile
    viewPatientFile(patientId);
  } else {
    toast('⚠️ عذراً، الإشعارات القديمة لا تحتوي على رابط مباشر لملف المريض', 'err');
  }
};

// Close sidebar when clicking outside
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('notifSidebar');
  const btn = document.getElementById('notifBtn');
  if (sidebar && btn && sidebar.style.left === '0px') {
    if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
      sidebar.style.left = '-400px';
    }
  }
});
// ----------------------------------

  // Show referrals sidebar button if license is Medical Complex
  if (_sets && _sets.mode === 'medical_complex') {
    const btn = document.getElementById('referralsMenuBtn');
    if (btn) btn.style.display = 'flex';
  }

  // Enterprise Incremental Referrals Listener
  let _refTimer = null;
  const debounceRef = () => { clearTimeout(_refTimer); _refTimer = setTimeout(renderReferralsList, 80); };
  db.ref(BASE + '/referrals').on('child_added', snap => { _referrals[snap.key] = snap.val(); debounceRef(); });
  db.ref(BASE + '/referrals').on('child_changed', snap => { _referrals[snap.key] = snap.val(); debounceRef(); });
  db.ref(BASE + '/referrals').on('child_removed', snap => { delete _referrals[snap.key]; debounceRef(); });

  // Enterprise Incremental Pharmacy Inventory Listener
  let _invTimer = null;
  const debounceInv = () => { clearTimeout(_invTimer); _invTimer = setTimeout(() => { /* inventory UI update placeholder */ }, 80); };
  db.ref(BASE + '/pharmacy_inventory').on('child_added', snap => { _pharmacyInventory[snap.key] = snap.val(); debounceInv(); });
  db.ref(BASE + '/pharmacy_inventory').on('child_changed', snap => { _pharmacyInventory[snap.key] = snap.val(); debounceInv(); });
  db.ref(BASE + '/pharmacy_inventory').on('child_removed', snap => { delete _pharmacyInventory[snap.key]; debounceInv(); });
}

// ── ENTERPRISE LEGACY MIGRATION ──
// One-time silent migration: converts patients stored with phone-as-key
// to proper Firebase Push Key (UUID), eliminating the primary collision source.
async function migratePhoneKeyedPatients() {
  // Check if migration was already done for this clinic
  const flagSnap = await db.ref(`${BASE}/_meta/phoneKeyMigrationDone`).once('value');
  if (flagSnap.val() === true) return; // Already migrated

  const snap = await db.ref(`${BASE}/patients`).once('value');
  if (!snap.exists()) return;

  const allPatients = snap.val();
  const phoneKeyedEntries = Object.entries(allPatients).filter(([k]) => /^\d+$/.test(k));

  if (!phoneKeyedEntries.length) {
    // No legacy records — mark as done and exit
    await db.ref(`${BASE}/_meta/phoneKeyMigrationDone`).set(true);
    return;
  }

  console.log(`%c🔄 ARGON Migration: Found ${phoneKeyedEntries.length} legacy phone-keyed patient(s). Migrating...`, 'color:#0d9488;font-weight:bold');

  const updates = {};
  const migrated = [];

  for (const [phoneKey, patientData] of phoneKeyedEntries) {
    const phone = cleanPhone(phoneKey);

    // Check if a UUID-keyed record already exists for this phone AND NAME
    // This prevents merging different family members who share a phone number.
    const existingUuid = Object.entries(allPatients).find(([k, p]) => {
      const isMatchPhone = k.startsWith('-') && cleanPhone(p.info?.phone || '') === phone;
      if (!isMatchPhone) return false;
      
      const legacyName = (patientData.info?.name || '').trim().toLowerCase();
      const uuidName   = (p.info?.name || '').trim().toLowerCase();
      
      // If either name is missing, or they match/substring match, we consider it the same person
      if (!legacyName || !uuidName) return true;
      return legacyName === uuidName || legacyName.includes(uuidName) || uuidName.includes(legacyName);
    });

    if (existingUuid) {
      // UUID record already exists — merge visits/data from legacy into it, then delete legacy
      const [uuidKey, uuidData] = existingUuid;
      const legacyVisits   = patientData.visits   || {};
      const legacyInvoices = patientData.invoices  || {};

      // Copy visits not already in UUID record
      Object.entries(legacyVisits).forEach(([vk, vv]) => {
        if (!uuidData.visits?.[vk]) {
          updates[`${BASE}/patients/${uuidKey}/visits/${vk}`] = vv;
        }
      });
      // Copy invoices not already in UUID record
      Object.entries(legacyInvoices).forEach(([ik, iv]) => {
        if (!uuidData.invoices?.[ik]) {
          updates[`${BASE}/patients/${uuidKey}/invoices/${ik}`] = iv;
        }
      });
      // Merge missing info fields
      const legacyInfo = patientData.info || {};
      const mergedInfo = { ...legacyInfo, ...uuidData.info }; // UUID info takes priority
      updates[`${BASE}/patients/${uuidKey}/info`] = mergedInfo;

      // Delete legacy phone-keyed record
      updates[`${BASE}/patients/${phoneKey}`] = null;
      migrated.push(`${legacyInfo.name || phoneKey} (دمج في ${uuidKey})`);

    } else {
      // No UUID record — create a new one with proper Push Key
      const newRef = db.ref(`${BASE}/patients`).push();
      const newKey = newRef.key;
      // Ensure MRN exists
      if (!patientData.info) patientData.info = {};
      if (!patientData.info.mrn) patientData.info.mrn = genMRN();

      updates[`${BASE}/patients/${newKey}`] = patientData;
      updates[`${BASE}/patients/${phoneKey}`] = null;
      migrated.push(`${patientData.info.name || phoneKey} → ${newKey}`);
    }
  }

  // Mark migration as complete
  updates[`${BASE}/_meta/phoneKeyMigrationDone`] = true;
  updates[`${BASE}/_meta/phoneKeyMigrationDate`] = new Date().toISOString();
  updates[`${BASE}/_meta/phoneKeyMigrationCount`] = migrated.length;

  await db.ref().update(updates);
  console.log(`%c✅ ARGON Migration Complete: ${migrated.length} patient(s) migrated.`, 'color:#10b981;font-weight:bold');
  migrated.forEach(m => console.log(`   ✔ ${m}`));

  if (migrated.length > 0) {
    toast(`✅ تم ترحيل ${migrated.length} ملف طبي قديم إلى نظام UUID الحديث`, 'ok');
  }
}

// Sidebar Navigation
function sw(id, el) {
  // Prevent opening empty clinical workspace if no patient is active
  if (id === 'newVisit') {
    if (typeof activeVisit === 'undefined' || !activeVisit || !activeVisit.uid) {
      if (typeof toast !== 'undefined') toast('⚠️ الرجاء اختيار مريض من غرفة الانتظار أولاً لبدء زيارة', 'warn');
      return;
    }
  }

  // Release patient locks when leaving patient-specific contexts
  if (id !== 'patFile' && id !== 'newVisit') {
    if (window.EMRContext && window.EMRContext.sessionLock) {
      if (typeof BASE !== 'undefined' && window.EMRContext.activePatientId) {
        db.ref(`${BASE}/active_sessions/${window.EMRContext.activePatientId}`).remove();
      }
      window.EMRContext.sessionLock = false;
      window.EMRContext.activePatientId = null;
    }
  }

  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  if (el) el.classList.add('on');
}

// Toast
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = type ? 'show ' + type : 'show';
  setTimeout(() => t.className = '', 3000);
}

// Theme
function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', nextTheme);
  localStorage.setItem('argon_theme', nextTheme);
  updateThemeIcon(nextTheme);
}
function updateThemeIcon(theme) {
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// Render Patients List
let patPageLimit = 15;
let lastQuery = '';

function renderPatientsList(entries) {
  const grid = document.getElementById('patGrid');
  if (!entries.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
      <i class="fas fa-users-slash" style="font-size:2.5rem;margin-bottom:10px;opacity:.3"></i>
      <p>لا يوجد مرضى مسجلين بعد</p>
    </div>`;
    return;
  }

  const sliced = entries.slice(0, patPageLimit);
  let html = sliced.map(([uid, p]) => {
    const info = p.info || {};
    const genderIcon = info.gender === 'ذكر' ? '👨' : info.gender === 'أنثى' ? '👩' : '👤';
    const ageStr = info.age ? `${info.age} سنة` : '';
    const genderStr = info.gender || '';
    const ageGender = [ageStr, genderStr].filter(Boolean).join(' · ');
    const nationalId = info.nationalId ? `<span style="font-size:10px;color:var(--muted);font-family:monospace;direction:ltr">🪪 ${sanitize(info.nationalId)}</span>` : '';
    
    // Detect potential duplicates — show warning badge if same name+phone as another
    const dupCount = Object.values(_patients).filter(pp => pp.info && pp.info.name === info.name && pp.info.phone === info.phone).length;
    const dupBadge = dupCount > 1 ? `<span style="background:rgba(245,158,11,0.12);color:var(--amber);border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700;margin-right:5px">⚠️ تعارض محتمل</span>` : '';
    
    const avatarHTML = info.photo 
      ? `<div class="plist-avatar"><img src="${info.photo}"></div>`
      : `<div class="plist-avatar" style="font-size:1.5rem">${genderIcon}</div>`;

    return `<div class="plist-card" onclick="viewPatientFile('${uid}')">
      ${avatarHTML}
      <div class="plist-info">
        <div class="plist-name">${sanitize(info.name)} ${dupBadge}</div>
        <div class="plist-meta">${sanitize(info.phone || '')} ${ageGender ? `· ${ageGender}` : ''}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <div class="plist-mrn">${info.mrn || 'MRN-NEW'}</div>
          ${nationalId}
        </div>
      </div>
    </div>`;
  }).join('');

  if (entries.length > patPageLimit) {
    html += `
      <div id="patLoadMoreContainer" style="grid-column:1/-1; text-align:center; padding:15px 0;">
        <button class="btn-secondary" onclick="loadMorePatients()" style="width:100%; justify-content:center; padding:12px; border-radius:8px;">
          <i class="fas fa-chevron-down"></i> عرض المزيد (${entries.length - patPageLimit} مرضى إضافيين)
        </button>
      </div>
    `;
  }
  grid.innerHTML = html;
}

function loadMorePatients() {
  patPageLimit += 15;
  filterPatients();
}

// Smart Filter — Doctor-isolated: shows only patients booked with this doctor OR manually created by this doctor
function filterPatients() {
  const q = document.getElementById('patSearch').value.toLowerCase().trim();
  if (q !== lastQuery) {
    patPageLimit = 15;
    lastQuery = q;
  }

  const session = ArgonSession.get() || {};
  const loggedInDoctorId = session.staffId;
  const isAdmin = session.role === 'admin';

  // Build the set of patient IDs/phones that have at least one booking for THIS doctor
  let allowedPatients = null;
  if (loggedInDoctorId && !isAdmin) {
    allowedPatients = new Set();
    Object.values(_liveBookings).forEach(b => {
      const assignedDoc = b.doctorId || b.docKey;
      if (assignedDoc === loggedInDoctorId) {
        if (b.patientId) allowedPatients.add(b.patientId);
        if (b.patPhone) allowedPatients.add(b.patPhone);
      }
    });
  }

  const entries = Object.entries(_patients).filter(([uid, p]) => {
    const info = p.info || {};
    
    // Enforce doctor isolation on patient list
    if (allowedPatients !== null) {
      const phone = info.phone || '';
      const createdByMe = info.createdBy === loggedInDoctorId;
      if (!createdByMe && !allowedPatients.has(uid) && !allowedPatients.has(phone)) {
        return false;
      }
    }

    if (!q) return true;
    return (info.phone || '').includes(q) ||
           (info.name || '').toLowerCase().includes(q) ||
           (info.mrn || '').toLowerCase().includes(q) ||
           (info.nationalId || '').toLowerCase().includes(q) ||
           uid.includes(q);
  });
  renderPatientsList(entries);
}

// Render Waiting Room
function renderWaitingRoom() {
  const wrList = document.getElementById('wrList');
  if (!wrList) return;

  const session = ArgonSession.get() || {};
  const loggedInDoctorId = session.staffId;
  const isAdmin = session.role === 'admin';

  const activeBookings = Object.entries(_liveBookings).filter(([k, b]) => {
    if (b.status === 'done' || b.status === 'completed' || b.status === 'cancelled') return false;
    
    // ═══ STRICT DOCTOR ISOLATION ═══
    // Every booking MUST have a doctorId — bookings without one are admin-only
    const assignedDoc = b.doctorId || b.docKey;
    if (!isAdmin) {
      if (!assignedDoc) return false;                          // No doctor assigned → invisible
      if (assignedDoc !== loggedInDoctorId) return false;     // Wrong doctor → blocked
    }
    return true;
  }).sort((a, b) => {
    const prio = { 'with_doctor': 1, 'waiting': 2, 'confirmed': 3, 'new': 4 };
    const pA = prio[a[1].status] || 5;
    const pB = prio[b[1].status] || 5;
    if (pA !== pB) return pA - pB;
    return (a[1].time || '').localeCompare(b[1].time || '');
  });

  if (!activeBookings.length) {
    wrList.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
      <i class="fas fa-bed" style="font-size:2.5rem;margin-bottom:10px;opacity:.3"></i>
      <p>غرفة الانتظار فارغة حالياً</p>
    </div>`;
    return;
  }

  const stMap = {
    'new': 'حجز جديد',
    'confirmed': 'مؤكد',
    'waiting': 'في غرفة الانتظار ⏳',
    'with_doctor': 'عند الطبيب 🩺'
  };
  const stColor = {
    'new': 'var(--sky)',
    'confirmed': 'var(--teal)',
    'waiting': 'var(--amber)',
    'with_doctor': 'var(--purple)'
  };

  wrList.innerHTML = activeBookings.map(([k, b]) => {
    const isDoc = b.status === 'with_doctor';
    // Pass booking key so we can resolve by name+phone
    return `<div class="glass-panel" style="padding:16px;border-right:4px solid ${stColor[b.status]||'var(--teal)'}; cursor:pointer; transition:all 0.2s" onclick="openPatientFromBooking('${k}')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:0.75rem;font-weight:800;color:${stColor[b.status]};background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:12px">${stMap[b.status]||b.status}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.8rem">${b.time||'—'}</span>
      </div>
      <div style="font-weight:800;font-size:1.05rem;margin-bottom:4px">${sanitize(b.patName)}</div>
      <div style="font-size:0.8rem;color:var(--muted);margin-bottom:8px">📞 ${sanitize(b.patPhone)}</div>
      ${isDoc ? `<button class="btn-primary btn-sm" style="width:100%;background:rgba(168,85,247,0.1);color:#a855f7;border:1px solid rgba(168,85,247,0.3)" onclick="event.stopPropagation(); openPatientFromBooking('${k}', true)"><i class="fas fa-stethoscope"></i> بدء زيارة طبية</button>` : ''}
    </div>`;
  }).join('');
}

// Open patient file from waiting room — resolves correct patient by phone+name from booking
function openPatientFromBooking(bookingKey, startVisit = false) {
  const booking = _liveBookings[bookingKey] || {};
  const rawUid = booking.patientId || booking.patPhone;
  const bookingName = (booking.patName || '').trim().toLowerCase();

  if (!rawUid) {
    toast('⚠️ لا توجد بيانات مرتبطة بهذا الحجز', 'err');
    return;
  }

  // 1️⃣ Direct Firebase Push Key match (patientId) WITH Strict Name Integrity
  if (booking.patientId && _patients[booking.patientId]) {
    const pInfo = _patients[booking.patientId].info || {};
    const patName = (pInfo.name || '').trim().toLowerCase();
    
    // Strict Check: If names are radically different, the booking system mistakenly linked them due to a shared phone
    let nameMismatch = false;
    if (!bookingName || !patName) {
      nameMismatch = true; // If one is empty, we can't trust it. It's a mismatch.
    } else {
      // Compare first names strictly to avoid family name overlap
      const bFirstName = bookingName.split(' ')[0];
      const pFirstName = patName.split(' ')[0];
      
      if (bFirstName !== pFirstName) {
        nameMismatch = true;
      }
    }

    if (!nameMismatch) {
      if (startVisit) {
        sw('newVisit');
        loadVisitForm(booking.patientId);
      } else {
        viewPatientFile(booking.patientId);
        sw('patFile');
      }
      return;
    } else {
      console.warn('⚠️ EMR Integrity: Booking PatientID mismatch with Name. Falling back to phone resolver.', { bookingName, patName });
      // Clear the poisoned patientId for this resolution attempt
      booking.patientId = null; 
    }
  }

  // 2️⃣ Search by Phone
  const phone = cleanPhone(booking.patPhone || rawUid);
  const matched = Object.entries(_patients).filter(([k, p]) =>
    cleanPhone(p.info?.phone || '') === phone ||
    cleanPhone(k) === phone
  );

  if (!matched.length) {
    toast('⚠️ ملف المريض غير موجود. يرجى تسجيله من لوحة الاستقبال.', 'err');
    return;
  }

  // 3️⃣ Try to find an exact or partial name match among the phone matches
  if (bookingName) {
    const exact = matched.find(([k, p]) => (p.info?.name || '').trim().toLowerCase() === bookingName);
    if (exact) {
      if (startVisit) { sw('newVisit'); loadVisitForm(exact[0]); } else { viewPatientFile(exact[0]); sw('patFile'); }
      return;
    }

    const partial = matched.find(([k, p]) => {
      const pn = (p.info?.name || '').toLowerCase().trim();
      const bFirst = bookingName.split(' ')[0];
      const pFirst = pn.split(' ')[0];
      return bFirst && pFirst && bFirst === pFirst;
    });
    if (partial) {
      if (startVisit) { sw('newVisit'); loadVisitForm(partial[0]); } else { viewPatientFile(partial[0]); sw('patFile'); }
      return;
    }
  }

  // 4️⃣ If we have exactly 1 match and no name conflict was explicitly detected (or name was missing)
  if (matched.length === 1 && !bookingName) {
    if (startVisit) { sw('newVisit'); loadVisitForm(matched[0][0]); } else { viewPatientFile(matched[0][0]); sw('patFile'); }
    return;
  }

  // 5️⃣ Ambiguous (Family members sharing a phone, and name didn't match perfectly)
  // Instead of showing a popup with other doctor's patients, auto-register the patient now!
  toast('⚠️ يتم الآن فتح وتجهيز ملف المريض...', 'ok');
  
  // Create a new patient profile since the name didn't match anyone in the family
  const newRef = db.ref(`${BASE}/patients`).push();
  const patPhone = cleanPhone(booking.patPhone || '');
  const session = ArgonSession.get() || {};
  const loggedInDoctorId = session.staffId || null;
  
  const patObj = {
    info: {
      name: booking.patName || 'مريض',
      phone: patPhone,
      age: booking.patAge ? parseInt(booking.patAge) : null,
      gender: booking.patGender || '',
      mrn: 'MRN-' + Math.floor(100000 + Math.random() * 900000),
      createdAt: new Date().toISOString(),
      createdBy: loggedInDoctorId
    }
  };

  // Inject into local memory immediately so viewPatientFile doesn't abort due to Firebase latency
  _patients[newRef.key] = patObj;

  newRef.set(patObj).then(() => {
    db.ref(`${BASE}/bookings/${bookingKey}/patientId`).set(newRef.key).then(() => {
      if (startVisit) { sw('newVisit'); loadVisitForm(newRef.key); } else { viewPatientFile(newRef.key); sw('patFile'); }
    });
  });
}

// Modal management
function openNewPatient() {
  document.getElementById('newPatModal').style.display = 'flex';
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Generate MRN (Medical Record Number) - Enterprise Format
function genMRN() {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(1000000 + Math.random() * 9000000)).substring(1); // 6 digit sequence
  const branchCode = _sets && _sets.branchCode ? _sets.branchCode : 'CLN01';
  return `JOR-AMM-${branchCode}-${year}-${seq}`;
}

// Normalize phone number to use as a consistent database key (prevents duplicates)
function cleanPhone(p) {
  let clean = String(p || '').trim().replace(/\D/g, '');
  if (clean.startsWith('962')) clean = clean.substring(3);
  if (clean.startsWith('0')) clean = clean.substring(1);
  return clean;
}

// Edit Patient — uses UID (UUID or phone for legacy records)
function openEditPatient(uid) {
  const p = _patients[uid];
  if (!p) return;
  document.getElementById('epOldPhone').value = uid;
  document.getElementById('epName').value = p.info.name || '';
  document.getElementById('epPhone').value = p.info.phone || uid;
  document.getElementById('epNationalId').value = p.info.nationalId || '';
  document.getElementById('epAge').value = p.info.age || '';
  document.getElementById('epGender').value = p.info.gender || '';
  document.getElementById('epBlood').value = p.info.bloodType || '';
  document.getElementById('epAllergies').value = (p.info.allergies || []).join('، ');
  document.getElementById('epChronic').value = (p.info.chronicDiseases || []).join('، ');
  document.getElementById('epNotes').value = p.info.notes || '';
  
  if (p.info.photo) {
    epPhotoData = p.info.photo;
    document.getElementById('epPhotoPreview').innerHTML = `<img src="${p.info.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    epPhotoData = '';
    document.getElementById('epPhotoPreview').innerHTML = '👤';
  }
  
  document.getElementById('editPatModal').style.display = 'flex';
}

function saveEditPatient() {
  const uid = document.getElementById('epOldPhone').value;
  if (!uid || !_patients[uid]) return;

  const name = document.getElementById('epName').value.trim();
  const phone = cleanPhone(document.getElementById('epPhone').value);
  const nationalId = document.getElementById('epNationalId').value.trim();
  const age = document.getElementById('epAge').value.trim();
  const gender = document.getElementById('epGender').value;
  const blood = document.getElementById('epBlood').value;
  const allergies = document.getElementById('epAllergies').value.trim().split(/[،,]/).map(s => s.trim()).filter(Boolean);
  const chronic = document.getElementById('epChronic').value.trim().split(/[،,]/).map(s => s.trim()).filter(Boolean);
  const notes = document.getElementById('epNotes').value.trim();

  if (!name) {
    toast('⚠️ يرجى إدخال الاسم الكامل', 'err');
    return;
  }

  const updates = {
    name: sanitize(name),
    phone: sanitize(phone),
    nationalId: nationalId ? sanitize(nationalId) : null,
    age: age ? parseInt(age) : null,
    gender: sanitize(gender),
    bloodType: sanitize(blood),
    allergies: allergies.length ? allergies : null,
    chronicDiseases: chronic.length ? chronic : null,
    notes: sanitize(notes),
    photo: epPhotoData || null
  };

  db.ref(`${BASE}/patients/${uid}/info`).update(updates).then(() => {
    logAudit('EDIT_PATIENT', `تم تعديل بيانات المريض ${updates.name} (${uid})`, 'EMR');
    toast('✅ تم تحديث بيانات المريض بنجاح', 'ok');
    closeModal('editPatModal');
    if (activePatientId === uid) {
      viewPatientFile(uid);
    }
  }).catch(e => {
    toast('❌ خطأ أثناء التحديث: ' + e.message, 'err');
  });
}

// ═══════════════════════════════════════════════════════════════════
// SMART PATIENT SAVE — UUID-Based (No data overwrite possible)
// Each patient gets a unique Firebase Push Key regardless of duplicate
// names or phone numbers. Families can share the same phone safely.
// National ID is used as an optional disambiguation layer.
// ═══════════════════════════════════════════════════════════════════
function saveNewPatient() {
  const name = document.getElementById('npName').value.trim();
  const phone = cleanPhone(document.getElementById('npPhone').value);
  const nationalId = document.getElementById('npNationalId').value.trim();
  const age = document.getElementById('npAge').value.trim();
  const gender = document.getElementById('npGender').value;
  const blood = document.getElementById('npBlood').value;
  const allergies = document.getElementById('npAllergies').value.trim().split(',').map(s => s.trim()).filter(Boolean);
  const chronic = document.getElementById('npChronic').value.trim().split(',').map(s => s.trim()).filter(Boolean);
  const notes = document.getElementById('npNotes').value.trim();

  if (!name || !phone) {
    toast('⚠️ يرجى إدخال الاسم ورقم الهاتف', 'err');
    return;
  }

  // Smart Duplicate Detection — warn doctor if same name + phone + nationalId already exists
  const duplicateEntry = Object.entries(_patients).find(([uid, p]) => {
    const info = p.info || {};
    const samePhone = info.phone && cleanPhone(info.phone) === phone;
    const sameName = (info.name || '').trim().toLowerCase() === name.toLowerCase();
    const sameNid = nationalId && info.nationalId && info.nationalId.trim() === nationalId;
    return samePhone && sameName && (sameNid || nationalId === '');
  });

  if (duplicateEntry) {
    const [dupUid, dupData] = duplicateEntry;
    const info = dupData.info || {};
    const hasNid = info.nationalId;
    if (nationalId && hasNid) {
      // National ID match — definitely the same person
      toast(`⚠️ هذا المريض موجود مسبقاً (${info.mrn})`, 'err');
      closeModal('newPatModal');
      viewPatientFile(dupUid);
      return;
    }
    if (!nationalId) {
      // Warn but still ask for National ID to confirm distinction
      const confirm = window.confirm(
        `⚠️ يوجد مريض بنفس الاسم ورقم الهاتف (${info.mrn}).\n\nهل هذا شخص مختلف؟ (مثلاً: أحد أفراد العائلة)\n\nأدخل الرقم الوطني للتمييز إن كان متوفراً، ثم اضغط موافق للمتابعة.`
      );
      if (!confirm) {
        viewPatientFile(dupUid);
        closeModal('newPatModal');
        return;
      }
    }
  }

  const session = ArgonSession.get() || {};
  const loggedInDoctorId = session.staffId || null;

  const mrn = genMRN();
  const patObj = {
    info: {
      name: sanitize(name),
      phone: sanitize(phone),
      nationalId: nationalId ? sanitize(nationalId) : null,
      age: age ? parseInt(age) : null,
      gender: sanitize(gender),
      bloodType: sanitize(blood),
      allergies,
      chronicDiseases: chronic,
      mrn,
      notes: sanitize(notes),
      photo: npPhotoData || null,
      createdAt: new Date().toISOString(),
      createdBy: loggedInDoctorId
    }
  };

  // Use Firebase push() to generate a guaranteed-unique UUID key
  const newRef = db.ref(`${BASE}/patients`).push();
  const newUid = newRef.key;

  newRef.set(patObj).then(() => {
    logAudit('CREATE_PATIENT', `تم تسجيل مريض جديد ${patObj.info.name} (${newUid}) - MRN: ${mrn}`, 'EMR');
    toast(`✅ تم تسجيل المريض بنجاح — ${mrn}`, 'ok');
    closeModal('newPatModal');
    ['npName', 'npPhone', 'npNationalId', 'npAge', 'npAllergies', 'npChronic', 'npNotes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('npGender').value = '';
    document.getElementById('npBlood').value = '';
    document.getElementById('npPhotoPreview').innerHTML = '👤';
    npPhotoData = '';
    
    // Reset warning banner
    const warningDiv = document.getElementById('npDupWarning');
    if (warningDiv) {
      warningDiv.style.display = 'none';
      warningDiv.innerHTML = '';
    }

    viewPatientFile(newUid);
  }).catch(() => toast('❌ فشل حفظ المريض', 'err'));
}

function viewPatientFile(phoneOrUid) {
  return safeViewPatientFile(phoneOrUid);
}

async function safeViewPatientFile(phoneOrUid) {
  if (window.EMRContext && window.EMRContext.sessionLock) return;
  
  const token = crypto.randomUUID();
  window.EMRContext.renderToken = token;

  const session = window.ArgonSession ? ArgonSession.get() : {};
  const loggedInDoctorId = session?.staffId || session?.username || null;
  const isAdmin = session?.role === 'admin';

  let uid = phoneOrUid;
  
  if (!_patients[uid]) {
    const cleanP = cleanPhone(phoneOrUid);
    const matched = Object.entries(_patients).filter(([k, p]) => {
      return (p.info && cleanPhone(p.info.phone) === cleanP) || k === cleanP;
    });
    
    if (matched.length === 1) {
      uid = matched[0][0];
    } else if (matched.length > 1) {
      showDoctorProfileSelector(matched, phoneOrUid);
      return;
    } else {
      toast('⚠️ لم يتم العثور على الملف الطبي لهذا المريض', 'err');
      return;
    }
  }

  // Global Soft Lock Check
  if (typeof BASE !== 'undefined') {
    const lockRef = db.ref(`${BASE}/active_sessions/${uid}`);
    const lockSnap = await lockRef.once('value');
    if (lockSnap.exists()) {
      const lockData = lockSnap.val();
      if (!isAdmin && lockData.doctorId !== loggedInDoctorId) {
        toast(`الملف الطبي مفتوح لتعديله بواسطة ${lockData.doctorName}`, 'err');
        if (window.AuditAPI) window.AuditAPI.log('PATIENT_FILE_LOCKED_CONFLICT', { patientId: uid, lockedBy: lockData.doctorId });
        return;
      }
    }

    // Acquire Global Soft Lock
    await lockRef.set({
      doctorId: loggedInDoctorId,
      doctorName: session?.displayName || session?.name || 'طبيب',
      lockedAt: Date.now()
    });
    lockRef.onDisconnect().remove();
  }

  // Lock Context
  window.EMRContext.sessionLock = true;
  window.EMRContext.activePatientId = uid;
  window.EMRContext.activeDoctorId = loggedInDoctorId;
  window.EMRContext.lastOpenedAt = Date.now();
  window.EMRContext.renderVersion++;
  window.EMRContext.initialized = true;

  if (window.AuditAPI) {
    window.AuditAPI.log('SESSION_LOCK_TRIGGERED', { patientId: uid });
    window.AuditAPI.log('PATIENT_FILE_OPENED', { patientId: uid });
  }

  activePatientId = uid;
  const p = _patients[uid];
  
  if (window.EMRContext.renderToken !== token) {
      if (window.AuditAPI) window.AuditAPI.log('STALE_RENDER_ABORTED', { token });
      return;
  }
  
  if (!p) {
      window.EMRContext.sessionLock = false;
      return;
  }

  const info = p.info || {};
  
  // Sort visits descending chronologically down to the minute using parseArabicTime
  const visits = Object.entries(p.visits || {}).sort((a,b) => {
    const dateTimeA = (a[1].date || '') + 'T' + parseArabicTime(a[1].time || '');
    const dateTimeB = (b[1].date || '') + 'T' + parseArabicTime(b[1].time || '');
    return dateTimeB.localeCompare(dateTimeA);
  });
  
  // Demographics HTML
  const allergiesHTML = (info.allergies || []).map(a => `<span class="tag">${sanitize(a)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
  const chronicHTML = (info.chronicDiseases || []).map(c => `<span class="tag blue">${sanitize(c)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';

  let visitsTimelineHTML = `<div style="color:var(--muted);text-align:center;padding:20px;">لا يوجد زيارات سابقة</div>`;
  if (visits.length) {
    let lastDate = null;
    visitsTimelineHTML = visits.map(([vk, v]) => {
      let dateGroupDivider = '';
      if (v.date !== lastDate) {
        lastDate = v.date;
        dateGroupDivider = `
          <div class="timeline-date-group">
            <span><i class="far fa-calendar-alt"></i> ${formatArabicDate(v.date)}</span>
          </div>`;
      }

      const rxList = (v.prescriptions || []).map(r => `• ${sanitize(r.name)} (${sanitize(r.dose || '—')}) - ${sanitize(r.freq || '—')}`).join('<br>');
      const attList = (v.attachments || []).map(a => `
        <div class="att-item" onclick="openAttachment('${a.data}', '${sanitize(a.type)}')">
          <i class="fas ${a.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}"></i>
          <span class="att-name">${sanitize(a.name)}</span>
        </div>
      `).join('') || '';

      const vitalVals = v.vitals || {};
      const hasVitals = vitalVals.temp || vitalVals.bp || vitalVals.pulse;
      const vitalsSummary = hasVitals ? `
        <div class="vitals-grid">
          ${vitalVals.temp ? `<div class="vital-card"><div class="vital-val">${vitalVals.temp}°C</div><div class="vital-lbl">الحرارة</div></div>` : ''}
          ${vitalVals.bp ? `<div class="vital-card"><div class="vital-val">${vitalVals.bp}</div><div class="vital-lbl">الضغط</div></div>` : ''}
          ${vitalVals.pulse ? `<div class="vital-card"><div class="vital-val">${vitalVals.pulse}/m</div><div class="vital-lbl">النبض</div></div>` : ''}
        </div>
      ` : '';

      const labArr = Array.isArray(v.labOrders) ? v.labOrders : Object.values(v.labOrders || {});
      const radArr = Array.isArray(v.radOrders) ? v.radOrders : Object.values(v.radOrders || {});
      const labReqsStr = labArr.join(' ، ');
      const radReqsStr = radArr.join(' ، ');

      // Upgraded Departmental Card stylings
      const isPharmacist = v.docKey === 'pharmacist';
      const isLab = v.docKey === 'lab';
      const isRad = v.docKey === 'radiology';
      const isReferral = v.docKey === 'referral';
      
      let cardIcon = 'fa-stethoscope';
      let dotColor = 'done';
      let cardStyle = '';
      
      if (isPharmacist) {
        cardIcon = 'fa-pills';
        dotColor = 'amber';
        cardStyle = 'border-right: 4px solid var(--amber); background: rgba(245, 158, 11, 0.03);';
      } else if (isLab) {
        cardIcon = 'fa-flask';
        dotColor = 'teal';
        cardStyle = 'border-right: 4px solid var(--teal); background: rgba(13, 148, 136, 0.03);';
      } else if (isRad) {
        cardIcon = 'fa-x-ray';
        dotColor = 'sky';
        cardStyle = 'border-right: 4px solid var(--sky); background: rgba(14, 165, 233, 0.03);';
      } else if (isReferral) {
        cardIcon = 'fa-exchange-alt';
        dotColor = 'purple';
        cardStyle = 'border-right: 4px solid #a855f7; background: rgba(168, 85, 247, 0.03);';
      }

      const notesHTML = (isPharmacist || isLab || isRad || isReferral) ? v.notes : sanitize(v.notes || 'لا يوجد ملاحظات إضافية');

      return `
        ${dateGroupDivider}
        <div class="tl-item">
          <div class="tl-dot ${dotColor}"></div>
          <div class="tl-card" style="${cardStyle}" onclick="this.classList.toggle('open')">
            <div class="tl-head">
              <span class="tl-date">${v.date} · ${v.time}</span>
              <span class="tl-doc"><i class="fas ${cardIcon}"></i> ${sanitize(v.docName)}</span>
            </div>
            <div class="tl-diag">${sanitize(v.diagnosis || 'زيارة طبية')}</div>
            <div style="font-size:.8rem;color:var(--muted);display:flex;justify-content:space-between">
              <span>🔍 الشكوى / الموضوع: ${sanitize(v.complaint || 'مراجعة')}</span>
              <span style="color:var(--teal);font-weight:700"><i class="fas fa-chevron-down"></i> تفاصيل</span>
            </div>
            <div class="tl-body">
              ${vitalsSummary}
              <div style="margin-top:10px"><b>📝 التفاصيل والتقرير:</b><p style="font-size:.82rem;margin-top:4px;line-height:1.6">${notesHTML}</p></div>
              
              ${rxList ? `<div style="margin-top:10px"><b>💊 الوصفة الدوائية:</b><p style="font-size:.82rem;margin-top:4px;color:var(--amber);line-height:1.6">${rxList}</p></div>` : ''}
              
              ${labReqsStr ? `<div style="margin-top:10px"><b>🔬 الفحوصات المخبرية المطلوبة:</b> <span class="tag" style="background:rgba(13,148,136,0.12);border:1px solid var(--teal);color:var(--teal);font-size:0.75rem">${sanitize(labReqsStr)}</span></div>` : ''}
              ${radReqsStr ? `<div style="margin-top:10px"><b>🩻 صور الأشعة المطلوبة:</b> <span class="tag blue" style="background:rgba(14,165,233,0.12);border:1px solid var(--sky);color:var(--sky);font-size:0.75rem">${sanitize(radReqsStr)}</span></div>` : ''}
              
              ${attList ? `<div style="margin-top:12px"><b>📁 المرفقات الطبية وصور الأشعة:</b><div class="att-grid" style="margin-top:6px">${attList}</div></div>` : ''}
              
              <div style="margin-top:14px;display:flex;justify-content:flex-end">
                <button class="btn-secondary btn-sm" onclick="event.stopPropagation();printVisitSummary('${vk}')"><i class="fas fa-print"></i> طباعة الملخص</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // Get department specific order lists for this patient
  const patientLabOrders = Object.entries(_labOrders).filter(([k, o]) => o.patientId === uid || (o.patientPhone && cleanPhone(o.patientPhone) === cleanPhone(info.phone || uid)));
  const patientRadOrders = Object.entries(_radOrders).filter(([k, o]) => o.patientId === uid || (o.patientPhone && cleanPhone(o.patientPhone) === cleanPhone(info.phone || uid)));

  let labOrdersHTML = `
    <div style="text-align:center;padding:30px;color:var(--muted)" class="glass-panel">لا يوجد طلبات فحوصات مخبرية مسجلة لهذا المريض</div>`;
  if (patientLabOrders.length) {
    labOrdersHTML = patientLabOrders.map(([k, o]) => {
      const tests = (o.requestedTests || []).map(t => {
        let resStr = '';
        if (t.status === 'completed') {
          resStr = `: <b style="color:var(--teal)">${sanitize(t.result)}</b> ${sanitize(t.unit)}`;
        }
        return `• ${sanitize(t.name)}${resStr}`;
      }).join('<br>');
      const statusText = o.status === 'completed' ? 'جاهزة ومكتملة ✅' : 'قيد الفحص والتحليل ⏳';
      const statusColor = o.status === 'completed' ? 'var(--green)' : 'var(--amber)';
      
      return `
        <div class="glass-panel" style="padding:14px;margin-bottom:10px;border-right:4px solid ${statusColor}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:0.75rem;color:var(--muted)">تاريخ الطلب: ${(o.createdAt || '').substring(0,10)}</span>
            <span style="font-size:0.75rem;color:${statusColor};font-weight:800">${statusText}</span>
          </div>
          <div style="font-size:0.82rem;margin-bottom:6px"><b>🔬 الفحوصات:</b><br>${tests}</div>
          ${o.notes ? `<div style="font-size:0.78rem;color:var(--muted);background:rgba(255,255,255,0.02);padding:6px;border-radius:6px;margin-top:4px"><b>ملاحظات الفني:</b> ${sanitize(o.notes)}</div>` : ''}
          ${o.attachment ? `
            <div style="margin-top:8px;text-align:left">
              <button class="btn-secondary btn-sm" onclick="openAttachment('${o.attachment}','pdf')"><i class="fas fa-file-pdf"></i> عرض تقرير الـ PDF المرفق</button>
            </div>` : ''}
        </div>`;
    }).join('');
  }

  let radOrdersHTML = `
    <div style="text-align:center;padding:30px;color:var(--muted)" class="glass-panel">لا يوجد طلبات تصوير أشعة مسجلة لهذا المريض</div>`;
  if (patientRadOrders.length) {
    radOrdersHTML = patientRadOrders.map(([k, o]) => {
      const scans = (o.requestedScans || []).map(s => `• ${sanitize(s.name)}`).join('<br>');
      const statusText = o.status === 'completed' ? 'جاهزة ومكتملة ✅' : 'بانتظار التصوير ⏳';
      const statusColor = o.status === 'completed' ? 'var(--green)' : 'var(--amber)';
      
      return `
        <div class="glass-panel" style="padding:14px;margin-bottom:10px;border-right:4px solid ${statusColor}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:0.75rem;color:var(--muted)">تاريخ الطلب: ${(o.createdAt || '').substring(0,10)}</span>
            <span style="font-size:0.75rem;color:${statusColor};font-weight:800">${statusText}</span>
          </div>
          <div style="font-size:0.82rem;margin-bottom:6px"><b>🩻 صور الأشعة المطلوبة:</b><br>${scans}</div>
          ${o.report ? `<div style="font-size:0.8rem;background:rgba(255,255,255,0.02);padding:8px;border-radius:6px;margin-top:4px;color:var(--text)"><b>📝 التقرير الطبي للأشعة:</b><br>${o.report.replace(/\n/g,'<br>')}</div>` : ''}
          ${o.image ? `
            <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:0.7rem;color:var(--sky);cursor:pointer" onclick="openAttachment('${o.image}','image')"><i class="fas fa-expand-arrows-alt"></i> اضغط لتكبير الصورة التشخيصية</span>
              <button class="btn-secondary btn-sm" onclick="openAttachment('${o.image}','image')"><i class="fas fa-eye"></i> عرض صورة الأشعة</button>
            </div>` : ''}
        </div>`;
    }).join('');
  }

  const activeAvatarHTML = info.photo 
    ? `<div class="pat-avatar"><img src="${info.photo}"></div>` 
    : `<div class="pat-avatar">👤</div>`;

  const fileHTML = `
    <div class="pat-card">
      <div class="pat-top">
        ${activeAvatarHTML}
        <div style="flex:1">
          <div class="pat-name">${sanitize(info.name)}</div>
          <div class="pat-mrn">الملف الطبي: ${info.mrn || 'MRN-NEW'}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary btn-sm" onclick="openEditPatient('${uid}')"><i class="fas fa-edit"></i> تعديل</button>
          <button class="btn-primary btn-sm" onclick="sw('newVisit');loadVisitForm('${uid}')"><i class="fas fa-stethoscope"></i> بدء زيارة طبية</button>
        </div>
      </div>
      <div class="pat-grid">
        <div class="pat-field"><div class="pfl">رقم الهاتف</div><div class="pfv">${sanitize(info.phone || '—')}</div></div>
        <div class="pat-field"><div class="pfl">الرقم الوطني / الهوية</div><div class="pfv" style="font-weight:700;color:var(--teal)">${sanitize(info.nationalId || '—')}</div></div>
        <div class="pat-field"><div class="pfl">العمر / الجنس</div><div class="pfv">${info.age || 'غير محدد'} سنة · ${info.gender || 'غير محدد'}</div></div>
        <div class="pat-field"><div class="pfl">فصيلة الدم</div><div class="pfv" style="color:var(--red)">${info.bloodType || '—'}</div></div>
        <div class="pat-field"><div class="pfl">تاريخ التسجيل</div><div class="pfv" style="font-size:.78rem;font-family:'IBM Plex Mono',monospace">${(info.createdAt || '').substring(0,10)}</div></div>
      </div>
      <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="pat-field" style="grid-column:span 1"><div class="pfl">الحساسية والأدوية المرفوضة</div><div>${allergiesHTML}</div></div>
        <div class="pat-field" style="grid-column:span 1"><div class="pfl">الأمراض المزمنة</div><div>${chronicHTML}</div></div>
      </div>
      ${info.notes ? `<div class="pat-field" style="margin-top:14px"><div class="pfl">ملاحظات عامة</div><div class="pfv" style="font-weight:normal;font-size:.82rem">${sanitize(info.notes)}</div></div>` : ''}
    </div>

    <!-- Spectacular Tabbed Workspace Bar -->
    <div class="emr-tabs" style="display:flex;gap:8px;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:20px;overflow-x:auto">
      <button class="emr-tab-btn ${activeEmrTab === 'timeline-tab' ? 'active' : ''}" onclick="switchEmrTab('timeline-tab')" style="background:var(--surf);border:1px solid var(--border);color:var(--muted);padding:8px 16px;border-radius:10px;font-family:'Tajawal',sans-serif;font-weight:700;font-size:0.85rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.2s">
        <i class="fas fa-history" style="color:var(--teal)"></i> السجل الطبي الزمني
      </button>
      ${_sets && _sets.mode === 'medical_complex' ? `
      <button class="emr-tab-btn ${activeEmrTab === 'lab-tab' ? 'active' : ''}" onclick="switchEmrTab('lab-tab')" style="background:var(--surf);border:1px solid var(--border);color:var(--muted);padding:8px 16px;border-radius:10px;font-family:'Tajawal',sans-serif;font-weight:700;font-size:0.85rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.2s">
        <i class="fas fa-vials" style="color:var(--sky)"></i> الفحوصات والأشعة
      </button>` : ''}
      ${_sets && _sets.mode === 'medical_complex' ? `
      <button class="emr-tab-btn ${activeEmrTab === 'referral-tab' ? 'active' : ''}" onclick="switchEmrTab('referral-tab')" style="background:var(--surf);border:1px solid var(--border);color:var(--muted);padding:8px 16px;border-radius:10px;font-family:'Tajawal',sans-serif;font-weight:700;font-size:0.85rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.2s">
        <i class="fas fa-exchange-alt" style="color:#a855f7"></i> التحويلات الداخلية
      </button>` : ''}
    </div>

    <!-- Dynamic Tab Contents -->
    <div id="emr-tab-timeline" class="emr-tab-content ${activeEmrTab === 'timeline-tab' ? 'active-content' : ''}" style="display:${activeEmrTab === 'timeline-tab' ? 'block' : 'none'}">
      <div class="ph" style="margin-bottom:12px">
        <div><div class="pt" style="font-size:1.15rem">⏳ السجل الطبي الموحد</div><div class="ps">تاريخ المريض الصحي والزيارات مصنفة زمنياً بالأحدث</div></div>
      </div>
      <div class="timeline">${visitsTimelineHTML}</div>
    </div>

    ${_sets && _sets.mode === 'medical_complex' ? `
    <div id="emr-tab-lab" class="emr-tab-content ${activeEmrTab === 'lab-tab' ? 'active-content' : ''}" style="display:${activeEmrTab === 'lab-tab' ? 'block' : 'none'}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <div class="ph" style="margin-bottom:12px">
            <div><div class="pt" style="font-size:1.15rem;color:var(--teal)">🧪 المختبر الطبي المركزي</div><div class="ps">تتبع حالة التحاليل المخبرية ونتائج القيم</div></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">${labOrdersHTML}</div>
        </div>
        <div>
          <div class="ph" style="margin-bottom:12px">
            <div><div class="pt" style="font-size:1.15rem;color:var(--sky)">🩻 قسم التصوير التشخيصي بالأشعة</div><div class="ps">تقارير الأشعة الرقمية وصور السين والتقرير التشخيصي المرفق</div></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">${radOrdersHTML}</div>
        </div>
      </div>
    </div>` : ''}

    ${_sets && _sets.mode === 'medical_complex' ? `
    <div id="emr-tab-referral" class="emr-tab-content ${activeEmrTab === 'referral-tab' ? 'active-content' : ''}" style="display:${activeEmrTab === 'referral-tab' ? 'block' : 'none'}">
      <div class="ph" style="margin-bottom:12px">
        <div><div class="pt" style="font-size:1.15rem;color:#a855f7">🔄 مكتب التحويلات الطبية الداخلية</div><div class="ps">توجيه المرضى لحظياً بين أقسام المجمع الطبي</div></div>
      </div>
      <div class="vform" style="padding:20px;border-radius:14px;background:rgba(255,255,255,0.01)">
        <div class="pfl" style="color:var(--purple);font-weight:800;font-size:0.85rem;margin-bottom:12px"><i class="fas fa-random"></i> إنشاء بطاقة تحويل داخلي جديدة</div>
        <div style="display:grid;grid-template-columns:1.5fr 2.5fr auto;gap:12px;align-items:end">
          <div>
            <label style="font-size:0.75rem;color:var(--muted);display:block;margin-bottom:6px">القسم المستهدف</label>
            <select id="refTargetDept" class="fi" style="height:38px;border-radius:8px;padding:0 8px;width:100%">
              ${Object.entries(_depts || {}).map(([k, d]) => `<option value="${k}">${d.emoji || '🏢'} ${sanitize(d.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem;color:var(--muted);display:block;margin-bottom:6px">سبب التحويل الطبي / ملاحظات إضافية</label>
            <input type="text" id="refReason" class="fi" style="height:38px;border-radius:8px;padding:0 8px;width:100%" placeholder="مثال: بحاجة لاستشارة عاجلة بخصوص ضغط الدم الشرياني">
          </div>
          <button class="btn-primary" onclick="createInternalReferral()" style="height:38px;padding:0 20px;border-radius:8px;background:linear-gradient(135deg,var(--purple),#7c3aed);font-size:0.82rem;border:none;box-shadow:0 4px 12px rgba(139,92,246,0.3)"><i class="fas fa-share-square"></i> إرسال التحويل</button>
        </div>
      </div>
    </div>` : ''}
  `;

  document.getElementById('patFileContent').innerHTML = fileHTML;
  sw('patFile');
}

// Load Visit Form
let labTestsList = [];
let radScansList = [];

function loadVisitForm(uid) {
  const p = _patients[uid];
  if (!p) return;

  rxItems = [];
  uploadAttachments = [];
  labTestsList = [];
  radScansList = [];

  const docOptions = Object.entries(_doctors).map(([dk, d]) => `
    <option value="${dk}">د. ${sanitize(d.name)} (${sanitize(d.specialty)})</option>
  `).join('');

  const formHTML = `
    <div class="vform">
      <div class="vform-title"><i class="fas fa-stethoscope"></i> تسجيل زيارة طبية للمريض: ${sanitize(p.info.name)}</div>
      
      <div class="fi-row">
        <div class="fg">
          <label>الطبيب المعالج *</label>
          <select id="vDoc" class="fi" required>
            <option value="">— اختر الطبيب —</option>
            ${docOptions}
          </select>
        </div>
        <div class="fg">
          <label>التشخيص الأولي / الرئيسي *</label>
          <input id="vDiag" class="fi" placeholder="مثال: التهاب لوزتين حاد">
        </div>
      </div>

      <div class="fg">
        <label>الشكوى الرئيسية (Chief Complaint) *</label>
        <input id="vComp" class="fi" placeholder="مثال: ارتفاع حرارة وسعال منذ يومين">
      </div>

      <div class="fi-row3">
        <div class="fg"><label>درجة الحرارة (°C)</label><input id="vtTemp" type="number" step="0.1" class="fi" placeholder="37"></div>
        <div class="fg"><label>ضغط الدم (BP)</label><input id="vtBP" class="fi" placeholder="120/80"></div>
        <div class="fg"><label>معدل النبض (Pulse)</label><input id="vtPulse" type="number" class="fi" placeholder="75"></div>
      </div>

      <div class="fg">
        <label>ملاحظات الفحص والوصف</label>
        <textarea id="vNotes" rows="3" class="fi" style="resize:none" placeholder="اكتب تفاصيل الفحص الطبي والتوجيهات..."></textarea>
      </div>

      <!-- Laboratory & Radiology Orders Builder (Complex Only) -->
      ${(_sets && _sets.mode === 'medical_complex') ? `
      <div style="margin-top:20px;border-top:1px dashed var(--border);padding-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Lab Section -->
        <div style="border-left:1px dashed var(--border);padding-left:14px">
          <div class="vform-title" style="margin-bottom:8px;color:var(--teal)"><i class="fas fa-microscope"></i> الفحوصات المخبرية المطلوبة (Lab Orders)</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <input id="labTestInput" class="fi" style="height:36px;font-size:0.8rem;flex:1" placeholder="فحص مخبري جديد (مثل: CBC, HbA1c)">
            <button type="button" class="btn-primary" onclick="addLabOrderTest()" style="height:36px;padding:0 12px;background:var(--teal);border:none;border-radius:8px;cursor:pointer"><i class="fas fa-plus"></i></button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px" id="commonLabTests">
            <span class="tag" style="cursor:pointer;font-size:0.72rem" onclick="addQuickLab('CBC')">CBC 🩸</span>
            <span class="tag" style="cursor:pointer;font-size:0.72rem" onclick="addQuickLab('HbA1c')">HbA1c 🍬</span>
            <span class="tag" style="cursor:pointer;font-size:0.72rem" onclick="addQuickLab('Lipid Profile')">Lipid Profile 🧪</span>
            <span class="tag" style="cursor:pointer;font-size:0.72rem" onclick="addQuickLab('Kidney Functions')">وظائف كلى 🔬</span>
          </div>
          <div id="labOrderList" style="display:flex;flex-wrap:wrap;gap:6px;background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;border:1px solid var(--border);min-height:45px;align-items:center">
            <span style="color:var(--muted);font-size:0.75rem" id="labPlaceholder">لا توجد فحوصات مطلوبة</span>
          </div>
        </div>

        <!-- Radiology Section -->
        <div>
          <div class="vform-title" style="margin-bottom:8px;color:var(--sky)"><i class="fas fa-x-ray"></i> صور الأشعة المطلوبة (Radiology Orders)</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <input id="radScanInput" class="fi" style="height:36px;font-size:0.8rem;flex:1" placeholder="صورة أشعة جديدة (مثل: Chest X-Ray)">
            <button type="button" class="btn-primary" onclick="addRadOrderScan()" style="height:36px;padding:0 12px;background:var(--sky);border:none;border-radius:8px;cursor:pointer"><i class="fas fa-plus"></i></button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px" id="commonRadScans">
            <span class="tag blue" style="cursor:pointer;font-size:0.72rem" onclick="addQuickRad('Chest X-Ray')">Chest X-Ray 🩻</span>
            <span class="tag blue" style="cursor:pointer;font-size:0.72rem" onclick="addQuickRad('Brain MRI')">Brain MRI 🧠</span>
            <span class="tag blue" style="cursor:pointer;font-size:0.72rem" onclick="addQuickRad('Abdominal US')">سونار بطن 🤰</span>
            <span class="tag blue" style="cursor:pointer;font-size:0.72rem" onclick="addQuickRad('CT Brain')">CT Brain 🌀</span>
          </div>
          <div id="radOrderList" style="display:flex;flex-wrap:wrap;gap:6px;background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;border:1px solid var(--border);min-height:45px;align-items:center">
            <span style="color:var(--muted);font-size:0.75rem" id="radPlaceholder">لا توجد صور أشعة مطلوبة</span>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Prescription Builder -->
      <div style="margin-top:20px;border-top:1px dashed var(--border);padding-top:14px">
        <div class="vform-title" style="margin-bottom:8px"><i class="fas fa-prescription-bottle-alt"></i> الوصفة الطبية الإلكترونية</div>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <div style="position:relative;flex:2;min-width:200px">
            <input id="rxName" class="fi" placeholder="اسم الدواء (ابحث في مخزون الصيدلية أو أدخل يدوياً)" onkeyup="searchDrug()" onfocus="searchDrug()" autocomplete="off" style="width:100%">
            <div id="rxDropdown" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--surf);border:1px solid var(--border);border-radius:8px;max-height:220px;overflow-y:auto;z-index:1000;box-shadow:0 10px 25px rgba(0,0,0,0.5);"></div>
          </div>
          <input id="rxDose" class="fi" placeholder="الجرعة (مثال: 500mg)" style="flex:1;min-width:100px">
          <input id="rxFreq" class="fi" placeholder="التكرار (مثال: 3 مرات)" style="flex:1;min-width:100px">
          <input id="rxDur" class="fi" placeholder="المدة (مثال: 5 أيام)" style="flex:1;min-width:100px">
        </div>
        <div style="margin-bottom:8px">
          <input id="rxNote" class="fi" placeholder="ملاحظات للصيدلاني (اختياري - مثال: حساسية، أو تحذير دوائي...)" style="width:100%;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.02)">
        </div>
        <button type="button" class="rx-add" onclick="addRxItem()" style="margin-top:4px"><i class="fas fa-plus"></i> إضافة الدواء للوصفة</button>
        
        <table class="rx-table" id="rxTable" style="display:none">
          <thead>
            <tr>
              <th>الدواء</th>
              <th>الجرعة</th>
              <th>التكرار</th>
              <th>المدة</th>
              <th style="width:50px"></th>
            </tr>
          </thead>
          <tbody id="rxBody"></tbody>
        </table>
      </div>

      <!-- File Attachments -->
      <div style="margin-top:20px;border-top:1px dashed var(--border);padding-top:14px">
        <div class="vform-title" style="margin-bottom:8px"><i class="fas fa-paperclip"></i> مرفقات طبية (أشعة / تحاليل / تقارير)</div>
        <div class="att-upload" onclick="document.getElementById('attFileInp').click()">
          <i class="fas fa-cloud-upload-alt" style="font-size:2rem;margin-bottom:8px;display:block"></i>
          <span>اضغط هنا لرفع المرفقات (صور صغيرة Base64 أو ملفات PDF)</span>
          <input type="file" id="attFileInp" style="display:none" onchange="handleAttachment(event)">
        </div>
        <div class="att-grid" id="attFormGrid"></div>
      </div>

      <div style="display:flex;gap:10px;margin-top:24px">
        <button class="btn-primary" style="flex:1" onclick="saveVisit()"><i class="fas fa-check"></i> إنهاء وحفظ الزيارة الطبية</button>
        <button class="btn-secondary" onclick="viewPatientFile('${uid}')">إلغاء</button>
      </div>
    </div>
  `;

  document.getElementById('visitFormArea').innerHTML = formHTML;

  // Restore Auto-Saved Draft if exists
  setTimeout(() => {
    if (typeof ArgonCore !== 'undefined') {
      const draft = ArgonCore.AutoSave.loadDraft(uid);
      if (draft && draft.data) {
        const d = draft.data;
        if(document.getElementById('vDoc') && d.docKey) document.getElementById('vDoc').value = d.docKey;
        if(document.getElementById('vDiag') && d.diagnosis) document.getElementById('vDiag').value = d.diagnosis;
        if(document.getElementById('vComp') && d.complaint) document.getElementById('vComp').value = d.complaint;
        if(document.getElementById('vtTemp') && d.temp) document.getElementById('vtTemp').value = d.temp;
        if(document.getElementById('vtBP') && d.bp) document.getElementById('vtBP').value = d.bp;
        if(document.getElementById('vtPulse') && d.pulse) document.getElementById('vtPulse').value = d.pulse;
        if(document.getElementById('vNotes') && d.notes) document.getElementById('vNotes').value = d.notes;
        
        if(d.rxItems && d.rxItems.length) { rxItems = d.rxItems; renderRxTable(); }
        if(d.labTestsList && d.labTestsList.length) { labTestsList = d.labTestsList; renderLabOrderList(); }
        if(d.radScansList && d.radScansList.length) { radScansList = d.radScansList; renderRadOrderList(); }
        
        toast('🔄 تم استعادة البيانات غير المكتملة تلقائياً', 'ok');
      }
    }
  }, 150);
}

// Prescription actions
function addRxItem() {
  const name = document.getElementById('rxName').value.trim();
  const dose = document.getElementById('rxDose').value.trim();
  const freq = document.getElementById('rxFreq').value.trim();
  const dur = document.getElementById('rxDur').value.trim();
  const noteInp = document.getElementById('rxNote');
  const note = noteInp ? noteInp.value.trim() : '';

  if (!name) {
    toast('⚠️ يرجى إدخال اسم الدواء على الأقل', 'err');
    return;
  }

  rxItems.push({ name, dose, freq, dur, note });
  
  // Clean inputs
  ['rxName', 'rxDose', 'rxFreq', 'rxDur', 'rxNote'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  renderRxTable();
}

function renderRxTable() {
  const table = document.getElementById('rxTable');
  const tbody = document.getElementById('rxBody');
  
  if (!rxItems.length) {
    table.style.display = 'none';
    return;
  }

  table.style.display = 'table';
  tbody.innerHTML = rxItems.map((item, idx) => `
    <tr>
      <td>
        <b>${sanitize(item.name)}</b>
        ${item.note ? `<div style="font-size:0.7rem;color:#ef4444;margin-top:2px;background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:4px;display:inline-block"><i class="fas fa-exclamation-triangle"></i> ${sanitize(item.note)}</div>` : ''}
      </td>
      <td>${sanitize(item.dose || '—')}</td>
      <td>${sanitize(item.freq || '—')}</td>
      <td>${sanitize(item.dur || '—')}</td>
      <td><button type="button" class="rx-rm" onclick="removeRxItem(${idx})"><i class="fas fa-trash-alt"></i></button></td>
    </tr>
  `).join('');
}

function removeRxItem(idx) {
  rxItems.splice(idx, 1);
  renderRxTable();
}

// ── SMART DRUG AUTOCOMPLETE ENGINE ──
function _buildDrugDropdownHTML(matched, query, selectFuncName) {
  if (!matched.length) {
    return `<div style="padding:10px;font-size:0.8rem;color:var(--muted);text-align:center">لم يتم العثور على "${sanitize(query)}" في المستودع.<br>سيتم إضافته كدواء خارجي (غير متوفر) ✅</div>`;
  }

  return matched.map(m => {
    const isOut = m.stock <= 0;
    const stockBadge = isOut 
      ? `<span style="font-size:0.65rem;color:#ef4444;background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:4px">نفد من المستودع ❌</span>`
      : `<span style="font-size:0.65rem;color:var(--green);background:rgba(16,185,129,0.1);padding:2px 6px;border-radius:4px">متوفر: ${m.stock} عبوة ✅</span>`;
      
    return `<div onclick="${selectFuncName}('${m.name.replace(/'/g, "\\'")}')" style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:0.2s" onmouseover="this.style.background='rgba(13,148,136,0.1)'" onmouseout="this.style.background='transparent'">
      <div>
        <div style="font-weight:700;font-size:0.85rem;color:var(--text)">${sanitize(m.name)}</div>
        ${m.scientificName ? `<div style="font-size:0.7rem;color:var(--muted);font-family:'IBM Plex Mono',monospace">${sanitize(m.scientificName)}</div>` : ''}
      </div>
      <div style="text-align:left">
        ${stockBadge}
        ${m.price ? `<div style="font-size:0.7rem;color:var(--teal);margin-top:4px;font-weight:700">${m.price} د.أ</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function _searchInventoryLogic(query) {
  const items = Object.values(_pharmacyInventory || {});
  const q = query.trim().toLowerCase();
  if (!q) return [];
  
  return items.filter(item => 
    (item.name && item.name.toLowerCase().includes(q)) ||
    (item.scientificName && item.scientificName.toLowerCase().includes(q)) ||
    (item.arabicName && item.arabicName.includes(q)) ||
    (item.barcode && item.barcode.includes(q))
  );
}

// Old UI Search
function searchDrug() {
  const inp = document.getElementById('rxName');
  const dd = document.getElementById('rxDropdown');
  if (!inp || !dd) return;
  const q = inp.value.trim();
  if (!q) { dd.style.display = 'none'; return; }
  dd.innerHTML = _buildDrugDropdownHTML(_searchInventoryLogic(q), q, 'selectDrug');
  dd.style.display = 'block';
}

function selectDrug(name) {
  const inp = document.getElementById('rxName');
  const dd = document.getElementById('rxDropdown');
  if (inp) inp.value = name;
  if (dd) dd.style.display = 'none';
  const doseInp = document.getElementById('rxDose');
  if (doseInp) doseInp.focus();
}

// Workspace UI Search
function searchWorkspaceDrug() {
  const inp = document.getElementById('rxDrug');
  const dd = document.getElementById('rxWorkspaceDropdown');
  if (!inp || !dd) return;
  const q = inp.value.trim();
  if (!q) { dd.style.display = 'none'; return; }
  dd.innerHTML = _buildDrugDropdownHTML(_searchInventoryLogic(q), q, 'selectWorkspaceDrug');
  dd.style.display = 'block';
}

function selectWorkspaceDrug(name) {
  const inp = document.getElementById('rxDrug');
  const dd = document.getElementById('rxWorkspaceDropdown');
  if (inp) inp.value = name;
  if (dd) dd.style.display = 'none';
  const doseInp = document.getElementById('rxDose');
  if (doseInp) doseInp.focus();
}

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dd1 = document.getElementById('rxDropdown');
  const inp1 = document.getElementById('rxName');
  if (dd1 && inp1 && e.target !== inp1 && !dd1.contains(e.target)) dd1.style.display = 'none';
  
  const dd2 = document.getElementById('rxWorkspaceDropdown');
  const inp2 = document.getElementById('rxDrug');
  if (dd2 && inp2 && e.target !== inp2 && !dd2.contains(e.target)) dd2.style.display = 'none';
});

// Attachments Handling
function handleAttachment(e) {
  const file = e.target.files[0];
  if (!file) return;

  toast('⏳ جاري قراءة الملف...', 'ok');
  const reader = new FileReader();
  
  reader.onload = ev => {
    const fileType = file.type.startsWith('image/') ? 'image' : (file.type === 'application/pdf' ? 'pdf' : 'other');
    
    // Large PDF / Images handling via Storage if requested, else fallback to Base64
    if (file.size > 200 * 1024) {
      toast('💡 حجم الملف كبير، سيتم رفعه بأمان...', 'ok');
      // Compress if image
      if (fileType === 'image') {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxW = 800;
          let w = img.width, h = img.height;
          if (w > maxW) { h *= maxW / w; w = maxW; }
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          pushAttachment(file.name, fileType, compressed);
        };
        img.src = ev.target.result;
      } else {
        // High quality PDF or others to Base64
        pushAttachment(file.name, fileType, ev.target.result);
      }
    } else {
      pushAttachment(file.name, fileType, ev.target.result);
    }
  };
  reader.readAsDataURL(file);
}

function pushAttachment(name, type, data) {
  uploadAttachments.push({ name, type, data });
  renderAttachmentsForm();
  toast('✅ تم إضافة المرفق بنجاح', 'ok');
}

function renderAttachmentsForm() {
  const grid = document.getElementById('attFormGrid');
  grid.innerHTML = uploadAttachments.map((a, idx) => `
    <div class="att-item">
      <i class="fas ${a.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}"></i>
      <span class="att-name">${sanitize(a.name)}</span>
      <span onclick="removeAttachment(${idx})" style="position:absolute;top:5px;left:5px;color:var(--red);font-weight:bold;cursor:pointer">✕</span>
    </div>
  `).join('');
}

function removeAttachment(idx) {
  uploadAttachments.splice(idx, 1);
  renderAttachmentsForm();
}

function openAttachment(data, type) {
  const w = window.open();
  if (type === 'pdf') {
    w.document.write(`<iframe src="${data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
  } else {
    w.document.write(`<body style="margin:0;background:#030b0a;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${data}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.5);"></body>`);
  }
  w.document.close();
}

// Save Visit
function saveVisit() {
  const docKey = document.getElementById('vDoc').value;
  const diagnosis = document.getElementById('vDiag').value.trim();
  const complaint = document.getElementById('vComp').value.trim();
  const temp = document.getElementById('vtTemp').value.trim();
  const bp = document.getElementById('vtBP').value.trim();
  const pulse = document.getElementById('vtPulse').value.trim();
  const notes = document.getElementById('vNotes').value.trim();

  if (!docKey || !diagnosis || !complaint) {
    toast('⚠️ يرجى تعبئة الحقول المطلوبة (الطبيب والتشخيص والشكوى)', 'err');
    return;
  }

  const doc = _doctors[docKey] || {};
  const visitId = db.ref().child('visits').push().key;

  const visitObj = {
    date: new Date().toLocaleDateString('en-CA'),
    time: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
    docKey,
    docName: doc.name || 'غير محدد',
    diagnosis,
    complaint,
    notes,
    vitals: {
      temp: temp || null,
      bp: bp || null,
      pulse: pulse || null
    },
    prescriptions: [...rxItems],
    labOrders: [...labTestsList],
    radOrders: [...radScansList],
    attachments: uploadAttachments
  };

  // Auto-capture pending Rx if user forgot to click +
  const rxD = document.getElementById('rxName')?.value.trim();
  const rxO = document.getElementById('rxDose')?.value.trim();
  if (rxD) {
    rxItems.push({ name: rxD, dose: rxO || '', freq: '', dur: '', note: '' });
    visitObj.prescriptions.push({ name: rxD, dose: rxO || '', freq: '' });
  }

  // Auto-capture pending Lab
  const pendingLab = document.getElementById('labTestInput')?.value.trim();
  if (pendingLab && !labTestsList.includes(pendingLab)) {
    labTestsList.push(pendingLab);
    visitObj.labOrders.push(pendingLab);
  }

  // Auto-capture pending Radiology
  const pendingRad = document.getElementById('radScanInput')?.value.trim();
  if (pendingRad && !radScansList.includes(pendingRad)) {
    radScansList.push(pendingRad);
    visitObj.radOrders.push(pendingRad);
  }

  const patientName = _patients[activePatientId]?.info?.name || 'مريض';
  const doctorDisplayName = (window.ArgonSession ? ArgonSession.get()?.displayName : null) || doc.name || 'طبيب';

  db.ref(`${BASE}/patients/${activePatientId}/visits/${visitId}`).set(visitObj).then(() => {
    // 1. Electronic Prescription Submission
    try {
    if (rxItems.length) {
      const prescId = db.ref().child('prescriptions').push().key;
      db.ref(`${BASE}/prescriptions/${prescId}`).set({
        patientId: activePatientId,
        patientName: patientName,
        doctorId: docKey,
        docName: doctorDisplayName,
        medications: rxItems.map(m => ({ ...m, status: 'waiting' })),
        status: 'waiting',
        visitId,
        orgId: CID,
        createdAt: new Date().toISOString()
      });
      db.ref(`${BASE}/notifications`).push({
        title: 'وصفة طبية جديدة 💊',
        message: `وصفة جديدة للمريض ${sanitize(patientName)}`,
        role: 'pharmacist',
        createdAt: new Date().toISOString()
      });
    }
    } catch(e) { console.error('Rx submission error:', e); }

    // 2. Laboratory Order Submission
    try {
    if (labTestsList.length) {
      const labOrderId = db.ref().child('lab_orders').push().key;
      db.ref(`${BASE}/lab_orders/${labOrderId}`).set({
        patientId: activePatientId,
        patientName: patientName,
        doctorId: docKey,
        docName: doctorDisplayName,
        requestedTests: labTestsList.map(t => ({ name: t, result: '', unit: '', status: 'waiting' })),
        status: 'waiting',
        visitId,
        orgId: CID,
        createdAt: new Date().toISOString()
      });
      db.ref(`${BASE}/notifications`).push({
        title: 'طلب فحص مخبري جديد 🔬',
        message: `طلب تحاليل للمريض ${sanitize(patientName)}`,
        role: 'lab',
        createdAt: new Date().toISOString()
      });
    }
    } catch(e) { console.error('Lab submission error:', e); }

    // 3. Radiology Order Submission
    try {
    if (radScansList.length) {
      const radOrderId = db.ref().child('radiology_orders').push().key;
      db.ref(`${BASE}/radiology_orders/${radOrderId}`).set({
        patientId: activePatientId,
        patientName: patientName,
        doctorId: docKey,
        docName: doctorDisplayName,
        requestedScans: radScansList.map(s => ({ name: s, status: 'waiting' })),
        status: 'waiting',
        visitId,
        orgId: CID,
        createdAt: new Date().toISOString()
      });
      db.ref(`${BASE}/notifications`).push({
        title: 'طلب أشعة جديد 🩻',
        message: `طلب تصوير أشعة للمريض ${sanitize(patientName)}`,
        role: 'radiology',
        createdAt: new Date().toISOString()
      });
    }
    } catch(e) { console.error('Rad submission error:', e); }

    // Generate Invoice link automatically
    const invId = db.ref().child('invoices').push().key;
    db.ref(`${BASE}/invoices/${invId}`).set({
      patientId: activePatientId,
      patientName: patientName,
      visitId,
      docName: doctorDisplayName,
      items: [
        { name: 'كشفية الطبيب / تشخيص', price: parseFloat(doc.fee || 0) }
      ],
      total: parseFloat(doc.fee || 0),
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    if (typeof ArgonCore !== 'undefined') {
      ArgonCore.AutoSave.clearDraft(activePatientId);
      ArgonCore.logAudit('CREATE_VISIT', `تم حفظ زيارة جديدة للمريض ${activePatientId}`, 'EMR');
    }

    toast('✅ تم حفظ الزيارة الطبية وإرسال الطلبات بنجاح', 'ok');
    viewPatientFile(activePatientId);
  }).catch(() => toast('❌ فشل حفظ الزيارة الطبية', 'err'));
}

// ── AUTO SAVE ENGINE (EVERY 3 SECONDS) ──
setInterval(() => {
  if (!activePatientId || !document.getElementById('vDiag')) return;
  if (typeof ArgonCore === 'undefined') return;
  
  const data = {
    docKey: document.getElementById('vDoc') ? document.getElementById('vDoc').value : '',
    diagnosis: document.getElementById('vDiag') ? document.getElementById('vDiag').value : '',
    complaint: document.getElementById('vComp') ? document.getElementById('vComp').value : '',
    temp: document.getElementById('vtTemp') ? document.getElementById('vtTemp').value : '',
    bp: document.getElementById('vtBP') ? document.getElementById('vtBP').value : '',
    pulse: document.getElementById('vtPulse') ? document.getElementById('vtPulse').value : '',
    notes: document.getElementById('vNotes') ? document.getElementById('vNotes').value : '',
    rxItems: rxItems || [],
    labTestsList: labTestsList || [],
    radScansList: radScansList || []
  };
  
  if (data.diagnosis || data.complaint || data.rxItems.length || data.labTestsList.length || data.radScansList.length) {
    ArgonCore.AutoSave.saveDraft(activePatientId, data);
  }
}, 3000);

// Print Visit Summary
function printVisitSummary(vk) {
  const p = _patients[activePatientId];
  const v = p.visits[vk];
  if (!v) return;

  const rx = (v.prescriptions || []).map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd"><b>${sanitize(item.name)}</b></td>
      <td style="padding:8px;border-bottom:1px solid #ddd">${sanitize(item.dose || '—')}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">${sanitize(item.freq || '—')}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd">${sanitize(item.dur || '—')}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center;padding:8px;color:#888">لا يوجد أدوية موصوفة</td></tr>';

  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>وصفة طبية - ${sanitize(p.info.name)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body { font-family:'Tajawal',sans-serif; margin:40px; color:#333; line-height:1.6 }
        .hdr { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0d9488; padding-bottom:16px; margin-bottom:30px }
        .title { font-size:22px; font-weight:900; color:#0f766e }
        .p-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:30px }
        .p-field { font-size:14px }
        .rx-table { width:100%; border-collapse:collapse; margin-top:20px }
        .rx-table th { background:#f3f4f6; color:#4b5563; font-size:12px; padding:10px; text-align:right }
        .sig { text-align:left; margin-top:60px; font-weight:bold; color:#4b5563 }
      </style>
    </head>
    <body>
      <div class="hdr">
        <div>
          <div class="title">🏥 ${_sets.name || 'العيادة الطبية'}</div>
          <div style="font-size:12px;color:#666">${_sets.specialty || 'تخصصات طبية'} · هاتف: ${_sets.phone || ''}</div>
        </div>
        <div style="text-align:left;font-size:12px;color:#666">
          تاريخ الطباعة: ${new Date().toLocaleDateString('ar-JO')}<br>
          الرقم الطبي: ${p.info.mrn || ''}
        </div>
      </div>
      
      <h2>📄 ملخص زيارة طبية / وصفة إلكترونية</h2>
      <div class="p-grid">
        <div class="p-field"><b>المريض:</b> ${sanitize(p.info.name)}</div>
        <div class="p-field"><b>رقم الهاتف:</b> ${sanitize(activePatientId)}</div>
        <div class="p-field"><b>العمر/الجنس:</b> ${p.info.age || '—'} سنة / ${p.info.gender || '—'}</div>
        <div class="p-field"><b>تاريخ الزيارة:</b> ${v.date} · ${v.time}</div>
      </div>

      <div style="margin-bottom:20px">
        <b>🩺 التشخيص الرئيسي:</b> ${sanitize(v.diagnosis || 'فحص عام')}<br>
        <b>🔍 الشكوى:</b> ${sanitize(v.complaint || 'مراجعة')}
      </div>

      ${v.vitals?.temp || v.vitals?.bp ? `
        <div style="background:#f0fdfa;border:1px solid #ccfbf1;border-radius:8px;padding:12px;margin-bottom:20px">
          <b>🌡️ العلامات الحيوية:</b> 
          ${v.vitals.temp ? `الحرارة: ${v.vitals.temp}°C ` : ''} 
          ${v.vitals.bp ? `· الضغط: ${v.vitals.bp} ` : ''} 
          ${v.vitals.pulse ? `· النبض: ${v.vitals.pulse}/دقيقة` : ''}
        </div>
      ` : ''}

      <h3>💊 الأدوية الموصوفة (Rx):</h3>
      <table class="rx-table">
        <thead>
          <tr>
            <th>اسم الدواء</th>
            <th>الجرعة</th>
            <th>التكرار</th>
            <th>المدة</th>
          </tr>
        </thead>
        <tbody>
          ${rx}
        </tbody>
      </table>

      ${v.notes ? `<div style="margin-top:20px"><b>📝 توجيهات الطبيب:</b><p>${sanitize(v.notes)}</p></div>` : ''}

      <div class="sig">
        توقيع وختم الطبيب المعالج:<br><br>
        د. ${sanitize(v.docName)}
      </div>

      <script>window.onload = () => { window.print(); window.close(); }</script>
    </body>
    </html>
  `);
  w.document.close();
}

function createInternalReferral() {
  const deptId = document.getElementById('refTargetDept').value;
  const reason = document.getElementById('refReason').value.trim();
  if (!deptId) { toast('⚠️ يرجى اختيار القسم المستهدف', 'err'); return; }
  if (!reason) { toast('⚠️ يرجى كتابة سبب التحويل', 'err'); return; }

  const p = _patients[activePatientId];
  if (!p) return;
  const dept = _depts[deptId];
  if (!dept) { toast('⚠️ القسم غير موجود', 'err'); return; }
  
  // 1. Save referral node
  const refId = db.ref().child('referrals').push().key;
  const referralObj = {
    patientPhone: activePatientId,
    patientName: p.info.name,
    patientAge: p.info.age || null,
    patientGender: p.info.gender || '',
    toDept: deptId,
    toDeptName: dept.name,
    toDeptEmoji: dept.emoji || '🏢',
    reason: reason,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.ref(`${BASE}/referrals/${refId}`).set(referralObj).then(() => {
    // 2. Automatically create a waiting booking in the target department queue
    const bKey = db.ref().child('bookings').push().key;
    const bookingObj = {
      date: new Date().toLocaleDateString('en-CA'),
      time: 'تحويل داخلي',
      patPhone: activePatientId,
      patName: p.info.name,
      patAge: p.info.age || null,
      patGender: p.info.gender || '',
      docKey: 'referral', // Marker for referred patients
      docName: `تحويل إلى ${dept.emoji || '🏢'} ${dept.name}`,
      fee: 0.00,
      bookNo: 'REF-' + Math.floor(1000 + Math.random() * 9000),
      notes: `محال داخلياً: ${reason}`,
      status: 'waiting',
      referralId: refId,
      createdAt: new Date().toISOString()
    };
    
    // Also save the referral item in the patient's visit history timeline
    const visitId = db.ref().child('visits').push().key;
    const refVisitObj = {
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
      docKey: 'referral',
      docName: 'نظام التحويلات الداخلي',
      diagnosis: `تحويل صادر إلى قسم: ${dept.name}`,
      complaint: 'تحويل طبي داخلي',
      notes: `سبب التحويل: ${reason}`,
      vitals: { temp: null, bp: null, pulse: null },
      prescriptions: [],
      attachments: []
    };

    Promise.all([
      db.ref(`${BASE}/bookings/${bKey}`).set(bookingObj),
      db.ref(`${BASE}/patients/${activePatientId}/visits/${visitId}`).set(refVisitObj)
    ]).then(() => {
      toast('✅ تم إرسال التحويل وتحويل المريض بنجاح', 'ok');
      const input = document.getElementById('refReason');
      if (input) input.value = '';
      viewPatientFile(activePatientId);
    });
  }).catch(() => toast('❌ فشل إرسال التحويل', 'err'));
}

function addLabOrderTest() {
  const input = document.getElementById('labTestInput');
  const val = input.value.trim();
  if (val) {
    addQuickLab(val);
    input.value = '';
  }
}
function addQuickLab(name) {
  if (labTestsList.includes(name)) return;
  labTestsList.push(name);
  renderLabOrderChips();
}
function removeLabTest(name) {
  labTestsList = labTestsList.filter(x => x !== name);
  renderLabOrderChips();
}
function renderLabOrderChips() {
  const div = document.getElementById('labOrderList');
  if (!div) return;
  if (!labTestsList.length) {
    div.innerHTML = `<span style="color:var(--muted);font-size:0.75rem" id="labPlaceholder">لا توجد فحوصات مطلوبة</span>`;
    return;
  }
  div.innerHTML = labTestsList.map(t => `
    <span class="tag" style="background:rgba(13,148,136,0.15);border:1px solid var(--teal);color:var(--teal)">
      ${sanitize(t)} <span onclick="removeLabTest('${t}')" style="cursor:pointer;margin-right:6px;font-weight:bold;color:var(--red)">✕</span>
    </span>
  `).join('');
}

function addRadOrderScan() {
  const input = document.getElementById('radScanInput');
  const val = input.value.trim();
  if (val) {
    addQuickRad(val);
    input.value = '';
  }
}
function addQuickRad(name) {
  if (radScansList.includes(name)) return;
  radScansList.push(name);
  renderRadOrderChips();
}
function removeRadScan(name) {
  radScansList = radScansList.filter(x => x !== name);
  renderRadOrderChips();
}
function renderRadOrderChips() {
  const div = document.getElementById('radOrderList');
  if (!div) return;
  if (!radScansList.length) {
    div.innerHTML = `<span style="color:var(--muted);font-size:0.75rem" id="radPlaceholder">لا توجد صور أشعة مطلوبة</span>`;
    return;
  }
  div.innerHTML = radScansList.map(t => `
    <span class="tag blue" style="background:rgba(14,165,233,0.15);border:1px solid var(--sky);color:var(--sky)">
      ${sanitize(t)} <span onclick="removeRadScan('${t}')" style="cursor:pointer;margin-right:6px;font-weight:bold;color:var(--red)">✕</span>
    </span>
  `).join('');
}

// Sanitization
const sanitize = s => String(s || '').replace(/[<>"']/g, '').trim().substring(0, 250);

// Seeding default departments automatically for Medical Complex tier
function checkAndSeedDefaultDepartments() {
  if (_sets && _sets.mode === 'medical_complex') {
    db.ref(BASE + '/departments').once('value', snap => {
      if (!snap.exists() || !snap.val()) {
        const defaultDepts = {
          general: { name: 'الطب العام', emoji: '🩺', color: '#0d9488' },
          dental: { name: 'طب الأسنان', emoji: '🦷', color: '#8b5cf6' },
          pediatrics: { name: 'طب الأطفال', emoji: '👶', color: '#10b981' },
          cardio: { name: 'أمراض القلب', emoji: '🫀', color: '#ef4444' },
          ortho: { name: 'جراحة العظام', emoji: '🦴', color: '#f59e0b' }
        };
        db.ref(BASE + '/departments').set(defaultDepts);
      }
    });
  }
}

// Tab switcher helper
function switchEmrTab(tabId) {
  activeEmrTab = tabId;
  document.querySelectorAll('.emr-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.emr-tab-content').forEach(content => {
    content.style.display = 'none';
    content.classList.remove('active-content');
  });
  
  if (tabId === 'timeline-tab') {
    document.querySelector('.emr-tab-btn:nth-child(1)').classList.add('active');
    const el = document.getElementById('emr-tab-timeline');
    if (el) { el.style.display = 'block'; el.classList.add('active-content'); }
  } else if (tabId === 'lab-tab') {
    document.querySelector('.emr-tab-btn:nth-child(2)').classList.add('active');
    const el = document.getElementById('emr-tab-lab');
    if (el) { el.style.display = 'block'; el.classList.add('active-content'); }
  } else if (tabId === 'referral-tab') {
    const btn = document.querySelector('.emr-tab-btn:nth-child(3)');
    if (btn) btn.classList.add('active');
    const el = document.getElementById('emr-tab-referral');
    if (el) { el.style.display = 'block'; el.classList.add('active-content'); }
  }
}

// Format date into luxurious Arabic style
function formatArabicDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-JO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch(e) {
    return dateStr;
  }
}

// Convert 12h Arabic/English time into comparable 24h format
function parseArabicTime(t) {
  let clean = String(t || '').trim();
  const isPM = clean.includes('م') || clean.includes('PM');
  const isAM = clean.includes('ص') || clean.includes('AM');
  const match = clean.match(/(\d+):(\d+)/);
  if (!match) return '00:00';
  let hours = parseInt(match[1]);
  let minutes = match[2];
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return String(hours).padStart(2, '0') + ':' + minutes;
}

// Premium Web Audio Synthesizer Double-Chime Sound
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // First high chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5 note
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);
    
    // Second premium chime with a minor third delay for high elegance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.12); // E6 note
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn("Audio Context playback failed or blocked by browser gesture", e);
  }
}

// 🔄 Internal Referrals Dashboard Logic
function filterReferrals(status, btn) {
  currentReferralsFilter = status;
  document.querySelectorAll('.filter-ref-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderReferralsList();
}

function renderReferralsList() {
  const grid = document.getElementById('referralsGrid');
  if (!grid) return;

  const list = Object.entries(_referrals).reverse(); // Newest first
  const filtered = list.filter(([k, r]) => {
    if (currentReferralsFilter === 'all') return true;
    return r.status === currentReferralsFilter;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)" class="glass-panel">
      <i class="fas fa-exchange-alt" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:0.15"></i>
      لا يوجد طلبات تحويل طبي تطابق الحالة المحددة حالياً
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(([k, r]) => {
    const isCompleted = r.status === 'completed';
    const statusLabel = isCompleted ? 'مكتملة ✅' : 'بانتظار المعاينة ⏳';
    const statusColor = isCompleted ? 'var(--green)' : 'var(--amber)';
    const statusBg = isCompleted ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)';

    return `
      <div class="glass-panel" style="padding:18px;border-right:5px solid ${statusColor};position:relative;display:flex;flex-direction:column;gap:10px;animation:fu 0.25s ease">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.75rem;color:var(--muted)">${(r.createdAt || '').substring(0,10)} · ${(r.createdAt || '').substring(11,16)}</span>
          <span style="font-size:0.72rem;font-weight:800;padding:4px 8px;border-radius:6px;background:${statusBg};color:${statusColor}">${statusLabel}</span>
        </div>
        <div style="font-size:1.05rem;font-weight:800;color:var(--text)">👤 ${sanitize(r.patientName)}</div>
        <div style="font-size:0.82rem;color:var(--muted)">رقم الهاتف: <span dir="ltr">${sanitize(r.patientId)}</span></div>
        <div style="font-size:0.85rem;background:rgba(255,255,255,0.01);padding:10px;border-radius:8px;border:1px solid var(--border)">
          <b>🎯 القسم المحال إليه:</b> ${r.toDeptEmoji || '🏢'} <span style="color:var(--purple);font-weight:700">${sanitize(r.toDeptName)}</span>
          <br>
          <div style="margin-top:6px;line-height:1.4"><b>📝 السبب الطبي للتحويل:</b><br>${sanitize(r.reason || 'استشارة عامة')}</div>
        </div>
        <div style="margin-top:auto;display:flex;gap:8px;justify-content:flex-end">
          <button class="btn-secondary btn-sm" onclick="viewPatientFile('${r.patientId}')" style="height:32px;border-radius:6px;font-size:0.75rem"><i class="fas fa-file-medical"></i> فتح الملف الطبي</button>
          ${!isCompleted ? `<button class="btn-primary btn-sm" onclick="completeReferral('${k}')" style="height:32px;border-radius:6px;font-size:0.75rem;background:var(--green);border:none;box-shadow:0 4px 10px rgba(16,185,129,0.2)"><i class="fas fa-check"></i> اكتمال المعاينة</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function completeReferral(refId) {
  db.ref(`${BASE}/referrals/${refId}/status`).set('completed').then(() => {
    toast('✅ تم تحديث حالة التحويل إلى مكتمل', 'ok');
  });
}

// Beautiful Doctor Profile Selector Modal
function showDoctorProfileSelector(matchedPats, originalPhone) {
  const existing = document.getElementById('doctorProfileSelectorOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'doctorProfileSelectorOverlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(2, 7, 6, 0.85);
    backdrop-filter: blur(10px);
    z-index: 110000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: 'Tajawal', sans-serif;
  `;

  const container = document.createElement('div');
  container.className = 'glass-panel';
  container.style.cssText = `
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 22px;
    padding: 28px;
    width: 100%;
    max-width: 460px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    text-align: center;
  `;

  let profilesHTML = matchedPats.map(([uid, p]) => {
    const info = p.info || {};
    const genderIcon = info.gender === 'ذكر' ? '👨' : info.gender === 'أنثى' ? '👩' : '👤';
    const ageGender = [info.age ? `${info.age} سنة` : '', info.gender || ''].filter(Boolean).join(' · ');
    return `
      <div class="plist-card" style="border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer; text-align: right; margin-bottom: 10px; transition: all 0.2s;" 
           onclick="document.getElementById('doctorProfileSelectorOverlay').remove(); viewPatientFile('${uid}'); sw('patFile');">
        <div style="font-size: 1.8rem;">${genderIcon}</div>
        <div style="flex: 1;">
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--text);">${sanitize(info.name)}</div>
          <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">
            ${ageGender ? `${ageGender} · ` : ''}الرقم الطبي: <span style="font-family: monospace;">${info.mrn || '—'}</span>
            ${info.nationalId ? `<br><span style="color:var(--teal)">الرقم الوطني: ${info.nationalId}</span>` : ''}
          </div>
        </div>
        <div style="color: var(--teal);"><i class="fas fa-chevron-left"></i></div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 12px;">👥</div>
    <h3 style="font-weight: 900; margin-bottom: 8px; color: var(--teal);">تحديد ملف المريض</h3>
    <p style="font-size: 0.82rem; color: var(--muted); margin-bottom: 20px;">تم العثور على عدة ملفات مسجلة بنفس رقم الهاتف (${originalPhone}). الرجاء تحديد المريض المطلوب للزيارة:</p>
    
    <div style="max-height: 280px; overflow-y: auto; margin-bottom: 20px;">
      ${profilesHTML}
    </div>
    
    <button class="btn-secondary" style="width: 100%; justify-content: center;" onclick="document.getElementById('doctorProfileSelectorOverlay').remove();">إلغاء</button>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

// ── PROGRAMMATIC ISOLATION & COLLISION DIAGNOSTIC ROUTINE ──
function runCollisionTest() {
  console.log("%c🧪 Starting EMR Collision Isolation Test...", "color: #0d9488; font-weight: bold; font-size: 1.2rem;");
  const testPhone = '0799999999';
  const cleanP = cleanPhone(testPhone);
  
  // We will programmatically create 10 independent patients sharing this same phone number
  const promises = [];
  for (let i = 1; i <= 10; i++) {
    const newUid = db.ref().child('patients').push().key;
    const mrn = 'TEST-MRN-' + Math.floor(100000 + Math.random() * 900000);
    const patObj = {
      info: {
        name: `مريض الفحص رقم ${i}`,
        phone: cleanP,
        nationalId: `99900011${i}`,
        age: 20 + i,
        gender: i % 2 === 0 ? 'ذكر' : 'أنثى',
        bloodType: 'O+',
        mrn: mrn,
        notes: `Collision diagnostic record ${i}`,
        createdAt: new Date().toISOString()
      }
    };
    
    // Simulate visits for each isolated patient
    const visitId = db.ref().child('visits').push().key;
    patObj.visits = {
      [visitId]: {
        date: new Date().toLocaleDateString('en-CA'),
        time: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
        docKey: 'doctor_collision_test',
        docName: 'فاحص العزل التلقائي',
        diagnosis: `تشخيص معزول للمريض ${i}`,
        complaint: `شكوى تجريبية رقم ${i}`,
        notes: `تقرير فحص طبي معزول بالكامل للمريض رقم ${i}`
      }
    };
    
    // Simulate invoices for each isolated patient
    const invId = db.ref().child('invoices').push().key;
    const invPromise = db.ref(`${BASE}/invoices/${invId}`).set({
      patientId: newUid,
      patientName: patObj.info.name,
      visitId: visitId,
      docName: 'فاحص العزل التلقائي',
      items: [{ name: `كشفية فحص ${i}`, price: 10 * i }],
      total: 10 * i,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    const patPromise = db.ref(`${BASE}/patients/${newUid}`).set(patObj);
    promises.push(Promise.all([patPromise, invPromise]).then(() => {
      console.log(`%c✔ Generated Patient Profile & Invoice ${i}/10 (UID: ${newUid})`, "color: #10b981");
      return { uid: newUid, name: patObj.info.name, visitId, invId };
    }));
  }

  Promise.all(promises).then((results) => {
    console.log("%c📊 Verifying isolated child node integrity...", "color: #0ea5e9; font-weight: bold;");
    
    // Assert and verify child node isolation
    let assertionsPassed = true;
    
    results.forEach((r, idx) => {
      const idxNum = idx + 1;
      const cached = _patients[r.uid];
      if (!cached) {
        console.error(`❌ Assertion Failed: Patient ${idxNum} not cached in local state!`);
        assertionsPassed = false;
        return;
      }
      
      const info = cached.info || {};
      const visits = cached.visits || {};
      
      // Verify isolated EMR details
      if (info.name !== `مريض الفحص رقم ${idxNum}`) {
        console.error(`❌ Assertion Failed: Name mismatch for patient ${idxNum}! Expected 'مريض الفحص رقم ${idxNum}', got '${info.name}'`);
        assertionsPassed = false;
      }
      
      const visitEntries = Object.entries(visits);
      if (visitEntries.length !== 1 || visitEntries[0][1].diagnosis !== `تشخيص معزول للمريض ${idxNum}`) {
        console.error(`❌ Assertion Failed: EMR visit isolation broken for patient ${idxNum}!`);
        assertionsPassed = false;
      }
    });

    if (assertionsPassed) {
      console.log("%c🎉 SUCCESS: 100% EMR visits & invoices isolated under shared phone number context! Collision testing PASSED. No overwrites occurred.", "color: #10b981; font-weight: bold; font-size: 1.1rem;");
      toast("🧪 Collision test completed: 100% EMR isolation asserted successfully!", "ok");
    } else {
      console.error("❌ FAILURE: EMR collision isolation check failed!");
      toast("❌ Collision test failed! Check developer console.", "err");
    }
  }).catch(err => {
    console.error("❌ Collision test aborted due to write error:", err);
    toast("❌ Collision test error: " + err.message, "err");
  });
}

// ── ENTERPRISE MEDICAL WORKSPACE CONTROLLER ──
let activeVisit = { uid: null, bookingId: null, rx: [] };

// ── Resolve patient UID from push-key OR phone fallback ──
function resolvePatientUid(rawUid, expectedName = '') {
  // If direct key exists in local cache, use it
  if (_patients[rawUid]) return rawUid;
  
  // Otherwise search by phone number (legacy bookings)
  const phone = cleanPhone(rawUid);
  const matched = Object.entries(_patients).filter(([k, p]) => {
    return cleanPhone(p.info?.phone || '') === phone;
  });

  if (!matched.length) return null;

  expectedName = (expectedName || '').trim().toLowerCase();

  // If there's an expected name, strictly verify it to prevent returning the wrong family member
  if (expectedName) {
    const exact = matched.find(([k, p]) => (p.info?.name || '').trim().toLowerCase() === expectedName);
    if (exact) return exact[0];

    const partial = matched.find(([k, p]) => {
      const pn = (p.info?.name || '').toLowerCase();
      return pn.includes(expectedName) || expectedName.includes(pn);
    });
    if (partial) return partial[0];

    // If name provided but no match found, do NOT return a random person's ID!
    return null;
  }

  // If no expectedName provided, return the first match (legacy behavior fallback)
  return matched[0][0];
}

function loadVisitForm(rawUid, bookingId, expectedName = '') {
  const uid = resolvePatientUid(rawUid, expectedName);
  if (!uid) {
    // Patient not yet registered — open workspace with booking data only
    const booking = _liveBookings[bookingId] || {};
    const fallbackName = booking.patName || 'مريض غير مسجل';
    const fallbackPhone = booking.patPhone || '';
    activeVisit = { uid: null, bookingId, phone: fallbackPhone, name: fallbackName, rx: [] };
    document.getElementById('wsName').textContent = fallbackName;
    document.getElementById('wsMrn').textContent = '—';
    document.getElementById('wsAgeGender').textContent = `📞 ${fallbackPhone}`;
    document.getElementById('wsAvatar').innerHTML = '👤';
    _applyComplexMode();
    _resetVisitForms();
    sw('newVisit');
    const firstTab = document.querySelector('.visit-tabs .visit-tab:not([style*="none"])');
    if (firstTab) switchVisitTab(firstTab.getAttribute('onclick').match(/'(\w+)'/)[1], firstTab);
    toast('تنبيه: المريض غير مسجل في النظام — سيتم حفظ الزيارة كحجز', 'warn');
    return;
  }
  activeVisit = { uid, bookingId, rx: [] };
  
  const p = _patients[uid].info || {};
  
  // Populate Header
  document.getElementById('wsName').textContent = p.name || 'غير معروف';
  document.getElementById('wsMrn').textContent = p.mrn || '—';
  document.getElementById('wsAgeGender').textContent = `${p.age ? p.age + ' سنة' : '—'} | ${p.gender || '—'}`;
  
  if (p.photo) {
    document.getElementById('wsAvatar').innerHTML = `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    document.getElementById('wsAvatar').innerHTML = '👤';
  }

  _applyComplexMode();
  _resetVisitForms();
  sw('newVisit');
  
  // Reset to first visible tab
  const firstTab = document.querySelector('.visit-tabs .visit-tab');
  if (firstTab) switchVisitTab('tabVitals', firstTab);
}

// Helper: apply clinic/complex mode to tab visibility using cached _sets
function _applyComplexMode() {
  // Use already-loaded _sets to avoid a Firebase round-trip
  const isComplex = _sets && (_sets.mode === 'medical_complex' || _sets.type === 'complex');
  document.querySelectorAll('.tab-complex').forEach(el => {
    el.style.display = isComplex ? '' : 'none';
  });
}

// Helper: clear all workspace form fields
function _resetVisitForms() {
  ['vTemp','vBp','vHr','vO2','vComplaint','vDiag','rxDrug','rxDose','labTestInput','radScanInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  activeVisit.rx = [];
  labTestsList = [];
  radScansList = [];
  renderWorkspaceRx();
  if (typeof renderLabOrderChips === 'function') renderLabOrderChips();
  if (typeof renderRadOrderChips === 'function') renderRadOrderChips();
}

function cancelVisit() {
  activeVisit = { uid: null, bookingId: null, rx: [] };
  sw('waitingRoom');
}

function switchVisitTab(tabId, btn) {
  // Update Buttons
  document.querySelectorAll('.visit-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  // Update Contents
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
}

function addWorkspaceRx() {
  const drug = document.getElementById('rxDrug').value.trim();
  const dose = document.getElementById('rxDose').value.trim();
  if (!drug) return toast('يرجى كتابة اسم الدواء', 'err');
  
  activeVisit.rx.push({ drug, dose });
  document.getElementById('rxDrug').value = '';
  document.getElementById('rxDose').value = '';
  renderWorkspaceRx();
}

function renderWorkspaceRx() {
  const tb = document.getElementById('wsRxTbody');
  if (!tb) return;
  if (!activeVisit.rx.length) {
    tb.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--muted)">لا يوجد أدوية مضافة</td></tr>';
    return;
  }
  tb.innerHTML = activeVisit.rx.map((r, i) => `
    <tr>
      <td style="font-weight:700;color:var(--teal)">${sanitize(r.drug)}</td>
      <td>${sanitize(r.dose)}</td>
      <td><button class="rx-rm" onclick="activeVisit.rx.splice(${i}, 1); renderWorkspaceRx()"><i class="fas fa-times-circle"></i></button></td>
    </tr>
  `).join('');
}

function completeWorkspaceVisit() {
  const { uid, bookingId } = activeVisit;

  const diag = document.getElementById('vDiag').value.trim();
  const comp = document.getElementById('vComplaint').value.trim();

  if (!diag && !comp) {
    return toast('يرجى كتابة التشخيص أو شكوى المريض لإغلاق الزيارة', 'err');
  }

  // Auto-capture any pending inputs that the user typed but forgot to click "Add" for
  const pendingRxDrug = document.getElementById('rxDrug')?.value.trim();
  const pendingRxDose = document.getElementById('rxDose')?.value.trim();
  if (pendingRxDrug) {
    activeVisit.rx.push({ drug: pendingRxDrug, dose: pendingRxDose || '' });
    renderWorkspaceRx();
  }

  const pendingLab = document.getElementById('labTestInput')?.value.trim();
  if (pendingLab && !labTestsList.includes(pendingLab)) {
    labTestsList.push(pendingLab);
    renderLabOrderTags();
  }

  const pendingRad = document.getElementById('radScanInput')?.value.trim();
  if (pendingRad && !radScansList.includes(pendingRad)) {
    radScansList.push(pendingRad);
    renderRadOrderTags();
  }

  // Build visit object with field names matching what the Timeline renderer reads
  const now = new Date();
  const visitObj = {
    // Date/Time — timeline uses v.date and v.time
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
    // Doctor identity
    docName: (window.ArgonSession ? ArgonSession.get()?.displayName : null) || 'طبيب',
    docKey: 'doctor',
    // Complaint — timeline reads v.complaint
    complaint: comp || '—',
    // Diagnosis — timeline reads v.diagnosis
    diagnosis: diag || '—',
    // Vitals — timeline reads v.vitals.temp, v.vitals.bp, v.vitals.pulse
    vitals: {
      temp: document.getElementById('vTemp').value.trim(),
      bp:   document.getElementById('vBp').value.trim(),
      pulse: document.getElementById('vHr').value.trim(),  // hr → pulse
      o2:   document.getElementById('vO2').value.trim()
    },
    // Prescriptions — timeline reads v.prescriptions[].name / .dose / .freq
    prescriptions: activeVisit.rx.map(r => ({
      name: r.drug,
      dose: r.dose,
      freq: ''
    }))
  };

  // Lab / Radiology orders — timeline reads v.labOrders[] and v.radOrders[]
  if (labTestsList && labTestsList.length) visitObj.labOrders = [...labTestsList];
  if (radScansList && radScansList.length) visitObj.radOrders = [...radScansList];

  const updates = {};

  // --- Case 1: Patient is registered with a UUID ---
  if (uid && _patients[uid]) {
    const timelineKey = db.ref(`${BASE}/patients/${uid}/visits`).push().key;
    updates[`${BASE}/patients/${uid}/visits/${timelineKey}`] = visitObj;
    if (bookingId) updates[`${BASE}/live_bookings/${bookingId}/status`] = 'completed';
    
    // Create actual lab and radiology orders
    if (labTestsList && labTestsList.length > 0) {
      const labKey = db.ref(`${BASE}/lab_orders`).push().key;
      updates[`${BASE}/lab_orders/${labKey}`] = {
        patientId: uid,
        patientName: _patients[uid]?.info?.name || activeVisit.name || 'مريض',
        patientPhone: _patients[uid]?.info?.phone || activeVisit.phone || '',
        doctorId: (window.ArgonSession ? window.ArgonSession.get()?.staffId : null) || 'doctor',
        docName: (window.ArgonSession ? window.ArgonSession.get()?.displayName : null) || 'طبيب',
        createdAt: new Date().toISOString(),
        requestedTests: labTestsList.map(t => ({ name: t, status: 'waiting' })),
        status: 'waiting',
        visitId: timelineKey
      };
    }
    
    if (radScansList && radScansList.length > 0) {
      const radKey = db.ref(`${BASE}/radiology_orders`).push().key;
      updates[`${BASE}/radiology_orders/${radKey}`] = {
        patientId: uid,
        patientName: _patients[uid]?.info?.name || activeVisit.name || 'مريض',
        patientPhone: _patients[uid]?.info?.phone || activeVisit.phone || '',
        doctorId: (window.ArgonSession ? window.ArgonSession.get()?.staffId : null) || 'doctor',
        docName: (window.ArgonSession ? window.ArgonSession.get()?.displayName : null) || 'طبيب',
        createdAt: new Date().toISOString(),
        requestedScans: radScansList.map(s => ({ name: s, status: 'waiting' })),
        status: 'waiting',
        visitId: timelineKey
      };
    }
    
    // Create prescription order for pharmacy
    if (activeVisit.rx && activeVisit.rx.length > 0) {
      const prescKey = db.ref(`${BASE}/prescriptions`).push().key;
      updates[`${BASE}/prescriptions/${prescKey}`] = {
        patientId: uid,
        patientName: _patients[uid]?.info?.name || activeVisit.name || 'مريض',
        doctorId: (window.ArgonSession ? window.ArgonSession.get()?.staffId : null) || 'doctor',
        docName: (window.ArgonSession ? window.ArgonSession.get()?.displayName : null) || 'طبيب',
        medications: activeVisit.rx.map(m => ({ 
          name: m.drug, 
          dose: m.dose, 
          freq: '', 
          dur: '', 
          note: '', 
          status: 'waiting' 
        })),
        status: 'waiting',
        visitId: timelineKey,
        orgId: CID,
        createdAt: new Date().toISOString()
      };
    }

    _writeVisitUpdates(updates, diag);
  }
  // --- Case 2: Unregistered patient — auto-register then save ---
  else {
    const booking = _liveBookings[bookingId] || {};
    const newRef = db.ref(`${BASE}/patients`).push();
    const newUid = newRef.key;
    const mrn = genMRN();
    updates[`${BASE}/patients/${newUid}/info`] = {
      name: booking.patName || activeVisit.name || 'مريض',
      phone: booking.patPhone || activeVisit.phone || '',
      mrn,
      gender: '',
      age: '',
      createdAt: new Date().toISOString()
    };
    const timelineKey = db.ref(`${BASE}/patients/${newUid}/visits`).push().key;
    updates[`${BASE}/patients/${newUid}/visits/${timelineKey}`] = visitObj;
    if (bookingId) updates[`${BASE}/live_bookings/${bookingId}/status`] = 'completed';
    
    // Create actual lab and radiology orders
    if (labTestsList && labTestsList.length > 0) {
      const labKey = db.ref(`${BASE}/lab_orders`).push().key;
      updates[`${BASE}/lab_orders/${labKey}`] = {
        patientId: newUid,
        patientName: booking.patName || activeVisit.name || 'مريض',
        patientPhone: booking.patPhone || activeVisit.phone || '',
        docName: (window.ArgonSession ? ArgonSession.get()?.displayName : null) || 'طبيب',
        createdAt: new Date().toISOString(),
        requestedTests: labTestsList.map(t => ({ name: t, status: 'waiting' })),
        status: 'waiting',
        visitId: timelineKey
      };
    }
    
    if (radScansList && radScansList.length > 0) {
      const radKey = db.ref(`${BASE}/radiology_orders`).push().key;
      updates[`${BASE}/radiology_orders/${radKey}`] = {
        patientId: newUid,
        patientName: booking.patName || activeVisit.name || 'مريض',
        patientPhone: booking.patPhone || activeVisit.phone || '',
        docName: (window.ArgonSession ? ArgonSession.get()?.displayName : null) || 'طبيب',
        createdAt: new Date().toISOString(),
        requestedScans: radScansList.map(s => ({ name: s, status: 'waiting' })),
        status: 'waiting',
        visitId: timelineKey
      };
    }
    
    // Create prescription order for pharmacy
    if (activeVisit.rx && activeVisit.rx.length > 0) {
      const prescKey = db.ref(`${BASE}/prescriptions`).push().key;
      updates[`${BASE}/prescriptions/${prescKey}`] = {
        patientId: newUid,
        patientName: booking.patName || activeVisit.name || 'مريض',
        doctorId: 'doctor',
        docName: (window.ArgonSession ? ArgonSession.get()?.displayName : null) || 'طبيب',
        medications: activeVisit.rx.map(m => ({ 
          name: m.drug, 
          dose: m.dose, 
          freq: '', 
          dur: '', 
          note: '', 
          status: 'waiting' 
        })),
        status: 'waiting',
        visitId: timelineKey,
        orgId: CID,
        createdAt: new Date().toISOString()
      };
    }

    activeVisit.uid = newUid;
    _writeVisitUpdates(updates, diag);
    toast('تم تسجيل المريض تلقائياً في النظام', 'ok');
  }
}

function _writeVisitUpdates(updates, diag) {
  db.ref().update(updates).then(() => {
    logAudit('END_VISIT', `تم إنهاء زيارة وحفظ الملف. التشخيص: ${diag || '—'}`, 'العيادة');
    toast('✅ تم إنهاء الزيارة الطبية وحفظ الملف بنجاح!', 'ok');
    sw('waitingRoom');
    activeVisit = { uid: null, bookingId: null, rx: [] };
  }).catch(err => {
    toast('❌ خطأ أثناء الحفظ: ' + err.message, 'err');
  });
}
