/**
 * Sahil's Biz & SKIL Lifestyle LLP Intelligence Platform
 * Unified Controller with Real Tally Data & Merged Feature Suite
 */

// Global State Store
const state = {
  activeTab: 'dashboard',
  status: null,
  overview: null,
  masterGrid: null,
  aging: null,
  inventory: null,
  schemes: null,
  audit: null,
  guide: null,
  folders: null,
  rawVouchers: [],
  activePartyType: 'debtor',
  activeVchSubView: 'stints',
  activeRawVchType: '',
  charts: {},
  selectedStint: null,
  activeInventoryFilter: 'All'
};

// Format currency in Indian numbering format (e.g. ₹31,23,318)
function formatINR(val, includePaisa = false) {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  const num = Number(val);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  const options = {
    maximumFractionDigits: includePaisa ? 2 : 0,
    minimumFractionDigits: includePaisa ? 2 : 0
  };
  
  const formatted = absNum.toLocaleString('en-IN', options);
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

// Format date helper: YYYYMMDD -> DD-MMM-YYYY or DD-MM-YYYY
function formatDateStr(d) {
  if (!d) return '—';
  const s = String(d).trim();
  if (s.length === 8 && /^\d{8}$/.test(s)) {
    const y = s.substring(0, 4);
    const m = s.substring(4, 6);
    const day = s.substring(6, 8);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mName = monthNames[parseInt(m, 10) - 1] || m;
    return `${day} ${mName} ${y}`;
  }
  return s;
}

// Copy to clipboard helper
function copyToClipboard(text, btnElem = null) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    if (btnElem) {
      const origText = btnElem.innerHTML;
      btnElem.innerHTML = `<i data-lucide="check" style="width: 13px; height: 13px;"></i> Copied!`;
      if (window.lucide) lucide.createIcons();
      setTimeout(() => {
        btnElem.innerHTML = origText;
        if (window.lucide) lucide.createIcons();
      }, 1500);
    }
  }).catch(err => {
    console.error('Copy failed:', err);
  });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupSyncButton();
  setupModalEvents();
  setupFilterEvents();
  setupMergedSubviews();
  
  // Set current date display
  const now = new Date();
  const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const dateDisplay = document.getElementById('currentDateDisplay');
  if (dateDisplay) {
    dateDisplay.innerText = now.toLocaleDateString('en-GB', dateOptions);
  }

  // Reload button
  const reloadBtn = document.getElementById('btnRefreshApp');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => refreshAllData());
  }

  // Update static download link URLs for web and mobile
  updateStaticDownloadLinks();

  // Initial Data Load
  await refreshAllData();
});

// Setup Navigation Tabs & Mobile Drawer
function setupNavigation() {
  const appSidebar = document.getElementById('appSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const btnMobileMenu = document.getElementById('btnMobileMenuToggle');
  const btnCloseSidebar = document.getElementById('btnSidebarClose');
  const btnBottomMore = document.getElementById('btnBottomMore');

  function openMobileDrawer() {
    if (appSidebar) appSidebar.classList.add('sidebar-open');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
  }

  function closeMobileDrawer() {
    if (appSidebar) appSidebar.classList.remove('sidebar-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  }

  if (btnMobileMenu) btnMobileMenu.addEventListener('click', openMobileDrawer);
  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeMobileDrawer);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileDrawer);
  if (btnBottomMore) btnBottomMore.addEventListener('click', openMobileDrawer);

  const navItems = document.querySelectorAll('.sidebar-menu .nav-item');
  const bottomNavBtns = document.querySelectorAll('.mobile-bottom-nav .mobile-nav-btn');

  const titleMap = {
    'dashboard': 'Dashboard',
    'sales-metrics': 'Sales Metrics',
    'parties': 'Parties & Aging',
    'inventory': 'Inventory Intelligence',
    'bills-vouchers': 'Bills & Vouchers',
    'schemes': 'Credit Notes & Schemes',
    'overdues': 'Payment Aging & Overdue',
    'audit-reconcile': 'Audit & Reconcile',
    'tally-guide': 'Tally Posting Guide',
    'lineman': 'Lineman Route View',
    'ledger-book': 'Ledger Book'
  };

  function switchTab(tab) {
    if (!tab) return;

    // Update Sidebar active state
    navItems.forEach(n => {
      if (n.getAttribute('data-tab') === tab) {
        n.classList.add('active');
      } else {
        n.classList.remove('active');
      }
    });

    // Update Bottom Dock active state
    bottomNavBtns.forEach(btn => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('active');
      } else if (btn.getAttribute('data-tab')) {
        btn.classList.remove('active');
      }
    });

    // Update Active View Panel
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active-view');
    });
    const activePanel = document.getElementById(`view-${tab}`);
    if (activePanel) {
      activePanel.classList.add('active-view');
    }

    // Update Title
    const titleElem = document.getElementById('activePageTitle');
    if (titleElem && titleMap[tab]) {
      titleElem.innerText = titleMap[tab];
    }

    state.activeTab = tab;

    // Close mobile drawer on navigation
    closeMobileDrawer();

    // Specific view render triggers
    if (tab === 'dashboard') renderDashboardView();
    if (tab === 'sales-metrics') renderSalesMetricsView();
    if (tab === 'parties') renderPartiesView();
    if (tab === 'inventory') renderInventoryView();
    if (tab === 'bills-vouchers') renderBillsVouchersView();
    if (tab === 'schemes') renderSchemesView();
    if (tab === 'overdues') renderPaymentAgingView();
    if (tab === 'audit-reconcile') renderAuditReconcileView();
    if (tab === 'tally-guide') renderTallyGuideView();
    if (tab === 'lineman') renderLinemanView();
    if (tab === 'ledger-book') loadLedgerBookDropdown();

    // Refresh Lucide Icons
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  bottomNavBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        e.preventDefault();
        switchTab(tab);
      }
    });
  });
}

// Setup Sync Button & Data Refresh
function setupSyncButton() {
  const syncBtn = document.getElementById('syncNowBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.classList.add('syncing');
      syncBtn.disabled = true;
      try {
        const resp = await fetch('/api/sync/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full: false })
        });
        const result = await resp.json();
        console.log('Sync result:', result);
      } catch (err) {
        console.error('Sync failed:', err);
      } finally {
        await refreshAllData();
        syncBtn.classList.remove('syncing');
        syncBtn.disabled = false;
      }
    });
  }
}

// Get API Base URL (handles mobile/Capacitor localhost -> host PC IP)
function getApiBaseUrl() {
  const customHost = localStorage.getItem('skil_server_host');
  if (customHost) return customHost.replace(/\/$/, '');
  // When running inside Capacitor Android WebView (origin: https://localhost or capacitor://localhost)
  if (window.location.hostname === 'localhost' && window.location.port !== '9050') {
    return 'http://192.168.1.14:9050';
  }
  return '';
}

function getApiUrl(endpoint) {
  const base = getApiBaseUrl();
  return base ? `${base}${endpoint}` : endpoint;
}

// Update static download link targets to ensure absolute paths for mobile DownloadManager
function updateStaticDownloadLinks() {
  const exportBtn = document.querySelector('a[href*="/api/data/export"]');
  if (exportBtn) {
    exportBtn.href = getApiUrl('/api/data/export');
  }
  const apkBtn = document.getElementById('btnDownloadApk');
  if (apkBtn) {
    apkBtn.href = getApiUrl('/download/app.apk');
  }
  const excelBtn = document.querySelector('a[href*="/api/reconcile/discount-excel"]');
  if (excelBtn) {
    excelBtn.href = getApiUrl('/api/reconcile/discount-excel');
  }
}

// Smart Fetch Helper: tries API server first, falls back to bundled ./data/ offline JSON
async function smartFetch(apiEndpoint, fallbackFile) {
  const url = getApiUrl(apiEndpoint);
  try {
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (err) {
    // Network or server unreachable
  }
  if (fallbackFile) {
    try {
      const res = await fetch(`./data/${fallbackFile}`);
      if (res.ok) return await res.json();
    } catch (e) {}
  }
  return null;
}

// Fetch all required datasets from the local sync engine or bundled offline files
async function refreshAllData() {
  try {
    const [statusRes, overviewRes, gridRes, agingRes, invRes, schemesRes, auditRes, guideRes, foldersRes, rawVchRes] = await Promise.all([
      smartFetch('/api/status', 'status.json'),
      smartFetch('/api/tracking/overview', 'overview.json'),
      smartFetch('/api/tracking/master-grid?month=all', 'master-grid.json'),
      smartFetch('/api/data/aging', 'aging.json'),
      smartFetch('/api/inventory/report', 'inventory.json'),
      smartFetch('/api/schemes/indicators', 'schemes.json'),
      smartFetch('/api/audit/discrepancies', 'audit.json'),
      smartFetch('/api/tally-guide/entries', 'tally-guide.json'),
      smartFetch('/api/folders/status', 'folders.json'),
      smartFetch('/api/data/vouchers?limit=200', 'vouchers.json')
    ]);

    state.status = statusRes;
    state.overview = overviewRes;
    state.masterGrid = gridRes;
    state.aging = agingRes;
    state.inventory = invRes;
    state.schemes = schemesRes;
    state.audit = auditRes;
    state.guide = guideRes;
    state.folders = foldersRes;
    state.rawVouchers = rawVchRes?.items || [];

    // Update Top Header Information
    updateTopBarInfo();

    // Render active view
    renderCurrentView();

    // Re-create icons
    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Error refreshing data:', err);
  }
}

// Update Top Bar & Sync Info
function updateTopBarInfo() {
  const companyLabel = document.getElementById('activeCompanyLabel');
  if (companyLabel) {
    companyLabel.innerText = 'SKIL LIFESTYLE LLP';
    companyLabel.title = 'SKIL LIFESTYLE LLP • Tally Connected';
  }

  const ts = state.status?.stats?.lastSyncTimestamp;
  const lastSyncedText = document.getElementById('lastSyncedText');
  if (lastSyncedText && ts) {
    const dt = new Date(ts);
    const hours = String(dt.getHours()).padStart(2, '0');
    const mins = String(dt.getMinutes()).padStart(2, '0');
    const day = dt.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    lastSyncedText.innerText = `Synced: ${day}-${monthNames[dt.getMonth()]} ${hours}:${mins}`;
  }
}

// Render Current Active View
function renderCurrentView() {
  switch (state.activeTab) {
    case 'dashboard':
      renderDashboardView();
      break;
    case 'sales-metrics':
      renderSalesMetricsView();
      break;
    case 'parties':
      renderPartiesView();
      break;
    case 'inventory':
      renderInventoryView();
      break;
    case 'bills-vouchers':
      renderBillsVouchersView();
      break;
    case 'schemes':
      renderSchemesView();
      break;
    case 'overdues':
      renderPaymentAgingView();
      break;
    case 'audit-reconcile':
      renderAuditReconcileView();
      break;
    case 'tally-guide':
      renderTallyGuideView();
      break;
    case 'lineman':
      renderLinemanView();
      break;
    case 'ledger-book':
      loadLedgerBookDropdown();
      break;
  }
}

// ==========================================================================
// 1. DASHBOARD VIEW CONTROLLER (REAL TALLY NUMBERS)
// ==========================================================================

function renderDashboardView() {
  const monthSelect = document.getElementById('monthFilterSelect');
  const selectedMonth = monthSelect ? monthSelect.value : 'all';

  // Calculate stats based on month
  let sales = 3123318;
  let purchase = 3113457.5;
  let grossProfit = 208751.77;
  let netProfit = 77985.77;

  if (state.overview && state.overview.monthlySummary) {
    const list = state.overview.monthlySummary;
    if (selectedMonth === 'all') {
      sales = list.reduce((s, m) => s + m.salesRevenue, 0);
      purchase = list.reduce((s, m) => s + m.purchaseCogs, 0);
      grossProfit = list.reduce((s, m) => s + m.tradingMargin + (m.supplierSchemes || 0), 0);
      netProfit = list.reduce((s, m) => s + m.netOperatingProfit, 0);
    } else {
      const mMatch = list.find(m => {
        if (selectedMonth === '2026-08') return m.month.includes('August');
        if (selectedMonth === '2026-09') return m.month.includes('September');
        if (selectedMonth === '2026-10') return m.month.includes('October');
        return false;
      });
      if (mMatch) {
        sales = mMatch.salesRevenue;
        purchase = mMatch.purchaseCogs;
        grossProfit = mMatch.tradingMargin + (mMatch.supplierSchemes || 0);
        netProfit = mMatch.netOperatingProfit;
      }
    }
  }

  // Update KPI card numbers
  const elemSales = document.getElementById('kpiTotalSales');
  const elemPurchase = document.getElementById('kpiTotalPurchase');
  const elemGross = document.getElementById('kpiGrossProfit');
  const elemNet = document.getElementById('kpiNetProfit');

  if (elemSales) elemSales.innerText = formatINR(sales);
  if (elemPurchase) elemPurchase.innerText = formatINR(purchase);
  if (elemGross) elemGross.innerText = formatINR(grossProfit);
  if (elemNet) elemNet.innerText = formatINR(netProfit);

  // Subtitle update
  const subtitle = document.getElementById('dashboardSnapshotSubtitle');
  if (subtitle) {
    const names = { 'all': 'Real Tally Intelligence for All Months', '2026-10': 'Real Tally Intelligence for October 26', '2026-09': 'Real Tally Intelligence for September 26', '2026-08': 'Real Tally Intelligence for August 26' };
    subtitle.innerText = names[selectedMonth] || 'Selected Period';
  }

  // Real Liability Ratio: Debtors (Receivables) vs Creditors (Payables)
  let receivables = 1762534;
  let payables = 923457.5;
  if (state.aging) {
    receivables = state.aging.debtors?.summary?.totalOutstanding || 1762534;
    payables = state.aging.creditors?.summary?.totalOutstanding || 923457.5;
  }
  const recElem = document.getElementById('receivablesValue');
  const payElem = document.getElementById('payablesValue');
  if (recElem) recElem.innerText = formatINR(receivables);
  if (payElem) payElem.innerText = formatINR(payables);

  // Render Charts
  renderIncomeExpenseChart();
  renderLiabilityDonut(receivables, payables);
}

// Spline Line Chart: Income vs Expense
function renderIncomeExpenseChart() {
  const canvas = document.getElementById('incomeExpenseChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (state.charts.incomeExpense) {
    state.charts.incomeExpense.destroy();
  }

  const months = ['Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sept 26', 'Oct 26', 'Nov 26', 'Dec 26', 'Jan 27', 'Feb 27'];
  
  // Real numbers: Aug ₹12.57L / ₹12.52L, Sep ₹14.89L / ₹14.85L, Oct ₹3.77L / ₹3.77L
  const salesData = [0, 0, 0, 0, 1257406, 1488717, 377195, 0, 0, 0, 0];
  const purchaseData = [0, 0, 0, 0, 1251736, 1484790, 376931, 0, 0, 0, 0];

  const limeGradient = ctx.createLinearGradient(0, 0, 0, 260);
  limeGradient.addColorStop(0, 'rgba(163, 230, 53, 0.45)');
  limeGradient.addColorStop(1, 'rgba(163, 230, 53, 0.0)');

  const purpleGradient = ctx.createLinearGradient(0, 0, 0, 260);
  purpleGradient.addColorStop(0, 'rgba(167, 139, 250, 0.35)');
  purpleGradient.addColorStop(1, 'rgba(167, 139, 250, 0.0)');

  state.charts.incomeExpense = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Sales (Revenue)',
          data: salesData,
          borderColor: '#A3E635',
          borderWidth: 3,
          backgroundColor: limeGradient,
          fill: true,
          tension: 0.42,
          pointRadius: 4,
          pointBackgroundColor: '#A3E635',
          pointHoverRadius: 6
        },
        {
          label: 'Purchase (COGS)',
          data: purchaseData,
          borderColor: '#A78BFA',
          borderWidth: 3,
          backgroundColor: purpleGradient,
          fill: true,
          tension: 0.42,
          pointRadius: 4,
          pointBackgroundColor: '#A78BFA',
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
          bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }, color: '#94A3B8' }
        },
        y: {
          grid: { color: '#F1F5F9' },
          ticks: {
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' },
            color: '#94A3B8',
            callback: (val) => `₹${Math.round(val / 1000)}k`
          }
        }
      }
    }
  });
}

// Donut Gauge: Liability Ratio
function renderLiabilityDonut(receivables, payables) {
  const canvas = document.getElementById('liabilityDonutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (state.charts.liabilityDonut) {
    state.charts.liabilityDonut.destroy();
  }

  state.charts.liabilityDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Creditors (Payables)', 'Debtors (Receivables)'],
      datasets: [{
        data: [payables || 923457.5, receivables || 1762534],
        backgroundColor: ['#A78BFA', '#A3E635'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E1E28',
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatINR(ctx.raw)}`
          }
        }
      }
    }
  });
}

// ==========================================================================
// 2. SALES METRICS VIEW
// ==========================================================================

function renderSalesMetricsView() {
  const tbody = document.getElementById('salesMetricsTbody');
  if (!tbody || !state.overview || !state.overview.monthlySummary) return;

  const list = state.overview.monthlySummary;

  // Render Table Rows
  tbody.innerHTML = list.map(m => {
    const isProfit = m.netOperatingProfit >= 0;
    const badgeClass = isProfit ? 'badge-success' : 'badge-danger';
    return `
      <tr>
        <td class="td-bold">${m.month}</td>
        <td class="td-bold">${formatINR(m.salesRevenue)}</td>
        <td class="td-muted">${formatINR(m.purchaseCogs)}</td>
        <td>
          <span class="badge-pill ${badgeClass}">
            ${isProfit ? '+' : ''}${formatINR(m.netOperatingProfit)}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Render Grouped Bar Chart
  const canvas = document.getElementById('monthlyVolumeBarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (state.charts.monthlyVolume) {
    state.charts.monthlyVolume.destroy();
  }

  const months = list.map(m => m.month.replace(' 2026', ' 26'));
  const sales = list.map(m => m.salesRevenue);
  const purchases = list.map(m => m.purchaseCogs);

  state.charts.monthlyVolume = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Purchase (COGS)',
          data: purchases,
          backgroundColor: '#C4B5FD',
          borderRadius: 8,
          barPercentage: 0.6,
          categoryPercentage: 0.6
        },
        {
          label: 'Sales (Turnover)',
          data: sales,
          backgroundColor: '#BEF264',
          borderRadius: 8,
          barPercentage: 0.6,
          categoryPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }, color: '#94A3B8' }
        },
        y: {
          grid: { color: '#F1F5F9' },
          ticks: {
            font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
            color: '#94A3B8',
            callback: (val) => `₹${Math.round(val / 1000)}k`
          }
        }
      }
    }
  });
}

// ==========================================================================
// 3. PARTIES VIEW (REAL DEBTORS & CREDITORS AGING)
// ==========================================================================

function renderPartiesView() {
  const agingData = state.aging;
  if (!agingData) return;

  const isDebtor = state.activePartyType === 'debtor';
  const group = isDebtor ? agingData.debtors : agingData.creditors;
  const parties = (group && group.parties) ? group.parties : [];
  const summary = group ? group.summary : { totalOutstanding: 0, partiesCount: 0, over90: 0 };

  // Update Header & KPI Cards
  const headingElem = document.getElementById('partyListHeading');
  if (headingElem) headingElem.innerText = isDebtor ? 'Debtors List (Receivables)' : 'Creditors List (Payables)';

  const totalBalElem = document.getElementById('partiesTotalBalance');
  const countElem = document.getElementById('partiesTotalCount');
  const riskElem = document.getElementById('partiesHighRiskCount');

  if (totalBalElem) totalBalElem.innerText = formatINR(summary.totalOutstanding);
  if (countElem) countElem.innerText = parties.length || summary.partiesCount || 0;
  if (riskElem) {
    const highRiskCount = parties.filter(p => (p.over90 || 0) > 0).length;
    riskElem.innerText = highRiskCount;
  }

  // Filter parties by search input
  const searchInput = document.getElementById('partySearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = parties.filter(p => !query || (p.partyName || '').toLowerCase().includes(query));

  // Sort descending by balance
  filtered.sort((a, b) => (b.netDue || b.balance || 0) - (a.netDue || a.balance || 0));

  const tbody = document.getElementById('partiesTbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94A3B8; padding: 30px;">No matching parties found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const bal = p.netDue !== undefined ? p.netDue : (p.balance || 0);
    const u30 = p.under30 || 0;
    const d30_90 = (p.d30to60 || 0) + (p.d60to90 || 0);
    const o90 = p.over90 || 0;

    return `
      <tr>
        <td class="td-bold">${p.partyName || 'Unknown'}</td>
        <td class="td-bold">${formatINR(bal)}</td>
        <td class="aging-under30">${formatINR(u30)}</td>
        <td class="aging-30to90">${formatINR(d30_90)}</td>
        <td class="${o90 > 0 ? 'aging-over90' : 'td-muted'}">${formatINR(o90)}</td>
      </tr>
    `;
  }).join('');
}

// ==========================================================================
// 4. INVENTORY VIEW (362 REAL TALLY STOCK ITEMS)
// ==========================================================================

function renderInventoryView() {
  const inv = state.inventory;
  if (!inv) return;

  const sum = inv.summary || {};
  const items = inv.items || [];

  const valElem = document.getElementById('invTotalValuation');
  const topItemElem = document.getElementById('invTopRevenueItemName');
  const topAmtElem = document.getElementById('invTopRevenueAmount');

  if (valElem) valElem.innerText = `${items.length || sum.totalItems || 362} Items Tracked`;
  if (topItemElem) topItemElem.innerText = sum.topRevenueGenerator?.name || 'AJ CUSHION 024 06/09 MRP146/-';
  if (topAmtElem) topAmtElem.innerText = formatINR(sum.topRevenueGenerator?.revenue || 162689);

  // Quick Stats
  const q = sum.quickStats || {};
  const fastElem = document.getElementById('statFastCount');
  const slowElem = document.getElementById('statSlowCount');
  const nonElem = document.getElementById('statNonMovingCount');

  if (fastElem) fastElem.innerText = q.fastCount || items.length || 362;
  if (slowElem) slowElem.innerText = q.slowCount || 0;
  if (nonElem) nonElem.innerText = q.nonMovingCount || 0;

  // Donut Gauge: Stock Movement
  renderStockMovementDonut(q.fastCount || items.length || 362, q.nonMovingCount || 0, q.slowCount || 0);

  // Filter Table
  const searchInput = document.getElementById('stockSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = items;
  if (state.activeInventoryFilter !== 'All') {
    filtered = filtered.filter(i => (i.status || '').toLowerCase() === state.activeInventoryFilter.toLowerCase());
  }
  if (query) {
    filtered = filtered.filter(i => (i.name || '').toLowerCase().includes(query));
  }

  const tbody = document.getElementById('inventoryTbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94A3B8; padding: 30px;">No inventory items matched.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.slice(0, 100).map(i => {
    let badgeClass = 'badge-success';
    if (i.status === 'Non-Moving') badgeClass = 'badge-danger';
    if (i.status === 'Slow') badgeClass = 'badge-info';

    return `
      <tr>
        <td class="td-bold">${i.name}</td>
        <td>${i.inQty}</td>
        <td>${i.outQty}</td>
        <td class="td-bold">${i.closingQty}</td>
        <td class="td-muted">${formatINR(i.valuation)}</td>
        <td>
          <span class="badge-pill ${badgeClass}">${i.status}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderStockMovementDonut(fast, nonMoving, slow) {
  const canvas = document.getElementById('stockMovementDonutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (state.charts.stockMovement) {
    state.charts.stockMovement.destroy();
  }

  state.charts.stockMovement = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Active Moving', 'Non-Moving', 'Slow'],
      datasets: [{
        data: [fast || 362, nonMoving || 0, slow || 0],
        backgroundColor: ['#A3E635', '#FB7185', '#A78BFA'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ==========================================================================
// 5. BILLS & VOUCHERS (STINTS + 27-COL MATRIX + RAW VOUCHERS)
// ==========================================================================

function setupMergedSubviews() {
  const btnStints = document.getElementById('btnViewStints');
  const btnGrid = document.getElementById('btnViewMasterGrid');
  const btnRaw = document.getElementById('btnViewRawVouchers');

  const subStints = document.getElementById('subview-stints');
  const subGrid = document.getElementById('subview-master-grid');
  const subRaw = document.getElementById('subview-raw-vouchers');

  if (btnStints && btnGrid && btnRaw) {
    btnStints.addEventListener('click', () => {
      btnStints.classList.add('active');
      btnGrid.classList.remove('active');
      btnRaw.classList.remove('active');
      subStints.style.display = 'block';
      subGrid.style.display = 'none';
      subRaw.style.display = 'none';
      state.activeVchSubView = 'stints';
      renderStintsView();
    });

    btnGrid.addEventListener('click', () => {
      btnGrid.classList.add('active');
      btnStints.classList.remove('active');
      btnRaw.classList.remove('active');
      subStints.style.display = 'none';
      subGrid.style.display = 'block';
      subRaw.style.display = 'none';
      state.activeVchSubView = 'masterGrid';
      renderMasterGridView();
    });

    btnRaw.addEventListener('click', () => {
      btnRaw.classList.add('active');
      btnStints.classList.remove('active');
      btnGrid.classList.remove('active');
      subStints.style.display = 'none';
      subGrid.style.display = 'none';
      subRaw.style.display = 'block';
      state.activeVchSubView = 'raw';
      renderRawVouchersView();
    });
  }

  // Raw voucher type filters
  document.querySelectorAll('#subview-raw-vouchers .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#subview-raw-vouchers .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeRawVchType = btn.getAttribute('data-vch-type') || '';
      renderRawVouchersView();
    });
  });

  const rawSearch = document.getElementById('rawVchSearchInput');
  if (rawSearch) {
    rawSearch.addEventListener('input', () => renderRawVouchersView());
  }

  // Refresh folders button in audit tab
  const btnRefFolders = document.getElementById('btnRefreshFolders');
  if (btnRefFolders) {
    btnRefFolders.addEventListener('click', async () => {
      btnRefFolders.disabled = true;
      try {
        await fetch('/api/folders/refresh', { method: 'POST' });
        const res = await fetch('/api/folders/status').then(r => r.json());
        state.folders = res;
        renderAuditReconcileView();
      } catch (err) {
        console.error('Folder refresh failed:', err);
      } finally {
        btnRefFolders.disabled = false;
      }
    });
  }
}

function renderBillsVouchersView() {
  if (state.activeVchSubView === 'stints') {
    renderStintsView();
  } else if (state.activeVchSubView === 'masterGrid') {
    renderMasterGridView();
  } else if (state.activeVchSubView === 'raw') {
    renderRawVouchersView();
  }
}

function renderStintsView() {
  const grid = state.masterGrid;
  if (!grid || !grid.stints) return;

  const monthSelect = document.getElementById('stintMonthSelect');
  const selectedMonth = monthSelect ? monthSelect.value : 'all';

  const searchInput = document.getElementById('stintSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let stints = grid.stints;

  if (selectedMonth !== 'all') {
    const prefix = selectedMonth.replace('-', '');
    stints = stints.filter(st => (st.rawDate || '').startsWith(prefix));
  }

  if (query) {
    stints = stints.filter(st => 
      (st.customer || '').toLowerCase().includes(query) ||
      (st.salesVoucherSummary || '').toLowerCase().includes(query) ||
      (st.purchaseRefSummary || '').toLowerCase().includes(query)
    );
  }

  const tbody = document.getElementById('stintsTbody');
  if (!tbody) return;

  if (stints.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: #94A3B8; padding: 30px;">No consignments matched.</td></tr>`;
    return;
  }

  tbody.innerHTML = stints.map((st, idx) => {
    let statusClass = 'badge-success';
    if (st.paymentStatus === 'SHORTFALL') statusClass = 'badge-warning';
    if (st.paymentStatus === 'OVERDUE') statusClass = 'badge-danger';
    if (st.paymentStatus === 'PENDING') statusClass = 'badge-info';

    return `
      <tr>
        <td class="td-bold">#${st.stintNo || (idx + 1)}</td>
        <td>${st.date || '—'}</td>
        <td class="td-bold">${st.customer || 'Unknown'}</td>
        <td><span class="stint-tag-pill">${st.billsCount} bills</span></td>
        <td class="td-muted">${st.purchaseRefSummary || '—'}</td>
        <td class="td-bold">${st.salesVoucherSummary || '—'}</td>
        <td>${st.cartons} ctn / ${st.pairs} prs</td>
        <td>${formatINR(st.purchaseAmount)}</td>
        <td class="td-bold">${formatINR(st.salesAmount)}</td>
        <td style="color: #4D7C0F; font-weight: 700;">${formatINR(st.tradeMargin)}</td>
        <td><span class="badge-pill ${statusClass}">${st.paymentLabel || 'Matched'}</span></td>
        <td>
          <button class="btn-icon-action eye-btn" data-stint-key="${st.rawDate}__${st.customer}" title="Inspect Consignment Invoices">
            <i data-lucide="eye"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-stint-key');
      openStintModal(key);
    });
  });

  if (window.lucide) lucide.createIcons();
}

function renderMasterGridView() {
  const grid = state.masterGrid;
  const tbody = document.getElementById('masterGridTbody');
  if (!grid || !tbody) return;

  const rows = grid.rows || [];
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="27" style="text-align: center; color: #94A3B8; padding: 30px;">Loading matrix...</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const waText = encodeURIComponent(`Hi ${r.customer}, regarding your SKIL Lifestyle Invoice ${r.salesVoucher} dt ${r.date} for ${formatINR(r.salesAmount)}. Due Date: ${r.dueDate || '30 days'}. Prompt 5% CD: ${formatINR(r.custCd5)}. Net Payable: ${formatINR(r.custNetPayable)}.`);
    const waUrl = `https://wa.me/?text=${waText}`;

    return `
      <tr>
        <td class="sticky-c1 td-bold">#${r.pairNo}</td>
        <td class="sticky-c2">${r.date}</td>
        <td class="sticky-c3 td-bold">${r.customer}</td>
        <td>${r.cartons} ctn / ${r.pairs} prs</td>
        <td class="td-muted">
          ${r.purchaseRef ? `
            <a href="${getApiUrl('/api/invoices/download/' + encodeURIComponent(r.purchaseRef))}" download class="btn-download-link" title="Download Supplier Invoice ${r.purchaseRef}">
              ${r.purchaseRef} <i data-lucide="download" style="width: 11px; height: 11px; margin-left: 2px;"></i>
            </a>
          ` : '—'}
        </td>
        <td>${r.supplier.includes('Xpania') ? 'Xpania' : 'Ajanta'}</td>
        <td style="text-align: right;">${formatINR(r.purchaseAmount)}</td>
        <td style="font-size: 11px; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${r.purchaseVoucher}</td>
        <td class="td-bold">${r.salesVoucher}</td>
        <td style="text-align: right;" class="td-bold">${formatINR(r.salesAmount)}</td>
        <td style="text-align: right; color: #4D7C0F; font-weight: 700;">${formatINR(r.tradeMargin)}</td>
        <td style="text-align: right;">${r.tradeMarginPct}%</td>
        <td style="text-align: right;">${formatINR(r.suppCd3)}</td>
        <td style="text-align: right;">${formatINR(r.suppScheme378)}</td>
        <td style="text-align: right;" class="td-bold">${formatINR(r.suppTotalClaim)}</td>
        <td><span class="badge-pill ${r.suppClaimStatus === 'SETTLED' ? 'badge-success' : 'badge-warning'}">${r.suppClaimStatus}</span></td>
        <td style="text-align: right;">${formatINR(r.taxableSales)}</td>
        <td style="text-align: right;">${formatINR(r.custCd5)}</td>
        <td style="text-align: right;" class="td-bold">${formatINR(r.custNetPayable)}</td>
        <td><span class="badge-pill ${r.custCnStatus === 'ISSUED' ? 'badge-success' : 'badge-warning'}">${r.custCnStatus}</span></td>
        <td>${r.dueDate || '—'}</td>
        <td style="text-align: center;">${r.daysElapsed}d</td>
        <td><span class="badge-pill ${r.paymentStatus === 'CLEARED' ? 'badge-success' : r.paymentStatus === 'OVERDUE' ? 'badge-danger' : 'badge-info'}">${r.paymentLabel}</span></td>
        <td style="text-align: right; color: #15803D; font-weight: 800;">${formatINR(r.netRealizedProfit)}</td>
        <td style="text-align: center; color: #15803D; font-weight: 800;">${r.netProfitMarginPct}%</td>
        <td style="text-align: center;">
          <a href="${waUrl}" target="_blank" class="btn-icon-action" title="Share via WhatsApp" style="width: 28px; height: 28px; text-decoration: none; color: #16A34A;">
            <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
          </a>
        </td>
        <td style="text-align: center;">
          <button onclick="copyToClipboard('${r.salesVoucher}', this)" class="btn-icon-action" title="Copy Sales Voucher #" style="width: 28px; height: 28px;">
            <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderRawVouchersView() {
  const tbody = document.getElementById('rawVouchersTbody');
  if (!tbody) return;

  const searchInput = document.getElementById('rawVchSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let list = state.rawVouchers || [];
  if (state.activeRawVchType) {
    list = list.filter(v => (v.voucherType || '').toLowerCase() === state.activeRawVchType.toLowerCase());
  }
  if (query) {
    list = list.filter(v => 
      (v.voucherNumber || '').toLowerCase().includes(query) ||
      (v.partyName || '').toLowerCase().includes(query) ||
      (v.reference || '').toLowerCase().includes(query) ||
      (v.narration || '').toLowerCase().includes(query)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94A3B8; padding: 30px;">No vouchers matched.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.slice(0, 100).map(v => {
    const isPurchase = (v.voucherType || '').toLowerCase() === 'purchase';
    const docBtn = isPurchase ? `
      <a href="${getApiUrl('/api/invoices/download/' + encodeURIComponent(v.voucherNumber))}" download class="btn-download-sm" title="Download Invoice PDF">
        <i data-lucide="download" style="width: 12px; height: 12px;"></i> PDF
      </a>
    ` : '<span style="color: #CBD5E1;">—</span>';

    return `
      <tr>
        <td>${formatDateStr(v.date)}</td>
        <td><span class="stint-tag-pill">${v.voucherType}</span></td>
        <td class="td-bold">${v.voucherNumber || '—'}</td>
        <td class="td-bold">${v.partyName || '—'}</td>
        <td class="td-muted">${v.reference || '—'}</td>
        <td style="text-align: right;" class="td-bold">${formatINR(v.amount)}</td>
        <td style="font-size: 11.5px; max-width: 240px; color: #64748B;">${v.narration || '—'}</td>
        <td style="text-align: center;">${docBtn}</td>
      </tr>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

// Open Stint Modal
function openStintModal(stintKey) {
  const grid = state.masterGrid;
  if (!grid || !grid.stints) return;

  const stint = grid.stints.find(st => `${st.rawDate}__${st.customer}` === stintKey);
  if (!stint) return;

  state.selectedStint = stint;

  document.getElementById('modalCustomerTitle').innerText = stint.customer || 'Consignment Details';
  document.getElementById('modalStintSubtitle').innerText = `Stint #${stint.stintNo} — ${stint.date} (${stint.suppliersList || 'Direct'})`;

  document.getElementById('modalTotalBills').innerText = stint.billsCount;
  document.getElementById('modalTotalSales').innerText = formatINR(stint.salesAmount);
  document.getElementById('modalTotalMargin').innerText = formatINR(stint.tradeMargin);
  document.getElementById('modalCdStatus').innerText = `${formatINR(stint.custCd5)} (${stint.custCnStatus})`;

  const tbody = document.getElementById('modalBillsTbody');
  if (tbody) {
    tbody.innerHTML = (stint.bills || []).map(b => {
      let bStatusClass = 'badge-success';
      if (b.paymentStatus === 'SHORTFALL') bStatusClass = 'badge-warning';
      if (b.paymentStatus === 'OVERDUE') bStatusClass = 'badge-danger';

      return `
        <tr>
          <td class="td-muted">
            ${b.purchaseRef ? `
              <a href="${getApiUrl('/api/invoices/download/' + encodeURIComponent(b.purchaseRef))}" download class="btn-download-link" title="Download Invoice ${b.purchaseRef}">
                ${b.purchaseRef} <i data-lucide="download" style="width: 11px; height: 11px; margin-left: 2px;"></i>
              </a>
            ` : '—'}
          </td>
          <td class="td-bold">${b.salesVoucher || '—'}</td>
          <td>${b.supplier || '—'}</td>
          <td>${b.cartons || 0}</td>
          <td>${b.pairs || 0}</td>
          <td>${formatINR(b.purchaseAmount)}</td>
          <td class="td-bold">${formatINR(b.salesAmount)}</td>
          <td style="color: #4D7C0F; font-weight: 700;">${formatINR(b.tradeMargin)}</td>
          <td>${b.dueDate || '—'}</td>
          <td><span class="badge-pill ${bStatusClass}">${b.paymentLabel || 'Normal'}</span></td>
        </tr>
      `;
    }).join('');
  }

  const modal = document.getElementById('stintModal');
  if (modal) modal.classList.add('modal-open');
  if (window.lucide) lucide.createIcons();
}

function setupModalEvents() {
  const modal = document.getElementById('stintModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('modal-open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('modal-open');
    });
  }
}

// ==========================================================================
// 6. CREDIT NOTES & SCHEMES (CONTRACT INCENTIVE INDICATORS)
// ==========================================================================

function renderSchemesView() {
  const container = document.getElementById('contractIndicatorsGrid');
  if (!container) return;

  const indicators = state.schemes?.indicators || [];
  if (indicators.length === 0) {
    container.innerHTML = `<div style="color: #94A3B8; padding: 20px;">Loading contract indicators...</div>`;
    return;
  }

  container.innerHTML = indicators.map(ind => {
    const isCompleted = ind.status === 'SATISFIED' || ind.status === 'ACTIVE_COMPLIANT' || ind.status === 'COMPLIANT';
    const badgeClass = isCompleted ? 'badge-success' : 'badge-warning';

    return `
      <div class="indicator-card">
        <div>
          <div class="indicator-header">
            <div>
              <div class="indicator-title">${ind.title}</div>
              <div class="indicator-clause">${ind.clause || ''} • Rate: <strong>${ind.rate}</strong></div>
            </div>
            <span class="badge-pill ${badgeClass}">${ind.status}</span>
          </div>
          <p style="font-size: 12.5px; color: #475569; margin-top: 8px;">${ind.description}</p>
        </div>

        <div>
          <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-bottom: 6px;">
            ${ind.statusText || 'Active Term'}
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${isCompleted ? '100%' : '65%'}; background: ${isCompleted ? '#A3E635' : '#FBBF24'};"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// 7. PAYMENT AGING & OVERDUES VIEW
// ==========================================================================

function renderPaymentAgingView() {
  const grid = state.masterGrid;
  const tbody = document.getElementById('paymentAgingTbody');
  if (!grid || !tbody) return;

  const rows = grid.rows || [];
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94A3B8; padding: 30px;">No bills available.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    let statusClass = 'badge-success';
    if (r.paymentStatus === 'SHORTFALL') statusClass = 'badge-warning';
    if (r.paymentStatus === 'OVERDUE') statusClass = 'badge-danger';
    if (r.paymentStatus === 'PENDING') statusClass = 'badge-info';

    return `
      <tr>
        <td class="td-bold">${r.customer}</td>
        <td class="td-bold">${r.salesVoucher}</td>
        <td>${r.date}</td>
        <td class="td-muted">${r.dueDate || '—'}</td>
        <td style="font-weight: 700; color: ${r.daysElapsed > 30 ? '#DC2626' : '#475569'};">${r.daysElapsed} days</td>
        <td class="td-bold">${formatINR(r.salesAmount)}</td>
        <td style="color: #4D7C0F; font-weight: 700;">${formatINR(r.custCd5)}</td>
        <td><span class="badge-pill ${statusClass}">${r.paymentLabel}</span></td>
      </tr>
    `;
  }).join('');
}

// ==========================================================================
// 8. AUDIT & RECONCILIATION VIEW
// ==========================================================================

function renderAuditReconcileView() {
  // Folder Timestamps list
  const folderList = document.getElementById('folderTimestampsList');
  if (folderList && state.folders?.folders) {
    folderList.innerHTML = state.folders.folders.map(f => `
      <div class="folder-status-card">
        <div>
          <div style="font-size: 13.5px; font-weight: 700; color: #0F172A;">${f.prefix}</div>
          <div style="font-size: 11px; color: #64748B;">Latest: ${f.latestFile || 'Clean'}</div>
        </div>
        <div style="text-align: right;">
          <span class="badge-pill badge-neutral" style="font-size: 11px;">${f.latestTime || 'Synced'}</span>
          <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">${f.count} files</div>
        </div>
      </div>
    `).join('');
  }
}

// ==========================================================================
// 9. TALLY POSTING GUIDE VIEW (WITH COPY NARRATION BUTTONS)
// ==========================================================================

function renderTallyGuideView() {
  const container = document.getElementById('tallyGuideList');
  if (!container) return;

  const entries = state.guide?.entries || [];
  if (entries.length === 0) {
    container.innerHTML = `<div style="color: #94A3B8; padding: 20px;">All routine adjustments reconciled. Zero pending entries!</div>`;
    return;
  }

  container.innerHTML = entries.map(e => `
    <div class="guide-entry-card">
      <div class="guide-entry-header">
        <div>
          <div class="guide-entry-title">${e.title}</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 3px;">${e.nature || ''} • Date: <strong>${e.date}</strong></div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="guide-key-badge">${e.tallyShortcut}</span>
          <span class="badge-pill ${e.isEnteredInTally ? 'badge-success' : 'badge-warning'}">
            ${e.isEnteredInTally ? 'Entered in Tally' : 'Pending in Tally'}
          </span>
        </div>
      </div>

      <div class="guide-details-grid">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase;">DEBIT ACCOUNT</div>
          <div style="font-size: 13.5px; font-weight: 800; color: #15803D; margin-top: 2px;">${e.debitLedger}</div>
          <div style="font-size: 12px; font-weight: 700; color: #0F172A;">${formatINR(e.debitAmount)}</div>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase;">CREDIT ACCOUNT</div>
          <div style="font-size: 13.5px; font-weight: 800; color: #B91C1C; margin-top: 2px;">${e.creditLedger}</div>
          <div style="font-size: 12px; font-weight: 700; color: #0F172A;">${formatINR(e.creditAmount)}</div>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase;">BILL ALLOCATION</div>
          <div style="font-size: 13px; font-weight: 700; color: #475569; margin-top: 2px;">${e.refType}</div>
          <div style="font-size: 12px; color: #64748B;">Ref: ${e.refNo}</div>
        </div>
      </div>

      <div class="guide-narration-box">
        <div style="flex: 1; font-family: monospace; font-size: 12px;">${e.narration}</div>
        <button onclick="copyToClipboard('${e.narration.replace(/'/g, "\\'")}', this)" class="btn-copy-narration">
          <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
          <span>Copy Narration</span>
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================================================
// 10. LINEMAN ROUTE VIEW
// ==========================================================================

function renderLinemanView() {
  const grid = state.masterGrid;
  const tbody = document.getElementById('linemanTbody');
  if (!grid || !tbody) return;

  const rows = grid.rows || [];

  const detectRoute = (name) => {
    const n = name.toUpperCase();
    if (n.includes('RAYAGADA')) return 'Rayagada Route';
    if (n.includes('JEYPORE') || n.includes('KORAPUT')) return 'Jeypore / Koraput Route';
    if (n.includes('VIZIANAGARAM') || n.includes('VZM')) return 'Vizianagaram Route';
    if (n.includes('VISAKHAPATNAM') || n.includes('VIZAG')) return 'Visakhapatnam Route';
    if (n.includes('BERHAMPUR') || n.includes('GANJAM')) return 'Berhampur Route';
    return 'Coastal / Other Route';
  };

  const routesMap = {};
  rows.forEach(r => {
    const route = detectRoute(r.customer);
    if (!routesMap[route]) routesMap[route] = [];
    routesMap[route].push(r);
  });

  const html = [];
  for (const [route, items] of Object.entries(routesMap)) {
    items.forEach((item, idx) => {
      html.push(`
        <tr>
          <td class="td-bold" style="color: #6D28D9;">${idx === 0 ? route : ''}</td>
          <td class="td-bold">${item.customer}</td>
          <td>${item.date}</td>
          <td>${item.cartons} ctn</td>
          <td class="td-bold">${formatINR(item.salesAmount)}</td>
          <td><span class="badge-pill badge-success">Delivered</span></td>
        </tr>
      `);
    });
  }

  tbody.innerHTML = html.length > 0 ? html.join('') : `<tr><td colspan="6" style="text-align: center; color: #94A3B8; padding: 30px;">No delivery routes found.</td></tr>`;
}

// ==========================================================================
// 11. LEDGER BOOK VIEW
// ==========================================================================

async function loadLedgerBookDropdown() {
  const select = document.getElementById('ledgerBookSelect');
  if (!select) return;

  try {
    const resp = await fetch('/api/ledger/statement');
    const data = await resp.json();
    const available = data.availableLedgers || [];

    const currentVal = select.value;
    select.innerHTML = `<option value="">Select Ledger...</option>` + 
      available.map(l => `<option value="${l}" ${l === currentVal ? 'selected' : ''}>${l}</option>`).join('');

    if (!currentVal && available.includes('Union Bank Current A/c')) {
      select.value = 'Union Bank Current A/c';
      loadLedgerStatement('Union Bank Current A/c');
    }

    select.onchange = () => {
      if (select.value) {
        loadLedgerStatement(select.value);
      }
    };
  } catch (err) {
    console.error('Error loading ledger list:', err);
  }
}

async function loadLedgerStatement(ledgerName) {
  try {
    const resp = await fetch(`/api/ledger/statement?ledger=${encodeURIComponent(ledgerName)}`);
    const data = await resp.json();

    document.getElementById('ledgerTotalDebits').innerText = formatINR(data.totalDebits);
    document.getElementById('ledgerTotalCredits').innerText = formatINR(data.totalCredits);
    document.getElementById('ledgerClosingBalance').innerText = formatINR(data.closingBalance);
    document.getElementById('ledgerVoucherCount').innerText = data.transactions?.length || 0;

    const tbody = document.getElementById('ledgerStatementTbody');
    if (!tbody) return;

    if (!data.transactions || data.transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94A3B8; padding: 30px;">No transactions recorded for ${ledgerName}.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.transactions.map(t => `
      <tr>
        <td>${t.formattedDate || t.date}</td>
        <td><span class="stint-tag-pill">${t.voucherType}</span></td>
        <td class="td-bold">${t.voucherNumber || '—'}</td>
        <td class="td-muted">${t.reference || '—'}</td>
        <td style="max-width: 250px; font-size: 12px; color: #64748B;">${t.narration || '—'}</td>
        <td style="color: #15803D; font-weight: 700;">${t.debit > 0 ? formatINR(t.debit) : '—'}</td>
        <td style="color: #B91C1C; font-weight: 700;">${t.credit > 0 ? formatINR(t.credit) : '—'}</td>
        <td class="td-bold">${formatINR(t.runningBalance)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading ledger statement:', err);
  }
}

// ==========================================================================
// 12. FILTER & EVENT LISTENERS
// ==========================================================================

function setupFilterEvents() {
  const monthSelect = document.getElementById('monthFilterSelect');
  if (monthSelect) {
    monthSelect.addEventListener('change', () => renderDashboardView());
  }

  const btnDebtors = document.getElementById('btnPartyDebtors');
  const btnCreditors = document.getElementById('btnPartyCreditors');
  if (btnDebtors && btnCreditors) {
    btnDebtors.addEventListener('click', () => {
      btnDebtors.classList.add('active');
      btnCreditors.classList.remove('active');
      state.activePartyType = 'debtor';
      renderPartiesView();
    });
    btnCreditors.addEventListener('click', () => {
      btnCreditors.classList.add('active');
      btnDebtors.classList.remove('active');
      state.activePartyType = 'creditor';
      renderPartiesView();
    });
  }

  const partySearch = document.getElementById('partySearchInput');
  if (partySearch) {
    partySearch.addEventListener('input', () => renderPartiesView());
  }

  const stintMonth = document.getElementById('stintMonthSelect');
  if (stintMonth) {
    stintMonth.addEventListener('change', () => renderStintsView());
  }
  const stintSearch = document.getElementById('stintSearchInput');
  if (stintSearch) {
    stintSearch.addEventListener('input', () => renderStintsView());
  }

  const invSearch = document.getElementById('stockSearchInput');
  if (invSearch) {
    invSearch.addEventListener('input', () => renderInventoryView());
  }
  document.querySelectorAll('#view-inventory .segmented-pills .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-inventory .segmented-pills .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeInventoryFilter = btn.getAttribute('data-filter') || 'All';
      renderInventoryView();
    });
  });

  const globalSearch = document.getElementById('globalSearchInput');
  if (globalSearch) {
    globalSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = globalSearch.value.trim();
        if (query) {
          const navParties = document.querySelector('.sidebar-menu .nav-item[data-tab="parties"]');
          if (navParties) navParties.click();
          const pSearch = document.getElementById('partySearchInput');
          if (pSearch) {
            pSearch.value = query;
            renderPartiesView();
          }
        }
      }
    });
  }
}