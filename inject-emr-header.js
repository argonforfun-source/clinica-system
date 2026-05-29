const fs = require('fs');
const path = 'd:\\git__hub\\argon-system\\clinica-repo\\emr-app.js';
let content = fs.readFileSync(path, 'utf8');

const target1 = "function initEMR() {";
const replacement1 = `function initEMR() {
  toast('مرحباً بك في نظام السجلات الطبية', 'ok');
  setTimeout(() => migratePhoneKeyedPatients(), 3000);
  
  // ── ENTERPRISE WELCOME HEADER ──
  const session = typeof AuthAdapter !== 'undefined' ? AuthAdapter.getCurrentSession() : null;
  if (session && session.role === 'doctor') {
     const ptDiv = document.querySelector('#patList .pt');
     if (ptDiv) {
         const docName = session.doctorName || session.staffId;
         ptDiv.innerHTML = \`<i class="fas fa-user-md" style="color:var(--teal)"></i> بوابة د. \${typeof sanitize !== 'undefined' ? sanitize(docName) : docName}\`;
     }
     const psDiv = document.querySelector('#patList .ps');
     if (psDiv) {
         psDiv.innerHTML = 'مساحة عمل معزولة خاصة بك (Isolated Workspace)';
     }
  }`;

content = content.replace("function initEMR() {", replacement1);

// Remove the old toast and migrate lines right after it
content = content.replace("  toast('مرحباً بك في نظام السجلات الطبية', 'ok');\n  // Run legacy phone-key migration silently on first load\n  setTimeout(() => migratePhoneKeyedPatients(), 3000);", "");

const target2 = "db.ref(BASE + '/patients').on('child_added', snap => {";
const replacement2 = `// Prevent infinite spinner if collection is totally empty
  db.ref(BASE + '/patients').once('value', snap => {
     if (!snap.exists()) debouncedRenderPatients();
  });

  db.ref(BASE + '/patients').on('child_added', snap => {`;

content = content.replace(target2, replacement2);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully injected Welcome Header and Empty State handler in emr-app.js");
