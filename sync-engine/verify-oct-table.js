const fs = require('fs');

// We have 23 items in October
// 22 items from Inv 1900422215
// 1 item from Inv 1900424231

const octItems = [
  // Inv 1900422215
  { inv: '1900422215', desc: '1CARINA/2 (PVSK) SZ-3X6 (60)/J1', mrp: 128, landed: 80.69, exp: 80.00, diff: -0.69, pairs: 120, total: -82.80 },
  { inv: '1900422215', desc: '1CARINA/2 (PVSK) SZ-3X7 (60)/J1', mrp: 128, landed: 80.69, exp: 80.00, diff: -0.69, pairs: 300, total: -207.00 },
  { inv: '1900422215', desc: '1CARINA/2 (PVSK) SZ-4X7 (60)/J1', mrp: 128, landed: 80.69, exp: 80.00, diff: -0.69, pairs: 120, total: -82.80 },
  { inv: '1900422215', desc: '1CARINA/2 (PVSK) SZ-5X8 (60)/J1', mrp: 128, landed: 80.69, exp: 80.00, diff: -0.69, pairs: 120, total: -82.80 },
  { inv: '1900422215', desc: '1CEL 1023 DP.S.BLUE SZ-3X6 (60)/J1', mrp: 120, landed: 75.65, exp: 75.00, diff: -0.65, pairs: 180, total: -117.00 },
  { inv: '1900422215', desc: '1CEL 1023 S.GREEN SZ-4X7 (60)/J1', mrp: 120, landed: 75.65, exp: 75.00, diff: -0.65, pairs: 180, total: -117.00 },
  { inv: '1900422215', desc: '1CEL 1026 S.GREEN SZ-4X7 (60)/J1', mrp: 120, landed: 75.65, exp: 75.00, diff: -0.65, pairs: 60, total: -39.00 },
  { inv: '1900422215', desc: '1CEL 103 DP.BLUE SZ-5X8 (60)/J1', mrp: 127, landed: 80.06, exp: 79.38, diff: -0.68, pairs: 60, total: -40.80 },
  { inv: '1900422215', desc: '1CEL 105 MAGENTA SZ-4X7 (60)/J1', mrp: 127, landed: 80.06, exp: 79.38, diff: -0.68, pairs: 180, total: -122.40 },
  { inv: '1900422215', desc: '1CEL 108 MAGENTA SZ-5X7 (60)/J1', mrp: 127, landed: 80.06, exp: 79.38, diff: -0.68, pairs: 120, total: -81.60 },
  { inv: '1900422215', desc: '1CEL 108 ONION SZ-5X7 (60)/J1', mrp: 127, landed: 80.06, exp: 79.38, diff: -0.68, pairs: 120, total: -81.60 },
  { inv: '1900422215', desc: '1CEL 108 S.GREEN SZ-3X6 (60)/J1', mrp: 127, landed: 80.06, exp: 79.38, diff: -0.68, pairs: 60, total: -40.80 },
  { inv: '1900422215', desc: '1CEL 110 ONION SZ-5X7 (60)/J1', mrp: 127, landed: 80.06, exp: 79.38, diff: -0.68, pairs: 180, total: -122.40 },
  { inv: '1900422215', desc: '1CEL 110 S.GREEN SZ-3X6 (60)/J1', mrp: 127, landed: 80.06, exp: 79.38, diff: -0.68, pairs: 60, total: -40.80 },
  { inv: '1900422215', desc: '1CEL PLUS 01 DK.CYAN SZ-5X7 (60)/J1', mrp: 134, landed: 84.47, exp: 83.75, diff: -0.72, pairs: 60, total: -43.20 },
  { inv: '1900422215', desc: '1FEMINA NP 55 MAGENTA SZ-11X2(60)/J1', mrp: 126, landed: 79.43, exp: 78.75, diff: -0.68, pairs: 120, total: -81.60 },
  { inv: '1900422215', desc: '1FEMINA NP 60 MAGENTA SZ-11X02(60)/J1', mrp: 126, landed: 79.43, exp: 78.75, diff: -0.68, pairs: 120, total: -81.60 },
  { inv: '1900422215', desc: '1FEMINA NP 75 N.BLUE SZ-3X6(60)/J1', mrp: 140, landed: 88.26, exp: 87.50, diff: -0.76, pairs: 60, total: -45.60 },
  { inv: '1900422215', desc: '1FEMINA NP 76 F.GREEN SZ-5X7(60)/J1', mrp: 140, landed: 88.26, exp: 87.50, diff: -0.76, pairs: 120, total: -91.20 },
  { inv: '1900422215', desc: '1FEMINA NP 86 WINE SZ-3X6(60)/J1', mrp: 140, landed: 88.26, exp: 87.50, diff: -0.76, pairs: 60, total: -45.60 },
  { inv: '1900422215', desc: '1FEMINA NP 86 WINE SZ-5X7(60)/J1', mrp: 140, landed: 88.26, exp: 87.50, diff: -0.76, pairs: 120, total: -91.20 },
  { inv: '1900422215', desc: '1FEMINA NP 77 D.PINK SZ-4X7(60)/J1', mrp: 140, landed: 88.26, exp: 87.50, diff: -0.76, pairs: 120, total: -91.20 },
  // Inv 1900424231
  { inv: '1900424231', desc: '1CEL 1023 MAGENTA SZ-5X8 (60)/J1', mrp: 120, landed: 75.65, exp: 75.00, diff: -0.65, pairs: 60, total: -39.00 }
];

console.log('Total items in October:', octItems.length);
let sumPairs = 0;
let sumTotalDiff = 0;

octItems.forEach((x, i) => {
  sumPairs += x.pairs;
  sumTotalDiff += x.total;
  const netMarginPct = ((x.mrp - x.landed) / x.mrp * 100).toFixed(2) + '%';
  // Check calculations
  const calcDiff = Math.round((x.exp - x.landed) * 100) / 100;
  const calcTotal = Math.round(calcDiff * x.pairs * 100) / 100;
  if (calcDiff !== x.diff || calcTotal !== x.total) {
    console.error(`Mismatch at line ${i+1}: calcDiff=${calcDiff}, diff=${x.diff}, calcTotal=${calcTotal}, total=${x.total}`);
  }
});

console.log('Total pairs:', sumPairs);
console.log('Total difference (Sum of Column I):', sumTotalDiff.toFixed(2));
