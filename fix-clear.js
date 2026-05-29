const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\argon-core.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic clear() is likely in window.ArgonSessionRegistry = {
const targetRegex = /clear:\s*function\(\)\s*\{[\s\S]*?sessionStorage\.removeItem\(this\.KEY\);[\s\S]*?window\.location\.reload\(\);[\s\S]*?\}/g;

if (content.match(targetRegex)) {
    content = content.replace(targetRegex, `clear: function() {
        this._inMemorySession = null;
        sessionStorage.removeItem(this.KEY);
    }`);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Removed window.location.reload() from clear()");
} else {
    // try exact match
    const altRegex = /window\.location\.reload\(\);/g;
    console.log("Regex didn't match. We will use a more targeted replacement.");
}
