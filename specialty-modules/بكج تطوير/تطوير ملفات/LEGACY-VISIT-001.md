# LEGACY-VISIT-001 — توثيق سجل قديم من الملف الورقي (Legacy Paper History Entry)

**Repo:** argonforfun-source/clinica-system
**File:** `emr-app.js`
**Status:** Code verified against actual repo (cloned & inspected). Not yet applied.
**Risk:** Low — pure addition, zero edits to `saveVisit()`, zero Firebase Rules change.

**تحديث v1.1:** بناءً على تأكيدك إنه دقة "من عالج المريض فعلياً" + إدخال سجل مرضي كامل لكل مريض قديم مهمة — أضفت (١) حقل اسم الطبيب المعالج الحقيقي وقت العلاج (نصي قابل للتعديل، مش Dropdown — لأنه فحصت وقائمة أطباء العيادة `_docs` غير محمَّلة أصلاً بسكوب `emr-app.js`، ولأنه الطبيب التاريخي ممكن ما يكون موجود بالنظام كموظف حالي أساساً)، و(٢) وضع "حفظ وإضافة سجل آخر" بدون إغلاق النافذة، عشان توثيق كل تاريخ المريض القديم (زيارات متعددة) بجلسة واحدة متواصلة بدل فتح النافذة من الصفر كل مرة.

---

## 1. المشكلة الحقيقية (مُتحقّق منها بالكود)

`saveVisit()` (السطر 3485) هي الدالة الوحيدة اللي بتكتب زيارة بملف المريض، وهي:

1. بتفرض `date: new Date().toLocaleDateString('en-CA')` — **دايماً تاريخ اليوم**، ما فيه أي حقل لتغييره.
2. عند الحفظ بتولّد تلقائياً:
   - وصفة دوائية بمسار `prescriptions/{id}` + إشعار للصيدلي
   - طلب مخبر بمسار `lab_orders/{id}`
   - طلب أشعة
   - **فاتورة جديدة** بمسار `invoices/{id}` بسعر كشفية الطبيب (السطر ~3662)
   - إغلاق الحجز من غرفة الانتظار

يعني: لو استخدمنا `saveVisit()` نفسها لتوثيق سجل قديم، رح تنفتح فاتورة جديدة وطلب صيدلية/مخبر لشي صار من سنين ودُفع ثمنه على الورق فعلاً — هاي مشكلة مالية وتشغيلية حقيقية، مش مجرد تفصيل.

**القرار:** دالة جديدة منفصلة كلياً، لا تلمس `saveVisit()` ولا الحقول المشتركة (`rxItems`, `labTestsList`, `radScansList`).

---

## 2. أين تُخزَّن — بدون أي مسار جديد

نفس المسار الموجود: `clinics/{clinicId}/patients/{patientId}/visits/{visitId}`

السبب: `generatePatientFileHTML()` (السطر 2213) بترتّب وبتعرض أي عنصر تحت `p.visits` تلقائياً بالاعتماد على حقلي `date` و`time` فقط — فمش لازم تعديل أي كود عرض تاريخ المريض. القيد الوحيد المطلوب: **قواعد الأمان الحالية بـ `firebase-rules.json` (سطر 119-131) بالفعل تسمح بكتابة زيارة جديدة لأي موظف بالعيادة (`!data.exists()`) — فمش لازم أي تعديل على firebase-rules.json**. هاي نقطة مهمة لأنها تلافي بالضبط النوع من الخطأ اللي صار بحادثة `clinic_auth_map` (تعديل Rules بدون داعي).

---

## 3. الحقول الجديدة على كائن الزيارة (إضافية فقط)

| حقل | القيمة | السبب |
|---|---|---|
| `origin` | `'legacy_paper_entry'` | يميّزها عن الزيارات الحيّة — نفس الاصطلاح المستخدم أصلاً بقائمة الحساسية/الأمراض المزمنة (`addedBy: 'Legacy'`) |
| `date` | يختارها الطبيب (لا تتجاوز اليوم) | بدل `new Date()` الثابت |
| `enteredBy` / `enteredByName` | من الجلسة الحالية | من وثّق السجل ومتى (وقت التوثيق الحقيقي، مختلف عن تاريخ الحدث) |
| `enteredAt` | `new Date().toISOString()` | audit trail |

---

## 4. الكود — FILE: emr-app.js

### 4.1 زر جديد بجانب "بدء زيارة طبية" (بعد السطر 2522 مباشرة)

**الكود الحالي (سطر 2521-2523):**
```js
          <button class="btn-secondary btn-sm" onclick="openEditPatient('${uid}')"><i class="fas fa-edit"></i> تعديل</button>
          <button class="btn-primary btn-sm" onclick="sw('newVisit');loadVisitForm('${uid}')"><i class="fas fa-stethoscope"></i> بدء زيارة طبية</button>
        </div>
```

**الاستبدال:**
```js
          <button class="btn-secondary btn-sm" onclick="openEditPatient('${uid}')"><i class="fas fa-edit"></i> تعديل</button>
          <button class="btn-primary btn-sm" onclick="sw('newVisit');loadVisitForm('${uid}')"><i class="fas fa-stethoscope"></i> بدء زيارة طبية</button>
          <button class="btn-outline btn-sm" onclick="openLegacyVisitForm('${uid}')" title="لتوثيق زيارة/إجراء قديم من الملف الورقي — لا يفتح فاتورة ولا طلب صيدلية/مخبر"><i class="fas fa-file-medical-alt"></i> توثيق من الملف الورقي</button>
        </div>
```

### 4.2 دالتان جديدتان كلياً — تُضافان بعد إغلاق `saveVisit()` (بعد السطر ~3690، بعد `.catch(...)` الخاصة بـ saveVisit)

```js
// ════════════════════════════════════════════════════════════════
// LEGACY-VISIT-001 — توثيق سجل قديم من الملف الورقي
// لا تلمس saveVisit() ولا rxItems/labTestsList/radScansList
// لا تفتح فاتورة، لا طلب صيدلية، لا طلب مخبر/أشعة، لا إشعارات
// ════════════════════════════════════════════════════════════════

function openLegacyVisitForm(uid) {
  const p = _patients[uid];
  if (!p) { toast('⚠️ لم يتم العثور على المريض', 'err'); return; }

  const old = document.getElementById('_legacyVisitOverlay');
  if (old) old.remove();

  window._legCount = 0; // عدّاد السجلات المضافة بهذه الجلسة (وضع الإدخال المتعدد)
  const session = (typeof ArgonSession !== 'undefined' ? ArgonSession.get() : null) || {};
  const today = new Date().toLocaleDateString('en-CA');
  const overlay = document.createElement('div');
  overlay.id = '_legacyVisitOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:24px;width:min(480px,92vw);max-height:88vh;overflow:auto;direction:rtl;font-family:inherit;">
      <h3 style="margin:0 0 4px;color:#0f172a"><i class="fas fa-file-medical-alt"></i> توثيق سجل قديم من الملف الورقي</h3>
      <p style="font-size:.8rem;color:#64748b;margin:0 0 16px">
        هذا السجل يُضاف لتاريخ المريض فقط. <b>لن</b> تُفتح فاتورة، ولن يُرسل طلب صيدلية/مخبر/أشعة.
      </p>
      <label style="font-size:.8rem;font-weight:700;color:#334155">اسم الطبيب المعالج <u>وقت الإجراء</u> (قابل للتعديل — قد لا يكون موجوداً بالنظام حالياً)</label>
      <input type="text" id="_legDoc" value="${sanitize(session.displayName || '')}" placeholder="اسم الطبيب الحقيقي وقت العلاج" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;margin:4px 0 12px">
      <label style="font-size:.8rem;font-weight:700;color:#334155">تاريخ الإجراء/الزيارة الفعلي</label>
      <input type="date" id="_legDate" max="${today}" value="${today}" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;margin:4px 0 12px">
      <label style="font-size:.8rem;font-weight:700;color:#334155">التشخيص / الإجراء الذي تم (مطلوب)</label>
      <textarea id="_legDiag" rows="2" placeholder="مثال: حشوة ضرس 26، علاج عصب ضرس 36..." style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;margin:4px 0 12px"></textarea>
      <label style="font-size:.8rem;font-weight:700;color:#334155">ملاحظات إضافية (اختياري)</label>
      <textarea id="_legNotes" rows="2" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;margin:4px 0 12px"></textarea>
      <div id="_legCounter" style="font-size:.75rem;color:#0d9488;margin-bottom:10px;display:none"></div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary btn-sm" style="flex:1" onclick="document.getElementById('_legacyVisitOverlay').remove()">إنهاء وإغلاق</button>
        <button class="btn-primary btn-sm" style="flex:1" onclick="saveLegacyVisitRecord('${uid}')"><i class="fas fa-check"></i> حفظ وإضافة سجل آخر</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function saveLegacyVisitRecord(uid) {
  const docName = document.getElementById('_legDoc')?.value.trim();
  const dateVal = document.getElementById('_legDate')?.value;
  const diag    = document.getElementById('_legDiag')?.value.trim();
  const notes   = document.getElementById('_legNotes')?.value.trim();
  const today   = new Date().toLocaleDateString('en-CA');

  if (!diag) { toast('⚠️ التشخيص/الإجراء مطلوب', 'err'); return; }
  if (!dateVal || dateVal > today) { toast('⚠️ التاريخ غير صالح — لا يمكن أن يكون بالمستقبل', 'err'); return; }

  const session  = (typeof ArgonSession !== 'undefined' ? ArgonSession.get() : null) || {};
  const visitId  = db.ref().child('visits').push().key;

  const legacyVisitObj = {
    date: dateVal,
    time: '12:00 م',                 // زمن ثابت افتراضي — السجلات الورقية غالباً بلا وقت دقيق
    docKey: session.staffId || 'legacy',        // الحساب الفعلي المسجّل الآن — للفلترة الداخلية فقط
    docName: docName || 'غير محدد',             // الاسم الحقيقي المعروض بالتايم لاين — قابل للتعديل، قد لا يطابق docKey
    doctorId: session.staffId || 'legacy',
    patientId: uid,
    diagnosis: diag,
    complaint: 'سجل قديم من الملف الورقي',
    notes: notes || '',
    vitals: {},
    prescriptions: [],
    labOrders: [],
    radOrders: [],
    attachments: [],
    origin: 'legacy_paper_entry',
    enteredBy: session.staffId || 'unknown',
    enteredByName: session.displayName || 'غير محدد',
    enteredAt: new Date().toISOString()
  };

  db.ref(`${BASE}/patients/${uid}/visits/${visitId}`).set(legacyVisitObj).then(() => {
    if (typeof ArgonCore !== 'undefined') {
      ArgonCore.logAudit('CREATE_LEGACY_VISIT', `تم توثيق سجل قديم (${dateVal}) للمريض ${uid}`, 'EMR');
    }
    // وضع الإدخال المتعدد: لا تُغلق النافذة — فرّغ التشخيص/الملاحظات فقط وابقِ الطبيب/التاريخ
    // (نفس المريض غالباً عنده أكتر من زيارة قديمة ينبغي توثيقها بجلسة واحدة)
    window._legCount = (window._legCount || 0) + 1;
    document.getElementById('_legDiag').value = '';
    document.getElementById('_legNotes').value = '';
    const cEl = document.getElementById('_legCounter');
    if (cEl) { cEl.style.display = 'block'; cEl.innerHTML = `✅ تم حفظ ${window._legCount} سجل/سجلات لهذا المريض حتى الآن.`; }
    toast('✅ تم الحفظ — أضف السجل التالي أو اضغط "إنهاء وإغلاق"', 'ok');
    refreshPatientFileUI(uid);
  }).catch(() => toast('❌ فشل حفظ السجل القديم', 'err'));
}
```

### 4.3 شارة بصرية بسيطة بالتايم لاين — تمييز السجلات القديمة (تعديل سطر واحد فقط، السطر ~2392)

**الكود الحالي:**
```js
                ${lockBadge}${archiveBadge}
```

**الاستبدال:**
```js
                ${v.origin === 'legacy_paper_entry' ? '<span class="tag" style="background:#f1f5f9;color:#64748b;font-size:.65rem"><i class="fas fa-file-medical-alt"></i> من الملف الورقي</span>' : ''}${lockBadge}${archiveBadge}
```

هذا التعديل إضافي بالكامل: الزيارات القديمة بدون حقل `origin` (كل البيانات الحالية) بتعطي `undefined === 'legacy_paper_entry'` → `false` → نفس السلوك الحالي تماماً، صفر تأثير.

---

## 5. جدول الأثر (Master Manifest Row)

| ID | الملف | الدالة | التغيير | مسار Firebase | Migration | خطر | التحقق |
|---|---|---|---|---|---|---|---|
| LEGACY-VISIT-001a | emr-app.js | زر جديد (سطر 2522) | إضافة زر | — | لا | منخفض | الزر يظهر، يفتح النافذة |
| LEGACY-VISIT-001b | emr-app.js | `openLegacyVisitForm` + `saveLegacyVisitRecord` (دالتان جديدتان) | إضافة كلية | `patients/{id}/visits/{visitId}` (نفس المسار الحالي) | لا | منخفض | انظر القسم 6 |
| LEGACY-VISIT-001c | emr-app.js | شارة التايم لاين (سطر 2392) | تعديل سطر واحد، محروس بشرط | — | لا | منخفض جداً | الزيارات القديمة بلا `origin` لا تتأثر |

**لا تعديل على:** `firebase-rules.json`, `saveVisit()`, `argon-backup.js`, أي حقل مشترك (`rxItems` إلخ). السبب مذكور بكل بند أعلاه.

---

## 6. اختبارات التحقق (يجب تنفيذها فعلياً قبل الاعتماد)

1. **سجل قديم عادي:** افتح ملف مريض قديم → "توثيق من الملف الورقي" → تاريخ قبل سنتين + تشخيص → حفظ.
   - ✅ يظهر بالتايم لاين بترتيب صحيح حسب التاريخ.
   - ✅ يظهر عليه شارة "من الملف الورقي".
   - ✅ تحقق يدوي: **لا** فاتورة جديدة بـ `invoices/`, **لا** سجل بـ `prescriptions/` أو `lab_orders/`, **لا** إشعار جديد بـ `notifications/`.
2. **تاريخ مستقبلي:** حاول اختيار تاريخ بعد اليوم → يجب أن يُرفض بالفرونت (خاصية `max` بالحقل) وبالتحقق بالجافاسكربت أيضاً (طبقة ثانية دفاعية).
3. **زيارة حيّة عادية:** أنشئ زيارة طبيعية بـ `saveVisit()` كالعادة → تأكد ما تأثرت بالتعديل (بدون شارة، فاتورة تُفتح كالمعتاد).
4. **مريض قديم بدون أي حقل `origin`:** افتح ملف مريض عنده زيارات قديمة قبل هذا التحديث → تأكد التايم لاين تعرض بدون أي كسر أو شارة زايدة.
5. **طبيب مختلف عن الحساب المسجّل الآن:** افتح النافذة، بدّل اسم الطبيب المعروض تلقائياً باسم طبيب آخر (حتى لو غير موجود بالنظام) واحفظ → تأكد التايم لاين يعرض الاسم المكتوب بالضبط، لا اسم الحساب الحالي.
6. **إدخال متعدد لنفس المريض:** احفظ سجل أول، تأكد النافذة **ما تسكّرت**، العدّاد ظهر "١ سجل"، وحقلي التشخيص/الملاحظات فضيوا. أضف سجل ثاني بتاريخ مختلف واحفظ → تأكد العدّاد وصل "٢"، وكل سجل ظاهر منفصل صحيح بالتايم لاين بترتيب تاريخه الصحيح.

---

## 7. صلاحية من يقدر يوثّق سجل قديم — محلول

المستخدم أكّد: تُترك مفتوحة لكل موظف بالعيادة (نفس صلاحيات الزيارة العادية الحالية اليوم) — قرار الدكتور/صاحب العيادة يحدد عملياً مين عنده صلاحية دخول، مش بالكود. **صفر تعديل على firebase-rules.json بناءً على هذا القرار.**
