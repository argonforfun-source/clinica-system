const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `async login(doctorId, password, clinicId) {`;
const idx = content.indexOf(targetStr);
if (idx !== -1) {
    const endStr = `return ArgonSessionRegistry.get();\n        } else {`;
    const idxEnd = content.indexOf(endStr, idx);
    
    if (idxEnd !== -1) {
        const oldCode = content.substring(idx, idxEnd + endStr.length);
        const newCode = oldCode.replace(/async login\(doctorId, password, clinicId\) \{/g, `async login(doctorId, password, clinicId, type = 'doctors') {`)
                               .replace(/`clinics\/\$\{clinicId\}\/doctors\/\$\{doctorId\}\/credentials`/g, `\`clinics/\${clinicId}/\${type}/\${doctorId}/credentials\``);
        content = content.replace(oldCode, newCode);
        
        fs.writeFileSync(path, content, 'utf8');
        console.log("Updated ArgonEnterpriseAuth.login successfully.");
    }
} else {
    console.log("Could not find ArgonEnterpriseAuth.login.");
}
