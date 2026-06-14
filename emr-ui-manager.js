/**
 * ARGON MEDICAL OS — EMR UI Manager
 * Handles UI interactions, tabs, toasts, and themes.
 * Extracted from emr-app.js (Phase 4 Modularization)
 */

window.ArgonUIManager = {
    // Switch Sidebar Navigation Tabs
    sw: function (id, el) {
        // Prevent opening empty clinical workspace if no patient is active
        if (id === 'newVisit') {
            if (typeof window.activeVisit === 'undefined' || !window.activeVisit || !window.activeVisit.uid) {
                if (typeof this.toast !== 'undefined') this.toast('⚠️ الرجاء اختيار مريض من غرفة الانتظار أولاً لبدء زيارة', 'warn');
                return;
            }
        }

        // Release patient locks when leaving patient-specific contexts
        if (id !== 'patFile' && id !== 'newVisit') {
            if (window.EMRContext && window.EMRContext.sessionLock) {
                if (typeof BASE !== 'undefined' && window.EMRContext.activePatientId && window.db) {
                    window.db.ref(`${BASE}/active_sessions/${window.EMRContext.activePatientId}`).remove();
                }
                window.EMRContext.sessionLock = false;
                window.EMRContext.activePatientId = null;
            }
        }

        document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
        const targetSection = document.getElementById(id);
        if (targetSection) targetSection.classList.add('on');

        document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
        if (el) el.classList.add('on');
    },

    // Toast Notifications
    toast: function (msg, type = '') {
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.className = type ? 'show ' + type : 'show';
        setTimeout(() => t.className = '', 3000);
    },

    // Theme Toggling
    toggleTheme: function () {
        const currentTheme = document.body.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', nextTheme);
        localStorage.setItem('argon_theme', nextTheme);
        this.updateThemeIcon(nextTheme);
    },

    updateThemeIcon: function (theme) {
        const btn = document.getElementById('themeBtn');
        if (btn) btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
};

// Global polyfills to keep backward compatibility with emr-app.js existing code
window.sw = function(id, el) { return window.ArgonUIManager.sw(id, el); };
window.toast = function(msg, type) { return window.ArgonUIManager.toast(msg, type); };
window.toggleTheme = function() { return window.ArgonUIManager.toggleTheme(); };
window.updateThemeIcon = function(theme) { return window.ArgonUIManager.updateThemeIcon(theme); };
