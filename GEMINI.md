# Workspace Boundary & Operational Guidelines

## 1. Strict Directory Boundary
- **WORKSPACE BOUNDARY**: All operations, file searches, reads, writes, and commands must strictly stay confined within `C:\Projects\SKIL Master`.
- **NO OUT-OF-BOUNDS ACCESS**: Never search, list, read, or inspect external directories (including `Downloads`, `Desktop`, or user profile folders) unless the user explicitly provides an external file path and explicitly asks to access it.
- All documents, bank statements, invoices, and vouchers must be sourced solely from within the workspace.

## 2. Dynamic Managed Directory Timestamps
- All managed document directories under `user-documents-read-only-access/` and `Tally Files` must adhere to the timestamp convention:
  `<Prefix> - last updated on <DD-MM-YYYY at HH-mm hrs>`
- Always invoke `sync-engine/folder-updater.js` (`FolderUpdater.updateAll()`) after adding or modifying files in these directories.

## 3. Strict Ban on Python Generators & Manual Data Verification
- **NO PYTHON GENERATORS**: Never create, run, or rely on Python generator scripts (`.py`) for generating or calculating financial trackers, supplier audits, or reconciliation spreadsheets.
- **MANUAL DIRECT VERIFICATION**: Always verify and cross-reference financial entries manually and directly against official source supplier statements (e.g. Ajanta Customer Ledger PDFs) and dealership agreements.
- **EXCEL AESTHETIC & USABILITY STANDARDS**:
  - **No Garish / Rainbow Colors**: Strictly avoid saturated primary colors (bright pink, bright green, heavy blues, yellow fills).
  - **Minimalist Slate / Monochrome Palette**: Use deep charcoal/slate headers (`#1E293B`, `#334155`), clean white (`#FFFFFF`) or soft neutral tints (`#F8FAFC`), and subtle hairline borders (`#CBD5E1`).
  - **Spacious & Compact Simultaneously**: Ample vertical cell padding (row heights 22–32pt), crisp typography (Calibri/Segoe UI), proper column widths to avoid truncation, and clear visual hierarchy for immediate readability by business owners and auditors.

## 4. Customer WhatsApp Payment Reminders & Cash Discount (CD) Standard
- **Use SKIL Sales Invoice Number**: Always reference SKIL's outward sales invoice number (e.g. `Inv #SKIL-027`) instead of the supplier's (Ajanta/Xpania/Cubix) invoice number when communicating with customers.
- **5% CD Strictly on Taxable Value**: Always compute customer Cash Discount @ **5% on Taxable Value** (never on the GST-inclusive gross total).
- **Old Historical Balances (Net Addition)**:
  - If a customer has an older pending balance (e.g., prior month partial balance like K G N Footware's August balance):
  - Do NOT apply the 5% CD to the old balance.
  - The 5% CD applies strictly to the specific invoices being settled.
  - Add the old balance separately as net: `➕ Add: Old [Month] Balance: +₹X,XXX (Net)`.
- **Clean Invoice Line Syntax**:
  - Do NOT write "Inv" or "Inv #" in front of invoice numbers.
  - Do NOT include the taxable breakdown beside individual invoice amounts in the list (keep lines clean: `• #SKIL-[NNN] ([N] CTN): *₹[Gross]*`).
  - Show the taxable subtotal strictly in the CD deduction line: `*Less: 5% CD on Taxable (₹[Taxable Subtotal]): -₹[CD Amount]*`.
- **Standardized WhatsApp Message Structure**:
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

  [If Old Balance Exists:]
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


