const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\/ Seeding default departments automatically for Medical Complex tier\n\s*function checkAndSeedDefaultDepartments\(\) \{[\s\S]*?\n\s*\}/;

const match = content.match(regex);
if (match) {
    const funcStr = match[0];
    
    // Remove it from its current location
    content = content.replace(regex, '');
    
    // Insert it before bootstrapDashboard
    const targetRegex = /\/\/ ── V8\.3 ENTERPRISE READINESS ORCHESTRATOR ──\nasync function bootstrapDashboard\(\) \{/;
    
    content = content.replace(targetRegex, funcStr + '\n\n// ── V8.3 ENTERPRISE READINESS ORCHESTRATOR ──\nasync function bootstrapDashboard() {');
    
    fs.writeFileSync(path, content, 'utf8');
    console.log("Moved checkAndSeedDefaultDepartments successfully.");
} else {
    console.error("Could not find checkAndSeedDefaultDepartments");
}
