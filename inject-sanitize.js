const fs = require('fs');
const path = 'd:\\git__hub\\argon-system\\clinica-repo\\emr-app.js';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('const sanitize =')) {
    const target = "const db = firebase.database();";
    const replacement = `const db = firebase.database();\n\n// ── INPUT SANITIZER ──\nconst sanitize = s => String(s || '').replace(/[<>"'&]/g, '').trim().substring(0, 200);\n`;
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Successfully injected sanitize function in emr-app.js");
} else {
    console.log("sanitize function already exists");
}
