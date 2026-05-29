const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

// Remove Enterprise Security Hub Table HTML completely
const hubRegex = /<!-- ENTERPRISE SECURITY HUB -->[\s\S]*?initSecurityHubListener\(\);/m;
if (content.match(hubRegex)) {
    content = content.replace(hubRegex, '');
    console.log("Removed Enterprise Security Hub Table.");
}

// Remove renderSecurityHub JS function completely
const renderHubRegex = /function renderSecurityHub\(data\) \{[\s\S]*?window\.renderSecurityHub = renderSecurityHub;/m;
if (content.match(renderHubRegex)) {
    content = content.replace(renderHubRegex, '');
    console.log("Removed renderSecurityHub function.");
}

fs.writeFileSync(path, content, 'utf8');
