const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
const lines = fs.readFileSync(path, 'utf8').split('\\n');

let newLines = [];
let skipLegacy1 = false;
let skipLegacy2 = false;
let skipBlockAccess = false;
let skipLogin = false;
let skipClear = false;

for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    // 1. Remove legacy fallback 1
    if (l.includes("const legacyAuth = sessionStorage.getItem('clinica_auth_' + CID);")) {
        skipLegacy1 = true;
    }
    if (skipLegacy1) {
        if (l.includes("return this._inMemorySession;") && lines[i+1] && lines[i+1].includes("}")) {
            skipLegacy1 = false;
            i++; // skip the closing brace
            continue;
        }
        continue;
    }

    // 2. Remove legacy fallback 2
    if (l.includes("if (sessionStorage.getItem(\`clinica_auth_\${clinicId}\`) === '1') {")) {
        skipLegacy2 = true;
    }
    if (skipLegacy2) {
        if (l.includes("return legacySession;") && lines[i+1] && lines[i+1].includes("}")) {
            skipLegacy2 = false;
            i++;
            continue;
        }
        continue;
    }

    // 3. Replace blockAccess
    if (l.includes("blockAccess: function(reason) {")) {
        skipBlockAccess = true;
        const blockAccessStr = \`    blockAccess: function(reason, allowedRoles) {
        ArgonSessionRegistry.clear();
        
        if (!allowedRoles || (reason && reason.includes('صلاحية'))) {
             document.body.innerHTML = \\\`
               <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:white;font-family:'Tajawal',sans-serif;">
                  <i class="fas fa-shield-alt" style="font-size:4rem;color:#ef4444;margin-bottom:20px;"></i>
                  <h1 style="margin:0 0 10px 0;">الوصول مرفوض</h1>
                  <p style="color:#94a3b8;margin-bottom:30px;">\${reason}</p>
                  <button onclick="window.location.reload()" style="padding:10px 24px;background:#3b82f6;border:none;border-radius:8px;color:white;font-family:inherit;font-weight:bold;cursor:pointer;">تحديث الصفحة</button>
               </div>
            \\\`;
            return;
        }

        this.injectEnterpriseLoginUI(allowedRoles);
    },

    injectEnterpriseLoginUI: function(allowedRoles) {
        if (document.getElementById('argonEnterpriseLoginOverlay')) return;
        
        Array.from(document.body.children).forEach(c => {
            if (c.id !== 'toast' && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') c.style.display = 'none';
        });

        const isEMR = allowedRoles.includes('doctor');
        const fetchPath = isEMR ? '/doctors' : '/staff';
        
        const overlay = document.createElement('div');
        overlay.id = 'argonEnterpriseLoginOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg, #f8fafc);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:"Tajawal",sans-serif;';
        
        overlay.innerHTML = \\\`
          <div style="background:var(--surf, #fff); padding:40px; border-radius:24px; box-shadow:0 10px 40px rgba(0,0,0,0.05); width:100%; max-width:400px; text-align:center; border:1px solid var(--border, #e2e8f0);">
             <i class="fas fa-hospital-user" style="font-size:3.5rem; color:var(--teal, #0d9488); margin-bottom:20px;"></i>
             <h2 style="margin:0 0 5px 0; color:var(--text, #1e293b); font-size:1.5rem;">\${isEMR ? 'بوابة العيادات الطبية' : 'البوابة التشغيلية'}</h2>
             <p style="color:var(--muted, #64748b); font-size:0.9rem; margin-bottom:25px;">يرجى التحقق من هويتك للمتابعة</p>
             
             <div style="text-align:right; margin-bottom:15px;">
                 <label style="display:block; color:var(--text, #1e293b); font-size:0.85rem; font-weight:bold; margin-bottom:8px;">اختر الحساب</label>
                 <select id="entLoginStaffSelect" style="width:100%; padding:12px; border-radius:12px; border:2px solid var(--border, #e2e8f0); background:var(--bg, #f8fafc); font-family:inherit; font-size:1rem;">
                    <option value="">جاري التحميل...</option>
                 </select>
             </div>
             
             <div style="text-align:right; margin-bottom:25px;">
                 <label style="display:block; color:var(--text, #1e293b); font-size:0.85rem; font-weight:bold; margin-bottom:8px;">كلمة المرور</label>
                 <input type="password" id="entLoginPwd" placeholder="••••••••" style="width:100%; padding:12px; border-radius:12px; border:2px solid var(--border, #e2e8f0); background:var(--bg, #f8fafc); font-family:inherit; font-size:1rem; text-align:center;">
             </div>
             
             <button id="entLoginBtn" style="width:100%; padding:14px; background:var(--teal, #0d9488); color:#fff; border:none; border-radius:12px; font-size:1.1rem; font-weight:bold; cursor:pointer; transition:0.2s; font-family:inherit; box-shadow:0 4px 15px rgba(13,148,136,0.3);">
                تسجيل الدخول <i class="fas fa-arrow-left" style="margin-right:8px;"></i>
             </button>
          </div>
        \\\`;
        
        document.body.appendChild(overlay);

        firebase.database().ref(CLINIC_BASE + fetchPath).once('value').then(snap => {
            const data = snap.val() || {};
            const select = document.getElementById('entLoginStaffSelect');
            select.innerHTML = '<option value="">-- اختر من القائمة --</option>';
            
            Object.keys(data).forEach(k => {
                const d = data[k];
                if (d.identityStatus === 'SUSPENDED') return;
                if (!isEMR && !allowedRoles.includes(d.role) && d.role !== 'admin') return;
                
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = sanitize(d.name) + (d.role ? \\\` (\\\${d.role})\\\` : '');
                opt.dataset.role = d.role || 'doctor';
                select.appendChild(opt);
            });
        });

        document.getElementById('entLoginBtn').onclick = async () => {
            const select = document.getElementById('entLoginStaffSelect');
            const pwd = document.getElementById('entLoginPwd').value.trim();
            const staffId = select.value;
            
            if (!staffId) return typeof toast==='function'?toast('يرجى اختيار الحساب', 'err'):alert('يرجى اختيار الحساب');
            if (!pwd) return typeof toast==='function'?toast('يرجى إدخال كلمة المرور', 'err'):alert('يرجى إدخال كلمة المرور');
            
            const btn = document.getElementById('entLoginBtn');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
            
            try {
                const type = isEMR ? 'doctors' : 'staff';
                const session = await ArgonEnterpriseAuth.login(staffId, pwd, CLINIC_ID, type);
                const role = select.options[select.selectedIndex].dataset.role;
                session.role = role; 
                ArgonSessionRegistry.start(staffId, role, CLINIC_ID);
                
                if(typeof AuditAPI !== 'undefined') AuditAPI.log('AUTH_SUCCESS', staffId, staffId, CLINIC_ID, 'PORTAL_LOGIN');
                if(typeof toast==='function') toast('تم تسجيل الدخول بنجاح', 'ok');
                setTimeout(() => window.location.reload(), 500);
            } catch(e) {
                btn.innerHTML = 'تسجيل الدخول <i class="fas fa-arrow-left" style="margin-right:8px;"></i>';
                btn.disabled = false;
                if(typeof toast==='function') toast(e.message, 'err'); else alert(e.message);
            }
        };\n`;
        newLines.push(blockAccessStr);
    }
    if (skipBlockAccess) {
        if (l.includes("};") && lines[i-1] && lines[i-1].includes("}")) {
            skipBlockAccess = false;
        }
        continue; // skip the old blockAccess
    }

    // 4. Update authorizePortal
    if (l.includes('this.blockAccess("الجلسة منتهية أو غير صالحة. يرجى تسجيل الدخول مجدداً.");')) {
        newLines.push('             this.blockAccess("الجلسة منتهية أو غير صالحة. يرجى تسجيل الدخول مجدداً.", allowedRoles);');
        continue;
    }
    if (l.includes('this.blockAccess("ليس لديك الصلاحية لدخول هذه البوابة.");')) {
        newLines.push('             this.blockAccess("ليس لديك الصلاحية لدخول هذه البوابة.", allowedRoles);');
        continue;
    }

    // 5. Update ArgonEnterpriseAuth.login
    if (l.includes("async login(doctorId, password, clinicId) {")) {
        skipLogin = true;
        newLines.push("    async login(doctorId, password, clinicId, type = 'doctors') {");
        newLines.push("      if (!firebase || !firebase.database) throw new Error(\"Firebase not ready\");");
        newLines.push("      await this.ensureAnonAuth();");
        newLines.push("      const db = firebase.database();");
        newLines.push("      ");
        newLines.push("      // 1. Fetch Credentials");
        newLines.push("      const credSnapshot = await db.ref(`clinics/${clinicId}/${type}/${doctorId}/credentials`).once('value');");
    }
    if (skipLogin) {
        if (l.includes("const credSnapshot = await db.ref(`clinics/${clinicId}/doctors/${doctorId}/credentials`).once('value');")) {
            skipLogin = false; // resume normal lines after this
        }
        continue;
    }

    // 6. Fix ArgonSessionRegistry.clear
    if (l.includes("clear: function() {") && lines[i+1].includes("sessionStorage.removeItem(this.KEY);") && lines[i+2].includes("window.location.reload();")) {
        skipClear = true;
        newLines.push("    clear: function() {");
        newLines.push("        sessionStorage.removeItem(this.KEY);");
        newLines.push("    }");
    }
    if (skipClear) {
        if (l.includes("}")) {
            skipClear = false;
        }
        continue;
    }

    newLines.push(l);
}

fs.writeFileSync(path, newLines.join('\\n'), 'utf8');
console.log("Successfully rebuilt argon-core.js using line parser.");
