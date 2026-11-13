const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'android-app', 'www', 'index.html');
const syncFilePath = path.join(__dirname, 'public', 'index.html');

let html = fs.readFileSync(filePath, 'utf8');

const target = '  <!-- Application Logic -->';
const modalHtml = `  <!-- ======================================================== -->
  <!-- CUSTOMER SETTLEMENT & WHATSAPP + PDF DISPATCH MODAL -->
  <!-- ======================================================== -->
  <div class="modal-backdrop" id="customerSettlementModal" style="display: none;">
    <div class="modal-box settlement-modal-box" style="max-width: 920px; width: 95%;">
      <div class="modal-header" style="background: #0F172A; color: #FFFFFF; border-radius: 14px 14px 0 0; padding: 18px 24px;">
        <div class="modal-title-wrap">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge-pill" style="background: #22C55E; color: #FFFFFF; font-weight: 800; font-size: 10.5px;">WHATSAPP & PDF DISPATCH</span>
            <h3 style="font-size: 18px; font-weight: 800; color: #FFFFFF; margin: 0;" id="settleModalPartyName">Party Settlement</h3>
          </div>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94A3B8;" id="settleModalPartyMeta">
            GSTIN: — &bull; Ledger Balance: ₹0
          </p>
        </div>
        <button class="modal-close-btn" id="btnCloseSettlementModal" style="color: #CBD5E1;">
          <i data-lucide="x" style="width: 20px; height: 20px;"></i>
        </button>
      </div>

      <div class="modal-body settlement-modal-body" style="padding: 20px;">
        <div class="settlement-dual-grid">
          <!-- Left Column: Bill Checkboxes & Math Breakdown -->
          <div class="settlement-col-left">
            <div class="settlement-config-box">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <label style="font-size: 13px; font-weight: 800; color: #0F172A;">Select Bills to Include in Settlement</label>
                <button type="button" class="btn-text-action" id="btnToggleAllSettleBills" style="background: none; border: none; font-size: 12px; font-weight: 700; color: #0284C7; cursor: pointer;">Toggle All</button>
              </div>

              <!-- Bills Checklist Container -->
              <div class="settlement-bills-checklist" id="settleBillsChecklist" style="max-height: 220px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px; margin-bottom: 12px;">
                <!-- Populated dynamically -->
              </div>

              <!-- Discount & Historical Balances Configuration -->
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; margin-bottom: 14px;">
                <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: #1E293B; cursor: pointer; margin-bottom: 10px;">
                  <input type="checkbox" id="chkApply5Cd" checked style="margin-top: 3px; accent-color: #16A34A;">
                  <span>Apply <strong>5% Cash Discount (CD)</strong> strictly on Taxable Value for qualifying bills (&le; 30 days)</span>
                </label>

                <!-- Old Balance Row -->
                <div style="border-top: 1px dashed #CBD5E1; padding-top: 10px; margin-top: 6px;">
                  <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 6px;">
                    ➕ Add: Old Historical Balance (Net Addition — 0% CD):
                  </label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" id="txtOldBalanceMonth" placeholder="e.g. August" style="width: 110px; padding: 6px 10px; font-size: 12px; border: 1px solid #CBD5E1; border-radius: 6px;">
                    <div style="display: flex; align-items: center; background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 6px; padding: 0 8px;">
                      <span style="font-size: 12px; font-weight: 700; color: #64748B;">+₹</span>
                      <input type="number" id="txtOldBalanceAmt" placeholder="0" style="border: none; outline: none; padding: 6px 4px; font-weight: 700; font-size: 12.5px; width: 110px;">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mathematical Summary Card -->
            <div class="settlement-math-box" style="background: #F1F5F9; border-radius: 12px; padding: 14px; border: 1px solid #CBD5E1;">
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #475569; margin-bottom: 6px;">
                <span>Total of <strong id="settleSelectedCount">0</strong> Bills (Gross):</span>
                <span style="font-weight: 700; color: #0F172A;" id="settleGrossSubtotal">₹0</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #16A34A; margin-bottom: 6px;">
                <span>Less: 5% CD on Taxable (<span id="settleTaxableSubtotal">₹0</span>):</span>
                <span style="font-weight: 800;" id="settleCdDeduction">-₹0</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; color: #0284C7; margin-bottom: 6px; border-top: 1px solid #CBD5E1; padding-top: 6px;">
                <span>👉 Net for Selected Bills:</span>
                <span id="settleNetBills">₹0</span>
              </div>
              <div id="mathOldBalRow" style="display: none; justify-content: space-between; font-size: 12.5px; color: #D97706; margin-bottom: 6px;">
                <span>➕ Add: Old <span id="mathOldBalMonth">Prior</span> Balance (Net):</span>
                <span style="font-weight: 800;" id="mathOldBalAmt">+₹0</span>
              </div>
              <div style="border-top: 2px solid #0F172A; margin: 8px 0 6px 0;"></div>
              <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #0F172A;">
                <span>👉 TOTAL TO TRANSFER:</span>
                <span style="color: #DC2626; font-size: 18px;" id="settleFinalPayable">₹0</span>
              </div>
            </div>
          </div>

          <!-- Right Column: Live WhatsApp Markdown Preview & Actions -->
          <div class="settlement-col-right">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 12.5px; font-weight: 800; color: #15803D; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="message-circle" style="width: 15px; height: 15px;"></i> WhatsApp Markdown Preview
              </span>
              <span class="badge-pill badge-neutral" style="font-size: 10px;">SKIL Canonical Standard</span>
            </div>

            <textarea class="whatsapp-preview-textarea" id="txtWhatsAppPreview" readonly style="width: 100%; height: 260px; font-family: monospace; font-size: 11.5px; background: #0F172A; color: #F8FAFC; border: 1px solid #334155; border-radius: 10px; padding: 12px; resize: none; line-height: 1.5;"></textarea>

            <!-- Action Buttons Grid -->
            <div class="settlement-actions-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px;">
              <button class="btn-settle-action" id="btnCopyWhatsAppText" style="background: #22C55E; color: #FFFFFF; font-weight: 800; border: none; padding: 12px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px;">
                <i data-lucide="copy" style="width: 16px; height: 16px;"></i>
                <span>Copy WhatsApp Text</span>
              </button>

              <button class="btn-settle-action" id="btnOpenWhatsAppDirect" style="background: #15803D; color: #FFFFFF; font-weight: 800; border: none; padding: 12px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px;">
                <i data-lucide="send" style="width: 16px; height: 16px;"></i>
                <span>Open in WhatsApp</span>
              </button>

              <button class="btn-settle-action" id="btnPrintStatementPdf" style="grid-column: span 2; background: #0F172A; color: #FFFFFF; font-weight: 800; border: 1px solid #334155; padding: 12px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px;">
                <i data-lucide="printer" style="width: 16px; height: 16px;"></i>
                <span>Download / Print Customer Statement PDF</span>
              </button>
            </div>

            <!-- Floating Feedback Toast -->
            <div class="copy-toast" id="copyToast" style="display: none; background: #0F172A; color: #A3E635; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; text-align: center; margin-top: 8px;">
              ✅ Copied WhatsApp settlement text to clipboard!
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PRINT-READY CUSTOMER STATEMENT CONTAINER (PRINT ONLY) -->
  <div id="printStatementContainer" class="print-statement-area"></div>

`;

if (!html.includes('id="customerSettlementModal"')) {
  html = html.replace(target, modalHtml + target);
  fs.writeFileSync(filePath, html, 'utf8');
  fs.writeFileSync(syncFilePath, html, 'utf8');
  console.log('Successfully inserted customerSettlementModal into both index.html files!');
} else {
  console.log('Already present in index.html');
}
