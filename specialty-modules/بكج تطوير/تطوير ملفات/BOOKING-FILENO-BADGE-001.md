# BOOKING-FILENO-BADGE-001 — شارة "رقم الملف" بكل واجهات الحجز

**الملف المتأثر الوحيد:** `dashboard.html`
**فحص شامل:** كل مكان بالكود الحيّ (مش النسخ الاحتياطية بالمجلدات القديمة) بيعرض `patNationalId` — تحقّقت من كل واحد فيهم، فيه فقط **موقعان للعرض + موقع بحث واحد**. صفر مواقع تانية موجودة، صفر افتراض.

لا تعديل على `firebase-rules.json`. لا حقل جديد بقاعدة البيانات — `patFileNo` موجود أصلاً على كائن الحجز (`dashboard.html:4402`).

---

## التعديل ١ — كارد الحجز الحي (شاشة الانتظار/اليوم) — سطر ٣٦٤٦

**الحالي:**
```js
${b.patNationalId ? `<div class="binfo" style="font-family:'IBM Plex Mono',monospace;font-size:.74rem;color:var(--teal)">🪪 ${sanitize(b.patNationalId)}</div>` : `<div class="binfo" style="color:rgba(239,68,68,0.7);font-size:.72rem">⚠️ رقم وطني غير مُسجَّل</div>`}
```

**الاستبدال:**
```js
${b.patNationalId ? `<div class="binfo" style="font-family:'IBM Plex Mono',monospace;font-size:.74rem;color:var(--teal)">🪪 ${sanitize(b.patNationalId)}</div>` : `<div class="binfo" style="color:rgba(239,68,68,0.7);font-size:.72rem">⚠️ رقم وطني غير مُسجَّل</div>`}
${b.patFileNo ? `<div class="binfo" style="font-family:'IBM Plex Mono',monospace;font-size:.74rem;color:var(--sky)">📁 ${sanitize(b.patFileNo)}</div>` : ''}
```

---

## التعديل ٢ — جدول سجل الحجوزات المكتملة (`_cmp`) — سطر ٣٧٥٣

**الحالي:**
```js
<td><b>${sanitize(b.patName || '—')}</b><br><small>${sanitize(b.patPhone || '')}</small>${b.patNationalId ? `<br><small style="color:var(--teal)"><i class="fas fa-id-card"></i> ${sanitize(b.patNationalId)}</small>` : ''}</td>
```

**الاستبدال:**
```js
<td><b>${sanitize(b.patName || '—')}</b><br><small>${sanitize(b.patPhone || '')}</small>${b.patNationalId ? `<br><small style="color:var(--teal)"><i class="fas fa-id-card"></i> ${sanitize(b.patNationalId)}</small>` : ''}${b.patFileNo ? `<br><small style="color:var(--sky)"><i class="fas fa-folder-open"></i> ${sanitize(b.patFileNo)}</small>` : ''}</td>
```

---

## التعديل ٣ — مربع البحث بسجل الحجوزات المكتملة — سطر ٣٧٣٣-٣٧٣٨

بدون هذا التعديل، الشارتان فوق بصريتان فقط — الموظف ما بيقدر يلاقي الحجز بالبحث برقم الملف حتى لو ظاهر قدامه. هذا التعديل يجعل العرض والبحث متطابقين (نفس مبدأ "لا تترك شغلة نص مسواة").

**الحالي:**
```js
          return (b.patName && b.patName.toLowerCase().includes(sq)) ||
            (b.patPhone && b.patPhone.includes(sq)) ||
            (b.bookNo && b.bookNo.toLowerCase().includes(sq)) ||
            (b.docName && b.docName.toLowerCase().includes(sq)) ||
            (b.patNationalId && b.patNationalId.includes(sq)) ||
            invMatch;
```

**الاستبدال:**
```js
          return (b.patName && b.patName.toLowerCase().includes(sq)) ||
            (b.patPhone && b.patPhone.includes(sq)) ||
            (b.bookNo && b.bookNo.toLowerCase().includes(sq)) ||
            (b.docName && b.docName.toLowerCase().includes(sq)) ||
            (b.patNationalId && b.patNationalId.includes(sq)) ||
            (b.patFileNo && b.patFileNo.toLowerCase().includes(sq)) ||
            invMatch;
```

---

## جدول الأثر

| ID | الملف | السطر | التغيير | خطر | Migration |
|---|---|---|---|---|---|
| BOOKING-FILENO-001a | dashboard.html | 3646 | شارة عرض إضافية بالكارد الحي | منخفض جداً | لا |
| BOOKING-FILENO-001b | dashboard.html | 3753 | شارة عرض إضافية بجدول السجل | منخفض جداً | لا |
| BOOKING-FILENO-001c | dashboard.html | 3737 | إضافة `patFileNo` لشرط البحث | منخفض جداً | لا |

**كل الثلاثة:** إضافة محروسة بـ `? ... : ''` — الحجوزات القديمة بدون `patFileNo` (وهي كل الحجوزات الحالية اللي أُنشئت قبل هذا التحديث) ما بيظهر عندها أي شي جديد، وما بتتأثر بالبحث. صفر كسر.

## اختبار التحقق

1. أنشئ حجز جديد واكتب رقم ملف بحقل `rbPatFileNo` → تأكد الشارة 📁 تظهر بكارد الانتظار.
2. أكمل الحجز (`cmpBook`) لين يوصل سجل المكتملة → تأكد الشارة تظهر بالجدول التاريخي كمان.
3. بمربع بحث السجل التاريخي، اكتب رقم الملف نفسه → تأكد الحجز يظهر بنتائج البحث.
4. افتح حجز قديم (من قبل التحديث، بدون `patFileNo`) → تأكد ما ظهرت شارة فاضية ولا انكسر التنسيق.
