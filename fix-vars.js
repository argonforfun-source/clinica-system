const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\* Variables successfully hoisted to top \*\/\n\s*let _pass[\s\S]*?_anonUid = null;/;
const match = content.match(regex);

if (match) {
    const varStr = match[0];
    
    // Remove from local scope
    content = content.replace(regex, '');
    
    // Insert after BASE = ...
    const baseRegex = /const BASE = 'clinics\/' \+ CID;\n\n/;
    content = content.replace(baseRegex, `const BASE = 'clinics/' + CID;\n\n` + varStr + '\n\n');
    
    fs.writeFileSync(path, content, 'utf8');
    console.log("Moved variables to global scope successfully.");
} else {
    console.error("Could not find the variables block!");
}
