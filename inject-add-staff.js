const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `function addDoc(){`;
const replaceStr = `function addStaffMem() {
    const name = document.getElementById('nstaffName').value.trim();
    const role = document.getElementById('nstaffRole').value;
    if (!name) return toast('يرجى إدخال اسم الموظف', 'err');
    
    db.ref(BASE+'/staff').push({
      name: name,
      role: role,
      identityStatus: 'ACTIVE',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
      document.getElementById('nstaffName').value = '';
      toast('تمت إضافة الموظف بنجاح', 'ok');
    }).catch(e => toast('خطأ في الإضافة', 'err'));
  }

  function addDoc(){`;

if (content.includes(targetStr) && !content.includes('function addStaffMem()')) {
    content = content.replace(targetStr, replaceStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Injected addStaffMem function.");
} else {
    console.log("Could not find addDoc or addStaffMem already exists.");
}
