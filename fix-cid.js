const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\bCID\b/g, 'CLINIC_ID');

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully replaced all occurrences of CID with CLINIC_ID.");
