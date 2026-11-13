# SKIL LEDGER — ARCHITECTURAL SPECIFICATION
**Technical Reference, Data Flows, Schemas, and Security Boundaries**

---

## 1. System Architecture Overview

SKIL Ledger is engineered as a decoupled, resilient accounting bridge and digital notebook. It enforces strict separation between statutory accounting entries (Tally Prime) and operational business records (Manual Daybook), preventing data contamination while presenting a unified, intuitive ledger view.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SKIL LEDGER FRONTEND                          │
│                   (Manual Khata/skil-ledger.html)                      │
│   • Bahi Khata Tables • Dashboard KPIs • Party Running Ledger          │
│   • Daybook Editor    • Calendar Matrix • WhatsApp Reminders           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON API (Port 9050)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        LOCAL NODE.JS BRIDGE                            │
│                       (Manual Khata/server.js)                         │
├───────────────────────────────────┬────────────────────────────────────┤
│         Statutory Module          │          Manual Daybook            │
│  (scripts/tally-sync.js & parser) │    (scripts/daybook-manager.js)    │
└─────────────────┬─────────────────┴──────────────────┬─────────────────┘
                  │ XML POST (Port 9000)               │ Atomic FS Writes
                  ▼                                    ▼
       ┌──────────────────────┐             ┌─────────────────────┐
       │     Tally Prime      │             │  daybook/YYYY-MM-DD │
       │  (SKIL LIFESTYLE)    │             │  • transactions.json│
       └──────────────────────┘             │  • day-summary.json │
                  │ Snapshots               │  • bills.json       │
                  ▼                         │  • remarks.md       │
       ┌──────────────────────┐             └─────────────────────┘
       │     tally-data/      │                        ▲
       │  • tally-vouchers    │                        │
       │  • tally-ledgers     │              ┌─────────┴─────────┐
       │  • tally-master      │              │     backups/      │
       └──────────────────────┘              │ (Automated JSON)  │
                                             └───────────────────┘
```

---

## 2. Core Components & Subsystems

### 2.1 Backend Server (`server.js`)
- **Runtime**: Node.js v18+.
- **Protocol**: HTTP/1.1 RESTful JSON API on port `9050`.
- **Responsibilities**:
  - Serves `skil-ledger.html` on root `/`.
  - Proxies health checks and synchronisation to Tally Prime XML API (`127.0.0.1:9000`).
  - Aggregates statutory vouchers and manual operational records to calculate dynamic running balances.
  - Serves reports (Debtors aging, Creditors aging, Sales, Purchases, Audit trails).
  - Enforces input validation and CORS protection restricted to loopback origin.

### 2.2 Storage Manager (`scripts/storage-manager.js`)
- **Guarantees**: Atomic filesystem operations.
- **Pattern**: Write to temporary file (`.tmp`) -> `fs.renameSync` replace. This prevents partial writes, corruption during power interruptions, or race conditions.
- **Methods**: `readJson`, `writeJson`, `readText`, `writeText`, `ensureDir`, `listDirs`.

### 2.3 Tally Parser (`scripts/tally-parser.js`)
- **Parser**: Fast-XML-Parser configured to preserve numeric precision.
- **Data Normalization**:
  - Extracts company details (`Name`, `BooksFrom`, `StartingFrom`, `GSTIN`).
  - Classifies Ledgers into `debtor`, `creditor`, `cash`, `bank`, and `other`.
  - Normalizes Vouchers into composite IDs: `TALLY-GUID-[GUID]`.
  - Extracts itemized inventory lines (Stock item name, rate, billed qty, amount, discount).
  - Extracts ledger debit/credit postings with signed integer arithmetic.

### 2.4 Tally Sync Engine (`scripts/tally-sync.js`)
- **Protocol**: Raw HTTP POST XML payload to `http://127.0.0.1:9000/`.
- **Modes**:
  - **Incremental Sync**: Queries vouchers using `AlterID` cursors (`ALTERID > lastAlterId`). Completes in under 500ms.
  - **Full Sync**: Re-queries all ledgers and vouchers across the financial year.
- **Persistence Target**: `Manual Khata/tally-data/` (`tally-master.json`, `tally-ledgers.json`, `tally-vouchers.json`, `last-sync.json`).
- **Resilience**: Exponential backoff retry logic (up to 3 attempts) handling socket resets and temporary Tally UI pauses.

### 2.5 Daybook Manager (`scripts/daybook-manager.js`)
- **Directory Structure**: Physical date-stamped folder `daybook/YYYY-MM-DD/`.
- **Synchronization**: `syncDayFiles(dateStr, transactions)` acts as the single authoritative state writer for a date, generating:
  - `transactions.json`: Master chronological list of that date's operational transactions.
  - `day-summary.json`: Aggregated metrics (total sales, receipts, payments, cash inflow/outflow, bank inflow/outflow).
  - `bills.json`: Sales bills and invoices.
  - `purchases.json`: Supplier purchase consignments.
  - `payments.json`: Payments and receipts.
  - `credit-notes.json` & `debit-notes.json`: Adjustments.
  - `remarks.md`: Business diary in Markdown.
- **Audit Logging**: Any modification or cancellation retains previous states in the `history` array. Zero hard deletions.

### 2.6 Backup Manager (`scripts/backup-manager.js`)
- **Packaging**: Harvests `tally-data/`, all `daybook/` folders, and `config/settings.json` into a single timestamped JSON bundle:
  `backups/backup_YYYY-MM-DD_HH-mm-ss_[label].json`.
- **Restoration**: Verifies schema integrity before restoring files.

---

## 3. Data Schemas

### 3.1 Tally Voucher Schema (`tally-vouchers.json`)
```json
{
  "id": "TALLY-GUID-582e9795-82b7-4062-9f2f-04b60c3dc54e-00000007",
  "guid": "582e9795-82b7-4062-9f2f-04b60c3dc54e-00000007",
  "source": "tally",
  "voucherType": "Sales",
  "voucherNumber": "SKIL-001",
  "date": "2026-08-12",
  "rawDate": "20260812",
  "reference": "1900402723",
  "partyName": "M/s Sri Brundabana Enterprises, Rayagada",
  "amount": 44490.00,
  "narration": "SBE 9CTN",
  "alterId": 75,
  "ledgerEntries": [
    {
      "ledgerName": "M/s Sri Brundabana Enterprises, Rayagada",
      "amount": 44490.00,
      "rawAmount": -44490.00,
      "isDeemedPositive": true,
      "isPartyLedger": true
    }
  ],
  "inventoryEntries": [
    {
      "stockItemName": "AJ CEG 1004 RED 06/10 MRP135/-",
      "actualQty": "48 Pairs = 1 Box",
      "billedQty": "48 Pairs = 1 Box",
      "rate": "128.57/Pairs",
      "rateNumeric": 128.57,
      "amount": 3857.10,
      "discount": 37.5
    }
  ]
}
```

### 3.2 Manual Daybook Transaction Schema (`transactions.json`)
```json
{
  "id": "TXN-MAN-20261030-001",
  "date": "2026-10-30",
  "type": "sales_bill",
  "partyName": "ALAKA SHOES",
  "partyType": "debtor",
  "particulars": "Billed 12 Cartons Ajanta PU Mens & Hawai (Inv #SKIL-068)",
  "reference": "SKIL-068",
  "amount": 54200.00,
  "paymentMode": "Credit",
  "againstBill": "",
  "remarks": "Dispatched via Nayagarh Transport, Bilty #NY-8821",
  "attachment": "",
  "source": "manual",
  "status": "active",
  "createdAt": "2026-10-30T10:15:00.000Z",
  "updatedAt": "2026-10-30T10:15:00.000Z",
  "createdBy": "Sahil Kumar",
  "history": []
}
```

---

## 4. Accounting Mechanics & Running Balance Calculations

### 4.1 Debtors Ledger (Customers)
```
Let B[0] = Party.openingBalance (Debit is positive)
For each chronological transaction i in Statement:
  If Type is Sales Bill or Debit Note:
    Bills[i] = Amount
    Payments[i] = 0
  Else If Type is Receipt, Cash Collection, or Credit Note:
    Bills[i] = 0
    Payments[i] = Amount

  B[i] = B[i-1] + Bills[i] - Payments[i]
  BalanceType[i] = B[i] >= 0 ? "Dr" (Owes Us) : "Cr" (Advance)
```

### 4.2 Creditors Ledger (Suppliers)
```
Let B[0] = Party.openingBalance (Credit is positive)
For each chronological transaction i in Statement:
  If Type is Purchase Bill or Credit Note:
    Purchases[i] = Amount
    Payments[i] = 0
  Else If Type is Payment, RTGS Transfer, or Debit Note:
    Purchases[i] = 0
    Payments[i] = Amount

  B[i] = B[i-1] + Purchases[i] - Payments[i]
  BalanceType[i] = B[i] >= 0 ? "Cr" (We Owe Them) : "Dr" (Advance Paid)
```

---

## 5. Security & Boundary Enforcement

1. **Localhost Loopback Only**:
   The Express server listens strictly on `127.0.0.1:9050` by default. Port 9000 (Tally) is never exposed to public network interfaces.
2. **Strict Workspace Isolation**:
   In compliance with workspace rules, all operations occur strictly within `C:\Projects\SKIL Master\Manual Khata\`.
3. **Immutability of Audit Trails**:
   Edits to manual records are non-destructive. The `history` array preserves the timestamp, author, previous state, and mandatory reason for every edit.
4. **Separation from External Creditor Files**:
   SKIL Ledger explicitly ignores external counterparty reconciliation files located in the root workspace (`Ajanta Customer Ledger PDFs`), eliminating reconciliation bias and double-counting.
