# TAX REPORT SURGICAL IMPLEMENTATION REPORT

بُني بعد فحص فعلي كامل لـ `excel-export.js` و`billing-engine.js` (لا افتراض)، بحث رسمي حقيقي بمصادر ISTD الأردنية، وGolden Dataset Test فعلي بـ Node — النتائج بالأسفل حرفياً.

---

## ⚠️ اكتشاف حرج يجب معرفته قبل أي شي — اقرأه أولاً

**`excel-export.js` بالكامل غير مُحمَّل بأي صفحة حية بالنظام حالياً.** فحصت: صفر `<script src="excel-export.js">` بأي ملف HTML، وصفر استدعاء لـ `exportProfessionalExcel()` من أي مكان. يعني ميزة التصدير **الحالية بالكامل (الشيتات الخمسة القديمة + إضافتي الجديدة) غير قابلة للوصول فعلياً من أي مستخدم اليوم** — نفس وضع `argon-nid-security.js` اللي لقيناه سابقاً (كود حقيقي، صفر تفعيل).

هذا **خارج نطاق هذه المهمة تحديداً** (المطلوب تعديل `excel-export.js` فقط، سطر ٣٣) فما لمسته ولا أضفت `<script>` tag ولا زر تفعيل — بس لازم تعرف: حتى لو كل شي تحت مضبوط ١٠٠٪، **لازم توصلني بملف/زر التفعيل الفعلي بعدين** (نفس نمط ملف `DEPLOY_PATCH.md` يلي شفناه بالجلسة التانية) عشان يصير الفيتشر قابل للاستخدام فعلياً. مسجَّلة تحت **OUT OF SCOPE** رسمياً بالأسفل.

---

## 1. What Was Added

تبويبة إكسل جديدة "التقرير الضريبي والمالي" — قسم واحد جديد بالكامل (Sections A–I) فوق ملف التصدير الموجود، صفر تعديل على الشيتات الخمس الحالية.

## 2. Exact Files Modified

`excel-export.js` فقط — لا ملف آخر لُمس (تحقق: `billing-engine.js`, `firebase-rules.json`, `dashboard.html` — صفر تعديل).

## 3. Exact Functions Added

`_taxToJordanDate(value)`, `_taxInRange(dateStr, from, to)`, `_taxJod(n)`, `_taxCalcPaidForInvoice(invId, transactions)`, `addTaxComplianceWorksheet(wb, data, styleHeader, styleDataRow, fromDate, toDate)`.

## 4. Exact Functions Modified

`exportProfessionalExcel()` — تعديل التوقيع فقط (إضافة معاملين اختياريين) + سطر استدعاء واحد جديد قبل `writeBuffer`. **صفر سطر من الشيتات الخمس القديمة تغيّر.**

---

## الباتش الجاهز للّصق

### أ) `excel-export.js` — تعديل التوقيع (سطر ٤)

**الحالي:**
```js
async function exportProfessionalExcel() {
```
**الاستبدال:**
```js
async function exportProfessionalExcel(fromDate = null, toDate = null) {
```
*(بدون تغيير أي استدعاء موجود — الاستدعاء الحالي `exportProfessionalExcel()` بدون معاملات يستمر يعمل تماماً كالسابق، لأنه ما فيه أي استدعاء حقيقي أصلاً بالنظام كما وضّحت أعلاه.)*

### ب) استدعاء الدالة الجديدة — سطر واحد فقط، قبل "Generate File"

**الحالي:**
```js
    // 3. Generate File and Trigger Download
    const buffer = await wb.xlsx.writeBuffer();
```
**الاستبدال:**
```js
    // 3. Tax & Financial Support Report (إضافي — Section 32)
    addTaxComplianceWorksheet(wb, data, styleHeader, styleDataRow, fromDate, toDate);

    // 4. Generate File and Trigger Download
    const buffer = await wb.xlsx.writeBuffer();
```

### ج) الكود الكامل — يُضاف بنهاية الملف (بعد إغلاق `exportProfessionalExcel`)

```js
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
```

---

## 5. Data Sources Used (كلها فُحصت مباشرة بالكود، صفر تخمين)

| البيان | المصدر الحقيقي |
|---|---|
| نشاط المريض/تواريخ الزيارة | `patients/{id}/visits/{visitId}.date` |
| الإيراد/الخصم/التأمين | `invoices/{id}.grossTotal/discountTotal/insuranceTotal/total` |
| المدفوعات/الاسترجاع | `financial_transactions/{id}` (type: PAYMENT/REVERSAL) |
| المستحق | `invoice.total − calcPaid()` — نفس صيغة `billing-engine.js:recordBillingPayment` حرفياً |
| إجراءات الأسنان | `invoice.items[].department === 'dental'` (+ `tooth`) |
| جاهزية الفوترة الوطنية | `invoice.nationalInvoiceNumber` / `taxNumber` (حقول موجودة أصلاً بالنظام) |

## 6-9. Revenue / Payment / Visit / Dental Source of Truth

مذكورة بالجدول أعلاه بالضبط — **مصدر واحد لكل رقم**، صفر ازدواج (Section 18 محقَّقة، انظر Golden Test أدناه).

## 10. Tax Rules Verified From Official Sources

بحثت فعلياً (٣ عمليات بحث ويب منفصلة، مصادر ISTD ومتعددة مستقلة):

| القاعدة | التصنيف | المصدر |
|---|---|---|
| تسجيل الأطباء/النقابات المهنية إلزامي بنظام الفوترة الوطني الإلكتروني (JoFotara) | **A — Verified by Official Source** | إشارات مباشرة لموقع ISTD الرسمي + تغطية إخبارية لقرار إلزام النقابات المهنية |
| خدمات العيادات/المستشفيات المرخَّصة معفاة من ضريبة المبيعات العامة | **B — مدعومة بعدة مصادر مستقلة، لم تُتحقَّق من النص القانوني الأساسي مباشرة بهذه الجلسة** | مصادر متعددة تشير لقانون ضريبة المبيعات العامة رقم ٦ لسنة ١٩٩٤ وتعديلاته |
| ضريبة الدخل للأطباء/المهن الحرة: شرائح تصاعدية على الدخل الشخصي (٥٪–٣٠٪ حسب المصادر)، **ليست نسبة ثابتة على مستوى العيادة** | **B** | مواقع حاسبة ضريبة أردنية متعددة |
| وجود خلاف/نقاش فعلي وموثَّق بين نقابة أطباء الأسنان ودائرة ضريبة الدخل حول معالجة ضريبية خاصة | **A — مؤكَّد وجوده كخبر** (تفاصيل التسوية نفسها لم تُتحقَّق بعمق) | خبر إخباري مباشر بعنوان "حل خلاف جذري بين نقابة أطباء الأسنان ودائرة ضريبة الدخل" |

## 11. Tax Rules NOT Assumed

**لم أكتب أي نسبة ضريبية بالكود إطلاقاً.** لا 16%، لا أي رقم. التقرير كله أرقام دعم (Gross/Net/Paid/Outstanding) بدون أي حساب "ضريبة مستحقة" — هذا مقصود ومباشر بند ٣٩/١٣ من طلبك، ومؤكَّد إضافياً بوجود الخلاف الحقيقي الموثَّق بالبند السابق (لا أحد يقدر يفترض معالجة موحّدة).

## 12. New Excel Worksheets

شيت واحد جديد: **"التقرير الضريبي والمالي"** — بأقسام A إلى I داخله (وليس ٩ شيتات منفصلة، حفاظاً على البساطة وسهولة القراءة — قرار تصميم مبرَّر، يمكن تقسيمه لشيتات منفصلة لاحقاً لو احتجت).

## 13. Date Range Behavior

`fromDate`/`toDate` اختياريان (`YYYY-MM-DD`)، Inclusive بالكامل (مؤكَّد بـ Golden Test). بدون تمريرهما: من بداية السجلات لليوم — نفس سلوك عدم-الكسر المطلوب.

## 14-15. Patient-Level / Payment-Level Report

Section D و E أعلاه — مبنية بالكامل من snapshot واحد، صفر استعلام إضافي لكل مريض (Section 25 محقَّقة).

## 16. Outstanding Balance Logic

`Math.max(invoice.total − calcPaid(), 0)` — لحظي دائماً، غير مرتبط بالفترة (موثَّق بالملاحظة داخل الشيت نفسه لمنع لخبطة المستخدم).

## 17. Reconciliation Logic

`صافي فواتير الفترة = مدفوعات هذه الفواتير (بأي وقت) + المستحق الناتج عنها`. حالة `MATCHED`/`WARNING`/`MISMATCH` معروضة صراحة بالشيت.

## 18. Dental-specific Logic

مصدر واحد فقط (`invoice.items[department=dental]`) — **ليس** `dental_history` (السجل السريري من الجلسة التانية) — تفادياً للازدواج، موثَّق بالكود والشيت.

## 19. Performance Impact

صفر استعلام Firebase إضافي — كله من نفس `data` الموجود مسبقاً (Section 25 محقَّقة، تأكَّدت بقراءة الكود قبل الكتابة).

## 20. Privacy Considerations

لا تشخيص، لا ملاحظات سريرية، لا حساسيات — فقط بيانات مالية/إدارية (اسم، MRN، تاريخ، مبلغ). Section 23 محقَّقة.

## 21. Existing Functionality Preserved

صفر سطر تغيّر بالشيتات الخمس القديمة — تحققت بمقارنة نصية مباشرة.

## 22. Regression Test Results — Golden Dataset (Section 37/38)، **تشغيل حقيقي بـ Node**

```
TEST 1: فاتورة ملغاة مُستثناة من كل الحسابات → PASS
TEST 2: مجموع Gross/Discount/Net للفترة صحيح (220/15/205) → PASS
TEST 3: دفعة voided تُتجاهل كليًا من حساب المدفوع → PASS
TEST 4: دفعة كاملة + استرجاع كامل = صافي مدفوع صفر → PASS
TEST 5: الرصيد المستحق الكلي = 150 → PASS (بعد تصحيح خطأ حسابي بتوقعي الشخصي، ليس بالكود — موثَّق بالأسفل)
TEST 6: تسوية فواتير الفترة → MATCHED, Diff=0 → PASS
TEST 7: بنود الأسنان (2 بند من فاتورة واحدة، صفر ازدواج) → PASS
TEST 8: مريض بزيارة موجودة لكن فاتورة ملغاة → يظهر بالنشاط السريري صح → PASS
TEST 9: زيارة خارج نطاق الشهر المطلوب لا تُحسب → PASS
```
**9/9 PASS.**

**أمانة مهمة:** أول تشغيل لـ TEST 5 فشل (توقعت ٩٠، الكود أعطى ١٥٠). رجعت وحسبتها يدوياً بدقة ولقيت **توقعي أنا كان غلط** (فاتورة مدفوعة بالكامل ثم مُسترجَعة بالكامل ترجع مستحقة بكامل قيمتها، لا صفر — هذا منطقي وصحيح). صحّحت التوقع وأعدت التشغيل. **الكود كان صحيحاً من البداية، الخطأ كان بتوقعي أنا فقط** — أذكر هذا بصراحة بدل إخفائه.

## 23. Known Limitations

1. **`excel-export.js` غير مُفعَّل بأي صفحة حالياً (انظر الاكتشاف الحرج أعلاه).**
2. لا يوجد Date Range Picker بواجهة المستخدم — الدالة تقبل المعاملين برمجياً، لكن ربطهما بحقلي تاريخ فعليين بالواجهة **لم يُطلب صراحة** (بند ٥ سمح بعدم إضافة واجهة لو غير ضروري، وبما إنه الملف كله غير مفعَّل أصلاً، ما بنيت واجهة لشي مش موصول).
3. تصنيف "المصاريف المقبولة ضريبياً" (Section 12) غير مطبَّق — **لأنه لا يوجد أصلاً مسار بيانات مصاريف بـ ARGON** (تحقَّقت، صفر نتيجة).
4. الإعفاء الضريبي على خدمات العيادات مصنَّف B لا A — يحتاج تأكيد محاسب لعيادتك تحديداً (خصوصاً مع الخلاف الموثَّق حول أطباء الأسنان تحديداً).

## 24. OUT OF SCOPE Findings

- **`excel-export.js` بالكامل orphaned/غير محمَّل بأي HTML.** (الأهم)
- لم ألاحظ أي bug إضافي غير مرتبط أثناء هذا العمل تحديداً (الملف صغير ومركّز، ٢٥٠ سطر فقط).

## 25. Final Verdict

**PASS WITH KNOWN LIMITATION**

كل الشيتات الخمس القديمة سليمة (صفر تعديل)، التقرير الجديد يعمل ويُصالح بشكل صحيح على بيانات اختبار حقيقية (9/9)، صفر قاعدة ضريبية مُخترَعة، صفر ازدواج بالأسنان، صفر استعلام إضافي. القيد الوحيد الحقيقي: **الميزة كلها (قديمها وجديدها) غير قابلة للوصول فعلياً لحد ما يتربط `excel-export.js` بزر/صفحة حقيقية** — هذا خارج نطاق طلبك المحدَّد لهذه المهمة (تعديل الملف نفسه فقط)، فوثّقته ولم أتجاوزه.
