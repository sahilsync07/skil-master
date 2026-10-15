const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => {
    return [
      'COMPANY',
      'LEDGER',
      'STOCKITEM',
      'UNIT',
      'GROUP',
      'VOUCHER',
      'ALLLEDGERENTRIES.LIST',
      'ALLINVENTORYENTRIES.LIST',
      'BATCHALLOCATIONS.LIST',
      'BILLALLOCATIONS.LIST'
    ].includes(name);
  }
});

function parseXml(xmlString) {
  try {
    return parser.parse(xmlString);
  } catch (err) {
    throw new Error(`XML Parsing error: ${err.message}`);
  }
}

function extractText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val['#text'] !== undefined) return String(val['#text']).trim();
    return '';
  }
  return String(val).trim();
}

function normalizeCompanies(xmlString) {
  const parsed = parseXml(xmlString);
  const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!collection || !collection.COMPANY) return [];
  const companies = Array.isArray(collection.COMPANY) ? collection.COMPANY : [collection.COMPANY];
  return companies.map(c => ({
    name: extractText(c['@_NAME'] || c.NAME),
    isGstOn: extractText(c.ISGSTON) === 'Yes',
    numGstTaxUnit: parseInt(extractText(c.NUMGSTTAXUNIT) || '0', 10)
  }));
}

function normalizeCompanyInfo(xmlString) {
  const parsed = parseXml(xmlString);
  const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!collection || !collection.COMPANY) return null;
  const c = Array.isArray(collection.COMPANY) ? collection.COMPANY[0] : collection.COMPANY;
  return {
    name: extractText(c['@_NAME'] || c.NAME),
    startingFrom: extractText(c.STARTINGFROM),
    booksFrom: extractText(c.BOOKSFROM),
    companyNumber: extractText(c.COMPANYNUMBER),
    gstin: extractText(c.GSTIN),
    stateName: extractText(c.STATENAME)
  };
}

function normalizeLedgers(xmlString) {
  const parsed = parseXml(xmlString);
  const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!collection || !collection.LEDGER) return [];
  const list = Array.isArray(collection.LEDGER) ? collection.LEDGER : [collection.LEDGER];

  return list.map(item => {
    const alterId = parseInt(extractText(item.ALTERID) || '0', 10);
    return {
      id: extractText(item.GUID || item['@_NAME'] || item.NAME),
      name: extractText(item['@_NAME'] || item.NAME),
      parent: extractText(item.PARENT),
      openingBalance: parseFloat(extractText(item.OPENINGBALANCE) || '0'),
      closingBalance: parseFloat(extractText(item.CLOSINGBALANCE) || '0'),
      gstin: extractText(item.PARTYGSTIN),
      state: extractText(item.STATENAME),
      email: extractText(item.EMAIL),
      mobile: extractText(item.MOBILENO),
      alterId: isNaN(alterId) ? 0 : alterId,
      raw: item
    };
  });
}

function normalizeStockItems(xmlString) {
  const parsed = parseXml(xmlString);
  const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!collection || !collection.STOCKITEM) return [];
  const list = Array.isArray(collection.STOCKITEM) ? collection.STOCKITEM : [collection.STOCKITEM];

  return list.map(item => {
    const alterId = parseInt(extractText(item.ALTERID) || '0', 10);
    return {
      id: extractText(item.GUID || item['@_NAME'] || item.NAME),
      name: extractText(item['@_NAME'] || item.NAME),
      stockGroup: extractText(item.PARENT),
      baseUnit: extractText(item.BASEUNITS),
      additionalUnit: extractText(item.ADDITIONALUNITS),
      openingBalance: extractText(item.OPENINGBALANCE),
      openingValue: parseFloat(extractText(item.OPENINGVALUE) || '0'),
      alterId: isNaN(alterId) ? 0 : alterId,
      raw: item
    };
  });
}

function normalizeUnits(xmlString) {
  const parsed = parseXml(xmlString);
  const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!collection || !collection.UNIT) return [];
  const list = Array.isArray(collection.UNIT) ? collection.UNIT : [collection.UNIT];
  return list.map(u => ({
    name: extractText(u['@_NAME'] || u.NAME),
    isSimple: extractText(u.ISSIMPLEUNIT) === 'Yes',
    originalName: extractText(u.ORIGINALNAME)
  }));
}

function normalizeGroups(xmlString) {
  const parsed = parseXml(xmlString);
  const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!collection || !collection.GROUP) return [];
  const list = Array.isArray(collection.GROUP) ? collection.GROUP : [collection.GROUP];
  return list.map(g => ({
    name: extractText(g['@_NAME'] || g.NAME),
    parent: extractText(g.PARENT)
  }));
}

function normalizeVouchers(xmlString) {
  const parsed = parseXml(xmlString);
  const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
  if (!collection || !collection.VOUCHER) return [];
  const list = Array.isArray(collection.VOUCHER) ? collection.VOUCHER : [collection.VOUCHER];

  return list.map(v => {
    const alterId = parseInt(extractText(v.ALTERID) || '0', 10);

    // Parse ledger entries
    const rawLedgers = v['ALLLEDGERENTRIES.LIST'] || [];
    const ledgerList = Array.isArray(rawLedgers) ? rawLedgers : [rawLedgers];
    const ledgerEntries = ledgerList.filter(le => le && typeof le === 'object').map(le => ({
      ledgerName: extractText(le.LEDGERNAME),
      amount: parseFloat(extractText(le.AMOUNT) || '0'),
      isDeemedPositive: extractText(le.ISDEEMEDPOSITIVE) === 'Yes',
      isPartyLedger: extractText(le.ISPARTYLEDGER) === 'Yes'
    }));

    const voucherNumber = extractText(v.VOUCHERNUMBER);
    const voucherType = extractText(v.VOUCHERTYPENAME);
    const date = extractText(v.DATE);
    const reference = extractText(v.REFERENCE);
    const partyName = extractText(v.PARTYLEDGERNAME);
    const narration = extractText(v.NARRATION);
    const guid = extractText(v.GUID);

    // Extract total net voucher amount (exact bill amount inclusive of Round-Off)
    let amount = 0;
    const partyLedger = ledgerEntries.find(le => le.isPartyLedger || (partyName && le.ledgerName.toLowerCase() === partyName.toLowerCase()));
    if (partyLedger && !isNaN(partyLedger.amount) && partyLedger.amount !== 0) {
      amount = Math.abs(partyLedger.amount);
    } else {
      const headerAmt = Math.abs(parseFloat(extractText(v.AMOUNT) || '0'));
      if (headerAmt && !isNaN(headerAmt)) {
        amount = headerAmt;
      } else {
        let totalDebits = 0;
        let totalCredits = 0;
        for (const le of ledgerEntries) {
          if (le.amount > 0) totalDebits += le.amount;
          else totalCredits += Math.abs(le.amount);
        }
        amount = Math.max(totalDebits, totalCredits);
      }
    }
    amount = Math.round(amount * 100) / 100;

    // Parse inventory entries
    const rawInv = v['ALLINVENTORYENTRIES.LIST'] || [];
    const invList = Array.isArray(rawInv) ? rawInv : [rawInv];
    const inventoryEntries = invList.filter(ie => ie && typeof ie === 'object').map(ie => ({
      stockItemName: extractText(ie.STOCKITEMNAME),
      actualQty: extractText(ie.ACTUALQTY),
      billedQty: extractText(ie.BILLEDQTY),
      rate: extractText(ie.RATE),
      amount: parseFloat(extractText(ie.AMOUNT) || '0'),
      discount: parseFloat(extractText(ie.DISCOUNT) || '0')
    }));

    return {
      id: guid || `${voucherType}-${voucherNumber}-${date}`,
      date,
      voucherType,
      voucherNumber,
      reference,
      partyName,
      amount,
      narration,
      alterId: isNaN(alterId) ? 0 : alterId,
      ledgerEntries,
      inventoryEntries,
      raw: v
    };
  });
}

module.exports = {
  parseXml,
  normalizeCompanies,
  normalizeCompanyInfo,
  normalizeLedgers,
  normalizeStockItems,
  normalizeUnits,
  normalizeGroups,
  normalizeVouchers
};