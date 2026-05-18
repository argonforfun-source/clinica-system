// 🩻 ARGON — Smart Radiology App
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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// State
let CID = new URLSearchParams(window.location.search).get('id') || '';
let BASE = 'clinics/' + CID;
let _sets = null;
let _orders = {};
let activeOrderId = null;
let currentRadFilter = 'waiting';
let uploadedImage = null; // Base64 of radiology scan

window.addEventListener('DOMContentLoaded', () => {
  if (!CID) {
    alert("خطأ: معرف العيادة غير موجود! يرجى فتح الصفحة من لوحة التحكم.");
    window.location.href = "super.html";
    return;
  }

  // Load Theme
  const savedTheme = localStorage.getItem('argon_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // Settings Loader
  db.ref(BASE + '/settings').on('value', snap => {
    _sets = snap.val();
    if (_sets) {
      document.getElementById('lClinicName').textContent = _sets.name || 'المجمع الطبي';
      document.getElementById('topName').textContent = _sets.name || 'المجمع الطبي';
      document.getElementById('tlogo').textContent = _sets.emoji ? `ARGON ${_sets.emoji}` : 'ARGON RADIOLOGY';

      if (sessionStorage.getItem('rad_authed_' + CID) === 'true') {
        document.getElementById('radLogin').style.display = 'none';
        initRad();
      }
    }
  });
});

// Role passcode login check
function doLogin() {
  const pass = document.getElementById('lPass').value;
  if (!_sets) return;
  const correctPass = (_sets.passcodes && _sets.passcodes.radiology) || _sets.password || '1122';
  if (pass === correctPass) {
    sessionStorage.setItem('rad_authed_' + CID, 'true');
    document.getElementById('radLogin').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('radLogin').style.display = 'none';
      initRad();
    }, 300);
  } else {
    const err = document.getElementById('lErr');
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
  }
}

// Rad Initializer
function initRad() {
  toast('مرحباً بك في قسم الأشعة الذكي ☢️', 'ok');

  // Live Radiology Orders Listener
  db.ref(BASE + '/radiology_orders').on('value', snap => {
    _orders = snap.val() || {};
    renderRadOrders();
  });
}

// Switch Side Menu items
function sw(id, el) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  if (el) el.classList.add('on');
}

// Filter Tab
function filterRad(status) {
  currentRadFilter = status;
  document.getElementById('btnFilterWaiting').style.borderColor = status === 'waiting' ? 'var(--amber)' : 'var(--border)';
  document.getElementById('btnFilterWaiting').style.color = status === 'waiting' ? 'var(--amber)' : 'var(--text)';
  document.getElementById('btnFilterCompleted').style.borderColor = status === 'completed' ? 'var(--green)' : 'var(--border)';
  document.getElementById('btnFilterCompleted').style.color = status === 'completed' ? 'var(--green)' : 'var(--text)';
  renderRadOrders();
}

// Render Radiology Orders cards list
function renderRadOrders() {
  const grid = document.getElementById('radGrid');
  const items = Object.entries(_orders).filter(([k, v]) => v.status === currentRadFilter);

  if (!items.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)">
        <i class="fas fa-x-ray" style="font-size:2.5rem;margin-bottom:10px;opacity:.2"></i>
        <p>لا توجد طلبات أشعة وتصوير حالياً</p>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(([k, o]) => {
    const scanNames = (o.requestedScans || []).map(s => s.name).join(' ، ');
    const dateStr = o.createdAt ? o.createdAt.substring(0, 16).replace('T', ' ') : 'فوري';
    const badgeClass = o.status === 'completed' ? 'completed' : 'waiting';
    const badgeText = o.status === 'completed' ? 'أشعة مكتملة ✅' : 'بانتظار التصوير ⏳';

    return `
      <div class="item-card glass-panel" onclick="openRadDetails('${k}')">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div class="card-title">${sanitize(o.patientName)}</div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--muted)">
          <div><b>الطبيب المعالج:</b> د. ${sanitize(o.docName)}</div>
          <div><b>الفحوصات المطلوبة:</b> ${sanitize(scanNames)}</div>
        </div>
        <div style="font-size:0.75rem;color:var(--muted);text-align:left;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
          <i class="far fa-clock"></i> ${dateStr}
        </div>
      </div>
    `;
  }).join('');
}

// Open Selected Radiology Order details inside modal
function openRadDetails(key) {
  activeOrderId = key;
  const o = _orders[key];
  if (!o) return;

  document.getElementById('mrPatName').textContent = o.patientName;
  document.getElementById('mrDocName').textContent = o.docName;
  document.getElementById('mrRequestDate').textContent = o.createdAt ? o.createdAt.substring(0, 10) : '—';
  
  document.getElementById('mrReport').value = o.report || '';
  
  uploadedImage = o.image || null;
  const prevDiv = document.getElementById('radImagePrev');
  const prevImg = document.getElementById('prevImg');
  if (uploadedImage) {
    prevImg.src = uploadedImage;
    prevDiv.style.display = 'block';
    document.getElementById('mrFileLbl').textContent = '✅ تم تحميل صورة الأشعة بنجاح';
  } else {
    prevDiv.style.display = 'none';
    document.getElementById('mrFileLbl').textContent = 'اضغط هنا لتحميل صور الأشعة الرقمية';
  }

  const scansList = document.getElementById('mrScansList');
  scansList.innerHTML = (o.requestedScans || []).map(s => `
    <span class="tag blue" style="font-size:0.85rem;background:rgba(14,165,233,0.15);border:1px solid var(--sky);color:var(--sky)">
      ${sanitize(s.name)} ☢️
    </span>
  `).join('');

  const actions = document.getElementById('radActions');
  if (o.status === 'completed') {
    actions.innerHTML = `
      ${o.image ? `<button class="btn-secondary" onclick="viewLightbox()" style="margin-left:auto"><i class="fas fa-expand-arrows-alt"></i> تكبير الصورة (EMR Lightbox)</button>` : ''}
      <span style="color:var(--green);font-weight:bold;margin-right:auto"><i class="fas fa-check-double"></i> تقارير الأشعة مسجلة ومكتملة</span>
    `;
    document.getElementById('mrReport').readOnly = true;
  } else {
    actions.innerHTML = `
      <button class="btn-primary" onclick="saveRadReport()" style="flex:1;justify-content:center"><i class="fas fa-save"></i> حفظ وتأكيد التقرير وصورة الأشعة</button>
      <button class="btn-secondary" onclick="closeModal('radModal')">إلغاء</button>
    `;
    document.getElementById('mrReport').readOnly = false;
  }

  document.getElementById('radModal').style.display = 'flex';
}

// Compress and upload radiology scans Base64
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  toast('⏳ جاري تهيئة وضغط الصورة الرقمية...', 'ok');
  const reader = new FileReader();
  
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Standardize high resolution image size for RTDB optimal transfer
      const maxW = 1000;
      let w = img.width;
      let h = img.height;
      if (w > maxW) {
        h *= maxW / w;
        w = maxW;
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      
      uploadedImage = canvas.toDataURL('image/jpeg', 0.65);
      
      const prevDiv = document.getElementById('radImagePrev');
      const prevImg = document.getElementById('prevImg');
      prevImg.src = uploadedImage;
      prevDiv.style.display = 'block';
      document.getElementById('mrFileLbl').textContent = '✅ تم تحميل صورة الأشعة بنجاح';
      toast('✅ تم ضغط ورفع الصورة للمراجعة بنجاح', 'ok');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// Save Radiology Report
function saveRadReport() {
  const o = _orders[activeOrderId];
  if (!o) return;

  const report = document.getElementById('mrReport').value.trim();
  if (!report) {
    toast('⚠️ الرجاء كتابة التقرير التشخيصي للأشعة أولاً', 'err');
    return;
  }
  if (!uploadedImage) {
    toast('⚠️ الرجاء رفع صورة الأشعة الرقمية المصاحبة للتقرير', 'err');
    return;
  }

  const updates = {};
  
  // 1. Update order in database
  updates[`radiology_orders/${activeOrderId}/status`] = 'completed';
  updates[`radiology_orders/${activeOrderId}/report`] = report;
  updates[`radiology_orders/${activeOrderId}/image`] = uploadedImage;

  // 2. Log Radiology Event inside patient EMR timeline
  const visitId = o.visitId;
  if (visitId) {
    const scansSummary = (o.requestedScans || []).map(s => `• ${s.name}`).join('<br>');
    const timelineKey = db.ref().child('visits').push().key;
    const timelineObj = {
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
      docKey: 'radiology',
      docName: 'قسم الأشعة والسينية',
      diagnosis: 'تقارير وصور الأشعة مكتملة 🩻',
      complaint: 'قسم الأشعة الموحد',
      notes: `تم إنهاء التصوير التشخيصي للفحوصات التالية:<br>${scansSummary}<br><b>التقرير الطبي المعتمَد:</b><br>${report.replace(/\n/g, '<br>')}`,
      vitals: { temp: null, bp: null, pulse: null },
      prescriptions: [],
      attachments: [{ name: 'صورة الأشعة الرقمية.jpg', type: 'image', data: uploadedImage }]
    };
    updates[`patients/${o.patientId}/visits/${timelineKey}`] = timelineObj;

    // 3. Send Doctor Notification
    db.ref(`${BASE}/notifications`).push({
      title: 'نتائج تقارير الأشعة جاهزة 🩻',
      message: `تم إنهاء تصوير الأشعة والتقرير للمريض ${sanitize(o.patientName)}`,
      role: 'doctor',
      docKey: o.doctorId,
      createdAt: new Date().toISOString()
    });

    // 4. Auto-Billing Link: add standard flat rate of 25.00 JOD per radiology scan
    db.ref(`${BASE}/invoices`).orderByChild('visitId').equalTo(visitId).once('value', invSnap => {
      const invoices = invSnap.val() || {};
      const invEntry = Object.entries(invoices)[0];
      if (invEntry) {
        const [invKey, invVal] = invEntry;
        const currentItems = invVal.items || [];
        
        (o.requestedScans || []).forEach(s => {
          currentItems.push({
            name: `تصوير أشعة: ${s.name}`,
            price: 25.00 // Standard flat rate of 25.00 JOD per radiology item
          });
        });

        const newTotal = parseFloat(currentItems.reduce((acc, item) => acc + item.price, 0).toFixed(2));
        
        const invoiceUpdates = {};
        invoiceUpdates[`invoices/${invKey}/items`] = currentItems;
        invoiceUpdates[`invoices/${invKey}/total`] = newTotal;
        db.ref(BASE).update(invoiceUpdates);
      }
    });
  }

  // Apply updates atomically
  db.ref(BASE).update(updates).then(() => {
    toast('✅ تم تسجيل وتأكيد تقرير الأشعة وإضافتها للـ EMR', 'ok');
    closeModal('radModal');
  }).catch(() => toast('❌ فشل إتمام تسجيل صور الأشعة والتقرير', 'err'));
}

// Lightbox full-size viewer
function viewLightbox() {
  if (!uploadedImage) return;
  const w = window.open();
  w.document.write(`<body style="margin:0;background:#030b0a;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${uploadedImage}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.7);"></body>`);
  w.document.close();
}

// Modals management
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Toast Alert
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  t.style.background = type === 'err' ? 'var(--red)' : 'var(--teal)';
  setTimeout(() => t.style.display = 'none', 3000);
}

// Theme management
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

// Sanitization
const sanitize = s => String(s || '').replace(/[<>"']/g, '').trim().substring(0, 150);
