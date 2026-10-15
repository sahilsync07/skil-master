const fs = require('fs');
const TallyClient = require('./tally-client');
const tc = new TallyClient();

async function run() {
  const tdlContent = fs.readFileSync('../GeneralBill.tdl', 'utf-8');
  
  const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>TestVch</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>SKIL LIFESTYLE LLP</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          ${tdlContent}
          <COLLECTION NAME="TestVch">
            <TYPE>Voucher</TYPE>
            <FILTER>Is42</FILTER>
            <FETCH>VoucherNumber, Amount</FETCH>
            <COMPUTE>VchAmount : $Amount</COMPUTE>
            <COMPUTE>CalcCustTotal : $$Total:CustColAmt + $$Total:CustLedAmt</COMPUTE>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="Is42">$VoucherNumber = "SKIL-042"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  const res = await tc.post(xml);
  console.log(res);
}

run().catch(console.error);
