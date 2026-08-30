import re

path = 'specialty-modules/dental_chart_module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# CSS style replacements
text = text.replace('background: #fff;', 'background: var(--surf);')
text = text.replace('background: #ffffff;', 'background: var(--surf);')
text = text.replace('background: #f8fafc;', 'background: var(--bg);')
text = text.replace('background: #f1f5f9;', 'background: var(--bg);')
text = text.replace('border: 1px solid #e2e8f0;', 'border: 1px solid var(--border);')
text = text.replace('border: 1px solid #cbd5e1;', 'border: 1px solid var(--border);')
text = text.replace('border: 2px solid #e2e8f0;', 'border: 2px solid var(--border);')
text = text.replace('border-bottom: 2px solid #e2e8f0;', 'border-bottom: 2px solid var(--border);')
text = text.replace('border-bottom: 1px dashed #cbd5e1;', 'border-bottom: 1px dashed var(--border);')
text = text.replace('border-top: 1px dashed #cbd5e1;', 'border-top: 1px dashed var(--border);')
text = text.replace('border-bottom: 1px dashed #e2e8f0;', 'border-bottom: 1px dashed var(--border);')
text = text.replace('color: #0f172a;', 'color: var(--text);')
text = text.replace('color: #1e293b;', 'color: var(--text);')
text = text.replace('color: #334155;', 'color: var(--text);')
text = text.replace('color: #475569;', 'color: var(--muted);')

# SVG fill replacements
text = text.replace('fill="#f0fdf4"', 'fill="var(--bg)"')
text = text.replace('fill="#f8fafc"', 'fill="var(--bg)"')
text = text.replace('fill="#ffffff"', 'fill="var(--surf)"')
text = text.replace('stroke="#cbd5e1"', 'stroke="var(--border)"')
text = text.replace('stroke="#94a3b8"', 'stroke="var(--muted)"')
text = text.replace('fill="#475569"', 'fill="var(--text)"')

# bridge panel
text = text.replace('background: #e0f2fe;', 'background: rgba(14, 165, 233, 0.1);')
text = text.replace('border: 1px solid #7dd3fc;', 'border: 1px solid rgba(14, 165, 233, 0.3);')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
