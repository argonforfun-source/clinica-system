import re

with open('dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Remove C2 comments
content = content.replace('        // ── C2: عرض الرقم الوطني على الكارت ──\n', '')
content = content.replace('        // ── نهاية C2 ──\n', '')

# Fix 2: Replace nationalId: "" with nationalId: bookingNID_cmp
target2_old = '''    const matchResult = await window.ArgonMedical.PatientMatch.findMatch(
      CID,
      { name: bookingName, phone: patPhone, nationalId: "" },
      db
    );'''
target2_new = '''    const bookingNID_cmp = ArgonNID.cleanNID(b.patNationalId || b.nationalId || '');
    const matchResult = await window.ArgonMedical.PatientMatch.findMatch(
      CID,
      { name: bookingName, phone: patPhone, nationalId: bookingNID_cmp },
      db
    );'''

content = content.replace(target2_old, target2_new)

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
