# ROUTINE AUDIT DRILL & INWARD PROCESSING SOP
**SKIL LIFESTYLE LLP — Standard Operating Procedure for Bill Audits, File Sorting & Tracker Updates**

*Last Updated: 31-10-2026*

---

## 1. Overview of the Inward Drill Routine

Whenever new supplier bills (PDFs) are downloaded or dropped into the root folder (`c:\Projects\SKIL Master`), the automated audit and sorting routine is executed following these sequential phases:

```
[Raw PDFs in Root] 
       │
       ▼
1. PDF Parsing & Extraction (Invoice No, Date, Consignee, Cartons, Pairs, Taxable, Tax, Grand Total)
       │
       ▼
2. Live Tally Prime Reconciliation (Purchase Voucher, 1-to-1 Sales Voucher, Reference, Billed Qty, Rates)
       │
       ▼
3. Multi-Point Audit Drill (MRP Typos, Article Prefix/Syntax, Billed Quantities, 37.5% Margin Threshold)
       │
       ▼
4. Standard File Renaming & Multi-Location Mirroring (Purchases Folder, Android App, Sync Engine)
       │
       ▼
5. Dynamic Managed Folder Timestamps (`FolderUpdater.updateAll()`)
       │
       ▼
6. Master & Supplier Excel Trackers Regeneration (Zero Python — 100% Node.js / ExcelJS)
       │
       ▼
7. Comprehensive Executive Audit Report Presentation
```

---

## 2. Standard Operating Checklist

### Phase 1: Inward PDF Parsing
- [ ] Parse raw invoice PDFs using Node.js `pdf-parse`.
- [ ] Extract key fields:
  - **Supplier**: Ajanta Shoes / Xpania Footcare / Cubix Footcare.
  - **Invoice Reference**: e.g., `1900423284`.
  - **Invoice Date**: DD.MM.YYYY.
  - **Consignee / Ship-To Party**: Name, GSTIN, Address.
  - **Inventory Line Items**: Article Name, Pack Size, Carton Count, Pair Count, MRP, Basic Rate, Line Taxable Amount.
  - **Totals**: Total Cartons, Total Pairs, Taxable Subtotal, CGST/SGST/IGST, Round-off, Grand Total.

### Phase 2: Live Tally Prime Reconciliation
- [ ] Trigger full sync: `syncService.runSync({ full: true })`.
- [ ] Audit Purchase Voucher:
  - Voucher Number matches sequence (e.g. `#67`, `#68`, `#69`).
  - Reference Number matches supplier invoice number.
  - Billed Quantities (Cartons & Pairs) match supplier invoice exactly.
  - Total Purchase Amount matches physical invoice within $\pm ₹1.00$.
- [ ] Audit Sales Voucher:
  - Billed 1-to-1 against purchase voucher (e.g. `#SKIL-067`, `#SKIL-068`, `#SKIL-069`).
  - Customer Ledger matches Ship-To Consignee from invoice.
  - Narration follows pattern: `<PARTY_SHORT> <CTN_COUNT>CTNS`.

### Phase 3: Comprehensive Discrepancy & Margin Audit
- [ ] **Reference Typo Check**: Verify no digit transposition in Tally reference field.
- [ ] **Quantity & Carton Match**: Verify billed quantity in Tally is not halved or altered (e.g. 1 box vs 2 boxes).
- [ ] **Rule 4.5 Compliance (Article Master Syntax)**:
  - Ajanta articles: Must begin with prefix `AJ ` and end with `MRP<Price>/-`.
  - Xpania articles: Must begin with prefix `XP ` and end with `MRP<Price>/-`.
  - Verify printed invoice MRP matches stock item name MRP exactly.
- [ ] **Contractual Margin Verification (37.50% Rule)**:
  - Standard Hawaii/EVA margin formula: Landed Cost Factor = $0.5952 \times 1.05 = 0.62496 \implies 37.50\%$ Net Discount.
  - Check for Under-Margin (< 37.50%), Equal-Margin (= 37.50%), or Above-Margin (> 37.50%).
  - Flag supplier overcharges / rate differences for debit note claim.

### Phase 4: Standard Renaming & Mirroring
- [ ] Rename file using the established convention:  
  `NNN - <InvoiceRef> - <PartyShort> <CityShort> - <DD-MM-YY>.pdf`
- [ ] Copy / Mirror to all 3 designated directories:
  1. `user-documents-read-only-access/Purchases - last updated on <timestamp>/`
  2. `android-app/www/documents/<supplier>/`
  3. `sync-engine/public/documents/<supplier>/`
- [ ] Delete raw upload files from the root directory.
- [ ] Update managed folder timestamps via `folderUpdater.updateAll()`.

### Phase 5: Excel Workbook Updates (Strictly Node.js / ExcelJS)
- [ ] Regenerate Master Workbook: `node sync-engine/generate-master-tracker.js`  
  - Target: `SKIL_Master_Financial_Tracker_FY2026-27.xlsx`
  - 12 interactive tabs with clickable Navigation Menu & Executive Slate styling.
- [ ] Regenerate Supplier Tracker: `node sync-engine/ajanta-tracker-generator.js`  
  - Target: `Ajanta_Supplier_Tracker_FY2026-27.xlsx`

---

## 3. Standard Customer Short Name & City Codes

| Full Customer Ledger Name | Short Code | Location / City | Filename Suffix |
|---|:---:|:---:|:---:|
| **SRI LAKSHMI GAYATRI CHAPPELS** | `SLGC` | Rajamahendravaram | `SLGC RJM` |
| **K G N FOOTWARE** | `KGN` | Parvathipuram | `KGN PVM` |
| **ALAKA SHOES** | `Alaka` | Nayagarh | `Alaka Nayagarh` |
| **DELIGHT FOOT WEAR** | `Delight` | Vizianagaram | `Delight VZM` |
| **FAMOUS FOOT WEAR** | `Famous` | Vizianagaram | `Famous VZM` |
| **JYOTHI FOOT WEAR** | `Jyothi` | Anakapalli / VZM | `Jyothi AKPL` / `Jyothi VZM` |
| **M/S.SHREE FOOTWEAR** | `SF` | Srikakulam | `SF SKLM` |
| **SRI SHARVANI TRADERS** | `Sharvani` | Visakhapatnam / SKLM | `Sharvani SKLM` |
| **SHREE ADITYA FOOT FASHION** | `Shree Aditya` | Vizianagaram | `Shree Aditya VZM` |
| **SALIM KHAN KGN, RAJAM** | `Salim Khan` | Rajam | `Salim Khan Rajam` |
| **M/s Sri Brundabana Enterprises, Rayagada** | `SBE` | Rayagada | `SBE RGDA` |
| **M/S SRI BRUNDABAN ENTERPRISES, MALKANGIRI** | `SBE` | Malkangiri | `SBE MLKG` |
| **M/S. RAJAN TRADERS** | `Rajan` | Jajpur | `Rajan Jajpur` |
| **M/S SUSHILA BOOT HOUSE** | `Sushila` | Jharsuguda | `Sushila JSG` |
| **MAHAVIR SHOE HOUSE** | `Mahavir` | Dhenkanal | `Mahavir DNKL` |

---

## 4. Operational Boundaries & Rules

1. **Strict Workspace Boundary**: Never search, read, write, or touch files outside `c:\Projects\SKIL Master`.
2. **Zero Python Generator Ban**: Spreadsheets, audit trackers, and reconciliation reports must never be generated using Python. All generation must strictly utilize Node.js and ExcelJS.
3. **Executive Slate Aesthetic**: All generated sheets adhere to `#1E293B` (dark slate header), `#334155` (accent header), `#CBD5E1` (hairline borders), Segoe UI typography, and generous vertical cell padding (22–32pt).
4. **Dynamic Folder Timestamps**: Every addition or modification of documents triggers `folderUpdater.updateAll()`.

---

## 5. Customer Payment Reminders & WhatsApp Settlement Standard

When requested to draft customer payment requests or collection reminders on WhatsApp:

### 5.1 Rules & Standards
1. **Use SKIL Sales Invoice Numbers Only**: Always reference SKIL's outward sales invoice numbers without the text "Inv" (e.g. `#SKIL-027`), never internal supplier invoice numbers (like Ajanta's `1900...`).
2. **Clean Line Syntax**: Keep invoice lines simple and concise (`• #SKIL-[NNN] ([N] CTN): *₹[Gross]*`) without taxable figures on individual lines.
3. **5% on Taxable Value Only**: Cash Discount is computed @ **5% on the Taxable (Base) Value** of the qualifying invoices, shown in the discount deduction line: `*Less: 5% CD on Taxable (₹[Total Taxable]): -₹[CD Amount]*`. It must **NEVER** be calculated on the gross invoice amount with 5% GST added.
   $$\text{CD Amount} = \text{Taxable Subtotal} \times 0.05$$
4. **Old / Prior Balances**:
   - Prior month unadjusted balances (e.g., K G N Footware's August balance of ₹6,113) must **NOT** receive a CD discount.
   - The 5% CD applies solely to the specific new/qualifying batch of invoices.
   - The old balance is added as a net figure after the CD discount has been subtracted from the invoices.

### 5.2 Canonical WhatsApp Message Layout

```text
Dear [Party Name],

Please find the settlement details for your pending bills:

📦 *[N] Invoices ([N] CTN):*
• #SKIL-[NNN] ([N] CTN): *₹[Gross]*
• #SKIL-[NNN] ([N] CTN): *₹[Gross]*
────────────────────────
*Total of [N] Bills: ₹[Gross Subtotal]*
*Less: 5% CD on Taxable (₹[Taxable Subtotal]): -₹[CD Amount]*
👉 *Net for [N] Bills: ₹[Net Bills]*

[If prior balance exists:]
➕ *Add: Old [Month] Balance: +₹[Old Bal]* (Net)
────────────────────────
*👉 TOTAL TO TRANSFER: ₹[Final Net Payable]*
────────────────────────

*Bank Details:*
SKIL LIFESTYLE LLP
Union Bank of India | Rayagada
A/c: *348621010000129*
IFSC: *UBIN0534862*

Please process the transfer and share the screenshot so we can issue your CD credit note. Thank you! 🙏
```

