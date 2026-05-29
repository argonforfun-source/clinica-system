const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const startStr = 'function openSecModal(docKey, docName) {';
const startIndex = content.indexOf(startStr);

if (startIndex !== -1) {
    const toggleStr = 'async function secToggleSuspend(currentlySuspended) {';
    const toggleIndex = content.indexOf(toggleStr, startIndex);
    
    if (toggleIndex !== -1) {
        let braceCount = 0;
        let endIndex = -1;
        for (let i = toggleIndex; i < content.length; i++) {
            if (content[i] === '{') braceCount++;
            if (content[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
        
        if (endIndex !== -1) {
            const oldCode = content.substring(startIndex, endIndex);
            const newCode = `let _activeSecType = 'doctors'; // 'doctors' or 'staff'
  
  function openSecModal(docKey, type) {
     _activeSecDoc = docKey;
     _activeSecType = type || 'doctors';
     
     const d = _activeSecType === 'staff' ? _staff[docKey] : _docs[docKey];
     if (!d) return;
     
     const docName = d.name || 'Unknown';
     const hasCreds = d && d.credentials && d.credentials.passwordHash;
     const isSuspended = d && d.identityStatus === 'SUSPENDED';
     
     document.getElementById('secModalDocName').textContent = (_activeSecType === 'staff' ? 'الموظف: ' : 'الطبيب: ') + sanitize(docName);
     
     const actionsDiv = document.getElementById('secModalActions');
     if (actionsDiv) {
       actionsDiv.innerHTML = \`
         <div style="background:var(--surf); border:1px solid var(--border); padding:16px; border-radius:12px">
            <h4 style="margin:0 0 8px 0; color:var(--text); font-size:0.9rem; display:flex; align-items:center; gap:8px"><i class="fas fa-key" style="color:var(--amber)"></i> تعيين / تغيير كلمة المرور</h4>
            <input type="text" id="secNewPwd" placeholder="كلمة المرور الجديدة" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); background:rgba(0,0,0,0.1); color:var(--text); margin-bottom:10px; font-family:monospace; text-align:center;" autocomplete="new-password">
            <button onclick="secSetPassword()" style="width:100%; padding:10px; background:var(--amber); color:#000; border:none; border-radius:8px; font-family:inherit; font-weight:800; cursor:pointer;"><i class="fas fa-save"></i> حفظ التحديثات (Enterprise)</button>
         </div>
         \${hasCreds ? \`
         <div style="background:var(--surf); border:1px solid var(--border); padding:16px; border-radius:12px; margin-top:10px;">
            <h4 style="margin:0 0 8px 0; color:var(--text); font-size:0.9rem; display:flex; align-items:center; gap:8px"><i class="fas fa-user-shield" style="color:var(--sky)"></i> الإدارة الأمنية (Governance)</h4>
            <div style="display:flex; gap:10px;">
               <button onclick="secRevokeSessions()" style="flex:1; padding:8px; background:rgba(59, 130, 246, 0.1); color:#3b82f6; border:1px solid rgba(59, 130, 246, 0.3); border-radius:8px; cursor:pointer;"><i class="fas fa-sign-out-alt"></i> إنهاء الجلسات</button>
               <button onclick="secToggleSuspend(\${isSuspended})" style="flex:1; padding:8px; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); border-radius:8px; cursor:pointer;"><i class="fas \${isSuspended ? 'fa-unlock' : 'fa-ban'}"></i> \${isSuspended ? 'فك التعليق' : 'تعليق الحساب'}</button>
            </div>
         </div>
         \` : ''}
       \`;
     }
     document.getElementById('secModal').style.display = 'flex';
  }

  function closeSecModal() {
     _activeSecDoc = null;
     document.getElementById('secModal').style.display = 'none';
  }
  
  async function secSetPassword() {
     if (!_activeSecDoc) return;
     const pwd = document.getElementById('secNewPwd').value;
     if (!pwd || pwd.length < 4) { toast('كلمة المرور يجب أن تكون 4 حروف على الأقل', 'err'); return; }
     try {
       const salt = ArgonEnterpriseAuth.generateSalt();
       const hash = await ArgonEnterpriseAuth.hashPassword(pwd, salt);
       await db.ref(BASE + '/' + _activeSecType + '/' + _activeSecDoc + '/credentials').set({
         passwordHash: hash,
         salt: salt,
         updatedAt: firebase.database.ServerValue.TIMESTAMP
       });
       if(typeof AuditAPI !== 'undefined') AuditAPI.log('CREDENTIALS_UPDATED', _activeSecDoc, 'admin', { type: _activeSecType });
       toast('تم تحديث بيانات الاعتماد للموظف', 'ok');
       document.getElementById('secNewPwd').value = '';
       closeSecModal();
     } catch (e) {
       console.error(e);
       toast('فشل التحديث: ' + e.message, 'err');
     }
  }

  async function secRevokeSessions() {
     if (!_activeSecDoc || !confirm('هل أنت متأكد من إنهاء جميع الجلسات النشطة للموظف؟ سيتم طرده من النظام فوراً.')) return;
     try {
        await db.ref(BASE + '/' + _activeSecType + '/' + _activeSecDoc + '/sessionRegistry').remove();
        if(typeof AuditAPI !== 'undefined') AuditAPI.log('SESSIONS_REVOKED', _activeSecDoc, 'admin', { type: _activeSecType });
        toast('تم إبطال جميع الجلسات', 'ok');
        closeSecModal();
     } catch(e) { toast('فشل الإبطال', 'err'); }
  }

  async function secToggleSuspend(isSuspended) {
     if (!_activeSecDoc) return;
     const newStatus = isSuspended ? 'ACTIVE' : 'SUSPENDED';
     if (!confirm(\`هل أنت متأكد من \${isSuspended ? 'تفعيل' : 'تعليق'} هذا الحساب؟\`)) return;
     try {
        await db.ref(BASE + '/' + _activeSecType + '/' + _activeSecDoc + '/identityStatus').set(newStatus);
        if (newStatus === 'SUSPENDED') {
          await db.ref(BASE + '/' + _activeSecType + '/' + _activeSecDoc + '/sessionRegistry').remove();
        }
        if(typeof AuditAPI !== 'undefined') AuditAPI.log('IDENTITY_STATUS_CHANGED', _activeSecDoc, 'admin', { newStatus, type: _activeSecType });
        toast(\`تم \${isSuspended ? 'تفعيل' : 'تعليق'} الحساب بنجاح\`, 'ok');
        closeSecModal();
     } catch(e) { toast('فشل تغيير الحالة', 'err'); }
  }`;

            content = content.replace(oldCode, newCode);
            
            // Also update the old onclick="openSecurityModal"
            content = content.replace(/onclick="openSecurityModal\('([^']+)'\)"/g, `onclick="openSecModal('$1', 'doctors')"`);
            
            fs.writeFileSync(path, content, 'utf8');
            console.log("Updated openSecModal functions manually.");
        } else {
            console.log("Could not find endIndex of secToggleSuspend");
        }
    } else {
        console.log("Could not find toggleStr");
    }
} else {
    console.log("Could not find startStr");
}
