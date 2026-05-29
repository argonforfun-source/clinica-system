const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
const html = fs.readFileSync(path, 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
try {
    dom.window.eval(`
        // mock firebase
        window.firebase = {
            apps: [],
            initializeApp: () => {},
            database: () => ({
                ref: () => ({
                    on: () => {},
                    once: () => ({ then: () => {} })
                }),
                ServerValue: { TIMESTAMP: 123 }
            }),
            auth: () => ({
                onAuthStateChanged: () => {},
                signInAnonymously: () => Promise.resolve()
            }),
            storage: () => ({})
        };
        document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    `);
    
    // Simulate doLogin
    dom.window.document.getElementById('lPass').value = '1122';
    dom.window.doLogin();
    console.log("doLogin executed successfully.");
} catch (e) {
    console.error("Error during doLogin:", e);
}
