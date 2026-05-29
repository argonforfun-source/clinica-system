const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `      isSecurityHubInitialized = true;
    }`;
const replacementStr = `      isSecurityHubInitialized = true;
    }
    
    // START LISTENER IMMEDIATELY
    initSecurityHubListener();`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Added initSecurityHubListener() successfully.");
} else {
    console.log("Could not find target string.");
}
