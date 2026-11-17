const TallyClient = require('./tally-client');
const { XMLParser } = require('fast-xml-parser');

async function checkTallyClosing() {
  const tc = new TallyClient();
  const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>LiveStockClosing</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>SKIL LIFESTYLE LLP</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="LiveStockClosing">
            <TYPE>StockItem</TYPE>
            <FETCH>Name, ClosingBalance, ClosingValue, ClosingRate</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  const xmlRes = await tc.post(xml);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xmlRes);

  let tallyItems = [];
  const coll = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM || parsed?.ENVELOPE?.BODY?.COLLECTION?.STOCKITEM;
  if (coll) {
    tallyItems = Array.isArray(coll) ? coll : [coll];
  }

  console.log(`Total Stock Items in Tally: ${tallyItems.length}`);

  let trulyNonZero = [];
  let exactlyZero = 0;

  function parseTallyQty(qtyStr) {
    if (!qtyStr) return 0;
    const m = String(qtyStr).match(/(-?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }

  tallyItems.forEach(item => {
    const name = item['@_NAME'] || item.NAME;
    const closingBal = item.CLOSINGBALANCE;
    const closingVal = item.CLOSINGVALUE;
    const closingBalText = typeof closingBal === 'object' ? (closingBal['#text'] || '') : String(closingBal || '');
    const closingValNum = typeof closingVal === 'object' ? parseFloat(closingVal['#text'] || 0) : parseFloat(closingVal || 0);
    const qty = parseTallyQty(closingBalText);

    if (Math.abs(qty) > 0.0001 || Math.abs(closingValNum) > 0.01) {
      trulyNonZero.push({
        name,
        closingBalText,
        qty,
        closingValNum
      });
    } else {
      exactlyZero++;
    }
  });

  console.log(`Stock Items with EXACTLY ZERO Stock in Tally: ${exactlyZero}`);
  console.log(`Stock Items with TRULY NON-ZERO Stock in Tally: ${trulyNonZero.length}`);

  if (trulyNonZero.length > 0) {
    console.log('Non zero items:', trulyNonZero);
  }
}

checkTallyClosing().catch(console.error);
