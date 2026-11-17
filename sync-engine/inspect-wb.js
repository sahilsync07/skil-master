const ExcelJS = require('./node_modules/exceljs');

async function inspectWorkbook() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('c:/Projects/SKIL Master/user-documents-read-only-access/Audit & Reconciliation Reports/SKIL_Master_Financial_Tracker_FY2026-27.xlsx');
  console.log('Worksheet names in Master Tracker:');
  wb.worksheets.forEach(ws => console.log(' - ' + ws.name));
}

inspectWorkbook().catch(console.error);
