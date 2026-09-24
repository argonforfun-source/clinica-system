# PATIENT-MATCH-IDENTITY-001 — إشارات تاريخ الميلاد والجنس بالمطابقة

**الملفات المتأثرة:** `argon-enterprise.js`, `emr-app.js`
**القاعدة الذهبية المحفوظة بالكامل:** لا تعديل على "القاعدة المطلقة #1" (رقم وطني صحيح = EXACT فوري) ولا "القاعدة المطلقة #2" (رقم وطني غير صحيح = حظر). هاتان القاعدتان بالأعلى، بلا أي علاقة بالهاتف/DOB/Gender، وما لمستهم نهائي.

---

## القرار التصميمي (ليه هيك، مش طريقة تانية)

فحصت `MatchResult` — انو `Object.freeze({EXACT, STRONG, POSSIBLE, NEW})`. لو أضفت قيمة رابعة مثل `CONFLICT`، بضطر أعدّل كل مكان بيتحقق من `matchResult.result === "..."` (فيه 3 مواضع استهلاك بالكود: بوابة الحجز، إنشاء المريض اليدوي، `showMatchDialog`) — توسعة أثر مش ضرورية.

**البديل الأدق جراحياً:** أبقى داخل `POSSIBLE`/`STRONG` الموجودتين، وبس أضيف حقل جديد `identityConflict: true/false` + أعدّل `confidence`/`reason` حسب الدليل. أي كود قديم ما بيفتش عن هذا الحقل → صفر تأثير عليه. هذا فعلياً "إضافة"، مش "تغيير عقد الإرجاع".

---

## التعديل ١ — `argon-enterprise.js` — دالة مساعدة جديدة (تُضاف قبل `async function findMatch`)

```js
  // ─────────────────────────────────────────────────────────
  // 🧬 Identity Signals — DOB / Gender (إضافة)
  // تُستخدم فقط بعد نجاح البحث بالهاتف. لا تمنح EXACT أبداً.
  // بدون dob/gender على أي طرف → السلوك القديم تماماً، صفر تغيير.
  // ─────────────────────────────────────────────────────────
  function refineWithIdentitySignals(base, incoming, candidate) {
    const inDob      = (incoming.dob    || '').trim();
    const candDob     = (candidate.dob    || '').trim();
    const inGender    = (incoming.gender  || '').trim();
    const candGender  = (candidate.gender || '').trim();

    const haveBothDob    = !!inDob    && !!candDob;
    const haveBothGender = !!inGender && !!candGender;

    // 🚫 أقوى إشارة ممكنة: الجنس مختلف — استحالة أن يكون نفس الشخص
    if (haveBothGender && inGender !== candGender) {
      return {
        ...base,
        result:           MatchResult.POSSIBLE,
        confidence:        0.1,
        reason:           '⚠️ نفس الهاتف، لكن الجنس المسجّل مختلف — شخص آخر بالتأكيد (فرد عائلة)',
        identityConflict: true
      };
    }

    // 🚫 إشارة قوية: نفس الهاتف + اسم متشابه، لكن تاريخ الميلاد مختلف
    if (haveBothDob && inDob !== candDob) {
      return {
        ...base,
        result:           MatchResult.POSSIBLE,
        confidence:        0.15,
        reason:           '⚠️ نفس الهاتف، الاسم متشابه، لكن تاريخ الميلاد مختلف — الأرجح فرد آخر من العائلة',
        identityConflict: true
      };
    }

    // ✅ تأكيد إيجابي: نفس الهاتف + نفس تاريخ الميلاد بالضبط → رفع الثقة لـ STRONG
    if (haveBothDob && inDob === candDob && base.result === MatchResult.POSSIBLE) {
      return {
        ...base,
        result:     MatchResult.STRONG,
        confidence: Math.max(base.confidence, 0.9),
        reason:     base.reason + ' + تاريخ ميلاد مطابق تماماً'
      };
    }

    // dob/gender غائبة على طرف على الأقل — لا دليل كافٍ، السلوك القديم كما هو
    return base;
  }
```

## التعديل ٢ — `argon-enterprise.js` — استبدال نهاية `findMatch` لتوجيه النتيجة عبر الدالة الجديدة

**الحالي (آخر ٣ `return` بالدالة):**
```js
    if (bestScore >= 0.85) {
      return {
        result:      MatchResult.STRONG,
        confidence:  bestScore,
        matchedId:   best.id,
        matchedName: best.name,
        reason:      `Phone + name similarity ${(bestScore*100).toFixed(1)}%`
      };
    }
    if (bestScore >= 0.5) {
      return {
        result:      MatchResult.POSSIBLE,
        confidence:  bestScore,
        matchedId:   best.id,
        matchedName: best.name,
        reason:      `Phone match, name similarity ${(bestScore*100).toFixed(1)}% — needs confirmation`
      };
    }

    return {
      result:      MatchResult.POSSIBLE,
      confidence:  0.3,
      matchedId:   candidates[0].id,
      matchedName: candidates[0].name,
      reason:      'Same phone, different name — possible family member'
    };
  }
```

**الاستبدال:**
```js
    let baseResult;
    if (bestScore >= 0.85) {
      baseResult = {
        result:      MatchResult.STRONG,
        confidence:  bestScore,
        matchedId:   best.id,
        matchedName: best.name,
        reason:      `Phone + name similarity ${(bestScore*100).toFixed(1)}%`
      };
    } else if (bestScore >= 0.5) {
      baseResult = {
        result:      MatchResult.POSSIBLE,
        confidence:  bestScore,
        matchedId:   best.id,
        matchedName: best.name,
        reason:      `Phone match, name similarity ${(bestScore*100).toFixed(1)}% — needs confirmation`
      };
    } else {
      baseResult = {
        result:      MatchResult.POSSIBLE,
        confidence:  0.3,
        matchedId:   candidates[0].id,
        matchedName: candidates[0].name,
        reason:      'Same phone, different name — possible family member'
      };
    }

    // ابحث عن السجل الحقيقي المرتبط بـ matchedId (يعمل بكل الفروع الثلاثة بدون افتراض best/candidates[0])
    const matchedCandidate = candidates.find(c => c.id === baseResult.matchedId) || candidates[0];
    return refineWithIdentitySignals(baseResult, incoming, matchedCandidate);
  }
```

*ملاحظة دقة: تعمّدت البحث بـ `candidates.find(...)` بدل الاعتماد على `best` مباشرة، لأنه بالفرع الثالث (تشابه اسم ضعيف) الكود الأصلي أصلاً بيرجّع `candidates[0]` مش `best` — سلوك قديم موجود قبل أي تعديل مني، خليته كما هو، ما بديت "أصلحه" لأنه مش جزء من المطلوب.*

## التعديل ٣ — `argon-enterprise.js` — سطر واحد إضافي بـ `showMatchDialog` لعرض سبب الرفض الدقيق

**الحالي:**
```js
  const isFamily = matchResult.reason && matchResult.reason.includes('family member');
  const reasonText = isFamily
    ? 'نفس رقم الهاتف — قد يكون فرداً من العائلة'
    : `نسبة تشابه الاسم: ${conf}%`;
```

**الاستبدال:**
```js
  const isFamily = matchResult.reason && matchResult.reason.includes('family member');
  const reasonText = matchResult.identityConflict
    ? matchResult.reason
    : (isFamily
        ? 'نفس رقم الهاتف — قد يكون فرداً من العائلة'
        : `نسبة تشابه الاسم: ${conf}%`);
```

---

## التعديل ٤ — `emr-app.js` — تمرير dob/gender الموجودين أصلاً بنفس السكوب (موقع الاستدعاء الوحيد القابل لذلك)

فيه استدعاءان لـ `findMatch` بكل الريبو:
- **موقع الحجز→مريض** (`emr-app.js:1182`): البيانات جايّة من نموذج الحجز بـ dashboard.html، وفحصته فعلياً — **ما فيه حقل تاريخ ميلاد ولا جنس بنموذج الحجز أصلاً** (بس `rbPatName/rbPatPhone/rbPatNID/rbPatFileNo`). فمافي شي أمرره هون — **صفر تعديل بهذا الموقع**، وهاي حدود حقيقية للتحسين مش قصور بالتنفيذ.
- **موقع إنشاء مريض يدوي** (`emr-app.js:2044`): `_dob_np` و`gender` موجودين فعلاً بنفس الدالة قبل الاستدعاء بأسطر.

**الحالي:**
```js
    const matchResult = await window.ArgonMedical.PatientMatch.findMatch(
      CID,
      { name, phone, nationalId },
      db
    );
```

**الاستبدال:**
```js
    const matchResult = await window.ArgonMedical.PatientMatch.findMatch(
      CID,
      { name, phone, nationalId, dob: _dob_np, gender },
      db
    );
```

---

## اكتشاف مستقل ١ — SHADOW-LOG-ARGS-001 (بَغ حقيقي، لقيته وقت تحقّقي من موقع الاستدعاء نفسه)

`ShadowLog.log` موقّعها الحقيقي: `log(clinicId, matchResult, context, db)`. موقع الحجز (`1182`) بيستدعيها **صحيح**. موقع الإنشاء اليدوي (`~2050`) بيستدعيها **بترتيب معكوس تماماً**.

**الأثر الفعلي (تحققت منه سطر سطر، مش تخمين):** جوا `log()` فيه `try/catch` حول استعلام Firebase، فالخطأ **بينبلع صامت ومابيوقف إنشاء المريض** (بخلاف افتراض أولي كان عندي وتراجعت عنه بعد القراءة الدقيقة). الأثر الحقيقي المتبقي: **كل سجل `smart_log` (تدقيق) الناتج عن إنشاء مريض يدوي مكتوب بحقول فاضية (`result: undefined`, `matchedId: undefined`...)** — يعني تدقيق القرارات الذكية معطّل صامت بهذا المسار بس.

**الحالي:**
```js
    await window.ArgonMedical.ShadowLog.log(
      CID,
      { name, phone, nationalId },
      matchResult,
      'emr_manual_create',
      (ArgonSession.get() || {}).staffId || 'doctor'
    );
```

**الاستبدال (نفس نمط موقع الحجز الصحيح تماماً):**
```js
    await window.ArgonMedical.ShadowLog.log(
      CID,
      matchResult,
      { source: 'emr_manual_create', userId: (ArgonSession.get() || {}).staffId || 'doctor', incoming: { name, phone, nationalId } },
      db
    ).catch(e => console.warn('[ShadowLog]', e));
```

---

## اكتشاف مستقل ٢ — GENDER-DISPLAY-BUG-001 (بَغ حقيقي، لقيته وقت تحقّقي من ترميز قيمة الجنس)

فحصت القيمة الحقيقية المخزّنة: `emr.html:494` — `<option value="ذكر">` / `<option value="أنثى">`. يعني القيمة المخزّنة عربية دايماً، أبداً `'M'`.

لكن `emr-app.js:2267` (رأس ملف المريض) بيسوي:
```js
${info.gender ? `<span><i class="fas fa-venus-mars"></i> ${info.gender === 'M' ? 'ذكر' : 'أنثى'}</span>` : ''}
```
هذا الشرط **دايماً false** لأنه القيمة الحقيقية أبداً ما تكون `'M'` → **كل مريض ذكر بالنظام كله يظهر "أنثى" برأس ملفه**، بينما باقي الشاشات (`819, 1542, 4730`) بتتحقق صحيح من `'ذكر'`/`'أنثى'` مباشرة. تناقض ترميز حقيقي مؤكد.

**الاستبدال:**
```js
${info.gender ? `<span><i class="fas fa-venus-mars"></i> ${sanitize(info.gender)}</span>` : ''}
```

---

## تصحيح والتراجع عن ادّعاء سابق — Backup/Restore (مهم للأمانة)

قلت بأول رسالة إنه فيه "bug حقيقي شغال الآن" ببعثرة صيغة اسم ملف النسخة الاحتياطية بين `argon-backup.js` v5.0 و`argon-restore.js`. **رجعت وقرأت كود `argon-restore.js` نفسه بالكامل (سطر ٨٠-٩٦) — الادعاء غلط.** الكود بالفعل بيستخدم `files.filter(f => f.startsWith('backup_' + dateStr))` وهاي بتطابق `backup_2026-06-16_16-00.json` تلقائياً (لأنها تبدأ بـ `backup_2026-06-16`)، وبعدين `.sort().reverse()` وباختار الأحدث. **يعني النظامان متوافقان فعلياً، ولا يوجد بَغ.** الشي الوحيد الحقيقي: تعليق قديم بهيدر `argon-backup.js` (سطر ٢٨-٣٥) بيقول عكس هذا وهو **متروك بالغلط ولم يُحدَّث** بعد ما argon-restore.js انصلح — تنظيف تعليق فقط، صفر كود، صفر خطر، اختياري.

---

## جدول الأثر الكامل

| ID | الملف | التغيير | خطر | Migration | يحتاج اختبار |
|---|---|---|---|---|---|
| PATIENT-MATCH-IDENTITY-001a | argon-enterprise.js | دالة `refineWithIdentitySignals` جديدة | منخفض | لا | ✅ |
| PATIENT-MATCH-IDENTITY-001b | argon-enterprise.js | توجيه نتيجة `findMatch` عبرها | منخفض | لا | ✅ |
| PATIENT-MATCH-IDENTITY-001c | argon-enterprise.js | سطر بـ `showMatchDialog` | منخفض جداً | لا | ✅ |
| PATIENT-MATCH-IDENTITY-001d | emr-app.js | تمرير dob/gender بالاستدعاء | منخفض جداً | لا | ✅ |
| SHADOW-LOG-ARGS-001 | emr-app.js | ترتيب معاملات صحيح | منخفض جداً | لا | اختياري |
| GENDER-DISPLAY-BUG-001 | emr-app.js | سطر واحد | منخفض جداً | لا | ✅ |

**لا تعديل على:** firebase-rules.json، القاعدة المطلقة #1/#2 بـ findMatch، نموذج الحجز (dashboard.html) — لأنه لا يجمع dob/gender أصلاً.

## اختبارات التحقق المطلوبة

1. **أب وابن، نفس الهاتف، تاريخ ميلاد مختلف، اسم متشابه:** أنشئ مريض جديد بنفس هاتف مريض موجود ونفس الاسم تقريباً لكن DOB مختلف → توقع `POSSIBLE`, `confidence: 0.15`, بانر يقول "تاريخ الميلاد مختلف" حرفياً.
2. **نفس الهاتف + نفس DOB بالضبط، اسم بصيغة مختلفة شوي (نفس الشخص فعلياً):** توقع الترقية لـ `STRONG`.
3. **جنس مختلف صريح:** توقع `confidence: 0.1` وبانر التحذير الأقوى.
4. **مريض قديم بلا dob/gender على الإطلاق (كل البيانات الحالية):** توقع **صفر تغيير** بالسلوك — نفس نتيجة اليوم بالضبط.
5. افتح ملف مريض ذكر موجود بالنظام → تأكد رأس الملف يعرض "ذكر" لا "أنثى" بعد GENDER-DISPLAY-BUG-001.
6. أنشئ مريض يدوياً وافحص `smart_log` بقاعدة البيانات → تأكد الحقول (`result`, `matchedId`, `reason`) مليانة صحيحة لا `undefined`.
