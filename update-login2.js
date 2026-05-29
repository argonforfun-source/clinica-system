const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /async login\(doctorId, password, clinicId\) \{[\s\S]*?db\.ref\(`clinics\/\$\{clinicId\}\/doctors\/\$\{doctorId\}\/credentials`\)\.once\('value'\);/g;

if (content.match(regex)) {
    content = content.replace(regex, `async login(doctorId, password, clinicId, type = 'doctors') {
      if (!firebase || !firebase.database) throw new Error("Firebase not ready");
      await this.ensureAnonAuth();
      const db = firebase.database();
      
      // 1. Fetch Credentials
      const credSnapshot = await db.ref(\`clinics/\${clinicId}/\${type}/\${doctorId}/credentials\`).once('value');`);
      
    // Update the caller in injectEnterpriseLoginUI to pass the type
    // In inject-login-overlay we wrote: const session = await ArgonEnterpriseAuth.login(staffId, pwd, CLINIC_ID);
    content = content.replace(/const session = await ArgonEnterpriseAuth\.login\(staffId, pwd, CLINIC_ID\);/g, `const type = isEMR ? 'doctors' : 'staff';\n                const session = await ArgonEnterpriseAuth.login(staffId, pwd, CLINIC_ID, type);`);

    fs.writeFileSync(path, content, 'utf8');
    console.log("Updated ArgonEnterpriseAuth.login and its caller.");
} else {
    console.log("Could not match regex.");
}
