/**
 * ============================================================================
 * SKIL LEDGER — TALLY XML PARSER & NORMALIZER
 * High-performance parser extracting Company, Ledgers, and Vouchers with stable IDs.
 * ============================================================================
 */

const path = require('path');

let XMLParser;
try {
  XMLParser = require('fast-xml-parser').XMLParser;
} catch (e) {
  try {
    XMLParser = require('../../sync-engine/node_modules/fast-xml-parser').XMLParser;
  } catch (e2) {
    XMLParser = require(path.resolve(__dirname, '../../sync-engine/node_modules/fast-xml-parser')).XMLParser;
  }
}

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
      'BILLALLOCATIONS.LIST',
      'LEDGSTREGDETAILS.LIST',
      'LEDMAILINGDETAILS.LIST',
      'CONTACTDETAILS.LIST',
      'ADDRESS'
    ].includes(name);
  }
});

function parseXml(xmlString) {
  try {
    return parser.parse(xmlString || '');
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

function parseTallyDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  const y = dateStr.substring(0, 4);
  const m = dateStr.substring(4, 6);
  const d = dateStr.substring(6, 8);
  return `${y}-${m}-${d}`;
}

class TallyParser {
  // Normalize Company Info
  normalizeCompany(xmlString) {
    const parsed = parseXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    if (!collection) return null;

    const rawList = collection.COMPANY || collection.COMPANYINFO || [];
    const c = Array.isArray(rawList) ? rawList[0] : rawList;
    if (!c) return null;

    return {
      name: extractText(c['@_NAME'] || c.NAME),
      startingFrom: extractText(c.STARTINGFROM),
      booksFrom: extractText(c.BOOKSFROM),
      companyNumber: extractText(c.COMPANYNUMBER),
      gstin: extractText(c.GSTIN),
      stateName: extractText(c.STATENAME)
    };
  }

  // Normalize Ledgers
  normalizeLedgers(xmlString) {
    const parsed = parseXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    if (!collection || !collection.LEDGER) return [];

    const list = Array.isArray(collection.LEDGER) ? collection.LEDGER : [collection.LEDGER];

    return list.map(item => {
      const name = extractText(item['@_NAME'] || item.NAME);
      const parent = extractText(item.PARENT);
      const alterId = parseInt(extractText(item.ALTERID) || '0', 10);
      const guid = extractText(item.GUID);

      // GSTIN resolution
      let gstin = extractText(item.PARTYGSTIN);
      if (!gstin && item['LEDGSTREGDETAILS.LIST']) {
        const gd = item['LEDGSTREGDETAILS.LIST'];
        if (Array.isArray(gd)) {
          for (const g of gd) { if (g.GSTIN) { gstin = extractText(g.GSTIN); break; } }
        } else if (gd && gd.GSTIN) {
          gstin = extractText(gd.GSTIN);
        }
      }

      // Mobile / Phone resolution
      let mobile = extractText(item.MOBILENO) || extractText(item.LEDGERMOBILE);
      if (!mobile && item['CONTACTDETAILS.LIST']) {
        const cd = item['CONTACTDETAILS.LIST'];
        if (Array.isArray(cd)) {
          for (const c of cd) { if (c.PHONENUMBER) { mobile = extractText(c.PHONENUMBER); break; } }
        } else if (cd && cd.PHONENUMBER) {
          mobile = extractText(cd.PHONENUMBER);
        }
      }
      const phone = extractText(item.LEDGERPHONE) || extractText(item.PHONE);

      // Address & State resolution
      let state = extractText(item.STATENAME) || extractText(item.PRIORSTATENAME);
      let pincode = extractText(item.PINCODE);
      let addressLines = [];

      if (item['LEDMAILINGDETAILS.LIST']) {
        const md = item['LEDMAILINGDETAILS.LIST'];
        const targetMd = Array.isArray(md) ? md[0] : md;
        if (targetMd) {
          if (!state && targetMd.STATE) state = extractText(targetMd.STATE);
          if (!pincode && targetMd.PINCODE) pincode = extractText(targetMd.PINCODE);
          if (targetMd['ADDRESS.LIST'] && targetMd['ADDRESS.LIST'].ADDRESS) {
            const a = targetMd['ADDRESS.LIST'].ADDRESS;
            addressLines = Array.isArray(a) ? a.map(extractText) : [extractText(a)];
          }
        }
      }
      if (addressLines.length === 0 && item['ADDRESS.LIST']) {
        const a = item['ADDRESS.LIST'].ADDRESS;
        addressLines = Array.isArray(a) ? a.map(extractText) : (a ? [extractText(a)] : []);
      }

      const openingBal = parseFloat(extractText(item.OPENINGBALANCE) || '0');
      const closingBal = parseFloat(extractText(item.CLOSINGBALANCE) || '0');

      // Classification
      const isDebtor = parent.toLowerCase().includes('sundry debtor');
      const isCreditor = parent.toLowerCase().includes('sundry creditor');
      const isBank = parent.toLowerCase().includes('bank');
      const isCash = parent.toLowerCase().includes('cash');

      return {
        id: guid || `LEDGER-${name}`,
        name,
        parent,
        category: isDebtor ? 'debtor' : (isCreditor ? 'creditor' : (isBank ? 'bank' : (isCash ? 'cash' : 'other'))),
        isDebtor,
        isCreditor,
        openingBalance: isNaN(openingBal) ? 0 : openingBal,
        closingBalance: isNaN(closingBal) ? 0 : closingBal,
        currentOutstanding: Math.abs(isNaN(closingBal) ? 0 : closingBal),
        balanceType: (closingBal < 0) ? 'Dr' : (closingBal > 0 ? 'Cr' : ''),
        gstin: gstin || '',
        state: state || '',
        mobile: mobile || '',
        phone: phone || '',
        pincode: pincode || '',
        address: addressLines.filter(Boolean).join(', '),
        alterId: isNaN(alterId) ? 0 : alterId,
        source: 'tally'
      };
    });
  }

  // Normalize Vouchers
  normalizeVouchers(xmlString) {
    const parsed = parseXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    if (!collection || !collection.VOUCHER) return [];

    const list = Array.isArray(collection.VOUCHER) ? collection.VOUCHER : [collection.VOUCHER];

    return list.map(item => {
      const vchType = extractText(item.VOUCHERTYPENAME);
      const vchNo = extractText(item.VOUCHERNUMBER);
      const rawDate = extractText(item.DATE);
      const isoDate = parseTallyDate(rawDate) || rawDate;
      const guid = extractText(item.GUID);
      const alterId = parseInt(extractText(item.ALTERID) || '0', 10);
      const rawAmount = parseFloat(extractText(item.AMOUNT) || '0');
      const absAmount = Math.abs(isNaN(rawAmount) ? 0 : rawAmount);
      const partyLedgerName = extractText(item.PARTYLEDGERNAME);
      const reference = extractText(item.REFERENCE);
      const narration = extractText(item.NARRATION);

      // Ledger Entries
      const rawLedgers = item['ALLLEDGERENTRIES.LIST'] || [];
      const ledgerEntries = (Array.isArray(rawLedgers) ? rawLedgers : [rawLedgers]).map(le => {
        const leAmt = parseFloat(extractText(le.AMOUNT) || '0');
        return {
          ledgerName: extractText(le.LEDGERNAME),
          amount: Math.abs(isNaN(leAmt) ? 0 : leAmt),
          rawAmount: leAmt,
          isDeemedPositive: extractText(le.ISDEEMEDPOSITIVE) === 'Yes',
          isPartyLedger: extractText(le.ISPARTYLEDGER) === 'Yes'
        };
      });

      // Inventory Entries
      const rawInv = item['ALLINVENTORYENTRIES.LIST'] || [];
      const inventoryEntries = (Array.isArray(rawInv) ? rawInv : [rawInv]).map(ie => {
        const iAmt = parseFloat(extractText(ie.AMOUNT) || '0');
        const iRate = parseFloat(extractText(ie.RATE) || '0');
        const iDisc = parseFloat(extractText(ie.DISCOUNT) || '0');
        return {
          stockItemName: extractText(ie.STOCKITEMNAME),
          actualQty: extractText(ie.ACTUALQTY),
          billedQty: extractText(ie.BILLEDQTY),
          rate: extractText(ie.RATE),
          rateNumeric: isNaN(iRate) ? 0 : iRate,
          amount: Math.abs(isNaN(iAmt) ? 0 : iAmt),
          discount: isNaN(iDisc) ? 0 : iDisc
        };
      });

      // Stable Composite ID
      const stableId = guid ? `TALLY-GUID-${guid}` : `TALLY-${vchType.toUpperCase().replace(/\s+/g, '_')}-${vchNo}-${rawDate}`;

      return {
        id: stableId,
        guid: guid || '',
        source: 'tally',
        voucherType: vchType,
        voucherNumber: vchNo,
        date: isoDate,
        rawDate: rawDate,
        reference: reference || '',
        partyName: partyLedgerName,
        amount: absAmount,
        narration: narration || '',
        alterId: isNaN(alterId) ? 0 : alterId,
        ledgerEntries,
        inventoryEntries
      };
    });
  }
}

module.exports = new TallyParser();
