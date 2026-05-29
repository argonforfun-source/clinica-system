const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

// The `settings` listener shouldn't be blocked by the orchestrator.
// We'll extract it and put it before `bootstrapDashboard()`.

const settingsListenerRegex = /db\.ref\(BASE\+'\/settings'\)\.on\('value', snap => \{[\s\S]*?\}\);/;

if (content.match(settingsListenerRegex)) {
    const settingsCode = content.match(settingsListenerRegex)[0];
    
    // Remove it from its current location
    content = content.replace(settingsListenerRegex, '/* Settings listener moved to run immediately for login screen */');
    
    // Inject it right after `const db = firebase.database();` (which is outside bootstrapDashboard)
    // Wait, refactor-dash.js put `bootstrapDashboard()` right after `const db = firebase.database();`
    const insertPoint = /const db = firebase\.database\(\);\s*\/\//;
    if (content.match(insertPoint)) {
        content = content.replace(insertPoint, `const db = firebase.database();\n\n// Run settings listener immediately to unblock login screen\n${settingsCode}\n\n//`);
    } else {
        // Fallback: Just inject it right after `const db = firebase.database();`
        content = content.replace('const db = firebase.database();', `const db = firebase.database();\n\n${settingsCode}\n\n`);
    }
    
    fs.writeFileSync(path, content, 'utf8');
    console.log("Extracted settings listener successfully.");
} else {
    console.error("Could not find the settings listener.");
}
