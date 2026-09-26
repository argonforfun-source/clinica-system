// 📊 Argon Professional Excel Export Engine
// Powered by ExcelJS

async function exportProfessionalExcel(fromDate = null, toDate = null) {
  toast('⏳ جاري تجميع وتحليل البيانات... يرجى الانتظار', '');
  
  try {
    // 1. Fetch entire clinic snapshot for comprehensive export
    const snap = await db.ref(BASE).once('value');
    const data = snap.val() || {};
    
    // 2. Initialize ExcelJS Workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Argon Medical OS';
    wb.lastModifiedBy = 'Argon System Admin';
    wb.created = new Date();
    
    // ── Helper: Style Header Row ──
    const styleHeader = (row, ws) => {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }; // Teal
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Tajawal', size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
        };
      });
      row.height = 25;
      ws.views = [{ rightToLeft: true }];
    };

    // ── Helper: Style Data Row ──
    const styleDataRow = (row) => {
      row.eachCell((cell) => {
        cell.font = { name: 'Tajawal', size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: {style:'thin', color: {argb:'FFEEEEEE'}}, 
          left: {style:'thin', color: {argb:'FFEEEEEE'}}, 
          bottom: {style:'thin', color: {argb:'FFEEEEEE'}}, 
          right: {style:'thin', color: {argb:'FFEEEEEE'}}
        };
      });
      row.height = 20;
    };

    // ==========================================
    // SHEET 1: GENERAL SUMMARY (ملخص العيادة)
    // ==========================================
    const ws1 = wb.addWorksheet('ملخص العيادة', { views: [{ rightToLeft: true }] });
    
    const settings = data.settings || {};
    const stats = data.stats || {};
    
    ws1.getColumn('A').width = 30;
    ws1.getColumn('B').width = 40;
    
    // Title
    ws1.mergeCells('A1:B2');
    const titleCell = ws1.getCell('A1');
    titleCell.value = 'التقرير الشامل - ' + (settings.name || 'العيادة');
    titleCell.font = { name: 'Tajawal', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const genData = [
      ['تاريخ استخراج التقرير', new Date().toLocaleString('ar-JO')],
      ['إجمالي الحجوزات المسجلة', stats.totalBookings || 0],
      ['إجمالي الإيرادات (المحسوبة)', (stats.totalIncome || 0).toFixed(2) + ' د.أ'],
      ['إجمالي زيارات النظام الإلكتروني', stats.visitors || 0],
      ['حالة العيادة الحالية', settings.status === 'open' ? 'مفتوحة' : 'مغلقة'],
      ['نمط التشغيل', settings.mode === 'medical_complex' ? 'مجمع طبي متكامل' : 'عيادة منفردة']
    ];

    let rIdx = 4;
    genData.forEach(item => {
      const row = ws1.getRow(rIdx++);
      row.values = item;
      row.getCell(1).font = { bold: true, name: 'Tajawal', size: 12 };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      styleDataRow(row);
    });

    // ==========================================
    // SHEET 2: ALL BOOKINGS (سجل الحجوزات)
    // ==========================================
    const ws2 = wb.addWorksheet('سجل الحجوزات', { views: [{ rightToLeft: true }] });
    ws2.columns = [
      { header: 'رقم المرجع', key: 'ref', width: 15 },
      { header: 'التاريخ', key: 'date', width: 15 },
      { header: 'الوقت', key: 'time', width: 12 },
      { header: 'اسم المريض', key: 'patName', width: 30 },
      { header: 'رقم الهاتف', key: 'phone', width: 20 },
      { header: 'الطبيب المعالج', key: 'docName', width: 25 },
      { header: 'التكلفة (د.أ)', key: 'cost', width: 15 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'تاريخ الإنشاء', key: 'created', width: 20 }
    ];
    styleHeader(ws2.getRow(1), ws2);

    const bookings = data.bookings || {};
    const doctors = data.doctors || {};
    let totalConfirmedRev = 0;

    Object.entries(bookings).forEach(([bk, bv]) => {
      let stTxt = bv.status === 'new' ? 'جديد' : 
                 (bv.status === 'confirmed' ? 'مؤكد' : 
                 (bv.status === 'waiting' ? 'انتظار' : 
                 (bv.status === 'completed' ? 'مكتمل' : 'ملغي')));
                 
      const doc = doctors[bv.docKey] || {};
      const docName = doc.name ? 'د. ' + doc.name : (bv.docKey === 'clinic' ? 'العيادة العامة' : 'غير محدد');
      const cost = parseFloat(bv.fee || doc.fee || 0);

      if(bv.status === 'completed' || bv.status === 'confirmed') totalConfirmedRev += cost;

      const row = ws2.addRow({
        ref: bk.substring(1, 8),
        date: bv.date,
        time: bv.time,
        patName: bv.name,
        phone: bv.phone,
        docName: docName,
        cost: cost.toFixed(2),
        status: stTxt,
        created: new Date(bv.createdAt).toLocaleString('ar-JO')
      });
      styleDataRow(row);
      
      // Status coloring
      const stCell = row.getCell('status');
      if(bv.status === 'completed') stCell.font = { color: { argb: 'FF10B981' }, bold: true };
      if(bv.status === 'cancelled') stCell.font = { color: { argb: 'FFEF4444' }, bold: true };
    });

    // ==========================================
    // SHEET 3: DOCTORS PERFORMANCE (أداء الأطباء)
    // ==========================================
    const ws3 = wb.addWorksheet('أداء الأطباء', { views: [{ rightToLeft: true }] });
    ws3.columns = [
      { header: 'اسم الطبيب', key: 'name', width: 30 },
      { header: 'التخصص', key: 'spec', width: 25 },
      { header: 'كشفية الطبيب (د.أ)', key: 'fee', width: 18 },
      { header: 'متوسط التقييم', key: 'rating', width: 15 },
      { header: 'إجمالي الحجوزات', key: 'totalBooks', width: 18 },
      { header: 'إجمالي الإيرادات المباشرة (د.أ)', key: 'rev', width: 25 }
    ];
    styleHeader(ws3.getRow(1), ws3);

    Object.entries(doctors).forEach(([dk, dv]) => {
      // Calculate revenue and bookings per doctor
      let dBooks = 0;
      let dRev = 0;
      Object.values(bookings).forEach(b => {
        if(b.docKey === dk && b.status !== 'cancelled') {
          dBooks++;
          if(b.status === 'completed' || b.status === 'confirmed') {
            dRev += parseFloat(b.fee || dv.fee || 0);
          }
        }
      });

      const row = ws3.addRow({
        name: 'د. ' + (dv.name || 'غير محدد'),
        spec: dv.specialty || 'غير محدد',
        fee: parseFloat(dv.fee || 0).toFixed(2),
        rating: parseFloat(dv.avgRating || 0).toFixed(1) + ' / 5.0',
        totalBooks: dBooks,
        rev: dRev.toFixed(2)
      });
      styleDataRow(row);
    });

    // ==========================================
    // SHEET 4: INVOICES & FINANCIALS (المالية والفواتير)
    // ==========================================
    if (data.invoices) {
      const ws4 = wb.addWorksheet('الفواتير التفصيلية', { views: [{ rightToLeft: true }] });
      ws4.columns = [
        { header: 'رقم الفاتورة', key: 'id', width: 15 },
        { header: 'التاريخ', key: 'date', width: 20 },
        { header: 'اسم المريض', key: 'patName', width: 30 },
        { header: 'اسم الطبيب', key: 'docName', width: 25 },
        { header: 'قيمة الكشفية', key: 'fee', width: 15 },
        { header: 'قيمة الخدمات والأدوية', key: 'items', width: 20 },
        { header: 'الإجمالي (د.أ)', key: 'total', width: 15 }
      ];
      styleHeader(ws4.getRow(1), ws4);

      Object.entries(data.invoices).forEach(([ik, iv]) => {
        let itemsSum = 0;
        if(iv.items && Array.isArray(iv.items)) {
            iv.items.forEach(i => itemsSum += parseFloat(i.price || 0));
        }
        
        const row = ws4.addRow({
          id: ik.substring(1, 8),
          date: iv.createdAt ? new Date(iv.createdAt).toLocaleString('ar-JO') : '-',
          patName: iv.patientName || 'غير محدد',
          docName: iv.docName || '-',
          fee: parseFloat(iv.doctorFee || 0).toFixed(2),
          items: itemsSum.toFixed(2),
          total: parseFloat(iv.total || 0).toFixed(2)
        });
        styleDataRow(row);
      });
    }

    // ==========================================
    // SHEET 5: PHARMACY INVENTORY (مخزون الصيدلية)
    // ==========================================
    if (data.pharmacy_inventory) {
        const ws5 = wb.addWorksheet('مخزون الصيدلية', { views: [{ rightToLeft: true }] });
        ws5.columns = [
          { header: 'اسم الدواء / العلاج', key: 'name', width: 35 },
          { header: 'الكمية المتوفرة', key: 'stock', width: 15 },
          { header: 'سعر الوحدة (د.أ)', key: 'price', width: 15 },
          { header: 'وحدة القياس', key: 'unit', width: 15 },
          { header: 'الحد الأدنى للإنذار', key: 'min', width: 18 }
        ];
        styleHeader(ws5.getRow(1), ws5);
  
        Object.values(data.pharmacy_inventory).forEach(item => {
          const row = ws5.addRow({
            name: item.name || '-',
            stock: item.stock || 0,
            price: parseFloat(item.price || 0).toFixed(2),
            unit: item.unit || 'علبة',
            min: item.lowStockAlert || 5
          });
          styleDataRow(row);
          if (item.stock <= (item.lowStockAlert || 5)) {
              row.getCell('stock').font = { color: { argb: 'FFEF4444' }, bold: true }; // Red if low
          }
        });
    }

    // 3. Tax & Financial Support Report (إضافي — Section 32)
    addTaxComplianceWorksheet(wb, data, styleHeader, styleDataRow, fromDate, toDate);

    // SHEET 6: PATIENTS LIST (قائمة المرضى)
    const ws6 = wb.addWorksheet('قائمة المرضى', { views: [{ rightToLeft: true }] });
    ws6.columns = [
      { header: 'اسم المريض', key: 'name', width: 25 },
      { header: 'رقم الهاتف', key: 'phone', width: 20 },
      { header: 'الرقم الوطني / الهوية', key: 'nid', width: 20 },
      { header: 'الجنس', key: 'gender', width: 10 },
      { header: 'تاريخ الميلاد / العمر', key: 'age', width: 20 },
      { header: 'رقم الملف الطبي (MRN)', key: 'mrn', width: 30 },
      { header: 'رقم العيادة (اليدوي)', key: 'fileNo', width: 20 },
      { header: 'تاريخ التسجيل', key: 'createdAt', width: 15 }
    ];
    styleHeader(ws6.getRow(1), ws6);

    const genderMap = { 'male': 'ذكر', 'female': 'أنثى', 'ذكر': 'ذكر', 'أنثى': 'أنثى' };
    if(data.patients) {
      Object.values(data.patients).forEach(p => {
        const row = ws6.addRow({
          name: p.info?.name || '-',
          phone: p.info?.phone || '-',
          nid: p.info?.nationalId || '-',
          gender: genderMap[p.info?.gender] || p.info?.gender || '-',
          age: p.info?.age || '-',
          mrn: p.info?.mrn || '-',
          fileNo: p.info?.fileNumber || '-',
          createdAt: p.info?.createdAt ? new Date(p.info.createdAt).toLocaleDateString('ar-JO') : '-'
        });
        styleDataRow(row);
      });
    }

    // SHEET 7: STAFF AND DOCTORS (الموظفين والأطباء)
    const ws7 = wb.addWorksheet('الموظفين والأطباء', { views: [{ rightToLeft: true }] });
    ws7.columns = [
      { header: 'الاسم', key: 'name', width: 25 },
      { header: 'النوع (طبيب/موظف)', key: 'type', width: 20 },
      { header: 'المنصب / التخصص', key: 'role', width: 25 },
      { header: 'رقم الهاتف', key: 'phone', width: 20 }
    ];
    styleHeader(ws7.getRow(1), ws7);

    if(data.doctors) {
      Object.values(data.doctors).forEach(d => {
        const row = ws7.addRow({
          name: d.name || '-',
          type: 'طبيب',
          role: d.specialty || '-',
          phone: d.phone || '-'
        });
        styleDataRow(row);
      });
    }
    if(data.staff) {
      const roleMap = { 'reception': 'استقبال', 'nurse': 'ممرض/ة', 'admin': 'مدير نظام', 'accountant': 'محاسب' };
      Object.values(data.staff).forEach(s => {
        const row = ws7.addRow({
          name: s.name || '-',
          type: 'موظف',
          role: roleMap[s.role] || s.role || '-',
          phone: s.phone || '-'
        });
        styleDataRow(row);
      });
    }

    // 4. Generate File and Trigger Download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `التقرير_الشامل_لعيادة_${(settings.name || 'أرغون').replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    saveAs(blob, fileName);
    toast('✅ تم تصدير ملف الإكسيل بنجاح!', 'ok');

  } catch (error) {
    console.error('Excel Export Error:', error);
    toast('❌ حدث خطأ أثناء استخراج البيانات: ' + error.message, 'err');
  }
}

// ════════════════════════════════════════════════════════════════════════
// 📑 TAX-REPORT-001 — التقرير الضريبي والمالي (Tax & Financial Support Report)
// إضافة جراحية فوق excel-export.js — صفر تعديل على الشيتات ١-٥ الموجودة.
// READ-ONLY بالكامل — لا set/update/push/remove على قاعدة البيانات.
// ════════════════════════════════════════════════════════════════════════

function _taxToJordanDate(value) {
  if (!value) return null;
  const d = (typeof value === 'number') ? new Date(value) : new Date(value);
  if (isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' });
  } catch (e) {
    const jd = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return jd.toISOString().slice(0, 10);
  }
}

function _taxInRange(dateStr, from, to) {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function _taxJod(n) {
  return parseFloat((parseFloat(n) || 0).toFixed(3));
}

function _taxCalcPaidForInvoice(invId, transactions) {
  let paid = 0;
  for (const tx of Object.values(transactions || {})) {
    if (tx.invoiceId !== invId || tx.status === 'voided') continue;
    if (tx.type === 'PAYMENT') paid += parseFloat(tx.amount) || 0;
    if (tx.type === 'REVERSAL') paid -= parseFloat(tx.amount) || 0;
  }
  return Math.max(paid, 0);
}

function addTaxComplianceWorksheet(wb, data, styleHeader, styleDataRow, fromDate, toDate) {
  const settings       = data.settings || {};
  const patients        = data.patients || {};
  const invoicesAll     = data.invoices || {};
  const transactionsAll = data.financial_transactions || {};
  const today           = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' });
  const periodFrom       = fromDate || '0000-01-01';
  const periodTo         = toDate   || today;

  const patientActivity = {};
  Object.entries(patients).forEach(([uid, p]) => {
    const visits = (p && p.visits) || {};
    Object.values(visits).forEach(v => {
      if (!v || !v.date) return;
      if (!_taxInRange(v.date, periodFrom, periodTo)) return;
      if (!patientActivity[uid]) {
        patientActivity[uid] = { firstVisit: v.date, lastVisit: v.date, visitCount: 0, doctors: new Set() };
      }
      const pa = patientActivity[uid];
      pa.visitCount++;
      if (v.date < pa.firstVisit) pa.firstVisit = v.date;
      if (v.date > pa.lastVisit)  pa.lastVisit  = v.date;
      if (v.docName) pa.doctors.add(v.docName);
    });
  });

  const periodInvoices = [];
  Object.entries(invoicesAll).forEach(([invId, inv]) => {
    if (!inv) return;
    if (['voided', 'cancelled'].includes(inv.status)) return;
    const invDate = _taxToJordanDate(inv.createdAt);
    if (!invDate || !_taxInRange(invDate, periodFrom, periodTo)) return;
    periodInvoices.push({ invId, inv, invDate, paid: _taxCalcPaidForInvoice(invId, transactionsAll) });
  });

  const allOpenInvoices = Object.entries(invoicesAll).filter(([, inv]) => inv && !['voided', 'cancelled'].includes(inv.status));

  let sumGross = 0, sumDiscount = 0, sumInsurance = 0, sumNet = 0, sumPaidInPeriod = 0;
  const byMonth = {};
  const byDoctor = {};
  const dentalItems = [];
  const taxFlags = [];

  periodInvoices.forEach(({ invId, inv, invDate, paid }) => {
    const gross     = _taxJod(inv.grossTotal !== undefined ? inv.grossTotal : inv.total);
    const discount   = _taxJod(inv.discountTotal);
    const insurance  = _taxJod(inv.insuranceTotal);
    const net        = _taxJod(inv.total);

    sumGross += gross; sumDiscount += discount; sumInsurance += insurance; sumNet += net;

    const monthKey = invDate.slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { gross:0, discount:0, insurance:0, net:0, paid:0, patients:new Set(), visits:0 };
    const bm = byMonth[monthKey];
    bm.gross += gross; bm.discount += discount; bm.insurance += insurance; bm.net += net;
    if (inv.patientId) bm.patients.add(inv.patientId);

    const docKey = inv.docName || 'غير محدد';
    if (!byDoctor[docKey]) byDoctor[docKey] = { gross:0, discount:0, insurance:0, net:0, invoices:0 };
    byDoctor[docKey].gross += gross; byDoctor[docKey].discount += discount;
    byDoctor[docKey].insurance += insurance; byDoctor[docKey].net += net; byDoctor[docKey].invoices++;

    if (!inv.nationalInvoiceNumber) {
      taxFlags.push({ type: 'Missing invoice information', invId, patient: inv.patientName || '-', note: 'لا يوجد رقم فوترة وطنية (nationalInvoiceNumber) — راجع جاهزية الربط مع نظام الفوترة الوطني' });
    }
    if (inv.status === 'pending_review' || inv.financialBlocked) {
      taxFlags.push({ type: 'Potential duplicate / under review', invId, patient: inv.patientName || '-', note: 'الفاتورة موسومة بمراجعة مالية داخلية (financialBlocked/pending_review)' });
    }

    (inv.items || []).forEach(item => {
      if (item && item.department === 'dental') {
        dentalItems.push({ invId, invDate, patientName: inv.patientName, docName: inv.docName, tooth: item.tooth || '-', name: item.name, price: _taxJod(item.price), gross: _taxJod(item.grossPrice), discount: _taxJod(item.discountAmount), insurance: _taxJod(item.insuranceAmount) });
      }
    });
  });

  const periodPayments = [];
  Object.entries(transactionsAll).forEach(([txId, tx]) => {
    if (!tx || tx.status === 'voided') return;
    const txDate = _taxToJordanDate(tx.timestamp || tx.serverTime);
    if (!txDate || !_taxInRange(txDate, periodFrom, periodTo)) return;
    const amt = (tx.type === 'PAYMENT' ? 1 : (tx.type === 'REVERSAL' ? -1 : 0)) * (parseFloat(tx.amount) || 0);
    sumPaidInPeriod += amt;
    const inv = invoicesAll[tx.invoiceId] || {};
    periodPayments.push({ txId, date: txDate, patientId: tx.patientId, patientName: inv.patientName || '-', invId: tx.invoiceId, type: tx.type, amount: _taxJod(tx.amount), reason: tx.reason || '-', actorId: tx.actorId || '-' });
    const monthKey = txDate.slice(0, 7);
    if (byMonth[monthKey]) byMonth[monthKey].paid += amt;
  });

  let totalOutstanding = 0;
  allOpenInvoices.forEach(([invId, inv]) => {
    const rem = (parseFloat(inv.total) || 0) - _taxCalcPaidForInvoice(invId, transactionsAll);
    totalOutstanding += Math.max(rem, 0);
  });

  const periodInvoicesNetSum = sumNet;
  const periodInvoicesPaidSum = periodInvoices.reduce((s, x) => s + x.paid, 0);
  const periodInvoicesOutstanding = periodInvoices.reduce((s, x) => s + Math.max((parseFloat(x.inv.total)||0) - x.paid, 0), 0);
  const reconDiff = _taxJod(periodInvoicesNetSum - (periodInvoicesPaidSum + periodInvoicesOutstanding));
  const reconStatus = Math.abs(reconDiff) < 0.01 ? 'MATCHED' : (Math.abs(reconDiff) < 1 ? 'WARNING' : 'MISMATCH');

  const wsTax = wb.addWorksheet('التقرير الضريبي والمالي', { views: [{ rightToLeft: true }] });
  wsTax.getColumn('A').width = 28;
  wsTax.getColumn('B').width = 22;
  wsTax.getColumn('C').width = 22;
  wsTax.getColumn('D').width = 22;
  wsTax.getColumn('E').width = 22;
  wsTax.getColumn('F').width = 22;

  let r = 1;
  const addTitle = (text, color) => {
    wsTax.mergeCells(`A${r}:F${r}`);
    const c = wsTax.getCell(`A${r}`);
    c.value = text;
    c.font = { name: 'Tajawal', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color || 'FF1E293B' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    wsTax.getRow(r).height = 24;
    r += 1;
  };
  const addRow = (cells) => {
    const row = wsTax.getRow(r);
    row.values = cells;
    styleDataRow(row);
    r += 1;
    return row;
  };
  const addNote = (text) => {
    wsTax.mergeCells(`A${r}:F${r}`);
    const c = wsTax.getCell(`A${r}`);
    c.value = text;
    c.font = { name: 'Tajawal', size: 10, italic: true, color: { argb: 'FF64748B' } };
    c.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
    r += 1;
  };

  addTitle('تقرير دعم ضريبي ومالي — Tax & Financial Support Report (ليس إقرارًا ضريبيًا رسميًا)', 'FF7C2D12');
  addRow(['اسم العيادة', settings.name || '-']);
  addRow(['نوع العيادة / التخصص المسجَّل', settings.specialty === 'dentistry' ? 'طب الأسنان (dentistry)' : (settings.specialty ? settings.specialty : 'طب عام (افتراضي — لا يوجد settings.specialty محدد)')]);
  addRow(['الفترة من', periodFrom === '0000-01-01' ? 'بداية السجلات' : periodFrom]);
  addRow(['الفترة إلى', periodTo]);
  addRow(['تاريخ إصدار التقرير', new Date().toLocaleString('ar-JO', { timeZone: 'Asia/Amman' })]);
  addRow(['الرقم الضريبي المسجَّل بالنظام', (Object.values(invoicesAll)[0] || {}).taxNumber || 'غير مسجَّل بأي فاتورة']);
  r += 1;

  addTitle('B — الملخص التنفيذي للفترة المحددة');
  addRow(['المؤشر', 'القيمة']);
  addRow(['عدد المرضى النشطين بالفترة', Object.keys(patientActivity).length]);
  addRow(['عدد الزيارات بالفترة', Object.values(patientActivity).reduce((s, p) => s + p.visitCount, 0)]);
  addRow(['عدد الفواتير الصادرة بالفترة', periodInvoices.length]);
  addRow(['الإيراد الإجمالي (قبل خصم/تأمين)', sumGross.toFixed(3) + ' د.أ']);
  addRow(['الخصومات', sumDiscount.toFixed(3) + ' د.أ']);
  addRow(['التأمين', sumInsurance.toFixed(3) + ' د.أ']);
  addRow(['الإيراد الصافي (بعد خصم وتأمين)', sumNet.toFixed(3) + ' د.أ']);
  addRow(['المقبوض نقدًا/فعليًا خلال الفترة', sumPaidInPeriod.toFixed(3) + ' د.أ']);
  addRow(['الرصيد المستحق الكلي (لحظي، لكل الفواتير المفتوحة)', totalOutstanding.toFixed(3) + ' د.أ']);
  addNote('⚠️ "المقبوض خلال الفترة" و"الرصيد المستحق الكلي" مقياسان مختلفان: الأول محصور بحركات دفع صارت بهذه الفترة بالضبط (حتى لو على فاتورة قديمة)، والثاني رصيد لحظي لكل الفواتير المفتوحة بالنظام كله بغض النظر عن الفترة — لا تجمعهما مع بعض.');
  r += 1;

  addTitle('C — الملخص الشهري');
  addRow(['الشهر', 'عدد المرضى', 'الإجمالي', 'الخصومات', 'التأمين', 'الصافي']);
  Object.keys(byMonth).sort().forEach(m => {
    const bm = byMonth[m];
    addRow([m, bm.patients.size, bm.gross.toFixed(3), bm.discount.toFixed(3), bm.insurance.toFixed(3), bm.net.toFixed(3)]);
  });
  if (!Object.keys(byMonth).length) addNote('لا توجد فواتير مسجَّلة ضمن هذه الفترة.');
  r += 1;

  addTitle('C.1 — الإيراد حسب الطبيب');
  addRow(['الطبيب', 'عدد الفواتير', 'الإجمالي', 'الخصومات', 'التأمين', 'الصافي']);
  Object.entries(byDoctor).forEach(([doc, v]) => {
    addRow([doc, v.invoices, v.gross.toFixed(3), v.discount.toFixed(3), v.insurance.toFixed(3), v.net.toFixed(3)]);
  });
  r += 1;

  addTitle('D — النشاط المالي لكل مريض خلال الفترة');
  addRow(['المريض', 'رقم الملف الطبي (MRN)', 'أول زيارة', 'آخر زيارة', 'عدد الزيارات', 'الأطباء']);
  Object.entries(patientActivity).forEach(([uid, pa]) => {
    const info = (patients[uid] && patients[uid].info) || {};
    addRow([info.name || uid, info.mrn || '-', pa.firstVisit, pa.lastVisit, pa.visitCount, Array.from(pa.doctors).join('، ') || '-']);
  });
  if (!Object.keys(patientActivity).length) addNote('لا يوجد مرضى لديهم زيارة مسجَّلة ضمن هذه الفترة.');
  r += 1;

  addTitle('E — سجل المدفوعات (Payment Ledger)');
  addRow(['التاريخ', 'المريض', 'رقم الفاتورة', 'النوع', 'المبلغ', 'السبب/المرجع']);
  periodPayments.sort((a, b) => a.date < b.date ? -1 : 1).forEach(p => {
    const row = addRow([p.date, p.patientName, p.invId, p.type === 'PAYMENT' ? 'دفعة' : 'استرجاع/عكس', p.amount.toFixed(3), p.reason]);
    if (p.type === 'REVERSAL') row.getCell(4).font = { color: { argb: 'FFEF4444' }, bold: true };
  });
  if (!periodPayments.length) addNote('لا توجد مدفوعات مسجَّلة ضمن هذه الفترة.');
  r += 1;

  addTitle('F — المصاريف والسجلات المالية');
  addNote('لا يوجد حاليًا مسار بيانات مخصص للمصاريف (Expenses) داخل نظام ARGON — تحقّقنا من كامل قاعدة البيانات ولم نجد مسار "expenses" مسجَّلاً. هذا القسم غير متوفر بصدق (Not Available)، وليس صفرًا محسوبًا. يُرجى تزويد المحاسب بسجل المصاريف من مصدر خارجي حتى تتوفر هذه الميزة داخل ARGON.');
  r += 1;

  addTitle('G — التسوية المحاسبية (Reconciliation)', reconStatus === 'MATCHED' ? 'FF166534' : (reconStatus === 'WARNING' ? 'FFB45309' : 'FF991B1B'));
  addRow(['صافي فواتير الفترة', periodInvoicesNetSum.toFixed(3) + ' د.أ']);
  addRow(['مدفوعات فواتير الفترة (بأي وقت)', periodInvoicesPaidSum.toFixed(3) + ' د.أ']);
  addRow(['المستحق الناتج عن فواتير الفترة', periodInvoicesOutstanding.toFixed(3) + ' د.أ']);
  const statusRow = addRow(['حالة التسوية', reconStatus, 'الفرق', reconDiff.toFixed(3) + ' د.أ']);
  statusRow.getCell(2).font = { bold: true, color: { argb: reconStatus === 'MATCHED' ? 'FF166534' : (reconStatus === 'WARNING' ? 'FFB45309' : 'FF991B1B') } };
  addNote('التسوية تتحقق أن: صافي الفواتير = (ما تم تحصيله من هذه الفواتير + ما تبقى مستحقًا عليها)، بمعزل عن توقيت الدفعة الفعلي. فرق كبير (MISMATCH) يستدعي مراجعة يدوية قبل اعتماد الأرقام.');
  r += 1;

  addTitle('H — بنود تحتاج مراجعة ضريبية/محاسبية (Tax Review Flags)', 'FFB45309');
  addRow(['النوع', 'رقم الفاتورة', 'المريض', 'ملاحظة']);
  taxFlags.forEach(f => addRow([f.type, f.invId, f.patient, f.note]));
  if (!taxFlags.length) addNote('لا توجد بنود مُعلَّمة للمراجعة ضمن هذه الفترة.');
  r += 1;

  if (dentalItems.length) {
    addTitle('I — تفصيل إجراءات الأسنان (المصدر: بنود الفواتير department=dental)', 'FF1D4ED8');
    addRow(['التاريخ', 'المريض', 'الطبيب', 'رقم السن (FDI)', 'الإجراء', 'الإجمالي', 'الخصم', 'التأمين', 'الصافي']);
    dentalItems.sort((a, b) => a.invDate < b.invDate ? -1 : 1).forEach(d => {
      addRow([d.invDate, d.patientName, d.docName, d.tooth, d.name, d.gross.toFixed(3), d.discount.toFixed(3), d.insurance.toFixed(3), d.price.toFixed(3)]);
    });
    addNote('مصدر الحقيقة هنا هو بند الفاتورة (department=\'dental\')، وهو مختلف عن السجل السريري "dental_history" — لا اعتماد على الأخير هنا لمنع أي احتساب مضاعف (Section 18).');
  } else {
    addTitle('I — إجراءات الأسنان', 'FF1D4ED8');
    addNote('لا توجد بنود فوترة بقسم "أسنان" مسجَّلة ضمن هذه الفترة.');
  }
  r += 1;

  addTitle('ملاحظة قانونية مهمة', 'FF7C2D12');
  addNote('هذا التقرير أداة دعم إداري ومحاسبي فقط، وليس الإقرار الضريبي الرسمي ولا نموذجًا معتمدًا من دائرة ضريبة الدخل والمبيعات (ISTD). الأرقام مشتقة مباشرة من سجلات ARGON دون أي افتراض قانوني. لا تُستخدم أي نسبة ضريبية أو معالجة قانونية بهذا التقرير إلا بعد تأكيد محاسب/مستشار ضريبي مرخَّص، خصوصًا فيما يتعلق بالمعالجة الضريبية الخاصة بالإجراءات السنية أو أي بند مُعلَّم "TAX REVIEW REQUIRED".');
}
