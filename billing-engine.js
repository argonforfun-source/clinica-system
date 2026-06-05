/**
 * 💰 ARGON BILLING ENGINE (ZERO RISK MODE)
 * STRICTLY ADDITIVE - NO MODIFICATION TO EMR/CLINICAL WORKFLOWS
 */

const BillingEngine = {
  _invoices: {},
  _transactions: {},
  _patientsRef: null,
  activePatientId: null,

  init: function() {
    let isAuthorized = false;

    // Check if we are in dashboard.html (which sets clinica_auth_CID)
    if (typeof CID !== 'undefined' && sessionStorage.getItem('clinica_auth_' + CID) === '1') {
      isAuthorized = true; // Dashboard user is inherently an admin
    } else if (window.ArgonSession) {
      // Check standard ArgonSession used in other portals
      const session = window.ArgonSession.get();
      if (session && (session.role === 'admin' || session.role === 'accountant' || session.role === 'superadmin')) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const btn = document.getElementById('mBilling');
      if (btn) btn.style.display = 'none';
      return;
    }

    const btn = document.getElementById('mBilling');
    if (btn) btn.style.display = 'flex';

    if (typeof db !== 'undefined' && BASE) {
      // 1. Listen for Financial Data
      db.ref(`${BASE}/invoices`).on('value', snap => {
        this._invoices = snap.val() || {};
        this.renderKPIs();
        this.renderReceivables();
        if (this.activePatientId) this.renderPatientLedger(this.activePatientId);
      });

      db.ref(`${BASE}/financial_transactions`).on('value', snap => {
        this._transactions = snap.val() || {};
        this.renderKPIs();
        this.renderReceivables();
        if (this.activePatientId) this.renderPatientLedger(this.activePatientId);
      });

      // Listen to Patients for Name Resolution
      db.ref(`${BASE}/patients`).on('value', snap => {
        this._patientsRef = snap.val() || {};
        this.renderReceivables();
        if (this.activePatientId) this.renderPatientLedger(this.activePatientId);
      });

      // 2. Additive Observer - Generates Invoices without touching existing workflows
      this.initInvoiceGenerators();
    }
  },

  // ── SMART INVOICE GENERATOR (ADDITIVE ONLY) ──
  initInvoiceGenerators: function() {
    let initialBks = true, initialLab = true, initialRad = true, initialRx = true;
    
    const bksRef = db.ref(`${BASE}/completedBookings`);
    bksRef.once('value', () => initialBks = false);
    bksRef.on('child_added', snap => {
      if (!initialBks) this.generateInvoiceFromVisit(snap.key, snap.val());
    });

    // 2. Observe Lab Orders
    const labRef = db.ref(`${BASE}/lab_orders`);
    labRef.once('value', () => initialLab = false);
    labRef.on('child_added', snap => {
      const pLab = (typeof _sets !== 'undefined' && _sets.billingPrices) ? _sets.billingPrices.lab : 20;
      if (!initialLab) this.generateInvoiceFromAux(snap.key, snap.val(), 'مختبر', pLab || 20);
    });

    // 3. Observe Radiology Orders
    const radRef = db.ref(`${BASE}/radiology_orders`);
    radRef.once('value', () => initialRad = false);
    radRef.on('child_added', snap => {
      const pRad = (typeof _sets !== 'undefined' && _sets.billingPrices) ? _sets.billingPrices.rad : 30;
      if (!initialRad) this.generateInvoiceFromAux(snap.key, snap.val(), 'أشعة', pRad || 30);
    });

    // 4. Observe Pharmacy
    const rxRef = db.ref(`${BASE}/prescriptions`);
    rxRef.once('value', () => initialRx = false);
    rxRef.on('child_added', snap => {
      const pPhar = (typeof _sets !== 'undefined' && _sets.billingPrices) ? _sets.billingPrices.phar : 15;
      if (!initialRx) this.generateInvoiceFromAux(snap.key, snap.val(), 'صيدلية', pPhar || 15);
    });
  },

  generateInvoiceFromVisit: function(visitId, visitData) {
    if(!visitData || !visitData.patientId) return;
    const invId = `INV-${visitId}`;

    let fee = 15;
    if (typeof _docs !== 'undefined' && _docs[visitData.docId] && _docs[visitData.docId].fee) {
      fee = parseFloat(_docs[visitData.docId].fee);
    }
    const visitItem = {name: 'كشفية الطبيب', price: fee};

    if (this._invoices[invId]) {
      const currentItems = this._invoices[invId].items || [];
      const exists = currentItems.find(i => i.name === visitItem.name);
      if(!exists) {
        currentItems.push(visitItem);
        let newTotal = currentItems.reduce((acc, curr) => acc + curr.price, 0);
        db.ref(`${BASE}/invoices/${invId}`).update({
          items: currentItems,
          total: newTotal
        });
      }
    } else {
      this.saveInvoice(invId, visitData.patientId, visitId, [visitItem], visitData.patName, visitData.patPhone);
    }
  },

  generateInvoiceFromAux: function(orderId, orderData, deptName, defaultPrice) {
    if(!orderData || !orderData.patientId) return;
    
    const isUnified = (typeof _sets !== 'undefined' && (_sets.billingPolicy === 'unified' || !_sets.billingPolicy));
    
    // In Decentralized mode, auxiliary departments handle their own accounting.
    // So we do NOT add them to the central Reception Billing ledger.
    if (!isUnified) return; 
    
    const visitId = orderData.visitId || orderId; 
    const invId = `INV-${visitId}`;
    const items = [{name: `رسوم ${deptName}`, price: defaultPrice}];

    if (this._invoices[invId]) {
      const currentItems = this._invoices[invId].items || [];
      const exists = currentItems.find(i => i.name === items[0].name);
      if(!exists) {
        currentItems.push(items[0]);
        let newTotal = currentItems.reduce((acc, curr) => acc + curr.price, 0);
        db.ref(`${BASE}/invoices/${invId}`).update({
          items: currentItems,
          total: newTotal
        });
      }
    } else {
      this.saveInvoice(invId, orderData.patientId, visitId, items, orderData.patientName || orderData.patName, orderData.patientPhone || orderData.patPhone);
    }
  },

  saveInvoice: function(invId, patientId, visitId, items, patName, patPhone) {
    const total = items.reduce((acc, curr) => acc + curr.price, 0);
    const ts = new Date().toISOString();
    
    const invoiceData = {
      patientId: patientId,
      patientName: patName || '',
      patientPhone: patPhone || '',
      visitId: visitId,
      items: items,
      total: total,
      createdAt: ts,
      nationalInvoiceNumber: "",
      taxNumber: "",
      invoiceUUID: "",
      invoiceStatus: "draft"
    };

    db.ref(`${BASE}/invoices/${invId}`).set(invoiceData);
  },

  // ── MATH UTILS ──
  calculateInvoicePaid: function(invoiceId) {
    let paid = 0;
    Object.values(this._transactions).forEach(tx => {
      if (tx.invoiceId === invoiceId && tx.status !== 'voided') {
        if (tx.type === 'PAYMENT') paid += (parseFloat(tx.amount) || 0);
        if (tx.type === 'REVERSAL') paid -= (parseFloat(tx.amount) || 0);
      }
    });
    return parseFloat(paid.toFixed(2));
  },

  calculatePatientFinancials: function(patientId) {
    let totalBilled = 0;
    let totalPaid = 0;

    const patientInvoices = Object.entries(this._invoices).filter(([k, inv]) => inv.patientId === patientId);
    
    patientInvoices.forEach(([k, inv]) => {
      totalBilled += (parseFloat(inv.total) || 0);
      totalPaid += this.calculateInvoicePaid(k);
    });

    Object.values(this._transactions).forEach(tx => {
      if (!tx.invoiceId && tx.patientId === patientId && tx.status !== 'voided') {
        if (tx.type === 'PAYMENT') totalPaid += (parseFloat(tx.amount) || 0);
        if (tx.type === 'REVERSAL') totalPaid -= (parseFloat(tx.amount) || 0);
      }
    });

    return {
      total: parseFloat(totalBilled.toFixed(2)),
      paid: parseFloat(totalPaid.toFixed(2)),
      unpaid: parseFloat((totalBilled - totalPaid).toFixed(2))
    };
  },

  // ── RENDERING ──
  renderKPIs: function() {
    let totalReceivables = 0;
    let totalCollected = 0;
    let openCount = 0;
    let overdueCount = 0;

    Object.entries(this._invoices).forEach(([k, inv]) => {
      const total = parseFloat(inv.total) || 0;
      const paid = this.calculateInvoicePaid(k);
      const remaining = parseFloat((total - paid).toFixed(2));

      totalReceivables += remaining;
      totalCollected += paid;

      if (remaining > 0) {
        openCount++;
        if (inv.createdAt) {
          const invDate = new Date(inv.createdAt);
          const diffDays = Math.floor((new Date() - invDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 30) overdueCount++;
        }
      }
    });

    const elTotalPaid = document.getElementById('blTotalPaid');
    const elTotalUnpaid = document.getElementById('blTotalUnpaid');
    const elOpen = document.getElementById('blCountOpen');
    const elOverdue = document.getElementById('blCountOverdue');

    if (elTotalPaid) elTotalPaid.textContent = totalCollected.toFixed(2);
    if (elTotalUnpaid) elTotalUnpaid.textContent = totalReceivables.toFixed(2);
    if (elOpen) elOpen.textContent = openCount;
    if (elOverdue) elOverdue.textContent = overdueCount;
  },

  renderReceivables: function() {
    const tbody = document.getElementById('blTbody');
    if (!tbody) return;

    const searchQ = (document.getElementById('blSearch')?.value || '').trim().toLowerCase();
    const filterQ = document.getElementById('blFilter')?.value || 'all';

    const patientBalances = {};
    const pts = this._patientsRef || {};

    Object.entries(this._invoices).forEach(([k, inv]) => {
      const pid = inv.patientId;
      if (!pid) return;

      if (!patientBalances[pid]) {
        patientBalances[pid] = {
          patientId: pid,
          patientName: pts[pid] ? pts[pid].info?.name : (inv.patientName || 'مريض غير معروف'),
          patientPhone: pts[pid] ? pts[pid].info?.phone : (inv.patientPhone || ''),
          total: 0,
          paid: 0,
          lastDate: inv.createdAt || ''
        };
      }

      patientBalances[pid].total += parseFloat(inv.total) || 0;
      patientBalances[pid].paid += this.calculateInvoicePaid(k);
      if (inv.createdAt && inv.createdAt > patientBalances[pid].lastDate) {
        patientBalances[pid].lastDate = inv.createdAt;
      }
    });

    // Make sure patients with unassigned payments (or missing invoices) are also captured
    Object.values(this._transactions).forEach(tx => {
      const pid = tx.patientId;
      if (!pid || tx.status === 'voided') return;

      if (!patientBalances[pid]) {
        patientBalances[pid] = {
          patientId: pid,
          patientName: pts[pid] ? pts[pid].info?.name : 'مريض غير معروف',
          patientPhone: pts[pid] ? pts[pid].info?.phone : '',
          total: 0,
          paid: 0,
          lastDate: tx.timestamp || ''
        };
      }

      // If this transaction is NOT tied to a known invoice, we must add its value manually here
      if (!tx.invoiceId || !this._invoices[tx.invoiceId]) {
        if (tx.type === 'PAYMENT') patientBalances[pid].paid += (parseFloat(tx.amount) || 0);
        if (tx.type === 'REVERSAL') patientBalances[pid].paid -= (parseFloat(tx.amount) || 0);
      }
      
      if (tx.timestamp && tx.timestamp > patientBalances[pid].lastDate) {
        patientBalances[pid].lastDate = tx.timestamp;
      }
    });

    let html = '';
    
    Object.values(patientBalances).forEach(p => {
      p.total = parseFloat(p.total.toFixed(2));
      p.paid = parseFloat(p.paid.toFixed(2));
      const remaining = parseFloat((p.total - p.paid).toFixed(2));

      let status = 'unpaid';
      let statusBadge = '<span style="color:var(--red);background:rgba(239,68,68,0.1);padding:4px 8px;border-radius:6px;font-size:0.7rem;font-weight:bold">غير مدفوع</span>';
      
      if (remaining <= 0) {
        status = 'paid';
        statusBadge = '<span style="color:var(--green);background:rgba(16,185,129,0.1);padding:4px 8px;border-radius:6px;font-size:0.7rem;font-weight:bold">مسدد بالكامل</span>';
      } else if (p.paid > 0) {
        status = 'partial';
        statusBadge = '<span style="color:var(--amber);background:rgba(245,158,11,0.1);padding:4px 8px;border-radius:6px;font-size:0.7rem;font-weight:bold">دفع جزئي</span>';
      } else {
        const diffDays = Math.floor((new Date() - new Date(p.lastDate || new Date())) / (1000 * 60 * 60 * 24));
        if (diffDays > 30) {
          status = 'overdue';
          statusBadge = '<span style="color:#ef4444;background:rgba(239,68,68,0.15);padding:4px 8px;border-radius:6px;font-size:0.7rem;font-weight:bold;border:1px solid rgba(239,68,68,0.4)">متأخر الدفع</span>';
        }
      }

      if (filterQ !== 'all') {
        if (filterQ === 'unpaid' && status !== 'unpaid') return;
        if (filterQ === 'partial' && status !== 'partial') return;
        if (filterQ === 'overdue' && status !== 'overdue') return;
      }

      if (searchQ) {
        const phoneDigits = (p.patientPhone || '').replace(/\D/g, '');
        if (!p.patientName.toLowerCase().includes(searchQ) && !phoneDigits.includes(searchQ)) return;
      }

      if (status === 'paid' && !searchQ && filterQ !== 'all') return;

      html += `
        <tr>
          <td>
            <div style="font-weight:800;color:var(--teal)">${BillingEngine.sanitize(p.patientName)}</div>
            <div style="font-size:0.7rem;color:var(--muted);font-family:'IBM Plex Mono',monospace">${p.patientId.substring(0,8)}...</div>
          </td>
          <td style="font-weight:bold">${p.total.toFixed(2)}</td>
          <td style="color:var(--green);font-weight:bold">${p.paid.toFixed(2)}</td>
          <td style="color:var(--red);font-weight:bold">${remaining.toFixed(2)}</td>
          <td>${statusBadge}</td>
          <td style="text-align:center">
            <button class="tbtn" onclick="BillingEngine.openPatientLedger('${p.patientId}')" style="background:rgba(13,148,136,.1);color:var(--teal);border-color:rgba(13,148,136,.2)">عرض كشف الحساب</button>
          </td>
        </tr>
      `;
    });

    if (!html) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--muted)">لا توجد ذمم مطابقة للبحث</td></tr>';
    } else {
      tbody.innerHTML = html;
    }
  },

  openPatientLedger: function(patientId) {
    this.activePatientId = patientId;
    const pts = this._patientsRef || {};
    
    let patName = 'مريض غير معروف';
    let patPhone = '';
    
    if (pts[patientId]) {
      patName = pts[patientId].info?.name;
      patPhone = pts[patientId].info?.phone;
    } else {
      const inv = Object.values(this._invoices).find(i => i.patientId === patientId);
      if (inv) {
        patName = inv.patientName || patName;
        patPhone = inv.patientPhone || '';
      }
    }
    
    document.getElementById('blPatName').textContent = patName;
    document.getElementById('blPatUID').textContent = 'UID: ' + patientId;
    
    const waBtn = document.getElementById('blWaBtn');
    if (waBtn) {
      if (patPhone) {
        waBtn.style.display = 'flex';
        waBtn.onclick = () => {
          let num = patPhone.replace(/\D/g, '');
          if(num.startsWith('07')) num = '962' + num.substring(1);
          
          const rem = this.calculatePatientFinancials(patientId);
          if (rem.unpaid <= 0) {
            alert('المريض لا يملك ذمم مسجلة.');
            return;
          }

          const msg = encodeURIComponent(`السلام عليكم السيد/ة ${patName}،\nنود تذكيركم بوجود رصيد مستحق بقيمة ${rem.unpaid.toFixed(2)} دينار.\nيرجى مراجعة العيادة لتسوية الرصيد.\nشكراً لتعاونكم.`);
          window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
          
          if(typeof ArgonCore !== 'undefined') ArgonCore.logAudit('WA_REMINDER', `إرسال تذكير مالي للمريض ${patName}`, 'BILLING');
        };
      } else {
        waBtn.style.display = 'none';
      }
    }

    this.renderPatientLedger(patientId);
    document.getElementById('billingModal').style.display = 'flex';
  },

  renderPatientLedger: function(patientId) {
    const fin = this.calculatePatientFinancials(patientId);
    document.getElementById('blLedgerTotal').textContent = fin.total.toFixed(2);
    document.getElementById('blLedgerPaid').textContent = fin.paid.toFixed(2);
    document.getElementById('blLedgerUnpaid').textContent = fin.unpaid.toFixed(2);

    const invBody = document.getElementById('blInvoicesBody');
    let invHtml = '';
    
    const pInvoices = Object.entries(this._invoices)
      .filter(([k, inv]) => inv.patientId === patientId)
      .sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));

    pInvoices.forEach(([k, inv]) => {
      const total = parseFloat(inv.total) || 0;
      const paid = this.calculateInvoicePaid(k);
      const remaining = parseFloat((total - paid).toFixed(2));
      const dateStr = inv.createdAt ? new Date(inv.createdAt).toLocaleString('ar-JO') : '—';
      
      let itemsHtml = '<div style="display:flex;flex-direction:column;gap:4px;">';
      (inv.items || []).forEach(i => {
        itemsHtml += `
          <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.02);padding:2px 6px;border-radius:4px;border:1px solid var(--border)">
            <span>${BillingEngine.sanitize(i.name)}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-weight:bold;color:var(--teal)">${parseFloat(i.price).toFixed(2)} د.أ</span>
          </div>
        `;
      });
      itemsHtml += '</div>';

      let status = '<span style="color:var(--red);font-size:0.7rem">غير مدفوعة</span>';
      if (remaining <= 0) status = '<span style="color:var(--green);font-size:0.7rem">مدفوعة</span>';
      else if (paid > 0) status = '<span style="color:var(--amber);font-size:0.7rem">جزئية</span>';

      invHtml += `
        <tr>
          <td style="font-size:0.75rem">${dateStr}</td>
          <td style="font-size:0.75rem;min-width:200px;">${itemsHtml}</td>
          <td style="font-weight:bold;font-family:'IBM Plex Mono',monospace;font-size:1.1rem;color:var(--text)">${total.toFixed(2)}</td>
          <td>${status}</td>
        </tr>
      `;
    });
    
    invBody.innerHTML = invHtml || '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">لا توجد مطالبات</td></tr>';

    const payBody = document.getElementById('blPaymentsBody');
    let payHtml = '';
    let lastDate = '--';

    const pTx = Object.entries(this._transactions)
      .filter(([k, tx]) => tx.patientId === patientId && tx.status !== 'voided')
      .sort((a, b) => (b[1].timestamp || '').localeCompare(a[1].timestamp || ''));

    pTx.forEach(([k, tx], idx) => {
      if (idx === 0 && tx.timestamp) lastDate = new Date(tx.timestamp).toLocaleDateString('ar-JO');
      const dateStr = tx.timestamp ? new Date(tx.timestamp).toLocaleString('ar-JO') : '—';
      const isRev = tx.type === 'REVERSAL';
      const color = isRev ? 'var(--red)' : 'var(--green)';
      const sign = isRev ? '-' : '+';
      
      payHtml += `
        <tr>
          <td style="font-size:0.75rem">
            <div>${dateStr}</div>
            <div style="font-size:0.6rem;color:var(--muted)">${BillingEngine.sanitize(tx.reason || '')}</div>
          </td>
          <td style="font-weight:bold;color:${color};font-family:'IBM Plex Mono',monospace">${sign}${parseFloat(tx.amount).toFixed(2)}</td>
        </tr>
      `;
    });

    document.getElementById('blLedgerLastPay').textContent = lastDate;
    payBody.innerHTML = payHtml || '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:20px">لا توجد حركات مالية</td></tr>';
  },

  sanitize: function(s) {
    return String(s || '').replace(/[<>"']/g, '').trim();
  }
};

function recordBillingPayment() {
  const patientId = BillingEngine.activePatientId;
  if (!patientId) return;

  const amountInput = document.getElementById('blPayAmount');
  const reasonInput = document.getElementById('blPayReason');
  const amount = parseFloat(amountInput.value);
  const reason = reasonInput.value.trim();

  if (isNaN(amount) || amount <= 0) {
    if(typeof toast !== 'undefined') toast('⚠️ يرجى إدخال مبلغ صحيح', 'err');
    return;
  }

  const pInvoices = Object.entries(BillingEngine._invoices)
    .filter(([k, inv]) => inv.patientId === patientId)
    .sort((a, b) => (a[1].createdAt || '').localeCompare(b[1].createdAt || ''));

  let remainingPayment = amount;
  const updates = {};
  const timestamp = new Date().toISOString();
  const session = window.ArgonSession ? window.ArgonSession.get() : {};

  // FIFO Allocation
  for (let i = 0; i < pInvoices.length; i++) {
    if (remainingPayment <= 0) break;

    const [invId, inv] = pInvoices[i];
    const total = parseFloat(inv.total) || 0;
    const paid = BillingEngine.calculateInvoicePaid(invId);
    const unallocated = total - paid;

    if (unallocated > 0) {
      const allocAmount = Math.min(unallocated, remainingPayment);
      const txId = db.ref().child('financial_transactions').push().key;
      updates[`${BASE}/financial_transactions/${txId}`] = {
        invoiceId: invId,
        patientId: patientId,
        type: 'PAYMENT',
        amount: parseFloat(allocAmount.toFixed(2)),
        reason: reason || 'تسديد دفعة',
        timestamp: timestamp,
        actorId: session.staffId || 'unknown'
      };
      remainingPayment -= allocAmount;
    }
  }

  if (remainingPayment > 0) {
    const txId = db.ref().child('financial_transactions').push().key;
    updates[`${BASE}/financial_transactions/${txId}`] = {
      invoiceId: '',
      patientId: patientId,
      type: 'PAYMENT',
      amount: parseFloat(remainingPayment.toFixed(2)),
      reason: (reason ? reason + ' - ' : '') + 'رصيد دائن / زيادة',
      timestamp: timestamp,
      actorId: session.staffId || 'unknown'
    };
  }

  db.ref().update(updates).then(() => {
    if(typeof toast !== 'undefined') toast('✅ تم تسجيل وتوثيق الدفعة بنجاح', 'ok');
    amountInput.value = '';
    reasonInput.value = '';
    
    if(typeof ArgonCore !== 'undefined') {
      const pName = document.getElementById('blPatName').textContent;
      ArgonCore.logAudit('PAYMENT_RECORD', `استلام مبلغ ${amount} من المريض ${pName}`, 'BILLING');
    }
  }).catch(e => {
    if(typeof toast !== 'undefined') toast('❌ حدث خطأ أثناء توثيق الدفعة', 'err');
    console.error(e);
  });
}

function closeBillingModal() {
  document.getElementById('billingModal').style.display = 'none';
  BillingEngine.activePatientId = null;
}

// Hook into Dashboard initialization
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => BillingEngine.init(), 1500);
});
