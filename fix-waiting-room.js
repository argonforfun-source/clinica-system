const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\emr-app.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /if \(!isAdmin && session && session\.uid\) \{[\s\S]*?targetDoctor = session\.uid; \/\/ Doctor Portal Lock[\s\S]*?\}/g;

if (content.match(regex)) {
    content = content.replace(regex, `if (!isAdmin && session && session.staffId) {
    targetDoctor = session.staffId; // V8.4 Enterprise Doctor Portal Lock
  }`);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Updated renderWaitingRoom targetDoctor correctly.");
} else {
    console.log("Regex didn't match.");
}
