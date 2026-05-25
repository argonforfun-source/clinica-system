// 🧪 ARGON — Smart Laboratory App
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

// State
let CID = new URLSearchParams(window.location.search).get('id') || '';
let BASE = 'clinics/' + CID;
let _sets = null;
let _orders = {};
let activeOrderId = null;
let currentLabFilter = 'waiting';
let uploadedAttachment = null; // Stores Base64 PDF / image
let isSubmitting = false;

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
      document.getElementById('tlogo').textContent = _sets.emoji ? `ARGON ${_sets.emoji}` : 'ARGON LABORATORY';

      if (ArgonSession.isValid('lab') || ArgonSession.isValid('admin')) {
        document.getElementById('labLogin').style.display = 'none';
        initLab();
      }
    }
  });
});

// Role access control login
function doLogin() {
  const pass = document.getElementById('lPass').value;
  if (!_sets) return;
  const correctPass = (_sets.passcodes && _sets.passcodes.lab) || _sets.password || '1122';
  if (pass === correctPass) {
    ArgonSession.start('lab', 'فني المختبر');
    document.getElementById('labLogin').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('labLogin').style.display = 'none';
      initLab();
    }, 300);
  } else {
    const err = document.getElementById('lErr');
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
  }
}

// Lab Initializer
function initLab() {
  toast('مرحباً بك في المختبر الطبي المركزي 🧪', 'ok');

  // Enterprise Incremental Lab Orders (child events only)
  let _labRenderTimer = null;
  const debounceLabRender = () => { clearTimeout(_labRenderTimer); _labRenderTimer = setTimeout(renderLabOrders, 80); };
  db.ref(BASE + '/lab_orders').on('child_added',   snap => { _orders[snap.key] = snap.val(); debounceLabRender(); });
  db.ref(BASE + '/lab_orders').on('child_changed', snap => { _orders[snap.key] = snap.val(); debounceLabRender(); });
  db.ref(BASE + '/lab_orders').on('child_removed', snap => { delete _orders[snap.key];      debounceLabRender(); });
}

// Switch Side menu tabs
function sw(id, el) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  if (el) el.classList.add('on');
}

// Filter Tab
function filterLab(status) {
  currentLabFilter = status;
  document.getElementById('btnFilterWaiting').style.borderColor = status === 'waiting' ? 'var(--amber)' : 'var(--border)';
  document.getElementById('btnFilterWaiting').style.color = status === 'waiting' ? 'var(--amber)' : 'var(--text)';
  document.getElementById('btnFilterCompleted').style.borderColor = status === 'completed' ? 'var(--green)' : 'var(--border)';
  document.getElementById('btnFilterCompleted').style.color = status === 'completed' ? 'var(--green)' : 'var(--text)';
  renderLabOrders();
}

// Render Lab Orders cards list
function renderLabOrders() {
  const grid = document.getElementById('labGrid');
  const items = Object.entries(_orders).filter(([k, v]) => v.status === currentLabFilter);

  if (!items.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)">
        <i class="fas fa-microscope" style="font-size:2.5rem;margin-bottom:10px;opacity:.2"></i>
        <p>لا توجد طلبات فحص في هذه القائمة حالياً</p>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(([k, o]) => {
    const testNames = (o.requestedTests || []).map(t => t.name).join(' ، ');
    const dateStr = o.createdAt ? o.createdAt.substring(0, 16).replace('T', ' ') : 'فوري';
    const badgeClass = o.status === 'completed' ? 'completed' : 'waiting';
    const badgeText = o.status === 'completed' ? 'تحاليل مكتملة ✅' : 'بانتظار إجراء التحليل ⏳';

    return `
      <div class="item-card glass-panel" onclick="openLabDetails('${k}')">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div class="card-title">${sanitize(o.patientName)}</div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--muted)">
          <div><b>الطبيب المعالج:</b> د. ${sanitize(o.docName)}</div>
          <div><b>التحاليل المطلوبة:</b> ${sanitize(testNames)}</div>
        </div>
        <div style="font-size:0.75rem;color:var(--muted);text-align:left;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
          <i class="far fa-clock"></i> ${dateStr}
        </div>
      </div>
    `;
  }).join('');
}

// Open Selected Lab Order modal
function openLabDetails(key) {
  activeOrderId = key;
  const o = _orders[key];
  if (!o) return;

  document.getElementById('mlPatName').textContent = o.patientName;
  document.getElementById('mlDocName').textContent = o.docName;
  document.getElementById('mlRequestDate').textContent = o.createdAt ? o.createdAt.substring(0, 10) : '—';
  document.getElementById('mlNotes').value = o.notes || '';
  
  uploadedAttachment = o.attachment || null;
  document.getElementById('mlFileLbl').textContent = uploadedAttachment ? '✅ تم رفع ملف تقرير التحليل بنجاح' : 'اضغط لرفع ملف التقرير المخبري المعتمد';

  const tbody = document.getElementById('mlTestsList');
  tbody.innerHTML = (o.requestedTests || []).map((t, idx) => {
    const normalRange = getNormalReferenceRange(t.name);
    const unitHint = getUnitHint(t.name);
    
    const resultInput = `<input type="text" id="mlResult_${idx}" class="fi" value="${t.result || ''}" placeholder="أدخل النتيجة" style="height:32px;border-color:var(--teal)">`;
    const unitInput = `<input type="text" id="mlUnit_${idx}" class="fi" value="${t.unit || unitHint}" placeholder="الوحدة" style="height:32px" value="${unitHint}">`;

    return `
      <tr>
        <td><b>${sanitize(t.name)}</b></td>
        <td>${o.status === 'completed' ? `<b>${t.result || '—'}</b>` : resultInput}</td>
        <td>${o.status === 'completed' ? `<span>${t.unit || '—'}</span>` : unitInput}</td>
        <td style="font-size:0.8rem;color:var(--muted)">${normalRange}</td>
      </tr>
    `;
  }).join('');

  const actions = document.getElementById('labActions');
  if (o.status === 'completed') {
    actions.innerHTML = `
      ${o.attachment ? `<button class="btn-secondary" onclick="openReportPdf()" style="margin-left:auto"><i class="fas fa-file-pdf"></i> عرض التقرير المرفق</button>` : ''}
      <span style="color:var(--green);font-weight:bold;margin-right:auto"><i class="fas fa-check-double"></i> نتائج هذا الفحص مدخلة ومكتملة</span>
    `;
  } else {
    actions.innerHTML = `
      <button class="btn-primary" onclick="saveLabResults()" style="flex:1;justify-content:center"><i class="fas fa-save"></i> حفظ وتأكيد النتائج للـ EMR</button>
      <button class="btn-secondary" onclick="closeModal('labModal')">إلغاء</button>
    `;
  }

  document.getElementById('labModal').style.display = 'flex';
}

// Get normal ranges helper
function getNormalReferenceRange(name) {
  const n = name.toUpperCase().trim();
  if (n.includes('CBC') || n.includes('HB')) return 'الرجال: 13.5 - 17.5 g/dL | النساء: 12.0 - 15.5';
  if (n.includes('HBA1C')) return 'طبيعي: < 5.7% | ما قبل السكري: 5.7 - 6.4%';
  if (n.includes('LIPID') || n.includes('CHOL')) return 'الكوليسترول الكلي: < 200 mg/dL';
  if (n.includes('KIDNEY') || n.includes('CREAT')) return 'الكرياتينين: 0.6 - 1.2 mg/dL';
  return 'حسب توجيهات طبيب المختبر';
}

// Get unit hint helper
function getUnitHint(name) {
  const n = name.toUpperCase().trim();
  if (n.includes('CBC') || n.includes('HB')) return 'g/dL';
  if (n.includes('HBA1C')) return '%';
  if (n.includes('KIDNEY') || n.includes('LIPID') || n.includes('CREAT')) return 'mg/dL';
  return '—';
}

// Attachment Reader
function handleAttachment(e) {
  const file = e.target.files[0];
  if (!file) return;

  toast('⏳ جاري رفع وقراءة التقرير...', 'ok');
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedAttachment = ev.target.result;
    document.getElementById('mlFileLbl').textContent = '✅ تم قراءة ورفع الملف المرفق بنجاح';
    toast('✅ تم رفع التقرير المكتوب بنجاح', 'ok');
  };
  reader.readAsDataURL(file);
}

// Save Lab Results
function saveLabResults() {
  if (isSubmitting) return;
  const o = _orders[activeOrderId];
  if (!o) return;
  isSubmitting = true;

  const notes = document.getElementById('mlNotes').value.trim();
  const completedTests = [];
  let isAnyFieldEmpty = false;

  (o.requestedTests || []).forEach((t, idx) => {
    const resEl = document.getElementById(`mlResult_${idx}`);
    const unitEl = document.getElementById(`mlUnit_${idx}`);
    if (resEl && unitEl) {
      const resVal = resEl.value.trim();
      const unitVal = unitEl.value.trim();
      if (!resVal) isAnyFieldEmpty = true;
      
      completedTests.push({
        name: t.name,
        result: resVal,
        unit: unitVal,
        status: 'completed'
      });
    }
  });

  if (isAnyFieldEmpty) {
    toast('⚠️ يرجى إدخال النتائج لجميع الفحوصات المطلوبة أولاً', 'err');
    return;
  }

  const updates = {};
  
  // 1. Update lab order in DB
  updates[`lab_orders/${activeOrderId}/status`] = 'completed';
  updates[`lab_orders/${activeOrderId}/requestedTests`] = completedTests;
  updates[`lab_orders/${activeOrderId}/notes`] = notes;
  updates[`lab_orders/${activeOrderId}/attachment`] = uploadedAttachment;

  // 2. Log Laboratory Event inside patient EMR timeline
  const visitId = o.visitId;
  if (visitId) {
    const resultsSummary = completedTests.map(t => `• ${t.name}: <b>${t.result}</b> ${t.unit}`).join('<br>');
    const timelineKey = 'lab_' + activeOrderId;
    const timelineObj = {
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
      docKey: 'lab',
      docName: 'المختبر الطبي المركزي',
      diagnosis: 'نتائج فحوصات مخبرية مكتملة 🧪',
      complaint: 'مختبر المركز الموحد',
      notes: `نتائج التحاليل للمريض:<br>${resultsSummary}<br>${notes ? `<b>ملاحظات الفني:</b> ${notes}` : ''}`,
      vitals: { temp: null, bp: null, pulse: null },
      prescriptions: [],
      attachments: uploadedAttachment ? [{ name: 'تقرير فحص مخبري.pdf', type: 'pdf', data: uploadedAttachment }] : []
    };
    updates[`patients/${o.patientId}/visits/${timelineKey}`] = timelineObj;

    // 3. Send Doctor Notification
    db.ref(`${BASE}/notifications`).push({
      title: 'نتائج تحاليل جاهزة 🔬',
      message: `تم إنهاء نتائج تحاليل المريض ${sanitize(o.patientName)} لمراجعتها بالـ EMR`,
      role: 'doctor',
      docKey: o.doctorId,
      createdAt: new Date().toISOString()
    });

    // 4. Auto-Billing Link: add standard lab service charge (10.00 dinars flat rate per test)
    db.ref(`${BASE}/invoices`).orderByChild('visitId').equalTo(visitId).once('value', invSnap => {
      const invoices = invSnap.val() || {};
      const invEntry = Object.entries(invoices)[0];
      if (invEntry) {
        const [invKey, invVal] = invEntry;
        const currentItems = invVal.items || [];
        
        completedTests.forEach(t => {
          currentItems.push({
            name: `تحليل مخبري: ${t.name}`,
            price: 10.00 // Standard flat rate of 10.00 JOD per test
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
    isSubmitting = false;
    if (typeof ArgonCore !== 'undefined') {
      ArgonCore.logAudit('SUBMIT_LAB', `تم رفع وتأكيد نتائج المختبر للمريض: ${o.patientName}`, 'LABORATORY');
    }
    toast('✅ تم تسجيل وتأكيد النتائج وإضافتها لملف المريض', 'ok');
    closeModal('labModal');
  }).catch(() => {
    isSubmitting = false;
    toast('❌ فشل حفظ نتائج التحليل', 'err');
  });
}

// Open attached PDF / Document
function openReportPdf() {
  if (!uploadedAttachment) return;
  const w = window.open();
  w.document.write(`<iframe src="${uploadedAttachment}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
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
