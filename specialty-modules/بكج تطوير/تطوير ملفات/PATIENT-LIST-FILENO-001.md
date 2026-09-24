# PATIENT-LIST-FILENO-001 — بحث وعرض "رقم الملف" بقائمة المرضى

**الملف الوحيد المتأثر:** `emr-app.js`

## ✅ تأكيد ١ — "رقم الملف" اختياري بالفعل، صفر تغيير مطلوب

فحصت كل مكان بيكتب `fileNumber` (`saveNewPatient`, `saveEditPatient`, تحويل حجز لمريض) — **صفر تحقق إلزامي بأي مكان**. لو العيادة ما بدها تستخدمه، بيظل `null` بهدوء، صفر رسالة خطأ، صفر تعطيل حفظ. لو عيادة معينة بدها تعتمده، تكتبه بس بنموذج المريض وخلص — النظام أصلاً جاهز للحالتين بدون أي كود جديد.

## ⚠️ اكتشاف مهم لازم تعرفه — "رقم الملف" غير "الرقم الطبي (MRN)"

فحصت وطلع فيه **حقلين مختلفين تماماً** بالنظام، وممكن يلخبطوا بعض:

| الحقل | مين يحدده | مثال | وين يظهر حالياً |
|---|---|---|---|
| `info.mrn` (الرقم الطبي) | **النظام تلقائياً** عند إنشاء أي مريض جديد (`genMRN()`) | `MRN-483920` | قائمة المرضى (سطر ٨٧٢)، ملف المريض، فاتورة الواتساب |
| `info.fileNumber` (رقم الملف) | **الموظف يكتبه يدوياً** — مخصص لرقم الملف الورقي القديم | أي نص تحدده العيادة | ملف المريض فقط (سطر ٢٢٦٦)، وحجوزات (بعد `BOOKING-FILENO-BADGE-001`) |

يعني `fileNumber` **مش موجود أصلاً بقائمة المرضى** (لا بحث ولا عرض) — هذا الفرق يلي طلبت إضافته.

## التعديل ١ — إضافة البحث (`filterPatients()`)

**الحالي:**
```js
    return (info.phone || '').includes(q)
      || (info.name || '').toLowerCase().includes(q)
      || (info.mrn || '').toLowerCase().includes(q)
      || (info.nationalId || '').toLowerCase().includes(q)
      || uid.includes(q);
```

**الاستبدال:**
```js
    return (info.phone || '').includes(q)
      || (info.name || '').toLowerCase().includes(q)
      || (info.mrn || '').toLowerCase().includes(q)
      || (info.fileNumber || '').toLowerCase().includes(q)
      || (info.nationalId || '').toLowerCase().includes(q)
      || uid.includes(q);
```

## التعديل ٢ — إضافة شارة العرض (`renderPatientsList()`)

**الحالي:**
```js
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <div class="plist-mrn">${info.mrn || 'MRN-NEW'}</div>
          ${_nidStatus}
        </div>
```

**الاستبدال:**
```js
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <div class="plist-mrn">${info.mrn || 'MRN-NEW'}</div>
          ${info.fileNumber ? `<div class="plist-mrn" style="background:rgba(14,165,233,0.1);color:var(--sky,#0ea5e9)"><i class="fas fa-folder-open" style="font-size:.7rem"></i> ${sanitize(info.fileNumber)}</div>` : ''}
          ${_nidStatus}
        </div>
```

- استخدمت نفس كلاس `plist-mrn` الموجود (نفس شكل/حجم الشارة الحالية) بس بلون مختلف (سماوي) عشان يتميّز بصرياً عن الرقم الطبي التلقائي — بدون تعريف CSS class جديد.
- محروس بـ`info.fileNumber ?` — مرضى ما فيهم رقم ملف (الأغلبية، خصوصاً القدامى) **ما بيظهر عندهم أي شي جديد**، صفر كسر.

## جدول الأثر

| ID | التغيير | خطر | Migration |
|---|---|---|---|
| PATIENT-LIST-FILENO-001a | بحث `fileNumber` بقائمة المرضى | منخفض جداً | لا |
| PATIENT-LIST-FILENO-001b | شارة عرض `fileNumber` بكارد المريض | منخفض جداً | لا |

**لا تعديل على:** `saveNewPatient`, `saveEditPatient`, `genMRN()`, أي مسار Firebase، أي شرط إلزامي.

## اختبار

1. مريض بدون `fileNumber` → الكارد يبدو تماماً كالسابق، صفر شارة زايدة.
2. مريض عنده `fileNumber` → تظهر شارة سماوية بجانب MRN، تحمل نص رقم الملف.
3. اكتب رقم الملف بمربع البحث الرئيسي بقائمة المرضى → المريض يظهر بالنتائج.
4. أنشئ مريض جديد بدون تعبئة حقل رقم الملف → يُحفظ بنجاح بدون أي رسالة خطأ (تأكيد إنه اختياري فعلياً).
