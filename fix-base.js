const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /firebase\.database\(\)\.ref\(BASE \+ fetchPath\)/g;

if (content.match(regex)) {
    content = content.replace(regex, `firebase.database().ref(CLINIC_BASE + fetchPath)`);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Replaced BASE with CLINIC_BASE successfully.");
} else {
    console.log("Could not find BASE + fetchPath");
}
