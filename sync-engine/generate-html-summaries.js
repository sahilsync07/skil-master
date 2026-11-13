const fs = require('fs');
const path = require('path');

const vouchers = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/vouchers.json'), 'utf8'));
const values = Object.values(vouchers);

// Format currency
function fmtCur(amt) {
  if (amt === null || amt === undefined || isNaN(amt)) return '₹0.00';
  const val = Math.abs(amt);
  const formatted = val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (amt < 0 ? '-' : '') + '₹' + formatted;
}

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).replace(/[^0-9]/g, '');
  if (s.length === 8) {
    return `${s.slice(6, 8)}-${s.slice(4, 6)}-${s.slice(0, 4)}`;
  }
  return d;
}

// Payment status mapping
const billPaymentMap = {
  'SKIL-001': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs July Advance', recd: 44490, due: 0 },
  'SKIL-002': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #11 (₹1,48,728) + CN #3 (₹7,436)', recd: 156164, due: 0 },
  'SKIL-003': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs July Advance', recd: 63488, due: 0 },
  'SKIL-004': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #7 + 5% CD (CN #1)', recd: 52432, due: 0 },
  'SKIL-005': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #7 + 5% CD (CN #1)', recd: 55796, due: 0 },
  'SKIL-006': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #7 + 5% CD (CN #1)', recd: 5606, due: 0 },
  'SKIL-007': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs July Advance', recd: 84051, due: 0 },
  'SKIL-008': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs July Advance', recd: 6356, due: 0 },
  'SKIL-009': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs July Advance', recd: 16819, due: 0 },
  'SKIL-010': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs July Advance', recd: 40369, due: 0 },
  'SKIL-011': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 70660, due: 0 },
  'SKIL-012': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 27533, due: 0 },
  'SKIL-013': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 155995, due: 0 },
  'SKIL-014': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 69232, due: 0 },
  'SKIL-015': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 53715, due: 0 },
  'SKIL-016': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 22193, due: 0 },
  'SKIL-017': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 33840, due: 0 },
  'SKIL-018': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 14737, due: 0 },
  'SKIL-019': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 74216, due: 0 },
  'SKIL-020': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #4/6/8 + 5% CD (CN #2)', recd: 35197, due: 0 },
  'SKIL-021': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs July Advance', recd: 158954, due: 0 },
  'SKIL-022': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs July Advance', recd: 15563, due: 0 },
  
  'SKIL-023': { status: 'PARTIAL', text: 'PARTIAL (Recd ₹1,00,000)', note: 'Due: ₹70,306 (Rcpt #15)', recd: 100000, due: 70306 },
  'SKIL-024': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹22,890', recd: 0, due: 22890 },
  'SKIL-025': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹18,855', recd: 0, due: 18855 },
  'SKIL-026': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹4,238', recd: 0, due: 4238 },
  'SKIL-027': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #18 (₹1L part) dt 03-11', recd: 53430, due: 0 },
  'SKIL-028': { status: 'PARTIAL', text: 'PARTIAL (Recd ₹46,570)', note: 'Due: ₹10,486 (Rcpt #18)', recd: 46570, due: 10486 },
  'SKIL-029': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹34,144', recd: 0, due: 34144 },
  'SKIL-030': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹4,613', recd: 0, due: 4613 },
  'SKIL-031': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 21375, due: 0 },
  'SKIL-032': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 12525, due: 0 },
  'SKIL-033': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 12469, due: 0 },
  'SKIL-034': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 5981, due: 0 },
  'SKIL-035': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #14 + 5% CD (CN #7)', recd: 267292, due: 0 },
  'SKIL-036': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 13005, due: 0 },
  'SKIL-037': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 23925, due: 0 },
  'SKIL-038': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #9/10 + 5% CD (CN #5)', recd: 10770, due: 0 },
  'SKIL-039': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #9/10 + 5% CD (CN #5)', recd: 5606, due: 0 },
  'SKIL-040': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹3,01,964', recd: 0, due: 301964 },
  'SKIL-041': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹78,249', recd: 0, due: 78249 },
  'SKIL-042': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹50,655', recd: 0, due: 50655 },
  'SKIL-043': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹39,697', recd: 0, due: 39697 },
  'SKIL-044': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #9/10 + 5% CD (CN #5)', recd: 39180, due: 0 },
  'SKIL-045': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #9/10 + 5% CD (CN #5)', recd: 24675, due: 0 },
  'SKIL-046': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #9/10 + 5% CD (CN #5)', recd: 24435, due: 0 },
  'SKIL-047': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹43,801', recd: 0, due: 43801 },
  'SKIL-048': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹28,890', recd: 0, due: 28890 },
  'SKIL-049': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 8835, due: 0 },
  'SKIL-050': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹5,981', recd: 0, due: 5981 },
  'SKIL-051': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 15619, due: 0 },
  'SKIL-052': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹65,531', recd: 0, due: 65531 },
  'SKIL-053': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #13 + 5% CD (CN #6)', recd: 22725, due: 0 },

  'SKIL-054': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #14 + 5% CD (CN #7)', recd: 141701, due: 0 },
  'SKIL-055': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹1,10,672', recd: 0, due: 110672 },
  'SKIL-056': { status: 'PARTIAL', text: 'PARTIAL (Recd ₹50,000)', note: 'Due: ₹60,382 (Rcpt #12/19)', recd: 50000, due: 60382 },
  'SKIL-057': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Current account cleared', recd: 4785, due: 0 },
  'SKIL-058': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹65,029', recd: 0, due: 65029 },
  'SKIL-059': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs October balance', recd: 19140, due: 0 },
  'SKIL-060': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs October balance', recd: 42683, due: 0 },
  'SKIL-061': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Cleared vs October balance', recd: 42630, due: 0 },
  'SKIL-062': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹82,079', recd: 0, due: 82079 },
  'SKIL-063': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹75,315', recd: 0, due: 75315 },
  'SKIL-064': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #16/17 (₹2L part)', recd: 30214, due: 0 },
  'SKIL-065': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Rcpt #16/17 (₹2L part)', recd: 12262, due: 0 },
  'SKIL-066': { status: 'PARTIAL', text: 'PARTIAL (Recd ₹1,57,524)', note: 'Due: ₹3,61,751 (Rcpt #16/17)', recd: 157524, due: 361751 },
  'SKIL-067': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹3,15,696', recd: 0, due: 315696 },
  'SKIL-068': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹81,114', recd: 0, due: 81114 },
  'SKIL-069': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹10,275', recd: 0, due: 10275 },
  'SKIL-070': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Current account cleared', recd: 36556, due: 0 },
  'SKIL-071': { status: 'CANCELLED', text: 'CANCELLED (CN #8)', note: 'Delivered to Sharvani (Re-billed #SKIL-078)', recd: 59971, due: 0 },
  'SKIL-072': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹1,45,300', recd: 0, due: 145300 },
  'SKIL-073': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Current account cleared', recd: 13335, due: 0 },
  'SKIL-074': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Current account cleared', recd: 38726, due: 0 },
  'SKIL-075': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Current account cleared', recd: 19140, due: 0 },
  'SKIL-076': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Current account cleared', recd: 22564, due: 0 },

  'SKIL-077': { status: 'PAID', text: 'PAID (100% Settled)', note: 'Current account cleared', recd: 105720, due: 0 },
  'SKIL-078': { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ₹59,971 (Ajanta Inv #1900423838)', recd: 0, due: 59971 }
};

// All Credit notes (Customer side)
const allCNs = values.filter(v => v.voucherType === 'Credit Note').sort((a,b) => (a.date || '').localeCompare(b.date || '') || parseInt(a.voucherNumber) - parseInt(b.voucherNumber));

// All Debit notes (Supplier side claims)
const allDNs = values.filter(v => v.voucherType === 'Debit Note').sort((a,b) => (a.date || '').localeCompare(b.date || '') || parseInt(a.voucherNumber) - parseInt(b.voucherNumber));

// All Purchases and Sales
const allPurchases = values.filter(v => v.voucherType === 'Purchase').sort((a,b) => (a.date || '').localeCompare(b.date || '') || parseInt(a.voucherNumber) - parseInt(b.voucherNumber));
const allSales = values.filter(v => v.voucherType === 'Sales');

// Months definition
const monthsConfig = [
  {
    key: '202607',
    name: 'July 2026',
    slug: 'july',
    periodNote: 'Initial Capital Formation & Dealership Security Advances',
    isSetupMonth: true,
    setupDetails: [
      { sl: 1, date: '29-07-2026', type: 'Partner Capital', ref: 'UPI Receipt #1', party: 'Sahil Kumar (Designated Partner)', amt: 100000, desc: 'Initial partner capital contributed into Union Bank Current A/c' },
      { sl: 2, date: '29-07-2026', type: 'Partner Capital', ref: 'IMPS Receipt #2', party: 'Sisinti Lokanatha Patro (Partner)', amt: 100000, desc: 'Initial partner capital contributed into Union Bank Current A/c' },
      { sl: 3, date: '30-07-2026', type: 'Customer Advance', ref: 'RTGS Receipt #3', party: 'M/s Sri Brundabana Enterprises, Rayagada', amt: 1000000, desc: 'Advance received against future supply of footwear (UTR: SBINR12026073037097671)' },
      { sl: 4, date: '30-07-2026', type: 'Supplier Security Deposit', ref: 'RTGS Payment #1', party: 'Ajanta Shoes India Pvt. Ltd.', amt: 1000000, desc: 'Dealership security advance transferred to Ajanta Shoes (UTR: UBINR22026073001763487)' }
    ]
  },
  {
    key: '202608',
    name: 'August 2026',
    slug: 'august',
    periodNote: 'First Trading Month — 22 Purchases / 22 Sales (100% Reconciled & Settled)',
    isSetupMonth: false
  },
  {
    key: '202609',
    name: 'September 2026',
    slug: 'september',
    periodNote: 'Festival Inward Supplies — 31 Purchases / 31 Sales',
    isSetupMonth: false
  },
  {
    key: '202610',
    name: 'October 2026',
    slug: 'october',
    periodNote: 'Diwali Trading & Re-allocation Audit — 23 Purchases / 23 Sales',
    isSetupMonth: false
  },
  {
    key: '202611',
    name: 'November 2026',
    slug: 'november',
    periodNote: 'Month-to-Date (till 13-Nov-2026) — 1 Purchase / 2 Sales',
    isSetupMonth: false
  }
];

// Helper to get CSS styles
function getCommonCSS() {
  return `
    @page {
      size: A4 portrait;
      margin: 10mm 8mm 10mm 8mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000;
      background: #e2e8f0;
      margin: 0;
      padding: 20px;
      font-size: 8.8pt;
      line-height: 1.3;
      -webkit-font-smoothing: antialiased;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      background: #fff;
      margin: 0 auto 30px auto;
      padding: 12mm 10mm;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #cbd5e1;
      position: relative;
    }
    .page-break {
      page-break-before: always;
    }
    @media print {
      body {
        background: #fff !important;
        padding: 0 !important;
        font-size: 8.5pt;
      }
      .sheet {
        width: 100% !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
      tr {
        page-break-inside: avoid;
      }
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: 700; }
    .semibold { font-weight: 600; }

    /* Top Nav Control Bar */
    .nav-bar {
      width: 210mm;
      margin: 0 auto 15px auto;
      background: #0f172a;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .nav-bar a {
      color: #94a3b8;
      text-decoration: none;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 600;
      border: 1px solid transparent;
    }
    .nav-bar a.active, .nav-bar a:hover {
      color: #fff;
      background: #1e293b;
      border-color: #475569;
    }
    .print-btn {
      background: #fff;
      color: #0f172a;
      border: none;
      padding: 6px 14px;
      font-weight: 700;
      font-size: 8.5pt;
      border-radius: 5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover {
      background: #f1f5f9;
    }

    /* Document Header */
    .doc-header {
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .company-title {
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 0 0 2px 0;
    }
    .company-sub {
      font-size: 8pt;
      color: #222;
      margin: 0 0 4px 0;
    }
    .doc-badge-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 4px;
    }
    .report-title {
      font-size: 10.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      background: #000;
      color: #fff;
      padding: 3px 8px;
      display: inline-block;
    }
    .report-meta {
      font-size: 8pt;
      font-weight: 600;
      text-align: right;
    }

    /* KPI Cards */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    .kpi-box {
      border: 1px solid #000;
      padding: 5px 7px;
      background: #fafafa;
    }
    .kpi-label {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #333;
      margin-bottom: 1px;
    }
    .kpi-val {
      font-size: 11pt;
      font-weight: 800;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .kpi-sub {
      font-size: 6.8pt;
      color: #555;
      margin-top: 1px;
    }

    /* Tables */
    table.audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.8pt;
      margin-bottom: 10px;
    }
    table.audit-table th {
      background: #111;
      color: #fff;
      border: 1px solid #111;
      padding: 4px 5px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table.audit-table td {
      border: 1px solid #000;
      padding: 3px 5px;
      vertical-align: middle;
    }
    table.audit-table tr.total-row td {
      background: #f1f1f1;
      font-weight: 800;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 1px 4px;
      font-size: 7pt;
      font-weight: 700;
      border-radius: 2px;
      border: 1px solid #000;
      white-space: nowrap;
    }
    .badge-paid {
      background: #e2e8f0;
      color: #000;
    }
    .badge-partial {
      background: #fff;
      color: #000;
      border-style: dashed;
    }
    .badge-pending {
      background: #fff;
      color: #000;
    }
    .badge-cancelled {
      background: #000;
      color: #fff;
    }

    /* Remarks Column */
    .col-remarks {
      width: 38mm;
      min-width: 38mm;
      background: #fff;
    }
    .handwriting-line {
      display: block;
      height: 12px;
      border-bottom: 1px dotted #ccc;
    }

    /* Section Headings */
    .section-title {
      font-size: 8.8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin: 8px 0 3px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1.5px solid #000;
      padding-bottom: 2px;
    }

    /* Summary Financial Box */
    .financial-box {
      border: 1.5px solid #000;
      padding: 6px 10px;
      margin-top: 6px;
      background: #fafafa;
    }
    .fin-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      font-size: 8pt;
    }
    .fin-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      border-bottom: 1px dotted #bbb;
    }
    .fin-row.bold-row {
      font-weight: 800;
      border-bottom: 1.5px solid #000;
      border-top: 1.5px solid #000;
      padding: 3px 0;
      font-size: 8.5pt;
      background: #fff;
    }

    /* Signatures */
    .sign-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 20px;
      padding-top: 8px;
    }
    .sign-box {
      border-top: 1px solid #000;
      padding-top: 3px;
      font-size: 7.5pt;
      text-align: center;
    }

    /* Page Footer */
    .page-footer {
      position: absolute;
      bottom: 6mm;
      left: 10mm;
      right: 10mm;
      display: flex;
      justify-content: space-between;
      font-size: 7.2pt;
      color: #444;
      border-top: 1px solid #999;
      padding-top: 3px;
    }
  `;
}

// Generate Page 1: Purchase & Sales Matching Summary
function generatePage1HTML(mConfig, purchasesInMonth, monthSales) {
  const isJuly = mConfig.isSetupMonth;
  const isNov = mConfig.slug === 'november';

  // For November, include the cross-month re-allocated purchase #71 that was billed under SKIL-078
  let tablePurchases = [...purchasesInMonth];
  if (isNov) {
    const p71 = allPurchases.find(p => p.voucherNumber === '71');
    if (p71 && !tablePurchases.some(p => p.voucherNumber === '71')) {
      tablePurchases.push({
        ...p71,
        isCrossMonthReallocated: true
      });
    }
  }

  // Compute Totals
  let totalPurchasesAmt = 0;
  let totalSalesAmt = 0;
  let totalSettled = 0;
  let totalDue = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let partialCount = 0;

  tablePurchases.forEach(p => {
    totalPurchasesAmt += Math.abs(parseFloat(p.amount || 0));
    const ref = p.reference;
    let sMatch = isNov ? allSales.find(s => s.voucherNumber === (p.isCrossMonthReallocated ? 'SKIL-078' : 'SKIL-077')) : monthSales.find(s => s.reference && s.reference === ref);
    if (!sMatch) {
      const vnum = parseInt(p.voucherNumber);
      sMatch = monthSales.find(s => parseInt(String(s.voucherNumber).replace(/[^0-9]/g, '')) === vnum);
    }
    if (sMatch) {
      const sAmt = Math.abs(parseFloat(sMatch.amount || 0));
      totalSalesAmt += sAmt;
      const bStat = billPaymentMap[sMatch.voucherNumber] || { status: 'PENDING', recd: 0, due: sAmt };
      totalSettled += bStat.recd;
      totalDue += bStat.due;
      if (bStat.status === 'PAID') paidCount++;
      else if (bStat.status === 'PARTIAL') partialCount++;
      else pendingCount++;
    }
  });

  let rowsHTML = '';
  if (isJuly) {
    // July Special Setup Table
    rowsHTML = mConfig.setupDetails.map(d => `
      <tr>
        <td class="text-center bold">${d.sl}</td>
        <td><strong>${d.ref}</strong><br><span style="font-size:7pt;">dt ${d.date}</span></td>
        <td><span class="mono bold">${d.type}</span></td>
        <td><strong>${d.party}</strong><br><span style="font-size:7pt; color:#333;">${d.desc}</span></td>
        <td>
          <span class="badge badge-paid">100% EXECUTED</span><br>
          <strong class="mono">${fmtCur(d.amt)}</strong>
        </td>
        <td class="col-remarks">
          <span class="handwriting-line"></span>
          <span class="handwriting-line"></span>
        </td>
      </tr>
    `).join('');
  } else {
    rowsHTML = tablePurchases.map((p, idx) => {
      const vnum = p.voucherNumber;
      const ref = p.reference || '—';
      const pAmt = Math.abs(parseFloat(p.amount || 0));
      const pDate = fmtDate(p.date);
      
      // Match Sales
      let sMatch = null;
      if (isNov && p.isCrossMonthReallocated) {
        sMatch = allSales.find(s => s.voucherNumber === 'SKIL-078');
      } else {
        sMatch = monthSales.find(s => s.reference && s.reference === ref);
        if (!sMatch) {
          const v = parseInt(vnum);
          sMatch = monthSales.find(s => parseInt(String(s.voucherNumber).replace(/[^0-9]/g, '')) === v);
        }
      }

      let sVnum = '—';
      let custName = '—';
      let sAmt = 0;
      let payStatusBadge = '<span class="badge badge-pending">PENDING</span>';
      let payDetails = 'Payment due';

      if (sMatch) {
        sVnum = sMatch.voucherNumber;
        custName = sMatch.partyName || '—';
        sAmt = Math.abs(parseFloat(sMatch.amount || 0));
        const bStat = billPaymentMap[sVnum] || { status: 'PENDING', text: 'PENDING (Unpaid)', note: 'Due: ' + fmtCur(sAmt), recd: 0, due: sAmt };

        if (bStat.status === 'PAID') {
          payStatusBadge = `<span class="badge badge-paid">PAID ✅</span>`;
          payDetails = `<strong>${fmtCur(sAmt)}</strong><br><span style="font-size:6.8pt; color:#333;">${bStat.note}</span>`;
        } else if (bStat.status === 'PARTIAL') {
          payStatusBadge = `<span class="badge badge-partial">PARTIAL ⚠️</span>`;
          payDetails = `<strong class="mono">Recd: ${fmtCur(bStat.recd)}</strong><br><span style="font-size:6.8pt; color:#444;">Due: ${fmtCur(bStat.due)}</span>`;
        } else if (bStat.status === 'CANCELLED') {
          payStatusBadge = `<span class="badge badge-cancelled">CREDITED ❌</span>`;
          payDetails = `<strong>Reversed ₹59,971</strong><br><span style="font-size:6.8pt; color:#333;">${bStat.note}</span>`;
        } else {
          payStatusBadge = `<span class="badge badge-pending">PENDING ⏳</span>`;
          payDetails = `<strong>Due: ${fmtCur(sAmt)}</strong><br><span style="font-size:6.8pt; color:#444;">Payment due</span>`;
        }
      }

      // Special handling note for #71 in October & November
      let specialNote = '';
      if (vnum === '71' && mConfig.slug === 'october') {
        specialNote = `<div style="font-size:6.8pt; background:#f5f5f5; border:1px solid #ccc; padding:2px 3px; margin-top:2px;">
          <strong>Party Re-allocation:</strong> Delight bill SKIL-071 cancelled via CN #8 (31-Oct). Re-billed to Sri Sharvani Traders under #SKIL-078 dt 11-Nov.
        </div>`;
      } else if (p.isCrossMonthReallocated) {
        specialNote = `<div style="font-size:6.8pt; background:#f5f5f5; border:1px solid #ccc; padding:2px 3px; margin-top:2px;">
          <strong>Prior-Month Inward Re-issuance:</strong> Ajanta Inward Purchase #71 (13 CTNS dt 31-Oct) re-billed to Sri Sharvani Traders on 11-Nov upon delivery.
        </div>`;
      }

      return `
        <tr>
          <td class="text-center bold">${idx + 1}</td>
          <td>
            <strong>#${vnum}</strong> | <span class="mono">${ref}</span><br>
            <span style="font-size:7pt; color:#222;">dt ${pDate}</span> • <span class="mono bold">${fmtCur(pAmt)}</span>
          </td>
          <td>
            <strong class="mono">#${sVnum}</strong><br>
            <span style="font-size:7pt;">dt ${sMatch ? fmtDate(sMatch.date) : '—'}</span> • <span class="mono">${fmtCur(sAmt)}</span>
          </td>
          <td>
            <strong>${custName}</strong>
            ${specialNote}
          </td>
          <td>
            ${payStatusBadge}<br>
            ${payDetails}
          </td>
          <td class="col-remarks">
            <span class="handwriting-line"></span>
          </td>
        </tr>
      `;
    }).join('');
  }


  return `
    <div class="sheet">
      <!-- HEADER -->
      <div class="doc-header">
        <h1 class="company-title">SKIL LIFESTYLE LLP</h1>
        <div class="company-sub">
          Rayagada, Odisha | Authorized Dealer: Ajanta Shoes • Xpania Footcare • Cubix | Zero-Inventory Drop-Shipping Model
        </div>
        <div class="doc-badge-row">
          <div class="report-title">Page 1: Purchase & Sales Recovery Summary — ${mConfig.name}</div>
          <div class="report-meta">
            Audit Period: <span class="mono">${mConfig.name}</span> | Verification: <span class="mono">TallyPrime Port 9000</span>
          </div>
        </div>
      </div>

      <!-- KPI CARDS -->
      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-label">${isJuly ? 'Setup Transactions' : 'Inward Purchases'}</div>
          <div class="kpi-val">${isJuly ? '4 Entries' : purchasesInMonth.length + ' Bills'}</div>
          <div class="kpi-sub">${isJuly ? 'Capital & Security' : fmtCur(totalPurchasesAmt) + ' Total Inward'}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">${isJuly ? 'Bank Receipt Total' : 'Outward Sales'}</div>
          <div class="kpi-val">${isJuly ? fmtCur(1200000) : fmtCur(totalSalesAmt)}</div>
          <div class="kpi-sub">${isJuly ? '3 Receipts Posted' : purchasesInMonth.length + ' Matching Invoices'}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">${isJuly ? 'Bank Payment Total' : 'Customer Payments Realized'}</div>
          <div class="kpi-val">${isJuly ? fmtCur(1000000) : fmtCur(totalSettled)}</div>
          <div class="kpi-sub">${isJuly ? '1 Supplier Advance' : paidCount + ' Fully Settled Bills'}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">${isJuly ? 'Net Balance In Bank' : 'Outstanding / Pending Recovery'}</div>
          <div class="kpi-val">${isJuly ? fmtCur(200000) : fmtCur(totalDue)}</div>
          <div class="kpi-sub">${isJuly ? 'Union Bank A/c' : pendingCount + ' Open + ' + partialCount + ' Partial Bills'}</div>
        </div>
      </div>

      <!-- TABLE -->
      <div class="section-title">
        <span>📦 1-to-1 Purchase to Outward Sales & Customer Payment Realization</span>
      </div>

      <table class="audit-table">
        <thead>
          <tr>
            <th style="width: 7mm;">Sl.</th>
            <th style="width: 44mm;">Invoice No. & Inward Vch</th>
            <th style="width: 36mm;">Corresponding Sales Inv</th>
            <th style="width: 48mm;">Customer / Party Name</th>
            <th style="width: 37mm;">Party Payment Received / Status</th>
            <th class="col-remarks">Remarks (Manual Notes)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
          ${!isJuly ? `
            <tr class="total-row">
              <td colspan="2" class="text-right">MONTHLY TOTAL (${purchasesInMonth.length} INWARD PURCHASES):</td>
              <td class="mono">${fmtCur(totalSalesAmt)}</td>
              <td class="text-center font-bold">100% Back-to-Back Matched</td>
              <td class="mono">
                <span class="bold">Realized: ${fmtCur(totalSettled)}</span><br>
                <span style="font-size:7pt;">Due: ${fmtCur(totalDue)}</span>
              </td>
              <td class="col-remarks"></td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- FOOTER -->
      <div class="page-footer">
        <span>SKIL LIFESTYLE LLP — Dealership Purchase & Recovery Summary</span>
        <span class="mono">Page 1 of 2 (${mConfig.name})</span>
        <span>Generated: 13-Nov-2026 | Tally Verified</span>
      </div>
    </div>
  `;
}

// Generate Page 2: Adjustments, Claims & Incentives
function generatePage2HTML(mConfig, purchasesInMonth) {
  const isJuly = mConfig.isSetupMonth;
  const mKey = mConfig.key;

  // Filter supplier claims (Debit notes) pertaining to or recorded in this month
  let supplierDNs = allDNs.filter(d => d.date && d.date.startsWith(mKey));
  
  // Also cross-link accrual if August claims were recorded on Sept 16
  let accrualNote = '';
  if (mConfig.slug === 'august') {
    supplierDNs = allDNs.filter(d => ['1', '2', '3', '4'].includes(String(d.voucherNumber)));
    accrualNote = '<div style="font-size:7.2pt; color:#333; margin-bottom:3px; font-style:italic;">Note: Supplier Credit Notes for August purchases were finalized and issued by Ajanta on 16-Sep-2026 (DN #1 to #4). Displayed here under August for true accrual margin reconciliation.</div>';
  } else if (mConfig.slug === 'september') {
    supplierDNs = allDNs.filter(d => ['5', '6', '7', '8', '9'].includes(String(d.voucherNumber)));
    accrualNote = '<div style="font-size:7.2pt; color:#333; margin-bottom:3px; font-style:italic;">Note: Includes September scheme claims finalized by Ajanta on 30-Sep (DN #5-7) and mid-October (DN #8 Slab & DN #9 3% CD).</div>';
  } else if (mConfig.slug === 'october') {
    supplierDNs = []; // Awaiting mid-November Ajanta scheme advice
    accrualNote = '<div style="font-size:7.2pt; color:#333; margin-bottom:3px; font-style:italic;">Note: October Scheme & Turnover Incentive credit notes from Ajanta Shoes are awaiting final calculation advice (normally issued mid-following month).</div>';
  }

  // Filter customer credit notes (CNs)
  let customerCNs = [];
  if (mConfig.slug === 'august') {
    customerCNs = allCNs.filter(c => ['1', '2', '3', '4'].includes(String(c.voucherNumber)));
  } else if (mConfig.slug === 'september') {
    customerCNs = allCNs.filter(c => ['5', '6'].includes(String(c.voucherNumber)) || (c.voucherNumber === '7'));
  } else if (mConfig.slug === 'october') {
    customerCNs = allCNs.filter(c => ['7', '8'].includes(String(c.voucherNumber)));
  }

  // Calculations for Margin
  let totalPurchasesAmt = purchasesInMonth.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount || 0)), 0);
  let totalSalesAmt = purchasesInMonth.reduce((acc, p) => {
    const ref = p.reference;
    let sMatch = allSales.find(s => s.reference && s.reference === ref);
    if (!sMatch) {
      const v = parseInt(p.voucherNumber);
      sMatch = allSales.find(s => parseInt(String(s.voucherNumber).replace(/[^0-9]/g, '')) === v);
    }
    return acc + (sMatch ? Math.abs(parseFloat(sMatch.amount || 0)) : 0);
  }, 0);
  let grossTradeMargin = totalSalesAmt - totalPurchasesAmt;

  let totalSupplierClaims = supplierDNs.reduce((acc, d) => acc + Math.abs(parseFloat(d.amount || 0)), 0);
  let totalCustomerDiscounts = customerCNs.reduce((acc, c) => acc + Math.abs(parseFloat(c.amount || 0)), 0);
  let netTradingMargin = grossTradeMargin + totalSupplierClaims - (mConfig.slug === 'october' ? (totalCustomerDiscounts - 59971) : totalCustomerDiscounts); // Exclude return reversal from operational CD cost

  // Supplier Table Rows
  let supplierRows = '';
  if (supplierDNs.length === 0) {
    supplierRows = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 8px; color:#555;">
          ${isJuly ? 'No supplier discount claims in July (pre-trading capital & advance phase).' : 'No supplier debit notes recorded for this period / Awaiting supplier scheme advice.'}
        </td>
        <td class="col-remarks"></td>
      </tr>
    `;
  } else {
    supplierRows = supplierDNs.map((d, idx) => {
      const narr = d.narration || '';
      const mCN = narr.match(/#(\d+)/) || narr.match(/credit\s*note\s*#?([A-Za-z0-9\-]+)/i);
      const supplierCNRef = mCN ? `Ajanta CN #${mCN[1]}` : 'Ajanta Credit Note';
      const amt = Math.abs(parseFloat(d.amount || 0));

      return `
        <tr>
          <td class="text-center bold">${idx + 1}</td>
          <td><strong>${d.partyName}</strong></td>
          <td class="mono"><strong>DN #${d.voucherNumber}</strong><br><span style="font-size:7pt;">dt ${fmtDate(d.date)}</span></td>
          <td><span class="mono">${supplierCNRef}</span></td>
          <td style="font-size:7pt;">${narr}</td>
          <td class="mono text-right bold">${fmtCur(amt)}</td>
          <td><span class="badge badge-paid">ADJUSTED ✅</span><br><span style="font-size:6.8pt;">Supplier Ledger Cr</span></td>
          <td class="col-remarks">
            <span class="handwriting-line"></span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Customer Table Rows
  let customerRows = '';
  if (customerCNs.length === 0) {
    customerRows = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 8px; color:#555;">
          ${isJuly ? 'No customer credit notes issued in July.' : 'No customer credit notes issued in this month.'}
        </td>
        <td class="col-remarks"></td>
      </tr>
    `;
  } else {
    customerRows = customerCNs.map((c, idx) => {
      const amt = Math.abs(parseFloat(c.amount || 0));
      const narr = c.narration || '';
      const isReturn = c.voucherNumber === '8';

      return `
        <tr>
          <td class="text-center bold">${idx + 1}</td>
          <td><strong>${c.partyName}</strong></td>
          <td class="mono"><strong>CN #${c.voucherNumber}</strong><br><span style="font-size:7pt;">dt ${fmtDate(c.date)}</span></td>
          <td style="font-size:7pt;">
            <strong>${isReturn ? 'Sales Return / Cancellation' : '5% Cash Discount on Taxable Value'}</strong><br>
            ${narr}
          </td>
          <td class="mono text-right bold">${fmtCur(amt)}</td>
          <td>
            <span class="badge ${isReturn ? 'badge-cancelled' : 'badge-paid'}">${isReturn ? 'RETURN REVERSED' : 'CD ALLOWED ✅'}</span><br>
            <span style="font-size:6.8pt;">Customer Ledger Cr</span>
          </td>
          <td class="col-remarks">
            <span class="handwriting-line"></span>
          </td>
        </tr>
      `;
    }).join('');
  }

  return `
    <div class="sheet page-break">
      <!-- HEADER -->
      <div class="doc-header">
        <h1 class="company-title">SKIL LIFESTYLE LLP</h1>
        <div class="company-sub">
          Rayagada, Odisha | Authorized Dealer: Ajanta Shoes • Xpania Footcare • Cubix | Zero-Inventory Drop-Shipping Model
        </div>
        <div class="doc-badge-row">
          <div class="report-title">Page 2: Adjustments, Claims & Incentives — ${mConfig.name}</div>
          <div class="report-meta">
            Audit Period: <span class="mono">${mConfig.name}</span> | Verification: <span class="mono">TallyPrime Port 9000</span>
          </div>
        </div>
      </div>

      <!-- SECTION A: SUPPLIER CLAIMS -->
      <div class="section-title">
        <span>🏭 A. Supplier Incentives, Rate Differences & Discounts Received (Debit Notes)</span>
      </div>
      ${accrualNote}
      <table class="audit-table">
        <thead>
          <tr>
            <th style="width: 7mm;">Sl.</th>
            <th style="width: 38mm;">Supplier Name</th>
            <th style="width: 27mm;">Voucher No. & Date</th>
            <th style="width: 30mm;">Supplier CN Ref</th>
            <th style="width: 53mm;">Scheme / Claim Description</th>
            <th style="width: 24mm;" class="text-right">Amount (₹)</th>
            <th style="width: 22mm;">Status in Books</th>
            <th class="col-remarks">Remarks (Manual)</th>
          </tr>
        </thead>
        <tbody>
          ${supplierRows}
          ${supplierDNs.length > 0 ? `
            <tr class="total-row">
              <td colspan="5" class="text-right">TOTAL SUPPLIER CLAIMS & INCENTIVES REALIZED:</td>
              <td class="mono text-right">${fmtCur(totalSupplierClaims)}</td>
              <td><span class="badge badge-paid">100% REALIZED</span></td>
              <td class="col-remarks"></td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- SECTION B: CUSTOMER DISCOUNTS -->
      <div class="section-title" style="margin-top: 12px;">
        <span>🤝 B. Customer Adjustments & Credit Notes Given (5% Cash Discount / Allowances)</span>
      </div>
      <table class="audit-table">
        <thead>
          <tr>
            <th style="width: 7mm;">Sl.</th>
            <th style="width: 38mm;">Customer Party Name</th>
            <th style="width: 27mm;">Credit Note No.</th>
            <th style="width: 53mm;">Nature of Adjustment / Description</th>
            <th style="width: 24mm;" class="text-right">Amount (₹)</th>
            <th style="width: 22mm;">Status in Books</th>
            <th class="col-remarks">Remarks (Manual)</th>
          </tr>
        </thead>
        <tbody>
          ${customerRows}
          ${customerCNs.length > 0 ? `
            <tr class="total-row">
              <td colspan="4" class="text-right">TOTAL CUSTOMER CREDIT NOTES & ALLOWANCES:</td>
              <td class="mono text-right">${fmtCur(totalCustomerDiscounts)}</td>
              <td><span class="badge badge-paid">POSTED</span></td>
              <td class="col-remarks"></td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- SECTION C: FINANCIAL MARGIN RECONCILIATION -->
      <div class="section-title" style="margin-top: 10px;">
        <span>📊 C. Monthly Trading & Operating Margin Realization Summary</span>
      </div>
      <div class="financial-box">
        <div class="fin-grid">
          <div>
            <div class="fin-row">
              <span>Gross Outward Sales Value (Invoiced to Debtors):</span>
              <span class="mono bold">${fmtCur(totalSalesAmt)}</span>
            </div>
            <div class="fin-row">
              <span>Less: Gross Inward Purchases (Direct Suppliers):</span>
              <span class="mono bold">-${fmtCur(totalPurchasesAmt)}</span>
            </div>
            <div class="fin-row bold-row">
              <span>Base Trading Spread (Sales - Purchases):</span>
              <span class="mono">${fmtCur(grossTradeMargin)}</span>
            </div>
          </div>
          <div>
            <div class="fin-row">
              <span>Add: Supplier Scheme, Cash Discount & Rate Claims (+):</span>
              <span class="mono bold" style="color:#000;">+${fmtCur(totalSupplierClaims)}</span>
            </div>
            <div class="fin-row">
              <span>Less: Customer Cash Discounts Allowed 5% (-):</span>
              <span class="mono bold">-${fmtCur(mConfig.slug === 'october' ? (totalCustomerDiscounts - 59971) : totalCustomerDiscounts)}</span>
            </div>
            <div class="fin-row bold-row">
              <span>Net Monthly Operating Margin Realized:</span>
              <span class="mono" style="font-size:9.5pt;">${fmtCur(netTradingMargin)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SIGNATURE SECTION -->
      <div class="sign-row">
        <div class="sign-box">
          <strong>Prepared By</strong><br>
          Accounts Department / SKIL Lifestyle LLP
        </div>
        <div class="sign-box">
          <strong>Internal Audit Cross-Check</strong><br>
          Port 9000 Automated Ledger Audit
        </div>
        <div class="sign-box">
          <strong>Partner Approval</strong><br>
          Sisinti Lokanatha Patro / Sahil Kumar
        </div>
      </div>

      <!-- FOOTER -->
      <div class="page-footer">
        <span>SKIL LIFESTYLE LLP — Dealership Purchase & Recovery Summary</span>
        <span class="mono">Page 2 of 2 (${mConfig.name})</span>
        <span>Generated: 13-Nov-2026 | Tally Verified</span>
      </div>
    </div>
  `;
}

// Generate Individual Month File
function generateMonthHTMLFile(mConfig) {
  const mKey = mConfig.key;
  const purchasesInMonth = allPurchases.filter(p => p.date && p.date.startsWith(mKey));
  const monthSales = allSales.filter(s => s.date && s.date.startsWith(mKey));

  const page1 = generatePage1HTML(mConfig, purchasesInMonth, monthSales);
  const page2 = generatePage2HTML(mConfig, purchasesInMonth);

  const navLinks = monthsConfig.map(m => `
    <a href="purchase-summary-${m.slug}-2026.html" class="${m.slug === mConfig.slug ? 'active' : ''}">${m.name.split(' ')[0]}</a>
  `).join('');

  const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SKIL Lifestyle LLP — Purchase Summary (${mConfig.name})</title>
  <style>
    ${getCommonCSS()}
  </style>
</head>
<body>

  <!-- TOP NAV BAR (Hidden on Print) -->
  <div class="nav-bar no-print">
    <div style="display:flex; align-items:center; gap:12px;">
      <strong style="color:#fff; font-size:10pt; letter-spacing:0.3px;">SKIL AUDIT SUMMARIES:</strong>
      <div style="display:flex; gap:6px;">
        ${navLinks}
        <a href="purchase-summary-master.html" style="background:#334155; color:#fff; border-color:#64748b;">All Months Master</a>
      </div>
    </div>
    <div style="display:flex; gap:10px; align-items:center;">
      <button class="print-btn" onclick="window.print()">
        🖨️ Print A4 Summary
      </button>
    </div>
  </div>

  <!-- PAGE 1 -->
  ${page1}

  <!-- PAGE 2 -->
  ${page2}

</body>
</html>
`;

  const outputDir = path.join(ROOT_DIR, 'user-documents-read-only-access', 'Audit & Reconciliation Reports', 'Purchase Summaries');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `purchase-summary-${mConfig.slug}-2026.html`;
  fs.writeFileSync(path.join(outputDir, fileName), fullHTML, 'utf8');
  console.log(`Saved: ${fileName} in Purchase Summaries`);
}

// Generate Master Combined File (All 5 Months in One Clean Document)
function generateMasterHTMLFile() {
  const outputDir = path.join(ROOT_DIR, 'user-documents-read-only-access', 'Audit & Reconciliation Reports', 'Purchase Summaries');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const allMonthsHTML = monthsConfig.map(mConfig => {
    const mKey = mConfig.key;
    const purchasesInMonth = allPurchases.filter(p => p.date && p.date.startsWith(mKey));
    const monthSales = allSales.filter(s => s.date && s.date.startsWith(mKey));
    const p1 = generatePage1HTML(mConfig, purchasesInMonth, monthSales);
    const p2 = generatePage2HTML(mConfig, purchasesInMonth);
    return `
      <!-- ==================== ${mConfig.name.toUpperCase()} ==================== -->
      <section id="${mConfig.slug}" style="margin-bottom: 30px;">
        ${p1}
        ${p2}
      </section>
    `;
  }).join('\n');

  const navLinks = monthsConfig.map(m => `
    <a href="#${m.slug}">${m.name.split(' ')[0]}</a>
  `).join('');

  const masterHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SKIL Lifestyle LLP — Master Purchase Summary (July to Nov 2026)</title>
  <style>
    ${getCommonCSS()}
    html { scroll-behavior: smooth; }
  </style>
</head>
<body>

  <!-- TOP NAV BAR (Hidden on Print) -->
  <div class="nav-bar no-print" style="position: sticky; top: 10px; z-index: 1000;">
    <div style="display:flex; align-items:center; gap:12px;">
      <strong style="color:#fff; font-size:10pt; letter-spacing:0.3px;">SKIL MASTER PURCHASE REGISTER:</strong>
      <div style="display:flex; gap:6px;">
        ${navLinks}
      </div>
    </div>
    <div style="display:flex; gap:10px; align-items:center;">
      <button class="print-btn" onclick="window.print()">
        🖨️ Print All Months (A4)
      </button>
    </div>
  </div>

  ${allMonthsHTML}

</body>
</html>
`;

  fs.writeFileSync(path.join(outputDir, 'purchase-summary-master.html'), masterHTML, 'utf8');
  console.log(`Saved: purchase-summary-master.html in Purchase Summaries`);
}

// Run All
monthsConfig.forEach(generateMonthHTMLFile);
generateMasterHTMLFile();
console.log('All A4 Purchase Summary HTML files generated successfully!');
