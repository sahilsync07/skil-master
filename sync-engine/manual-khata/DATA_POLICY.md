# DATA SEPARATION & ISOLATION POLICY
**SKIL LEDGER — Digital Manual Bahi Khata**
*Document Version: 1.0.0 | Effective Date: 01-11-2026*

---

## 1. Executive Summary & Purpose

The purpose of this document is to establish the strict data governance, isolation boundaries, and ownership principles governing **SKIL Ledger (Digital Manual Bahi Khata)**. 

Financial integrity in a wholesale drop-shipping enterprise requires an absolute boundary between formal accounting system imports (Tally Prime ERP) and operational, daily managerial records (Manual Bahi Khata).

---

## 2. The Two Independent Data Streams

The application operates on two mutually exclusive, strictly isolated data architectures:

```
┌─────────────────────────────────────────────────────────────┐
│                      SKIL LEDGER APP                        │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│    STREAM A: TALLY DATA     │ │  STREAM B: MANUAL DAYBOOK   │
│   (Accounting Source)       │ │  (Managerial / Operations)  │
├─────────────────────────────┤ ├─────────────────────────────┤
│ Storage:                    │ │ Storage:                    │
│   Manual Khata/tally-data/  │ │   Manual Khata/daybook/     │
│                             │ │   YYYY-MM-DD/               │
│ Inward Flow:                │ │ Flow:                       │
│   Tally XML API (Port 9000) │ │   Direct User Entry, Daily  │
│   Ledgers, Vouchers, Opening│ │   Diary Remarks, Audit Log  │
│                             │ │                             │
│ Tag: source = "tally"       │ │ Tag: source = "manual"      │
└─────────────────────────────┘ └─────────────────────────────┘
```

### Stream A: Tally Prime Accounting Data
* **Repository Path**: `Manual Khata/tally-data/`
* **Contents**:
  * `tally-master.json`: Company information, book begin dates, GSTIN, currency.
  * `tally-ledgers.json`: Normalized Sundry Debtors, Sundry Creditors, and account groups.
  * `tally-vouchers.json`: Verified Sales, Purchases, Receipts, Payments, Credit Notes, Debit Notes.
  * `last-sync.json`: Sync telemetry, cursor AlterIDs, timestamp, status.
* **Characteristics**: Read-only snapshot fetched over authenticated local XML calls. Represents formal statutory accounting records.

### Stream B: Manual Khata Daybook Records
* **Repository Path**: `Manual Khata/daybook/YYYY-MM-DD/`
* **Contents**:
  * `day-summary.json`: Daily financial totals, transaction counters, cash/bank summaries.
  * `transactions.json`: Authoritative master record of daily events.
  * Specialized extracts: `bills.json`, `payments.json`, `purchases.json`, `credit-notes.json`, `debit-notes.json`.
  * `remarks.md`: Qualitative business diary (customer discussions, price agreements, verbal promises, adjustments).
* **Characteristics**: User-maintained operational truth. Fully editable across historical dates with audit-trail tracking.

---

## 3. STRICT PROHIBITIONS & BOUNDARY RESTRICTIONS

> [!CAUTION]
> **MANDATORY ARCHITECTURAL ENFORCEMENT**
> The following actions are strictly prohibited by code architecture, schema design, and operational policy:

1. **NO ACCESS TO PARENT CREDITOR LEDGER FILES**:
   - The application must **NEVER** inspect, scan, read, import, or parse creditor ledger files stored in the parent workspace (e.g. `user-documents-read-only-access/Ajanta - Ledgers & Agreement`, `Vendor Ledgers`, external reconciliation spreadsheets, or supplier statements).
   - Creditor statements stored in external folders are maintained solely for periodic third-party reconciliation. They must **NEVER** be used to calculate running balances or populate the Manual Khata.
2. **NO AUTOMATED COMPARISON OR MERGING OF EXTERNAL FILES**:
   - Never merge external supplier statements or customer PDFs automatically into the Daybook.
   - The Daybook must originate purely from direct user interaction or verified Tally synchronizations.
3. **ZERO DESTRUCTIVE OVERWRITES**:
   - Tally synchronisation must **NEVER** silently overwrite, delete, or mutate manually created Daybook transactions.
   - Manual remarks, operational adjustments, and dispute notes in `remarks.md` are sacred and preserved indefinitely.
4. **NO DOUBLE COUNTING**:
   - If a transaction originated in Tally and a matching operational record exists in the Daybook, the application visually flags the association while ensuring running balance calculations count each rupee exactly once.
   - Every transaction payload strictly carries `source: "tally"` or `source: "manual"`.

---

## 4. Transaction Data Ownership Model

Every transaction record adheres to a strict schema of ownership:

```json
{
  "id": "TXN-MAN-20261101-001",
  "source": "manual",
  "syncStatus": "isolated",
  "audit": {
    "createdAt": "2026-11-01T09:30:00.000Z",
    "createdBy": "Sahil Kumar",
    "version": 1,
    "history": []
  }
}
```

* **Immutable History**: Historical modifications generate an entry in the `history` array capturing previous state, editor, and timestamp.
* **Non-Destructive Cancellation**: Voided transactions are updated to `status: "cancelled"` with cancellation remarks; they are never physically purged from the JSON file.

---

## 5. Security & Privacy Boundaries

1. **Tally Port 9000 Isolation**: Port 9000 communicates only over `127.0.0.1` (loopback). It must never be bound to `0.0.0.0` or forwarded over public networks.
2. **Local Bridge Architecture**: The Node.js service operates locally. Hosted frontend distributions connect to the local bridge via CORS-controlled localhost APIs without leaking business data to public internet storage.
3. **Zero Git Leaks**: Actual private business files (`daybook/`, `tally-data/`, `backups/`) must not be committed to any public code repository.
