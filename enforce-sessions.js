const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove legacy fallback from ArgonSessionRegistry.get()
const legacyGetRegex = /const legacyAuth = sessionStorage\.getItem\('clinica_auth_' \+ CID\);[\s\S]*?lastHeartbeat: Date\.now\(\)\s*\}\s*this\._inMemorySession = Object\.freeze\(legacySession\);\s*return this\._inMemorySession;\s*\}/m;
if (content.match(legacyGetRegex)) {
    content = content.replace(legacyGetRegex, '');
    console.log("Removed legacy auth fallback from ArgonSessionRegistry.get()");
} else {
    console.log("Could not find legacyGetRegex");
}

// 2. Remove legacy fallback from ArgonEnterpriseAuth.verifySession()
const legacyVerifyRegex = /if \(sessionStorage\.getItem\(`clinica_auth_\$\{clinicId\}`\) === '1'\) \{[\s\S]*?sessionHash: 'legacy_override'\s*\};\s*this\._currentSession = legacySession;\s*return legacySession;\s*\}/m;
if (content.match(legacyVerifyRegex)) {
    content = content.replace(legacyVerifyRegex, '');
    console.log("Removed legacy auth fallback from ArgonEnterpriseAuth.verifySession()");
} else {
    console.log("Could not find legacyVerifyRegex");
}

fs.writeFileSync(path, content, 'utf8');
