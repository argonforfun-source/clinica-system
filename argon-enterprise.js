/**
 * ARGON MEDICAL OS — Enterprise Features v4.0
 * PDF Generation (RTL), Excel Export, Advanced Optimizations
 */

const ArgonEnterprise = {
    // ── 1. PDF INVOICING (RTL) ──
    PDF: {
        async generateInvoice(clinicSettings, patientData, items, total, invoiceNo) {
            // Create a hidden div for the invoice
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = '-9999px';
            div.style.top = '0';
            div.style.width = '800px';
            div.style.background = '#fff';
            div.style.color = '#000';
            div.style.fontFamily = "'Tajawal', sans-serif";
            div.dir = 'rtl';
            
            const dateStr = new Date().toLocaleDateString('ar-JO');
            const itemsHtml = items.map((i, idx) => `
                <tr style="border-bottom:1px solid #ddd">
                    <td style="padding:10px">${idx+1}</td>
                    <td style="padding:10px">${i.name}</td>
                    <td style="padding:10px">${i.qty}</td>
                    <td style="padding:10px">${i.price} JOD</td>
                    <td style="padding:10px">${(i.qty * i.price).toFixed(2)} JOD</td>
                </tr>
            `).join('');

            div.innerHTML = `
                <div style="padding:40px;border:2px solid #0d9488;border-radius:12px;margin:20px">
                    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:20px;margin-bottom:20px">
                        <div>
                            <h1 style="color:#0d9488;margin:0">${clinicSettings.name}</h1>
                            <p style="margin:5px 0;color:#555">${clinicSettings.address || ''} | ${clinicSettings.phone || ''}</p>
                        </div>
                        <div style="text-align:left">
                            <h2 style="margin:0;color:#333">فاتورة ضريبية</h2>
                            <p style="margin:5px 0;color:#555">رقم: ${invoiceNo}</p>
                            <p style="margin:5px 0;color:#555">التاريخ: ${dateStr}</p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom:30px;background:#f8f9fa;padding:15px;border-radius:8px">
                        <h3 style="margin:0 0 10px;color:#0d9488">بيانات المريض:</h3>
                        <p style="margin:0"><strong>الاسم:</strong> ${patientData.name}</p>
                        <p style="margin:5px 0 0"><strong>الهاتف:</strong> ${patientData.phone}</p>
                    </div>

                    <table style="width:100%;border-collapse:collapse;margin-bottom:30px;text-align:right">
                        <thead>
                            <tr style="background:#0d9488;color:#fff">
                                <th style="padding:10px">#</th>
                                <th style="padding:10px">البيان</th>
                                <th style="padding:10px">الكمية</th>
                                <th style="padding:10px">السعر الإفرادي</th>
                                <th style="padding:10px">المجموع</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>

                    <div style="display:flex;justify-content:flex-end">
                        <div style="width:300px;background:#f8f9fa;padding:20px;border-radius:8px;border:1px solid #ddd">
                            <h2 style="margin:0;color:#0d9488;display:flex;justify-content:space-between">
                                <span>الإجمالي:</span>
                                <span>${total.toFixed(2)} JOD</span>
                            </h2>
                        </div>
                    </div>
                    
                    <div style="margin-top:50px;text-align:center;color:#777;font-size:12px;border-top:1px solid #ddd;padding-top:20px">
                        شكراً لثقتكم بنا. مع تمنياتنا لكم بالصحة والعافية.
                        <br>تم إنشاء هذه الفاتورة بواسطة ARGON Medical OS
                    </div>
                </div>
            `;
            
            document.body.appendChild(div);

            // Load html2pdf script dynamically
            if (typeof window.html2pdf === 'undefined') {
                await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
            }

            const opt = {
                margin: 0,
                filename: `Invoice_${invoiceNo}_${patientData.name}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            await window.html2pdf().set(opt).from(div).save();
            document.body.removeChild(div);
        },

        _loadScript(src) {
            return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        },

        async generatePrescription(clinicSettings, patientData, medications, prescNotes, docName) {
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = '-9999px';
            div.style.top = '0';
            div.style.width = '800px';
            div.style.background = '#fff';
            div.style.color = '#000';
            div.style.fontFamily = "'Tajawal', sans-serif";
            div.dir = 'rtl';
            
            const dateStr = new Date().toLocaleDateString('ar-JO');
            const medsHtml = medications.map((m, idx) => `
                <tr style="border-bottom:1px solid #eee">
                    <td style="padding:15px;font-weight:bold;color:#334155">${idx+1}</td>
                    <td style="padding:15px;font-weight:bold;color:#0f172a;font-size:1.1rem">${m.name}</td>
                    <td style="padding:15px;color:#475569">${m.dose || '-'}</td>
                    <td style="padding:15px;color:#475569">${m.freq || '-'}</td>
                    <td style="padding:15px;color:#475569">${m.dur || '-'}</td>
                </tr>
            `).join('');

            div.innerHTML = `
                <div style="padding:40px;border:2px solid #0d9488;border-radius:12px;margin:20px;position:relative">
                    <!-- Watermark -->
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -50%) rotate(-45deg);font-size:120px;color:rgba(13, 148, 136, 0.03);z-index:0;font-weight:900;pointer-events:none;white-space:nowrap">${clinicSettings.name}</div>
                    
                    <div style="position:relative;z-index:1">
                        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:20px;margin-bottom:20px">
                            <div>
                                <h1 style="color:#0d9488;margin:0;font-size:2rem">${clinicSettings.name}</h1>
                                <p style="margin:8px 0 0;color:#64748b;font-weight:600">د. ${docName}</p>
                                <p style="margin:5px 0 0;color:#94a3b8;font-size:0.9rem">${clinicSettings.address || ''} | ${clinicSettings.phone || ''}</p>
                            </div>
                            <div style="text-align:left">
                                <h2 style="margin:0;color:#1e293b;font-size:1.5rem">وصفة طبية (Rx)</h2>
                                <p style="margin:8px 0 0;color:#64748b">التاريخ: ${dateStr}</p>
                            </div>
                        </div>
                        
                        <div style="margin-bottom:30px;background:#f8fafc;padding:15px 20px;border-radius:8px;border:1px solid #e2e8f0;display:flex;justify-content:space-between">
                            <div>
                                <h3 style="margin:0 0 10px;color:#0d9488;font-size:1.1rem">المريض:</h3>
                                <p style="margin:0;font-weight:700;color:#1e293b;font-size:1.2rem">${patientData.name}</p>
                            </div>
                            <div style="text-align:left">
                                <p style="margin:0;color:#64748b">العمر: ${patientData.age || '-'} سنة</p>
                                <p style="margin:5px 0 0;color:#64748b">الجنس: ${patientData.gender === 'male' ? 'ذكر' : (patientData.gender === 'female' ? 'أنثى' : '-')}</p>
                            </div>
                        </div>

                        <div style="font-size:4rem;color:#0d9488;line-height:1;margin-bottom:10px;font-family:serif;opacity:0.2">Rx</div>

                        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;text-align:right">
                            <thead>
                                <tr style="background:#f1f5f9;color:#475569">
                                    <th style="padding:12px 15px;border-radius:0 8px 8px 0">#</th>
                                    <th style="padding:12px 15px">اسم العلاج</th>
                                    <th style="padding:12px 15px">الجرعة</th>
                                    <th style="padding:12px 15px">التكرار</th>
                                    <th style="padding:12px 15px;border-radius:8px 0 0 8px">المدة</th>
                                </tr>
                            </thead>
                            <tbody>${medsHtml}</tbody>
                        </table>

                        ${prescNotes ? `
                        <div style="margin-top:20px;padding:15px;border-right:4px solid #f59e0b;background:#fffbeb;border-radius:8px;color:#b45309">
                            <h4 style="margin:0 0 5px">تعليمات إضافية:</h4>
                            <p style="margin:0">${prescNotes.replace(/\n/g, '<br>')}</p>
                        </div>
                        ` : ''}

                        <div style="margin-top:60px;display:flex;justify-content:space-between;align-items:flex-end">
                            <div style="color:#94a3b8;font-size:0.85rem">
                                ملاحظة: هذه الوصفة صالحة لمدة 3 أيام من تاريخ الإصدار.
                            </div>
                            <div style="text-align:center;width:200px">
                                <div style="border-bottom:1px dashed #cbd5e1;margin-bottom:10px;height:40px"></div>
                                <div style="color:#475569;font-weight:700">توقيع الطبيب وختم العيادة</div>
                            </div>
                        </div>
                        
                        <div style="margin-top:40px;text-align:center;color:#94a3b8;font-size:0.8rem;border-top:1px solid #e2e8f0;padding-top:20px">
                            مع تمنياتنا لكم بالشفاء العاجل<br>تم إنشاء هذه الوصفة بواسطة ARGON EMR
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(div);

            if (typeof window.html2pdf === 'undefined') {
                await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
            }

            const opt = {
                margin: 0,
                filename: `Prescription_${patientData.name}_${dateStr}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            await window.html2pdf().set(opt).from(div).save();
            document.body.removeChild(div);
        },

        async generateTimeline(clinicSettings, patientData, visitsArray) {
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = '-9999px';
            div.style.top = '0';
            div.style.width = '800px';
            div.style.background = '#fff';
            div.style.color = '#000';
            div.style.fontFamily = "'Tajawal', sans-serif";
            div.dir = 'rtl';
            
            const dateStr = new Date().toLocaleDateString('ar-JO');
            
            const visitsHtml = visitsArray.map(v => `
                <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:12px;padding:20px;page-break-inside:avoid">
                    <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;margin-bottom:15px">
                        <div style="font-weight:800;color:#0d9488">${v.date} - ${v.time}</div>
                        <div style="color:#64748b;font-weight:700">د. ${v.docName}</div>
                    </div>
                    
                    ${v.complaint ? `<div style="margin-bottom:10px"><strong style="color:#475569">الشكوى الرئيسية:</strong><p style="margin:5px 0 0;color:#1e293b">${v.complaint}</p></div>` : ''}
                    ${v.diagnosis ? `<div style="margin-bottom:10px"><strong style="color:#475569">التشخيص النهائي:</strong><p style="margin:5px 0 0;color:#1e293b">${v.diagnosis}</p></div>` : ''}
                    ${v.notes ? `<div style="margin-bottom:10px"><strong style="color:#475569">الملاحظات الطبية:</strong><p style="margin:5px 0 0;color:#1e293b">${v.notes}</p></div>` : ''}
                    
                    ${(v.vitals && (v.vitals.bp || v.vitals.temp || v.vitals.pulse)) ? `
                    <div style="display:flex;gap:15px;margin-top:15px;background:#f8fafc;padding:10px;border-radius:8px">
                        ${v.vitals.bp ? `<div><span style="color:#64748b;font-size:0.9rem">الضغط:</span> <strong style="color:#ef4444">${v.vitals.bp}</strong></div>` : ''}
                        ${v.vitals.temp ? `<div><span style="color:#64748b;font-size:0.9rem">الحرارة:</span> <strong style="color:#f59e0b">${v.vitals.temp} °C</strong></div>` : ''}
                        ${v.vitals.pulse ? `<div><span style="color:#64748b;font-size:0.9rem">النبض:</span> <strong style="color:#3b82f6">${v.vitals.pulse} bpm</strong></div>` : ''}
                    </div>` : ''}
                </div>
            `).join('');

            div.innerHTML = `
                <div style="padding:40px;border:2px solid #0d9488;border-radius:12px;margin:20px">
                    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:20px;margin-bottom:20px">
                        <div>
                            <h1 style="color:#0d9488;margin:0">${clinicSettings.name}</h1>
                            <p style="margin:5px 0;color:#555">${clinicSettings.address || ''} | ${clinicSettings.phone || ''}</p>
                        </div>
                        <div style="text-align:left">
                            <h2 style="margin:0;color:#333">السجل الطبي الموحد (EMR)</h2>
                            <p style="margin:5px 0;color:#555">تاريخ الطباعة: ${dateStr}</p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom:30px;background:#f8f9fa;padding:20px;border-radius:8px;border:1px solid #ddd;display:grid;grid-template-columns:1fr 1fr;gap:15px">
                        <div>
                            <h3 style="margin:0 0 15px;color:#0d9488;grid-column:1/-1">الملف الشخصي للمريض</h3>
                            <p style="margin:0 0 8px"><strong>الاسم:</strong> ${patientData.name}</p>
                            <p style="margin:0 0 8px"><strong>الهاتف:</strong> ${patientData.phone}</p>
                            <p style="margin:0"><strong>الرقم الوطني/الهوية:</strong> ${patientData.natId || '-'}</p>
                        </div>
                        <div>
                            <h3 style="margin:0 0 15px;color:transparent;user-select:none">.</h3>
                            <p style="margin:0 0 8px"><strong>العمر:</strong> ${patientData.age || '-'}</p>
                            <p style="margin:0 0 8px"><strong>الجنس:</strong> ${patientData.gender === 'male' ? 'ذكر' : (patientData.gender === 'female' ? 'أنثى' : '-')}</p>
                            <p style="margin:0"><strong>فصيلة الدم:</strong> <span style="color:#ef4444;font-weight:800;direction:ltr;display:inline-block">${patientData.bloodType || '-'}</span></p>
                        </div>
                        
                        ${(patientData.allergies || patientData.chronic) ? `
                        <div style="grid-column:1/-1;margin-top:10px;padding-top:15px;border-top:1px dashed #cbd5e1">
                            ${patientData.allergies ? `<p style="margin:0 0 8px;color:#ef4444"><strong><i class="fas fa-exclamation-triangle"></i> حساسية:</strong> ${patientData.allergies}</p>` : ''}
                            ${patientData.chronic ? `<p style="margin:0;color:#f59e0b"><strong><i class="fas fa-notes-medical"></i> أمراض مزمنة:</strong> ${patientData.chronic}</p>` : ''}
                        </div>` : ''}
                    </div>

                    <h3 style="margin:0 0 20px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:10px">التاريخ الطبي والزيارات السابقة:</h3>
                    
                    <div style="display:flex;flex-direction:column;gap:10px">
                        ${visitsArray.length > 0 ? visitsHtml : '<p style="text-align:center;color:#94a3b8;padding:30px">لا يوجد سجل زيارات سابق لهذا المريض</p>'}
                    </div>

                    <div style="margin-top:50px;text-align:center;color:#777;font-size:12px;border-top:1px solid #ddd;padding-top:20px">
                        وثيقة طبية معتمدة من نظام ARGON Enterprise Medical OS
                    </div>
                </div>
            `;
            
            document.body.appendChild(div);

            if (typeof window.html2pdf === 'undefined') {
                await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
            }

            const opt = {
                margin: 0,
                filename: `Medical_Record_${patientData.name}_${dateStr}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            await window.html2pdf().set(opt).from(div).save();
            document.body.removeChild(div);
        }
    },

    // ── 2. EXCEL EXPORT (RTL) ──
    Excel: {
        async exportTable(dataArray, filename, sheetName = 'Sheet1') {
            if (typeof window.XLSX === 'undefined') {
                await ArgonEnterprise.PDF._loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
            }

            const wb = window.XLSX.utils.book_new();
            wb.Workbook = { Views: [{ RTL: true }] }; // Force RTL view in Excel

            const ws = window.XLSX.utils.json_to_sheet(dataArray);
            
            // Auto-size columns based on content length
            const colWidths = [];
            dataArray.forEach(row => {
                Object.keys(row).forEach((key, i) => {
                    const valStr = String(row[key]);
                    colWidths[i] = Math.max(colWidths[i] || 0, valStr.length, key.length);
                });
            });
            ws['!cols'] = colWidths.map(w => ({ wch: w + 5 })); // Add padding

            window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
            window.XLSX.writeFile(wb, `${filename}.xlsx`);
        },

        async exportComprehensiveReport(clinicId) {
            if (!window.firebase || !window.firebase.database) throw new Error("Firebase not ready");
            
            if (typeof toast === 'function') toast("جاري سحب وتجميع البيانات الشاملة... يرجى الانتظار", "info");
            
            if (typeof window.XLSX === 'undefined') {
                await ArgonEnterprise.PDF._loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
            }

            const db = window.firebase.database();
            const snap = await db.ref(`clinics/${clinicId}`).once('value');
            const data = snap.val();
            
            if (!data) {
                if (typeof toast === 'function') toast("لم يتم العثور على بيانات العيادة", "err");
                return;
            }

            const wb = window.XLSX.utils.book_new();
            wb.Workbook = { Views: [{ RTL: true }] };
            const dateStr = new Date().toLocaleDateString('ar-JO', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const clinicName = (data.settings && data.settings.name) ? data.settings.name : "العيادة";

            const appendSheet = (dataArray, sheetName) => {
                if (!dataArray || dataArray.length === 0) {
                    dataArray = [{"ملاحظة": "لا يوجد بيانات"}];
                }
                const ws = window.XLSX.utils.json_to_sheet(dataArray);
                const colWidths = [];
                dataArray.forEach(row => {
                    Object.keys(row).forEach((key, i) => {
                        const valStr = String(row[key]);
                        colWidths[i] = Math.max(colWidths[i] || 0, valStr.length, key.length);
                    });
                });
                ws['!cols'] = colWidths.map(w => ({ wch: w + 5 }));
                window.XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
            };

            // 1. Summary
            const patientsCount = data.patients ? Object.keys(data.patients).length : 0;
            const aptsCount = data.appointments ? Object.keys(data.appointments).reduce((acc, d) => acc + Object.keys(data.appointments[d]).reduce((a2, t) => a2 + Object.keys(data.appointments[d][t]).length, 0), 0) : 0;
            const docCount = data.doctors ? Object.keys(data.doctors).length : 0;
            const staffCount = data.staff ? Object.keys(data.staff).length : 0;
            
            const summaryData = [{
                "اسم العيادة": clinicName,
                "رقم الهاتف": data.settings?.phone || "-",
                "إجمالي المرضى": patientsCount,
                "إجمالي المواعيد": aptsCount,
                "عدد الأطباء": docCount,
                "طاقم العمل": staffCount,
                "تاريخ التقرير": dateStr
            }];
            appendSheet(summaryData, "ملخص وإحصائيات");

            // 2. Patients
            const ptsData = [];
            if (data.patients) {
                Object.values(data.patients).forEach(p => {
                    ptsData.push({
                        "اسم المريض": p.info?.name || "-",
                        "رقم الهاتف": p.info?.phone || "-",
                        "الرقم الوطني / الهوية": p.info?.natId || "-",
                        "تاريخ الميلاد / العمر": p.info?.age || "-",
                        "الجنس": p.info?.gender === 'male' ? 'ذكر' : (p.info?.gender === 'female' ? 'أنثى' : '-'),
                        "تاريخ التسجيل": p.info?.createdAt ? new Date(p.info.createdAt).toLocaleDateString('ar-JO') : "-"
                    });
                });
            }
            appendSheet(ptsData, "سجل المرضى");

            // 3. Appointments
            const aptData = [];
            if (data.appointments) {
                const allApts = [];
                Object.keys(data.appointments).forEach(date => {
                    const dObj = data.appointments[date];
                    Object.keys(dObj).forEach(time => {
                        const tObj = dObj[time];
                        Object.values(tObj).forEach(a => {
                            allApts.push({ date, time, ...a });
                        });
                    });
                });
                allApts.sort((a,b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
                
                const statusMap = { 'waiting': 'قيد الانتظار', 'in-progress': 'في الداخل', 'completed': 'مكتمل', 'cancelled': 'ملغي' };
                allApts.forEach(a => {
                    aptData.push({
                        "التاريخ": a.date,
                        "الوقت": a.time,
                        "رقم الدور": a.queueNum || "-",
                        "اسم المريض": a.patientName || "-",
                        "الحالة": statusMap[a.status] || a.status,
                        "نوع الحجز": a.type === 'consultation' ? 'كشفية' : (a.type === 'followup' ? 'مراجعة' : a.type || '-')
                    });
                });
            }
            appendSheet(aptData, "المواعيد والحجوزات");

            // 4. Doctors
            const docData = [];
            if (data.doctors) {
                Object.values(data.doctors).forEach(d => {
                    if(d.credentials) {
                        docData.push({
                            "اسم الطبيب": d.credentials.name || "-",
                            "الهاتف": d.credentials.phone || "-",
                            "التخصص": d.credentials.specialty || "-",
                            "حالة الحساب": d.credentials.identityStatus === 'SUSPENDED' ? 'موقوف' : 'فعال'
                        });
                    }
                });
            }
            appendSheet(docData, "الكادر الطبي");

            // 5. Staff
            const staffData = [];
            if (data.staff) {
                Object.values(data.staff).forEach(s => {
                    if(s.credentials) {
                        staffData.push({
                            "الاسم": s.credentials.name || "-",
                            "الهاتف": s.credentials.phone || "-",
                            "الصلاحية (الدور)": s.credentials.role || "-",
                            "حالة الحساب": s.credentials.identityStatus === 'SUSPENDED' ? 'موقوف' : 'فعال'
                        });
                    }
                });
            }
            appendSheet(staffData, "طاقم العمل");

            window.XLSX.writeFile(wb, `تقرير_شامل_${clinicName}_${dateStr.replace(/\//g,'-')}.xlsx`);
            if (typeof toast === 'function') toast("تم تصدير التقرير بنجاح!", "ok");
        }
    },

    // ── 3. ADVANCED CACHING & PERFORMANCE (IndexedDB fallback) ──
    Cache: {
        async init() {
            // Simple LRU cache wrapper over localStorage for extremely fast reads of static clinical data
            // (e.g. catalog, templates) to prevent waiting for Firebase on reload
            if (!window._argonCache) window._argonCache = {};
        },
        set(key, data) {
            try {
                localStorage.setItem(`ARGON_CACHE_${key}`, JSON.stringify({
                    ts: Date.now(), data
                }));
                window._argonCache[key] = data;
            } catch(e) {}
        },
        get(key, maxAgeHours = 24) {
            if (window._argonCache[key]) return window._argonCache[key];
            try {
                const raw = localStorage.getItem(`ARGON_CACHE_${key}`);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (Date.now() - parsed.ts > maxAgeHours * 3600000) return null; // expired
                window._argonCache[key] = parsed.data;
                return parsed.data;
            } catch(e) { return null; }
        }
    },

    // ── 4. ENTERPRISE LIVE UPDATE ENGINE ──
    LiveUpdate: {
        _initialized: false,
        init(dbRef, basePath) {
            if (this._initialized) return;
            this._initialized = true;
            
            const verRef = dbRef.ref(`${basePath}/system_version`);
            verRef.on('value', snap => {
                const newVer = snap.val();
                if (!newVer) return; // Not set yet
                
                const currentVer = localStorage.getItem('ARGON_VERSION');
                if (!currentVer) {
                    // First time, just record it
                    localStorage.setItem('ARGON_VERSION', newVer);
                } else if (currentVer !== newVer) {
                    // Version changed! Trigger professional auto-refresh
                    this.triggerUpdate(newVer);
                }
            });
        },
        triggerUpdate(newVersion) {
            const toastDiv = document.createElement('div');
            toastDiv.innerHTML = `
                <div style="position:fixed;bottom:25px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg, #2563eb, #3b82f6);color:white;padding:15px 35px;border-radius:30px;box-shadow:0 15px 30px rgba(37,99,235,0.4);z-index:999999;font-weight:bold;display:flex;align-items:center;gap:12px;font-family:'Tajawal', sans-serif;animation: slideUpArgon 0.6s cubic-bezier(0.16, 1, 0.3, 1);">
                    <i class="fas fa-sync fa-spin" style="font-size:1.3rem"></i> 
                    <span style="font-size:1.1rem;letter-spacing:0.5px">تم إطلاق تحديث جديد للنظام! جاري التحديث التلقائي...</span>
                </div>
            `;
            document.body.appendChild(toastDiv);
            
            if(!document.getElementById('liveUpdateStyle')) {
                const style = document.createElement('style');
                style.id = 'liveUpdateStyle';
                style.innerHTML = `@keyframes slideUpArgon { from { bottom: -60px; opacity: 0; transform: translateX(-50%) scale(0.9); } to { bottom: 25px; opacity: 1; transform: translateX(-50%) scale(1); } }`;
                document.head.appendChild(style);
            }

            // Lock the screen slightly to prevent data entry during refresh
            const overlay = document.createElement('div');
            overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.4);z-index:999998;backdrop-filter:blur(2px);";
            document.body.appendChild(overlay);

            setTimeout(() => {
                localStorage.setItem('ARGON_VERSION', newVersion);
                window.location.reload(true); // Force clear cache reload
            }, 3500);
        }
    }
};

window.ArgonEnterprise = ArgonEnterprise;

// Auto-initialize LiveUpdate when Firebase is globally ready
const liveUpdateCheck = setInterval(() => {
    if (typeof db !== 'undefined' && typeof BASE !== 'undefined' && typeof db.ref === 'function') {
        clearInterval(liveUpdateCheck);
        ArgonEnterprise.LiveUpdate.init(db, BASE);
    }
}, 1500);
