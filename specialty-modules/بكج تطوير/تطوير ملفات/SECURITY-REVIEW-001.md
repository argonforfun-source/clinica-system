# SECURITY-REVIEW-001 — تدقيق كامل لـ firebase-rules.json و storage.rules

(بخصوص بند "الرسم البياني" — تركته بالكامل، فاهم إنه جلسة Claude تانية شغالة عليه. الملف `DENTAL-HISTORY-001.md` يلي بديت فيه سابقاً واقف كما هو، مش رح ألمسه.)

هذا التدقيق فحص كامل حرفي لملفي الأمان الوحيدين بالريبو، سطر سطر، صفر افتراض. النتيجة: اكتشاف حقيقي **خطير** بـ`storage.rules`، وملاحظتين أخف بـ`firebase-rules.json`.

---

## 🔴 الاكتشاف الأهم — تسرّب بيانات بين العيادات (Cross-Tenant) بـ storage.rules

**الملف مقرّ بهذا بنفسه** — تعليق حرفي بأعلى الملف (سطر ٣٠-٣٦):
> "الأمان الإضافي: العزل يتم من جانب العميل (client-side clinicId check)"

**يعني عملياً:**
```js
// السطر ٤٣-٤٤ — مسار النسخ الاحتياطية
allow read: if request.auth != null && request.auth.uid != null;
```
**أي حساب مُصادَق بكل النظام (من أي عيادة) يقدر يقرأ نسخة احتياطية كاملة لعيادة أخرى** — وهاي النسخة فيها كل بيانات كل مرضى تلك العيادة (أسماء، أرقام وطنية، تشخيصات، كل شي) — الشرط الوحيد إنه يعرف/يخمّن مسار الملف (`backups/{clinicId}/{fileName}`). صفر تحقق من إنه هذا المستخدم أصلاً موظف بهذي العيادة.

**نفس المشكلة تماماً بمسار صور المرضى:**
```js
// السطر ٧٦-٨١ — صور الأسنان/الأشعة
match /clinics/{clinicId}/patients/{patientId}/media/{fileName} {
  allow read: if request.auth != null;   // ← نفس الثغرة
```
أي موظف بأي عيادة يقدر يشوف صور مريض بعيادة تانية.

### ✅ الحل موجود جاهز عملياً — الآلية شغالة فعلاً، بس ما استُخدمت هون

فحصت `functions/index.js` (سطر ١-٧٩) — فيه دالتان حقيقيتان شغالتان الآن:
- `syncStaffClaims` — على `clinics/{clinicId}/staff/{uid}`
- `syncDoctorClaims` — على `clinics/{clinicId}/doctors/{uid}`

كل واحدة منهم بتنده `admin.auth().setCustomUserClaims(uid, { role, clinicId })` تلقائياً لحظة ما يُنشأ/يتحدّث أي موظف أو طبيب. يعني **`request.auth.token.clinicId` موجودة وشغالة فعلياً على توكن كل موظف حقيقي بالنظام** — هذا مش اقتراح نظري، هاي آلية مبنية ومفعّلة، بس **ملف `storage.rules` نسي يستخدمها**، رغم إنه `firebase-rules.json` نفسها بالفعل تستخدمها بسطر ٥٩/٦٧ (`auth.token.clinicId === $clinicId`). يعني نصف الترقية صارت (RTDB) والنصف التاني (Storage) نسيها المطوّر — تماماً متطابق مع تعليق الملف نفسه يلي كتب خطة الترقية ولسا ما طبّقها.

### الإصلاح — `storage.rules`

**الحالي (مسار backups):**
```js
allow read: if request.auth != null
               && request.auth.uid != null;
```
**الاستبدال:**
```js
allow read: if request.auth != null
               && request.auth.uid != null
               && request.auth.token.clinicId == clinicId;
```

**الحالي (مسار media):**
```js
match /clinics/{clinicId}/patients/{patientId}/media/{fileName} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
                  && request.resource.size <= 20 * 1024 * 1024;
  allow delete: if request.auth != null;
}
```
**الاستبدال:**
```js
match /clinics/{clinicId}/patients/{patientId}/media/{fileName} {
  allow read: if request.auth != null
                 && request.auth.token.clinicId == clinicId;
  allow write: if request.auth != null
                  && request.auth.token.clinicId == clinicId
                  && request.resource.size <= 20 * 1024 * 1024;
  allow delete: if request.auth != null
                   && request.auth.token.clinicId == clinicId;
}
```

**الحالي (مسار backups — الكتابة والحذف):** نفس الشي، أضف `&& request.auth.token.clinicId == clinicId` لقاعدتي `write` و`delete` بمسار `backups/{clinicId}/{fileName}` أيضاً.

### ⚠️ فجوة صادقة متبقية — السوبر أدمن

فحصت: `functions/index.js` **لا يضبط `role: 'super'` لأي حساب أبداً** — صلاحية السوبر أدمن بـ RTDB بالكامل عبر جدول `clinic_auth_map/{uid} === '__SUPER__'`، وStorage Rules **لا تقدر تستعلم RTDB مباشرة** (نفس تعليق الملف الأصلي). يعني بعد هذا الإصلاح: **السوبر أدمن نفسه ما رح يقدر يقرأ Storage أي عيادة تانية غير عيادته المباشرة (لو عنده حساب موظف بها أصلاً)**. إذا هذا مطلوب فعلياً (سوبر أدمن يحتاج يصل لملفات كل العيادات)، هاي تحتاج Cloud Function جديدة تضبط `role:'super'` كـ Custom Claim لحسابات محددة — شغلة منفصلة، ما بديت فيها، خبرني إذا مطلوبة.

---

## 🟡 ملاحظة — "append-only" الزيارات أضعف مما تقول التعليقة

`firebase-rules.json` سطر ١١٨: `/* الزيارات: append-only (لا حذف) */`. فحصت المنطق سطر ١٢١-١٢٩ بدقة:

```js
!data.exists() ||
(newData.exists() && !newData.child('status').exists()) ||
(newData.exists() && newData.child('status').val() === 'archived') ||
(newData.exists() && newData.child('status').val() === 'signed')
```

**هذا الشرط بيتحقق فقط من شكل البيانات الجديدة، لا من "هل هذا تعديل لزيارة موجودة أصلاً".** التأكيد الحقيقي الوحيد: **الحذف ممنوع** (لو حاول أحد `.remove()` على زيارة موجودة، `newData.exists()` بتصير false وكل الشروط الثلاثة تفشل). **لكن تعديل محتوى زيارة موجودة (تشخيص، ملاحظات، حتى التاريخ نفسه) مسموح تماماً**، طالما الكتابة الجديدة برضه فيها `status` بقيمة `signed`/`archived`/غير موجودة — يعني **طبيب يقدر يرجع يعدّل تشخيص زيارة "موقّعة" من سنة، والقاعدة ما بتمنعه**. هذا يخالف مباشرة القسم ١١ من طلبك الأصلي ("Never overwrite old clinical encounters").

**لم أكتب إصلاحاً لهذي لسا** — لأنه يحتاج قرار سياسة منك أولاً: هل "signed" المفروض تقفل الزيارة كلياً (منع أي تعديل بعد التوقيع)، ولا في حالات مشروعة لتعديل زيارة موقّعة (تصحيح خطأ كتابي مثلاً)؟

### ✅ الإصلاح — جاهز، وتوصيتي كخبير: نفّذه

المعيار الطبي القانوني العالمي واضح: **زيارة موقّعة ما بتتعدّل أبداً — أي تصحيح لازم يكون سجل إضافي جديد منفصل ومؤرَّخ، لا تعديل على القديم.** هذا أسلم افتراضي ممكن (وأي عيادة تحتاج استثناء، تقدر تضيفه بوعي بعدين — الأصعب دايماً التراجع من "مفتوح" لـ"مقفول" بعد ما الناس اعتادوا التعديل، مش العكس).

**فحصت أيضاً — قبل ما أقترح الإصلاح — هل "signed" مستخدمة فعلياً بالتطبيق:** بحثت بكل ملفات JS الحية — `v.status === 'signed'` **تُقرأ فقط** (سطر ٢٢٩٠، لعرض أيقونة قفل)، وصفر مكان بالكود الحالي بيكتبها أصلاً. يعني هذا الإصلاح حالياً **احترازي بالكامل** (لا يحل ثغرة نشطة اليوم، لأنه ما فيه طريق فعلي لتوقيع زيارة أصلاً) — بس بيقفل الباب مسبقاً بلحظة ما تُبنى ميزة "توقيع الزيارة" مستقبلاً. بالمقابل `'archived'` تأكدت إنها **مستخدمة فعلياً** (سطر ٥٥٤٩) فتركتها تماماً كما هي.

**الحالي (`firebase-rules.json`، داخل `visits/$visitId`):**
```js
".write": "auth != null && (
  root.child('clinic_auth_map/' + auth.uid).val() === $clinicId ||
  root.child('clinic_auth_map/' + auth.uid).val() === '__SUPER__'
) && (
  !data.exists() ||
  (newData.exists() && !newData.child('status').exists()) ||
  (newData.exists() && newData.child('status').val() === 'archived') ||
  (newData.exists() && newData.child('status').val() === 'signed')
)"
```

**الاستبدال (إضافة شرط واحد فقط، بقية القاعدة بدون أي لمس):**
```js
".write": "auth != null && (
  root.child('clinic_auth_map/' + auth.uid).val() === $clinicId ||
  root.child('clinic_auth_map/' + auth.uid).val() === '__SUPER__'
) && !(data.exists() && data.child('status').val() === 'signed') && (
  !data.exists() ||
  (newData.exists() && !newData.child('status').exists()) ||
  (newData.exists() && newData.child('status').val() === 'archived') ||
  (newData.exists() && newData.child('status').val() === 'signed')
)"
```

**كيف بيشتغل بدقة:** الشرط الجديد بيفحص `data` (القيمة **الحالية قبل** الكتابة)، لا `newData`. يعني:
- إنشاء زيارة جديدة: `data.exists()` أصلاً false → الشرط يعطي true → يُسمح (بدون تغيير).
- تعديل/أرشفة زيارة **غير موقّعة**: `data.child('status').val()` أي شي غير `'signed'` → يُسمح (بدون تغيير).
- **أي كتابة (تعديل أو حذف) على زيارة `data` عندها فعلاً `status === 'signed'`: تُرفض فوراً، دون استثناء.**
- أول لحظة تتحول فيها زيارة **إلى** `'signed'` (من حالة سابقة غير موقّعة): مسموحة، لأنه بهاي اللحظة `data` (القديمة) لسا مش `signed` — هذا صحيح ومطلوب (يعني تقدر توقّع الزيارة أول مرة، بس مش تعدّلها بعد التوقيع).

**الخطر:** منخفض جداً — طالما "signed" غير مُستخدمة فعلياً اليوم، هذا الإصلاح **صفر تأثير على أي سلوك حالي**، ويصير فعّالاً فقط لما تُبنى ميزة التوقيع.

---

## 🟢 ملاحظة — مسارات بلا أي حماية أضيق من "أي موظف بالعيادة"

هذي المسارات ما فيها أي `.write` خاص، فبترث قاعدة `clinics/$clinicId` العامة بالكامل (أي موظف مصادَق = صلاحية كاملة، صفر تمييز دور):

`pharmacy_inventory`, `pricing_catalog`, `identity_changes`, `doctors` (فقط `.validate`، لا `.write`)، `billing_triggers`, `referrals`, `notifications`, `specialty_data` بالكامل (بما فيها الأسنان).

**ملاحظة صدق:** هاي غالباً **قرار تصميم مقصود** لعيادة صغيرة (ثقة داخلية كاملة بين الموظفين) وليست بالضرورة "خطأ" — بس أحببت أوثّقها صراحة لأنه لو النية كانت فرض أدوار (دكتور فقط يعدّل `pricing_catalog` مثلاً)، الآلية الجاهزة لهذا **موجودة فعلاً** (`request.auth.token.role` — مضبوطة أصلاً بـ`functions/index.js` بنفس الدالتين، بس RTDB Rules لا تستخدمها أبداً غير بحالة `'super'` الوحيدة). القرار لك: تبغى نفرض أدوار حقيقية بمسارات معينة، ولا تسيبها كما هي؟

---

## جدول الأثر

| ID | الملف | التغيير | الخطورة الحالية | خطر التطبيق | يحتاج نشر |
|---|---|---|---|---|---|
| SEC-STORAGE-001 | storage.rules | إضافة فحص `clinicId` claim لـ backups + media | 🔴 عالية (تسرّب بيانات مرضى فعلي) | منخفض (الآلية شغالة ومُتحقَّقة) | ✅ `firebase deploy --only storage` |
| SEC-VISITS-001 | firebase-rules.json | قفل تعديل زيارة `signed` بعد التوقيع | 🟡 نظرية اليوم (signed غير مُستخدمة)، احترازية للمستقبل | منخفض جداً (صفر تأثير حالي) | ✅ جاهز — توصيتي: نفّذه |
| SEC-ROLES-001 | firebase-rules.json | فرض أدوار حقيقية على مسارات محددة | 🟢 منخفضة/قرار تصميم | يحتاج قرارك أولاً | معلّق |

## اختبار SEC-VISITS-001

1. أنشئ زيارة جديدة عادية → تأكد الحفظ يعمل بدون أي تغيير بالسلوك.
2. عدّل زيارة **غير موقّعة** (تشخيص/ملاحظات) → تأكد التعديل يعمل بنجاح كالمعتاد.
3. (اختباري فقط، بما إنه ما فيه UI حالياً يسوي هذا) — لو حدا كتب يدوياً `status:'signed'` على زيارة عبر Firebase Console، وبعدين حاول تعديلها من التطبيق → يجب أن يُرفض الحفظ.

## اختبار قبل النشر (SEC-STORAGE-001) — **مهم جداً**

قواعد Storage خطأ بسيط فيها ممكن يقفل موظفين شرعيين. لا تنشرها مباشرة على production:
1. جرّبها أول بمشروع Firebase تجريبي منفصل (staging)، أو
2. على الأقل: بعد النشر، فوراً اختبر: موظف عيادة أ يقدر يرفع/يقرأ نسخته الاحتياطية بشكل طبيعي (تأكد `clinicId` بالتوكن مطابق تماماً لقيمة `clinicId` بالمسار، حساسة لحالة الأحرف).
3. تأكد موظف عيادة أ **يفشل** بقراءة `backups/{clinicId_عيادة_ب}/...` (جرّب المسار يدوياً بـ Firebase console أو REST).
