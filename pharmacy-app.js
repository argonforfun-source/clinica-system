// 💊 ARGON — Smart Pharmacy Control App
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
let _inventory = {};
let _prescriptions = {};
let activePrescId = null;
let currentPrescFilter = 'waiting';

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
      document.getElementById('tlogo').textContent = _sets.emoji ? `ARGON ${_sets.emoji}` : 'ARGON PHARMACY';

      if (sessionStorage.getItem('phar_authed_' + CID) === 'true') {
        document.getElementById('pharLogin').style.display = 'none';
        initPharmacy();
      }
    }
  });
});

// Access Control Login
function doLogin() {
  const pass = document.getElementById('lPass').value;
  if (!_sets) return;
  const correctPass = (_sets.passcodes && _sets.passcodes.pharmacist) || _sets.password || '1122';
  if (pass === correctPass) {
    sessionStorage.setItem('phar_authed_' + CID, 'true');
    document.getElementById('pharLogin').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('pharLogin').style.display = 'none';
      initPharmacy();
    }, 300);
  } else {
    const err = document.getElementById('lErr');
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
  }
}

// App Initialization
function initPharmacy() {
  toast('مرحباً بك في الصيدلية الذكية 💊', 'ok');

  // 1. Live Drug Inventory Listener
  db.ref(BASE + '/pharmacy_inventory').on('value', snap => {
    _inventory = snap.val() || {};
    renderInventory();
  });

  // 2. Live Prescriptions Inbox Listener
  db.ref(BASE + '/prescriptions').on('value', snap => {
    _prescriptions = snap.val() || {};
    renderPrescriptions();
  });
}

// Sidebar switcher
function sw(id, el) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  if (el) el.classList.add('on');
}

// Filter Prescription Tab
function filterPresc(status) {
  currentPrescFilter = status;
  document.getElementById('btnFilterWaiting').style.borderColor = status === 'waiting' ? 'var(--amber)' : 'var(--border)';
  document.getElementById('btnFilterWaiting').style.color = status === 'waiting' ? 'var(--amber)' : 'var(--text)';
  document.getElementById('btnFilterCompleted').style.borderColor = status === 'completed' ? 'var(--green)' : 'var(--border)';
  document.getElementById('btnFilterCompleted').style.color = status === 'completed' ? 'var(--green)' : 'var(--text)';
  document.getElementById('btnFilterCancelled').style.borderColor = status === 'cancelled' ? 'var(--red)' : 'var(--border)';
  document.getElementById('btnFilterCancelled').style.color = status === 'cancelled' ? 'var(--red)' : 'var(--text)';
  renderPrescriptions();
}

// Render Prescriptions Inbox List
function renderPrescriptions() {
  const grid = document.getElementById('prescGrid');
  const items = Object.entries(_prescriptions).filter(([k, v]) => (v.status || 'waiting') === currentPrescFilter);
  
  if (!items.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)">
        <i class="fas fa-prescription-bottle" style="font-size:2.5rem;margin-bottom:10px;opacity:.2"></i>
        <p>لا توجد وصفات طبية في هذه القائمة حالياً</p>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(([k, p]) => {
    const medNames = (p.medications || []).map(m => m.name).join(' ، ');
    const dateStr = p.createdAt ? p.createdAt.substring(0, 16).replace('T', ' ') : 'فوري';
    
    let badgeStyle = '';
    let badgeText = '';
    if (p.status === 'completed') {
      badgeStyle = 'background:rgba(16,185,129,0.12);color:var(--green);border:1px solid rgba(16,185,129,0.3)';
      badgeText = 'تم الصرف ✅';
    } else if (p.status === 'cancelled') {
      badgeStyle = 'background:rgba(239,68,68,0.12);color:var(--red);border:1px solid rgba(239,68,68,0.3)';
      badgeText = 'ملغاة لعدم التوفر ❌';
    } else {
      badgeStyle = 'background:rgba(245,158,11,0.12);color:var(--amber);border:1px solid rgba(245,158,11,0.3)';
      badgeText = 'بانتظار الصرف ⏳';
    }
    
    return `
      <div class="item-card glass-panel" onclick="openPrescDetails('${k}')">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div class="card-title">${sanitize(p.patientName)}</div>
          <span class="badge" style="${badgeStyle}">${badgeText}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--muted)">
          <div><b>الطبيب:</b> د. ${sanitize(p.docName)}</div>
          <div><b>الأدوية الموصوفة:</b> ${sanitize(medNames)}</div>
        </div>
        <div style="font-size:0.75rem;color:var(--muted);text-align:left;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
          <i class="far fa-clock"></i> ${dateStr}
        </div>
      </div>
    `;
  }).join('');
}

// Open Selected Prescription Modal
function openPrescDetails(key) {
  activePrescId = key;
  const p = _prescriptions[key];
  if (!p) return;

  document.getElementById('mpPatName').textContent = p.patientName;
  document.getElementById('mpDocName').textContent = p.docName;
  document.getElementById('mpVisitDate').textContent = p.createdAt ? p.createdAt.substring(0, 10) : '—';

  const tbody = document.getElementById('mpMedsList');
  tbody.innerHTML = (p.medications || []).map((m, idx) => {
    // Find matching drug in stock
    const matched = findInInventory(m.name);
    let availabilityHTML = `<span style="color:var(--red);font-weight:700">غير متوفر ❌</span>`;
    let qtyInput = `<input type="number" id="medQty_${idx}" class="fi" value="1" min="0" style="height:32px" oninput="recalcTotalPrice()">`;
    
    if (matched) {
      const isLow = matched.stock <= 0;
      availabilityHTML = isLow ? `<span style="color:var(--red);font-weight:700">نفذ من المخزون ⚠️</span>` : `<span style="color:var(--green)">متوفر (${matched.stock} ${matched.unit || 'علبة'})</span>`;
      qtyInput = `<input type="number" id="medQty_${idx}" class="fi" value="${m.qty || 1}" min="0" max="${matched.stock}" style="height:32px;border-color:var(--teal)" oninput="recalcTotalPrice()" data-price="${matched.price || 0}" data-drug-key="${matched.key}">`;
    }

    return `
      <tr>
        <td>
          <b>${sanitize(m.name)}</b>
          ${m.note ? `<div style="font-size:0.75rem;color:#ef4444;margin-top:4px;background:rgba(239,68,68,0.1);padding:4px 8px;border-radius:6px;display:inline-block;border:1px solid rgba(239,68,68,0.2)"><i class="fas fa-exclamation-triangle"></i> ملاحظة للطبيب: ${sanitize(m.note)}</div>` : ''}
        </td>
        <td style="font-size:0.8rem;color:var(--muted)">${sanitize(m.dose || '—')} · ${sanitize(m.freq || '—')}</td>
        <td style="font-size:0.8rem;color:var(--muted)">${sanitize(m.dur || '—')}</td>
        <td style="font-size:0.82rem">${availabilityHTML}</td>
        <td>${p.status === 'completed' || p.status === 'cancelled' ? `<b>${m.qty || 1}</b>` : qtyInput}</td>
      </tr>
    `;
  }).join('');

  recalcTotalPrice();

  const actions = document.getElementById('dispenseActions');
  if (p.status === 'completed') {
    actions.innerHTML = `<span style="color:var(--green);font-weight:bold"><i class="fas fa-check-double"></i> تم صرف هذه الوصفة مسبقاً</span>`;
  } else if (p.status === 'cancelled') {
    actions.innerHTML = `<span style="color:var(--red);font-weight:bold"><i class="fas fa-times-circle"></i> تم إلغاء هذه الوصفة لعدم توفر الأدوية بالمخزون</span>`;
  } else {
    actions.innerHTML = `
      <button class="btn-primary" onclick="dispensePrescription()"><i class="fas fa-pills"></i> صرف وتأكيد الوصفة</button>
      <button class="btn-secondary" style="border-color:var(--red);color:var(--red);background:rgba(239,68,68,0.05)" onclick="cancelPrescription()"><i class="fas fa-times"></i> إلغاء لعدم التوفر</button>
      <button class="btn-secondary" onclick="closeModal('prescModal')">إغلاق</button>
    `;
  }

  document.getElementById('prescModal').style.display = 'flex';
}

// Find drug in stock helper (case insensitive + word boundary matching)
function findInInventory(name) {
  const norm = name.toLowerCase().trim();
  const found = Object.entries(_inventory).find(([k, v]) => {
    const curName = (v.name || '').toLowerCase().trim();
    return curName.includes(norm) || norm.includes(curName);
  });
  return found ? { key: found[0], ...found[1] } : null;
}

// Recalculate dynamic medications total price
function recalcTotalPrice() {
  const p = _prescriptions[activePrescId];
  if (!p) return;

  let total = 0;
  if (p.status === 'completed') {
    total = p.totalCost || 0;
  } else {
    (p.medications || []).forEach((m, idx) => {
      const el = document.getElementById(`medQty_${idx}`);
      if (el) {
        const qty = parseInt(el.value) || 0;
        const price = parseFloat(el.getAttribute('data-price')) || 0;
        total += qty * price;
      }
    });
  }
  document.getElementById('mpTotalPrice').textContent = total.toFixed(2);
}

// Dispense Prescription
function dispensePrescription() {
  const p = _prescriptions[activePrescId];
  if (!p) return;

  const updates = {};
  const dispensedMeds = [];
  let totalCost = 0;
  let hasInsufficentStock = false;

  (p.medications || []).forEach((m, idx) => {
    const el = document.getElementById(`medQty_${idx}`);
    if (el) {
      const qty = parseInt(el.value) || 0;
      const drugKey = el.getAttribute('data-drug-key');
      const price = parseFloat(el.getAttribute('data-price')) || 0;
      
      if (drugKey) {
        const currentStock = _inventory[drugKey].stock || 0;
        if (qty > currentStock) {
          hasInsufficentStock = true;
        }
        // Deduct Inventory Stock
        updates[`pharmacy_inventory/${drugKey}/stock`] = currentStock - qty;
      }
      
      dispensedMeds.push({
        name: m.name,
        dose: m.dose,
        freq: m.freq,
        qty: qty,
        price: price
      });
      totalCost += qty * price;
    }
  });

  if (hasInsufficentStock) {
    if (!confirm("⚠️ تنبيه: الكمية المطلوبة لبعض الأدوية تفوق المخزون الحالي! هل ترغب في الاستمرار والصرف بأي حال؟")) return;
  }

  // 1. Update prescription status to completed
  updates[`prescriptions/${activePrescId}/status`] = 'completed';
  updates[`prescriptions/${activePrescId}/medications`] = dispensedMeds;
  updates[`prescriptions/${activePrescId}/totalCost`] = totalCost;

  // 2. Log dispensed medications inside patient visit EMR timeline
  const visitId = p.visitId;
  if (visitId) {
    const medSummary = dispensedMeds.map(m => `• ${m.name} (عدد ${m.qty})`).join('<br>');
    const timelineKey = db.ref().child('visits').push().key;
    const timelineObj = {
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
      docKey: 'pharmacist',
      docName: 'نظام الصيدلية المركزي',
      diagnosis: 'صرف وصفة طبية إلكترونية ✅',
      complaint: 'صيدلية المركز الموحدة',
      notes: `تم صرف الأدوية التالية بنجاح:<br>${medSummary}`,
      vitals: { temp: null, bp: null, pulse: null },
      prescriptions: [],
      attachments: []
    };
    updates[`patients/${p.patientId}/visits/${timelineKey}`] = timelineObj;

    // 3. Automated Billing: find current visit invoice and add drug charges
    db.ref(`${BASE}/invoices`).orderByChild('visitId').equalTo(visitId).once('value', invSnap => {
      const invoices = invSnap.val() || {};
      const invEntry = Object.entries(invoices)[0];
      if (invEntry) {
        const [invKey, invVal] = invEntry;
        const currentItems = invVal.items || [];
        
        dispensedMeds.forEach(m => {
          if (m.qty > 0) {
            currentItems.push({
              name: `علاج: ${m.name} (عدد ${m.qty})`,
              price: parseFloat((m.qty * m.price).toFixed(2))
            });
          }
        });

        const newTotal = parseFloat(currentItems.reduce((acc, item) => acc + item.price, 0).toFixed(2));
        
        const invoiceUpdates = {};
        invoiceUpdates[`invoices/${invKey}/items`] = currentItems;
        invoiceUpdates[`invoices/${invKey}/total`] = newTotal;
        db.ref(BASE).update(invoiceUpdates);
      }
    });
  }

  // Apply all updates atomically
  db.ref(BASE).update(updates).then(() => {
    if (typeof ArgonCore !== 'undefined') {
      ArgonCore.logAudit('DISPENSE_MEDS', `تم صرف وصفة للمريض: ${p.patientName} بتكلفة ${totalCost} د.أ`, 'PHARMACY');
    }
    toast('✅ تم صرف وتأكيد الوصفة وتحديث الحسابات بنجاح', 'ok');
    closeModal('prescModal');
  }).catch(() => toast('❌ فشل إتمام عملية الصرف', 'err'));
}

// Cancel Prescription for Out-of-Stock
function cancelPrescription() {
  const p = _prescriptions[activePrescId];
  if (!p) return;
  
  if (!confirm('هل أنت متأكد من إلغاء هذه الوصفة ونقلها إلى قسم الوصفات الملغاة لعدم توفر الأدوية؟')) return;
  
  const updates = {};
  updates[`prescriptions/${activePrescId}/status`] = 'cancelled';
  
  const visitId = p.visitId;
  if (visitId && p.patientId) {
    const timelineKey = db.ref().child('visits').push().key;
    const timelineObj = {
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
      docKey: 'pharmacist',
      docName: 'نظام الصيدلية المركزي',
      diagnosis: '❌ إلغاء وصفة لعدم توفر الأدوية',
      complaint: 'صيدلية المركز الموحدة',
      notes: `تم إلغاء صرف الوصفة الطبية لعدم توفر الأدوية المطلوبة بالمخزون ونقلها إلى قسم الوصفات الملغاة لعدم التوفر.`,
      vitals: { temp: null, bp: null, pulse: null },
      prescriptions: [],
      attachments: []
    };
    updates[`patients/${p.patientId}/visits/${timelineKey}`] = timelineObj;
  }
  
  db.ref(BASE).update(updates).then(() => {
    if (typeof ArgonCore !== 'undefined') {
      ArgonCore.logAudit('CANCEL_PRESCRIPTION', `تم إلغاء وصفة المريض: ${p.patientName} لعدم التوفر`, 'PHARMACY');
    }
    toast('❌ تم إلغاء الوصفة ونقلها إلى قسم الملغاة', 'ok');
    closeModal('prescModal');
  }).catch(e => {
    toast('❌ فشل إلغاء الوصفة', 'err');
  });
}

// Render Drug Inventory Table
function renderInventory() {
  const tbody = document.getElementById('invBody');
  const items = Object.entries(_inventory);

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">مستودع الأدوية فارغ حالياً!</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(([k, d]) => {
    const isLow = d.stock <= (d.lowStockAlert || 5);
    const lowClass = isLow ? 'low-stock-row' : '';
    const priceStr = d.price ? parseFloat(d.price).toFixed(2) : '0.00';
    
    return `
      <tr class="${lowClass}">
        <td><b>${sanitize(d.name)}</b></td>
        <td style="font-weight:bold;color:${isLow ? 'var(--red)' : 'var(--text)'}">
          ${d.stock} ${isLow ? '⚠️ مخزون منخفض' : ''}
        </td>
        <td style="color:var(--muted)">${sanitize(d.unit || 'علبة')}</td>
        <td style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--amber)">${priceStr} د.أ</td>
        <td style="color:var(--muted)">${d.lowStockAlert || 5}</td>
        <td style="text-align:center;display:flex;gap:6px;justify-content:center">
          <button class="btn-secondary" style="padding:4px 8px;font-size:0.8rem;border-color:var(--sky);color:var(--sky)" onclick="editDrug('${k}')"><i class="fas fa-edit"></i></button>
          <button class="btn-secondary" style="padding:4px 8px;font-size:0.8rem;border-color:var(--red);color:var(--red)" onclick="deleteDrug('${k}')"><i class="fas fa-trash-alt"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Add Drug Modal
function openAddDrug() {
  document.getElementById('drugEditId').value = '';
  document.getElementById('drugModalTitle').textContent = 'إضافة دواء جديد للمستودع';
  document.getElementById('drName').value = '';
  document.getElementById('drStock').value = '';
  document.getElementById('drUnit').value = 'علبة';
  document.getElementById('drPrice').value = '';
  document.getElementById('drMin').value = '5';
  document.getElementById('drugModal').style.display = 'flex';
}

// Save Drug (Add or Edit)
function saveDrug() {
  const key = document.getElementById('drugEditId').value;
  const name = document.getElementById('drName').value.trim();
  const stock = parseInt(document.getElementById('drStock').value) || 0;
  const unit = document.getElementById('drUnit').value.trim() || 'علبة';
  const price = parseFloat(document.getElementById('drPrice').value) || 0;
  const lowStockAlert = parseInt(document.getElementById('drMin').value) || 5;

  if (!name) {
    toast('⚠️ يرجى إدخال اسم الدواء العلمي والتجاري', 'err');
    return;
  }

  const drugObj = {
    name: sanitize(name),
    stock: stock,
    unit: sanitize(unit),
    price: price,
    lowStockAlert: lowStockAlert
  };

  const ref = key ? db.ref(`${BASE}/pharmacy_inventory/${key}`) : db.ref(`${BASE}/pharmacy_inventory`).push();
  
  ref.set(drugObj).then(() => {
    toast(key ? '✅ تم تحديث بيانات الدواء بنجاح' : '✅ تم إضافة الدواء الجديد للمستودع', 'ok');
    closeModal('drugModal');
  }).catch(() => toast('❌ فشل حفظ الدواء', 'err'));
}

// Edit Drug details
function editDrug(key) {
  const d = _inventory[key];
  if (!d) return;

  document.getElementById('drugEditId').value = key;
  document.getElementById('drugModalTitle').textContent = 'تعديل بيانات الدواء';
  document.getElementById('drName').value = d.name;
  document.getElementById('drStock').value = d.stock;
  document.getElementById('drUnit').value = d.unit || 'علبة';
  document.getElementById('drPrice').value = d.price;
  document.getElementById('drMin').value = d.lowStockAlert || 5;
  document.getElementById('drugModal').style.display = 'flex';
}

// Delete Drug from Inventory
function deleteDrug(key) {
  if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الدواء نهائياً من مخزون الصيدلية؟")) return;
  db.ref(`${BASE}/pharmacy_inventory/${key}`).remove().then(() => {
    toast('✅ تم حذف الدواء من المستودع بنجاح', 'ok');
  });
}

// Modals Utilities
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

// Sanitization utility
const sanitize = s => String(s || '').replace(/[<>"']/g, '').trim().substring(0, 150);
