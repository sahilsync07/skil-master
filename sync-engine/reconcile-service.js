const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const db = require('./database');

const folderUpdater = require('./folder-updater');

// 1. Helper to extract text from a PDF
async function extractPdfText(filePath) {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse(new Uint8Array(buf));
  await parser.load();
  const textObj = await parser.getText();
  return textObj.text || '';
}

// 2. Parse Supplier Invoice PDF
function parseSupplierInvoice(text, fileName) {
  let invNo = null;
  const invMatch = text.match(/Inv\.\s*No\.?\s*:\s*([A-Za-z0-9\-\/]+)/i) ||
                   text.match(/Invoice\s*No\.?\s*:\s*([A-Za-z0-9\-\/]+)/i) ||
                   text.match(/XPL\/[0-9]+\/[0-9\-]+/i);
  if (invMatch) invNo = invMatch[1] ? invMatch[1].trim() : invMatch[0].trim();

  // If regex failed, check filename (e.g., 1900402692 - KGN PVM.pdf)
  if (!invNo) {
    const fnMatch = fileName.match(/^([A-Za-z0-9\-\/]+)/);
    if (fnMatch) invNo = fnMatch[1];
  }

  let invDate = null;
  const dateMatch = text.match(/Inv\.\s*Date\s*:\s*([0-9\.\-\/]+)/i) ||
                    text.match(/Dated\s*\n([0-9]+-[A-Za-z]+-[0-9]+)/i);
  if (dateMatch) invDate = dateMatch[1].trim();

  let supplier = 'Unknown Supplier';
  if (text.includes('AJANTA SHOES')) supplier = 'Ajanta Shoes (India) Pvt. Ltd.';
  else if (text.includes('XPANIA FOOTCARE')) supplier = 'Xpania Footcare LLP';

  let consignee = 'Direct / SKIL';
  if (text.includes('K G N FOOTWARE') || text.includes('KGN')) consignee = 'K G N FOOTWARE';
  else if (text.includes('DELIGHT FOOT WEAR') || text.includes('Delight')) consignee = 'DELIGHT FOOT WEAR';
  else if (text.includes('SRI BRUNDABAN') || text.includes('SBE')) consignee = 'M/s Sri Brundabana Enterprises';
  else if (text.includes('SHREE FOOTWEAR') || text.includes('SF')) consignee = 'M/S. SHREE FOOTWEAR';
  else if (text.includes('SUSHILA BOOT HOUSE') || text.includes('Sushila')) consignee = 'M/S SUSHILA BOOT HOUSE';
  else if (text.includes('MAHAVIR SHOE HOUSE') || text.includes('MAHAVIR') || text.includes('Mahavir')) consignee = 'MAHAVIR SHOE HOUSE';

  // Extract Total Amount
  let amount = null;
  const amtMatch = text.match(/Total\s*(?:Amount)?\s*(?:Rs\.)?\s*:\s*([0-9,]+\.[0-9]{2})/i) ||
                   text.match(/Grand\s*Total\s*:\s*([0-9,]+\.[0-9]{2})/i) ||
                   text.match(/Total\s*\n([0-9,]+\.[0-9]{2})/i);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  return {
    fileName,
    invNo: invNo || 'N/A',
    invDate: invDate || 'N/A',
    supplier,
    consignee,
    amount
  };
}

// 3. Parse Bank Statement PDF
function parseBankTransactions(text, fileName) {
  const transactions = [];
  const regex = /(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z0-9]+)\s+([\s\S]*?)(?=(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})|Records from|$)/g;
  let m;

  while ((m = regex.exec(text)) !== null) {
    const [_, date, time, tranId, block] = m;
    const cleanBlock = block.replace(/\s+/g, ' ').trim();
    
    let type = 'Debit';
    let amount = 0;
    
    const numbers = cleanBlock.match(/([0-9,]+\.[0-9]{2})/g);
    if (numbers && numbers.length >= 1) {
      const amtStr = numbers.length >= 2 ? numbers[numbers.length - 2] : numbers[0];
      amount = parseFloat(amtStr.replace(/,/g, ''));
    }
    
    if (cleanBlock.includes('/CR/') || cleanBlock.includes('RTGS:SRI') || cleanBlock.includes('NEFT:SHREE') || cleanBlock.includes('RTGS:SHREE') || cleanBlock.includes('NEFT:SALIM') || cleanBlock.includes('NEFT:K G N') || cleanBlock.includes('K G N') || cleanBlock.includes('SISINTI')) {
      type = 'Credit';
    } else {
      type = 'Debit';
    }

    let category = 'Other';
    let partyDesc = '';
    let description = '';

    if (cleanBlock.includes('DHIRAJ')) {
      category = 'Office Rent';
      partyDesc = 'Dhiraj Agrawal';
      description = 'Office Rent Payment for Office Premises';
    } else if (cleanBlock.includes('AJANTA')) {
      category = 'Supplier Payment';
      partyDesc = 'Ajanta Shoes India Pvt. Ltd.';
      description = 'Supplier Payment / Advance against Purchases';
    } else if (cleanBlock.includes('ATOM')) {
      category = 'Electricity / Utility';
      partyDesc = 'Eastern Power Electricity / Atom Tech';
      description = 'Electricity Charges Payment';
    } else if (cleanBlock.includes('VM RAO')) {
      category = 'Professional Fees';
      partyDesc = 'VM Rao & Co';
      description = 'Accounting / Audit / Legal Fees & GST';
    } else if (cleanBlock.includes('SALIM')) {
      category = type === 'Credit' ? 'Erroneous Receipt' : 'Refund of Erroneous Receipt';
      partyDesc = 'Salim Khan KGN, Rajam';
      description = type === 'Credit' ? 'Excess/Erroneous Payment Received' : 'Refund of Erroneous Payment';
    } else if (cleanBlock.includes('SAHIL') || cleanBlock.includes('SISINTI')) {
      category = 'Capital Introduction';
      partyDesc = cleanBlock.includes('SAHIL') ? 'Sahil Kumar (Partner)' : 'Sisinti Lokanatha Patro (Partner)';
      description = 'Capital Introduced into LLP Union Bank Account';
    } else if (cleanBlock.includes('SRI BRUNDABAN')) {
      category = 'Customer Advance';
      partyDesc = 'M/s Sri Brundabana Enterprises, Rayagada';
      description = 'Customer Advance Received by RTGS';
    } else if (cleanBlock.includes('SHREE FOOTWEAR')) {
      category = 'Customer Collection';
      partyDesc = 'M/S. Shree Footwear';
      description = 'Customer Payment Received by NEFT';
    } else if (cleanBlock.includes('K G N') || cleanBlock.includes('KGN')) {
      category = 'Customer Collection';
      partyDesc = 'K G N FOOTWARE';
      description = 'Customer Payment Received by NEFT';
    }

    transactions.push({
      date,
      time,
      tranId,
      statementFile: fileName,
      category,
      partyDesc,
      description,
      type,
      amount,
      rawContext: cleanBlock.slice(0, 150)
    });
  }

  return transactions;
}

// 3b. Parse Plaintext Union Bank Statement (.txt)
function parseTextBankStatement(text, fileName) {
  const lines = text.split('\n');
  const transactions = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateMatch) {
      const d = line.slice(0, 24).trim().replace(/\//g, '-');
      const remarks = line.slice(24, 52).trim();
      const tranId = line.slice(52, 67).trim();
      const withdrawalStr = line.slice(95, 142).trim().replace(/,/g, '');
      const depositStr = line.slice(142, 170).trim().replace(/,/g, '');

      const isDeposit = depositStr && parseFloat(depositStr) > 0;
      const amount = isDeposit ? parseFloat(depositStr) : parseFloat(withdrawalStr || '0');
      const type = isDeposit ? 'Credit' : 'Debit';

      let extra = '';
      let j = i + 1;
      while (j < lines.length && lines[j].trim() && !lines[j].match(/^\s*\d{2}\/\d{2}\/\d{4}/) && !lines[j].includes('Statement') && !lines[j].includes('Records from')) {
        extra += ' ' + lines[j].trim();
        j++;
      }

      const cleanBlock = (remarks + ' ' + extra).replace(/\s+/g, ' ').trim();

      let category = 'Other';
      let partyDesc = '';
      let description = '';

      if (cleanBlock.includes('DHIRAJ')) {
        category = 'Office Rent';
        partyDesc = 'Dhiraj Agrawal';
        description = 'Office Rent Payment for Office Premises';
      } else if (cleanBlock.includes('AJANTA')) {
        category = 'Supplier Payment';
        partyDesc = 'Ajanta Shoes India Pvt. Ltd.';
        description = 'Supplier Payment / Advance against Purchases';
      } else if (cleanBlock.includes('ATOM')) {
        category = 'Electricity / Utility';
        partyDesc = 'Eastern Power Electricity / Atom Tech';
        description = 'Electricity Charges Payment';
      } else if (cleanBlock.includes('VM RAO')) {
        category = 'Professional Fees';
        partyDesc = 'VM Rao & Co';
        description = 'Accounting / Audit / Legal Fees & GST';
      } else if (cleanBlock.includes('SALIM')) {
        category = type === 'Credit' ? 'Erroneous Receipt' : 'Refund of Erroneous Receipt';
        partyDesc = 'Salim Khan KGN, Rajam';
        description = type === 'Credit' ? 'Excess/Erroneous Payment Received' : 'Refund of Erroneous Payment';
      } else if (cleanBlock.includes('SAHIL') || cleanBlock.includes('SISINTI')) {
        category = 'Capital Introduction';
        partyDesc = cleanBlock.includes('SAHIL') ? 'Sahil Kumar (Partner)' : 'Sisinti Lokanatha Patro (Partner)';
        description = 'Capital Introduced into LLP Union Bank Account';
      } else if (cleanBlock.includes('SRI BRUNDABAN')) {
        category = 'Customer Advance';
        partyDesc = 'M/s Sri Brundabana Enterprises, Rayagada';
        description = 'Customer Advance Received by RTGS';
      } else if (cleanBlock.includes('SHREE FOOTWEAR')) {
        category = 'Customer Collection';
        partyDesc = 'M/S. Shree Footwear';
        description = cleanBlock.includes('RTGS') ? 'Customer Payment Received by RTGS' : 'Customer Payment Received by NEFT';
      }

      transactions.push({
        date: d,
        time: '00:00:00',
        tranId,
        statementFile: fileName,
        category,
        partyDesc,
        description,
        type,
        amount,
        rawContext: cleanBlock.slice(0, 150)
      });
    }
  }

  return transactions;
}

class ReconcileService {
  // 1. Reconcile Supplier Purchases vs Tally
  async reconcilePurchases() {
    const tallyVouchers = Object.values(db.vouchers);
    const tallyPurchases = tallyVouchers.filter(v => (v.voucherType || '').toLowerCase() === 'purchase');

    const purchasesDir = folderUpdater.getPurchasesDir();
    const pdfFiles = fs.existsSync(purchasesDir)
      ? fs.readdirSync(purchasesDir).filter(f => f.toLowerCase().endsWith('.pdf'))
      : [];

    const items = [];

    for (const file of pdfFiles) {
      try {
        const text = await extractPdfText(path.join(purchasesDir, file));
        const invoice = parseSupplierInvoice(text, file);

        // Find match in Tally Purchases
        const match = tallyPurchases.find(tp => {
          const inv = String(invoice.invNo || '').toLowerCase();
          const ref = String(tp.reference || '').toLowerCase();
          const num = String(tp.voucherNumber || '').toLowerCase();
          const narr = String(tp.narration || '').toLowerCase();
          const fn = file.toLowerCase();

          return (
            (inv !== 'n/a' && (ref.includes(inv) || num.includes(inv) || narr.includes(inv) || inv.includes(ref))) ||
            (ref && ref !== '-' && fn.includes(ref))
          );
        });

        items.push({
          ...invoice,
          isEnteredInTally: !!match,
          tallyVoucherNo: match ? match.voucherNumber : null,
          tallyDate: match ? match.date : null,
          tallyAmount: match ? match.amount : null,
          status: match ? 'MATCHED' : 'MISSING_IN_TALLY'
        });
      } catch (err) {
        items.push({
          fileName: file,
          invNo: 'ERROR',
          supplier: 'Error reading PDF',
          consignee: 'N/A',
          isEnteredInTally: false,
          status: 'PARSE_ERROR',
          error: err.message
        });
      }
    }

    // Sort by voucher number if available
    items.sort((a, b) => (parseInt(a.tallyVoucherNo) || 999) - (parseInt(b.tallyVoucherNo) || 999));
    return items;
  }

  // 2. Bill-to-Ship-to ("Purchased vs Sold") Reconciliation
  async reconcileBillToShipTo() {
    const purchaseItems = await this.reconcilePurchases();
    const tallyVouchers = Object.values(db.vouchers);
    const tallySales = tallyVouchers.filter(v => (v.voucherType || '').toLowerCase() === 'sales');

    return purchaseItems.map(p => {
      // In SKIL Master, Purchase #N directly matches Sales #SKIL-00N (padded to 3 digits)
      const expectedSalesNo = p.tallyVoucherNo ? `SKIL-${String(p.tallyVoucherNo).padStart(3, '0')}` : null;
      let matchSale = expectedSalesNo ? tallySales.find(s => s.voucherNumber === expectedSalesNo) : null;

      if (!matchSale) {
        matchSale = tallySales.find(s => {
          const pConsignee = String(p.consignee || '').toLowerCase();
          const sParty = String(s.partyName || '').toLowerCase();
          const pInv = String(p.invNo || '').toLowerCase();
          const sNarr = String(s.narration || '').toLowerCase();

          return (
            (pInv !== 'n/a' && sNarr.includes(pInv)) ||
            (pConsignee !== 'direct / skil' && (
              sParty.includes(pConsignee.slice(0, 8)) ||
              pConsignee.includes(sParty.slice(0, 8))
            ))
          );
        });
      }

      return {
        purchaseFile: p.fileName,
        purchaseVoucherNo: p.tallyVoucherNo,
        supplierInvoiceNo: p.invNo,
        supplierName: p.supplier,
        purchaseAmount: p.amount || p.tallyAmount,
        shipToCustomer: matchSale ? matchSale.partyName : p.consignee,
        purchaseEntered: p.isEnteredInTally,
        salesIssued: !!matchSale,
        salesVoucherNo: matchSale ? matchSale.voucherNumber : 'PENDING',
        salesAmount: matchSale ? matchSale.amount : null,
        salesDate: matchSale ? matchSale.date : null,
        status: (p.isEnteredInTally && !!matchSale) ? 'COMPLETED' : 'ACTION_REQUIRED'
      };
    });
  }

  // 3. Bank Statement Reconciliation (PDF & TXT with deduplication by tranId)
  async reconcileBank() {
    const bankDir = folderUpdater.getBankDir();
    const allFiles = fs.existsSync(bankDir) ? fs.readdirSync(bankDir) : [];
    const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
    const txtFiles = allFiles.filter(f => f.toLowerCase().endsWith('.txt'));

    // Deterministic month sort: July, August, September
    pdfFiles.sort((a, b) => {
      const order = { 'july': 1, 'august': 2, 'september': 3 };
      const aK = Object.keys(order).find(k => a.toLowerCase().includes(k)) || a;
      const bK = Object.keys(order).find(k => b.toLowerCase().includes(k)) || b;
      return (order[aK] || 99) - (order[bK] || 99);
    });

    const allTxns = [];

    // 1. Parse PDF statements
    for (const file of pdfFiles) {
      try {
        const text = await extractPdfText(path.join(bankDir, file));
        const txns = parseBankTransactions(text, file);
        allTxns.push(...txns);
      } catch (err) {
        console.warn(`Error reading bank PDF ${file}:`, err.message);
      }
    }

    // 2. Parse TXT statements
    for (const file of txtFiles) {
      try {
        const text = fs.readFileSync(path.join(bankDir, file), 'utf8');
        const txns = parseTextBankStatement(text, file);
        allTxns.push(...txns);
      } catch (err) {
        console.warn(`Error reading bank TXT ${file}:`, err.message);
      }
    }

    // 3. De-duplicate by tranId (prefers TXT or PDF without duplicates)
    const seenTranIds = new Set();
    const uniqueTxns = [];
    for (const t of allTxns) {
      if (!seenTranIds.has(t.tranId)) {
        seenTranIds.add(t.tranId);
        uniqueTxns.push(t);
      }
    }

    const tallyVouchers = Object.values(db.vouchers);
    const matchedVoucherIds = new Set();

    return uniqueTxns.map(t => {
      const match = tallyVouchers.find(v => {
        if (matchedVoucherIds.has(v.id)) return false;
        const vType = String(v.voucherType || '').toLowerCase();
        const expectedType = t.type === 'Credit' ? 'receipt' : 'payment';
        if (vType !== expectedType) return false;

        const amtMatch = Math.abs(v.amount - t.amount) < 1;
        if (!amtMatch) return false;

        // If amount matches, check month/date for recurring entries like Rent or Partner Capital
        const [d, m, y] = t.date.split('-');
        if (t.category === 'Office Rent' && v.date) {
          return v.date.slice(4, 6) === m;
        }

        if (t.category === 'Capital Introduction' && v.narration) {
          const isSahil = t.partyDesc.includes('Sahil');
          const narr = String(v.narration).toLowerCase();
          return isSahil ? narr.includes('sahil') : narr.includes('lokanatha');
        }

        // Verify party compatibility if partyDesc is specified
        if (t.partyDesc && v.partyName) {
          const pD = t.partyDesc.toLowerCase();
          const pV = v.partyName.toLowerCase();
          if (pD.includes('ajanta') && !pV.includes('ajanta')) return false;
          if (pD.includes('shree') && !pV.includes('shree')) return false;
          if ((pD.includes('k g n') || pD.includes('kgn')) && !pV.includes('k g n') && !pV.includes('kgn')) return false;
        }

        return true;
      });

      if (match) {
        matchedVoucherIds.add(match.id);
      }

      return {
        ...t,
        isEnteredInTally: !!match,
        tallyVoucherNo: match ? match.voucherNumber : null,
        tallyVoucherType: match ? match.voucherType : null,
        tallyDate: match ? match.date : null,
        tallyParty: match ? match.partyName : null,
        status: match ? 'MATCHED' : 'UNPOSTED_ENTRY'
      };
    });
  }

  // Full Summary Report
  async getFullReport() {
    // Automatically check and update folder timestamps before running audit
    const folderUpdates = folderUpdater.updateAll();

    const [purchases, billToShipTo, bank] = await Promise.all([
      this.reconcilePurchases(),
      this.reconcileBillToShipTo(),
      this.reconcileBank()
    ]);

    const totalPurchases = purchases.length;
    const matchedPurchases = purchases.filter(p => p.isEnteredInTally).length;
    const missingPurchases = totalPurchases - matchedPurchases;

    const totalBillToShip = billToShipTo.length;
    const completedBillToShip = billToShipTo.filter(b => b.status === 'COMPLETED').length;

    const totalBank = bank.length;
    const matchedBank = bank.filter(b => b.isEnteredInTally).length;
    const unpostedBank = totalBank - matchedBank;

    return {
      auditedAt: new Date().toISOString(),
      folders: folderUpdates,
      summary: {
        totalSupplierInvoices: totalPurchases,
        purchasesMatched: matchedPurchases,
        purchasesMissingInTally: missingPurchases,
        totalBillToShipTo: totalBillToShip,
        completedBillToShipTo: completedBillToShip,
        totalBankTransactions: totalBank,
        matchedBankTransactions: matchedBank,
        unpostedBankEntries: unpostedBank
      },
      purchases,
      billToShipTo,
      bank
    };
  }
}

module.exports = new ReconcileService();