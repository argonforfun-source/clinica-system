const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /static filterAccessiblePatients\(patients, session\) \{[\s\S]*?return true;\s*\}/m;
if (content.match(regex)) {
    content = content.replace(regex, `static filterAccessiblePatients(patients, session) {
        if (!session) return [];
        
        // Enforce Identity Status globally
        if (window._argonStaff && window._argonStaff[session.staffId]) {
           if (window._argonStaff[session.staffId].identityStatus === 'SUSPENDED') {
              console.error("[SecurityGateway] Blocked: Identity is SUSPENDED.");
              return [];
           }
        }
        
        // Admin overrides all visibility rules
        if (session.role === 'admin') return patients;
        
        // V8.4 Enterprise Strict Isolation Rule: Doctors ONLY see their own patients
        if (session.role === 'doctor') {
            return patients.filter(([uid, p]) => {
               const info = p.info || {};
               return info.assignedDoctorId === session.staffId;
            });
        }
        
        // Other roles (e.g. reception, pharmacist) might need broader access or different rules
        return patients;
    }`);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Updated filterAccessiblePatients for strict isolation.");
} else {
    console.log("Could not find filterAccessiblePatients regex.");
}
