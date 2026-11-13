/**
 * SKIL Master Tracking Engine UI Controller
 * Powers the 4 Core Business Tabs:
 * 1. Drop-Ship Matcher (Purchase ➔ Sales 1:1)
 * 2. Credit Notes & Schemes (2-Way Claims Tracker)
 * 3. Customer Aging & 30-Day CD Tracker
 * 4. Monthly Profit Analyzer
 */

let currentDropShipView = 'stints'; // 'stints' (default: 23 customer stints) or 'flat' (all 53 rows)
let currentDropShipMonth = 'all';
let currentDropShipStatus = 'all';
let expandedStints = new Set();
let dropShipDataCache = null;
let agingDataCache = null;
let schemesDataCache = null;

function switchDropShipView(view) {
  currentDropShipView = view;
  document.querySelectorAll('.ds-view-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(view === 'stints' ? 'viewBtnStints' : 'viewBtnFlat');
  if (btn) btn.classList.add('active');
  renderDropShipMatrix();
}

function updateViewPill(btn) {
  document.querySelectorAll('.ds-view-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function updateMonthPill(btn) {
  document.querySelectorAll('.ds-month-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function updateStatusPill(btn) {
  document.querySelectorAll('.ds-status-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function toggleStintDetails(stintId) {
  const detailRow = document.getElementById(`stint-detail-${stintId}`);
  const eyeBtn = document.getElementById(`eye-btn-${stintId}`);
  const chevron = document.getElementById(`chevron-${stintId}`);
  if (!detailRow) return;

  const isHidden = detailRow.style.display === 'none' || !detailRow.style.display;
  if (isHidden) {
    detailRow.style.display = 'table-row';
    expandedStints.add(stintId);
    if (eyeBtn) eyeBtn.classList.add('expanded');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  } else {
    detailRow.style.display = 'none';
    expandedStints.delete(stintId);
    if (eyeBtn) eyeBtn.classList.remove('expanded');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
}

function toggleAdvancedToolsModal() {
  const modal = document.getElementById('advancedToolsModal');
  if (modal) {
    const isVisible = modal.style.display === 'flex';
    modal.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible && window.lucide) lucide.createIcons();
  }
}

function openAdvancedTab(tabName) {
  toggleAdvancedToolsModal();
  switchTab(tabName);
}


// ==========================================
// 1. TOP KPI STRIP UPDATE
// ==========================================
async function updateTrackingKpis() {
  try {
    const res = await fetch('/api/tracking/overview');
    const data = await res.json();
    if (!data || !data.kpi) return;

    const kpi = data.kpi;
    const purchasesEl = document.getElementById('kpiPurchases');
    const salesEl = document.getElementById('kpiSales');
    const profitEl = document.getElementById('kpiProfit');
    const actionEl = document.getElementById('kpiAction');

    if (purchasesEl) purchasesEl.textContent = `₹ ${kpi.totalPurchases.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    if (salesEl) salesEl.textContent = `₹ ${kpi.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    
    // Net profit
    const netProfit = Math.round(kpi.totalTradeMargin + kpi.netSchemeRecovery);
    if (profitEl) {
      profitEl.textContent = `+₹ ${netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
      profitEl.style.color = '#10B981';
    }

    // Action pending total
    const pendingTotal = Math.round(kpi.pendingSupplierClaims + kpi.pendingCustomerDiscounts);
    if (actionEl) {
      actionEl.textContent = `₹ ${pendingTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
      actionEl.style.color = '#F59E0B';
    }

    // Subtexts
    const pSub = document.getElementById('kpiPurchasesSub');
    if (pSub) pSub.textContent = `53 Bills • ${kpi.totalCartons} CTN • ${kpi.totalPairs.toLocaleString()} Pairs`;

    const sSub = document.getElementById('kpiSalesSub');
    if (sSub) sSub.textContent = `53 Bills • 100% Back-to-Back Billed`;

    const profitSub = document.getElementById('kpiProfitSub');
    if (profitSub) profitSub.textContent = `Trade: +₹${kpi.totalTradeMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Scheme Spread: +₹${kpi.netSchemeRecovery.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    const actionSub = document.getElementById('kpiActionSub');
    if (actionSub) actionSub.textContent = `Supplier: ₹${kpi.pendingSupplierClaims.toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Customer: ₹${kpi.pendingCustomerDiscounts.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  } catch (err) {
    console.error('Error updating tracking KPIs:', err);
  }
}

// ==========================================
// 2. TAB 1: MASTER DROP-SHIP MATRIX (STINTS & FLAT)
// ==========================================
async function loadDropShipMatches(month = currentDropShipMonth, status = currentDropShipStatus) {
  currentDropShipMonth = month;
  currentDropShipStatus = status;

  const tbody = document.getElementById('dropShipTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="27" style="padding: 2.5rem; text-align: center; color: var(--text-muted);"><i data-lucide="loader-2" class="animate-spin" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;"></i> Loading Drop-Ship Dispatch Stints...</td></tr>`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    const res = await fetch(`/api/tracking/master-grid?month=${month}`);
    const data = await res.json();
    dropShipDataCache = data;
    renderDropShipMatrix();
  } catch (err) {
    console.error('Error loading master grid:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="27" style="padding: 2.5rem; text-align: center; color: #EF4444;">Error loading master grid: ${err.message}</td></tr>`;
  }
}

function renderDropShipMatrix() {
  const tbody = document.getElementById('dropShipTableBody');
  const tfoot = document.getElementById('dropShipTableFoot');
  if (!tbody || !dropShipDataCache) return;

  const data = dropShipDataCache;
  const isStintMode = currentDropShipView === 'stints';

  const summaryBadge = document.getElementById('tabBadgeDropship');
  if (summaryBadge) {
    if (isStintMode) {
      summaryBadge.textContent = `${data.totalStints || 23} Stints (${data.totalRows || 53} Bills)`;
    } else {
      summaryBadge.textContent = `${data.totalRows || 53} Individual Bills`;
    }
  }

  // A. STINTS MODE (Default: Same customer + dispatch date grouped into 1 row with 👁️ Eye button)
  if (isStintMode) {
    let stints = data.stints || [];

    // Filter by status if applied
    if (currentDropShipStatus === 'MATCHED') {
      stints = stints.filter(s => s.tradeMargin === 0);
    } else if (currentDropShipStatus === 'MARGIN_VARIANCE') {
      stints = stints.filter(s => s.tradeMargin !== 0);
    }

    if (stints.length === 0) {
      tbody.innerHTML = `<tr><td colspan="27" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No matching dispatch stints found.</td></tr>`;
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    tbody.innerHTML = stints.map(st => {
      const isProfit = st.tradeMargin > 0;
      const spreadColor = isProfit ? '#10B981' : (st.tradeMargin < -20 ? '#EF4444' : 'var(--text-secondary)');
      const spreadSign = isProfit ? '+' : '';

      // Badges
      const suppBadge = st.suppClaimStatus === 'SETTLED'
        ? `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">✓ Settled</span>`
        : `<span class="badge-tag" style="background: rgba(139, 92, 246, 0.12); color: #6D28D9; border: 1px solid rgba(139, 92, 246, 0.3); font-weight: 700;">⏳ Pending DN</span>`;

      const custBadge = st.custCnStatus === 'ISSUED'
        ? `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">✓ Passed</span>`
        : `<span class="badge-tag" style="background: rgba(245, 158, 11, 0.12); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">⏳ Pending CN</span>`;

      let payBadge = '';
      if (st.paymentStatus === 'CLEARED') {
        payBadge = `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">✓ Cleared</span>`;
      } else if (st.paymentStatus === 'SHORTFALL') {
        payBadge = `<span class="badge-tag" style="background: rgba(59, 130, 246, 0.12); color: #1D4ED8; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 700;">Shortfall ₹6.1k</span>`;
      } else if (st.paymentStatus === 'OVERDUE') {
        payBadge = `<span class="badge-tag" style="background: rgba(239, 68, 68, 0.12); color: #B91C1C; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 700;">⚠️ ${st.daysElapsed}d Due</span>`;
      } else {
        payBadge = `<span class="badge-tag" style="background: rgba(245, 158, 11, 0.12); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">⏳ ${30 - st.daysElapsed}d Left</span>`;
      }

      const isExpanded = expandedStints.has(st.stintId);

      return `
        <!-- Main Dispatch Stint Row -->
        <tr id="stint-row-${st.stintId}" style="transition: background var(--transition-fast);">
          <!-- Sticky Left Identity -->
          <td class="sticky-c1">#${st.stintNo}</td>
          <td class="sticky-c2">${st.date}</td>
          <td class="sticky-c3">
            <div class="customer-name-bold">${st.customer}</div>
            <div class="stint-sub-summary">${st.suppliersList}</div>
          </td>

          <!-- Eye Action: Bills Count & Toggle Button -->
          <td style="text-align: center;">
            <button id="eye-btn-${st.stintId}" onclick="toggleStintDetails('${st.stintId}')" class="stint-eye-btn ${isExpanded ? 'expanded' : ''}" title="Click to view all ${st.billsCount} bills breakdown">
              <i data-lucide="eye" style="width: 13px; height: 13px;"></i>
              <span>${st.billsCount} ${st.billsCount > 1 ? 'Bills' : 'Bill'}</span>
              <i data-lucide="chevron-down" id="chevron-${st.stintId}" style="width: 12px; height: 12px; transition: transform 0.2s; transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};"></i>
            </button>
          </td>

          <!-- Purchase Side (Supplier) -->
          <td style="font-family: var(--font-mono); font-weight: 600; font-size: 11.5px;">${st.purchaseRefSummary}</td>
          <td style="text-align: center;"><span style="font-weight: 700;">${st.cartons} CTN</span> <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">(${st.pairs} pr)</span></td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700;">₹ ${st.purchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary);">${st.suppliersList}</td>

          <!-- Sales Side (Customer) -->
          <td style="font-family: var(--font-mono); font-weight: 700; color: var(--text-primary); font-size: 11.5px;">${st.salesVoucherSummary}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700;">₹ ${st.salesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700; color: ${spreadColor};">${spreadSign}₹ ${st.tradeMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-weight: 700; color: ${spreadColor}; font-size: 11.5px;">${st.tradeMarginPct}%</td>

          <!-- Inbound Supplier Rebates -->
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: #7C3AED;">₹ ${st.suppCd3.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: #7C3AED;">₹ ${st.suppScheme378.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: #6D28D9;">₹ ${st.suppTotalClaim.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center;">${suppBadge}</td>

          <!-- Outbound Customer 5% CD -->
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: var(--text-secondary);">₹ ${st.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700; color: #D97706;">₹ ${st.custCd5.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: var(--text-primary);">₹ ${st.custNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center;">${custBadge}</td>

          <!-- Collection Aging & Due Date -->
          <td style="text-align: center; font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; color: var(--text-secondary);">${st.dueDate}</td>
          <td style="text-align: center; font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">${st.daysElapsed}d</td>
          <td style="text-align: center;">${payBadge}</td>

          <!-- Realized Net Profit -->
          <td style="text-align: right; font-family: var(--font-mono); font-size: 13.5px; font-weight: 800; color: #15803D;">+₹ ${st.netRealizedProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center; font-weight: 800; color: #15803D;">${st.netProfitMarginPct}%</td>

          <!-- Quick Actions -->
          <td style="text-align: center;">
            <button onclick="copyStintWhatsAppReminder('${st.stintId}')" class="stint-action-btn-whatsapp" title="Copy Stint 30-Day Reminder Message">
              <i data-lucide="message-square" style="width: 12px; height: 12px;"></i> WhatsApp
            </button>
          </td>
          <td style="text-align: center;">
            <button onclick="copyStintNarration('${st.stintId}')" class="stint-action-btn-copy" title="Copy Stint Tally Narration">
              <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy
            </button>
          </td>
        </tr>

        <!-- Nested Expandable Child Drawer -->
        <tr id="stint-detail-${st.stintId}" class="stint-detail-row" style="display: ${isExpanded ? 'table-row' : 'none'};">
          <td colspan="27" class="stint-detail-cell">
            <div class="stint-detail-card">
              <div class="stint-detail-header">
                <div class="stint-detail-title">
                  <i data-lucide="layers" style="width: 15px; height: 15px; color: #2563EB;"></i>
                  <span>Itemized Breakdown: <strong>${st.billsCount} Bills</strong> for <strong>${st.customer}</strong> on <strong>${st.date}</strong></span>
                </div>
                <div class="stint-pill-info">
                  ${st.cartons} CTN • ${st.pairs} pr • Total Buy: ₹${st.purchaseAmount.toLocaleString('en-IN')} ➔ Total Sell: ₹${st.salesAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div class="stint-child-table-wrap">
                <table class="stint-child-table">
                  <thead>
                    <tr>
                      <th style="width: 35px;">#</th>
                      <th>Supplier Ref</th>
                      <th>Sales Voucher</th>
                      <th style="text-align: center;">Cartons / Pairs</th>
                      <th style="text-align: right;">Buy Cost (₹)</th>
                      <th style="text-align: right;">Sell Value (₹)</th>
                      <th style="text-align: right;">Trade Spread (₹)</th>
                      <th style="text-align: right;">3% CD (₹)</th>
                      <th style="text-align: right;">3.78% Sch (₹)</th>
                      <th style="text-align: right;">Taxable (₹)</th>
                      <th style="text-align: right;">5% CD (₹)</th>
                      <th style="text-align: right;">Net Payable (₹)</th>
                      <th style="text-align: right; color: #15803D; font-weight: 800;">Net Profit (₹)</th>
                      <th style="text-align: center;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${st.bills.map((b, bIdx) => {
                      const bProfit = b.tradeMargin > 0;
                      const bColor = bProfit ? '#10B981' : (b.tradeMargin < -20 ? '#EF4444' : 'var(--text-secondary)');
                      const bSign = bProfit ? '+' : '';
                      const bNarration = `Being 5% Cash Discount allowed on taxable value of sales invoice ${b.salesVoucher} amounting to Rs. ${b.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;
                      return `
                        <tr>
                          <td style="font-family: var(--font-mono); font-weight: 700; color: var(--text-muted);">${bIdx + 1}</td>
                          <td style="font-family: var(--font-mono); font-weight: 600;">${b.purchaseRef}</td>
                          <td style="font-family: var(--font-mono); font-weight: 700; color: #1D4ED8;">${b.salesVoucher}</td>
                          <td style="text-align: center; font-weight: 600;">${b.cartons} CTN <span style="font-size: 11px; color: var(--text-muted);">(${b.pairs} pr)</span></td>
                          <td style="text-align: right; font-family: var(--font-mono);">₹ ${b.purchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700;">₹ ${b.salesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700; color: ${bColor};">${bSign}₹ ${b.tradeMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: right; font-family: var(--font-mono); color: #7C3AED;">₹ ${b.suppCd3.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: right; font-family: var(--font-mono); color: #7C3AED;">₹ ${b.suppScheme378.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: right; font-family: var(--font-mono); color: var(--text-secondary);">₹ ${b.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700; color: #D97706;">₹ ${b.custCd5.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: right; font-family: var(--font-mono); font-weight: 800;">₹ ${b.custNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: #15803D;">+₹ ${b.netRealizedProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style="text-align: center; white-space: nowrap;">
                            <button onclick="copyWhatsAppReminder('${b.salesVoucher}')" class="stint-action-btn-whatsapp !text-xs !py-0.5 !px-2" title="Copy Single Bill WhatsApp Reminder">
                              <i data-lucide="message-square" style="width: 11px; height: 11px;"></i> WhatsApp
                            </button>
                            <button onclick="copyNarrationText('${encodeURIComponent(bNarration)}')" class="stint-action-btn-copy !text-xs !py-0.5 !px-2" title="Copy Tally Narration">
                              <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } else {
    // B. FLAT MODE (All 53 individual bills)
    let rows = data.rows || [];
    if (currentDropShipStatus === 'MATCHED') {
      rows = rows.filter(r => r.tradeMargin === 0);
    } else if (currentDropShipStatus === 'MARGIN_VARIANCE') {
      rows = rows.filter(r => r.tradeMargin !== 0);
    }

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="27" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No matching individual bills found.</td></tr>`;
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const isProfit = r.tradeMargin > 0;
      const spreadColor = isProfit ? '#10B981' : (r.tradeMargin < -20 ? '#EF4444' : 'var(--text-secondary)');
      const spreadSign = isProfit ? '+' : '';

      const suppBadge = r.suppClaimStatus === 'SETTLED'
        ? `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">✓ Settled</span>`
        : `<span class="badge-tag" style="background: rgba(139, 92, 246, 0.12); color: #6D28D9; border: 1px solid rgba(139, 92, 246, 0.3); font-weight: 700;">⏳ Pending DN</span>`;

      const custBadge = r.custCnStatus === 'ISSUED'
        ? `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">✓ Passed</span>`
        : `<span class="badge-tag" style="background: rgba(245, 158, 11, 0.12); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">⏳ Pending CN</span>`;

      let payBadge = '';
      if (r.paymentStatus === 'CLEARED') {
        payBadge = `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">✓ Cleared</span>`;
      } else if (r.paymentStatus === 'SHORTFALL') {
        payBadge = `<span class="badge-tag" style="background: rgba(59, 130, 246, 0.12); color: #1D4ED8; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 700;">Shortfall ₹6.1k</span>`;
      } else if (r.paymentStatus === 'OVERDUE') {
        payBadge = `<span class="badge-tag" style="background: rgba(239, 68, 68, 0.12); color: #B91C1C; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 700;">⚠️ ${r.daysElapsed}d Due</span>`;
      } else {
        payBadge = `<span class="badge-tag" style="background: rgba(245, 158, 11, 0.12); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">⏳ ${30 - r.daysElapsed}d Left</span>`;
      }

      const narrationText = `Being 5% Cash Discount allowed on taxable value of sales invoice ${r.salesVoucher} amounting to Rs. ${r.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;

      return `
        <tr style="transition: background var(--transition-fast);">
          <td class="sticky-c1">#${r.pairNo}</td>
          <td class="sticky-c2">${r.date}</td>
          <td class="sticky-c3">
            <div class="customer-name-bold">${r.customer}</div>
          </td>
          <td style="text-align: center; color: var(--text-muted); font-size: 11px;">Single Bill</td>
          <td style="font-family: var(--font-mono); font-weight: 600;">${r.purchaseRef}</td>
          <td style="text-align: center;"><span style="font-weight: 700;">${r.cartons} CTN</span> <span style="font-size: 11px; color: var(--text-muted);">(${r.pairs} pr)</span></td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700;">₹ ${r.purchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="font-size: 11.5px; color: var(--text-secondary);">${r.supplier.includes('Xpania') ? 'Xpania' : 'Ajanta'}</td>
          <td style="font-family: var(--font-mono); font-weight: 700; color: #1D4ED8;">${r.salesVoucher}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700;">₹ ${r.salesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700; color: ${spreadColor};">${spreadSign}₹ ${r.tradeMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-weight: 700; color: ${spreadColor};">${r.tradeMarginPct}%</td>
          <td style="text-align: right; font-family: var(--font-mono); color: #7C3AED;">₹ ${r.suppCd3.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); color: #7C3AED;">₹ ${r.suppScheme378.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: #6D28D9;">₹ ${r.suppTotalClaim.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center;">${suppBadge}</td>
          <td style="text-align: right; font-family: var(--font-mono); color: var(--text-secondary);">₹ ${r.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 700; color: #D97706;">₹ ${r.custCd5.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: var(--text-primary);">₹ ${r.custNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center;">${custBadge}</td>
          <td style="text-align: center; font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; color: var(--text-secondary);">${r.dueDate}</td>
          <td style="text-align: center; font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">${r.daysElapsed}d</td>
          <td style="text-align: center;">${payBadge}</td>
          <td style="text-align: right; font-family: var(--font-mono); font-size: 13.5px; font-weight: 800; color: #15803D;">+₹ ${r.netRealizedProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center; font-weight: 800; color: #15803D;">${r.netProfitMarginPct}%</td>
          <td style="text-align: center;">
            <button onclick="copyWhatsAppReminder('${r.salesVoucher}')" class="stint-action-btn-whatsapp" title="Copy 30-Day WhatsApp Reminder">
              <i data-lucide="message-square" style="width: 12px; height: 12px;"></i> WhatsApp
            </button>
          </td>
          <td style="text-align: center;">
            <button onclick="copyNarrationText('${encodeURIComponent(narrationText)}')" class="stint-action-btn-copy" title="Copy Tally Narration">
              <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // C. Sticky Footer Totals (Matches 100% across Stints & Flat)
  if (tfoot && data.totals) {
    const tot = data.totals;
    tfoot.innerHTML = `
      <tr style="background-color: var(--bg-surface); border-top: 2.5px solid var(--border-color); font-weight: 800;">
        <td class="sticky-c1">TOTAL</td>
        <td class="sticky-c2">${data.totalStints || 23} Stints</td>
        <td class="sticky-c3">Consolidated Totals</td>
        <td style="text-align: center; font-weight: 800; color: #2563EB;">${data.totalRows || 53} Bills</td>
        <td style="text-align: center;">—</td>
        <td style="text-align: center; font-weight: 800;">${tot.totalCartons} CTN (${tot.totalPairs.toLocaleString()} pr)</td>
        <td style="text-align: right; font-weight: 800;">₹ ${tot.totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>—</td>
        <td>—</td>
        <td style="text-align: right; font-weight: 800;">₹ ${tot.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align: right; font-weight: 800; color: #15803D;">+₹ ${tot.totalTradeMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align: right; font-weight: 800; color: #15803D;">${(tot.totalTradeMargin/tot.totalSales*100).toFixed(2)}%</td>
        <td colspan="2" style="text-align: center; color: #7C3AED; font-weight: 700;">Rebates Total:</td>
        <td style="text-align: right; font-weight: 800; color: #6D28D9;">+₹ ${tot.totalSuppRebates.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>—</td>
        <td>—</td>
        <td style="text-align: right; font-weight: 800; color: #D97706;">-₹ ${tot.totalCustDiscounts.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align: right; font-weight: 800;">₹ ${(tot.totalSales - tot.totalCustDiscounts).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td style="text-align: right; font-size: 14px; font-weight: 800; color: #15803D;">+₹ ${tot.totalNetProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align: center; font-weight: 800; color: #15803D;">${(tot.totalNetProfit/tot.totalSales*100).toFixed(2)}%</td>
        <td colspan="2" style="text-align: center; font-size: 11px; font-weight: 600; color: var(--text-muted);">Quick Actions Ready</td>
      </tr>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

// Copy Stint Consolidated WhatsApp Reminder
function copyStintWhatsAppReminder(stintId) {
  if (!dropShipDataCache || !dropShipDataCache.stints) return;
  const stint = dropShipDataCache.stints.find(s => s.stintId === stintId);
  if (!stint) return;

  const vchs = stint.salesVouchers.join(', ');
  let msg = `*30 Days CD duedate:* _${stint.dueDate}_\n\n` +
            `*Customer:* ${stint.customer}\n` +
            `*Bills Included:* ${vchs} (${stint.billsCount} ${stint.billsCount > 1 ? 'Bills' : 'Bill'})\n` +
            `*Total Bill Amount:* ${stint.salesAmount}\n` +
            `*Gross Total Before GST:* ${stint.taxableSales.toFixed(2)}\n` +
            `*30days CD @5%:* ${stint.custCd5.toFixed(2)}\n\n`;

  if (stint.customer && stint.customer.toUpperCase().includes('K G N')) {
    const totalWithOldBal = Math.round(stint.custNetPayable + 6113);
    msg += `*Old Balance Pending (Aug short payment):* 6113\n\n` +
           `*Total Payable:* _₹${totalWithOldBal.toLocaleString('en-IN')}/-_`;
  } else {
    msg += `*Total Payable:* _₹${Math.round(stint.custNetPayable).toLocaleString('en-IN')}/-_`;
  }

  navigator.clipboard.writeText(msg).then(() => {
    showToast('Stint WhatsApp Copied!', `Consolidated reminder for ${stint.customer} (${stint.billsCount} bills) copied.`, 'success', 2500);
  }).catch(() => {
    prompt('Copy WhatsApp Message:', msg);
  });
}

// Copy Stint Tally Narration
function copyStintNarration(stintId) {
  if (!dropShipDataCache || !dropShipDataCache.stints) return;
  const stint = dropShipDataCache.stints.find(s => s.stintId === stintId);
  if (!stint) return;

  const vchs = stint.salesVouchers.join(', ');
  const narration = `Being 5% Cash Discount allowed on taxable value of sales invoice(s) ${vchs} amounting to Rs. ${stint.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;
  copyNarrationText(encodeURIComponent(narration));
}

// Search inside Drop-Ship Master table
function filterDropShipTable(searchTerm) {
  const term = (searchTerm || '').trim().toLowerCase();
  const rows = document.querySelectorAll('#dropShipTableBody tr');
  rows.forEach(r => {
    if (r.classList.contains('stint-detail-row')) return;
    const text = r.textContent.toLowerCase();
    const matches = text.includes(term);
    r.style.display = matches ? '' : 'none';

    // If parent hidden, also hide child detail
    const stintId = r.id.replace('stint-row-', '');
    const child = document.getElementById(`stint-detail-${stintId}`);
    if (child && !matches) {
      child.style.display = 'none';
    }
  });
}

// ==========================================
// 3. TAB 2: CREDIT NOTES & SCHEMES TRACKER
// ==========================================
async function loadSchemesTracker() {
  try {
    const res = await fetch('/api/tracking/credit-notes');
    const data = await res.json();
    schemesDataCache = data;

    const badge = document.getElementById('tabBadgeSchemes');
    if (badge) {
      badge.textContent = `₹${Math.round(data.summary.totalSupplierClaimsPending/1000)}k Supplier • ₹${Math.round(data.summary.totalCustomerDiscountsPending/1000)}k Customer`;
    }

    // Update KPI Cards
    const scExp = document.getElementById('scExpected');
    const scSettled = document.getElementById('scSettled');
    const scPending = document.getElementById('scPending');
    const cdTotal = document.getElementById('cdTotal');
    const netSpread = document.getElementById('netSchemeSpread');

    if (scExp) scExp.textContent = `₹ ${data.summary.totalSupplierClaimsExpected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    if (scSettled) scSettled.textContent = `₹ ${data.summary.totalSupplierClaimsSettled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    if (scPending) scPending.textContent = `₹ ${data.summary.totalSupplierClaimsPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    if (cdTotal) cdTotal.textContent = `₹ ${data.summary.totalCustomerDiscounts.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    if (netSpread) {
      netSpread.textContent = `+₹ ${data.summary.netSchemeMarginSpread.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
      netSpread.style.color = '#10B981';
    }

    // Render Inbound Supplier Claims Table
    const supplierTbody = document.getElementById('supplierClaimsTableBody');
    if (supplierTbody) {
      supplierTbody.innerHTML = data.supplierClaims.map(sc => {
        const isSettled = sc.status === 'SETTLED';
        const badge = isSettled
          ? `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25);">✓ Booked in Tally</span>`
          : `<span class="badge-tag" style="background: rgba(245, 158, 11, 0.1); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.25);">⏳ Pending Debit Note</span>`;

        return `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 0.65rem 0.85rem; font-size: 12px; color: var(--text-secondary);">${sc.month}</td>
            <td style="padding: 0.65rem 0.85rem;">
              <div style="font-weight: 600; color: var(--text-primary); font-size: 12.5px;">${sc.category}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${sc.description}</div>
            </td>
            <td style="padding: 0.65rem 0.85rem; font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">${sc.supplierDocNo || '—'}</td>
            <td style="padding: 0.65rem 0.85rem; text-align: right; font-family: var(--font-mono); font-size: 12.5px; font-weight: 600;">
              ₹ ${sc.expectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style="padding: 0.65rem 0.85rem; font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary);">${sc.tallyVoucher}</td>
            <td style="padding: 0.65rem 0.85rem; text-align: center;">${badge}</td>
          </tr>
        `;
      }).join('');
    }

    // Render Outbound Customer Discounts Table
    const customerTbody = document.getElementById('customerDiscountsTableBody');
    if (customerTbody) {
      customerTbody.innerHTML = data.customerDiscounts.map(cd => {
        const isIssued = cd.status === 'ISSUED';
        const badge = isIssued
          ? `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25);">✓ Issued in Tally</span>`
          : `<span class="badge-tag" style="background: rgba(245, 158, 11, 0.1); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.25);">⏳ Pending Issue</span>`;

        const narrationText = `Being 5% Cash Discount allowed on taxable value of ${cd.month} sales invoices (${cd.invoices}) amounting to Rs. ${cd.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;

        return `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 0.65rem 0.85rem; font-size: 12px; color: var(--text-secondary);">${cd.month}</td>
            <td style="padding: 0.65rem 0.85rem;">
              <div style="font-weight: 600; color: var(--text-primary); font-size: 12.5px;">${cd.party}</div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${cd.invoices}</div>
            </td>
            <td style="padding: 0.65rem 0.85rem; text-align: right; font-family: var(--font-mono); font-size: 12px;">
              ₹ ${cd.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style="padding: 0.65rem 0.85rem; text-align: right; font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; color: #10B981;">
              ₹ ${cd.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style="padding: 0.65rem 0.85rem; text-align: center;">${badge}</td>
            <td style="padding: 0.65rem 0.85rem; text-align: center;">
              <button onclick="copyNarrationText('${encodeURIComponent(narrationText)}')" class="btn btn-secondary !h-[26px] !px-2 text-xs" title="Copy Narration for Tally">
                <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Narration
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading schemes tracker:', err);
  }
}

// Copy Narration helper
function copyNarrationText(encodedText) {
  const text = decodeURIComponent(encodedText);
  navigator.clipboard.writeText(text).then(() => {
    showToast('Narration Copied', text, 'success', 2500);
  }).catch(() => {
    showToast('Copy Failed', 'Please copy manually', 'danger');
  });
}

// ==========================================
// 4. TAB 3: CUSTOMER AGING & 30-DAY CD TRACKER
// ==========================================
async function loadPaymentAgingTracker() {
  const tbody = document.getElementById('paymentAgingTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="9" style="padding: 2.5rem; text-align: center; color: var(--text-muted);"><i data-lucide="loader-2" class="animate-spin" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;"></i> Calculating Customer Collection Days & 30-Day Due Dates...</td></tr>`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/tracking/payment-aging');
    const data = await res.json();
    agingDataCache = data;

    const badge = document.getElementById('tabBadgeAging');
    if (badge) badge.textContent = `${data.totalBills} Bills • Aging & WhatsApp`;

    // Outstanding Debtors List Strip
    const debtorListEl = document.getElementById('debtorSummaryPills');
    if (debtorListEl && data.currentOutstandingDebtors) {
      debtorListEl.innerHTML = data.currentOutstandingDebtors.map(d => `
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); font-size: 11.5px; display: inline-flex; align-items: center; gap: 0.5rem;">
          <span style="font-weight: 600; color: var(--text-primary);">${d.party}:</span>
          <span style="font-family: var(--font-mono); color: #EF4444; font-weight: 600;">₹ ${d.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      `).join('');
    }

    tbody.innerHTML = data.bills.map(b => {
      let statusBadgeHtml = '';
      if (b.paymentStatus === 'SETTLED') {
        statusBadgeHtml = `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25);">✓ Cleared</span>`;
      } else if (b.paymentStatus === 'PARTIALLY_SETTLED') {
        statusBadgeHtml = `<span class="badge-tag" style="background: rgba(59, 130, 246, 0.1); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.25);">Shortfall ₹6.1k</span>`;
      } else if (b.paymentStatus === 'OVERDUE') {
        statusBadgeHtml = `<span class="badge-tag" style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.25);">⚠️ ${b.daysElapsed}d (Due Now)</span>`;
      } else {
        statusBadgeHtml = `<span class="badge-tag" style="background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25);">⏳ ${b.daysElapsed}d (Eligible)</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.65rem 0.85rem; font-family: var(--font-mono); font-weight: 600; color: var(--text-primary);">
            ${b.salesVoucher}
          </td>
          <td style="padding: 0.65rem 0.85rem; font-size: 12px; color: var(--text-secondary); white-space: nowrap;">
            ${b.date}
          </td>
          <td style="padding: 0.65rem 0.85rem; font-weight: 600; color: var(--text-primary); font-size: 12.5px;">
            ${b.customer}
          </td>
          <td style="padding: 0.65rem 0.85rem; text-align: right; font-family: var(--font-mono); font-size: 12.5px;">
            ₹ ${b.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="padding: 0.65rem 0.85rem; text-align: right; font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">
            ₹ ${b.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="padding: 0.65rem 0.85rem; text-align: right; font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; color: #10B981;">
            ₹ ${b.cd5.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="padding: 0.65rem 0.85rem; text-align: right; font-family: var(--font-mono); font-size: 12.5px; font-weight: 700; color: var(--text-primary);">
            ₹ ${b.netPayableWithCd.toLocaleString('en-IN')}
          </td>
          <td style="padding: 0.65rem 0.85rem; text-align: center; font-size: 11.5px; font-family: var(--font-mono); color: var(--text-secondary);">
            ${b.dueDate}
          </td>
          <td style="padding: 0.65rem 0.85rem; text-align: center;">
            ${statusBadgeHtml}
          </td>
          <td style="padding: 0.65rem 0.85rem; text-align: center;">
            <button onclick="copyWhatsAppReminder('${b.salesVoucher}')" class="btn btn-secondary !h-[26px] !px-2 text-xs" title="Copy 30-Day Reminder Message for WhatsApp">
              <i data-lucide="message-square" style="width: 12px; height: 12px; color: #10B981;"></i> WhatsApp
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading payment aging tracker:', err);
    tbody.innerHTML = `<tr><td colspan="9" style="padding: 2.5rem; text-align: center; color: #EF4444;">Error loading aging data: ${err.message}</td></tr>`;
  }
}

// Copy WhatsApp Reminder Message
function copyWhatsAppReminder(vno) {
  let bill = null;
  if (agingDataCache && agingDataCache.bills) {
    bill = agingDataCache.bills.find(b => b.salesVoucher === vno);
  }
  if (!bill && dropShipDataCache && dropShipDataCache.rows) {
    const row = dropShipDataCache.rows.find(r => r.salesVoucher === vno);
    if (row) {
      bill = {
        salesVoucher: row.salesVoucher,
        dueDate: row.dueDate,
        amount: row.salesAmount,
        taxable: row.taxableSales,
        cd5: row.custCd5,
        netPayableWithCd: row.custNetPayable,
        customer: row.customer
      };
    }
  }
  if (!bill) {
    showToast('Reminder Not Found', `Could not find voucher ${vno}`, 'warning');
    return;
  }

  // Format tailored WhatsApp message matching requested pattern
  let msg = `*30 Days CD duedate:* _${bill.dueDate}_\n\n` +
            `*Total Bill Amount:* ${bill.amount}\n` +
            `*Gross Total Before GST:* ${bill.taxable.toFixed(2)}\n` +
            `*30days CD @5%:* ${bill.cd5.toFixed(2)}\n\n`;

  if (bill.customer && bill.customer.toUpperCase().includes('K G N')) {
    const totalWithOldBal = Math.round(bill.netPayableWithCd + 6113);
    msg += `*Old Balance Pending (Aug short payment):* 6113\n\n` +
           `*Total Payable:* _₹${totalWithOldBal.toLocaleString('en-IN')}/-_`;
  } else {
    msg += `*Total Payable:* _₹${Math.round(bill.netPayableWithCd).toLocaleString('en-IN')}/-_`;
  }

  navigator.clipboard.writeText(msg).then(() => {
    showToast('WhatsApp Message Copied!', `Message for ${bill.customer} copied to clipboard.`, 'success', 2500);
  }).catch(() => {
    // Fallback if clipboard API restricted
    prompt('Copy WhatsApp Message:', msg);
  });
}

// ==========================================
// 5. TAB 4: MONTHLY EXECUTIVE PROFIT ANALYZER
// ==========================================
async function loadMonthlyProfitAnalyzer() {
  const container = document.getElementById('monthlyAnalyzerCardsWrap');
  if (!container) return;
  container.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-muted);"><i data-lucide="loader-2" class="animate-spin" style="width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px;"></i> Compiling Monthly P&L and Drop-Ship Margins...</div>`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/tracking/monthly-analyzer');
    const data = await res.json();
    if (!data || !data.months) return;

    const badge = document.getElementById('tabBadgeAnalyzer');
    if (badge) badge.textContent = `${data.months.length} Months P&L`;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        ${data.months.map(m => `
          <div class="data-card" style="padding: 1.5rem; border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
              <div>
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">${m.month}</h3>
                <span style="font-size: 11.5px; color: var(--text-muted);">${m.billsCount} Bills • ${m.cartons} CTN • ${m.pairs.toLocaleString()} Pairs</span>
              </div>
              <div style="text-align: right;">
                <span class="badge-tag" style="background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 700; font-size: 12px;">
                  ${m.netProfitMarginPct}% Net Margin
                </span>
              </div>
            </div>

            <!-- Financial Waterfall -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 13px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Drop-Ship Sales Revenue:</span>
                <span style="font-family: var(--font-mono); font-weight: 600; color: var(--text-primary);">₹ ${m.salesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Supplier Purchase COGS:</span>
                <span style="font-family: var(--font-mono); color: var(--text-secondary);">-₹ ${m.purchaseCogs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border-color); padding-top: 0.4rem;">
                <span style="font-weight: 600; color: var(--text-primary);">Trading Spread / Margin:</span>
                <span style="font-family: var(--font-mono); font-weight: 600; color: #3B82F6;">+₹ ${m.tradingMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #10B981;">Supplier Schemes & CD Received (+):</span>
                <span style="font-family: var(--font-mono); font-weight: 600; color: #10B981;">+₹ ${m.supplierSchemes.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #F59E0B;">Customer 5% Cash Discounts (-):</span>
                <span style="font-family: var(--font-mono); font-weight: 600; color: #F59E0B;">-₹ ${m.customerDiscounts.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--border-color); padding-top: 0.75rem; margin-top: 0.25rem;">
                <span style="font-size: 14px; font-weight: 700; color: var(--text-primary);">NET REALIZED PROFIT:</span>
                <span style="font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: #10B981;">+₹ ${m.netOperatingProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading monthly analyzer:', err);
  }
}
