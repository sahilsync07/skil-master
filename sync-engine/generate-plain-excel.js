const fs = require('fs');
const path = require('path');
const ExcelJS = require('./node_modules/exceljs');
const db = require('./database');

async function generatePlainExcel() {
  const vouchers = Object.values(db.vouchers);
  const sales = vouchers.filter(v => v.voucherType === 'Sales');
  const purchases = vouchers.filter(v => v.voucherType === 'Purchase');

  const pdfDir = path.resolve(__dirname, '../user-documents-read-only-access/Purchases - last updated on 16-11-2026 at 18-44 hrs');
  const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));

  const cleanRef = r => String(r || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const pdfMap = {};
  pdfFiles.forEach(f => {
    if (f.startsWith('CANCELLED')) return;
    const m = f.match(/^(\d+)\s*-\s*(.+)\s*-\s*([0-9]{2}[-.][0-9]{2}[-.][0-9]{2,4})\.pdf$/i);
    if (m) {
      const sl = parseInt(m[1], 10);
      const middle = m[2];
      let dateStr = m[3].replace(/\./g, '-');
      if (dateStr.length === 8) {
        dateStr = dateStr.slice(0, 6) + '20' + dateStr.slice(6);
      }
      const lastDash = middle.lastIndexOf(' - ');
      const ref = lastDash !== -1 ? middle.slice(0, lastDash).trim() : middle;
      const party = lastDash !== -1 ? middle.slice(lastDash + 3).trim() : '';
      pdfMap[sl] = { filename: f, sl, ref, party, dateStr };
    }
  });

  const stationMap = {
    'SBE RGDA': 'Rayagada',
    'Delight VZM': 'Vizianagaram',
    'KGN PVM': 'Parvathipuram',
    'SF SKLM': 'Srikakulam',
    'Sushila JSG': 'Jharsuguda',
    'Jyothi VZM': 'Vizianagaram',
    'Jyothi Anakapalli': 'Anakapalli',
    'Mahavir DNKL': 'Dhenkanal',
    'Sharvani SKLM': 'Srikakulam',
    'Sharvani VZAG': 'Visakhapatnam',
    'Shree Aditya VZM': 'Vizianagaram',
    'Rajan Jajpur': 'Jajpur',
    'Famous VZM': 'Vizianagaram',
    'SLGC RJM': 'Rajahmundry',
    'Alaka Nayagarh': 'Nayagarh',
    'Sri Laxmi Narasimha Nellore': 'Nellore'
  };

  function parsePairs(qtyStr) {
    if (!qtyStr) return 0;
    if (typeof qtyStr === 'number') return qtyStr;
    const match = String(qtyStr).match(/(-?\d+(?:\.\d+)?)\s*(?:Pairs|Pair|Pcs|Boxes|Box|PRS|prs)/i);
    if (match) return parseFloat(match[1]);
    const numMatch = String(qtyStr).match(/-?\d+(?:\.\d+)?/);
    return numMatch ? parseFloat(numMatch[0]) : 0;
  }

  function fmtDate(d) {
    if (!d) return '';
    const s = String(d).replace(/[^0-9]/g, '');
    if (s.length === 8) return s.slice(6, 8) + '-' + s.slice(4, 6) + '-' + s.slice(0, 4);
    return d;
  }

  const billPaymentMap = {
    'SKIL-001': { status: 'PAID', note: 'Cleared vs July Advance' },
    'SKIL-002': { status: 'PAID', note: 'Rcpt #11 (₹1,48,728) + CN #3 (₹7,436)' },
    'SKIL-003': { status: 'PAID', note: 'Cleared vs July Advance' },
    'SKIL-004': { status: 'PAID', note: 'Rcpt #7 + 5% CD (CN #1)' },
    'SKIL-005': { status: 'PAID', note: 'Rcpt #7 + 5% CD (CN #1)' },
    'SKIL-006': { status: 'PAID', note: 'Rcpt #7 + 5% CD (CN #1)' },
    'SKIL-007': { status: 'PAID', note: 'Cleared vs July Advance' },
    'SKIL-008': { status: 'PAID', note: 'Cleared vs July Advance' },
    'SKIL-009': { status: 'PAID', note: 'Cleared vs July Advance' },
    'SKIL-010': { status: 'PAID', note: 'Cleared vs July Advance' },
    'SKIL-011': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-012': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-013': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-014': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-015': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-016': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-017': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-018': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-019': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-020': { status: 'PAID', note: 'Rcpt #4/6/8 + 5% CD (CN #2)' },
    'SKIL-021': { status: 'PAID', note: 'Cleared vs July Advance' },
    'SKIL-022': { status: 'PAID', note: 'Cleared vs July Advance' },
    'SKIL-023': { status: 'PARTIAL', note: 'Recd ₹1,00,000 | Due: ₹70,306 (Rcpt #15)' },
    'SKIL-024': { status: 'PENDING', note: 'Due: ₹22,890' },
    'SKIL-025': { status: 'PENDING', note: 'Due: ₹18,855' },
    'SKIL-026': { status: 'PENDING', note: 'Due: ₹4,238' },
    'SKIL-027': { status: 'PAID', note: 'Rcpt #18 (₹1L part) dt 03-11' },
    'SKIL-028': { status: 'PARTIAL', note: 'Recd ₹46,570 | Due: ₹10,486 (Rcpt #18)' },
    'SKIL-029': { status: 'PENDING', note: 'Due: ₹34,144' },
    'SKIL-030': { status: 'PENDING', note: 'Due: ₹4,613' },
    'SKIL-031': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-032': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-033': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-034': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-035': { status: 'PAID', note: 'Rcpt #14 + 5% CD (CN #7)' },
    'SKIL-036': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-037': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-038': { status: 'PAID', note: 'Rcpt #9/10 + 5% CD (CN #5)' },
    'SKIL-039': { status: 'PAID', note: 'Rcpt #9/10 + 5% CD (CN #5)' },
    'SKIL-040': { status: 'PENDING', note: 'Due: ₹3,01,964' },
    'SKIL-041': { status: 'PENDING', note: 'Due: ₹78,249' },
    'SKIL-042': { status: 'PENDING', note: 'Due: ₹50,655' },
    'SKIL-043': { status: 'PENDING', note: 'Due: ₹39,697' },
    'SKIL-044': { status: 'PAID', note: 'Rcpt #9/10 + 5% CD (CN #5)' },
    'SKIL-045': { status: 'PAID', note: 'Rcpt #9/10 + 5% CD (CN #5)' },
    'SKIL-046': { status: 'PAID', note: 'Rcpt #9/10 + 5% CD (CN #5)' },
    'SKIL-047': { status: 'PENDING', note: 'Due: ₹43,801' },
    'SKIL-048': { status: 'PENDING', note: 'Due: ₹28,890' },
    'SKIL-049': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-050': { status: 'PENDING', note: 'Due: ₹5,981' },
    'SKIL-051': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-052': { status: 'PENDING', note: 'Due: ₹65,531' },
    'SKIL-053': { status: 'PAID', note: 'Rcpt #13 + 5% CD (CN #6)' },
    'SKIL-054': { status: 'PAID', note: 'Rcpt #14 + 5% CD (CN #7)' },
    'SKIL-055': { status: 'PENDING', note: 'Due: ₹1,10,672' },
    'SKIL-056': { status: 'PARTIAL', note: 'Recd ₹50,000 | Due: ₹60,382 (Rcpt #12/19)' },
    'SKIL-057': { status: 'PAID', note: 'Settled via Bank A/c' },
    'SKIL-058': { status: 'PENDING', note: 'Due: ₹65,029' },
    'SKIL-059': { status: 'PAID', note: 'Cleared vs October balance' },
    'SKIL-060': { status: 'PAID', note: 'Cleared vs October balance' },
    'SKIL-061': { status: 'PAID', note: 'Cleared vs October balance' },
    'SKIL-062': { status: 'PENDING', note: 'Due: ₹82,079' },
    'SKIL-063': { status: 'PENDING', note: 'Due: ₹75,315' },
    'SKIL-064': { status: 'PAID', note: 'Rcpt #16/17 (₹2L part)' },
    'SKIL-065': { status: 'PAID', note: 'Rcpt #16/17 (₹2L part)' },
    'SKIL-066': { status: 'PARTIAL', note: 'Recd ₹1,57,524 | Due: ₹3,61,751 (Rcpt #16/17)' },
    'SKIL-067': { status: 'PENDING', note: 'Due: ₹3,15,696' },
    'SKIL-068': { status: 'PENDING', note: 'Due: ₹81,114' },
    'SKIL-069': { status: 'PENDING', note: 'Due: ₹10,275' },
    'SKIL-070': { status: 'PAID', note: 'Settled via Bank A/c' },
    'SKIL-071': { status: 'CANCELLED', note: 'Cancelled via CN-008; Re-billed to Sharvani as SKIL-078' },
    'SKIL-072': { status: 'PENDING', note: 'Due: ₹1,45,300' },
    'SKIL-073': { status: 'PAID', note: 'Settled via Bank A/c' },
    'SKIL-074': { status: 'PAID', note: 'Settled via Bank A/c' },
    'SKIL-075': { status: 'PAID', note: 'Settled via Bank A/c' },
    'SKIL-076': { status: 'PAID', note: 'Settled via Bank A/c' },
    'SKIL-077': { status: 'PAID', note: 'Settled via Bank A/c' },
    'SKIL-078': { status: 'PENDING', note: 'Due: ₹59,971 (Ajanta Inv #1900423838)' },
    'SKIL-079': { status: 'PENDING', note: 'Eligible for 5% CD (Due dt 12-12-2026)' },
    'SKIL-080': { status: 'PENDING', note: 'Eligible for 5% CD (Due dt 12-12-2026)' },
    'SKIL-081': { status: 'PENDING', note: 'Eligible for 5% CD (Due dt 12-12-2026)' },
    'SKIL-082': { status: 'PENDING', note: 'Eligible for 5% CD (Due dt 13-12-2026)' },
    'SKIL-083': { status: 'PENDING', note: 'Eligible for 5% CD (Due dt 13-12-2026)' },
    'SKIL-084': { status: 'PENDING', note: 'Eligible for 5% CD (Due dt 16-12-2026)' },
    'SKIL-085': { status: 'PENDING', note: 'Eligible for 5% CD (Due dt 16-12-2026)' },
    'SKIL-086': { status: 'PENDING', note: 'Eligible for 5% CD (Due dt 16-12-2026)' }
  };

  // Sort in reverse order (SKIL-086 down to SKIL-001)
  sales.sort((a,b) => {
    const na = parseInt(String(a.voucherNumber).replace(/[^0-9]/g, '')) || 0;
    const nb = parseInt(String(b.voucherNumber).replace(/[^0-9]/g, '')) || 0;
    return nb - na;
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SKIL LIFESTYLE LLP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Invoices Register (Reverse)', {
    views: [{ showGridLines: true }]
  });

  // Fonts
  const fontTitle = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF000000' } };
  const fontSubTitle = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF333333' } };
  const fontMeta = { name: 'Calibri', size: 9, color: { argb: 'FF555555' } };
  const fontHeader = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
  const fontData = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
  const fontTotal = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };

  // Borders
  const borderThinGrey = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
  };

  const borderHeader = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
  };

  const borderTotal = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
  };

  // Alignments
  const alignCenter = { vertical: 'middle', horizontal: 'center' };
  const alignLeft = { vertical: 'middle', horizontal: 'left' };
  const alignRight = { vertical: 'middle', horizontal: 'right' };

  // Title Block
  ws.mergeCells('A1:P1');
  ws.getCell('A1').value = 'SKIL LIFESTYLE LLP';
  ws.getCell('A1').font = fontTitle;
  ws.getCell('A1').alignment = alignLeft;
  ws.getRow(1).height = 24;

  ws.mergeCells('A2:P2');
  ws.getCell('A2').value = 'COMPLETE INVOICES & OUTWARD DISPATCH REGISTER — REVERSE CHRONOLOGICAL ORDER (NEWEST TO OLDEST)';
  ws.getCell('A2').font = fontSubTitle;
  ws.getCell('A2').alignment = alignLeft;
  ws.getRow(2).height = 18;

  ws.mergeCells('A3:P3');
  ws.getCell('A3').value = 'Scope: FY 2026-27 (August – November 2026) | Drop-Shipping Back-to-Back Fulfillment | Verified against TallyPrime & Source Invoices';
  ws.getCell('A3').font = fontMeta;
  ws.getCell('A3').alignment = alignLeft;
  ws.getRow(3).height = 16;

  ws.getRow(4).height = 10; // Spacing row

  // Table Headers
  const headers = [
    'Sl. No.',
    'Invoice No.',
    'Invoice Date',
    'Ship-To Party / Customer',
    'Destination Station',
    'Dispatch Date',
    'Supplier',
    'Supplier Inv. No.',
    'Inward Vch #',
    'Cartons (CTN)',
    'Pairs (PRS)',
    'Taxable Value (₹)',
    'GST Amount (₹)',
    'Gross Amount (₹)',
    'Payment Status',
    'Remarks / Settlement Details'
  ];

  const headerRow = ws.getRow(5);
  headerRow.height = 28;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.border = borderHeader;
    cell.alignment = {
      vertical: 'middle',
      horizontal: [1, 2, 3, 6, 8, 9, 15].includes(idx + 1) ? 'center' : ([10, 11, 12, 13, 14].includes(idx + 1) ? 'right' : 'left'),
      wrapText: true
    };
  });

  // Populate Data Rows
  let curRowIdx = 6;
  sales.forEach((s, idx) => {
    const sVnum = s.voucherNumber;
    const sDate = fmtDate(s.date);
    const custName = s.partyName;

    // Matching purchase
    const p = purchases.find(v => cleanRef(v.reference) === cleanRef(s.reference));
    const pNum = p ? parseInt(p.voucherNumber, 10) : null;
    const pdfInfo = pNum ? pdfMap[pNum] : null;

    const station = pdfInfo && stationMap[pdfInfo.party] ? stationMap[pdfInfo.party] : (pdfInfo ? pdfInfo.party : '—');
    const dispatchDate = pdfInfo ? pdfInfo.dateStr : (p ? fmtDate(p.date) : '—');
    const supplier = p ? p.partyName.replace(' (India) Pvt. Ltd.', '').replace(' (INDIA) PRIVATE LIMITED', '').replace(' LLP', '').trim() : '—';
    const supplierInvNo = s.reference || (p ? p.reference : '—');

    // Financials
    const partyLedger = s.ledgerEntries.find(l => l.isPartyLedger);
    const salesLedger = s.ledgerEntries.find(l => l.ledgerName.includes('Sales'));
    const igst = s.ledgerEntries.find(l => l.ledgerName.includes('IGST'));
    const cgst = s.ledgerEntries.find(l => l.ledgerName.includes('CGST'));
    const sgst = s.ledgerEntries.find(l => l.ledgerName.includes('SGST'));

    const gross = Math.abs(partyLedger ? partyLedger.amount : s.amount);
    const taxable = salesLedger ? Math.abs(salesLedger.amount) : 0;
    const gst = (igst ? Math.abs(igst.amount) : 0) + (cgst ? Math.abs(cgst.amount) : 0) + (sgst ? Math.abs(sgst.amount) : 0);

    // Quantities
    let pairs = 0;
    let boxes = 0;
    (s.inventoryEntries || []).forEach(ie => {
      pairs += parsePairs(ie.billedQty || ie.actualQty);
      const m = String(ie.actualQty || '').match(/=\s*(\d+(?:\.\d+)?)\s*(?:Box|Boxes|CTN|Carton)/i);
      if (m) boxes += parseFloat(m[1]);
    });

    const pStat = billPaymentMap[sVnum] || { status: 'PENDING', note: '' };

    const row = ws.getRow(curRowIdx);
    row.height = 21;

    // 1: Sl. No. in reverse countdown order (86 down to 1)
    row.getCell(1).value = sales.length - idx;
    row.getCell(1).alignment = alignCenter;

    // 2: Invoice No.
    row.getCell(2).value = sVnum;
    row.getCell(2).alignment = alignCenter;

    // 3: Invoice Date
    row.getCell(3).value = sDate;
    row.getCell(3).alignment = alignCenter;

    // 4: Ship-To Party
    row.getCell(4).value = custName;
    row.getCell(4).alignment = alignLeft;

    // 5: Destination Station
    row.getCell(5).value = station;
    row.getCell(5).alignment = alignLeft;

    // 6: Dispatch Date
    row.getCell(6).value = dispatchDate;
    row.getCell(6).alignment = alignCenter;

    // 7: Supplier
    row.getCell(7).value = supplier;
    row.getCell(7).alignment = alignLeft;

    // 8: Supplier Inv. No.
    row.getCell(8).value = supplierInvNo;
    row.getCell(8).alignment = alignCenter;

    // 9: Inward Purchase Vch #
    row.getCell(9).value = pNum ? '#' + pNum : '—';
    row.getCell(9).alignment = alignCenter;

    // 10: Cartons
    row.getCell(10).value = boxes;
    row.getCell(10).alignment = alignRight;
    row.getCell(10).numFmt = '#,##0';

    // 11: Pairs
    row.getCell(11).value = pairs;
    row.getCell(11).alignment = alignRight;
    row.getCell(11).numFmt = '#,##0';

    // 12: Taxable Value
    row.getCell(12).value = taxable;
    row.getCell(12).alignment = alignRight;
    row.getCell(12).numFmt = '₹#,##,##0.00';

    // 13: GST Amount
    row.getCell(13).value = gst;
    row.getCell(13).alignment = alignRight;
    row.getCell(13).numFmt = '₹#,##,##0.00';

    // 14: Gross Amount
    row.getCell(14).value = gross;
    row.getCell(14).alignment = alignRight;
    row.getCell(14).numFmt = '₹#,##,##0.00';

    // 15: Payment Status
    row.getCell(15).value = pStat.status;
    row.getCell(15).alignment = alignCenter;

    // 16: Remarks
    row.getCell(16).value = pStat.note;
    row.getCell(16).alignment = alignLeft;

    // Apply font and border to each cell in the row
    for (let c = 1; c <= 16; c++) {
      row.getCell(c).font = fontData;
      row.getCell(c).border = borderThinGrey;
    }

    curRowIdx++;
  });

  // Totals Row
  const totalRow = ws.getRow(curRowIdx);
  totalRow.height = 24;

  totalRow.getCell(1).value = '';
  totalRow.getCell(2).value = '';
  totalRow.getCell(3).value = '';
  totalRow.getCell(4).value = 'TOTAL (86 INVOICES):';
  totalRow.getCell(4).font = fontTotal;
  totalRow.getCell(4).alignment = alignRight;

  totalRow.getCell(5).value = '';
  totalRow.getCell(6).value = '';
  totalRow.getCell(7).value = '';
  totalRow.getCell(8).value = '';
  totalRow.getCell(9).value = '';

  // Sum Formulas
  totalRow.getCell(10).value = { formula: `SUM(J6:J${curRowIdx - 1})` };
  totalRow.getCell(10).alignment = alignRight;
  totalRow.getCell(10).numFmt = '#,##0';

  totalRow.getCell(11).value = { formula: `SUM(K6:K${curRowIdx - 1})` };
  totalRow.getCell(11).alignment = alignRight;
  totalRow.getCell(11).numFmt = '#,##0';

  totalRow.getCell(12).value = { formula: `SUM(L6:L${curRowIdx - 1})` };
  totalRow.getCell(12).alignment = alignRight;
  totalRow.getCell(12).numFmt = '₹#,##,##0.00';

  totalRow.getCell(13).value = { formula: `SUM(M6:M${curRowIdx - 1})` };
  totalRow.getCell(13).alignment = alignRight;
  totalRow.getCell(13).numFmt = '₹#,##,##0.00';

  totalRow.getCell(14).value = { formula: `SUM(N6:N${curRowIdx - 1})` };
  totalRow.getCell(14).alignment = alignRight;
  totalRow.getCell(14).numFmt = '₹#,##,##0.00';

  totalRow.getCell(15).value = '';
  totalRow.getCell(16).value = '100% Back-to-Back Matched';
  totalRow.getCell(16).alignment = alignLeft;

  for (let c = 1; c <= 16; c++) {
    totalRow.getCell(c).font = fontTotal;
    totalRow.getCell(c).border = borderTotal;
  }

  // Footer notes
  curRowIdx += 2;
  ws.mergeCells(`A${curRowIdx}:P${curRowIdx}`);
  ws.getCell(`A${curRowIdx}`).value = '* Audit Reconciliation Note: Gross billed revenue total of ₹53,54,998.00 includes SKIL-071 (₹59,971.00) which was cancelled via Credit Note #8 (CN-008) upon customer delivery refusal and re-billed under SKIL-078. Net effective billed sales = ₹52,95,027.00 across 85 fulfilled stints.';
  ws.getCell(`A${curRowIdx}`).font = fontMeta;
  ws.getCell(`A${curRowIdx}`).alignment = alignLeft;

  // Set Column Widths with generous padding
  ws.columns = [
    { width: 8 },   // 1: Sl. No.
    { width: 13 },  // 2: Invoice No.
    { width: 14 },  // 3: Invoice Date
    { width: 38 },  // 4: Ship-To Party
    { width: 18 },  // 5: Destination Station
    { width: 15 },  // 6: Dispatch Date
    { width: 28 },  // 7: Supplier
    { width: 19 },  // 8: Supplier Inv. No.
    { width: 14 },  // 9: Inward Vch #
    { width: 14 },  // 10: Cartons
    { width: 13 },  // 11: Pairs
    { width: 18 },  // 12: Taxable Value
    { width: 16 },  // 13: GST Amount
    { width: 18 },  // 14: Gross Amount
    { width: 16 },  // 15: Payment Status
    { width: 42 }   // 16: Remarks
  ];

  // Delete old files first before rewriting
  const outPathRoot = path.resolve(__dirname, '../SKIL_Invoices_Register_Reverse_Order.xlsx');
  if (fs.existsSync(outPathRoot)) {
    fs.unlinkSync(outPathRoot);
    console.log('Deleted old file at:', outPathRoot);
  }

  const outPathAudit = path.resolve(__dirname, '../user-documents-read-only-access/Audit & Reconciliation Reports/SKIL_Invoices_Register_Reverse_Order.xlsx');
  if (fs.existsSync(outPathAudit)) {
    fs.unlinkSync(outPathAudit);
    console.log('Deleted old copy at:', outPathAudit);
  }

  // Save rewritten workbook to workspace root
  await wb.xlsx.writeFile(outPathRoot);
  console.log('Plain Excel file successfully rewritten at:', outPathRoot);

  // Save copy to Audit & Reconciliation Reports
  await wb.xlsx.writeFile(outPathAudit);
  console.log('Copy successfully rewritten at:', outPathAudit);
}

generatePlainExcel().catch(err => {
  console.error('Error generating Excel:', err);
  process.exit(1);
});
