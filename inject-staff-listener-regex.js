const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const targetRegex = /db\.ref\(BASE\+'\/doctors'\)\.on\('value',\s*snap\s*=>\s*\{/;

const replaceStr = `// Load Staff
  let _staff = {};
  db.ref(BASE+'/staff').on('value', snap => {
    _staff = snap.val()||{};
    const sg = document.getElementById('staffGrid');
    if (!sg) return;
    const keys = Object.keys(_staff);
    if (!keys.length) {
       sg.innerHTML = '<div style="color:var(--muted);font-size:.84rem;grid-column:1/-1">لا يوجد موظفين مسجلين حالياً.</div>';
       return;
    }
    sg.innerHTML = keys.map(k => {
      const d = _staff[k];
      const roleName = d.role === 'reception' ? 'موظف استقبال' : 
                       d.role === 'pharmacist' ? 'صيدلاني' :
                       d.role === 'lab' ? 'فني مختبر' :
                       d.role === 'radiology' ? 'فني أشعة' :
                       d.role === 'admin' ? 'مدير نظام' : d.role;
      
      const roleColor = d.role === 'admin' ? '#ef4444' : 
                        d.role === 'pharmacist' ? '#0ea5e9' :
                        d.role === 'lab' ? '#f59e0b' :
                        d.role === 'radiology' ? '#8b5cf6' : '#10b981';

      return \`<div class="dc" style="border-top: 3px solid \${roleColor}">
        <div class="dc-top" style="background:rgba(255,255,255,0.05); padding:15px; font-size:2rem;">\${d.role === 'admin' ? '🛡️' : '👨‍💻'}</div>
        <div class="dc-body">
          <div class="dc-name" style="font-size:1.1rem;">\${sanitize(d.name)}</div>
          <div class="dc-spec" style="color:\${roleColor}; font-weight:800; margin-top:5px;">\${roleName}</div>
          <div style="font-size:0.75rem; color:var(--muted); margin-top:5px;"><i class="fas fa-fingerprint"></i> ID: \${k}</div>
        </div>
        <div style="display:flex;border-top:1px solid rgba(255,255,255,.05)">
            <button onclick="openSecurityModal('\${k}', 'staff')" style="flex:1;background:none;border:none;border-left:1px solid rgba(255,255,255,.05);color:var(--teal);padding:8px;font-family:'Tajawal',sans-serif;font-size:.75rem;cursor:pointer;transition:.2s"><i class="fas fa-shield-alt"></i> الأمان</button>
            <button class="bdel" style="flex:1;border:none" onclick="if(confirm('هل أنت متأكد من حذف هذا الموظف؟')){db.ref(BASE+'/staff/\${k}').remove();toast('تم الحذف','ok');}"><i class="fas fa-trash"></i> حذف</button>
        </div>
      </div>\`;
    }).join('');
  });

  db.ref(BASE+'/doctors').on('value', snap => {`;

if (content.match(targetRegex) && !content.includes("db.ref(BASE+'/staff').on('value'")) {
    content = content.replace(targetRegex, replaceStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Injected Staff Listener successfully.");
} else {
    console.log("Could not find target listener or already injected.");
}
