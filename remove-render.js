const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const regex = /function renderSecurityHub\(data\) \{[\s\S]*?\}\s*window\.renderSecurityHub = renderSecurityHub;/;
if (content.match(regex)) {
    content = content.replace(regex, '');
    fs.writeFileSync(path, content, 'utf8');
    console.log("Removed renderSecurityHub function safely.");
} else {
    // Maybe it doesn't end with window.renderSecurityHub
    const regex2 = /function renderSecurityHub\(data\) \{[\s\S]*?\}\s*(?=\/\/\s* ENTERPRISE SECURITY CONSOLE)/m;
    const match = content.match(/function renderSecurityHub\(data\) \{[\s\S]*?(?=\/\/\s*[^E]*ENTERPRISE SECURITY CONSOLE)/m);
    if(match) {
        content = content.replace(match[0], '');
        fs.writeFileSync(path, content, 'utf8');
        console.log("Removed renderSecurityHub via regex2");
    } else {
        console.log("Still not found");
    }
}
