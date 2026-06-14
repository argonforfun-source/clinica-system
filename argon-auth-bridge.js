/**
 * ARGON MEDICAL OS — Auth Bridge v2.2 (SaaS Mode)
 * جسر المصادقة للعيادات ذاتية التسجيل
 */

'use strict';

const ArgonAuthBridge = (() => {

  const AUTH_MAP_PATH = 'clinic_auth_map';
  let _db = null;
  let _auth = null;

  function init(firebaseApp, database) {
    _auth = firebaseApp.auth ? firebaseApp.auth() : firebase.auth();
    _db = database;

    _auth.onAuthStateChanged(user => {
      if (user) {
        console.log(`%c🔐 ARGON Auth: موقّع [${user.email}]`, 'color:#0d9488;font-weight:bold');
        window.dispatchEvent(new CustomEvent('argon:auth:ready', { detail: { uid: user.uid, email: user.email } }));
      } else {
        window.dispatchEvent(new CustomEvent('argon:auth:signed_out'));
      }
    });
    return _auth.currentUser;
  }

  /**
   * تسجيل حساب عيادة جديد (التسجيل الذاتي SaaS)
   */
  async function registerNewClinic(clinicName, email, password) {
    try {
      // 1. إنشاء حساب Firebase Auth
      const cred = await _auth.createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;

      // 2. توليد ID فريد للعيادة
      const clinicId = 'clinic_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

      // 3. ربط الـ UID بمعرف العيادة (هذه الخطوة مسموحة بفضل قواعد الأمان الجديدة)
      await _db.ref(`${AUTH_MAP_PATH}/${uid}`).set(clinicId);

      // 4. إعداد سجل المصادقة المحمي
      await _db.ref(`clinic_auth_settings/${clinicId}`).set({
        authEmail: email,
        authUid: uid,
        authEnabled: true,
        createdAt: new Date().toISOString()
      });

      // 5. بناء هيكل العيادة الأساسي
      await _db.ref(`clinics/${clinicId}/settings`).set({
        name: clinicName,
        status: 'active',
        createdAt: new Date().toISOString()
      });

      console.log(`%c✅ تم إنشاء العيادة بنجاح: ${clinicId}`, 'color:#10b981;font-weight:bold');
      return { clinicId, uid };

    } catch (err) {
      console.error('[ArgonAuthBridge] فشل في إنشاء العيادة:', err);
      throw err;
    }
  }

  /**
   * تسجيل الدخول بالإيميل الشخصي (SaaS)
   */
  async function loginWithEmail(email, password) {
    try {
      const cred = await _auth.signInWithEmailAndPassword(email, password);
      
      // جلب معرف العيادة المرتبط بهذا الحساب
      const snap = await _db.ref(`${AUTH_MAP_PATH}/${cred.user.uid}`).once('value');
      const clinicId = snap.val();

      if (!clinicId) throw new Error('هذا الحساب غير مرتبط بأي عيادة.');
      
      return { clinicId, uid: cred.user.uid };
    } catch (err) {
      console.error('[ArgonAuthBridge] فشل تسجيل الدخول:', err);
      throw err;
    }
  }

  /**
   * تسجيل دخول السوبر أدمن بالطريقة الكلاسيكية
   */
  async function loginSuperAdmin(username, password) {
    const snap = await _db.ref('super_admin').once('value');
    const config = snap.val() || { user: 'admin', pass: 'argon_super_2026' };
    
    if (username === config.user && password === config.pass) {
      try {
        await _auth.signInWithEmailAndPassword('superadmin@argon.clinic.system', password);
        return { role: 'super', uid: _auth.currentUser?.uid };
      } catch (e) {
        console.warn('تسجيل دخول السوبر أدمن عبر Firebase Auth فشل، جاري استخدام التوافق الخلفي.', e);
        return { role: 'super', legacy: true };
      }
    }
    throw new Error('بيانات الدخول غير صحيحة');
  }

  async function logout() {
    try {
      await _auth.signOut();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }

  function waitForAuth() {
    return new Promise(resolve => {
      if (_auth?.currentUser) { resolve(_auth.currentUser); return; }
      const unsub = _auth.onAuthStateChanged(user => {
        if (user || user === null) { unsub(); resolve(user); }
      });
      setTimeout(() => { unsub(); resolve(null); }, 5000);
    });
  }

  return {
    init,
    registerNewClinic,
    loginWithEmail,
    loginSuperAdmin,
    logout,
    waitForAuth,
    get currentUser() { return _auth?.currentUser; }
  };

})();

window.ArgonAuthBridge = ArgonAuthBridge;
