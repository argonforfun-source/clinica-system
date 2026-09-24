# DENTAL INTEGRATION PATCH — v2.1 "Clinical Pro + Procedures"

Follows argon-governance's rules-before-function / additive-only sequencing.
Every change below is additive (new lines only) except the two explicitly
marked "relocation" edits inside `dental_chart_module.js`, which move an
existing literal without changing its values or behavior.

## Deploy order (do not skip steps or reorder — see "no-breaking-changes")

1. Add the two new files to the repo (no behavior change until step 2):
   - `specialty-modules/dental_procedure_catalog.js`
   - `specialty-modules/dental_label_registry.js`
2. Replace `specialty-modules/dental_chart_module.js` with the v2.1 file
   provided alongside this patch. (Full file, not a diff — it is small
   enough, and specialty-scoped enough, to review and deploy as a whole;
   see `dental_chart_module.diff` for the exact line-level change if you
   want to review it as a diff instead.)
3. Apply the ONE-LINE change to `specialty-config.js` below.
4. Apply the ONE-BLOCK change to `emr-app.js` below.
5. Apply the additive Firebase Rules changes in
   `firebase-rules.additions.md` **to an isolated/staging Firebase
   project first**, confirm the app still boots and the existing dental
   chart still loads and saves, THEN deploy rules to production.
6. Only after rules are live, doctors can start using the new
   "Procedures" section, "History" section, and the "تخصيص المصطلحات"
   customization screen. Nothing in steps 1–4 requires the new rules to
   already be live — the new nodes simply won't be reachable until they
   are, which fails safe (buttons show a toast error, nothing crashes).

No existing file is deleted. No existing Firebase node, field, or key is
renamed, removed, or restructured. `_chart`, `_meta`, and `saveChart()`
are byte-for-byte unchanged.

---

## 1. `specialty-config.js` — register the two new modules for lazy-loading

This is the **only** change to this file. It reuses the existing
`specialModules` lazy-loading mechanism in `emr-specialty-loader.js`
(`loadSpecialtyModules` → `loadModule`), which already fails silently
and non-critically (`script.onerror` → console.warn, no crash) if a
module file is missing — so this is safe even before step 1 lands.

Confirmed: `_activateModuleSection()`'s `sectionMap` is currently empty,
so registering a module here does **not** create a spurious UI tab/section
for it — verified against the live `emr-specialty-loader.js`.

**Before** (dental specialty block, `specialModules` line):
```js
      specialModules: ['dental_chart_module', 'treatment_plan_module', 'perio_module'],
```

**After:**
```js
      specialModules: ['dental_procedure_catalog', 'dental_label_registry', 'dental_chart_module', 'treatment_plan_module', 'perio_module'],
```

---

## 2. `emr-app.js` — one button to open the customization screen

Inside the dental-chart tab block (the one that renders into
`#_patFileDentalChart`), add one button next to the existing title, the
same way the existing "كتالوج أسعاري" button sits next to the dental
billing tab's title. This is the **only** change to this file.

**Before** (around the `dental-chart-tab` content block):
```js
    ${window.ArgonSpecialtyLoader && window.ArgonSpecialtyLoader.hasFeature('dentalChart') ? `
    <div id="emr-tab-dental-chart" class="emr-tab-content ${activeEmrTab === 'dental-chart-tab' ? 'active-content' : ''}" style="display:${activeEmrTab === 'dental-chart-tab' ? 'block' : 'none'}">
      <div class="ph" style="margin-bottom:12px">
        <div><div class="pt" style="font-size:1.15rem;color:#3b82f6">🦷 الرسم البياني للأسنان — FDI (ISO 3950)</div><div class="ps">خريطة تفاعلية لأسنان المريض — اضغط على أي سن لتعديل حالته</div></div>
      </div>
      <div id="_patFileDentalChart" style="padding:10px"></div>
    </div>` : ''}
```

**After:**
```js
    ${window.ArgonSpecialtyLoader && window.ArgonSpecialtyLoader.hasFeature('dentalChart') ? `
    <div id="emr-tab-dental-chart" class="emr-tab-content ${activeEmrTab === 'dental-chart-tab' ? 'active-content' : ''}" style="display:${activeEmrTab === 'dental-chart-tab' ? 'block' : 'none'}">
      <div class="ph" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <div><div class="pt" style="font-size:1.15rem;color:#3b82f6">🦷 الرسم البياني للأسنان — FDI (ISO 3950)</div><div class="ps">خريطة تفاعلية لأسنان المريض — اضغط على أي سن لتعديل حالته</div></div>
        <button type="button" class="btn-secondary btn-sm" style="border-radius:8px;padding:6px 14px;white-space:nowrap" onclick="window.DentalLabelRegistry && window.DentalLabelRegistry.openCustomizationModal()"><i class="fas fa-palette"></i> تخصيص المصطلحات</button>
      </div>
      <div id="_patFileDentalChart" style="padding:10px"></div>
    </div>` : ''}
```

Only the `.ph` div's inline style gained `display:flex;justify-content:space-between;align-items:center` and one `<button>` was inserted. Nothing else in this template literal changed.

---

## 3. What was deliberately NOT touched, and why

| File / area | Touched? | Reason |
|---|---|---|
| `_chart`, `_meta`, `saveChart()` | No | Master spec section 3/7/30: the destructive `.set()` chart save must stay exactly as-is. History is a new, separate, append-only node. |
| `_migrateLegacyTooth()` | No | No legacy-shape change was introduced; nothing needs migrating. |
| `emr-specialty-loader.js` | No | Its lazy-loading mechanism already supports this without modification (confirmed by reading `loadModule`/`_activateModuleSection`). |
| `treatment_plan_module.js`, `billing-engine.js`, `dental_media_module.js` | No | Master spec section 24: no bidirectional link is to be invented. Traced their Firebase paths to confirm no collision with the new `dental_history` / `doctor_dental_labels` nodes (see FINAL_IMPLEMENTATION_REPORT.md, "System Integration Trace"). |
| `specialty-config.js`'s `dentalChartConfig` / `commonProcedures` / `billingCodes` blocks | No | These are a pre-existing, already-unused (grep-confirmed: zero references anywhere else in the codebase) parallel status/procedure list — a duplicate that predates this task. Flagged, not touched (see FINAL_IMPLEMENTATION_REPORT.md, "Discovered Pre-Existing Issues"). Removing dead code is a separate, reviewable change, not bundled into this one. |
| `client-local-backup.js` | No | Its backup scope is "the whole tenant node" (`dbRoot.once('value')`), so the two new nodes are automatically included in existing backups/restores with zero code change. |
