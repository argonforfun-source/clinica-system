const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove from ArgonSessionRegistry
const getStart = "const legacyAuth = sessionStorage.getItem('clinica_auth_' + CID);";
const idx1 = content.indexOf(getStart);
if (idx1 !== -1) {
    const endStr = "return this._inMemorySession;\n          }";
    const idxEnd1 = content.indexOf(endStr, idx1);
    if (idxEnd1 !== -1) {
        const toRemove = content.substring(idx1, idxEnd1 + endStr.length);
        content = content.replace(toRemove, '');
        console.log("Removed legacy auth fallback from ArgonSessionRegistry.get()");
    }
}

// 2. Remove from ArgonEnterpriseAuth
const verStart = "if (sessionStorage.getItem(`clinica_auth_${clinicId}`) === '1') {";
const idx2 = content.indexOf(verStart);
if (idx2 !== -1) {
    const endStr2 = "return legacySession;\n        }";
    const idxEnd2 = content.indexOf(endStr2, idx2);
    if (idxEnd2 !== -1) {
        const toRemove2 = content.substring(idx2, idxEnd2 + endStr2.length);
        content = content.replace(toRemove2, '');
        console.log("Removed legacy auth fallback from ArgonEnterpriseAuth.verifySession()");
    }
}

fs.writeFileSync(path, content, 'utf8');
