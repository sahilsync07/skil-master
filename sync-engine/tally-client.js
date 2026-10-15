const http = require('http');

class TallyClient {
  constructor(options = {}) {
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 9000;
    this.timeout = options.timeout || 8000;
    this.interRequestDelayMs = 60; // Brief delay to let Tally single-thread socket recycle
  }

  // Raw HTTP POST with retry for ECONNRESET / socket recycling
  async post(xmlPayload, maxRetries = 3) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const result = await this._rawRequest(xmlPayload);
        if (this.interRequestDelayMs > 0) {
          await new Promise(r => setTimeout(r, this.interRequestDelayMs));
        }
        return result;
      } catch (err) {
        lastError = err;
        // If ECONNRESET or socket hangup, wait and retry
        if (err.message.includes('ECONNRESET') || err.message.includes('socket hang up') || err.message.includes('ECONNREFUSED')) {
          await new Promise(r => setTimeout(r, 120 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  _rawRequest(xmlPayload) {
    return new Promise((resolve, reject) => {
      const trimmed = (xmlPayload || '').trim();
      const payloadBuffer = Buffer.from(trimmed, 'utf-8');

      const req = http.request({
        hostname: this.host,
        port: this.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': payloadBuffer.length,
          'Connection': 'close'
        },
        timeout: this.timeout
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`Tally returned HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Tally request timed out after ${this.timeout}ms`));
      });

      req.on('error', (err) => {
        reject(new Error(`Connection to Tally at ${this.host}:${this.port} failed: ${err.message}`));
      });

      req.write(payloadBuffer);
      req.end();
    });
  }

  // 1. Health check & List of Companies
  async checkHealth() {
    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CompanySummary</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CompanySummary">
            <TYPE>Company</TYPE>
            <FETCH>Name, BooksFrom, StartingFrom, CompanyNumber, GSTIN</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
    return await this.post(xml);
  }

  // 2. Company Details
  async getCompanyInfo(companyName) {
    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CompanyInfo</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CompanyInfo">
            <TYPE>Company</TYPE>
            <FETCH>Name, StartingFrom, BooksFrom, CompanyNumber, GSTIN, StateName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
    return await this.post(xml);
  }

  // 3. Ledgers (Incremental via AlterID)
  async getLedgers(companyName, minAlterId = 0) {
    const filterXml = minAlterId > 0 
      ? `<FILTER>AlterFilter</FILTER>` 
      : '';
    const formulaXml = minAlterId > 0 
      ? `<SYSTEM TYPE="Formulae" NAME="AlterFilter">$AlterID > ${minAlterId}</SYSTEM>` 
      : '';

    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SyncLedgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SyncLedgers">
            <TYPE>Ledger</TYPE>
            <FETCH>Name, Parent, OpeningBalance, ClosingBalance, PartyGSTIN, StateName, Email, MobileNo, AlterID, Guid</FETCH>
            ${filterXml}
          </COLLECTION>
          ${formulaXml}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
    return await this.post(xml);
  }

  // 4. Stock Items (Incremental via AlterID)
  async getStockItems(companyName, minAlterId = 0) {
    const filterXml = minAlterId > 0 
      ? `<FILTER>AlterFilter</FILTER>` 
      : '';
    const formulaXml = minAlterId > 0 
      ? `<SYSTEM TYPE="Formulae" NAME="AlterFilter">$AlterID > ${minAlterId}</SYSTEM>` 
      : '';

    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SyncStockItems</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SyncStockItems">
            <TYPE>StockItem</TYPE>
            <FETCH>Name, Parent, BaseUnits, AdditionalUnits, OpeningBalance, OpeningValue, AlterID, Guid</FETCH>
            ${filterXml}
          </COLLECTION>
          ${formulaXml}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
    return await this.post(xml);
  }

  // 5. Units of Measure
  async getUnits(companyName) {
    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SyncUnits</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SyncUnits">
            <TYPE>Unit</TYPE>
            <FETCH>Name, IsSimpleUnit, OriginalName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
    return await this.post(xml);
  }

  // 6. Groups (Account Groups)
  async getGroups(companyName) {
    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SyncGroups</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SyncGroups">
            <TYPE>Group</TYPE>
            <FETCH>Name, Parent</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
    return await this.post(xml);
  }

  // 7. Vouchers (Incremental via AlterID)
  async getVouchers(companyName, minAlterId = 0) {
    const filterXml = minAlterId > 0 
      ? `<FILTER>AlterFilter</FILTER>` 
      : '';
    const formulaXml = minAlterId > 0 
      ? `<SYSTEM TYPE="Formulae" NAME="AlterFilter">$AlterID > ${minAlterId}</SYSTEM>` 
      : '';

    const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SyncVouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SyncVouchers">
            <TYPE>Voucher</TYPE>
            <FETCH>Date, VoucherTypeName, VoucherNumber, Reference, PartyLedgerName, Amount, Narration, AlterID, Guid, AllLedgerEntries.*, AllInventoryEntries.*</FETCH>
            ${filterXml}
          </COLLECTION>
          ${formulaXml}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
    return await this.post(xml);
  }
}

module.exports = TallyClient;