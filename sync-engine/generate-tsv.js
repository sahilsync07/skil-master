const fs = require('fs');

const octItems = [
  { inv: '1900422215', desc: '1CARINA/2 (PVSK) SZ-3X6 (60)/J1', mrp: 128, landed: 80.69, netMargin: '36.96%', exp: 80, diff: -0.69, pairs: 120, total: -82.8 },
  { inv: '1900422215', desc: '1CARINA/2 (PVSK) SZ-3X7 (60)/J1', mrp: 128, landed: 80.69, netMargin: '36.96%', exp: 80, diff: -0.69, pairs: 300, total: -207 },
  { inv: '1900422215', desc: '1CARINA/2 (PVSK) SZ-4X7 (60)/J1', mrp: 128, landed: 80.69, netMargin: '36.96%', exp: 80, diff: -0.69, pairs: 120, total: -82.8 },
  { inv: '1900422215', desc: '1CARINA/2 (PVSK) SZ-5X8 (60)/J1', mrp: 128, landed: 80.69, netMargin: '36.96%', exp: 80, diff: -0.69, pairs: 120, total: -82.8 },
  { inv: '1900422215', desc: '1CEL 1023 DP.S.BLUE SZ-3X6 (60)/J1', mrp: 120, landed: 75.65, netMargin: '36.96%', exp: 75, diff: -0.65, pairs: 180, total: -117 },
  { inv: '1900422215', desc: '1CEL 1023 S.GREEN SZ-4X7 (60)/J1', mrp: 120, landed: 75.65, netMargin: '36.96%', exp: 75, diff: -0.65, pairs: 180, total: -117 },
  { inv: '1900422215', desc: '1CEL 1026 S.GREEN SZ-4X7 (60)/J1', mrp: 120, landed: 75.65, netMargin: '36.96%', exp: 75, diff: -0.65, pairs: 60, total: -39 },
  { inv: '1900422215', desc: '1CEL 103 DP.BLUE SZ-5X8 (60)/J1', mrp: 127, landed: 80.06, netMargin: '36.96%', exp: 79.38, diff: -0.68, pairs: 60, total: -40.8 },
  { inv: '1900422215', desc: '1CEL 105 MAGENTA SZ-4X7 (60)/J1', mrp: 127, landed: 80.06, netMargin: '36.96%', exp: 79.38, diff: -0.68, pairs: 180, total: -122.4 },
  { inv: '1900422215', desc: '1CEL 108 MAGENTA SZ-5X7 (60)/J1', mrp: 127, landed: 80.06, netMargin: '36.96%', exp: 79.38, diff: -0.68, pairs: 120, total: -81.6 },
  { inv: '1900422215', desc: '1CEL 108 ONION SZ-5X7 (60)/J1', mrp: 127, landed: 80.06, netMargin: '36.96%', exp: 79.38, diff: -0.68, pairs: 120, total: -81.6 },
  { inv: '1900422215', desc: '1CEL 108 S.GREEN SZ-3X6 (60)/J1', mrp: 127, landed: 80.06, netMargin: '36.96%', exp: 79.38, diff: -0.68, pairs: 60, total: -40.8 },
  { inv: '1900422215', desc: '1CEL 110 ONION SZ-5X7 (60)/J1', mrp: 127, landed: 80.06, netMargin: '36.96%', exp: 79.38, diff: -0.68, pairs: 180, total: -122.4 },
  { inv: '1900422215', desc: '1CEL 110 S.GREEN SZ-3X6 (60)/J1', mrp: 127, landed: 80.06, netMargin: '36.96%', exp: 79.38, diff: -0.68, pairs: 60, total: -40.8 },
  { inv: '1900422215', desc: '1CEL PLUS 01 DK.CYAN SZ-5X7 (60)/J1', mrp: 134, landed: 84.47, netMargin: '36.96%', exp: 83.75, diff: -0.72, pairs: 60, total: -43.2 },
  { inv: '1900422215', desc: '1FEMINA NP 55 MAGENTA SZ-11X2(60)/J1', mrp: 126, landed: 79.43, netMargin: '36.96%', exp: 78.75, diff: -0.68, pairs: 120, total: -81.6 },
  { inv: '1900422215', desc: '1FEMINA NP 60 MAGENTA SZ-11X02(60)/J1', mrp: 126, landed: 79.43, netMargin: '36.96%', exp: 78.75, diff: -0.68, pairs: 120, total: -81.6 },
  { inv: '1900422215', desc: '1FEMINA NP 75 N.BLUE SZ-3X6(60)/J1', mrp: 140, landed: 88.26, netMargin: '36.96%', exp: 87.5, diff: -0.76, pairs: 60, total: -45.6 },
  { inv: '1900422215', desc: '1FEMINA NP 76 F.GREEN SZ-5X7(60)/J1', mrp: 140, landed: 88.26, netMargin: '36.96%', exp: 87.5, diff: -0.76, pairs: 120, total: -91.2 },
  { inv: '1900422215', desc: '1FEMINA NP 86 WINE SZ-3X6(60)/J1', mrp: 140, landed: 88.26, netMargin: '36.96%', exp: 87.5, diff: -0.76, pairs: 60, total: -45.6 },
  { inv: '1900422215', desc: '1FEMINA NP 86 WINE SZ-5X7(60)/J1', mrp: 140, landed: 88.26, netMargin: '36.96%', exp: 87.5, diff: -0.76, pairs: 120, total: -91.2 },
  { inv: '1900422215', desc: '1FEMINA NP 77 D.PINK SZ-4X7(60)/J1', mrp: 140, landed: 88.26, netMargin: '36.96%', exp: 87.5, diff: -0.76, pairs: 120, total: -91.2 },
  { inv: '1900424231', desc: '1CEL 1023 MAGENTA SZ-5X8 (60)/J1', mrp: 120, landed: 75.65, netMargin: '36.96%', exp: 75, diff: -0.65, pairs: 60, total: -39 }
];

const lines = [];
// Row 21: Month header
lines.push('October\t\t\t\t\t\t\t\t');
// Rows 22 to 44: Items
octItems.forEach(it => {
  lines.push([
    it.inv,
    it.desc,
    it.mrp,
    it.landed,
    it.netMargin,
    it.exp,
    it.diff,
    it.pairs,
    it.total
  ].join('\t'));
});
// Row 45: Total row
lines.push('\t\t\t\t\t\t\t\t-1869');

const tsvContent = lines.join('\n');
fs.writeFileSync('sync-engine/october_paste_A21.tsv', tsvContent);
console.log('TSV written. Total lines:', lines.length);
console.log(tsvContent);
