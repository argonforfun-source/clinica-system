# TENANT-IDENTITY / HOME-SCREEN FIX — DEPLOY PATCH

4 files touched. Full root-cause analysis, evidence, and test matrix are in
`SURGICAL_REPAIR_REPORT.md` — read that first. This file is just the
mechanical patch.

## 1. `manifest-clinic.json` — replace whole file

Already a complete, ready file in this delivery. Only change from the
current file: the `"start_url": "/dashboard.html"` line is removed.
Nothing else in it changed.

## 2. `manifest-patient.json` — replace whole file

Same change: `"start_url": "/index.html"` removed. Nothing else changed.

## 3. `dashboard.html` — replace ONE block only

**Before** (around line 2787):
```js
    const uP = new URLSearchParams(window.location.search);
    let CID = uP.get('id') || localStorage.getItem('argon_id') || '1';
    if (uP.get('id')) localStorage.setItem('argon_id', CID);
    const BASE = 'clinics/' + CID;
```

**After:**
```js
    const uP = new URLSearchParams(window.location.search);
    const _urlCID = uP.get('id');
    let CID = _urlCID || localStorage.getItem('argon_id') || '';
    if (_urlCID) localStorage.setItem('argon_id', CID);
    if (!CID) {
      document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#031a15;color:#fff;font-family:Tajawal,sans-serif;direction:rtl;text-align:center;padding:24px"><div style="max-width:420px"><div style="font-size:3rem;margin-bottom:12px">⚠️</div><div style="font-size:1.25rem;font-weight:800;margin-bottom:10px">لم يتم تحديد العيادة</div><div style="font-size:0.9rem;color:#9ca3af;line-height:1.8">لا يمكن فتح لوحة التحكم بدون تحديد العيادة بشكل صريح. الرجاء العودة إلى رابط العيادة الصحيح، أو إعادة إضافة اختصار الشاشة الرئيسية لهذه العيادة.</div></div></div>';
      throw new Error('ARGON: no explicit or session clinic id — refusing to load a default/guessed tenant.');
    }
    const BASE = 'clinics/' + CID;
```
(The exact same block, with comments, is in the shipped `dashboard.html.diff` if you want to review it as a unified diff instead of copy-pasting.)

## 4. `emr-app.js` — insert ONE block only (nothing else changes)

**Before** (around line 21):
```js
let CID = new URLSearchParams(window.location.search).get('id') || '';
let BASE = 'clinics/' + CID;
```

**After:**
```js
let CID = new URLSearchParams(window.location.search).get('id') || '';

if (CID) {
  document.addEventListener('DOMContentLoaded', function () {
    var dashLink = document.getElementById('dashLink');
    if (dashLink) dashLink.href = 'dashboard.html?id=' + encodeURIComponent(CID);
  });
}
let BASE = 'clinics/' + CID;
```

## Deploy order

1. Apply all 4 changes together (they're independent of each other, order
   doesn't matter between them, but deploy in one release, not staggered —
   the manifest fix and the JS hardening are two layers of the same fix).
2. No Firebase rules change, no staging-first step needed this time —
   these are static-file/client-JS-only changes.
3. **After deploy**, every clinic/doctor with an existing Home Screen icon
   must delete it and re-add it once (see SURGICAL_REPAIR_REPORT.md §17.2)
   — the manifest fix only affects *new* installs. This needs a short
   message to your clinics, not more code.
4. Test on at least one real iPhone with the exact 9-step scenario from
   the original bug report before considering this fully closed (§17.1).

## What NOT to touch while applying this

`sw.js`, `firebase-rules.json`, `storage.rules`, `super-app.js`, any
specialty module, `manifest.json` (dead/unreferenced), `portal.html` (has
its own separate, pre-existing, unrelated bug — see report §17.3, not part
of this patch).
