'use strict';
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║     ARGON MEDICAL OS v3.0 — Client-Side Local Backup Engine                ║
 * ║     محرك النسخ الاحتياطي المحلي للعميل — Enterprise Grade                ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  الإصدار  : 2.1.0                                                           ║
 * ║  التوافق  : Chrome / Edge 86+  (يتطلب File System Access API)              ║
 * ║  العزل    : معزول 100% — لا يُعدِّل argon-core.js أو billing-engine.js    ║
 * ║  المكتبات : صفر — Vanilla JS خالص + Web APIs مدمجة                         ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  المميزات :                                                                 ║
 * ║  ✅ حفظ مقبض المجلد في IndexedDB (مرة واحدة فقط عند الإعداد)              ║
 * ║  ✅ نسخ تلقائي صامت في الخلفية (setInterval مُدار بحذر)                  ║
 * ║  ✅ تدوير تلقائي (يحتفظ بآخر 7 نسخ — يحذف القديمة)                       ║
 * ║  ✅ معالجة ذكية لانتهاء الصلاحية وإعادة الطلب                             ║
 * ║  ✅ معالج أول تشغيل (First-Run Wizard)                                    ║
 * ║  ✅ لوحة إعدادات كاملة مع سجل النسخ                                        ║
 * ║  ✅ دعم تعدد العيادات (Multi-Clinic)                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

window.LocalBackupEngine = (function () {

  /* ════════════════════════════════════════
     0. ثوابت المحرك — Engine Constants
  ════════════════════════════════════════ */
  const VERSION        = '2.1.0';
  const IDB_DB_NAME    = 'ArgonLocalBackupDB_v2';
  const IDB_VERSION    = 2;
  const STORE_HANDLES  = 'dir_handles';    // مقابض المجلدات (FileSystemDirectoryHandle)
  const STORE_SETTINGS = 'engine_settings'; // إعدادات المحرك
  const STORE_LOG      = 'backup_log';     // سجل عمليات النسخ
  const MAX_BACKUPS    = 7;                // أقصى عدد نسخ يومية محفوظة
  const FILE_PREFIX    = 'ARGON_BACKUP_';
  const FILE_EXT       = '.json';
  const FIRST_RUN_DELAY_MS = 4000;        // تأخير ظهور معالج أول تشغيل (بعد الدخول)

  /* ════════════════════════════════════════
     1. الحالة الداخلية — Internal State
  ════════════════════════════════════════ */
  let _idb         = null;     // اتصال IndexedDB (singleton)
  let _clinicId    = null;     // معرّف العيادة النشطة
  let _timerRef    = null;     // مرجع setInterval — لإيقافه لمنع memory leak
  let _isRunning   = false;    // هل المحرك يعمل الآن؟
  let _dirHandle   = null;     // مقبض المجلد المحلي (FileSystemDirectoryHandle)
  let _settings    = {};       // نسخة مخبأة من الإعدادات
  let _panelOpen   = false;    // هل لوحة الإعدادات مفتوحة؟

  /* ════════════════════════════════════════
     2. تهيئة IndexedDB — IDB Init
  ════════════════════════════════════════ */

  /**
   * يفتح قاعدة بيانات IndexedDB مرة واحدة (Singleton Pattern)
   * وينشئ المخازن عند أول تشغيل أو ترقية الإصدار
   */
  function _openDB() {
    if (_idb) return Promise.resolve(_idb);

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);

      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        // مخزن مقابض المجلدات — يدعم تعدد العيادات بمفاتيح مختلفة
        if (!db.objectStoreNames.contains(STORE_HANDLES)) {
          db.createObjectStore(STORE_HANDLES);
        }
        // مخزن الإعدادات — إعدادات مستقلة لكل عيادة
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
        // مخزن سجل النسخ — يحفظ تاريخ كل عملية نسخ
        if (!db.objectStoreNames.contains(STORE_LOG)) {
          const logStore = db.createObjectStore(STORE_LOG, {
            keyPath: 'id',
            autoIncrement: true
          });
          // فهرسة بمعرف العيادة للاستعلام السريع
          logStore.createIndex('idx_clinic', 'clinicId', { unique: false });
          logStore.createIndex('idx_ts',     'ts',       { unique: false });
        }
      };

      req.onsuccess = function (e) {
        _idb = e.target.result;

        // معالجة إغلاق غير متوقع للقاعدة (مثلاً عند حذف المتصفح للبيانات)
        _idb.onversionchange = function () {
          _idb.close();
          _idb = null;
        };
        resolve(_idb);
      };

      req.onerror = function (e) {
        reject(new Error('[ArgonBackup] فشل فتح IndexedDB: ' + e.target.error));
      };
    });
  }

  /* ════════════════════════════════════════
     3. مساعدات IDB — IDB Helpers
     (Promise wrappers للعمليات الأساسية)
  ════════════════════════════════════════ */

  async function _idbGet(storeName, key) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror   = () => reject(new Error('IDB GET failed: ' + req.error));
    });
  }

  async function _idbPut(storeName, value, key) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(value, key);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(new Error('IDB PUT failed: ' + req.error));
    });
  }

  async function _idbAdd(storeName, value) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).add(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(new Error('IDB ADD failed: ' + req.error));
    });
  }

  async function _idbGetAllByIndex(storeName, indexName, query) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readonly');
      const idx   = tx.objectStore(storeName).index(indexName);
      const req   = idx.getAll(query);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(new Error('IDB INDEX GET ALL failed: ' + req.error));
    });
  }

  /* ════════════════════════════════════════
     4. إدارة مقبض المجلد — Handle Management
  ════════════════════════════════════════ */

  /** حفظ مقبض المجلد في IndexedDB بمفتاح خاص بالعيادة */
  async function _saveHandle(handle) {
    await _idbPut(STORE_HANDLES, handle, `handle_${_clinicId}`);
  }

  /** استرجاع مقبض المجلد من IndexedDB */
  async function _loadHandle() {
    try {
      return await _idbGet(STORE_HANDLES, `handle_${_clinicId}`);
    } catch (e) {
      console.warn('[ArgonBackup] تعذّر استرجاع مقبض المجلد:', e.message);
      return null;
    }
  }

  /* ════════════════════════════════════════
     5. إدارة الإعدادات — Settings Management
  ════════════════════════════════════════ */

  async function _saveSettings(patch) {
    const key      = `settings_${_clinicId}`;
    const current  = (await _idbGet(STORE_SETTINGS, key)) || {};
    const updated  = {
      ...current,
      ...patch,
      clinicId:  _clinicId,
      updatedAt: new Date().toISOString()
    };
    await _idbPut(STORE_SETTINGS, updated, key);
    _settings = updated; // تحديث النسخة المخبأة
    return updated;
  }

  async function _loadSettings() {
    try {
      const r = await _idbGet(STORE_SETTINGS, `settings_${_clinicId}`);
      _settings = r || {};
      return _settings;
    } catch (e) {
      _settings = {};
      return {};
    }
  }

  /* ════════════════════════════════════════
     6. فحص الصلاحيات — Permission Handling
  ════════════════════════════════════════ */

  /**
   * يفحص صلاحية القراءة والكتابة على المجلد
   * إذا انتهت: يطلبها مجدداً (يحتاج تفاعل المستخدم)
   * @param {FileSystemDirectoryHandle} handle
   * @returns {Promise<boolean>}
   */
  async function _verifyPermission(handle) {
    if (!handle) return false;
    try {
      // فحص الصلاحية الحالية أولاً (بدون طلب واجهة)
      const current = await handle.queryPermission({ mode: 'readwrite' });
      if (current === 'granted') return true;

      // الصلاحية منتهية أو مرفوضة — طلب إعادة التفعيل
      // (يحتاج هذا لنقرة المستخدم — لذا نستخدمه فقط في العمليات التفاعلية)
      const renewed = await handle.requestPermission({ mode: 'readwrite' });
      return renewed === 'granted';
    } catch (err) {
      // المقبض تالف أو بيئة غير مدعومة
      console.warn('[ArgonBackup] فشل فحص الصلاحية:', err.message);
      return false;
    }
  }

  /**
   * فحص صامت للصلاحية (بدون طلب — للمؤقتات الخلفية)
   * @param {FileSystemDirectoryHandle} handle
   * @returns {Promise<boolean>}
   */
  async function _queryPermissionSilent(handle) {
    if (!handle) return false;
    try {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      return perm === 'granted';
    } catch (e) {
      return false;
    }
  }

  /* ════════════════════════════════════════
     7. اختيار مجلد الحفظ — Directory Picker
  ════════════════════════════════════════ */

  /**
   * يفتح نافذة اختيار المجلد، يحفظ المقبض، ويُحدِّث الإعدادات
   * @returns {Promise<FileSystemDirectoryHandle>}
   */
  async function requestDirectoryAccess() {
    // فحص دعم المتصفح
    if (typeof window.showDirectoryPicker !== 'function') {
      throw new Error(
        'متصفحك لا يدعم File System Access API.\n' +
        'يُرجى استخدام Google Chrome أو Microsoft Edge إصدار 86 أو أحدث.'
      );
    }

    // فتح نافذة اختيار المجلد من نظام الملفات
    const handle = await window.showDirectoryPicker({
      mode:    'readwrite',
      startIn: 'documents',      // يبدأ من مجلد المستندات
      id:      'argon-backup-folder' // يتذكر آخر مجلد لهذا المعرف
    });

    // حفظ المقبض وتحديث الإعدادات
    await _saveHandle(handle);
    await _saveSettings({
      folderName:       handle.name,
      folderConfigured: true,
      configuredAt:     new Date().toISOString(),
      permissionOk:     true
    });

    _dirHandle = handle;
    _log('تم اختيار مجلد الحفظ: ' + handle.name, 'info');
    _updateSidebarDot('ok');
    _updateTopbarBadge('ok');

    return handle;
  }

  /* ════════════════════════════════════════
     8. جلب بيانات Firebase — Data Fetcher
  ════════════════════════════════════════ */

  /**
   * يجلب بيانات العيادة من Firebase RTDB باستخدام SDK المحمّل مسبقاً
   * @param {string} clinicId - معرف العيادة
   * @returns {Promise<Object>} - كائن JSON كامل مع metadata
   */
  async function fetchClinicData(clinicId) {
    // التحقق من وجود Firebase SDK في الصفحة
    if (typeof window.firebase === 'undefined' || !window.firebase.apps.length) {
      throw new Error('Firebase SDK غير مهيأ. تأكد من تحميل الصفحة بشكل صحيح.');
    }

    const dbRef = window.firebase.database();

    // جلب البيانات من Firebase (مرة واحدة — ليس listener)
    const snap = await dbRef.ref(`clinics/${clinicId}`).once('value');
    const data = snap.val();

    if (!data) {
      throw new Error(`لا توجد بيانات للعيادة: ${clinicId}. تحقق من الاتصال.`);
    }

    // حساب عدد السجلات للـ metadata
    const nodeCount = typeof data === 'object' ? Object.keys(data).length : 1;

    return {
      _meta: {
        backupEngine:  'ARGON Local Backup Engine v' + VERSION,
        clinicId,
        exportedAt:    new Date().toISOString(),
        nodeCount,
        checksum:      _simpleChecksum(JSON.stringify(data))
      },
      data
    };
  }

  /** توليد checksum بسيط للتحقق من سلامة البيانات */
  function _simpleChecksum(str) {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 10000); i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }

  /* ════════════════════════════════════════
     9. تدوير النسخ — Backup Rotation
  ════════════════════════════════════════ */

  /**
   * يقرأ المجلد ويحذف النسخ الأقدم من MAX_BACKUPS
   * يعمل بنمط حذف الأقدم أولاً (FIFO)
   * @param {FileSystemDirectoryHandle} dirHandle
   * @returns {Promise<{kept:number, deleted:number}>}
   */
  async function _rotateBackups(dirHandle) {
    const prefix = FILE_PREFIX + _clinicId + '_';
    const files  = [];

    // تجميع أسماء الملفات المطابقة للنمط
    try {
      for await (const [name] of dirHandle.entries()) {
        if (name.startsWith(prefix) && name.endsWith(FILE_EXT)) {
          files.push(name);
        }
      }
    } catch (e) {
      console.warn('[ArgonBackup] تعذّر قراءة محتويات المجلد:', e.message);
      return { kept: 0, deleted: 0 };
    }

    // ترتيب تصاعدي (يعمل بفضل صيغة YYYY-MM-DD_HH-MM-SS)
    files.sort();

    // تحديد الملفات الزائدة للحذف (الأقدم)
    const excessCount = Math.max(0, files.length - MAX_BACKUPS);
    const toDelete    = files.slice(0, excessCount);

    let deletedCount = 0;
    for (const fileName of toDelete) {
      try {
        await dirHandle.removeEntry(fileName);
        deletedCount++;
        _log(`تم حذف النسخة القديمة: ${fileName}`, 'rotate');
      } catch (e) {
        console.warn(`[ArgonBackup] تعذّر حذف ${fileName}:`, e.message);
      }
    }

    return {
      kept:    files.length - deletedCount,
      deleted: deletedCount
    };
  }

  /* ════════════════════════════════════════
     10. تنفيذ النسخة — Perform Backup
  ════════════════════════════════════════ */

  /**
   * ينفذ دورة نسخ احتياطي كاملة:
   * 1. التحقق من المجلد والصلاحيات
   * 2. جلب بيانات Firebase
   * 3. كتابة ملف JSON على القرص
   * 4. تدوير النسخ القديمة
   * 5. تسجيل العملية في IndexedDB
   *
   * @param {boolean} silent - صامت (للمؤقت الخلفي) أم يُظهر أخطاء
   * @returns {Promise<Object|null>} - سجل العملية أو null عند الفشل الصامت
   */
  async function performBackup(silent = true) {
    if (!_clinicId) {
      _log('performBackup: _clinicId غير معيّن', 'error');
      return null;
    }

    /* ── 10.1 استرجاع مقبض المجلد ── */
    let handle = _dirHandle;
    if (!handle) {
      handle = await _loadHandle();
      _dirHandle = handle;
    }

    if (!handle) {
      _emit('backup-skipped', { reason: 'no-folder', clinicId: _clinicId });
      if (!silent) throw new Error('لم يتم اختيار مجلد الحفظ بعد.');
      return null;
    }

    /* ── 10.2 فحص الصلاحيات (صامت في الخلفية) ── */
    const hasPermission = silent
      ? await _queryPermissionSilent(handle)
      : await _verifyPermission(handle);

    if (!hasPermission) {
      await _saveSettings({ permissionOk: false });
      _updateSidebarDot('warn');
      _updateTopbarBadge('warn');
      _emit('permission-revoked', { clinicId: _clinicId });

      if (!silent) {
        throw new Error(
          'انتهت صلاحية الوصول إلى المجلد.\n' +
          'يرجى النقر على "تغيير المجلد" لإعادة التفعيل.'
        );
      }

      // في الوضع الصامت: نظهر تنبيهاً للمستخدم ليعرف أن الصلاحية انتهت
      _showPermissionExpiredToast();
      return null;
    }

    /* ── 10.3 جلب البيانات من Firebase ── */
    _updateTopbarBadge('running');
    const startTime = Date.now();

    let payload;
    try {
      payload = await fetchClinicData(_clinicId);
    } catch (fetchErr) {
      _updateTopbarBadge('error');
      _log('فشل جلب البيانات من Firebase: ' + fetchErr.message, 'error');
      if (!silent) throw fetchErr;
      return null;
    }

    /* ── 10.4 بناء اسم الملف ── */
    const now      = new Date();
    const dateStr  = now.toISOString().slice(0, 10);                    // YYYY-MM-DD
    const timeStr  = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
    const fileName = `${FILE_PREFIX}${_clinicId}_${dateStr}_${timeStr}${FILE_EXT}`;

    /* ── 10.5 كتابة الملف على قرص المستخدم ── */
    const jsonString  = JSON.stringify(payload, null, 2);
    const encodedSize = new TextEncoder().encode(jsonString).length;

    try {
      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable   = await fileHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();
    } catch (writeErr) {
      _updateTopbarBadge('error');
      _log('فشل كتابة الملف على القرص: ' + writeErr.message, 'error');
      if (!silent) throw writeErr;
      return null;
    }

    /* ── 10.6 تدوير النسخ القديمة ── */
    const rotation = await _rotateBackups(handle);

    /* ── 10.7 تسجيل العملية في قاعدة البيانات المحلية ── */
    const duration = Date.now() - startTime;
    const logEntry = {
      clinicId:     _clinicId,
      ts:           now.toISOString(),
      fileName,
      sizeBytes:    encodedSize,
      sizeMB:       (encodedSize / (1024 * 1024)).toFixed(3),
      durationMs:   duration,
      rotated:      rotation.deleted,
      status:       'success',
      nodeCount:    payload._meta.nodeCount,
      checksum:     payload._meta.checksum
    };

    try {
      await _idbAdd(STORE_LOG, logEntry);
    } catch (e) {
      // فشل تسجيل السجل لا يوقف العملية
      console.warn('[ArgonBackup] تعذّر حفظ سجل النسخ:', e.message);
    }

    /* ── 10.8 تحديث الإعدادات وواجهة المستخدم ── */
    await _saveSettings({
      lastBackupAt:      now.toISOString(),
      lastBackupFile:    fileName,
      lastBackupSizeMB:  logEntry.sizeMB,
      lastBackupStatus:  'success',
      permissionOk:      true
    });

    _updateSidebarDot('ok');
    _updateTopbarBadge('ok');
    _log(`✅ نسخة محفوظة: ${fileName} — ${logEntry.sizeMB} MB في ${duration}ms`, 'success');
    _emit('backup-success', logEntry);

    // تحديث اللوحة إذا كانت مفتوحة
    if (_panelOpen) {
      setTimeout(() => _refreshPanel(), 200);
    }

    return logEntry;
  }

  /* ════════════════════════════════════════
     11. المحرك الصامت — Background Engine
  ════════════════════════════════════════ */

  /**
   * يبدأ المحرك الصامت (setInterval مُدار)
   * يُنفّذ نسخة فورية ثم دورية حسب الفترة المحددة
   *
   * ⚠️ منع memory leak: يوقف أي مؤقت سابق قبل البدء
   *
   * @param {string} clinicId
   * @param {number} intervalMinutes - الفترة بالدقائق (افتراضي: 60)
   */
  function startSilentBackupEngine(clinicId, intervalMinutes) {
    _clinicId       = String(clinicId);
    intervalMinutes = parseInt(intervalMinutes) || 60;

    /* إيقاف المؤقت السابق (يمنع تعدد المؤقتات) */
    stopBackupEngine();

    /* تنفيذ نسخة فورية عند الإطلاق */
    performBackup(true).catch(e =>
      console.warn('[ArgonBackup] النسخة الأولية فشلت (صامت):', e.message)
    );

    /* بدء المؤقت الدوري */
    const intervalMs = intervalMinutes * 60 * 1000;
    _timerRef  = setInterval(async function _backupTick() {
      try {
        await performBackup(true);
      } catch (e) {
        console.warn('[ArgonBackup] خطأ في الدورة التلقائية:', e.message);
        _updateTopbarBadge('error');
      }
    }, intervalMs);

    _isRunning = true;
    _log(`🟢 المحرك يعمل — كل ${intervalMinutes} دقيقة`, 'info');
    _emit('engine-started', { clinicId, intervalMinutes });
  }

  /** إيقاف المحرك وتحرير المؤقت من الذاكرة */
  function stopBackupEngine() {
    if (_timerRef !== null) {
      clearInterval(_timerRef);
      _timerRef  = null;
      _isRunning = false;
      _emit('engine-stopped', { clinicId: _clinicId });
    }
  }

  /* ════════════════════════════════════════
     12. الحالة العامة — Public Status
  ════════════════════════════════════════ */

  async function getStatus() {
    const s = await _loadSettings();
    const browserSupported = typeof window.showDirectoryPicker === 'function';
    return {
      version:           VERSION,
      clinicId:          _clinicId,
      isRunning:         _isRunning,
      browserSupported,
      folderConfigured:  !!s.folderConfigured,
      folderName:        s.folderName   || null,
      permissionOk:      s.permissionOk !== false,
      lastBackupAt:      s.lastBackupAt || null,
      lastBackupFile:    s.lastBackupFile || null,
      lastBackupSizeMB:  s.lastBackupSizeMB || null,
      lastBackupStatus:  s.lastBackupStatus || null,
      intervalMinutes:   s.intervalMinutes || 60,
      configuredAt:      s.configuredAt || null,
      maxBackups:        MAX_BACKUPS
    };
  }

  async function getBackupLog(limit) {
    limit = limit || 10;
    try {
      const all = await _idbGetAllByIndex(STORE_LOG, 'idx_clinic', _clinicId);
      return all
        .sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); })
        .slice(0, limit);
    } catch (e) {
      return [];
    }
  }

  /* ════════════════════════════════════════
     13. نظام الأحداث — Event Emitter
  ════════════════════════════════════════ */
  const _listeners = {};
  function _on(event, fn)  {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  }
  function _emit(event, data) {
    (_listeners[event] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { /* عزل أخطاء المستمعين */ }
    });
  }

  /* ════════════════════════════════════════
     14. السجل الداخلي — Internal Logger
  ════════════════════════════════════════ */
  function _log(msg, type) {
    const prefix = '[ArgonBackup]';
    if (type === 'error') console.error(prefix, msg);
    else if (type === 'success') console.log('%c' + prefix + ' ' + msg, 'color:#10b981;font-weight:bold');
    else console.log(prefix, msg);
  }

  /* ════════════════════════════════════════
     15. أنماط CSS — Injected Styles
  ════════════════════════════════════════ */

  function _injectStyles() {
    if (document.getElementById('argon-backup-css')) return;
    const s = document.createElement('style');
    s.id   = 'argon-backup-css';
    s.textContent = `
/* ══ ARGON LOCAL BACKUP ENGINE — Injected Styles ══ */
/* تستخدم متغيرات CSS الخاصة بنظام ARGON للتوافق مع Dark/Light Mode */

/* ── لوحة الإعدادات الرئيسية ── */
#abp-panel-overlay {
  position: fixed; inset: 0;
  background: rgba(3, 11, 10, 0.9);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 9999990;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  font-family: 'Tajawal', sans-serif;
  direction: rtl;
  animation: abp-in .22s cubic-bezier(.16,1,.3,1);
}
@keyframes abp-in {
  from { opacity: 0; transform: scale(.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1)  translateY(0); }
}

.abp-card {
  background: var(--panel, #0f172a);
  border: 1px solid var(--border, #334155);
  border-radius: 22px;
  padding: 30px 26px;
  width: 100%; max-width: 620px;
  max-height: 90vh; overflow-y: auto;
  box-shadow: 0 32px 80px rgba(0,0,0,.65);
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.06) transparent;
}

/* ── رأس اللوحة ── */
.abp-header {
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--border, #334155);
  padding-bottom: 16px; margin-bottom: 22px;
}
.abp-title {
  font-size: 1.2rem; font-weight: 900;
  color: var(--text, #f8fafc);
  display: flex; align-items: center; gap: 9px;
}
.abp-version-tag {
  font-size: .58rem; font-weight: 900; letter-spacing: 1px;
  background: linear-gradient(135deg, #0d9488, #0ea5e9);
  padding: 2px 8px; border-radius: 5px; color: #fff;
}
.abp-close-btn {
  background: rgba(239,68,68,.09); border: 1px solid rgba(239,68,68,.2);
  color: #fca5a5; border-radius: 8px; padding: 6px 14px;
  font-family: 'Tajawal', sans-serif; font-size: .83rem;
  cursor: pointer; transition: .2s;
}
.abp-close-btn:hover { background: rgba(239,68,68,.18); }

/* ── بلوك الحالة ── */
.abp-status-block {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 15px 18px; border-radius: 13px;
  border: 1px solid; margin-bottom: 20px;
  transition: all .3s;
}
.abp-status-icon  { font-size: 2rem; flex-shrink: 0; line-height: 1; }
.abp-status-tag   { font-size: .68rem; font-weight: 700; opacity: .7; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .5px; }
.abp-status-title { font-size: .97rem; font-weight: 800; }
.abp-status-sub   { font-size: .75rem; margin-top: 3px; opacity: .8; }
.abp-s-ok     { background: rgba(16,185,129,.06); border-color: rgba(16,185,129,.3); color: #10b981; }
.abp-s-warn   { background: rgba(245,158,11,.06); border-color: rgba(245,158,11,.3); color: #d97706; }
.abp-s-error  { background: rgba(239,68,68,.06);  border-color: rgba(239,68,68,.3);  color: #ef4444; }
.abp-s-idle   { background: rgba(100,116,139,.05);border-color: rgba(100,116,139,.25);color: #64748b; }

/* ── أقسام اللوحة ── */
.abp-section { margin-bottom: 20px; }
.abp-section-title {
  font-size: .68rem; font-weight: 800;
  letter-spacing: 2px; text-transform: uppercase;
  color: var(--muted, #64748b);
  margin-bottom: 11px; padding-bottom: 6px;
  border-bottom: 1px dashed var(--border, #334155);
  display: flex; align-items: center; gap: 6px;
}

/* ── صندوق المجلد ── */
.abp-folder-box {
  background: var(--surf, #1e293b);
  border: 1px solid var(--border, #334155);
  border-radius: 12px; padding: 13px 16px;
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 12px;
}
.abp-folder-icon  { font-size: 1.7rem; flex-shrink: 0; }
.abp-folder-name  { font-weight: 800; font-size: .93rem; color: var(--text, #f8fafc); }
.abp-folder-label { font-size: .7rem; color: var(--muted, #64748b); margin-top: 2px; }
.abp-folder-empty {
  background: rgba(245,158,11,.04);
  border: 1px dashed rgba(245,158,11,.35);
  border-radius: 12px; padding: 18px;
  text-align: center; color: #fcd34d;
  margin-bottom: 12px;
}

/* ── الأزرار ── */
.abp-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 17px; border-radius: 10px;
  font-family: 'Tajawal', sans-serif; font-weight: 700;
  font-size: .86rem; cursor: pointer; transition: .2s;
  border: 1px solid; white-space: nowrap;
}
.abp-btn:disabled { opacity: .5; cursor: not-allowed !important; transform: none !important; }
.abp-btn-primary {
  background: linear-gradient(135deg, #0d9488, #0ea5e9);
  border-color: transparent; color: #fff;
}
.abp-btn-primary:not(:disabled):hover { opacity: .88; transform: translateY(-1px); }
.abp-btn-ghost {
  background: var(--surf, #1e293b);
  border-color: var(--border, #334155);
  color: var(--text, #f8fafc);
}
.abp-btn-ghost:not(:disabled):hover { border-color: rgba(13,148,136,.45); }
.abp-btn-now {
  background: rgba(16,185,129,.1);
  border-color: rgba(16,185,129,.3);
  color: #10b981;
}
.abp-btn-danger {
  background: rgba(239,68,68,.08);
  border-color: rgba(239,68,68,.25);
  color: #fca5a5;
}
.abp-btns-row { display: flex; gap: 8px; flex-wrap: wrap; }

/* ── محدد الفترة ── */
.abp-intervals { display: flex; gap: 7px; flex-wrap: wrap; }
.abp-iv-btn {
  padding: 6px 14px; border-radius: 20px;
  font-family: 'Tajawal', sans-serif; font-weight: 700;
  font-size: .78rem; cursor: pointer; transition: .2s;
  background: var(--surf, #1e293b);
  border: 1.5px solid var(--border, #334155);
  color: var(--muted, #64748b);
}
.abp-iv-btn:hover  { border-color: rgba(13,148,136,.4); color: #5eead4; }
.abp-iv-btn.active {
  background: rgba(13,148,136,.15);
  border-color: rgba(13,148,136,.55);
  color: #5eead4;
}

/* ── شبكة الإحصائيات ── */
.abp-stats-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 9px; margin-bottom: 4px;
}
.abp-stat-card {
  background: var(--surf, #1e293b);
  border: 1px solid var(--border, #334155);
  border-radius: 10px; padding: 12px;
  text-align: center;
}
.abp-stat-label { font-size: .63rem; color: var(--muted, #64748b); margin-bottom: 5px; }
.abp-stat-value {
  font-weight: 800; font-size: .85rem;
  font-family: 'IBM Plex Mono', monospace;
  color: var(--text, #f8fafc);
}

/* ── جدول السجل ── */
.abp-log-table { width: 100%; border-collapse: collapse; font-size: .78rem; }
.abp-log-table th {
  text-align: right; padding: 7px 10px;
  background: var(--surf, #1e293b);
  color: var(--muted, #64748b);
  font-weight: 700; font-size: .67rem; letter-spacing: .5px;
}
.abp-log-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #334155);
  color: var(--text, #f8fafc);
}
.abp-log-table tbody tr:hover td { background: rgba(255,255,255,.025); }

/* ── تحذير المتصفح ── */
.abp-browser-warn {
  background: rgba(245,158,11,.07);
  border: 1px solid rgba(245,158,11,.28);
  border-radius: 10px; padding: 13px 15px;
  color: #fcd34d; font-size: .8rem; line-height: 1.7;
  margin-bottom: 16px;
}

/* ── ملاحظة أمان ── */
.abp-security-note {
  background: rgba(13,148,136,.04);
  border: 1px solid rgba(13,148,136,.14);
  border-radius: 10px; padding: 13px 15px;
  font-size: .76rem; color: var(--muted, #64748b);
  line-height: 1.85; margin-top: 6px;
}
.abp-security-note strong { color: #5eead4; }

/* ══ زر الشريط الجانبي ══ */
#abp-sidebar-btn {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 14px; margin: 1px 6px;
  border-radius: 9px; cursor: pointer;
  color: var(--muted, #64748b);
  font-size: .86rem; font-weight: 500;
  transition: .2s; border: none; background: none;
  font-family: 'Tajawal', sans-serif;
  direction: rtl; width: calc(100% - 12px);
  text-align: right;
}
#abp-sidebar-btn:hover { background: rgba(255,255,255,.025); color: var(--text, #f8fafc); }
#abp-sidebar-btn .abp-dot {
  margin-right: auto; width: 8px; height: 8px;
  border-radius: 50%; flex-shrink: 0; transition: .3s;
}
.abp-dot-ok    { background: #10b981; box-shadow: 0 0 7px rgba(16,185,129,.7); }
.abp-dot-warn  { background: #d97706; box-shadow: 0 0 7px rgba(217,119,6,.7); }
.abp-dot-error { background: #ef4444; box-shadow: 0 0 7px rgba(239,68,68,.7); }
.abp-dot-idle  { background: #475569; }
@keyframes abp-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
.abp-dot-ok.abp-anim { animation: abp-pulse 2s infinite; }

/* ══ شارة الـ Topbar ══ */
#abp-topbar-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: .67rem; font-weight: 700;
  padding: 4px 10px; border-radius: 20px;
  border: 1px solid; cursor: pointer;
  transition: background .3s, color .3s;
  font-family: 'Tajawal', sans-serif;
  white-space: nowrap;
}

/* ══ First-Run Wizard ══ */
#abp-firstrun-wizard {
  position: fixed; bottom: 24px; left: 24px;
  z-index: 9999980;
  background: var(--panel, #0f172a);
  border: 1px solid rgba(13,148,136,.45);
  border-radius: 18px; padding: 20px 22px;
  max-width: 330px; width: calc(100% - 32px);
  box-shadow: 0 18px 50px rgba(0,0,0,.55);
  font-family: 'Tajawal', sans-serif;
  direction: rtl;
  animation: abp-in .4s cubic-bezier(.16,1,.3,1);
}

/* ══ Toast صلاحية منتهية ══ */
#abp-perm-toast {
  position: fixed; top: 68px; right: 16px;
  z-index: 9999970;
  background: rgba(245,158,11,.92);
  color: #000; border-radius: 10px;
  padding: 11px 16px; font-weight: 700;
  font-size: .83rem; font-family: 'Tajawal', sans-serif;
  direction: rtl; max-width: 320px;
  box-shadow: 0 8px 24px rgba(0,0,0,.3);
  animation: abp-in .3s ease;
  cursor: pointer;
}
`;
    document.head.appendChild(s);
  }

  /* ════════════════════════════════════════
     16. واجهة المستخدم — UI Components
  ════════════════════════════════════════ */

  /* ── شارة Topbar ── */
  function _injectTopbarBadge() {
    if (document.getElementById('abp-topbar-badge')) return;
    const topbarRight = document.querySelector('.topbar .tr');
    if (!topbarRight) return;

    const badge = document.createElement('span');
    badge.id    = 'abp-topbar-badge';
    badge.title = 'النسخ الاحتياطي المحلي — انقر للإعدادات';
    badge.addEventListener('click', function () { showPanel(); });
    topbarRight.prepend(badge);
    _updateTopbarBadge('idle');
  }

  /* ── زر الشريط الجانبي ── */
  function _injectSidebarButton() {
    if (document.getElementById('abp-sidebar-btn')) return;
    const sidebar = document.querySelector('.sidebar');
    const footer  = sidebar ? sidebar.querySelector('.royal-foot') : null;
    if (!footer) return;

    const btn = document.createElement('button');
    btn.id    = 'abp-sidebar-btn';
    btn.innerHTML = `
      <i class="fas fa-hard-drive" style="width:16px;text-align:center;font-size:.83rem;flex-shrink:0"></i>
      <span>النسخ الاحتياطي</span>
      <span class="abp-dot abp-dot-idle" title="حالة المحرك"></span>
    `;
    btn.addEventListener('click', function () { showPanel(); });
    sidebar.insertBefore(btn, footer);
  }

  /* ── تحديث لون النقطة في الشريط الجانبي ── */
  function _updateSidebarDot(state) {
    const dot = document.querySelector('#abp-sidebar-btn .abp-dot');
    if (!dot) return;
    dot.className = 'abp-dot ' + ({
      ok:      'abp-dot-ok abp-anim',
      running: 'abp-dot-ok abp-anim',
      warn:    'abp-dot-warn',
      error:   'abp-dot-error',
      idle:    'abp-dot-idle'
    }[state] || 'abp-dot-idle');
  }

  /* ── تحديث شارة الـ Topbar ── */
  function _updateTopbarBadge(state) {
    const el = document.getElementById('abp-topbar-badge');
    if (!el) return;
    const M = {
      ok:      { bg: 'rgba(16,185,129,.1)',   bd: 'rgba(16,185,129,.3)', cl: '#10b981', txt: '🟢 محمي' },
      running: { bg: 'rgba(14,165,233,.1)',   bd: 'rgba(14,165,233,.3)', cl: '#38bdf8', txt: '⏳ جارٍ الحفظ' },
      warn:    { bg: 'rgba(245,158,11,.1)',   bd: 'rgba(245,158,11,.3)', cl: '#fcd34d', txt: '⚠️ انتهت الصلاحية' },
      error:   { bg: 'rgba(239,68,68,.1)',    bd: 'rgba(239,68,68,.3)',  cl: '#fca5a5', txt: '🔴 خطأ' },
      idle:    { bg: 'rgba(100,116,139,.1)',  bd: 'rgba(100,116,139,.3)',cl: '#94a3b8', txt: '⚫ غير مُعدّ' }
    };
    const m = M[state] || M.idle;
    el.style.background  = m.bg;
    el.style.borderColor = m.bd;
    el.style.color       = m.cl;
    el.textContent       = m.txt;
  }

  /* ── Toast انتهاء الصلاحية ── */
  function _showPermissionExpiredToast() {
    if (document.getElementById('abp-perm-toast')) return;
    const t = document.createElement('div');
    t.id = 'abp-perm-toast';
    t.innerHTML = '⚠️ <b>انتهت صلاحية مجلد النسخ الاحتياطي</b> — انقر هنا لإعادة التفعيل';
    t.addEventListener('click', function () { t.remove(); showPanel(); });
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 12000);
  }

  /* ════════════════════════════════════════
     17. لوحة الإعدادات الكاملة — Full Panel
  ════════════════════════════════════════ */

  async function showPanel() {
    _injectStyles();
    _panelOpen = true;

    // إزالة أي لوحة أو معالج أول تشغيل مفتوح
    const old = document.getElementById('abp-panel-overlay');
    if (old) old.remove();
    const wiz = document.getElementById('abp-firstrun-wizard');
    if (wiz) wiz.remove();

    const status = await getStatus();
    const log    = await getBackupLog(8);

    const overlay = document.createElement('div');
    overlay.id    = 'abp-panel-overlay';

    // إغلاق بالنقر خارج اللوحة
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) _closePanel();
    });

    overlay.innerHTML = _buildPanelHTML(status, log);
    document.body.appendChild(overlay);
    _bindPanelEvents(overlay, status);
  }

  function _closePanel() {
    _panelOpen = false;
    const el = document.getElementById('abp-panel-overlay');
    if (el) el.remove();
  }

  async function _refreshPanel() {
    if (!_panelOpen) return;
    const old = document.getElementById('abp-panel-overlay');
    if (!old) { _panelOpen = false; return; }
    const status = await getStatus();
    const log    = await getBackupLog(8);
    const card   = old.querySelector('.abp-card');
    if (card) card.innerHTML = _buildPanelContent(status, log);
    _bindPanelEvents(old, status);
  }

  /* ── HTML داخل اللوحة ── */
  function _buildPanelHTML(status, log) {
    return `<div class="abp-card">${_buildPanelContent(status, log)}</div>`;
  }

  function _buildPanelContent(status, log) {
    /* حالة الحماية */
    let sClass, sIcon, sTitle, sSub;
    if (!status.browserSupported) {
      sClass = 'abp-s-warn'; sIcon = '⚠️';
      sTitle = 'المتصفح لا يدعم هذه الميزة';
      sSub   = 'يتطلب Chrome أو Edge إصدار 86+';
    } else if (!status.folderConfigured) {
      sClass = 'abp-s-idle'; sIcon = '📂';
      sTitle = 'النسخ الاحتياطي غير مُعدّ بعد';
      sSub   = 'اختر مجلداً على جهازك لبدء حماية البيانات';
    } else if (!status.permissionOk) {
      sClass = 'abp-s-warn'; sIcon = '🔒';
      sTitle = 'انتهت صلاحية الوصول للمجلد';
      sSub   = 'انقر "تغيير المجلد" وأعد اختياره لتفعيل الحماية';
    } else {
      sClass = 'abp-s-ok'; sIcon = '🛡️';
      sTitle = 'بياناتك محمية — المحرك يعمل';
      sSub   = status.lastBackupAt
        ? 'آخر نسخة: ' + new Date(status.lastBackupAt).toLocaleString('ar-JO', {dateStyle:'short', timeStyle:'short'})
        : 'جارٍ إعداد أول نسخة...';
    }

    /* جدول السجل */
    const logRows = log.length ? log.map(function (l) {
      return `<tr>
        <td>${new Date(l.ts).toLocaleString('ar-JO', {dateStyle:'short', timeStyle:'short'})}</td>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:.7rem;color:#94a3b8;direction:ltr">${l.fileName.slice(-28)}</td>
        <td style="font-family:'IBM Plex Mono',monospace">${l.sizeMB} MB</td>
        <td style="color:#10b981;font-weight:700">${l.durationMs}ms ✓</td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--muted)">لا يوجد سجل بعد</td></tr>`;

    /* محددات الفترة */
    const ivs = [15, 30, 60, 120, 360, 720];
    const ivBtns = ivs.map(function (m) {
      const active = status.intervalMinutes === m ? ' active' : '';
      const lbl    = m < 60 ? m + ' دقيقة' : (m / 60) + ' ساعة';
      return `<button class="abp-iv-btn${active}" data-min="${m}" onclick="LocalBackupEngine._changeInterval(${m})">${lbl}</button>`;
    }).join('');

    /* إحصائيات */
    const lastTime  = status.lastBackupAt
      ? new Date(status.lastBackupAt).toLocaleTimeString('ar-JO', {hour:'2-digit', minute:'2-digit'}) : '—';
    const lastSize  = status.lastBackupSizeMB ? status.lastBackupSizeMB + ' MB' : '—';

    return `
      <!-- رأس اللوحة -->
      <div class="abp-header">
        <div class="abp-title">
          <span>💾</span>
          النسخ الاحتياطي المحلي
          <span class="abp-version-tag">v${VERSION}</span>
        </div>
        <button class="abp-close-btn" onclick="LocalBackupEngine._closePanel()">✕ إغلاق</button>
      </div>

      ${!status.browserSupported ? `
        <div class="abp-browser-warn">
          ⚠️ <strong>تنبيه:</strong> ميزة الحفظ المحلي تتطلب
          <strong>Google Chrome أو Microsoft Edge إصدار 86 أو أحدث.</strong>
          متصفحك الحالي لا يدعم File System Access API.
          يُرجى تحديث المتصفح أو التبديل لضمان حماية بيانات عيادتك.
        </div>` : ''}

      <!-- حالة المحرك -->
      <div class="abp-status-block ${sClass}">
        <span class="abp-status-icon">${sIcon}</span>
        <div>
          <div class="abp-status-tag">حالة محرك الحماية</div>
          <div class="abp-status-title">${sTitle}</div>
          <div class="abp-status-sub">${sSub}</div>
        </div>
      </div>

      <!-- مجلد الحفظ -->
      <div class="abp-section">
        <div class="abp-section-title">📂 مجلد الحفظ على جهازك</div>

        ${status.folderConfigured
          ? `<div class="abp-folder-box">
               <span class="abp-folder-icon">🗂️</span>
               <div style="flex:1;min-width:0">
                 <div class="abp-folder-name">${_esc(status.folderName || 'مجلد محدد')}</div>
                 <div class="abp-folder-label">النسخ تُحفظ تلقائياً في هذا المجلد بصيغة JSON</div>
               </div>
             </div>`
          : `<div class="abp-folder-empty">
               <div style="font-size:1.8rem;margin-bottom:6px">📂</div>
               <div style="font-weight:700;margin-bottom:4px">لم يتم اختيار مجلد بعد</div>
               <div style="font-size:.77rem;opacity:.8">اضغط الزر أدناه واختر أي مجلد على جهازك أو قرص خارجي</div>
             </div>`}

        <div class="abp-btns-row">
          <button class="abp-btn abp-btn-primary" id="abp-choose-btn" ${!status.browserSupported ? 'disabled' : ''}>
            <i class="fas fa-folder-open"></i>
            ${status.folderConfigured ? 'تغيير المجلد' : 'اختيار مجلد الحفظ'}
          </button>
          ${status.folderConfigured ? `
            <button class="abp-btn abp-btn-now" id="abp-now-btn">
              <i class="fas fa-save"></i> نسخ الآن
            </button>` : ''}
        </div>
      </div>

      ${status.folderConfigured ? `
        <!-- فترة النسخ التلقائي -->
        <div class="abp-section">
          <div class="abp-section-title">⏱️ فترة النسخ التلقائي</div>
          <div class="abp-intervals">${ivBtns}</div>
          <div style="font-size:.71rem;color:var(--muted);margin-top:9px">
            💡 يُنصح بكل <strong style="color:#5eead4">60 دقيقة</strong> للموازنة بين الحماية وسرعة الشبكة
          </div>
        </div>

        <!-- الإحصائيات -->
        <div class="abp-section">
          <div class="abp-section-title">📊 إحصائيات الحماية</div>
          <div class="abp-stats-grid">
            <div class="abp-stat-card">
              <div class="abp-stat-label">آخر نسخة</div>
              <div class="abp-stat-value" style="font-size:.78rem">${lastTime}</div>
            </div>
            <div class="abp-stat-card">
              <div class="abp-stat-label">حجم آخر ملف</div>
              <div class="abp-stat-value">${lastSize}</div>
            </div>
            <div class="abp-stat-card">
              <div class="abp-stat-label">الاحتفاظ بـ</div>
              <div class="abp-stat-value">${MAX_BACKUPS} نسخ</div>
            </div>
          </div>
        </div>

        <!-- سجل النسخ -->
        <div class="abp-section">
          <div class="abp-section-title">📋 سجل آخر العمليات</div>
          <div style="border:1px solid var(--border,#334155);border-radius:10px;overflow:hidden">
            <table class="abp-log-table">
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>اسم الملف</th>
                  <th>الحجم</th>
                  <th>المدة</th>
                </tr>
              </thead>
              <tbody>${logRows}</tbody>
            </table>
          </div>
        </div>` : ''}

      <!-- ملاحظات أمنية -->
      <div class="abp-security-note">
        <div style="color:#5eead4;font-weight:800;margin-bottom:7px">🔐 معلومات أمنية مهمة:</div>
        <div>• يُحفظ كل شيء <strong>مباشرةً</strong> على قرصك — لا يُرسَل أي شيء لخادم خارجي</div>
        <div>• يُحتفَظ تلقائياً بآخر <strong>${MAX_BACKUPS} نسخ</strong> ويُحذَف الأقدم لتوفير المساحة</div>
        <div>• الملفات بصيغة <strong>JSON قابلة للاستعادة</strong> من أي جهاز في أي وقت</div>
        <div>• عند تغيير الجهاز أو المتصفح: اضغط <strong>"تغيير المجلد"</strong> لإعادة الربط</div>
        <div>• يعمل <strong>حتى بدون إنترنت</strong> ما دام Firebase قد حمّل البيانات مرة واحدة</div>
      </div>
    `;
  }

  /* ── ربط أحداث اللوحة ── */
  function _bindPanelEvents(overlay, status) {
    /* زر اختيار / تغيير المجلد */
    const chooseBtn = overlay.querySelector('#abp-choose-btn');
    if (chooseBtn) {
      chooseBtn.addEventListener('click', async function () {
        chooseBtn.disabled = true;
        chooseBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> جارٍ الاختيار...';
        try {
          await requestDirectoryAccess();
          const s   = await _loadSettings();
          const ivM = parseInt(s.intervalMinutes) || 60;
          startSilentBackupEngine(_clinicId, ivM);
          setTimeout(function () { _refreshPanel(); }, 400);
        } catch (e) {
          if (e.name !== 'AbortError') {
            alert('❌ تعذّر اختيار المجلد:\n' + e.message);
          }
          chooseBtn.disabled = false;
          chooseBtn.innerHTML = '<i class="fas fa-folder-open"></i> اختيار مجلد الحفظ';
        }
      });
    }

    /* زر النسخ الفوري */
    const nowBtn = overlay.querySelector('#abp-now-btn');
    if (nowBtn) {
      nowBtn.addEventListener('click', async function () {
        nowBtn.disabled = true;
        nowBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> جارٍ الحفظ...';
        try {
          await performBackup(false);
          nowBtn.innerHTML = '<i class="fas fa-check"></i> تم بنجاح!';
          setTimeout(function () { _refreshPanel(); }, 700);
        } catch (e) {
          alert('❌ فشل النسخ:\n' + e.message);
          nowBtn.disabled = false;
          nowBtn.innerHTML = '<i class="fas fa-save"></i> نسخ الآن';
        }
      });
    }
  }

  /* ── تغيير الفترة الزمنية (يُستدعى من HTML) ── */
  async function _changeInterval(minutes) {
    await _saveSettings({ intervalMinutes: minutes });
    startSilentBackupEngine(_clinicId, minutes);
    // تحديث أزرار الاختيار دون إعادة بناء اللوحة كاملاً
    document.querySelectorAll('.abp-iv-btn').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.min) === minutes);
    });
    // toast
    if (typeof window.toast === 'function') {
      window.toast('✅ تم تغيير فترة النسخ إلى ' + (minutes < 60 ? minutes + ' دقيقة' : (minutes / 60) + ' ساعة'), 'ok');
    }
  }

  /* ════════════════════════════════════════
     18. معالج أول تشغيل — First-Run Wizard
  ════════════════════════════════════════ */

  function _showFirstRunWizard() {
    if (!_settings || _settings.folderConfigured) return;
    if (typeof window.showDirectoryPicker !== 'function') return;
    if (document.getElementById('abp-firstrun-wizard')) return;

    _injectStyles();
    const wiz = document.createElement('div');
    wiz.id = 'abp-firstrun-wizard';
    wiz.innerHTML = `
      <button onclick="document.getElementById('abp-firstrun-wizard').remove()"
        style="position:absolute;top:10px;left:13px;background:none;border:none;
               color:var(--muted,#64748b);cursor:pointer;font-size:1rem;padding:2px">✕</button>
      <div style="display:flex;align-items:center;gap:11px;margin-bottom:13px">
        <span style="font-size:2rem;line-height:1">💾</span>
        <div>
          <div style="font-weight:900;font-size:1rem;color:var(--text,#f8fafc)">حماية بياناتك أولوية</div>
          <div style="font-size:.73rem;color:var(--muted,#64748b);margin-top:1px">إعداد النسخ الاحتياطي المحلي</div>
        </div>
      </div>
      <div style="font-size:.8rem;color:var(--muted,#64748b);line-height:1.75;margin-bottom:14px">
        لم يتم بعد إعداد النسخ الاحتياطي لهذه العيادة.
        احمِ بيانات مرضاك بنسخ تلقائية <strong style="color:#5eead4">على جهازك مباشرةً</strong>
        دون إرسالها لأي خادم خارجي.
      </div>
      <div style="display:flex;gap:8px">
        <button id="abp-wiz-setup"
          style="flex:1;background:linear-gradient(135deg,#0d9488,#0ea5e9);
                 border:none;border-radius:10px;padding:10px;color:#fff;
                 font-family:'Tajawal',sans-serif;font-weight:800;font-size:.87rem;cursor:pointer">
          <i class="fas fa-shield-alt"></i> إعداد الحماية الآن
        </button>
        <button onclick="document.getElementById('abp-firstrun-wizard').remove()"
          style="background:var(--surf,#1e293b);border:1px solid var(--border,#334155);
                 border-radius:10px;padding:10px 13px;color:var(--muted,#64748b);
                 font-family:'Tajawal',sans-serif;cursor:pointer;font-size:.82rem">
          لاحقاً
        </button>
      </div>
    `;
    document.body.appendChild(wiz);

    document.getElementById('abp-wiz-setup').addEventListener('click', function () {
      wiz.remove();
      showPanel();
    });
  }

  /* ════════════════════════════════════════
     19. حقن عناصر الواجهة — UI Injection
  ════════════════════════════════════════ */

  function _injectUI() {
    _injectSidebarButton();
    _injectTopbarBadge();
  }

  /* ── فحص جاهزية DOM ── */
  function _onDOMReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  /* ════════════════════════════════════════
     20. نقطة الدخول الرئيسية — init()
  ════════════════════════════════════════ */

  /**
   * يُهيئ المحرك بعد تأكيد تسجيل دخول المستخدم
   * يُستدعى من dashboard.html بعد نجاح doLogin()
   *
   * @param {string|number} clinicId - معرّف العيادة
   */
  async function init(clinicId) {
    if (!clinicId) {
      console.error('[ArgonBackup] ❌ init() يتطلب clinicId');
      return;
    }

    _clinicId = String(clinicId);
    _injectStyles();
    await _openDB(); // تهيئة IndexedDB مبكراً

    /* حقن عناصر الواجهة فور جاهزية DOM */
    _onDOMReady(_injectUI);

    /* استرجاع الإعدادات المحفوظة */
    const s = await _loadSettings();

    if (!s.folderConfigured) {
      /* === أول تشغيل: إظهار معالج الإعداد بعد تأخير بسيط === */
      _updateSidebarDot('idle');
      _updateTopbarBadge('idle');
      setTimeout(_showFirstRunWizard, FIRST_RUN_DELAY_MS);
      _log('أول تشغيل — في انتظار إعداد المجلد', 'info');
      return;
    }

    /* === جهاز مُعدَّ مسبقاً: استعادة المقبض وتشغيل المحرك === */
    try {
      const handle = await _loadHandle();
      if (handle) {
        _dirHandle = handle;

        /* فحص صامت للصلاحية (لا يحتاج نقرة مستخدم) */
        const permOk = await _queryPermissionSilent(handle);

        if (permOk) {
          const ivMin = parseInt(s.intervalMinutes) || 60;
          startSilentBackupEngine(_clinicId, ivMin);
          _updateSidebarDot('ok');
          _updateTopbarBadge('ok');
          _log(`✅ المحرك مُستعاد — "${s.folderName}" — كل ${ivMin} دقيقة`, 'success');
        } else {
          /* الصلاحية تحتاج تجديداً يدوياً */
          await _saveSettings({ permissionOk: false });
          _updateSidebarDot('warn');
          _updateTopbarBadge('warn');
          _log('⚠️ الصلاحية تحتاج تجديداً — يرجى النقر على الزر', 'info');

          // إظهار تلميح للمستخدم بعد لحظة
          setTimeout(_showPermissionExpiredToast, 2000);
        }
      } else {
        _updateSidebarDot('idle');
        _updateTopbarBadge('idle');
        _log('لا يوجد مقبض محفوظ رغم وجود إعدادات — يرجى إعادة الإعداد', 'info');
      }
    } catch (e) {
      _updateSidebarDot('error');
      _updateTopbarBadge('error');
      console.error('[ArgonBackup] فشل استعادة المحرك:', e);
    }
  }

  /* ════════════════════════════════════════
     مساعد: Escape HTML لمنع XSS
  ════════════════════════════════════════ */
  function _esc(str) {
    return String(str || '').replace(/[<>"'&]/g, function (c) {
      return ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' })[c];
    });
  }

  /* ════════════════════════════════════════
     21. الواجهة العامة — Public API
  ════════════════════════════════════════ */
  return {
    /** نقطة الدخول الرئيسية — يُستدعى بعد تسجيل الدخول */
    init,

    /** فتح لوحة إعدادات النسخ الاحتياطي */
    showPanel,

    /** إغلاق اللوحة (يُستدعى من HTML) */
    _closePanel,

    /** تغيير الفترة الزمنية (يُستدعى من HTML inline) */
    _changeInterval,

    /** تنفيذ نسخة احتياطية يدوية فورية */
    performBackup,

    /** فتح نافذة اختيار المجلد */
    requestDirectoryAccess,

    /** جلب بيانات Firebase (للاستخدام الخارجي أو الاختبار) */
    fetchClinicData,

    /** بدء المحرك الصامت */
    startSilentBackupEngine,

    /** إيقاف المحرك */
    stopBackupEngine,

    /** استرجاع الحالة الكاملة */
    getStatus,

    /** استرجاع سجل النسخ */
    getBackupLog,

    /** الاستماع للأحداث: backup-success, engine-started, permission-revoked */
    on: _on,

    /** الإصدار */
    get version() { return VERSION; },

    /** هل المحرك يعمل؟ */
    get isRunning() { return _isRunning; }
  };

})();
