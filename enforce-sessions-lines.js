const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

let newLines = [];
let skipRegistry = false;
let skipVerify = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const legacyAuth = sessionStorage.getItem('clinica_auth_' + CID);")) {
        skipRegistry = true;
    }
    
    if (skipRegistry) {
        if (lines[i].includes("return this._inMemorySession;") && lines[i+1] && lines[i+1].includes("}")) {
            skipRegistry = false;
            i++; // skip the closing brace
            continue;
        }
        continue;
    }

    if (lines[i].includes("if (sessionStorage.getItem(`clinica_auth_${clinicId}`) === '1') {")) {
        skipVerify = true;
    }

    if (skipVerify) {
        if (lines[i].includes("return legacySession;") && lines[i+1] && lines[i+1].includes("}")) {
            skipVerify = false;
            i++;
            continue;
        }
        continue;
    }

    newLines.push(lines[i]);
}

fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log("Removed legacy fallbacks by line processing.");
