const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /blockAccess:\s*function\s*\(\s*reason\s*\)\s*\{[\s\S]*?document\.body\.innerHTML\s*=\s*`[\s\S]*?`\s*;/m;

if (content.match(regex)) {
    const newCode = `blockAccess: function(reason, allowedRoles) {
        ArgonSessionRegistry.clear();
        
        // If no allowedRoles passed, just show simple error (or it's a hard block)
        if (!allowedRoles || (reason && reason.includes('صلاحية'))) {
             document.body.innerHTML = \`
               <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:white;font-family:'Tajawal',sans-serif;">
                  <i class="fas fa-shield-alt" style="font-size:4rem;color:#ef4444;margin-bottom:20px;"></i>
                  <h1 style="margin:0 0 10px 0;">الوصول مرفوض</h1>
                  <p style="color:#94a3b8;margin-bottom:30px;">\${reason}</p>
                  <button onclick="window.location.reload()" style="padding:10px 24px;background:#3b82f6;border:none;border-radius:8px;color:white;font-family:inherit;font-weight:bold;cursor:pointer;">تحديث الصفحة</button>
               </div>
            \`;
            return;
        }

        // Otherwise, inject Enterprise Login UI Overlay
        this.injectEnterpriseLoginUI(allowedRoles);
    },

    injectEnterpriseLoginUI: function(allowedRoles) {
        if (document.getElementById('argonEnterpriseLoginOverlay')) return;
        
        // Hide existing portal UI completely to prevent leaks
        Array.from(document.body.children).forEach(c => {
            if (c.id !== 'toast' && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') c.style.display = 'none';
        });

        const isEMR = allowedRoles.includes('doctor');
        const fetchPath = isEMR ? '/doctors' : '/staff';
        
        const overlay = document.createElement('div');
        overlay.id = 'argonEnterpriseLoginOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg, #f8fafc);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:"Tajawal",sans-serif;';
        
        overlay.innerHTML = \`
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
        \`;
        
        document.body.appendChild(overlay);

        // Fetch Staff/Doctors
        firebase.database().ref(BASE + fetchPath).once('value').then(snap => {
            const data = snap.val() || {};
            const select = document.getElementById('entLoginStaffSelect');
            select.innerHTML = '<option value="">-- اختر من القائمة --</option>';
            
            Object.keys(data).forEach(k => {
                const d = data[k];
                if (d.identityStatus === 'SUSPENDED') return;
                // Filter by role if not EMR
                if (!isEMR && !allowedRoles.includes(d.role) && d.role !== 'admin') return;
                
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = sanitize(d.name) + (d.role ? \` (\${d.role})\` : '');
                opt.dataset.role = d.role || 'doctor';
                select.appendChild(opt);
            });
        });

        // Bind Login Action
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
                const session = await ArgonEnterpriseAuth.login(staffId, pwd, CLINIC_ID);
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
        };`;

    content = content.replace(regex, newCode);
    
    // Update authorizePortal calls
    const authRegex1 = /this\.blockAccess\(("[^"]+")\);/g;
    content = content.replace(authRegex1, `this.blockAccess($1, allowedRoles);`);
    
    fs.writeFileSync(path, content, 'utf8');
    console.log("Injected injectEnterpriseLoginUI successfully via regex.");
} else {
    console.log("Could not match blockAccess regex.");
}
