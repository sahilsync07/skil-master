# SKIL LEDGER — DIGITAL MANUAL BAHI KHATA
**Official Production Digital Ledger & Accounting Diary for SKIL LIFESTYLE LLP**

---

## 1. Executive Summary

**SKIL Ledger** is a production-ready financial application designed to digitize the traditional Indian business ledger notebook (**Bahi Khata**), while retaining the intuitive layout, tactile clarity, and running-balance mechanics of handwritten accounting records.

The system serves as the definitive operational record keeper for **SKIL LIFESTYLE LLP**, bridging real-time accounting transactions from **Tally Prime** (running locally on `http://127.0.0.1:9000`) with date-stamped manual operational events, dispatch bilties, verbal customer agreements, and daily business diary entries (`remarks.md`).

---

## 2. Key Architecture & File Structure

```text
Manual Khata/
│
├── skil-ledger.html             # Self-contained single-file frontend (HTML5/CSS3/ES6)
├── server.js                    # Local API bridge & static web server (Port 9050)
├── package.json                 # Node.js project metadata & operational scripts
├── README.md                    # System documentation & operational manual
├── ARCHITECTURE.md              # Technical design, data models & security boundaries
├── DATA_POLICY.md               # Strict data isolation & anti-tampering policy
│
├── config/
│   └── settings.json            # Ports, FY ranges, currency, and endpoints
│
├── tally-data/                  # Statutory Truth (Imported from Tally Prime)
│   ├── tally-master.json        # Company identity, books date, starting FY
│   ├── tally-ledgers.json       # Chart of accounts (Sundry Debtors & Creditors)
│   ├── tally-vouchers.json      # Sales, Purchases, Receipts, Payments, CN/DN
│   └── last-sync.json           # AlterID cursors, timestamps, sync duration
│
├── daybook/                     # Operational Truth (Manual Khata & Diary)
│   ├── YYYY-MM-DD/
│   │   ├── day-summary.json     # Computed daily totals (Sales, Inflows, Outflows)
│   │   ├── transactions.json    # Complete array of date transactions
│   │   ├── bills.json           # Outward sales dispatches & invoices
│   │   ├── purchases.json       # Inward supplier consignments
│   │   ├── payments.json        # Bank & cash receipts/payments
│   │   ├── credit-notes.json    # Cash discounts & goods returns
│   │   ├── debit-notes.json     # Price differences & adjustments
│   │   └── remarks.md           # Business diary, bilty notes, memos
│   └── ...
│
├── scripts/
│   ├── storage-manager.js       # Atomic filesystem persistence engine
│   ├── tally-parser.js          # XML-to-JSON normalizer for Tally Prime
│   ├── tally-sync.js            # HTTP client for Tally port 9000
│   ├── daybook-manager.js       # Date directory authorizer & transaction manager
│   └── backup-manager.js        # Timestamped archive & recovery generator
│
└── backups/                     # Automated JSON snapshot backups
```

---

## 3. Strict Data Separation Policy (`DATA_POLICY.md`)

SKIL Ledger enforces a **Zero-Cross-Contamination Boundary**:

1. **Statutory Truth (`tally-data/`)**: Contains vouchers imported directly from Tally Prime via the local XML bridge.
2. **Operational Truth (`daybook/YYYY-MM-DD/`)**: Contains manual business entries, dispatch bilties, customer promises, and adjustments.
3. **STRICT PROHIBITION**:
   - **Never access, read, or import external creditor ledger files** (such as `Ajanta Customer Ledger PDFs` or monthly counterparty statements) stored in the parent workspace to calculate balances.
   - Those files are kept strictly for monthly counterparty audits.
   - SKIL Ledger maintains its balances independently from official primary vouchers.
4. **Zero Silent Overwrites**: Tally synchronizations never overwrite manual records.
5. **Anti-Double-Counting Guarantee**: Transactions maintain unique stable GUIDs (`TALLY-GUID-...` vs `TXN-MAN-...`) and distinct visual badges (`Tally` vs `Manual`).

---

## 4. Bahi Khata Accounting Conventions

### A. Debtors Khata (Retailers & Customers)
*For customers who owe money to SKIL.*

| Column | Traditional Term | Accounting Effect | Impact on Balance |
|---|---|---|---|
| **CR (Bills)** | Jama / Bikri | Sales bill billed to customer | **Increases** Receivable |
| **DR (Payment)** | Udhar / Vasooli | Payment received / Credit Note | **Decreases** Receivable |
| **Balance** | Baqi / Dr | Net amount customer owes | Shown with **Dr** badge |

### B. Creditors Khata (Suppliers & Vendors)
*For manufacturers and vendors to whom SKIL owes money.*

| Column | Traditional Term | Accounting Effect | Impact on Balance |
|---|---|---|---|
| **DR (Purchases)** | Udhar / Kharidi | Goods received from supplier | **Increases** Payable |
| **CR (Payment)** | Jama / Chukta | Payment transferred to supplier | **Decreases** Payable |
| **Balance** | Dena / Cr | Net amount SKIL owes | Shown with **Cr** badge |

---

## 5. GEMINI.md Standard WhatsApp Payment Reminders

The application features a 1-click **WhatsApp Reminder Generator** strictly adhering to the `GEMINI.md` standard:
- References outward sales invoice numbers (e.g., `#SKIL-068`).
- Computes customer **Cash Discount @ 5% on Taxable Value** (never on the GST-inclusive gross total).
- Handles older historical balances separately without applying CD.
- Formats bank account details cleanly for immediate NEFT/RTGS/UPI transfers.

---

## 6. Installation & Quick Start

### Prerequisites
- Node.js (v18.0.0 or higher recommended).
- Tally Prime running locally with ODBC/XML port enabled on `http://127.0.0.1:9000`.

### Running SKIL Ledger

```powershell
# Navigate to application folder
cd "C:\Projects\SKIL Master\Manual Khata"

# Start the backend server
node server.js
```

Once started, open your web browser to:
**`http://127.0.0.1:9050`**

### Running Synchronisation via CLI

```powershell
# Incremental synchronization (fast, uses AlterID cursors)
node scripts/tally-sync.js

# Full synchronization (re-queries all vouchers & ledgers)
node scripts/tally-sync.js --full
```

### Creating Backup Snapshots via CLI

```powershell
node scripts/backup-manager.js
```

---

## 7. Daily Operational Workflow (SOP)

1. **Morning Opening**:
   - Open `http://127.0.0.1:9050`. Check Tally status indicator (Green pulse = Online).
   - Click **Sync Tally** on the top bar to pull any newly posted statutory vouchers.
2. **Recording Dispatches & Goods Inward**:
   - Click **Record Entry** (`+`) on the topbar.
   - Enter Party Name (with autocomplete), Type, Amount, Mode, and transport bilty reference.
   - Entry is immediately saved atomically to `daybook/YYYY-MM-DD/transactions.json` and mirrored in `daybook/YYYY-MM-DD/bills.json`.
3. **Maintaining Business Diary (`remarks.md`)**:
   - Switch to **Daybook (Rojnamcha)**.
   - Use the right-hand **Business Diary** pane to document driver contact numbers, payment promises, damaged stock notes, or market feedback.
   - Click **Save Diary Notes**.
4. **Follow-ups & Customer Collections**:
   - Go to **Debtors Khata**.
   - Review pending balances.
   - Click **💬 WhatsApp** on any customer row to preview and copy the formatted settlement reminder.
5. **Nightly Closing**:
   - Navigate to **Daybook Calendar Matrix** to review daily totals.
   - Go to **Backups & Safety** and click **Create Backup Snapshot** to archive the day's work.

---

## 8. Deployment & Independence

- **No Nested Git**: This application is managed under the root repository of `SKIL Master`. Do not run `git init` inside `Manual Khata/`.
- **Zero Framework Footprint**: The entire frontend is encapsulated in `skil-ledger.html` with zero compilation, transpilation, or bundling required.
- **Independent Remote Repository**: If publishing to a separate GitHub repository, use git subtree:
  ```powershell
  git subtree push --prefix="Manual Khata" <remote-url> main
  ```
- **Local Network Access**: To access SKIL Ledger from an office tablet or mobile phone on the same Wi-Fi network, configure `server.host: "0.0.0.0"` in `config/settings.json`.

---
*Built with care for SKIL LIFESTYLE LLP. Preserving the heritage of Indian Bahi Khata with modern engineering.*
