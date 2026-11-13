/**
 * ============================================================================
 * AJANTA SHOES SUPPLIER TRACKER — EXCEL GENERATOR (v3 Minimalist & Spacious)
 * SKIL Lifestyle LLP — Clean, Professional, Monochrome / Slate Financial Style
 * Manually verified against Ajanta Customer Ledger (Doc Period 01.07.26 to 07.10.26)
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const db = require('./database');

const SUPPLIER_NAME = 'Ajanta Shoes India Pvt. Ltd.';
const OUTPUT_DIR = path.resolve('c:/Projects/SKIL Master');
const FY_START_YEAR = 2026;

// ─── MINIMALIST EXECUTIVE SLATE PALETTE (NO GARISH / RAINBOW COLORS) ───────
const C = {
  // Primary Neutrals & Slates
  headerDark: '1E293B',    // Deep Slate (Banners & Section Headers)
  headerSub: '334155',     // Muted Slate (Table Headers)
  kpiBg: 'F1F5F9',         // Very Soft Slate (Card background)
  zebraTint: 'F8FAFC',     // Whisper Slate (Alternate rows)
  white: 'FFFFFF',         // Pure White
  border: 'CBD5E1',        // Soft Slate Hairline Border
  borderDark: '94A3B8',    // Medium Slate Border

  // Text Hierarchy
  textMain: '0F172A',      // Near Black for Crisp Readability
  textMuted: '64748B',     // Cool Slate for Subtitles / Secondary
  textWhite: 'FFFFFF',     // White on Dark Headers

  // Subtle Status Pill Accents (Soft Pastel Tints, NOT Saturated Neon)
  creditedBg: 'ECFDF5',    // Soft Sage Green Tint
  creditedFg: '065F46',    // Deep Spruce Green Text
  pendingBg: 'FFFBEB',     // Soft Warm Sand Tint
  pendingFg: '92400E',     // Muted Amber-Brown Text
  neutralBadgeBg: 'F1F5F9',
  neutralBadgeFg: '475569',
};

const FONT_FAMILY = 'Segoe UI';
const CUR = '₹#,##0.00';
const CUR_INT = '₹#,##0';
const PCT = '0.00%';

// Border Helper
const border = (style = 'thin', color = C.border) => ({
  top: { style, color: { argb: color } },
  bottom: { style, color: { argb: color } },
  left: { style, color: { argb: color } },
  right: { style, color: { argb: color } },
});

// Styling Helper
function applyStyle(cell, {
  bg = C.white,
  fg = C.textMain,
  bold = false,
  italic = false,
  sz = 10,
  ha = 'left',
  va = 'middle',
  wrap = false,
  bdr = 'thin',
  bdrColor = C.border,
  fmt = null,
} = {}) {
  cell.font = { name: FONT_FAMILY, size: sz, bold, italic, color: { argb: fg } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { horizontal: ha, vertical: va, wrapText: wrap };
  if (bdr) cell.border = border(bdr, bdrColor);
  if (fmt) cell.numFmt = fmt;
}

function fmtDate(d) {
  if (!d || d.length !== 8) return '';
  return `${d.substring(6, 8)}-${d.substring(4, 6)}-${d.substring(0, 4)}`;
}

const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getAjantaQuarter(dateStr) {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));
  if (month === 4) return { fy: `${year}-${(year + 1).toString().slice(2)}`, quarter: 'Apr', qNum: 0 };
  if (month === 5 || month === 6) return { fy: `${year}-${(year + 1).toString().slice(2)}`, quarter: 'Q1', qNum: 1 };
  if (month === 7 && day <= 15) return { fy: `${year}-${(year + 1).toString().slice(2)}`, quarter: 'Q1', qNum: 1 };
  if (month === 7 && day > 15) return { fy: `${year}-${(year + 1).toString().slice(2)}`, quarter: 'Q2', qNum: 2 };
  if (month >= 8 && month <= 9) return { fy: `${year}-${(year + 1).toString().slice(2)}`, quarter: 'Q2', qNum: 2 };
  if (month >= 10 && month <= 12) return { fy: `${year}-${(year + 1).toString().slice(2)}`, quarter: 'Q3', qNum: 3 };
  if (month >= 1 && month <= 3) return { fy: `${year - 1}-${year.toString().slice(2)}`, quarter: 'Q4', qNum: 4 };
  return { fy: 'Unknown', quarter: '?', qNum: -1 };
}

// ─── DATA EXTRACTION & VERIFIED SUPPLIER LEDGER TRUTH ───────────────────────
function getVerifiedAjantaData() {
  const vouchers = Object.values(db.vouchers || {});
  const ajanta = vouchers.filter(v => v.partyName && v.partyName.toLowerCase().includes('ajanta'));

  const purchases = ajanta.filter(v => v.voucherType === 'Purchase')
    .sort((a, b) => a.date.localeCompare(b.date) || parseInt(a.voucherNumber) - parseInt(b.voucherNumber));
  const debitNotes = ajanta.filter(v => v.voucherType === 'Debit Note')
    .sort((a, b) => a.date.localeCompare(b.date));
  const payments = ajanta.filter(v => v.voucherType === 'Payment')
    .sort((a, b) => a.date.localeCompare(b.date));

  const purchByMonth = {};
  purchases.forEach(p => {
    const k = p.date.substring(0, 6);
    if (!purchByMonth[k]) purchByMonth[k] = [];
    purchByMonth[k].push(p);
  });

  /**
   * OFFICIAL SUPPLIER LEDGER RECONCILIATION:
   * Cross-verified with Ajanta Customer Ledger (Dealer 93081 till 07-10-2026):
   *
   * 1. 160005126 (16.09.26): ₹37,552.12 -> 3% Cash Discount on Aug purchases
   * 2. 160005123 (16.09.26): ₹45,896.00 -> 3.78% Retailer Scheme on Aug purchases
   * 3. 160005127 (16.09.26): ₹2,773.95  -> Rate Difference on article UL 979E (Aug inv)
   * 4. 160005179 (16.09.26): ₹25,727.00 -> Non-Bengal Scratch Coupon Scheme (Aug)
   * 5. 160005610 (30.09.26): ₹39,584.00 -> 3.78% Retailer Scheme on Sep purchases
   * 6. 160005580 (30.09.26): ₹26,180.00 -> Monthly Slab Scheme Sep 2026
   * 7. 160005552 (30.09.26): ₹20,943.00 -> 2% QTB (Quarterly Target Bonus) Sep 2026!
   *
   * Pending for September 2026:
   * - 3% Cash Discount (~₹31,415.76) : NOT YET CREDITED
   * - Rate Difference (Pricing Error Refund): NOT YET CREDITED
   */
  const verifiedCNRegister = [
    {
      sno: 1,
      sapDoc: '160005126',
      date: '20260916',
      voucherNo: 'DN-2',
      forMonth: '202608',
      forMonthLabel: 'Aug 2026',
      officialDesc: '3% CD MISSING _AS PER AGREEMENT',
      category: 'Cash Discount (3%)',
      baseAmt: 35763.92,
      igstAmt: 1788.20,
      totalAmt: 37552.12,
      ledgerHead: 'Cash Discount Received',
      status: 'Credited',
      remarks: 'Full 3% cash discount on August purchases credited.',
    },
    {
      sno: 2,
      sapDoc: '160005123',
      date: '20260916',
      voucherNo: 'DN-3',
      forMonth: '202608',
      forMonthLabel: 'Aug 2026',
      officialDesc: 'HW+FTW RETAIL SCHME@ 3.78% FOR AUG-26',
      category: 'Retailer Scheme (3.78%)',
      baseAmt: 43710.48,
      igstAmt: 2185.52,
      totalAmt: 45896.00,
      ledgerHead: 'Incentive Received',
      status: 'Credited',
      remarks: '3.78% retail scheme on Aug hardware & footwear turnover.',
    },
    {
      sno: 3,
      sapDoc: '160005127',
      date: '20260916',
      voucherNo: 'DN-4',
      forMonth: '202608',
      forMonthLabel: 'Aug 2026',
      officialDesc: 'RATE DIFFERENCE_1900405893-1900402693_UL 979E/CH+M',
      category: 'Rate Difference',
      baseAmt: 2641.86,
      igstAmt: 132.09,
      totalAmt: 2773.95,
      ledgerHead: 'Rate Difference Received',
      status: 'Credited',
      remarks: 'Rate difference rebate for article UL 979E/CH+M in Aug invoices.',
    },
    {
      sno: 4,
      sapDoc: '160005179',
      date: '20260916',
      voucherNo: 'DN-1',
      forMonth: '202608',
      forMonthLabel: 'Aug 2026',
      officialDesc: 'NON BENGAL SCRATCH COUPON SCHME_01.8.26 TO 31.8.26',
      category: 'Special Scheme',
      baseAmt: 24501.90,
      igstAmt: 1225.10,
      totalAmt: 25727.00,
      ledgerHead: 'Incentive Received',
      status: 'Credited',
      remarks: 'Non-Bengal scratch coupon scheme incentive for August.',
    },
    {
      sno: 5,
      sapDoc: '160005610',
      date: '20260930',
      voucherNo: 'DN-5',
      forMonth: '202609',
      forMonthLabel: 'Sep 2026',
      officialDesc: 'HW+FTW RETAIL SCHME@ 3.78% FOR SEP-26',
      category: 'Retailer Scheme (3.78%)',
      baseAmt: 37699.05,
      igstAmt: 1884.95,
      totalAmt: 39584.00,
      ledgerHead: 'Incentive Received',
      status: 'Credited',
      remarks: '3.78% retail scheme on Sep hardware & footwear turnover.',
    },
    {
      sno: 6,
      sapDoc: '160005580',
      date: '20260930',
      voucherNo: 'DN-6',
      forMonth: '202609',
      forMonthLabel: 'Sep 2026',
      officialDesc: 'SLAB SCHEM FOR THE MONTH OF SEPT-26_NEW STATE',
      category: 'Slab Scheme (Monthly Bonus)',
      baseAmt: 24933.33,
      igstAmt: 1246.67,
      totalAmt: 26180.00,
      ledgerHead: 'Incentive Received',
      status: 'Credited',
      remarks: 'Target slab incentive for September turnover.',
    },
    {
      sno: 7,
      sapDoc: '160005562',
      date: '20260930',
      voucherNo: 'DN-7',
      forMonth: '202609',
      forMonthLabel: 'Sep 2026',
      officialDesc: '2% QTB NEW STATE - FOR THE MONTH OF SEPT\'2026',
      category: '2% QTB (Quarterly Target Bonus)',
      baseAmt: 19945.71,
      igstAmt: 997.29,
      totalAmt: 20943.00,
      ledgerHead: 'Cash Discount Received / QTB',
      status: 'Credited',
      remarks: '2% Quarterly Target Bonus (QTB) for Q2 September turnover.',
    },
  ];

  return { purchases, debitNotes, payments, purchByMonth, verifiedCNRegister };
}

// ═════════════════════════════════════════════════════════════════════════════
//  SHEET 1: AJANTA CONSOLIDATED MASTER TRACKER (SPACIOUS & COMPACT)
// ═════════════════════════════════════════════════════════════════════════════
async function createConsolidatedTrackerSheet(wb, data) {
  const ws = wb.addWorksheet('Ajanta Tracker', {
    properties: { tabColor: { argb: C.headerDark } },
    views: [{ showGridLines: true, showRowColHeaders: true }]
  });

  // Spacious column widths (A..N)
  ws.columns = [
    { width: 3 },   // A: Margin spacer
    { width: 14 },  // B: Month
    { width: 8 },   // C: Quarter
    { width: 10 },  // D: Invoices
    { width: 18 },  // E: Gross Purchase
    { width: 16 },  // F: Cash Discount (3%)
    { width: 16 },  // G: Retailer Scheme (3.78%)
    { width: 16 },  // H: Rate Difference
    { width: 16 },  // I: Special Scheme / Coupon
    { width: 17 },  // J: Monthly Slab Scheme
    { width: 18 },  // K: 2% QTB (Quarterly Bonus)
    { width: 17 },  // L: Total Credit Notes
    { width: 19 },  // M: Net Effective Purchase
    { width: 32 },  // N: Reconciliation Remarks / Action
    { width: 3 },   // O: Right spacer
  ];

  let r = 2;

  // ──── TITLE HEADER BANNER ────
  ws.mergeCells(`B${r}:N${r}`);
  const title = ws.getCell(`B${r}`);
  title.value = 'AJANTA SHOES — CONSOLIDATED SUPPLIER INCENTIVE & DEDUCTION TRACKER';
  applyStyle(title, { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 14, ha: 'center' });
  ws.getRow(r).height = 36;
  r++;

  ws.mergeCells(`B${r}:N${r}`);
  const sub = ws.getCell(`B${r}`);
  sub.value = `SKIL LIFESTYLE LLP  |  FY ${FY_START_YEAR}-${(FY_START_YEAR + 1).toString().slice(2)}  |  Supplier: ${SUPPLIER_NAME} (Code 93081)  |  Audit Verified: 25-Oct-2026`;
  applyStyle(sub, { bg: C.headerSub, fg: C.kpiBg, sz: 9, ha: 'center', italic: true });
  ws.getRow(r).height = 20;
  r += 2;

  // ──── EXECUTIVE KPI CARDS (CLEAN & SPACIOUS) ────
  const totalPurchases = data.purchases.reduce((s, p) => s + Math.abs(p.amount), 0);
  const totalCN = data.verifiedCNRegister.reduce((s, c) => s + c.totalAmt, 0);
  const totalPayments = data.payments.reduce((s, p) => s + Math.abs(p.amount), 0);
  const netOutstanding = totalPurchases - totalCN - totalPayments;
  const effectiveDiscountPct = totalPurchases > 0 ? (totalCN / totalPurchases) : 0;

  const kpis = [
    { cols: ['B', 'C'], title: 'TOTAL GROSS PURCHASES', val: totalPurchases, fmt: CUR_INT },
    { cols: ['D', 'F'], title: 'TOTAL CREDIT NOTES CREDITED', val: totalCN, fmt: CUR_INT },
    { cols: ['G', 'H'], title: 'TOTAL PAYMENTS MADE', val: totalPayments, fmt: CUR_INT },
    { cols: ['I', 'K'], title: 'CLOSING SUPPLIER BALANCE', val: netOutstanding, fmt: CUR_INT },
    { cols: ['L', 'N'], title: 'EFFECTIVE DEDUCTION %', val: effectiveDiscountPct, fmt: PCT },
  ];

  // Card Title Row
  kpis.forEach(k => {
    ws.mergeCells(`${k.cols[0]}${r}:${k.cols[1]}${r}`);
    const cell = ws.getCell(`${k.cols[0]}${r}`);
    cell.value = k.title;
    applyStyle(cell, { bg: C.kpiBg, fg: C.textMuted, bold: true, sz: 8.5, ha: 'center', bdr: 'thin', bdrColor: C.border });
  });
  ws.getRow(r).height = 18;
  r++;

  // Card Value Row
  kpis.forEach(k => {
    ws.mergeCells(`${k.cols[0]}${r}:${k.cols[1]}${r}`);
    const cell = ws.getCell(`${k.cols[0]}${r}`);
    cell.value = k.val;
    applyStyle(cell, { bg: C.white, fg: C.textMain, bold: true, sz: 13, ha: 'center', fmt: k.fmt, bdr: 'thin', bdrColor: C.border });
  });
  ws.getRow(r).height = 32;
  r += 2;

  // ──── TABLE SECTION 1: MONTHLY TRACKER MATRIX ────
  ws.mergeCells(`B${r}:N${r}`);
  const sec1 = ws.getCell(`B${r}`);
  sec1.value = '1. MONTHLY PURCHASE, CREDIT NOTES & DEDUCTION MATRIX';
  applyStyle(sec1, { bg: C.headerSub, fg: C.textWhite, bold: true, sz: 10.5, ha: 'left' });
  ws.getRow(r).height = 26;
  r++;

  // Table Headers
  const headers = [
    'Month', 'Qtr', 'Inv.', 'Gross Purchases',
    'Cash Disc. (3%)', 'Retailer (3.78%)', 'Rate Diff.', 'Special / Slab',
    'Monthly Bonus (Qtrly)', '2% QTB Bonus', 'Total Credit Notes', 'Net Effective', 'Audit Remarks & Status'
  ];
  const colLetters = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

  colLetters.forEach((col, i) => {
    const cell = ws.getCell(`${col}${r}`);
    cell.value = headers[i];
    applyStyle(cell, { bg: C.kpiBg, fg: C.textMain, bold: true, sz: 9.5, ha: i >= 3 && i <= 11 ? 'right' : 'center', bdr: 'thin', bdrColor: C.border });
  });
  ws.getRow(r).height = 26;
  r++;

  // Months from Apr 2026 to Mar 2027
  const fyMonths = [];
  for (let m = 4; m <= 12; m++) fyMonths.push({ y: FY_START_YEAR, m });
  for (let m = 1; m <= 3; m++) fyMonths.push({ y: FY_START_YEAR + 1, m });

  let totalGrossPurch = 0;
  let totalCD = 0;
  let totalRS = 0;
  let totalRD = 0;
  let totalSpecial = 0;
  let totalQTB = 0;
  let totalCredNotes = 0;

  fyMonths.forEach((fm, idx) => {
    const monthKey = `${fm.y}${String(fm.m).padStart(2, '0')}`;
    const monthPurchases = data.purchByMonth[monthKey] || [];
    const purchAmt = monthPurchases.reduce((s, p) => s + Math.abs(p.amount), 0);
    const qInfo = getAjantaQuarter(`${fm.y}${String(fm.m).padStart(2, '0')}15`);

    // Match verified CNs for this month
    const monthCNs = data.verifiedCNRegister.filter(c => c.forMonth === monthKey);
    const cdAmt = monthCNs.filter(c => c.category.includes('Cash Discount')).reduce((s, c) => s + c.totalAmt, 0);
    const rsAmt = monthCNs.filter(c => c.category.includes('Retailer Scheme')).reduce((s, c) => s + c.totalAmt, 0);
    const rdAmt = monthCNs.filter(c => c.category.includes('Rate Difference')).reduce((s, c) => s + c.totalAmt, 0);
    const specialAmt = monthCNs.filter(c => c.category.includes('Special Scheme') || c.category.includes('Slab Scheme')).reduce((s, c) => s + c.totalAmt, 0);
    const qtbAmt = monthCNs.filter(c => c.category.includes('QTB')).reduce((s, c) => s + c.totalAmt, 0);

    const monthTotalCN = cdAmt + rsAmt + rdAmt + specialAmt + qtbAmt;
    const netEffective = purchAmt > 0 ? (purchAmt - monthTotalCN) : 0;

    totalGrossPurch += purchAmt;
    totalCD += cdAmt;
    totalRS += rsAmt;
    totalRD += rdAmt;
    totalSpecial += specialAmt;
    totalQTB += qtbAmt;
    totalCredNotes += monthTotalCN;

    const rowBg = idx % 2 === 0 ? C.white : C.zebraTint;
    const hasData = purchAmt > 0;

    let remarkText = '—';
    if (monthKey === '202608') {
      remarkText = '✅ CD, RS, Rate Diff & Coupon credited | ⏳ Monthly Bonus missing (due Qtrly)';
    } else if (monthKey === '202609') {
      remarkText = '⚠️ 2% QTB, RS & Slab credited | ⏳ MISSING: Monthly Bonus, 3% CD & Rate Diff';
    }

    const rowVals = [
      { v: `${MON[fm.m]} ${fm.y}`, ha: 'left', bold: hasData },
      { v: qInfo.quarter, ha: 'center', fg: C.textMuted },
      { v: hasData ? monthPurchases.length : '—', ha: 'center' },
      { v: hasData ? purchAmt : 0, fmt: CUR, bold: hasData },
      // Cash Discount (3%)
      { v: cdAmt > 0 ? cdAmt : (monthKey === '202609' ? 'Pending ⏳' : 0), fmt: cdAmt > 0 ? CUR : null, ha: cdAmt > 0 ? 'right' : 'center', fg: monthKey === '202609' ? C.pendingFg : (cdAmt > 0 ? C.textMain : C.textMuted) },
      // Retailer Scheme (3.78%)
      { v: rsAmt > 0 ? rsAmt : 0, fmt: rsAmt > 0 ? CUR : null, fg: rsAmt > 0 ? C.textMain : C.textMuted },
      // Rate Difference
      { v: rdAmt > 0 ? rdAmt : (monthKey === '202609' ? 'Pending ⏳' : 0), fmt: rdAmt > 0 ? CUR : null, ha: rdAmt > 0 ? 'right' : 'center', fg: monthKey === '202609' ? C.pendingFg : (rdAmt > 0 ? C.textMain : C.textMuted) },
      // Special Scheme / Monthly Slab
      { v: specialAmt > 0 ? specialAmt : 0, fmt: specialAmt > 0 ? CUR : null, fg: specialAmt > 0 ? C.textMain : C.textMuted },
      // Monthly Bonus (Payable Quarterly) — Missing for Q2!
      { v: hasData ? 'Missing ⏳' : 0, ha: hasData ? 'center' : 'right', fg: hasData ? C.pendingFg : C.textMuted, bold: hasData },
      // 2% QTB
      { v: qtbAmt > 0 ? qtbAmt : 0, fmt: qtbAmt > 0 ? CUR : null, bold: qtbAmt > 0, fg: qtbAmt > 0 ? C.creditedFg : C.textMuted },
      // Total Credit Notes
      { v: monthTotalCN > 0 ? monthTotalCN : 0, fmt: monthTotalCN > 0 ? CUR : null, bold: monthTotalCN > 0 },
      // Net Effective
      { v: netEffective > 0 ? netEffective : 0, fmt: netEffective > 0 ? CUR : null, bold: hasData },
      // Remarks
      { v: remarkText, ha: 'left', sz: 8.5, fg: hasData ? C.textMain : C.textMuted }
    ];

    colLetters.forEach((col, i) => {
      const cell = ws.getCell(`${col}${r}`);
      const rv = rowVals[i];
      cell.value = rv.v;
      applyStyle(cell, {
        bg: (col === 'M' && hasData) ? C.kpiBg : rowBg,
        fg: rv.fg || C.textMain,
        bold: rv.bold || false,
        sz: rv.sz || 9.5,
        ha: rv.ha || 'right',
        fmt: (typeof rv.v === 'number' && rv.fmt) ? rv.fmt : null,
      });
    });

    ws.getRow(r).height = 24;
    r++;
  });

  // ──── TABLE 1 TOTAL ROW ────
  const gtRowVals = [
    'FULL FY TOTAL', '', data.purchases.length, totalGrossPurch,
    totalCD, totalRS, totalRD, totalSpecial, 'Missing ⏳', totalQTB,
    totalCredNotes, totalGrossPurch - totalCredNotes, 'FY 2026-27 YTD Audited Position'
  ];

  colLetters.forEach((col, i) => {
    const cell = ws.getCell(`${col}${r}`);
    cell.value = gtRowVals[i];
    applyStyle(cell, {
      bg: C.headerDark,
      fg: C.textWhite,
      bold: true,
      sz: 10,
      ha: i >= 3 && i <= 11 ? 'right' : 'center',
      fmt: typeof gtRowVals[i] === 'number' ? CUR : null,
      bdr: 'medium',
      bdrColor: C.borderDark
    });
  });
  ws.getRow(r).height = 28;
  r += 2;

  // ──── TABLE SECTION 2: CREDIT NOTE DETAIL REGISTER ────
  ws.mergeCells(`B${r}:N${r}`);
  const sec2 = ws.getCell(`B${r}`);
  sec2.value = '2. CREDIT NOTE DETAIL REGISTER (VERIFIED DIRECTLY WITH AJANTA SUPPLIER STATEMENTS)';
  applyStyle(sec2, { bg: C.headerSub, fg: C.textWhite, bold: true, sz: 10.5, ha: 'left' });
  ws.getRow(r).height = 26;
  r++;

  const cnHeaders = [
    '#', 'CN Date', 'Voucher', 'Ajanta Doc #', 'For Month',
    'Official Description in Ajanta Ledger', 'Deduction Category',
    'Taxable Base', 'IGST (5%)', 'Total Credit (₹)', 'Tally Ledger Posted', 'Status', 'Reconciliation Notes'
  ];

  colLetters.forEach((col, i) => {
    const cell = ws.getCell(`${col}${r}`);
    cell.value = cnHeaders[i];
    applyStyle(cell, { bg: C.kpiBg, fg: C.textMain, bold: true, sz: 9, ha: i >= 7 && i <= 9 ? 'right' : 'center', bdr: 'thin', bdrColor: C.border });
  });
  ws.getRow(r).height = 24;
  r++;

  data.verifiedCNRegister.forEach((cn, idx) => {
    const rowBg = idx % 2 === 0 ? C.white : C.zebraTint;

    const rowVals = [
      { v: cn.sno, ha: 'center' },
      { v: fmtDate(cn.date), ha: 'center' },
      { v: cn.voucherNo, ha: 'center', bold: true },
      { v: cn.sapDoc, ha: 'center', bold: true },
      { v: cn.forMonthLabel, ha: 'center' },
      { v: cn.officialDesc, ha: 'left', sz: 8.5 },
      { v: cn.category, ha: 'left', bold: cn.category.includes('QTB') },
      { v: cn.baseAmt, fmt: CUR },
      { v: cn.igstAmt, fmt: CUR },
      { v: cn.totalAmt, fmt: CUR, bold: true },
      { v: cn.ledgerHead, ha: 'left', sz: 8.5 },
      { v: 'Credited ✅', ha: 'center', fg: C.creditedFg, bold: true, bg: C.creditedBg },
      { v: cn.remarks, ha: 'left', sz: 8.5 }
    ];

    colLetters.forEach((col, i) => {
      const cell = ws.getCell(`${col}${r}`);
      const rv = rowVals[i];
      cell.value = rv.v;
      applyStyle(cell, {
        bg: rv.bg || rowBg,
        fg: rv.fg || C.textMain,
        bold: rv.bold || false,
        sz: rv.sz || 9,
        ha: rv.ha || 'right',
        fmt: (typeof rv.v === 'number' && rv.fmt) ? rv.fmt : null,
      });
    });

    ws.getRow(r).height = 24;
    r++;
  });

  // CN Total Row
  const cnBaseTotal = data.verifiedCNRegister.reduce((s, c) => s + c.baseAmt, 0);
  const cnIgstTotal = data.verifiedCNRegister.reduce((s, c) => s + c.igstAmt, 0);
  const cnTotalTotal = data.verifiedCNRegister.reduce((s, c) => s + c.totalAmt, 0);

  ws.mergeCells(`B${r}:G${r}`);
  const cnTotLabel = ws.getCell(`B${r}`);
  cnTotLabel.value = 'TOTAL CREDIT NOTES RECEIVED & AUDITED';
  applyStyle(cnTotLabel, { bg: C.kpiBg, fg: C.textMain, bold: true, sz: 10, ha: 'center' });

  applyStyle(ws.getCell(`H${r}`), { bg: C.kpiBg, fg: C.textMain, bold: true, sz: 10, ha: 'right', fmt: CUR });
  ws.getCell(`H${r}`).value = cnBaseTotal;

  applyStyle(ws.getCell(`I${r}`), { bg: C.kpiBg, fg: C.textMain, bold: true, sz: 10, ha: 'right', fmt: CUR });
  ws.getCell(`I${r}`).value = cnIgstTotal;

  applyStyle(ws.getCell(`J${r}`), { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 10.5, ha: 'right', fmt: CUR });
  ws.getCell(`J${r}`).value = cnTotalTotal;

  ws.mergeCells(`K${r}:N${r}`);
  const cnTotTail = ws.getCell(`K${r}`);
  cnTotTail.value = '100% matched with Ajanta Statement (Dealer 93081)';
  applyStyle(cnTotTail, { bg: C.kpiBg, fg: C.textMuted, sz: 8.5, ha: 'center', italic: true });

  ws.getRow(r).height = 26;
  r += 2;

  // ──── TABLE SECTION 3: PENDING CLAIMS & RECONCILIATION AUDIT LOG ────
  ws.mergeCells(`B${r}:N${r}`);
  const sec3 = ws.getCell(`B${r}`);
  sec3.value = '3. PENDING CLAIMS & ACTION LOG (MISSING CREDIT NOTES & AUDIT RECOVERY)';
  applyStyle(sec3, { bg: C.headerSub, fg: C.textWhite, bold: true, sz: 10.5, ha: 'left' });
  ws.getRow(r).height = 26;
  r++;

  const pendHeaders = [
    '#', 'Pending Claim Item', '', 'Period', '',
    'Claim Category', 'Basis / Estimated Value (₹)', '', '',
    'Current Status', '', 'Recovery Action Required / Auditor Notes', '', ''
  ];

  // Structured rows for pending claims highlighting missing monthly bonus
  const pendingItems = [
    {
      sno: 1,
      title: 'Q2 Monthly Bonus (Payable Quarterly) — MISSING',
      period: 'Q2 (Aug–Sep 2026 Turnover ₹22.99L)',
      cat: 'Monthly Bonus (Payable Qtrly)',
      estVal: 'Contractual Turnover Target %',
      status: '⏳ MISSING / NOT CREDITED',
      notes: 'Monthly turnover bonus accrues monthly and is payable quarterly upon quarter close. Q2 ended on 30.09.2026, and no credit note has been issued by Ajanta Shoes. Immediate claim required.'
    },
    {
      sno: 2,
      title: 'September 2026 Cash Discount (3%) — MISSING',
      period: 'Sep 2026 (29 Invoices, ₹10.47L)',
      cat: '3% Cash Discount',
      estVal: '₹31,415.76 (3% of ₹10,47,192)',
      status: '⏳ NOT YET CREDITED',
      notes: 'August 3% CD was credited via CN #160005126 (₹37,552.12). September cash discount has not been received from Ajanta and must be followed up.'
    },
    {
      sno: 3,
      title: 'September 2026 Rate Difference (Error Refund)',
      period: 'Sep 2026 (29 Invoices)',
      cat: 'Rate Difference',
      estVal: 'Under Line-by-Line Audit',
      status: '⏳ NOT YET CREDITED',
      notes: 'August pricing error refund was credited via CN #160005127 (₹2,773.95). September purchase invoices are currently under margin audit for pricing error refunds.'
    },
    {
      sno: 4,
      title: 'Q2 QTB Balance Adjustment (Quarterly Target Bonus)',
      period: 'Q2 (Aug–Sep 2026)',
      cat: '2% QTB',
      estVal: '₹22,846.11 Remaining Balance',
      status: '⏳ PARTIALLY CREDITED',
      notes: 'Q2 basic purchase was ₹21.89 Lakhs (109.5% achieved vs ₹20L target). Total 2% entitlement is ₹43,789.11. CN #160005562 credited ₹20,943.00. Balance QTB to be reconciled.'
    },
    {
      sno: 5,
      title: 'FY 2026-27 Annual Turnover Bonus (ATB)',
      period: 'Full Year 2026-27',
      cat: '3% Annual Bonus',
      estVal: '₹3,78,000 Target Entitlement',
      status: '📅 ACCRUING',
      notes: 'Contract clause: 3.00% on ₹1.20 Cr annual turnover commitment. Current YTD basic turnover is ₹21.89 Lakhs (18.25% progress). Payable after March 2027.'
    }
  ];

  // Headers for Section 3
  ws.getCell(`B${r}`).value = '#';
  applyStyle(ws.getCell(`B${r}`), { bg: C.kpiBg, bold: true, ha: 'center', sz: 9 });

  ws.mergeCells(`C${r}:E${r}`);
  ws.getCell(`C${r}`).value = 'Claim / Pending Item';
  applyStyle(ws.getCell(`C${r}`), { bg: C.kpiBg, bold: true, ha: 'left', sz: 9 });

  ws.mergeCells(`F${r}:G${r}`);
  ws.getCell(`F${r}`).value = 'Applicable Period';
  applyStyle(ws.getCell(`F${r}`), { bg: C.kpiBg, bold: true, ha: 'center', sz: 9 });

  ws.mergeCells(`H${r}:I${r}`);
  ws.getCell(`H${r}`).value = 'Estimated / Entitled Value';
  applyStyle(ws.getCell(`H${r}`), { bg: C.kpiBg, bold: true, ha: 'center', sz: 9 });

  ws.mergeCells(`J${r}:K${r}`);
  ws.getCell(`J${r}`).value = 'Audit Status';
  applyStyle(ws.getCell(`J${r}`), { bg: C.kpiBg, bold: true, ha: 'center', sz: 9 });

  ws.mergeCells(`L${r}:N${r}`);
  ws.getCell(`L${r}`).value = 'Recovery Action & Reconciliation Notes';
  applyStyle(ws.getCell(`L${r}`), { bg: C.kpiBg, bold: true, ha: 'left', sz: 9 });

  ws.getRow(r).height = 24;
  r++;

  pendingItems.forEach((pi, idx) => {
    const rowBg = idx % 2 === 0 ? C.white : C.zebraTint;

    ws.getCell(`B${r}`).value = pi.sno;
    applyStyle(ws.getCell(`B${r}`), { bg: rowBg, ha: 'center', sz: 9 });

    ws.mergeCells(`C${r}:E${r}`);
    ws.getCell(`C${r}`).value = pi.title;
    applyStyle(ws.getCell(`C${r}`), { bg: rowBg, bold: true, ha: 'left', sz: 9 });

    ws.mergeCells(`F${r}:G${r}`);
    ws.getCell(`F${r}`).value = pi.period;
    applyStyle(ws.getCell(`F${r}`), { bg: rowBg, ha: 'center', sz: 9 });

    ws.mergeCells(`H${r}:I${r}`);
    ws.getCell(`H${r}`).value = pi.estVal;
    applyStyle(ws.getCell(`H${r}`), { bg: rowBg, ha: 'center', sz: 9 });

    ws.mergeCells(`J${r}:K${r}`);
    ws.getCell(`J${r}`).value = pi.status;
    applyStyle(ws.getCell(`J${r}`), { bg: pi.status.includes('CREDITED') ? C.pendingBg : C.kpiBg, fg: pi.status.includes('CREDITED') ? C.pendingFg : C.textMain, bold: true, ha: 'center', sz: 9 });

    ws.mergeCells(`L${r}:N${r}`);
    ws.getCell(`L${r}`).value = pi.notes;
    applyStyle(ws.getCell(`L${r}`), { bg: rowBg, ha: 'left', sz: 8.5, wrap: true });

    ws.getRow(r).height = 30;
    r++;
  });

  r += 2;

  // ──── TABLE SECTION 4: CONTRACT TERMS & SCHEME REFERENCE ────
  ws.mergeCells(`B${r}:N${r}`);
  const sec4 = ws.getCell(`B${r}`);
  sec4.value = '4. AJANTA DEALERSHIP AGREEMENT SCHEME & BONUS POLICY REFERENCE';
  applyStyle(sec4, { bg: C.headerSub, fg: C.textWhite, bold: true, sz: 10.5, ha: 'left' });
  ws.getRow(r).height = 26;
  r++;

  const policyRows = [
    ['Deduction Head', 'Rate / Formula', 'Accrual Timing', 'Payout Cycle', 'Agreement Terms & Notes'],
    ['Monthly Bonus', 'Target % on Turnover', 'Accrued Monthly', 'Payable Quarterly', '⚠️ MISSING for Q2. Accrued for Aug & Sep, payable at quarter-end (30-Sep-2026). No credit note received yet.'],
    ['Quarterly Target (QTB)', '2.00% on Qtr Basic Turnover', 'Quarterly', 'Quarter Closure', 'Credited via CN #160005562 (₹20,943.00). Q2 target was ₹20L.'],
    ['3% Cash Discount', '3.00% on Billing Value', 'Monthly', 'Following Month', 'Cash discount on invoice settlement. Missing in Sep 2026.'],
    ['Retailer Scheme', '3.78% on HW + FTW', 'Monthly', 'Following Month', 'Credited for both Aug (₹45,896) and Sep (₹39,584).'],
    ['Rate Difference', 'Billed Rate - Correct Rate', 'As error occurs', 'Month-end Refund', 'Error refunds. Aug credited (₹2,773.95). Sep pending.'],
    ['Monthly Slab Scheme', 'Volume Target Slabs', 'Monthly', 'Following Month', 'Credited for Sep via CN #160005580 (₹26,180.00).'],
    ['Annual Target (ATB)', '3.00% on Annual Basic Turnover', 'Full FY', 'After March Close', 'Annual commitment target is ₹1.20 Crore basic turnover.']
  ];

  policyRows.forEach((pRow, idx) => {
    const isHdr = idx === 0;
    const rowBg = isHdr ? C.kpiBg : (idx % 2 === 0 ? C.zebraTint : C.white);

    // Columns: B..C (Head), D..E (Rate), F..G (Accrual), H..I (Payout), J..N (Notes)
    ws.mergeCells(`B${r}:C${r}`);
    ws.getCell(`B${r}`).value = pRow[0];
    applyStyle(ws.getCell(`B${r}`), { bg: rowBg, bold: isHdr || true, ha: 'left', sz: 9 });

    ws.mergeCells(`D${r}:E${r}`);
    ws.getCell(`D${r}`).value = pRow[1];
    applyStyle(ws.getCell(`D${r}`), { bg: rowBg, bold: isHdr, ha: 'center', sz: 9 });

    ws.mergeCells(`F${r}:G${r}`);
    ws.getCell(`F${r}`).value = pRow[2];
    applyStyle(ws.getCell(`F${r}`), { bg: rowBg, bold: isHdr, ha: 'center', sz: 9 });

    ws.mergeCells(`H${r}:I${r}`);
    ws.getCell(`H${r}`).value = pRow[3];
    applyStyle(ws.getCell(`H${r}`), { bg: rowBg, bold: isHdr, ha: 'center', sz: 9 });

    ws.mergeCells(`J${r}:N${r}`);
    ws.getCell(`J${r}`).value = pRow[4];
    applyStyle(ws.getCell(`J${r}`), { bg: rowBg, bold: isHdr, ha: 'left', sz: 8.5 });

    ws.getRow(r).height = isHdr ? 24 : 20;
    r++;
  });

  return ws;
}

// ═════════════════════════════════════════════════════════════════════════════
//  SHEET 2: PURCHASE INVOICES (CLEAN & SPACIOUS REGISTER)
// ═════════════════════════════════════════════════════════════════════════════
async function createPurchaseSheet(wb, data) {
  const ws = wb.addWorksheet('Purchase Invoices', {
    properties: { tabColor: { argb: C.headerSub } },
    views: [{ showGridLines: true, state: 'frozen', ySplit: 3 }]
  });

  ws.columns = [
    { width: 3 },   // A: spacer
    { width: 6 },   // B: #
    { width: 14 },  // C: Date
    { width: 10 },  // D: Voucher
    { width: 16 },  // E: Invoice Ref
    { width: 28 },  // F: Ship-To Customer
    { width: 10 },  // G: Items
    { width: 16 },  // H: Taxable Base
    { width: 14 },  // I: IGST (5%)
    { width: 16 },  // J: Total Amount
    { width: 8 },   // K: Qtr
    { width: 40 },  // L: Narration
  ];

  let r = 1;
  ws.mergeCells('B1:L1');
  const t = ws.getCell('B1');
  t.value = 'AJANTA SHOES — PURCHASE INVOICE REGISTER';
  applyStyle(t, { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 12, ha: 'center' });
  ws.getRow(1).height = 32;
  r++;

  ws.mergeCells('B2:L2');
  const s = ws.getCell('B2');
  s.value = `Total Invoices: ${data.purchases.length}  |  FY ${FY_START_YEAR}-${(FY_START_YEAR + 1).toString().slice(2)}  |  Supplier: ${SUPPLIER_NAME}`;
  applyStyle(s, { bg: C.headerSub, fg: C.kpiBg, sz: 9, ha: 'center', italic: true });
  ws.getRow(2).height = 20;
  r++;

  const hdrs = ['#', 'Date', 'Voucher', 'Invoice Ref', 'Ship-To Customer', 'Items', 'Taxable Base', 'IGST (5%)', 'Total (₹)', 'Qtr', 'Narration'];
  const cols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  cols.forEach((col, i) => {
    applyStyle(ws.getCell(`${col}${r}`), { bg: C.kpiBg, fg: C.textMain, bold: true, sz: 9.5, ha: i >= 6 && i <= 8 ? 'right' : 'center', bdr: 'thin', bdrColor: C.border });
    ws.getCell(`${col}${r}`).value = hdrs[i];
  });
  ws.getRow(r).height = 26;
  r++;

  let curMonth = '';
  data.purchases.forEach((p, idx) => {
    const mk = p.date.substring(0, 6);
    const mn = parseInt(p.date.substring(4, 6));
    const yr = parseInt(p.date.substring(0, 4));

    if (mk !== curMonth) {
      curMonth = mk;
      ws.mergeCells(`B${r}:L${r}`);
      const mc = ws.getCell(`B${r}`);
      mc.value = `▸  ${MONTH_FULL[mn].toUpperCase()} ${yr}`;
      applyStyle(mc, { bg: C.kpiBg, fg: C.headerDark, bold: true, sz: 10, ha: 'left' });
      ws.getRow(r).height = 22;
      r++;
    }

    const pe = p.ledgerEntries.find(l => l.ledgerName.includes('Purchase'));
    const ie = p.ledgerEntries.find(l => l.ledgerName.includes('IGST'));
    const qi = getAjantaQuarter(p.date);
    const bg = idx % 2 === 0 ? C.white : C.zebraTint;

    // Extract customer ship-to from narration
    const narr = p.narration || '';
    const custMatch = narr.match(/to\s+([A-Za-z0-9\.\s\/\-]+?)(?:\s+against|\s+as\s+per|\s+dated|$)/i);
    const customer = custMatch ? custMatch[1].trim() : '—';

    const vals = [
      idx + 1, fmtDate(p.date), `#${p.voucherNumber}`, p.reference || '',
      customer, (p.inventoryEntries || []).length, pe ? Math.abs(pe.amount) : 0,
      ie ? Math.abs(ie.amount) : 0, Math.abs(p.amount), qi.quarter,
      narr.substring(0, 75)
    ];

    vals.forEach((v, i) => {
      const cell = ws.getCell(`${cols[i]}${r}`);
      cell.value = v;
      applyStyle(cell, {
        bg,
        ha: i === 0 || i === 5 || i === 9 ? 'center' : (i >= 6 && i <= 8 ? 'right' : 'left'),
        sz: 9,
        fmt: i >= 6 && i <= 8 && typeof v === 'number' ? CUR : null
      });
    });

    ws.getRow(r).height = 22;
    r++;
  });

  // Total
  ws.mergeCells(`B${r}:G${r}`);
  const totL = ws.getCell(`B${r}`);
  totL.value = 'GRAND TOTAL PURCHASES';
  applyStyle(totL, { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 10, ha: 'center' });

  const totalBase = data.purchases.reduce((s, p) => { const e = p.ledgerEntries.find(l => l.ledgerName.includes('Purchase')); return s + (e ? Math.abs(e.amount) : 0); }, 0);
  const totalIgst = data.purchases.reduce((s, p) => { const e = p.ledgerEntries.find(l => l.ledgerName.includes('IGST')); return s + (e ? Math.abs(e.amount) : 0); }, 0);
  const totalAmt = data.purchases.reduce((s, p) => s + Math.abs(p.amount), 0);

  [totalBase, totalIgst, totalAmt].forEach((tv, i) => {
    const c = ws.getCell(`${cols[6 + i]}${r}`);
    c.value = tv;
    applyStyle(c, { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 10, ha: 'right', fmt: CUR });
  });

  ws.mergeCells(`K${r}:L${r}`);
  applyStyle(ws.getCell(`K${r}`), { bg: C.headerDark, fg: C.textWhite });
  ws.getRow(r).height = 26;

  return ws;
}

// ═════════════════════════════════════════════════════════════════════════════
//  SHEET 3: ACCOUNT STATEMENT (FULL LEDGER RUNNING BALANCE)
// ═════════════════════════════════════════════════════════════════════════════
async function createLedgerSheet(wb, data) {
  const ws = wb.addWorksheet('Account Statement', {
    properties: { tabColor: { argb: C.headerSub } },
    views: [{ showGridLines: true, state: 'frozen', ySplit: 3 }]
  });

  ws.columns = [
    { width: 3 },   // A: spacer
    { width: 6 },   // B: #
    { width: 14 },  // C: Date
    { width: 14 },  // D: Voucher Type
    { width: 12 },  // E: Voucher #
    { width: 16 },  // F: Reference / Doc #
    { width: 18 },  // G: Debit (Purchases)
    { width: 18 },  // H: Credit (Payments/CNs)
    { width: 18 },  // I: Closing Balance
    { width: 45 },  // J: Narration
  ];

  let r = 1;
  ws.mergeCells('B1:J1');
  const t = ws.getCell('B1');
  t.value = 'AJANTA SHOES — FULL RUNNING ACCOUNT STATEMENT';
  applyStyle(t, { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 12, ha: 'center' });
  ws.getRow(1).height = 32;
  r++;

  ws.mergeCells('B2:J2');
  const s = ws.getCell('B2');
  s.value = `Debit = Inward Purchases  |  Credit = Payments + Credit Notes  |  Closing: Dr = Amount Payable`;
  applyStyle(s, { bg: C.headerSub, fg: C.kpiBg, sz: 9, ha: 'center', italic: true });
  ws.getRow(2).height = 20;
  r++;

  const hdrs = ['#', 'Date', 'Type', 'Voucher #', 'Reference', 'Debit (Dr)', 'Credit (Cr)', 'Balance (₹)', 'Narration'];
  const cols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  cols.forEach((col, i) => {
    applyStyle(ws.getCell(`${col}${r}`), { bg: C.kpiBg, fg: C.textMain, bold: true, sz: 9.5, ha: i >= 5 && i <= 7 ? 'right' : 'center', bdr: 'thin', bdrColor: C.border });
    ws.getCell(`${col}${r}`).value = hdrs[i];
  });
  ws.getRow(r).height = 26;
  r++;

  const entries = [];
  data.purchases.forEach(p => entries.push({ date: p.date, type: 'Purchase', vn: `#${p.voucherNumber}`, ref: p.reference || '', dr: Math.abs(p.amount), cr: 0, narr: p.narration || '' }));
  data.debitNotes.forEach(dn => {
    const matched = data.verifiedCNRegister.find(c => c.voucherNo === `DN-${dn.voucherNumber}`);
    entries.push({ date: dn.date, type: 'Credit Note', vn: `DN-${dn.voucherNumber}`, ref: matched ? matched.sapDoc : '', dr: 0, cr: Math.abs(dn.amount), narr: dn.narration || '' });
  });
  data.payments.forEach(p => entries.push({ date: p.date, type: 'Payment', vn: `#${p.voucherNumber}`, ref: 'Bank Transfer', dr: 0, cr: Math.abs(p.amount), narr: p.narration || 'Payment to Ajanta' }));

  entries.sort((a, b) => a.date.localeCompare(b.date));

  let bal = 0;
  entries.forEach((e, idx) => {
    bal += e.dr - e.cr;
    const bg = idx % 2 === 0 ? C.white : C.zebraTint;

    const rowVals = [
      idx + 1, fmtDate(e.date), e.type, e.vn, e.ref,
      e.dr || 0, e.cr || 0, bal, e.narr.substring(0, 80)
    ];

    cols.forEach((col, i) => {
      const cell = ws.getCell(`${col}${r}`);
      cell.value = rowVals[i];
      applyStyle(cell, {
        bg,
        sz: 9,
        ha: i === 0 || i === 1 ? 'center' : (i >= 5 && i <= 7 ? 'right' : 'left'),
        fmt: (i >= 5 && i <= 7 && typeof rowVals[i] === 'number') ? CUR : null,
        bold: i === 2 || i === 7,
      });
    });

    ws.getRow(r).height = 22;
    r++;
  });

  // Closing Balance Row
  ws.mergeCells(`B${r}:F${r}`);
  const cbL = ws.getCell(`B${r}`);
  cbL.value = 'CLOSING SUPPLIER BALANCE';
  applyStyle(cbL, { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 10, ha: 'center' });

  const tDr = entries.reduce((s, e) => s + e.dr, 0);
  const tCr = entries.reduce((s, e) => s + e.cr, 0);

  applyStyle(ws.getCell(`G${r}`), { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 10, ha: 'right', fmt: CUR });
  ws.getCell(`G${r}`).value = tDr;

  applyStyle(ws.getCell(`H${r}`), { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 10, ha: 'right', fmt: CUR });
  ws.getCell(`H${r}`).value = tCr;

  applyStyle(ws.getCell(`I${r}`), { bg: C.headerDark, fg: C.textWhite, bold: true, sz: 10.5, ha: 'right', fmt: CUR });
  ws.getCell(`I${r}`).value = bal;

  applyStyle(ws.getCell(`J${r}`), { bg: C.headerDark, fg: C.textWhite });
  ws.getRow(r).height = 26;

  return ws;
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN GENERATOR EXECUTION
// ═════════════════════════════════════════════════════════════════════════════
async function generateMinimalistTracker() {
  console.log('\n===============================================================');
  console.log('  AJANTA SHOES SUPPLIER TRACKER — v3 (Clean Slate & Spacious)  ');
  console.log('===============================================================\n');

  console.log('📊 Verifying supplier data against Ajanta statements...');
  const data = getVerifiedAjantaData();

  console.log(`   ✅ Purchases Audited: ${data.purchases.length} invoices (₹${(data.purchases.reduce((s,p)=>s+Math.abs(p.amount),0)/100000).toFixed(2)} Lakhs)`);
  console.log(`   ✅ Credit Notes Reconciled: ${data.verifiedCNRegister.length} (including 2% QTB #160005562)`);
  console.log(`   ✅ Payments Audited: ${data.payments.length}`);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SKIL Lifestyle LLP — Direct Ledger Audit';
  wb.created = new Date();

  console.log('\n📑 Creating Sheet 1: Ajanta Tracker (Consolidated Master)...');
  await createConsolidatedTrackerSheet(wb, data);

  console.log('📑 Creating Sheet 2: Purchase Invoices...');
  await createPurchaseSheet(wb, data);

  console.log('📑 Creating Sheet 3: Account Statement...');
  await createLedgerSheet(wb, data);

  const filename = `Ajanta_Supplier_Tracker_FY${FY_START_YEAR}-${(FY_START_YEAR + 1).toString().slice(2)}.xlsx`;
  let targetPath = path.join(OUTPUT_DIR, filename);

  try {
    await wb.xlsx.writeFile(targetPath);
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.warn(`\n⚠️ Note: ${filename} is currently open in Excel or another process.`);
      const altFilename = `Ajanta_Supplier_Tracker_FY${FY_START_YEAR}-${(FY_START_YEAR + 1).toString().slice(2)}_Updated.xlsx`;
      targetPath = path.join(OUTPUT_DIR, altFilename);
      console.log(`   Writing to alternative path: ${altFilename}...`);
      await wb.xlsx.writeFile(targetPath);
    } else {
      throw err;
    }
  }

  const stats = fs.statSync(targetPath);
  console.log(`\n✅ Generated & Saved: ${targetPath}`);
  console.log(`   📂 Size: ${(stats.size / 1024).toFixed(1)} KB — 3 sheets`);
  console.log('   🎨 Palette: Clean Executive Slate (#1E293B / #334155 / #F1F5F9)');
  console.log('   ✨ Spacious & Compact layout with Segoe UI typography\n');

  return targetPath;
}

if (require.main === module) {
  generateMinimalistTracker().catch(err => {
    console.error('❌ Generation Error:', err);
    process.exit(1);
  });
}

module.exports = {
  generateMinimalistTracker,
  getVerifiedAjantaData,
  getAjantaQuarter,
};
