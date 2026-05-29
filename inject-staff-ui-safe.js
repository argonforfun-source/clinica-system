const fs = require('fs');

const path = 'd:\\git__hub\\argon-system\\clinica-repo\\dashboard.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Sidebar Tab
const sidebarTarget = `<div class="ni" onclick="sw('docs',this)"><i class="fas fa-user-md"></i>إدارة الأطباء</div>`;
const sidebarReplace = `<div class="ni" onclick="sw('docs',this)"><i class="fas fa-user-md"></i>إدارة الأطباء</div>
        <div class="ni" onclick="sw('staff',this)"><i class="fas fa-users-cog"></i>إدارة الطاقم الطبي والإداري</div>`;

if (content.includes(sidebarTarget) && !content.includes("sw('staff',this)")) {
    content = content.replace(sidebarTarget, sidebarReplace);
}

// 2. Add Staff Section HTML before Settings
const settingsTarget = `    <div id="settings" class="sec">`;
const staffSectionHtml = `    <div id="staff" class="sec">
      <div class="ph"><div><div class="pt">👥 إدارة الطاقم الطبي والإداري</div></div></div>
      <div class="addpanel" style="margin-bottom:20px; display:flex; gap:10px; flex-wrap:wrap;">
        <input type="text" id="nstaffName" placeholder="الاسم الكامل" class="fi" style="flex:1; min-width:200px;">
        <select id="nstaffRole" class="fi" style="flex:1; min-width:150px;">
           <option value="reception">موظف استقبال</option>
           <option value="pharmacist">صيدلاني</option>
           <option value="lab">فني مختبر</option>
           <option value="radiology">فني أشعة</option>
           <option value="admin">مدير نظام</option>
        </select>
        <button onclick="addStaffMem()" class="btn-primary" style="flex:1; min-width:150px; justify-content:center;"><i class="fas fa-user-plus"></i> إضافة موظف</button>
      </div>
      <div id="staffGrid" class="sgrid docs-grid" style="grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); margin-bottom: 20px;">
          <div style="color:var(--muted);font-size:.84rem;grid-column:1/-1">جاري تحميل الطاقم...</div>
      </div>
    </div>
`;

if (content.includes(settingsTarget) && !content.includes('<div id="staff" class="sec">')) {
    content = content.replace(settingsTarget, staffSectionHtml + settingsTarget);
}

// 3. Remove Enterprise Security Hub Table HTML completely WITHOUT breaking JS
const hubRegex = /<!-- ENTERPRISE SECURITY HUB -->[\s\S]*?<tbody id="securityHubTableBody">[\s\S]*?<\/tbody>[\s\S]*?<\/table>[\s\S]*?<\/div>[\s\S]*?<\/div>/m;
if (content.match(hubRegex)) {
    content = content.replace(hubRegex, '');
    console.log("Removed Enterprise Security Hub Table HTML safely.");
}

// 4. Remove renderSecurityHub JS function ONLY
const renderHubJsRegex = /function renderSecurityHub\(data\) \{[\s\S]*?\}\s*(?=\/\/\s*[^E]*ENTERPRISE SECURITY CONSOLE)/m;
if (content.match(renderHubJsRegex)) {
    content = content.replace(renderHubJsRegex, '');
    console.log("Removed renderSecurityHub function safely.");
}

// 5. Remove initSecurityHubListener
const initHubRegex = /let isSecurityHubInitialized = false;\s*function initSecurityHubListener\(\) \{[\s\S]*?\}\s*\/\/\s*Initialize Security Hub immediately\s*initSecurityHubListener\(\);/m;
if (content.match(initHubRegex)) {
    content = content.replace(initHubRegex, '');
    console.log("Removed initSecurityHubListener safely.");
}

fs.writeFileSync(path, content, 'utf8');
