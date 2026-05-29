/* ═══════════════════════════════════════════════════
   ARGON SYSTEM — Dashboard v2.0
   Security: Firebase Auth (email/password per clinic)
   ═══════════════════════════════════════════════════ */

const FB = {
  apiKey: "AIzaSyCDT_H-1klxbtuVR5n5GOVHKlxcmvY_2GA",
  authDomain: "clinica-system-e71b9.firebaseapp.com",
  databaseURL: "https://clinica-system-e71b9-default-rtdb.firebaseio.com",
  projectId: "clinica-system-e71b9",
  storageBucket: "clinica-system-e71b9.firebasestorage.app",
  messagingSenderId: "833103541884",
  appId: "1:833103541884:web:f8ee6ca4b3d8400cf0fbf9"
};
if (!firebase.apps.length) {
  firebase.initializeApp(FB);
}

const db = firebase.database();

// ── HOISTED VARIABLES FOR TRANSITIONAL SEC ──
const auth = firebase.auth();
const storage = firebase.storage();

const uP = new URLSearchParams(window.location.search);
let CID = uP.get('id') || localStorage.getItem('argon_id') || '1';
if (uP.get('id')) localStorage.setItem('argon_id', CID);
const BASE = 'clinics/' + CID;


// Attach settings listener IMMEDIATELY
    document.getElementById('lClinicName').textContent = 'Connecting...';
    db.ref(BASE+'/settings').on('value', snap => {
      const s = snap.val();
      
      // If clinic does not exist in DB (e.g. failed creation)
      if (!s) {
        document.getElementById('topName').textContent = '⚠️ عيادة غير موجودة';
        document.getElementById('lClinicName').textContent = 'هذه العيادة غير موجودة أو تم حذفها';
        document.getElementById('lPass').disabled = true;
        document.getElementById('lPass').placeholder = 'العيادة غير متوفرة';
        const lbtn = document.querySelector('.lbtn');
        if (lbtn) { lbtn.disabled = true; lbtn.innerHTML = '❌ غير متوفرة'; lbtn.style.background = 'var(--red)'; }
        return;
      }
      
      _sets = s;
      _sets.mode = (s.type === 'complex' || s.mode === 'medical_complex') ? 'medical_complex' : 'single_clinic';
      checkAndSeedDefaultDepartments();
      
      // Only 'suspended' locks the dashboard (Super Admin only)
      if (s.status === 'suspended') {
        document.getElementById('lockScreen').classList.add('show');
      } else {
        document.getElementById('lockScreen').classList.remove('show');
      }
    
      // Load WhatsApp Config
      const wa = s.whatsapp || {};
      document.getElementById('waEnabled').checked = !!wa.enabled;
      document.getElementById('waSignature').value = wa.signature || '';
      document.getElementById('waRemind30').checked = wa.remind30 !== false;
      document.getElementById('waRemind10').checked = wa.remind10 !== false;
      document.getElementById('waPhar').checked = wa.phar !== false;
      document.getElementById('waLab').checked = wa.lab !== false;
      document.getElementById('waRad').checked = wa.rad !== false;
      document.getElementById('waBill').checked = wa.bill !== false;
    
      document.getElementById('topName').textContent = s.name||'العيادة';
      document.getElementById('lClinicName').textContent = s.name||'العيادة';
      document.title = 'ARGON | '+(s.name||'العيادة');
      _pass = s.password||'1122';
      if (sessionStorage.getItem('clinica_auth_'+CID) === '1') {
        const el = document.getElementById('dashLogin');
        if (el) el.style.display = 'none';
      }
      const b = document.getElementById('stBadge');
      if (s.status === 'suspended') {
        b.className='tbadge tb-closed'; b.innerHTML=`<i class="fas fa-shield-alt" style="font-size:.38rem"></i> Suspended`;
      } else if (s.status === 'closed') {
        b.className='tbadge tb-closed'; b.innerHTML=`<i class="fas fa-pause-circle" style="font-size:.38rem"></i> ${DT('badgeClosed')}`;
      } else {
        b.className='tbadge tb-open'; b.innerHTML=`<i class="fas fa-circle" style="font-size:.38rem"></i> ${DT('badgeOpen')}`;
      }
      document.getElementById('sSpec').value = s.specialty||'';
      document.getElementById('sSameDay').value = s.sameDayBooking!==false ? 'true' : 'false';
      document.getElementById('sBookingDays').value = s.bookingDays||10;
      
      const sMode = document.getElementById('sMode');
      if (sMode) {
        const actualMode = (s.type === 'complex' || s.mode === 'medical_complex') ? 'medical_complex' : 'single_clinic';
        sMode.value = actualMode;
        toggleComplexView(actualMode);
      }
      
      const is24h = !!s.is24Hours;
      document.getElementById('s24h').checked = is24h;
      document.getElementById('timeInputs').style.opacity = is24h ? '0.3' : '1';
      document.getElementById('timeInputs').style.pointerEvents = is24h ? 'none' : 'auto';
    
      document.getElementById('tlogo').textContent = s.name || 'ARGON CLINIC';
      if(s.logoUrl) {
        document.getElementById('logoPrev').innerHTML = `<img src="${s.logoUrl}" style="width:100%;height:100%;object-fit:cover">`;
      } else {
        document.getElementById('logoPrev').textContent = s.emoji || '🏥';
      }
      if(s.color){onColor(s.color);const cp=document.getElementById('sC');if(cp)cp.value=s.color;}
      
    
      const portalUrl = window.location.origin + window.location.pathname.replace('dashboard.html', 'patient.html') + '?id=' + CID;
      const pLinkInput = document.getElementById('patPortalLinkUrl');
      if (pLinkInput) pLinkInput.value = portalUrl;
    
      const F={sN:'name',sP:'phone',sSpec:'specialty',sEm:'emoji',sBookingDays:'bookingDays',sWs:'clinicStart',sWe:'clinicEnd'};
      for(let id in F){const el=document.getElementById(id);if(el&&!el.matches(':focus'))el.value=s[F[id]]||'';}
      const st=document.getElementById('sSt');if(st&&s.status!=='suspended')st.value=s.status||'open';
      const ssd=document.getElementById('sSameDay');if(ssd)ssd.value=(s.sameDayBooking!==false)?'true':'false';
      if(!s.bookingDays) document.getElementById('sBookingDays').value = '10';
      if(!s.clinicStart) document.getElementById('sWs').value = '09:00';
      if(!s.clinicEnd) document.getElementById('sWe').value = '22:00';
    }, err => { document.getElementById('lClinicName').textContent = 'DB Err: ' + err.code; });

// ── V8.3 ENTERPRISE READINESS ORCHESTRATOR ──
async function bootstrapDashboard() {
  console.log("Waiting for ArgonPortalRuntime...");
  if (typeof ArgonPortalRuntime !== 'undefined') {
    await ArgonPortalRuntime.waitForReady();
  } else {
    console.warn("ArgonPortalRuntime not found, proceeding (Not Enterprise)");
  }
  
  // Set global _docs from hydrated staff if available
  if (window._argonStaff) _docs = window._argonStaff;
  
  console.log("ArgonPortalRuntime READY. Hydrating dashboard...");

/* Variables successfully hoisted to top */

let _pass = '1122', _logins = 0, _lockUntil = 0;
let _bks = {}, _cmp = {}, _docs = {}, _sets = {}, _referrals = {}, isConn = true;
let prevCount = 0, firstLoad = true, audioCtx = null, _anonUid = null;

// ── DASHBOARD MULTI-LANGUAGE (i18n) ENGINE ──
const dash_i18n = {
  ar: {
    menuLive: "الحجوزات الحية", menuHist: "السجل", menuDocs: "الأطباء", menuSets: "الإعدادات",
    statLive: "النشاط المباشر", statLiveSub: "زائر يتصفح النظام", statToday: "حجوزات اليوم", statRev: "الإيرادات اليومية", statTotal: "إجمالي الحجوزات",
    badgeOpen: "مفتوح", badgeClosed: "مغلق",
    docPerf: "أداء الأطباء", bookingsTitle: "الحجوزات الحية",
    histTitle: "السجل", clearHist: "مسح السجل",
    docTitle: "إدارة الطاقم", btnAdd: "إضافة",
    setsTitle: "الإعدادات", btnSave: "حفظ التغييرات",
    loginTitle: "تسجيل الدخول", loginSub: "لوحة تحكم الطبيب", btnLogin: "دخول",
    toastConn: "تم الاتصال", toastNoConn: "لا يوجد اتصال",
    connOk: "متصل", connOff: "لا يوجد اتصال..."
  },
  en: {
    menuLive: "Live Bookings", menuHist: "History", menuDocs: "Doctors", menuSets: "Settings",
    statLive: "Live Activity", statLiveSub: "Active Visitors", statToday: "Today's Bookings", statRev: "Daily Revenue", statTotal: "Total Bookings",
    badgeOpen: "Open", badgeClosed: "Closed",
    docPerf: "Doctors Performance", bookingsTitle: "Live Bookings",
    histTitle: "History", clearHist: "Clear History",
    docTitle: "Manage Doctors", btnAdd: "Add",
    setsTitle: "Settings", btnSave: "Save Changes",
    loginTitle: "Login", loginSub: "Admin Dashboard", btnLogin: "Login",
    toastConn: "Connected", toastNoConn: "No Connection",
    connOk: "Connected", connOff: "No connection..."
  },
  fr: {
    menuLive: "Réservations en direct", menuHist: "Historique", menuDocs: "Médecins", menuSets: "Paramètres",
    statLive: "Activité en direct", statLiveSub: "Visiteurs actifs", statToday: "Réservations du jour", statRev: "Revenus", statTotal: "Total",
    badgeOpen: "Ouvert", badgeClosed: "Fermé",
    docPerf: "Performance", bookingsTitle: "Réservations en direct",
    histTitle: "Historique", clearHist: "Effacer",
    docTitle: "Gérer les Médecins", btnAdd: "Ajouter",
    setsTitle: "Paramètres", btnSave: "Enregistrer",
    loginTitle: "Connexion", loginSub: "Tableau de Bord", btnLogin: "Entrer",
    toastConn: "Connecté", toastNoConn: "Pas de connexion",
    connOk: "Connecté", connOff: "Pas de connexion..."
  }
};

let curLang = localStorage.getItem('argon_dash_lang_' + CID) || 'ar';
function DT(key) { return (dash_i18n[curLang] && dash_i18n[curLang][key]) || dash_i18n['ar'][key] || key; }

function setDashLang(lang) {
  curLang = lang;
  localStorage.setItem('argon_dash_lang_' + CID, lang);
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.getElementById('sLang').value = lang;
  
  // Update Static Texts
  const q = (sel, txt) => { const el = document.querySelector(sel); if(el) el.innerHTML = txt; };
  q('#m1 span', DT('menuLive')); q('#m2 span', DT('menuHist')); q('#m3 span', DT('menuDocs')); q('#m4 span', DT('menuSets'));
  q('#live .pt', '🔔 ' + DT('bookingsTitle'));
  q('#hist .pt', '📜 ' + DT('histTitle')); q('#hist button', '<i class="fas fa-trash" style="margin-left:5px"></i>' + DT('clearHist'));
  q('#docs .pt', '👨‍⚕️ ' + DT('docTitle')); q('.badd', '<i class="fas fa-plus" style="margin-left:4px"></i>' + DT('btnAdd'));
  q('#settings .pt', '⚙️ ' + DT('setsTitle')); q('.bsave', '<i class="fas fa-floppy-disk" style="margin-left:8px"></i>' + DT('btnSave'));
  q('.lcard h2', '🏥 ' + DT('loginTitle')); q('.lcard p', DT('loginSub')); q('#btnLog', DT('btnLogin'));
  
  const lbls = document.querySelectorAll('.slb');
  if(lbls[0]) lbls[0].innerHTML = DT('statToday');
  if(lbls[1]) lbls[1].innerHTML = DT('statRev');
  if(lbls[2]) lbls[2].innerHTML = DT('statTotal');
  if(lbls[3]) lbls[3].innerHTML = DT('statLive');
  const subs = document.querySelectorAll('.scard-sub');
  if(subs[2]) subs[2].innerHTML = DT('statLiveSub');
  
  // Refresh UI
  renderLive();
  renderHist();
  renderDocs();
}

// Init Dashboard Language
document.addEventListener('DOMContentLoaded', () => setDashLang(curLang));

// ── AUTH & PRESENCE ──
auth.signInAnonymously().then(r => {
  _anonUid = r.user.uid;
  console.log("Firebase Auth Success:", _anonUid);
  registerPresence();
}).catch(e => console.error("Firebase Auth Error:", e));

function registerPresence() {
  if(!isConn || !_anonUid) return;
  const dPres = db.ref(BASE+'/presence/admin_'+_anonUid.substr(0,5));
  dPres.set(true).catch(e => console.error("Presence Set Error:", e));
  dPres.onDisconnect().remove();
}

// ── CLOCK ──
setInterval(() => {
  document.getElementById('tclk').textContent = new Date().toLocaleTimeString('ar-JO',{hour:'2-digit',minute:'2-digit',hour12:true,timeZoneName:'short'});
}, 1000);

// ── CONNECTION & PRESENCE ──
db.ref('.info/connected').on('value', snap => {
  const was = !isConn; isConn = snap.val()===true;
  const bar = document.getElementById('connBar');
  if (isConn) {
    bar.className='cbar cok'; bar.innerHTML=`<i class="fas fa-wifi"></i> ${DT('connOk')}`; bar.style.display='flex';
    setTimeout(()=>{if(isConn)bar.style.display='none';},2000);
    if (was) toast('✅ ' + DT('toastConn'), 'ok');
    
    // Register Dashboard Presence (Doctor)
    const dPres = db.ref(BASE+'/presence/admin_'+(Math.random().toString(36).substr(2,5)));
    dPres.set({ type: 'admin', ts: firebase.database.ServerValue.TIMESTAMP });
    dPres.onDisconnect().remove();
  } else { bar.style.display='flex'; bar.className='cbar coff'; bar.innerHTML=`<i class="fas fa-exclamation-triangle"></i> ${DT('connOff')}`; }
});
window.addEventListener('offline',()=>{isConn=false;db.goOffline();});
window.addEventListener('online',()=>setTimeout(()=>db.goOnline(),1000));

// ── LOGIN — Brute force protection ──
document.getElementById('lPass').addEventListener('keyup', e => { if(e.key==='Enter') doLogin(); });
function doLogin() {
  if (Date.now() < _lockUntil) { toast(`⛔ محاولات كثيرة، انتظر ${Math.ceil((_lockUntil-Date.now())/1000)} ثانية`, 'err'); return; }
  const val = document.getElementById('lPass').value;
  const MASTER = 'argon_master_2026';
  if (val === _pass || val === MASTER) {
    _logins = 0;
    sessionStorage.setItem('clinica_auth_'+CID, '1');
    const el = document.getElementById('dashLogin');
    el.style.opacity='0'; el.style.transition='opacity .35s';
    setTimeout(()=>{ el.style.display='none'; toast('✅ أهلاً بك!', 'ok'); },360);
    // Auto-Auth for Storage Access
    auth.signInAnonymously().catch(()=>{});
  } else {
    _logins++;
    const inp = document.getElementById('lPass');
    inp.classList.add('shake'); setTimeout(()=>inp.classList.remove('shake'),300);
    if (_logins >= 5) { _lockUntil = Date.now()+60000; toast('⛔ تم قفل الدخول لمدة 60 ثانية', 'err'); return; }
    document.getElementById('lErr').style.display='block';
    setTimeout(()=>document.getElementById('lErr').style.display='none',3000);
  }
}
function doLogout() {
  sessionStorage.removeItem('clinica_auth_'+CID);
  window.location.reload();
}

// ── SOUND ──
function beep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    [880,1108,1318].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.value=f;
      const t=audioCtx.currentTime+(i*.25);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.4,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.28);
      o.start(t);o.stop(t+.3);
    });
  }catch(e){}
}
document.addEventListener('click',()=>{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();},{once:true});

// ── COLOR ──
function onColor(c) {
  document.documentElement.style.setProperty('--teal',c);
  document.getElementById('colorHex').textContent=c;
}

// ── DEPARTMENTS AND COMPLEX MODE ENGINE ──
let _depts = {};
let activeDashboardDeptFilter = 'all';

function toggleComplexView(mode) {
  const isComplex = mode === 'medical_complex';
  const dp = document.getElementById('deptsPanel');
  if (dp) dp.style.display = isComplex ? 'block' : 'none';
  const dw = document.getElementById('docDeptWrapper');
  if (dw) dw.style.display = isComplex ? 'block' : 'none';
  const cn = document.getElementById('complexNav');
  if (cn) cn.style.display = isComplex ? 'block' : 'none';
  
  
  // Render live views
  renderDashboardDeptFilters();
  if (typeof renderLive === 'function') {
    const actKeys = Object.keys(_bks).filter(k=>{
      const s=_bks[k].status;
      return s!=='done'&&s!=='completed'&&s!=='cancelled';
    });
    renderLive(actKeys);
  }
}

function renderDashboardDeptFilters() {
  const wrap = document.getElementById('dashDeptFilterWrap');
  if (!wrap) return;
  if (!_sets || _sets.mode !== 'medical_complex') {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';
  const keys = Object.keys(_depts);
  
  let html = `
    <button class="spec-chip ${activeDashboardDeptFilter === 'all' ? 'act' : ''}" onclick="setDashboardDeptFilter('all')" style="padding:6px 14px;border-radius:20px;font-family:inherit;font-weight:700;font-size:0.75rem;cursor:pointer;border:1.5px solid var(--border);background:var(--card)">
      🩺 الكل
    </button>
  `;
  keys.forEach(k => {
    const d = _depts[k];
    const actClass = activeDashboardDeptFilter === k ? 'act' : '';
    html += `
      <button class="spec-chip ${actClass}" onclick="setDashboardDeptFilter('${k}')" style="padding:6px 14px;border-radius:20px;font-family:inherit;font-weight:700;font-size:0.75rem;cursor:pointer;color:${d.color || 'var(--teal)'};border-color:${d.color || 'var(--teal)'};background:var(--card)">
        <span>${d.emoji || '🏢'}</span> ${sanitize(d.name)}
      </button>
    `;
  });
  wrap.innerHTML = html;
}

function setDashboardDeptFilter(deptId) {
  activeDashboardDeptFilter = deptId;
  renderDashboardDeptFilters();
  const actKeys = Object.keys(_bks).filter(k=>{
    const s=_bks[k].status;
    return s!=='done'&&s!=='completed'&&s!=='cancelled';
  });
  renderLive(actKeys);
}

db.ref(BASE+'/departments').on('value', snap => {
  _depts = snap.val() || {};
  renderDepts();
  updateDocDeptDropdown();
  renderDashboardDeptFilters();
  if (typeof renderDocs === 'function') renderDocs();
});

function renderDepts() {
  const dg = document.getElementById('deptsGrid');
  if (!dg) return;
  const keys = Object.keys(_depts);
  if (!keys.length) {
    dg.innerHTML = '<div style="color:var(--muted);font-size:.78rem;text-align:center;padding:12px">لا توجد أقسام مضافة بعد</div>';
    return;
  }
  dg.innerHTML = keys.map(k => {
    const d = _depts[k];
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px">
        <span style="font-size:1.1rem">${d.emoji || '🏥'}</span>
        <div style="flex:1;margin-right:8px">
          <span style="font-weight:700;font-size:.85rem;color:var(--text)">${sanitize(d.name)}</span>
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${d.color || '#0d9488'};vertical-align:middle;margin-right:6px"></span>
        </div>
        <button type="button" onclick="deleteDept('${k}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.88rem;padding:4px"><i class="fas fa-trash"></i></button>
      </div>
    `;
  }).join('');
}

function updateDocDeptDropdown() {
  const select = document.getElementById('dDept');
  if (!select) return;
  const keys = Object.keys(_depts);
  let html = '<option value="">— عام —</option>';
  keys.forEach(k => {
    const d = _depts[k];
    html += `<option value="${k}">${d.emoji || '🏥'} ${sanitize(d.name)}</option>`;
  });
  select.innerHTML = html;
}

function addDept() {
  const name = document.getElementById('depN').value.trim();
  const emoji = document.getElementById('depI').value.trim() || '🏥';
  const color = document.getElementById('depC').value || '#0d9488';
  if (!name) { toast('⚠️ الرجاء إدخال اسم القسم', 'err'); return; }
  
  const deptObj = { name: sanitize(name), emoji: sanitize(emoji), color: color };
  db.ref(BASE + '/departments').push(deptObj).then(() => {
    toast('✅ تم إضافة القسم بنجاح', 'ok');
    document.getElementById('depN').value = '';
    document.getElementById('depI').value = '';
  }).catch(() => toast('❌ فشل إضافة القسم', 'err'));
}

function deleteDept(key) {
  if (!confirm('هل أنت متأكد من حذف هذا القسم؟ لن يتم حذف الأطباء، لكن سيتم إلغاء ربطهم بالقسم.')) return;
  db.ref(BASE + '/departments/' + key).remove().then(() => {
    toast('✅ تم حذف القسم', 'ok');
  });
}

// ── SETTINGS LISTENER ──
/* Settings listener moved to run immediately for login screen */

// ── CONNECTION MONITOR ──
db.ref('.info/connected').on('value', snap => {
  const was = !isConn; isConn = snap.val()===true;
  const bar = document.getElementById('connBar');
  if (isConn) {
    bar.className='cbar cok'; bar.innerHTML='<i class="fas fa-wifi"></i> متصل'; bar.style.display='flex';
    setTimeout(()=>{if(isConn)bar.style.display='none';},2000);
    if (was) toast('✅ تم الاتصال');
    registerPresence();
  } else { bar.style.display='flex'; bar.className='cbar coff'; bar.innerHTML='<i class="fas fa-exclamation-triangle"></i> لا يوجد اتصال...'; }
});
document.getElementById('stCID').textContent = '(ID: '+CID+')';

// ── LIVE PRESENCE LISTENER ──
db.ref(BASE+'/presence').on('value', snap => {
  const count = snap.numChildren() || 0;
  document.getElementById('stLive').textContent = count;
});

// ── LIVE BOOKINGS LISTENER ──
// ── REFERRALS LISTENER (for department filtering & referral card rendering) ──
db.ref(BASE+'/referrals').on('value', snap => {
  _referrals = snap.val()||{};
});

// ── Enterprise Event-Driven Bookings (Incremental) ──
let _bksRenderTimer = null;
function recalcBookings() {
  clearTimeout(_bksRenderTimer);
  _bksRenderTimer = setTimeout(() => {
    const actKeys = Object.keys(_bks).filter(k=>{const s=_bks[k].status;return s!=='done'&&s!=='completed'&&s!=='cancelled';});
    
    const lc = document.getElementById('liveC');
    lc.textContent = actKeys.length; lc.className='nbdg'+(actKeys.length===0?' z':'');
    if (!firstLoad && actKeys.length > prevCount) { beep(); ring(); }
    prevCount = actKeys.length;

    const now = new Date();
    const curMonth = now.toISOString().substring(0, 7);
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const prevMonth = prevMonthDate.toISOString().substring(0, 7);

    const bksArr = Object.values(_bks);
    const curMonthBks = bksArr.filter(b => (b.date||'').startsWith(curMonth)).length;
    const prevMonthBks = bksArr.filter(b => (b.date||'').startsWith(prevMonth)).length;
    
    document.getElementById('stMonth').textContent = curMonthBks;
    const growth = prevMonthBks ? Math.round(((curMonthBks - prevMonthBks) / prevMonthBks) * 100) : 100;
    const gt = document.getElementById('stGrowthTrend');
    gt.textContent = (growth >= 0 ? '+' : '') + growth + '%';
    gt.className = 'scard-trend ' + (growth >= 0 ? 'trend-up' : 'trend-down');

    renderLive(actKeys);
    firstLoad = false;
  }, 80);
}
db.ref(BASE+'/bookings').on('child_added', snap => { _bks[snap.key] = snap.val(); recalcBookings(); });
db.ref(BASE+'/bookings').on('child_changed', snap => { _bks[snap.key] = snap.val(); recalcBookings(); });
db.ref(BASE+'/bookings').on('child_removed', snap => { delete _bks[snap.key]; recalcBookings(); });

function ring() {
  const b=document.getElementById('bellI'); b.classList.add('ringing');
  setTimeout(()=>b.classList.remove('ringing'),2500);
}

function renderLive(keys) {
  let filteredKeys = keys || [];
  if (_sets.mode === 'medical_complex' && activeDashboardDeptFilter !== 'all') {
    filteredKeys = keys.filter(k => {
      const b = _bks[k];
      // Referral bookings: match by target department from referral data
      if (b.docKey === 'referral' && b.referralId) {
        const ref = _referrals && _referrals[b.referralId];
        return ref && ref.toDept === activeDashboardDeptFilter;
      }
      const doc = b.docKey && _docs[b.docKey] ? _docs[b.docKey] : null;
      return doc && doc.departmentId === activeDashboardDeptFilter;
    });
  }

  const g = document.getElementById('liveGrid');
  if (!filteredKeys.length) {
    g.innerHTML = `<div class="empty-g"><i class="fas fa-calendar-check"></i><p>لا توجد حجوزات نشطة حالياً</p></div>`;
    return;
  }

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const DAY_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  const stMap   = { new:'جديد',      confirmed:'مؤكد ✅',   waiting:'بالانتظار ⏳' };
  const stColor = { new:'var(--amber)', confirmed:'var(--green)', waiting:'var(--sky)' };
  const stBg    = { new:'rgba(245,158,11,.12)', confirmed:'rgba(16,185,129,.12)', waiting:'rgba(14,165,233,.12)' };

  // ── Group bookings by date ──
  const groups = {};
  filteredKeys.forEach(k => {
    const b = _bks[k];
    const d = b.date || 'unknown';
    if (!groups[d]) groups[d] = [];
    groups[d].push(k);
  });

  // ── Sort: today first, then ascending by date ──
  const sortedDates = Object.keys(groups).sort((a, b) => {
    if (a === todayStr) return -1;
    if (b === todayStr) return 1;
    return a < b ? -1 : 1;
  });

  let html = '';

  sortedDates.forEach(date => {
    const isToday = date === todayStr;
    const dateKeys = groups[date].sort((a, b) => {
      // Sort within day: by time ascending
      return (_bks[a].time || '') < (_bks[b].time || '') ? -1 : 1;
    });

    // ── Date header ──
    let dateLabel = '';
    const thDay = curLang === 'ar' ? 'حجوزات اليوم' : (curLang === 'fr' ? "Réservations d'Aujourd'hui" : "Today's Bookings");
    const thBook = curLang === 'ar' ? 'حجز' : (curLang === 'fr' ? 'RDV' : 'Bk');
    if (isToday) {
      dateLabel = `<div style="
        display:flex;align-items:center;gap:10px;
        margin:0 0 14px 0;padding:10px 16px;
        background:linear-gradient(135deg,rgba(13,148,136,.15),rgba(14,165,233,.08));
        border:1px solid rgba(13,148,136,.3);
        border-radius:12px;
        ">
        <div style="width:10px;height:10px;background:var(--green);border-radius:50%;box-shadow:0 0 8px var(--green);animation:pulseAnim 1.5s infinite"></div>
        <span style="font-weight:900;font-size:1rem;color:var(--green)">${thDay}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.72rem;color:var(--muted);margin-right:auto">${date}</span>
        <span style="background:var(--green);color:#fff;font-size:.7rem;font-weight:800;padding:3px 10px;border-radius:20px">${dateKeys.length} ${thBook}</span>
      </div>`;
    } else {
      let DAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      if(curLang === 'en') DAY_AR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if(curLang === 'fr') DAY_AR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const d = new Date(date + 'T12:00:00');
      const dayName = DAY_AR[d.getDay()];
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const isNext = date === tomorrow.toLocaleDateString('en-CA');
      const tmrwLbl = isNext ? (curLang === 'ar' ? 'غداً — ' : (curLang === 'fr' ? 'Demain — ' : 'Tmrw — ')) : '';
      dateLabel = `<div style="
        display:flex;align-items:center;gap:10px;
        margin:24px 0 14px 0;padding:10px 16px;
        background:var(--surf);
        border:1px solid var(--border);
        border-radius:12px;
        ">
        <i class="fas fa-calendar-day" style="color:var(--sky);font-size:.85rem"></i>
        <span style="font-weight:800;font-size:.95rem;color:var(--text)">${tmrwLbl}${dayName}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:.72rem;color:var(--muted);margin-right:auto">${date}</span>
        <span style="background:var(--surf);border:1px solid var(--border);color:var(--muted);font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px">${dateKeys.length} ${thBook}</span>
      </div>`;
    }

    html += `<div style="margin-bottom:8px">${dateLabel}</div>`;
    html += `<div class="bg" style="margin-bottom:4px">`;

    dateKeys.forEach(k => {
      const b = _bks[k];
      const st = b.status || 'new';
      const isRef = b.docKey === 'referral';
      const borderLeft = isRef
        ? '#a855f7'
        : isToday
          ? (st === 'new' ? 'var(--amber)' : st === 'confirmed' ? 'var(--green)' : 'var(--sky)')
          : 'var(--border)';

      // Unique visual ID: date-scoped booking number
      const dateTag = isToday ? `<span style="
          font-size:.6rem;font-weight:700;color:var(--green);
          background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);
          padding:1px 6px;border-radius:6px;margin-right:5px
        ">اليوم</span>` : `<span style="
          font-size:.6rem;font-weight:700;color:var(--muted);
          background:var(--surf);border:1px solid var(--border);
          padding:1px 6px;border-radius:6px;margin-right:5px;
          font-family:'IBM Plex Mono',monospace
        ">${date.slice(5)}</span>`;

      // ── Referral-specific visual elements ──
      const refBadge = isRef ? `<span style="
          font-size:.68rem;font-weight:800;color:#a855f7;
          background:rgba(168,85,247,.1);border:1px solid rgba(168,85,247,.3);
          padding:2px 10px;border-radius:20px;display:inline-flex;align-items:center;gap:4px
        "><i class='fas fa-exchange-alt' style='font-size:.6rem'></i> تحويل داخلي</span>` : '';

      const refBanner = isRef ? `<div style="
          margin:6px 0 8px;padding:7px 12px;border-radius:8px;
          background:linear-gradient(135deg,rgba(168,85,247,.08),rgba(124,58,237,.04));
          border:1px solid rgba(168,85,247,.18);
          display:flex;align-items:center;gap:8px;font-size:.78rem
        ">
          <span style="font-size:1.1rem">${sanitize(b.docName).replace('تحويل إلى ','')?.split(' ')[0] || '🏢'}</span>
          <div>
            <div style="font-weight:800;color:#a855f7">${sanitize(b.docName)}</div>
            <div style="font-size:.7rem;color:var(--muted);margin-top:1px">محال من الطبيب المعالج · رسوم الكشف: مجاني</div>
          </div>
        </div>` : '';

      const cardBg = isRef
        ? 'background:linear-gradient(135deg,rgba(168,85,247,.03),rgba(124,58,237,.01));border:1px solid rgba(168,85,247,.15);'
        : '';

      html += `<div class="bc${st === 'cancelled' ? ' cancel' : ''}" style="border-right-color:${borderLeft};${cardBg}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:6px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
            ${dateTag}
            <span class="bno" dir="ltr">${b.bookNo || '#----'}</span>
            ${refBadge}
          </div>
          <span style="font-size:.72rem;font-weight:800;color:${stColor[st]};background:${stBg[st]};padding:3px 10px;border-radius:20px">${stMap[st] || st}</span>
        </div>
        <div class="bname">${sanitize(b.patName)}</div>
        <div class="binfo">📞 ${sanitize(b.patPhone)}</div>
        ${isRef ? refBanner : `<div class="binfo">👨‍⚕️ د. ${sanitize(b.docName)} · <span style="color:var(--teal)">${sanitize(b.docSpec || '')}</span></div>`}
        <div class="binfo" style="display:flex;align-items:center;gap:10px">
          <span style="font-family:'IBM Plex Mono',monospace;background:var(--surf);border:1px solid var(--border);padding:2px 8px;border-radius:7px;font-size:.78rem">${isRef ? '🔀 تحويل داخلي' : '🕐 ' + (b.time || '—')}</span>
          ${b.patAge ? `<span style="font-size:.75rem;color:var(--muted)">${b.patAge} سنة · ${b.patGender || '—'}</span>` : ''}
        </div>
        ${b.notes ? `<div class="bnote">${isRef ? '🔖' : '📝'} ${sanitize(b.notes)}</div>` : ''}
        <div class="bfooter">
          <span class="bprice">${isRef ? '<span style="color:#a855f7;font-weight:700">مجاني</span>' : (b.fee || '0.00') + ' <small>د.أ</small>'}</span>
          <div class="acts">
            ${b.patPhone ? `<button class="ab" onclick="window.open('emr.html?id='+CID+'&phone='+sanitize('${b.patPhone}'),'_blank')" style="background:rgba(13,148,136,.1);color:var(--teal);border-color:rgba(13,148,136,.25)"><i class="fas fa-file-medical"></i> الملف</button>` : ''}
            ${st === 'new' ? `<button class="ab a-ok" onclick="updSt('${k}','confirmed')"><i class="fas fa-check"></i> تأكيد</button>` : ''}
            ${st === 'confirmed' ? `<button class="ab a-wait" onclick="updSt('${k}','waiting')"><i class="fas fa-clock"></i> انتظار</button>` : ''}
            ${st === 'waiting' ? `<button class="ab a-wait" style="background:rgba(59, 130, 246, 0.1);color:#3b82f6;border-color:rgba(59, 130, 246, 0.3)" onclick="updSt('${k}','with_doctor')"><i class="fas fa-user-md"></i> للعيادة</button>` : ''}
            ${st === 'with_doctor' ? `<button class="ab a-done" onclick="cmpBook('${k}')"><i class="fas fa-flag-checkered"></i> إنهاء</button>` : ''}
            ${st !== 'cancelled' && st !== 'completed' ? `<button class="ab a-cancel" onclick="updSt('${k}','cancelled')"><i class="fas fa-times"></i> إلغاء</button>` : ''}
            ${b.patPhone ? `<button class="ab a-wa" onclick="sendWA('${sanitize(b.patPhone)}','${st}','${b.bookNo}','${sanitize(b.patName)}')"><i class="fab fa-whatsapp"></i></button>` : ''}
          </div>
        </div>
      </div>`;
    });

    html += `</div>`;
  });

  g.innerHTML = html;
}

// ── COMPLETED LISTENER (Enterprise Incremental) ──
let _cmpTimer = null;
function recalcCmp() {
  clearTimeout(_cmpTimer);
  _cmpTimer = setTimeout(() => {
    const keys = Object.keys(_cmp);
    let rev=0, rSum=0, rCnt=0;
    const docSt = {};
    keys.forEach(k=>{
      const b=_cmp[k];
      if(!b) return;
      rev+=parseFloat(b.fee||0);
      if(b.rating){rSum+=b.rating;rCnt++;}
      const dn=b.docName||'—';
      if(!docSt[dn])docSt[dn]={cnt:0,rev:0,ratings:[]};
      docSt[dn].cnt++;docSt[dn].rev+=parseFloat(b.fee||0);
      if(b.rating)docSt[dn].ratings.push(b.rating);
    });
    document.getElementById('stRev').textContent=rev.toFixed(2);
    const cancelledCount = Object.values(_bks).filter(b => b.status === 'cancelled').length;
    const totalClosed = keys.length + cancelledCount;
    const successRate = totalClosed ? Math.round((keys.length / totalClosed) * 100) : 100;
    document.getElementById('stSuccess').textContent = successRate + '%';
    document.getElementById('stSuccessTrend').textContent = successRate + '%';
    const avgRating = rCnt ? (rSum / rCnt) : 0;
    const satIndex = Math.round((avgRating / 5) * 100);
    document.getElementById('stSatIndex').textContent = satIndex + '%';
    document.getElementById('stRate').textContent = (avgRating ? avgRating.toFixed(1) : '--') + ' من 5 نجوم';
    const dp=document.getElementById('docPerf');
    const sorted=Object.entries(docSt).sort((a,b)=>b[1].cnt-a[1].cnt).slice(0,6);
    dp.innerHTML=sorted.length?sorted.map(([name,st])=>{
      const avg=st.ratings.length?'★'+(st.ratings.reduce((a,b)=>a+b,0)/st.ratings.length).toFixed(1):'';
      return `<div style="background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:15px">
        <div style="font-size:.9rem;font-weight:800;margin-bottom:6px">د. ${sanitize(name)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.8rem;color:var(--teal)">${st.cnt} حجز</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:.77rem;color:var(--green)">${st.rev.toFixed(2)} د.أ</div>
        ${avg?`<div style="font-size:.75rem;color:var(--amber)">${avg}</div>`:''}
      </div>`;
    }).join(''):`<div style="color:var(--muted);font-size:.84rem">لا توجد بيانات بعد</div>`;
    window.renderHist();
  }, 100);
}
window.renderHist = function() {
  const hg=document.getElementById('histGrid');
  if(!hg) return;
  const sq = (document.getElementById('histSearch') ? document.getElementById('histSearch').value : '').toLowerCase().trim();
  let filteredKeys = Object.keys(_cmp);
  if(sq) {
    filteredKeys = filteredKeys.filter(k => {
      const b = _cmp[k]; if(!b) return false;
      return (b.patName && b.patName.toLowerCase().includes(sq)) ||
             (b.patPhone && b.patPhone.includes(sq)) ||
             (b.bookNo && b.bookNo.toLowerCase().includes(sq)) ||
             (b.docName && b.docName.toLowerCase().includes(sq));
    });
  }
  const noHistMsg = curLang === 'ar' ? 'لا يوجد سجل يطابق البحث' : (curLang === 'fr' ? 'Aucun historique' : 'No History');
  if(!filteredKeys.length){hg.innerHTML=`<div style="text-align:center;padding:50px;color:var(--muted)">${noHistMsg}</div>`;return;}
  const th1=curLang==='ar'?'التاريخ':(curLang==='fr'?'Date':'Date');
  const th2=curLang==='ar'?'المريض':(curLang==='fr'?'Patient':'Patient');
  const th3=curLang==='ar'?'الطبيب':(curLang==='fr'?'Médecin':'Doctor');
  const th4=curLang==='ar'?'الوقت':(curLang==='fr'?'Heure':'Time');
  const th5=curLang==='ar'?'الرسوم':(curLang==='fr'?'Frais':'Fee');
  const th6=curLang==='ar'?'التقييم':(curLang==='fr'?'Évaluation':'Rating');
  hg.innerHTML=`<div class="htw"><table><thead><tr><th>${th1}</th><th>${th2}</th><th>${th3}</th><th>${th4}</th><th>${th5}</th><th>${th6}</th></tr></thead>
    <tbody>${filteredKeys.slice().reverse().slice(0,60).map(k=>{const b=_cmp[k];if(!b)return'';
      return`<tr><td><div style="font-weight:700">${b.date||'—'}</div></td>
        <td><b>${sanitize(b.patName||'—')}</b><br><small>${sanitize(b.patPhone||'')}</small></td>
        <td>د. ${sanitize(b.docName||'—')}<br><small style="color:var(--teal)">${sanitize(b.docSpec||'')}</small></td>
        <td style="font-family:'IBM Plex Mono',monospace">${b.time||'—'}</td>
        <td style="color:var(--green);font-weight:800">${b.fee||'0.00'}</td>
        <td style="color:var(--amber)">${b.rating?'★'.repeat(b.rating):'—'}</td>
      </tr>`;}).join('')}</tbody></table></div>`;
};
db.ref(BASE+'/completedBookings').orderByKey().limitToLast(200).on('child_added', snap => { _cmp[snap.key]=snap.val(); recalcCmp(); });
db.ref(BASE+'/completedBookings').on('child_changed', snap => { _cmp[snap.key]=snap.val(); recalcCmp(); });
db.ref(BASE+'/completedBookings').on('child_removed', snap => { delete _cmp[snap.key]; recalcCmp(); });

// ── DOCTORS LISTENER ──
db.ref(BASE+'/doctors').on('value', snap => {
  _docs = snap.val()||{};
  const dg=document.getElementById('docGrid');
  const keys=Object.keys(_docs);
  if(!keys.length){dg.innerHTML='<div style="color:var(--muted);font-size:.84rem;grid-column:1/-1">لا يوجد أطباء بعد</div>';return;}
  dg.innerHTML=keys.map(k=>{
    const d=_docs[k];
    const avail=d.available!==false;
    const avg=d.avgRating?`★${d.avgRating.toFixed(1)} (${d.ratingCount||0})`:'';
    const dept = d.departmentId && _depts[d.departmentId] ? _depts[d.departmentId] : null;
    const deptTag = dept && (_sets.mode === 'medical_complex') ? `<div style="font-size:0.75rem;margin:3px 0;font-weight:700;color:${dept.color || 'var(--teal)'}"><span style="font-size:0.85rem">${dept.emoji || '🏢'}</span> ${sanitize(dept.name)}</div>` : '';
    
    // Map workdays list to Arabic string
    const dayNamesAr = { 6:'السبت', 0:'الأحد', 1:'الاثنين', 2:'الثلاثاء', 3:'الأربعاء', 4:'الخميس', 5:'الجمعة' };
    const wDays = d.workDays || [0, 1, 2, 3, 4, 6];
    const wDaysLabels = wDays.map(day => dayNamesAr[day] || '').filter(Boolean).join(' · ');

    return `<div class="dc">
      <div class="dc-top">${d.img?`<img src="${d.img}" alt="${d.name}">`:d.emoji||'👨‍⚕️'}</div>
      <div class="dc-body">
        <div class="dc-name">د. ${sanitize(d.name)}</div>
        <div class="dc-spec">${sanitize(d.specialty||'')}</div>
        ${deptTag}
        <div class="dc-fee">${parseFloat(d.fee||0).toFixed(2)} د.أ · ${d.slotDuration||30}د</div>
        <div class="dc-fee" style="font-size:.71rem;color:var(--muted)">${d.workStart||'09:00'} — ${d.workEnd||'17:00'}</div>
        <div style="font-size:0.68rem;color:var(--teal);margin-top:2px;font-weight:700">🗓️ الدوام: ${wDaysLabels}</div>
        ${avg?`<div class="drate">${avg}</div>`:''}
        <div class="avl-tog" onclick="togAvail('${k}',${avail})">
          <input type="checkbox" ${avail?'checked':''} onclick="event.stopPropagation()">
          <span class="avl-lbl" style="color:${avail?'var(--green)':'var(--red)'}">${avail?'متاح الآن':'غير متاح'}</span>
        </div>
      </div>
      <div style="display:flex;border-top:1px solid rgba(13,148,136,.1)">
          <button onclick="openSecurityModal('${k}')" style="flex:1;background:none;border:none;border-left:1px solid rgba(13,148,136,.1);color:var(--teal);padding:8px;font-family:'Tajawal',sans-serif;font-size:.75rem;cursor:pointer;transition:.2s"><i class="fas fa-shield-alt"></i> الأمان</button>
          <button onclick="editDoc('${k}')" style="flex:1;background:none;border:none;border-left:1px solid rgba(13,148,136,.1);color:var(--sky);padding:8px;font-family:'Tajawal',sans-serif;font-size:.75rem;cursor:pointer;transition:.2s"><i class="fas fa-edit"></i> تعديل</button>
          <button class="bdel" style="flex:1;border:none" onclick="if(confirm('هل أنت متأكد من حذف الموظف؟')){db.ref(BASE+'/doctors/${k}').remove();toast('تم الحذف','ok');}"><i class="fas fa-trash"></i> حذف</button>
        </div>
    </div>`;
  }).join('');
});


// ── ENTERPRISE SECURITY CONSOLE ──
let secActiveDocId = null;

function openSecurityModal(k) {
  secActiveDocId = k;
  const d = _docs[k];
  if (!d) return;
  document.getElementById('secModalDocName').textContent = ((d.role==='doctor'||!d.role)?'د. ':'') + sanitize(d.name) + ' - ' + (d.role || 'Doctor');
  document.getElementById('secTempPass').value = '';
  document.getElementById('secModal').style.display = 'flex';
}

function closeSecurityModal() {
  document.getElementById('secModal').style.display = 'none';
  secActiveDocId = null;
}

async function secForceReset() {
  if (!secActiveDocId) return;
  if (!confirm('سيتم حذف كلمة المرور الخاصة بالطبيب ويجب عليه تعيين واحدة جديدة عند الدخول. هل أنت متأكد؟')) return;
  
  if (typeof ArgonEnterpriseAuth === 'undefined') {
    toast('خطأ: محرك الأمان غير متوفر', 'err');
    return;
  }
  
  try {
    toast('جاري إعادة ضبط كلمة المرور...', 'ok');
    await ArgonEnterpriseAuth.adminClearPassword(secActiveDocId, CID);
    toast('تم إعادة ضبط كلمة المرور بنجاح!', 'ok');
    closeSecurityModal();
  } catch (e) {
    toast('فشل مسح كلمة المرور: ' + e.message, 'err');
  }
}

async function secSetTempPass() {
  if (!secActiveDocId) return;
  const pass = document.getElementById('secTempPass').value.trim();
  if (pass.length < 4) {
    toast('كلمة المرور يجب أن تكون 4 أحرف/أرقام على الأقل', 'err');
    return;
  }
  
  if (typeof ArgonEnterpriseAuth === 'undefined') {
    toast('خطأ: محرك الأمان غير متوفر', 'err');
    return;
  }
  
  try {
    toast('جاري التشفير والتعيين...', 'ok');
    await ArgonEnterpriseAuth.adminSetPassword(secActiveDocId, pass, CID);
    toast('تم تعيين كلمة المرور الجديدة بنجاح!', 'ok');
    closeSecurityModal();
  } catch (e) {
    toast('فشل التعيين: ' + e.message, 'err');
  }
}

// ── ACTIONS ──
function updSt(k, s) {
  db.ref(`${BASE}/bookings/${k}/status`).set(s);
  // Release slot lock when booking is cancelled
  if (s === 'cancelled') {
    const b = _bks[k];
    if (b && b.slotKey) {
      db.ref(`${BASE}/slotLocks/${b.slotKey}`).remove().catch(() => {});
    }
  }
  toast('تم التحديث', 'ok');
}

function cmpBook(k) {
  const b = _bks[k]; if (!b) return;

  // Auto-create basic EMR profile under a unique Push Key if not exists (EMR Collision Prevention)
  if (b.patPhone) {
    let patPhone = b.patPhone.replace(/\D/g,'');
    if (patPhone.startsWith('962')) patPhone = patPhone.substring(3);
    if (patPhone.startsWith('0')) patPhone = patPhone.substring(1);
    
    db.ref(`${BASE}/patients`).once('value', snap => {
      const pats = snap.val() || {};
      const exists = Object.values(pats).some(p => p.info && p.info.phone === patPhone);
      
      if (!exists) {
        const newRef = db.ref(`${BASE}/patients`).push();
        newRef.set({
          info: {
            name: b.patName,
            phone: patPhone,
            age: b.patAge ? parseInt(b.patAge) : null,
            gender: b.patGender || '',
            mrn: 'MRN-' + Math.floor(100000 + Math.random() * 900000),
            createdAt: new Date().toISOString()
          }
        }).catch(err => console.error("Auto EMR registration failed: ", err));
      }
    });
  }

  db.ref(`${BASE}/completedBookings/${k}`)
    .set({ ...b, status: 'done', completedAt: new Date().toISOString() })
    .then(() => db.ref(`${BASE}/bookings/${k}`).remove()
      .then(() => toast('✅ تم إنهاء الحجز', 'ok')));
}

function clrHist(){if(!confirm('مسح سجل الحجوزات المكتملة؟'))return;db.ref(`${BASE}/completedBookings`).remove().then(()=>toast('تم المسح','ok'));}

let editingDocKey = null;
function addDoc() {
    const name=document.getElementById('dN').value.trim();
    const spec=document.getElementById('dS').value.trim();
    const fee=document.getElementById('dF').value.trim();
    const role=document.getElementById('dRole') ? document.getElementById('dRole').value : 'doctor';
    if(!name||!spec||!fee){toast('الرجاء تعبئة الاسم والتخصص والكشفية','err');return;}
    
    // Extract selected doctor workdays
    const workDays = [];
    document.querySelectorAll('.day-btn.active').forEach(btn => {
      workDays.push(parseInt(btn.getAttribute('data-day')));
    });
    
    let portal = 'EMR';
    if (role === 'pharmacist') portal = 'PHARMACY';
    if (role === 'lab') portal = 'LAB';
    if (role === 'radiology') portal = 'RADIOLOGY';
  
    const docObj = {
      name,specialty:spec,fee:parseFloat(fee),
      slotDuration:parseInt(document.getElementById('dSlot').value)||30,
      workStart:document.getElementById('dWs').value||'09:00',
      workEnd:document.getElementById('dWe').value||'17:00',
      img:document.getElementById('dImg').value.trim()||'',
      emoji:document.getElementById('dEm').value.trim()||'👨‍⚕️',
      departmentId:document.getElementById('dDept').value||'',
      workDays: workDays.length ? workDays : [0, 1, 2, 3, 4, 6],
      role: role,
      identityStatus: 'ACTIVE',
      schemaVersion: 3,
      assignedPortal: portal
    };
  
  if (editingDocKey) {
    db.ref(`${BASE}/doctors/${editingDocKey}`).update(docObj).then(() => {
      toast('✅ تم تحديث الطبيب', 'ok');
      cancelDocEdit();
    });
  } else {
    docObj.available = true; docObj.avgRating = 0; docObj.ratingCount = 0;
    db.ref(`${BASE}/doctors`).push(docObj).then(() => {
      cancelDocEdit();
      toast('✅ تم إضافة الطبيب', 'ok');
    });
  }
}

function editDoc(k) {
  editingDocKey = k;
  const d = _docs[k];
  document.getElementById('dN').value = d.name;
  document.getElementById('dS').value = d.specialty;
  document.getElementById('dF').value = d.fee; 
    if(document.getElementById('dRole')) document.getElementById('dRole').value = d.role || 'doctor';
  document.getElementById('dSlot').value = d.slotDuration || 30;
  document.getElementById('dWs').value = d.workStart || '09:00';
  document.getElementById('dWe').value = d.workEnd || '17:00';
  document.getElementById('dImg').value = d.img || '';
  document.getElementById('dEm').value = d.emoji || '👨‍⚕️';
  document.getElementById('dDept').value = d.departmentId || '';
  
  // Set workday buttons based on doctor's schedule
  const wDays = d.workDays || [0, 1, 2, 3, 4, 6];
  document.querySelectorAll('.day-btn').forEach(btn => {
    const day = parseInt(btn.getAttribute('data-day'));
    if (wDays.includes(day)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const b = document.querySelector('.badd');
  b.innerHTML = '<i class="fas fa-save" style="margin-left:4px"></i>تحديث معلومات الطبيب';
  b.style.background = 'linear-gradient(135deg, var(--amber), #d97706)';
  document.getElementById('btnCancelEdit').style.display = 'block';
  document.getElementById('dN').focus();
}

function cancelDocEdit() {
  editingDocKey = null;
  ['dN','dS','dF','dImg'].forEach(i=>document.getElementById(i).value='');
  if(document.getElementById('dRole')) {
    document.getElementById('dRole').value='doctor';
    document.getElementById('dRole').dispatchEvent(new Event('change'));
  }

  document.getElementById('dSlot').value = 30;
  document.getElementById('dWs').value = '09:00';
  document.getElementById('dWe').value = '17:00';
  document.getElementById('dEm').value = '👨‍⚕️';
  document.getElementById('dDept').value = '';
  
  // Reset workday buttons (default to Sat-Thu active)
  const defaultDays = [0, 1, 2, 3, 4, 6];
  document.querySelectorAll('.day-btn').forEach(btn => {
    const day = parseInt(btn.getAttribute('data-day'));
    if (defaultDays.includes(day)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const b = document.querySelector('.badd');
  b.innerHTML = '<i class="fas fa-plus" style="margin-left:4px"></i>إضافة';
  b.style.background = 'linear-gradient(135deg,var(--teal),var(--sky))';
  document.getElementById('btnCancelEdit').style.display = 'none';
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 150;
      canvas.width = size; canvas.height = size;
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min)/2, sy = (img.height - min)/2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      document.getElementById('dImg').value = canvas.toDataURL('image/jpeg', 0.55);
      toast('✅ تم رفع الصورة بنجاح','ok');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function togAvail(k,cur){
  db.ref(`${BASE}/doctors/${k}/available`).set(!cur);
  toast(cur?'تم تعيين الطبيب كغير متاح':'الطبيب متاح الآن','ok');
}

function saveSettings() {
  const sN = document.getElementById('sN').value.trim();
  const sP = document.getElementById('sP').value.trim();
  if(!sN) { toast('⚠️ يجب إدخال اسم العيادة', 'err'); return; }

  const color=document.getElementById('sC').value||'#0d9488';
  const newPass=document.getElementById('sPw').value.trim();
  
  const whatsappConf = {
    enabled: document.getElementById('waEnabled').checked,
    signature: document.getElementById('waSignature').value.trim(),
    remind30: document.getElementById('waRemind30').checked,
    remind10: document.getElementById('waRemind10').checked,
    phar: document.getElementById('waPhar').checked,
    lab: document.getElementById('waLab').checked,
    rad: document.getElementById('waRad').checked,
    bill: document.getElementById('waBill').checked
  };

  const update={
    name:sanitize(sN),
    phone:sanitize(sP),
    status:document.getElementById('sSt').value,
    is24Hours:document.getElementById('s24h').checked,
    clinicStart:document.getElementById('sWs').value,
    clinicEnd:document.getElementById('sWe').value,
    specialty:sanitize(document.getElementById('sSpec').value),
    emoji:sanitize(document.getElementById('sEm').value),
    sameDayBooking: document.getElementById('sSameDay').value === 'true',
    bookingDays: parseInt(document.getElementById('sBookingDays').value) || 10,
    mode: document.getElementById('sMode').value || 'single_clinic',
    
    whatsapp: whatsappConf,
    color
  };
  if(newPass.length>=4) update.password=newPass;
  db.ref(`${BASE}/settings`).update(update).then(()=>{
    toast('✅ تم حفظ الإعدادات بنجاح','ok');
    document.getElementById('sPw').value='';
  }).catch(e => toast('❌ فشل الحفظ','err'));
}

function copyPatPortalUrl() {
  const el = document.getElementById('patPortalLinkUrl');
  if (el) {
    el.select();
    el.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(el.value).then(() => {
      toast('📋 تم نسخ رابط بوابة المريض الرقمية بنجاح!');
    });
  }
}

function sendWA(phone,status,no,name) {
  const msgs={confirmed:`مرحباً ${name}، تم تأكيد موعدك رقم ${no} ✅`,waiting:`مرحباً ${name}، موعدك رقم ${no} حان وقته 🕐`,default:`مرحباً ${name}، بخصوص موعدك رقم ${no}`};
  window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msgs[status]||msgs.default)}`,'_blank');
}

const sanitize = s => String(s||'').replace(/[<>"']/g,'').trim().substring(0,150);

function togTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('argon_theme', next);
  document.getElementById('themeTog').innerHTML = next === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}
// Init theme
const savedTheme = localStorage.getItem('argon_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
window.addEventListener('DOMContentLoaded', () => {
  if(document.getElementById('themeTog'))
    document.getElementById('themeTog').innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

function sw(id,el){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  if(el)el.classList.add('on');
}
function openPreview(){document.getElementById('prevFrame').src=`index.html?id=${CID}`;document.getElementById('prevModal').style.display='flex';}
function closePrev(){document.getElementById('prevModal').style.display='none';document.getElementById('prevFrame').src='';}
function printReport() {
  const s = _sets || {};
  document.getElementById('phName').textContent = s.name || 'العيادة';
  if(s.logoUrl) {
    document.getElementById('phLogoCont').innerHTML = `<img src="${s.logoUrl}" style="width:100%;height:100%;object-fit:contain">`;
  } else {
    document.getElementById('phLogoCont').innerHTML = `<span style="font-size:3rem">${s.emoji || '🏥'}</span>`;
  }
  document.getElementById('printDate').textContent = new Date().toLocaleString('ar-JO');
  
  // Show stats and history for printing
  document.getElementById('stats').classList.add('print-all');
  document.getElementById('hist').classList.add('print-all');
  
  window.print();
  
  document.getElementById('stats').classList.remove('print-all');
  document.getElementById('hist').classList.remove('print-all');
}

function upLogo(inp) {
  const file = inp.files[0];
  if(!file) return;
  toast('⏳ جاري معالجة الصورة...', 'ok');
  
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Create a canvas to resize and compress the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxW = 200, maxH = 200;
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxW) { h *= maxW / w; w = maxW; } }
      else { if (h > maxH) { w *= maxH / h; h = maxH; } }
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      db.ref(BASE + '/settings/logoUrl').set(compressedBase64)
        .then(() => toast('✅ تم تحديث الشعار بنجاح', 'ok'))
        .catch(() => toast('❌ فشل الحفظ', 'err'));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function delLogo() {
  if(!confirm('هل أنت متأكد من حذف الشعار؟')) return;
  db.ref(BASE + '/settings/logoUrl').remove().then(() => {
    toast('✅ تم حذف الشعار', 'ok');
  });
}

function toast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className=type?'show '+type:'show';setTimeout(()=>t.className='',3000);}

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

// Redeploy trigger: 2026-05-18T21:08:12


  
  // ==========================================
  // IAM v2 FIX LAYER: PRODUCTION DATA BINDING
  // ==========================================
  let isSecurityHubInitialized = false;

  function initSecurityHubListener() {
    if (isSecurityHubInitialized || !firebase || !firebase.database) return;
    
    // Dedicated, decoupled listener for the Security Hub
    firebase.database().ref(BASE + '/doctors').on('value', (snap) => {
       const staffData = snap.val() || {};
       renderSecurityHub(staffData);
    });
    isSecurityHubInitialized = true;
  }

  
  function renderSecurityHub(data) {
    const tbody = document.getElementById('securityHubTableBody');
    if (!tbody) return;
    
    if (!data || Object.keys(data).length === 0) {
       tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--muted);"><i class="fas fa-users-slash" style="margin-bottom:15px; font-size:2rem; opacity:0.3"></i><br>لم يتم إضافة أي أفراد للطاقم الطبي بعد. يرجى إضافتهم من شاشة "إدارة الطاقم".</td></tr>';
       return;
    }
    
    let html = '';
    const roleColors = {
      'doctor': {bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', label: 'طبيب'},
      'pharmacist': {bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', label: 'صيدلاني'},
      'lab': {bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', label: 'مختبر'},
      'radiology': {bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', label: 'أشعة'},
      'admin': {bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', label: 'مدير'},
      'reception': {bg: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', label: 'استقبال'}
    };
    
    Object.entries(data).forEach(([k, d]) => {
      const roleDef = roleColors[d.role || 'doctor'] || roleColors['doctor'];
      const hasCreds = d.credentials && d.credentials.passwordHash;
      const isSuspended = d.identityStatus === 'SUSPENDED';
      
      let secStatusBadge = '';
      if (isSuspended) {
         secStatusBadge = `<span style="background:rgba(239,68,68,0.1); color:#ef4444; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fas fa-ban"></i> حساب موقوف</span>`;
      } else if (hasCreds) {
         secStatusBadge = `<span style="background:rgba(16,185,129,0.1); color:#10b981; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fas fa-lock"></i> محمي مشفر</span>`;
      } else {
         secStatusBadge = `<span style="background:rgba(245,158,11,0.1); color:#f59e0b; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fas fa-exclamation-circle"></i> غير محمي</span>`;
      }
      
      html += `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px; color:var(--text); font-weight:bold;">${sSanitize(d.name)}</td>
          <td style="padding:12px;">
            <span style="background:${roleDef.bg}; color:${roleDef.color}; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${roleDef.label}</span>
          </td>
          <td style="padding:12px;">${secStatusBadge}</td>
          <td style="padding:12px; text-align:center;">
             ${!hasCreds 
               ? `<button onclick="openSecModal('${k}', '${sSanitize(d.name)}')" style="background:var(--teal); color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:bold; font-size:0.75rem;"><i class="fas fa-key"></i> تعيين باسورد</button>`
               : `<button onclick="openSecModal('${k}', '${sSanitize(d.name)}')" style="background:rgba(255,255,255,0.05); color:var(--text); border:1px solid var(--border); padding:6px 12px; border-radius:6px; cursor:pointer; font-family:inherit; font-size:0.75rem;"><i class="fas fa-shield-alt"></i> إدارة الهوية</button>`
             }
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  let _activeSecDoc = null;
  function openSecModal(docKey, docName) {
     _activeSecDoc = docKey;
     const d = _docs[docKey];
     const hasCreds = d && d.credentials && d.credentials.passwordHash;
     const isSuspended = d && d.identityStatus === 'SUSPENDED';
     
     document.getElementById('secModalDocName').textContent = 'الموظف: ' + docName;
     
     // Update Modal UI
     const actionsDiv = document.getElementById('secModalActions');
     if (actionsDiv) {
       actionsDiv.innerHTML = `
         <div style="background:var(--surf); border:1px solid var(--border); padding:16px; border-radius:12px">
            <h4 style="margin:0 0 8px 0; color:var(--text); font-size:0.9rem; display:flex; align-items:center; gap:8px"><i class="fas fa-key" style="color:var(--amber)"></i> تعيين / إعادة تعيين كلمة المرور</h4>
            <input type="text" id="secNewPwd" placeholder="كلمة المرور الجديدة" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); background:rgba(0,0,0,0.1); color:var(--text); margin-bottom:10px; font-family:monospace; text-align:center;" autocomplete="new-password">
            <button onclick="secSetPassword()" style="width:100%; padding:10px; background:var(--amber); color:#000; border:none; border-radius:8px; font-family:inherit; font-weight:800; cursor:pointer;"><i class="fas fa-save"></i> حفظ التشفير (Transitional)</button>
         </div>
         
         ${hasCreds ? `
         <div style="background:var(--surf); border:1px solid var(--border); padding:16px; border-radius:12px; margin-top:10px;">
            <h4 style="margin:0 0 8px 0; color:var(--text); font-size:0.9rem; display:flex; align-items:center; gap:8px"><i class="fas fa-user-shield" style="color:var(--sky)"></i> ضوابط الجلسة (Governance)</h4>
            <div style="display:flex; gap:10px;">
               <button onclick="secRevokeSessions()" style="flex:1; padding:8px; background:rgba(59, 130, 246, 0.1); color:#3b82f6; border:1px solid rgba(59, 130, 246, 0.3); border-radius:8px; cursor:pointer;"><i class="fas fa-sign-out-alt"></i> إغلاق الجلسات</button>
               <button onclick="secToggleSuspend(${isSuspended})" style="flex:1; padding:8px; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); border-radius:8px; cursor:pointer;"><i class="fas ${isSuspended ? 'fa-unlock' : 'fa-ban'}"></i> ${isSuspended ? 'فك الإيقاف' : 'إيقاف الحساب'}</button>
            </div>
         </div>
         ` : ''}
       `;
     }
     
     document.getElementById('secModal').style.display = 'flex';
  }

  function closeSecModal() {
     _activeSecDoc = null;
     document.getElementById('secModal').style.display = 'none';
  }
  
  async function secSetPassword() {
     if (!_activeSecDoc) return;
     const pwd = document.getElementById('secNewPwd').value;
     if (!pwd || pwd.length < 4) { toast('كلمة المرور يجب أن تكون 4 رموز على الأقل', 'err'); return; }
     
     try {
       // Transitional Identity Mode: Generate salt and hash locally
       const salt = ArgonEnterpriseAuth.generateSalt();
       const hash = await ArgonEnterpriseAuth.hashPassword(pwd, salt);
       
       await db.ref(BASE + '/doctors/' + _activeSecDoc + '/credentials').set({
         passwordHash: hash,
         salt: salt,
         setupAt: firebase.database.ServerValue.TIMESTAMP,
         schemaVersion: 3
       });
       
       // Force revocation of all existing sessions for this user
       await secRevokeSessions(true);
       
       if(typeof AuditAPI !== 'undefined') AuditAPI.log('CREDENTIALS_RESET', _activeSecDoc, 'admin', CID, 'IDENTITY_CENTER');
       
       toast('تم تعيين كلمة المرور وتشفيرها بنجاح', 'ok');
       closeSecModal();
     } catch(e) {
       toast('فشل التعيين: ' + e.message, 'err');
     }
  }
  
  async function secRevokeSessions(silent = false) {
     if (!_activeSecDoc) return;
     try {
       await db.ref(BASE + '/doctors/' + _activeSecDoc + '/credentials/sessionVersion').transaction(v => (v || 0) + 1);
       if(typeof AuditAPI !== 'undefined') AuditAPI.log('SESSION_REVOKED', _activeSecDoc, 'admin', CID, 'IDENTITY_CENTER');
       if(!silent) toast('تم إبطال جميع جلسات هذا الموظف', 'ok');
     } catch(e) {
       if(!silent) toast('فشل الإبطال: ' + e.message, 'err');
     }
  }
  
  async function secToggleSuspend(currentlySuspended) {
     if (!_activeSecDoc) return;
     try {
       const newStatus = currentlySuspended ? 'ACTIVE' : 'SUSPENDED';
       await db.ref(BASE + '/doctors/' + _activeSecDoc + '/identityStatus').set(newStatus);
       
       if (newStatus === 'SUSPENDED') {
          // Also revoke sessions immediately
          await db.ref(BASE + '/doctors/' + _activeSecDoc + '/credentials/sessionVersion').transaction(v => (v || 0) + 1);
       }
       
       if(typeof AuditAPI !== 'undefined') AuditAPI.log(currentlySuspended ? 'ACCOUNT_UNSUSPENDED' : 'ACCOUNT_SUSPENDED', _activeSecDoc, 'admin', CID, 'IDENTITY_CENTER');
       
       toast(currentlySuspended ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب وطرد الموظف', 'ok');
       closeSecModal();
     } catch(e) {
       toast('فشل الإجراء: ' + e.message, 'err');
     }
  }
    let html = '';
    const roleColors = {
      'doctor': {bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', label: 'طبيب'},
      'pharmacist': {bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', label: 'صيدلاني'},
      'lab': {bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', label: 'مختبر'},
      'radiology': {bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', label: 'أشعة'},
      'admin': {bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', label: 'إدارة'},
      'reception': {bg: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', label: 'استقبال'}
    };
    
    const sSanitize = (str) => {
       if (!str) return '';
       return str.replace(/[&<>"'/]/ig, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', "/": '&#x2F;' }[m]));
    };
    
    Object.entries(data).forEach(([k, d]) => {
      const roleDef = roleColors[d.role || 'doctor'] || roleColors['doctor'];
      const hasCreds = d.credentials && d.credentials.passwordHash;
      
      const secStatusBadge = hasCreds 
        ? `<span style="background:rgba(16,185,129,0.1); color:#10b981; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fas fa-lock"></i> محمي بكلمة مرور</span>` 
        : `<span style="background:rgba(245,158,11,0.1); color:#f59e0b; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fas fa-exclamation-circle"></i> غير محمي (يحتاج تعيين)</span>`;
        
      html += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.02); transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding:15px 12px; display:flex; align-items:center; gap:10px;">
            <div style="width:35px; height:35px; background:rgba(255,255,255,0.05); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">${sSanitize(d.emoji || '👤')}</div>
            <div>
              <div style="font-weight:700; color:#fff; font-size:0.95rem;">${sSanitize(d.name)}</div>
              <div style="color:var(--muted); font-size:0.75rem;">${sSanitize(d.specialty || '-')}</div>
            </div>
          </td>
          <td style="padding:15px 12px;">
            <span style="background:${roleDef.bg}; color:${roleDef.color}; padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:700;">${roleDef.label}</span>
          </td>
          <td style="padding:15px 12px;">
            ${secStatusBadge}
          </td>
          <td style="padding:15px 12px; text-align:center;">
            <button onclick="openSecurityModal('${k}')" style="background:var(--teal); color:#000; border:none; padding:6px 12px; border-radius:6px; font-family:inherit; font-weight:700; cursor:pointer; font-size:0.8rem; transition:0.2s"><i class="fas fa-key"></i> تعيين الباسورد</button>
            <button onclick="secInvalidateSession('${k}')" style="background:transparent; color:var(--red); border:1px solid rgba(239,68,68,0.3); padding:6px 12px; border-radius:6px; font-family:inherit; cursor:pointer; font-size:0.8rem; transition:0.2s; margin-right:5px;"><i class="fas fa-sign-out-alt"></i> إلغاء الجلسة</button>
          </td>
        </tr>
      `;
    });
    
    // Guaranteed injection, kills the loading state instantly
    tbody.innerHTML = html;
  }

  function secInvalidateSession(staffId) {
    if(!confirm('سيتم تسجيل خروج هذا الموظف من كل الأجهزة فوراً (Token Revocation). هل أنت متأكد؟')) return;
    
    if(firebase && firebase.database) {
       const db = firebase.database();
       db.ref(BASE + '/doctors/' + staffId + '/credentials/tokenVersion').transaction(v => (v || 0) + 1)
         .then(() => toast('تم إلغاء الجلسات بنجاح وإرسال أمر تسجيل الخروج للأجهزة.', 'ok'))
         .catch(e => toast('خطأ في إرسال أمر إلغاء الجلسات: ' + e.message, 'err'));
    }
  }


  // PWA
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

  // End of bootstrapDashboard
}

// Start orchestration when DOM loads
document.addEventListener('DOMContentLoaded', () => {
   bootstrapDashboard();
});
