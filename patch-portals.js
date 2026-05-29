const fs = require('fs');

const portals = [
    { file: 'emr-app.js', loginId: 'emrLogin', initFunc: 'initEMR' },
    { file: 'lab-app.js', loginId: 'labLogin', initFunc: 'initLab' },
    { file: 'rad-app.js', loginId: 'radLogin', initFunc: 'initRad' }
];

portals.forEach(portal => {
    const path = 'd:\\git__hub\\argon-system\\clinica-repo\\' + portal.file;
    if (!fs.existsSync(path)) return;
    
    let content = fs.readFileSync(path, 'utf8');
    
    const targetRegex = /if \(!ArgonPortalACL\.authorizePortal\(allowedRoles\)\) \{\s*return; \/\/ Execution stops here, UI is blocked\s*\}/;
    
    if (content.match(targetRegex)) {
        // Only patch if not already patched
        if (!content.includes(`document.getElementById('${portal.loginId}')`)) {
            const replacement = `if (!ArgonPortalACL.authorizePortal(allowedRoles)) {
       return; // Execution stops here, UI is blocked
  }
  
  // SUCCESS: Bypass legacy login screen securely
  const loginScreen = document.getElementById('${portal.loginId}');
  if (loginScreen) {
      loginScreen.style.display = 'none';
      if (typeof ${portal.initFunc} === 'function') ${portal.initFunc}();
  }`;
            content = content.replace(targetRegex, replacement);
            fs.writeFileSync(path, content, 'utf8');
            console.log("Patched " + portal.file + " successfully.");
        } else {
            console.log("Already patched " + portal.file);
        }
    } else {
        console.log("Regex not matched in " + portal.file);
    }
});
