// 📱 ARGON — Smart Patient Portal App
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
let loggedPhone = '';
let sentOtpCode = '';
let patientData = null;
let invoicesData = {};
let bookingsData = {};
let activeSection = 'homeSec';

window.addEventListener('DOMContentLoaded', () => {
  if (!CID) {
    alert("خطأ: معرف المجمع الطبي غير صحيح! يرجى فتح الصفحة من خلال رابط العيادة.");
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
      document.getElementById('clinicLogo').textContent = _sets.emoji ? `ARGON ${_sets.emoji}` : 'ARGON CLINIC';
      document.getElementById('clinicCall').href = _sets.phone ? `tel:${_sets.phone}` : 'tel:#';

      // Check persistent session
      const savedPhone = localStorage.getItem('argon_pat_phone_' + CID);
      if (savedPhone) {
        loggedPhone = savedPhone;
        document.getElementById('patientLogin').style.display = 'none';
        initPortal();
      }
    } else {
      document.getElementById('lClinicName').textContent = 'المجمع الطبي غير مسجل';
    }
  });
});

// Passwordless Login Step 1: Send OTP Simulation
function sendOtp() {
  const rawPhone = document.getElementById('patPhone').value.trim();
  const err = document.getElementById('lErr');
  err.style.display = 'none';

  if (!rawPhone || rawPhone.length < 8) {
    toast('⚠️ الرجاء إدخال رقم هاتف صحيح أولاً', 'err');
    return;
  }

  let phone = rawPhone.replace(/\D/g, '');
  if (phone.startsWith('962')) phone = phone.substring(3);
  if (phone.startsWith('0')) phone = phone.substring(1);

  toast('⏳ جاري البحث عن ملفك الطبي...', 'ok');

  // Verify patient exists in EMR records
  db.ref(`${BASE}/patients/${phone}`).once('value', snap => {
    const pat = snap.val();
    if (!pat) {
      err.textContent = '❌ رقم الهاتف هذا غير مسجل لدينا في السجلات الطبية. يرجى مراجعة الاستقبال أولاً.';
      err.style.display = 'block';
      return;
    }

    // Generate random 4-digit code
    const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
    sentOtpCode = mockOtp;
    
    // Hide Step 1, show Step 2
    document.getElementById('loginStep1').style.display = 'none';
    document.getElementById('loginStep2').style.display = 'flex';
    
    // Display interactive mock notification on screen
    setTimeout(() => {
      alert(`💬 رسالة SMS محاكاة من المجمع الطبي:\n"رمز التحقق السريع لتسجيل الدخول لبوابة ARGON هو: ${mockOtp}"`);
    }, 500);

    toast('✉️ تم إرسال رمز التحقق بنجاح!', 'ok');
  });
}

function backToPhone() {
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginStep1').style.display = 'flex';
}

// Passwordless Login Step 2: Verify OTP
function verifyOtp() {
  const otpVal = document.getElementById('patOtp').value.trim();
  const rawPhone = document.getElementById('patPhone').value.trim();
  const err = document.getElementById('lErr');
  
  if (otpVal === sentOtpCode) {
    let phone = rawPhone.replace(/\D/g, '');
    if (phone.startsWith('962')) phone = phone.substring(3);
    if (phone.startsWith('0')) phone = phone.substring(1);
    
    loggedPhone = phone;
    localStorage.setItem('argon_pat_phone_' + CID, phone);
    
    document.getElementById('patientLogin').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('patientLogin').style.display = 'none';
      initPortal();
    }, 300);
  } else {
    err.textContent = '❌ رمز التحقق غير صحيح! حاول مرة أخرى.';
    err.style.display = 'block';
  }
}

// Portal Initialization (Scoped Data Observers)
function initPortal() {
  toast('مرحباً بك في بوابتك الطبية الرقمية 📲', 'ok');

  // Prefill Bookings Shortcut with patient details
  const bookingLink = document.getElementById('btnNewBooking');
  bookingLink.href = `index.html?id=${CID}&phone=${loggedPhone}`;

  // 1. Live Patient Details & EMR Timeline
  db.ref(`${BASE}/patients/${loggedPhone}`).on('value', snap => {
    patientData = snap.val();
    if (patientData) {
      renderDemographics();
      renderMedicalTimeline();
    }
  });

  // 2. Live Active Bookings
  db.ref(`${BASE}/bookings`).orderByChild('patPhone').equalTo(loggedPhone).on('value', snap => {
    bookingsData = snap.val() || {};
    renderUpcomingAppointments();
  });

  // 3. Live Invoices
  db.ref(`${BASE}/invoices`).orderByChild('patientId').equalTo(loggedPhone).on('value', snap => {
    invoicesData = snap.val() || {};
    renderBillingLedger();
  });

  // 4. Live Notifications
  db.ref(`${BASE}/notifications`).on('value', snap => {
    const notifs = snap.val() || {};
    renderNotifications(notifs);
  });
}

// Render Demographics
function renderDemographics() {
  const info = patientData.info || {};
  document.getElementById('patName').textContent = info.name || 'مريض مسجل';
  document.getElementById('patMrn').textContent = info.mrn || '—';
  document.getElementById('patAge').textContent = info.age ? `${info.age} سنة` : '—';
  document.getElementById('patGender').textContent = info.gender === 'male' ? 'ذكر' : (info.gender === 'female' ? 'أنثى' : '—');
  document.getElementById('patBlood').textContent = info.bloodType || '—';

  // Allergies
  const algs = info.allergies || [];
  const algGrid = document.getElementById('patAllergies');
  if (algs.length) {
    algGrid.innerHTML = algs.map(a => `<span class="tag red">${sanitize(a)}</span>`).join('');
  } else {
    algGrid.innerHTML = `<span class="tag">لا يوجد حقول مسجلة</span>`;
  }

  // Chronic Diseases
  const chronic = info.chronicDiseases || [];
  const chronicGrid = document.getElementById('patChronic');
  if (chronic.length) {
    chronicGrid.innerHTML = chronic.map(c => `<span class="tag blue">${sanitize(c)}</span>`).join('');
  } else {
    chronicGrid.innerHTML = `<span class="tag blue">لا يوجد حقول مسجلة</span>`;
  }
}

// Render Upcoming Bookings
function renderUpcomingAppointments() {
  const grid = document.getElementById('upcomingGrid');
  const activeBookings = Object.values(bookingsData).filter(b => b.status === 'waiting' || b.status === 'processing');

  if (!activeBookings.length) {
    grid.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted)" class="glass-panel">لا توجد مواعيد نشطة مجدولة حالياً</div>`;
    return;
  }

  activeBookings.sort((a,b) => a.date.localeCompare(b.date));

  grid.innerHTML = activeBookings.map(b => {
    const statusText = b.status === 'processing' ? 'قيد المعاينة حالياً 🩺' : 'مؤكد - بانتظار دورك ⏳';
    const statusColor = b.status === 'processing' ? 'var(--teal)' : 'var(--amber)';
    return `
      <div class="glass-panel" style="padding:16px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:0.95rem;color:var(--teal)">د. ${sanitize(b.docName)}</b>
          <span style="font-size:0.75rem;color:${statusColor};font-weight:700">${statusText}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--muted)">
          <div>التخصص: <b>${sanitize(b.docSpec)}</b></div>
          <div>رقم الحجز اليومي: <b style="font-family:'IBM Plex Mono';color:var(--teal)">#${b.bookNo}</b></div>
        </div>
        <div style="font-size:0.78rem;color:var(--muted);border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between">
          <span><i class="far fa-calendar"></i> ${b.date}</span>
          <span><i class="far fa-clock"></i> ${b.time}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render Medical Timeline History
function renderMedicalTimeline() {
  const grid = document.getElementById('patTimelineGrid');
  const visits = Object.entries(patientData.visits || {}).sort((a,b) => b[1].date.localeCompare(a[1].date));

  if (!visits.length) {
    grid.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted)" class="glass-panel">لا يوجد زيارات أو سجلات سابقة مسجلة</div>`;
    return;
  }

  grid.innerHTML = visits.map(([vk, v]) => {
    const isPharmacist = v.docKey === 'pharmacist';
    const isLab = v.docKey === 'lab';
    const isRad = v.docKey === 'radiology';
    const isReferral = v.docKey === 'referral';

    let cardIcon = 'fa-stethoscope';
    let cardTitle = `استشارة: د. ${sanitize(v.docName)}`;
    let cardStyle = '';
    let btnText = 'عرض تفاصيل الملخص للطباعة 📋';

    if (isPharmacist) {
      cardIcon = 'fa-pills';
      cardTitle = 'صرف وصفة: نظام الصيدلية المركزي';
      cardStyle = 'border-right: 4px solid var(--amber); background: rgba(245, 158, 11, 0.03);';
      btnText = 'عرض تفاصيل الوصفة والصرف 💊';
    } else if (isLab) {
      cardIcon = 'fa-flask';
      cardTitle = 'نتائج تحاليل: المختبر الطبي المركزي';
      cardStyle = 'border-right: 4px solid var(--teal); background: rgba(13, 148, 136, 0.03);';
      btnText = 'عرض تقرير النتائج المخبرية للطباعة 🔬';
    } else if (isRad) {
      cardIcon = 'fa-x-ray';
      cardTitle = 'قسم الأشعة والسينية';
      cardStyle = 'border-right: 4px solid var(--sky); background: rgba(14, 165, 233, 0.03);';
      btnText = 'عرض التقرير الطبي وصورة الأشعة ☢️';
    } else if (isReferral) {
      cardIcon = 'fa-exchange-alt';
      cardTitle = 'تحويل داخلي';
      cardStyle = 'border-right: 4px solid #a855f7; background: rgba(168, 85, 247, 0.03);';
      btnText = 'عرض تفاصيل الإحالة 🔄';
    }

    const rxList = (v.prescriptions || []).map(r => `• ${sanitize(r.name)} (${sanitize(r.dose || '—')}) - ${sanitize(r.freq || '—')}`).join('<br>');
    const notesHTML = (isPharmacist || isLab || isRad || isReferral) ? v.notes : sanitize(v.notes || 'فحص عام واستشارة طبية');

    // Attachments Lightbox triggers
    let attsHTML = '';
    if (v.attachments && v.attachments.length) {
      attsHTML = v.attachments.map(a => {
        if (a.type === 'image') {
          return `
            <div style="margin-top:10px;text-align:center" onclick="event.stopPropagation();openLightbox('${a.data}')">
              <img src="${a.data}" style="max-width:100%;border-radius:12px;border:1px solid var(--border);max-height:150px;cursor:zoom-in">
              <div style="font-size:0.75rem;color:var(--sky);font-weight:700;margin-top:4px"><i class="fas fa-expand-arrows-alt"></i> اضغط لتكبير الصورة التشخيصية</div>
            </div>`;
        } else {
          return `
            <div class="tag blue" style="cursor:pointer;margin-top:6px;display:inline-flex;align-items:center;gap:6px" onclick="event.stopPropagation();openAttachmentPdf('${a.data}')">
              <i class="fas fa-file-pdf"></i> تحميل التقرير المرفق (PDF)
            </div>`;
        }
      }).join('');
    }

    return `
      <div class="tl-card glass-panel" style="${cardStyle}" onclick="this.classList.toggle('open')">
        <div class="tl-head">
          <span>${v.date} · ${v.time}</span>
          <span><i class="fas ${cardIcon}"></i> ${cardTitle}</span>
        </div>
        <div class="tl-title">${sanitize(v.diagnosis || 'مراجعة طبية')}</div>
        <div style="font-size:0.8rem;color:var(--muted);display:flex;justify-content:space-between">
          <span>🔍 الموضوع: ${sanitize(v.complaint || 'زيارة')}</span>
          <span style="color:var(--teal);font-weight:700"><i class="fas fa-chevron-down"></i> تفاصيل</span>
        </div>
        <div class="tl-details">
          <div style="margin-bottom:8px"><b>📝 التقرير الطبي:</b><p style="font-size:0.82rem;color:var(--muted);margin-top:4px">${notesHTML}</p></div>
          ${rxList ? `<div style="margin-bottom:8px"><b>💊 الوصفة الطبية المعتمدة:</b><p style="font-size:0.82rem;color:var(--amber);margin-top:4px">${rxList}</p></div>` : ''}
          ${attsHTML}
          <div style="display:flex;justify-content:flex-end;margin-top:10px">
            <button class="btn-secondary" style="font-size:0.75rem;padding:6px 12px" onclick="event.stopPropagation();showPrintView('${vk}')">
              <i class="fas fa-print"></i> ${btnText}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Billing Ledger
function renderBillingLedger() {
  const grid = document.getElementById('invoicesGrid');
  const invoicesList = Object.entries(invoicesData);
  let totUnpaid = 0;

  if (!invoicesList.length) {
    grid.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted)" class="glass-panel">لا توجد فواتير أو مستحقات مالية مسجلة</div>`;
    document.getElementById('totBalance').textContent = '0.00 د.أ';
    return;
  }

  // Calculate Balance
  invoicesList.forEach(([k, inv]) => {
    if (inv.status === 'pending' || inv.status === 'unpaid' || !inv.status) {
      totUnpaid += parseFloat(inv.total || 0);
    }
  });
  document.getElementById('totBalance').textContent = `${totUnpaid.toFixed(2)} د.أ`;

  grid.innerHTML = invoicesList.map(([k, inv]) => {
    const isPaid = inv.status === 'paid';
    const statusText = isPaid ? 'مدفوعة ✅' : 'بانتظار الدفع ⏳';
    const statusColor = isPaid ? 'var(--green)' : 'var(--amber)';
    const itemsList = (inv.items || []).map(item => `• ${sanitize(item.name)}: <b>${item.price} JOD</b>`).join('<br>');
    
    return `
      <div class="glass-panel" style="padding:16px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.75rem;color:var(--muted)">رقم الفاتورة: <b style="font-family:'IBM Plex Mono'">#${k.substring(0,8)}</b></span>
          <span class="tag" style="background:none;border-color:${statusColor};color:${statusColor}">${statusText}</span>
        </div>
        <div style="font-size:0.8rem;border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:8px 0;margin:4px 0">
          ${itemsList || 'بنود عامة'}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>إجمالي الفاتورة: <b style="color:var(--teal);font-size:1.1rem">${parseFloat(inv.total || 0).toFixed(2)} JOD</b></div>
          ${isPaid ? '' : `
            <span style="font-size:0.75rem;color:var(--muted);background:rgba(255,255,255,0.02);border:1px dashed var(--border);padding:6px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:4px">
              <i class="fas fa-info-circle" style="color:var(--teal)"></i> الدفع يتم خارجياً لدى موظف الاستقبال
            </span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// Render Notifications
function renderNotifications(allNotifs) {
  const grid = document.getElementById('alertsGrid');
  
  // Filter notifications relevant to logged in patient
  const patNotifs = Object.values(allNotifs).filter(n => {
    const isRelevant = n.patientPhone === loggedPhone || (n.message && n.message.includes(loggedPhone));
    const isTargetedToPatient = n.role === 'patient' || !n.role;
    return isRelevant || isTargetedToPatient;
  });

  if (!patNotifs.length) {
    grid.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted)" class="glass-panel">لا توجد تنبيهات أو إشعارات طبية جديدة</div>`;
    document.getElementById('navAlertDot').style.display = 'none';
    return;
  }

  document.getElementById('navAlertDot').style.display = 'block';

  patNotifs.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  grid.innerHTML = patNotifs.map(n => `
    <div class="glass-panel" style="padding:14px;display:flex;gap:12px;align-items:start">
      <div style="font-size:1.5rem;padding:6px;background:rgba(99,102,241,0.1);border-radius:10px">🔔</div>
      <div style="flex:1">
        <b style="font-size:0.85rem">${sanitize(n.title)}</b>
        <p style="font-size:0.78rem;color:var(--muted);margin-top:2px">${sanitize(n.message)}</p>
        <span style="font-size:0.65rem;color:var(--muted);display:block;margin-top:4px"><i class="far fa-clock"></i> ${(n.createdAt || '').substring(11, 16)}</span>
      </div>
    </div>
  `).join('');
}

// Online Payment Checkout disabled - redirect to Reception Desk
function simulatePayment(invoiceKey) {
  alert("💵 سداد الفاتورة:\nيرجى العلم أن الدفع يتم خارجياً (نقداً أو بالبطاقة) لدى موظف الاستقبال أو محاسب المجمع الطبي.");
}

// Show printable EMR sheet modal
function showPrintView(visitKey) {
  const v = patientData.visits[visitKey];
  if (!v) return;

  const isPharmacist = v.docKey === 'pharmacist';
  const isLab = v.docKey === 'lab';
  const isRad = v.docKey === 'radiology';

  const rxList = (v.prescriptions || []).map(r => `• ${sanitize(r.name)} (${sanitize(r.dose || '—')}) - ${sanitize(r.freq || '—')}`).join('<br>');
  const notesHTML = (isPharmacist || isLab || isRad) ? v.notes : sanitize(v.notes || 'زيارة واستشارة عيادة خارجية');

  let title = 'ملخص الزيارة والتقرير الطبي';
  if (isPharmacist) title = 'الوصفة الطبية المصروفة';
  if (isLab) title = 'تقرير نتائج الفحوصات المخبرية';
  if (isRad) title = 'تقرير تصوير الأشعة والسينية';

  document.getElementById('printArea').innerHTML = `
    <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:12px">
      <h2>${sanitize(_sets.name)}</h2>
      <h3 style="color:#666">${title}</h3>
      <p style="font-size:0.75rem">تاريخ التقرير: ${v.date} · ${v.time}</p>
    </div>
    <div>
      <p><b>اسم المريض:</b> ${sanitize(patientData.info.name)}</p>
      <p><b>الرقم الطبي:</b> ${sanitize(patientData.info.mrn)} | <b>العمر:</b> ${patientData.info.age || '—'}</p>
      <hr style="margin:10px 0;border-style:dashed">
      <p><b>مصدر التقرير:</b> ${sanitize(v.docName)}</p>
      <p><b>التشخيص:</b> ${sanitize(v.diagnosis || '—')}</p>
      <div style="margin-top:10px;background:#f9f9f9;padding:10px;border-radius:6px;border:1px solid #eee">
        <b>📝 التقرير الطبي والنتائج:</b>
        <p style="font-size:0.85rem;margin-top:4px;white-space:pre-line">${notesHTML}</p>
      </div>
      ${rxList ? `<div style="margin-top:10px;background:#fff8e1;padding:10px;border-radius:6px;border:1px solid #ffe082">
        <b>💊 الأدوية الموصوفة:</b>
        <p style="font-size:0.85rem;margin-top:4px">${rxList}</p>
      </div>` : ''}
    </div>
    <div style="margin-top:40px;text-align:center;font-size:0.7rem;color:#777;border-top:1px solid #ccc;padding-top:10px">
      * هذا المستند تم إنشاؤه إلكترونياً من بوابة المريض الرقمية الخاصة بمجمع ARGON الطبي.
    </div>
  `;

  document.getElementById('printModal').style.display = 'flex';
}

function doPrintContent() {
  const printContent = document.getElementById('printArea').innerHTML;
  const originalContent = document.body.innerHTML;
  
  document.body.innerHTML = `<div style="padding:40px;direction:rtl;font-family:'Tajawal',sans-serif">${printContent}</div>`;
  window.print();
  
  // Reload immediately to restore standard page structure
  location.reload();
}

// Lightbox controller
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxModal').style.display = 'flex';
}

// Attachment PDF opener
function openAttachmentPdf(data) {
  const w = window.open();
  w.document.write(`<iframe src="${data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
  w.document.close();
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Switch Bottom tab views
function sw(id, el) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  
  activeSection = id;
}

// Logout session
function logout() {
  localStorage.removeItem('argon_pat_phone_' + CID);
  location.reload();
}

// Toast Alerts
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
