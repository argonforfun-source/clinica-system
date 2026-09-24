/**
 * ARGON MEDICAL OS — Dental Display-Label Customization Registry
 * specialty-modules/dental_label_registry.js — v1.0
 *
 * Purpose (see master spec, sections 8–16, 24, 26–27):
 *   Lets each doctor set a private display alias for a Dental label
 *   (tooth status, surface condition, procedure, tooth name, material)
 *   WITHOUT ever touching the stable identifier, the canonical source
 *   text, another doctor's view, another clinic's data, or historical
 *   patient records.
 *
 * Resolution order (section 11):
 *   Doctor Custom Label → Canonical System Label → Legacy Fallback
 *
 * This file does NOT duplicate canonical Arabic text. It reads the
 * canonical labels live from the two existing single-source-of-truth
 * modules:
 *   - window.DentalChartModule        (TOOTH_STATUSES, SURFACE_CONDITIONS,
 *                                       MATERIALS, getAnatomicalName —
 *                                       exposed by a 4-line additive
 *                                       change, see DENTAL_INTEGRATION_PATCH.md)
 *   - window.DentalProcedureCatalog   (the 128-code official catalog)
 * If either module hasn't loaded yet, resolution falls back to the
 * stableKey itself so the UI never shows a blank label.
 *
 * Firebase (additive, no change to any existing node):
 *   clinics/{CID}/doctor_dental_labels/{doctorId}/{labelType}/{stableKey}
 *     = "<custom display string>"
 *   This mirrors the existing doctor_pricing/{doctorId}/{serviceId} = <value>
 *   convention already used by this codebase (emr-app.js) — same shape,
 *   same per-doctor scoping convention, new leaf name only.
 *
 * Auditability (section 27) reuses the EXISTING logAudit(action, details,
 * module) function already defined in emr-app.js and already wired to
 * clinics/{CID}/audit_logs (append-only per firebase-rules.json). No new
 * audit path is introduced.
 *
 * KNOWN LIMITATION — read this before relying on doctor-vs-doctor isolation:
 *   Firebase custom auth claims in this project currently carry only
 *   {role, clinicId} (see functions/index.js) — there is no per-staff-member
 *   claim. The active firebase-rules.json therefore grants any authenticated
 *   staff member of a clinic read/write access to the ENTIRE clinic subtree,
 *   with no rule distinguishing one doctor's node from another's (the same
 *   is already true of the existing doctor_pricing node — this is not a new
 *   gap introduced here). Doctor-vs-doctor isolation below is enforced by
 *   convention (each doctor's own UI only ever reads/writes their own
 *   doctorId key) exactly like doctor_pricing already does — it is NOT
 *   enforced by Firebase Rules today. Clinic-vs-clinic isolation IS
 *   correctly enforced today, because it rides on the existing clinicId
 *   check. See FINAL_IMPLEMENTATION_REPORT.md, "Security", for the
 *   follow-up needed to close the doctor-vs-doctor gap for real.
 */
(function (global) {
  'use strict';

  var LABEL_TYPES = ['status', 'condition', 'procedure', 'tooth', 'material'];

  var _cache = {};      // { doctorId: { labelType: { stableKey: customLabel } } }
  var _listenerDoc = null;

  function _currentDoctorId() {
    try {
      var s = global.ArgonSession ? global.ArgonSession.get() : null;
      return (s && s.staffId) || null;
    } catch (e) { return null; }
  }

  function _currentClinicId() {
    try {
      var s = global.ArgonSession ? global.ArgonSession.get() : null;
      return (s && s.clinicId) || (typeof global.CID !== 'undefined' ? global.CID : null);
    } catch (e) { return (typeof global.CID !== 'undefined' ? global.CID : null); }
  }

  /**
   * Starts (or restarts, if the doctor changed) the live listener that
   * keeps the local cache in sync with Firebase for one doctor. Call once
   * after login / on dental module init. Safe to call more than once.
   */
  function initForDoctor(doctorId) {
    doctorId = doctorId || _currentDoctorId();
    if (!doctorId || typeof db === 'undefined' || typeof BASE === 'undefined') return;
    if (_listenerDoc === doctorId) return; // already listening for this doctor
    _listenerDoc = doctorId;
    db.ref(BASE + '/doctor_dental_labels/' + doctorId).on('value', function (snap) {
      _cache[doctorId] = snap.val() || {};
    });
  }

  function _canonicalLabel(type, stableKey) {
    var DCM = global.DentalChartModule;
    var CAT = global.DentalProcedureCatalog;
    if (type === 'status') {
      return (DCM && DCM.TOOTH_STATUSES && DCM.TOOTH_STATUSES[stableKey]) ? DCM.TOOTH_STATUSES[stableKey].labelAr : stableKey;
    }
    if (type === 'condition') {
      return (DCM && DCM.SURFACE_CONDITIONS && DCM.SURFACE_CONDITIONS[stableKey]) ? DCM.SURFACE_CONDITIONS[stableKey].labelAr : stableKey;
    }
    if (type === 'material') {
      if (DCM && DCM.MATERIALS) {
        var m = DCM.MATERIALS.filter(function (row) { return row[0] === stableKey; })[0];
        if (m) return m[1];
      }
      return stableKey;
    }
    if (type === 'procedure') {
      var proc = CAT ? CAT.getProcedureByCode(stableKey) : null;
      return proc ? proc.nameAr : stableKey;
    }
    if (type === 'tooth') {
      var num = parseInt(stableKey, 10);
      if (DCM && typeof DCM.getAnatomicalName === 'function' && !isNaN(num)) return DCM.getAnatomicalName(num);
      return stableKey;
    }
    return stableKey;
  }

  /**
   * Resolves the label to display for one (type, stableKey), for one
   * doctor: doctor custom → canonical → stableKey as last-resort fallback.
   * Never throws; never returns an empty string.
   */
  function getDentalDisplayLabel(type, stableKey, doctorId) {
    doctorId = doctorId || _currentDoctorId();
    var custom = doctorId && _cache[doctorId] && _cache[doctorId][type] ? _cache[doctorId][type][stableKey] : null;
    if (custom) return custom;
    var canonical = _canonicalLabel(type, stableKey);
    return canonical || String(stableKey);
  }

  /** True if this doctor has a custom alias set for this (type, stableKey). */
  function hasCustomLabel(type, stableKey, doctorId) {
    doctorId = doctorId || _currentDoctorId();
    return !!(doctorId && _cache[doctorId] && _cache[doctorId][type] && _cache[doctorId][type][stableKey]);
  }

  /**
   * Sets (or overwrites) one doctor's display alias. Never touches the
   * canonical catalog, TOOTH_STATUSES/SURFACE_CONDITIONS, patient charts,
   * or history. Logs the change via the existing logAudit() (section 27).
   */
  function setDentalDisplayLabel(type, stableKey, newLabel, doctorId) {
    doctorId = doctorId || _currentDoctorId();
    if (!doctorId || typeof db === 'undefined' || typeof BASE === 'undefined') return Promise.reject(new Error('no doctor/db context'));
    if (LABEL_TYPES.indexOf(type) === -1) return Promise.reject(new Error('unknown labelType: ' + type));
    newLabel = String(newLabel || '').trim();
    if (!newLabel) return resetDentalDisplayLabel(type, stableKey, doctorId);

    var previousValue = (_cache[doctorId] && _cache[doctorId][type]) ? (_cache[doctorId][type][stableKey] || null) : null;
    var ref = db.ref(BASE + '/doctor_dental_labels/' + doctorId + '/' + type + '/' + stableKey);
    return ref.set(newLabel).then(function () {
      if (typeof global.logAudit === 'function') {
        global.logAudit('DENTAL_LABEL_CUSTOMIZED', {
          doctorId: doctorId, clinicId: _currentClinicId(), labelType: type,
          stableKey: stableKey, previousValue: previousValue, newValue: newLabel
        }, 'DENTAL');
      }
    });
  }

  /** Clears a doctor's custom alias; canonical label returns automatically. */
  function resetDentalDisplayLabel(type, stableKey, doctorId) {
    doctorId = doctorId || _currentDoctorId();
    if (!doctorId || typeof db === 'undefined' || typeof BASE === 'undefined') return Promise.reject(new Error('no doctor/db context'));
    var previousValue = (_cache[doctorId] && _cache[doctorId][type]) ? (_cache[doctorId][type][stableKey] || null) : null;
    var ref = db.ref(BASE + '/doctor_dental_labels/' + doctorId + '/' + type + '/' + stableKey);
    return ref.remove().then(function () {
      if (typeof global.logAudit === 'function' && previousValue) {
        global.logAudit('DENTAL_LABEL_RESET', {
          doctorId: doctorId, clinicId: _currentClinicId(), labelType: type,
          stableKey: stableKey, previousValue: previousValue, newValue: null
        }, 'DENTAL');
      }
    });
  }

  /**
   * Builds the full row set for the Doctor Customization Screen
   * (section 26): every status, every condition, every one of the 128
   * procedures, each with { type, code, canonicalName, customName }.
   * Returns [] gracefully if the catalog/chart modules aren't loaded yet.
   */
  function getDentalCustomizationRows(doctorId) {
    doctorId = doctorId || _currentDoctorId();
    var rows = [];
    var DCM = global.DentalChartModule;
    var CAT = global.DentalProcedureCatalog;

    if (DCM && DCM.TOOTH_STATUSES) {
      Object.keys(DCM.TOOTH_STATUSES).forEach(function (key) {
        rows.push({ type: 'status', code: key, canonicalName: DCM.TOOTH_STATUSES[key].labelAr, customName: getDentalDisplayLabel('status', key, doctorId) === DCM.TOOTH_STATUSES[key].labelAr ? '' : getDentalDisplayLabel('status', key, doctorId) });
      });
    }
    if (DCM && DCM.SURFACE_CONDITIONS) {
      Object.keys(DCM.SURFACE_CONDITIONS).forEach(function (key) {
        rows.push({ type: 'condition', code: key, canonicalName: DCM.SURFACE_CONDITIONS[key].labelAr, customName: getDentalDisplayLabel('condition', key, doctorId) === DCM.SURFACE_CONDITIONS[key].labelAr ? '' : getDentalDisplayLabel('condition', key, doctorId) });
      });
    }
    if (CAT) {
      CAT.getAllProcedures().forEach(function (p) {
        var current = getDentalDisplayLabel('procedure', p.code, doctorId);
        rows.push({ type: 'procedure', code: p.code, canonicalName: p.nameAr, customName: current === p.nameAr ? '' : current });
      });
    }
    return rows;
  }

  var TYPE_LABELS_AR = { status: 'حالة السن', condition: 'حالة السطح', procedure: 'إجراء' };
  var _screenFilter = '';

  /**
   * Doctor Customization Screen (master spec section 26). Built the same
   * way dental_chart_module.js builds its own overlays (a plain
   * document.createElement overlay reusing the .dental-editor-overlay /
   * .dental-editor-card / .det-* CSS classes that dental_chart_module.js
   * already injects via _attachStyles()) — no new CSS file, no new
   * static HTML/modal markup required anywhere.
   */
  function openCustomizationModal() {
    var doctorId = _currentDoctorId();
    if (!doctorId) { if (typeof global.toast === 'function') global.toast('⚠️ تعذر تحديد هوية الطبيب', 'err'); return; }
    initForDoctor(doctorId);
    var existing = document.getElementById('_dental-labels-overlay');
    if (existing) existing.remove();
    _screenFilter = '';

    var overlay = document.createElement('div');
    overlay.id = '_dental-labels-overlay';
    overlay.className = 'dental-editor-overlay';
    overlay.style.zIndex = 10002;
    overlay.innerHTML = '<div class="dental-editor-card" style="max-width:640px">' + _buildCustomizationHTML(doctorId) + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  }

  function _buildCustomizationHTML(doctorId) {
    var rows = getDentalCustomizationRows(doctorId);
    if (_screenFilter) {
      var q = _screenFilter.trim();
      rows = rows.filter(function (r) { return r.code.indexOf(q) !== -1 || r.canonicalName.indexOf(q) !== -1; });
    }
    var body = rows.slice(0, 150).map(function (r) {
      var inputId = '_lbl-inp-' + r.type + '-' + r.code.replace(/[^a-zA-Z0-9_-]/g, '_');
      return '<div style="display:grid;grid-template-columns:80px 1fr 1fr auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem">' +
        '<div style="color:var(--muted)">' + _esc(TYPE_LABELS_AR[r.type] || r.type) + '<br><span style="font-family:monospace;font-size:0.7rem">' + _esc(r.code) + '</span></div>' +
        '<div>' + _esc(r.canonicalName) + '</div>' +
        '<input type="text" id="' + inputId + '" class="det-input" style="padding:4px 8px" placeholder="بدون تخصيص" value="' + _esc(r.customName) + '">' +
        '<button type="button" class="det-btn det-btn-cancel" style="padding:4px 8px;font-size:0.7rem" onclick="DentalLabelRegistry._resetRow(\'' + r.type + '\', \'' + r.code.replace(/'/g, "\\'") + '\')">إعادة</button>' +
        '</div>';
    }).join('') || '<div style="text-align:center;color:var(--muted);padding:20px">لا توجد نتائج</div>';

    return [
      '<div class="dental-editor-head"><div class="det-title">🎨 تخصيص مصطلحات الأسنان (خاص بك فقط)</div><div class="det-sub">تعديل الاسم هنا لا يغيّر الكود أو السجلات السابقة — يُطبَّق على شاشتك فقط</div></div>',
      '<div class="det-section"><input type="text" class="det-input" placeholder="ابحث بالكود أو الاسم..." value="', _esc(_screenFilter), '" oninput="DentalLabelRegistry._onScreenSearch(this.value)"></div>',
      '<div class="det-section" style="max-height:400px;overflow-y:auto">', body, '</div>',
      '<div class="det-actions"><button class="det-btn det-btn-save" onclick="DentalLabelRegistry._saveAllRows()"><i class="fas fa-save"></i> حفظ الكل</button><button class="det-btn det-btn-cancel" onclick="document.getElementById(\'_dental-labels-overlay\').remove()">إغلاق</button></div>'
    ].join('');
  }

  function _onScreenSearch(val) {
    _screenFilter = val;
    var doctorId = _currentDoctorId();
    var card = document.querySelector('#_dental-labels-overlay .dental-editor-card');
    if (card) card.innerHTML = _buildCustomizationHTML(doctorId);
  }

  function _resetRow(type, code) {
    var doctorId = _currentDoctorId();
    resetDentalDisplayLabel(type, code, doctorId).then(function () {
      var card = document.querySelector('#_dental-labels-overlay .dental-editor-card');
      if (card) card.innerHTML = _buildCustomizationHTML(doctorId);
    });
  }

  function _saveAllRows() {
    var doctorId = _currentDoctorId();
    var rows = getDentalCustomizationRows(doctorId);
    var writes = [];
    rows.forEach(function (r) {
      var inputId = '_lbl-inp-' + r.type + '-' + r.code.replace(/[^a-zA-Z0-9_-]/g, '_');
      var inp = document.getElementById(inputId);
      if (!inp) return; // filtered out of the current view — left untouched
      var val = inp.value.trim();
      if (val && val !== r.canonicalName && val !== r.customName) {
        writes.push(setDentalDisplayLabel(r.type, r.code, val, doctorId));
      } else if (!val && r.customName) {
        writes.push(resetDentalDisplayLabel(r.type, r.code, doctorId));
      }
    });
    Promise.all(writes).then(function () {
      if (typeof global.toast === 'function') global.toast('✅ تم حفظ التخصيصات', 'ok');
      var overlay = document.getElementById('_dental-labels-overlay');
      if (overlay) overlay.remove();
    }).catch(function () {
      if (typeof global.toast === 'function') global.toast('⚠️ حدث خطأ أثناء الحفظ', 'err');
    });
  }

  global.DentalLabelRegistry = {
    LABEL_TYPES: LABEL_TYPES.slice(),
    initForDoctor: initForDoctor,
    getDentalDisplayLabel: getDentalDisplayLabel,
    hasCustomLabel: hasCustomLabel,
    setDentalDisplayLabel: setDentalDisplayLabel,
    resetDentalDisplayLabel: resetDentalDisplayLabel,
    getDentalCustomizationRows: getDentalCustomizationRows,
    openCustomizationModal: openCustomizationModal,
    _onScreenSearch: _onScreenSearch, _resetRow: _resetRow, _saveAllRows: _saveAllRows,
    init: function () { console.log('[DentalLabelRegistry] v1.0 initialized.'); if (global.ArgonSession) initForDoctor(); }
  };
}(window));
