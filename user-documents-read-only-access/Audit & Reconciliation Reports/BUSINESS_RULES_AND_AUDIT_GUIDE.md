# BUSINESS RULES & AUDIT COMPLIANCE GUIDE
**SKIL LIFESTYLE LLP — Enterprise Financial Reconciliation & Audit Framework**

*Last Updated: 01-10-2026*

---

## 1. Executive Summary & Architecture

This document establishes the official business logic, mathematical formulas, folder naming conventions, and accounting audit rules for **SKIL LIFESTYLE LLP** (Visakhapatnam, Andhra Pradesh).

This guide serves as the permanent system specification for all sync engines, data extractors, audit scripts, and AI agents. **All agents and automated processes must strictly follow the rules outlined below.**

---

## 2. Official Distributorship Agreement FY 2026-27 (Ajanta Shoes)

> [!IMPORTANT]
> **GOVERNING CONTRACT:** Signed Distributorship Agreement between **AJANTA SHOES (INDIA) PVT. LTD.** and **SKIL LIFESTYLE LLP** dated **01.08.2026** (signed 04.08.2026 by Partha Dasgupta, GM-Sales, and Sahil Kumar, Designated Partner).
> - **Annual Target:** ₹1.20 Crore (Basic Price)
> - **Agreement Period:** August 2026 to July 2027

### 2.1 Category Margins: Gap from MRP to Basic Price

| Product Category | Gap (MRP to Basic Price) | Effective Landed Cost Factor (with 5% GST) | Net Effective Discount from MRP |
| :--- | :---: | :---: | :---: |
| **Hawaii / General Footwear** | **40.48%** | $0.5952 \times 1.05 = 0.62496$ | **37.50% Net Discount** |
| **Sports Shoes (Up to MRP 999/-)** | **46.03%** | $0.5397 \times 1.05 = 0.56668$ | **43.33% Net Discount** |
| **Sports Shoes (MRP 1,000/- to 1,799/-)** | **50.93%** | $0.4907 \times 1.05 = 0.51523$ | **48.48% Net Discount** |
| **School Shoe (AJ Skinfit)** | **55.83%** | $0.4417 \times 1.05 = 0.46378$ | **53.62% Net Discount** |
| **Sports Shoes (MRP 1,800/- & Above)** | **55.84%** | $0.4416 \times 1.05 = 0.46368$ | **53.63% Net Discount** |

#### The 37.50% Mathematical Proof:
$$\text{Basic Price} = \text{MRP} \times (1 - 0.4048) = \text{MRP} \times 0.5952$$
$$\text{Landed Cost (5\% GST)} = \text{Basic Price} \times 1.05 = \text{MRP} \times 0.5952 \times 1.05 = \text{MRP} \times 0.62496$$
$$\text{Net Landed Discount} = 1 - 0.62496 = 37.504\% \approx \mathbf{37.50\%}$$

---

## 3. Official Scheme & Credit Note Matrix (Contractual Entitlements)

| Scheme / Incentive Head | Rate (%) | Payout Frequency | Basis / Condition | Contract Clause |
| :--- | :---: | :---: | :--- | :--- |
| **Cash Discount (CD)** | **3.00%** | Prompt Settlement | Paid on timely payment settlement | Table Row 7 |
| **Retailer Scheme (Coupon/Gift Article)** | **3.78%** | **Monthly** | Paid via Credit Note every month | Table Row 9 |
| **Quarterly Turnover Bonus (QTB)** | **2.00%** | **Quarterly** | Paid on Quarterly Basic Price | Table Row 8 |
| **Monthly Target Achievement Bonus** | **3.00%** | **Quarterly** | On achieving ₹10 Lakh business every month | Agreement Note 1 |
| **Annual Turnover Bonus (ATB / Misc.)** | **3.00%** | **Annual** | On achieving ₹1.20 Cr target in 12 months | Additional Bonus Sl. 1 |
| **Higher Slab Upgrade (Slab 1)** | **3.50%** | Milestone | Monthly ₹30–49.99 Lac / Annual ₹3.60–5.99 Cr | Upgradation Table |
| **Higher Slab Upgrade (Slab 2)** | **4.50%** | Milestone | Monthly ₹50 Lac & Above / Annual ₹6.00 Cr & Above | Upgradation Table |

### 3.1 Contract Terms & Conditions
1. **GST Imposition:** *"GST will be imposed on all Credit/Debit note."*
2. **Achievement Basis:** *"All achievements will be on basic price."*
3. **Scheme Calculation:** *"All calculation of scheme will be on reduced price not on basic price."*
4. **Sales Basis:** *"Payment — on primary sales from Ajanta Shoes India Pvt Ltd."*
5. **ATB Credit Note:** *"ATB Credit note will be paid Quarterly Achievement Basis."*
6. **Scheme Period:** *"Aug'26 to Jul'27."*

### 3.2 Ajanta Contractual Liability & Scheme Audit Rules (Automated Audit Spec)
- **Rule 3.2.1 (Missing Cash Discount — 3.00%)**:  
  Ajanta is legally liable to issue a **3% Cash Discount Credit Note** on monthly basic purchase turnover against prompt payment settlement.
- **Rule 3.2.2 (Retailer Scheme — 3.78%)**:  
  Ajanta is legally liable to issue monthly Credit Notes @ **3.78%** on qualifying Hardware and Footwear purchases for consumer/retail scheme support.
- **Rule 3.2.3 (Rate Difference Asymmetric Rule — The 37.5% Threshold)**:  
  - **Net Discount < 37.50%:** Ajanta is **STRICTLY LIABLE** to compensate SKIL via Rate Difference Credit Notes for any shortfall below 37.50% effective net discount from MRP.
  - **Net Discount ≥ 37.50%:** **IGNORE.** Higher discounts are retained by SKIL Lifestyle LLP as earned margin. SKIL owes no refund or offset to Ajanta for items billed with > 37.50% margin.
- **Rule 3.2.4 (Monthly Target Achievement Bonus — 3.00%, Paid Quarterly)**:  
  - Target: **₹10.00 Lakhs Basic turnover** per month.
  - Entitlement: **3.00%** on Basic Price.
  - Payout Frequency: **Quarterly** (credited via Credit Note at the end of each fiscal quarter).
- **Rule 3.2.5 (Quarterly Turnover Bonus [QTB] — 2.00%, Paid Quarterly)**:  
  - Entitlement: **2.00%** calculated on total Quarterly Basic turnover.
  - Payout Frequency: **Quarterly** settlement.
- **Rule 3.2.6 (Annual Turnover Bonus [ATB] — 3.00% on ₹1.20 Crore Target)**:  
  - Target: **₹1.20 Crore Basic turnover** over 12 months (Aug'26 to Jul'27, averaging ₹10.00 Lakhs/month).
  - Entitlement: **3.00%** annual bonus.
- **Rule 3.2.7 (Higher Slab Volume Upgrades)**:  
  - **Tier 1 (3.50%):** If monthly turnover reaches **₹30.00 Lakhs to ₹49.99 Lakhs** (Annualized ₹3,60,00,000 to ₹5,99,99,999), the incentive slab upgrades to **3.50%**.
  - **Tier 2 (4.50%):** If monthly turnover reaches **₹50.00 Lakhs & Above** (Annualized ₹6,00,00,000 & Above), the incentive slab upgrades to **4.50%**.

---

## 4. Tally Prime Double-Entry Accounting & Bill Entry Audit Rules

### 4.1 Inward Purchase Reconciliation (Physical PDF vs Tally)
- **Rule 4.1.1**: Every physical invoice in the Purchases folder must be entered in Tally Prime as a **Purchase Voucher**.
- **Rule 4.1.2**: The **Reference No.** in Tally must match the supplier invoice number.
- **Rule 4.1.3**: The voucher **Amount** in Tally must match the physical invoice **Grand Total** within $\pm ₹1.00$ (to allow for rounding differences). Any variance greater than ₹1.00 is a **Bill Entry Mistake**.

### 4.2 Bill-to-Ship-to Sales Matching (Purchase vs Sales)
- **Rule 4.2.1**: SKIL operates primarily on a Bill-to-Ship-to trading model. Inward Purchase Voucher #$N$ directly corresponds to Outward Sales Voucher `#SKIL-00N` (padded to 3 digits).
- **Rule 4.2.2**: The Sales Voucher party must match the **Consignee / Ship-To** party on the supplier invoice.
- **Rule 4.2.3**: If the Sales Voucher amount differs from the Purchase Voucher amount, flag the variance for review.

### 4.3 Vendor Credit Note Recording Rule
- **Rule 4.3.1**: When a supplier issues a Credit Note (e.g. Doc Type `DG` in Ajanta's Customer Ledger), it **MUST be immediately recorded in Tally Prime** as a **Credit Note Voucher**.
- **Rule 4.3.2**: Failure to enter supplier credit notes results in:
  - Overstating Sundry Creditors (vendor liability).
  - Failing to claim entitled scheme discounts, rate differences, and cash discounts.

### 4.4 Bank Statement Reconciliation
- **Rule 4.4.1**: Every debit to a supplier in the bank statement must have a corresponding **Payment Voucher** in Tally.
- **Rule 4.4.2**: Every credit from a customer in the bank statement must have a corresponding **Receipt Voucher** in Tally.

### 4.5 Stock Item & Article Master Naming Architecture (Anti-Typo Rules)
- **Rule 4.5.1 (Mandatory Brand Prefix)**:
  - Every Ajanta Shoes article MUST strictly begin with prefix **`AJ `** (uppercase `AJ` followed by a single space). Example: `AJ PUG 8438/4 06/09 MRP399/-`.
  - Every Xpania Footcare article MUST strictly begin with prefix **`XP `** (uppercase `XP` followed by a single space). Example: `XP 2203 BLACK 05/09 MRP349/-`.
  - Creating articles without an official brand prefix (e.g., bare `PUG 8438/4`) is strictly prohibited.
- **Rule 4.5.2 (MRP Suffix Syntax & Case)**:
  - Every stock item name MUST end with the standardized suffix **`MRP<Price>/-`** (strictly uppercase `MRP`, no spaces before price, ending with slash-hyphen `/-`).
  - Permitted examples: `MRP399/-`, `MRP159/-`, `MRP146/-`.
  - Prohibited formats: `mrp 399`, `MRP-399`, `MRP 399/-`, `MRP:399`.
- **Rule 4.5.3 (Physical Invoice MRP Verification & Anti-Typo Rule)**:
  - The MRP specified in the article name MUST exactly match the printed MRP on the physical supplier invoice PDF.
  - Never approximate, round, or guess the MRP.
  - Mathematical Cross-Check for Ajanta Hawaii/Footwear: Basic Rate = $\text{MRP} \times (1 - 0.4048) = \text{MRP} \times 0.5952$.
    - If Rate is ₹94.66, MRP = ₹94.66 / 0.5952 = **₹159.00**. Naming as `MRP165/-` is an audit violation.
- **Rule 4.5.4 (Size & Specification Standardization)**:
  - Format: `<BRAND_PREFIX> <ARTICLE_NAME> <COLOR_OR_VARIANT> <SIZE_RANGE> MRP<PRICE>/-`
  - Two-digit padded sizes are standard for ranges (e.g. `06/09`, `06/10`, `05/08`, `01/04`, `10/13`).
  - Single sizes are permitted only for items packaged with individual sizing (e.g. `03`, `05`, `06`, `07`, `10`).

---

## 5. Directory Structure & File Naming Conventions

All managed directories must adhere to the dynamic timestamp pattern:
`<Prefix> - last updated on <DD-MM-YYYY at HH-mm hrs>`

```
SKIL Master/
│
├── 📁 user-documents-read-only-access/
│   ├── 📁 Purchases - last updated on <timestamp>/          # Standardized Purchase Invoices
│   ├── 📁 Vendor Ledgers - last updated on <timestamp>/      # Supplier Customer Ledgers
│   ├── 📁 Bank - last updated on <timestamp>/                # Bank Statements (PDF & TXT)
│   ├── 📁 Official Documentation - last updated on <timestamp>/# Letters & Authorization Docs
│   ├── 📁 Sales/                                            # Customer Invoices (if separate)
│   ├── 📁 Credit Notes/                                     # Credit Note documents
│   ├── 📁 Debit Notes/                                      # Debit Note documents
│   └── 📁 GST Docs/                                         # GST Filings & GSTR-2B
│
├── 📁 Tally Files - last updated on <timestamp>/
│   └── 📁 Raw/                                              # Live Tally JSON snapshots
│
├── 📁 misc/SKIL Purchase Supplier Invoices/
│   ├── 📁 Truth_Data_Sources/                               # invoice.json & DayBook.json
│   └── 📁 Processing_Scripts/                               # Python extraction & audit scripts
│
└── 📁 sync-engine/                                          # Node.js backend & ERP web portal
```

### 5.1 Purchase Invoice File Naming Convention
1. **Ajanta Shoes**: `<InvoiceNo> - <PartyShort> <CityShort>.pdf`
   - Example: `1900412399 - SF SKLM.pdf` (Shree Footwear, Srikakulam)
   - Example: `1900402692 - KGN PVM.pdf` (K G N Footware, Parvathipuram)
   - Example: `1900402722 - Delight VZM.pdf` (Delight Footwear, Vizianagaram)
   - Example: `1900402723 - SBE RGDA.pdf` (Sri Brundabana Enterprises, Rayagada)
   - Example: `1900410889 - Jyothi VZM.pdf` (Jyothi Footwear, Vizianagaram)
2. **Xpania Footcare**: `XPL-<No>-26-27 - <PartyShort> <CityShort>.pdf`
   - Example: `XPL-2041-26-27 - Sushila JSG.pdf` (M/s Sushila Boot House, Jharsuguda)
   - Example: `XPL-2140-26-27 - Mahavir DNKL.pdf` (Mahavir Shoe House, Dhenkanal)

---

## 6. Audit Findings as of 19-09-2026

The automated audit script (`audit_all.py`) and live Tally synchronization revealed the following critical items:

### 6.1 Unrecorded Supplier Credit Notes in Tally (₹1,11,949.07)
The following 4 Credit Notes issued by Ajanta Shoes on 16.09.2026 are **MISSING IN TALLY**:
| Document No. | Date | Description | Credit Amount (₹) |
|---|---|---|---|
| `160005179` | 16.09.2026 | Non Bengal Scratch Coupon Scheme (01.08.26 to 31.08.26) | ₹25,727.00 |
| `160005127` | 16.09.2026 | Rate Difference on 1900405893 - 1900402693 (UL 979E/CH+M) | ₹2,773.95 |
| `160005126` | 16.09.2026 | 3% Cash Discount Missing as per agreement | ₹37,552.12 |
| `160005123` | 16.09.2026 | HW+FTW Retail Scheme @ 3.78% for August 2026 | ₹45,896.00 |
| **TOTAL** | | | **₹1,11,949.07** |

### 6.2 Missing Physical PDFs for Tally Invoices (₹1,95,070.00)
The following 7 invoices from 11.09.2026 are entered in Tally Prime, but their **physical PDF files are missing** from the Purchases directory:
- Vch #24: `1900410889` (Jyothi Footwear) — ₹22,894.00
- Vch #25: `1900410928` (Jyothi Footwear) — ₹18,857.00
- Vch #26: `1900410970` (Jyothi Footwear) — ₹4,238.00
- Vch #27: `1900410890` (K G N Footware) — ₹53,438.00
- Vch #28: `1900410929` (K G N Footware) — ₹56,783.00
- Vch #29: `1900410971` (K G N Footware) — ₹34,146.00
- Vch #30: `1900411104` (Jyothi Footwear) — ₹4,613.00

### 6.3 Missing Invoices in Tally from Ajanta Ledger
The following invoices appear in Ajanta's Customer Ledger but have **not been entered in Tally**:
- `1900409570` (05.09.2026) — ₹10,342.00
- `1900409616` (05.09.2026) — ₹5,419.00

### 6.4 Ajanta Under-Discount Overcharge Claim (₹2,745.06)
12 line items across Ajanta invoices were billed at less than 37.5% net discount, resulting in a **₹2,745.06** claim against Ajanta Shoes.
*(Note: Ajanta has already settled ₹2,773.95 via Credit Note #160005127 for rate differences on 1900405893 and 1900402693).*

---

## 7. Comprehensive GST-Compliant Credit Note Master Architecture & SOP

### 7.1 GST Law on Discounts & Credit Notes (Section 15(3) of CGST Act 2017)
Discounts are divided into two distinct legal categories under GST:

1. **Pre-Supply Trade Discount (Section 15(3)(a))**:
   - Recorded directly on the face of the invoice (e.g. Ajanta 37.5% trade discount).
   - Excluded from the taxable value before computing GST.

2. **Post-Supply Discounts & Financial Adjustments (Section 15(3)(b))**:
   - **Route A: GST Tax Credit Note (Section 34)**:
     - Allowed *only* if: (1) Pre-agreed in writing before supply, (2) Specifically linked to individual invoices, (3) Recipient reverses proportionate Input Tax Credit (ITC).
     - Reduces both Taxable Value and Output GST liability in GSTR-1 (Table 9B) and GSTR-3B.
   - **Route B: Commercial / Financial Credit Note (Without GST)**:
     - Clarified by **CBIC Circular No. 92/11/2019-GST** and **Circular No. 212/6/2024-GST**.
     - Used when post-sale discounts (cash discounts, turnover incentives, scratch coupons, or rate adjustments) are given **without reducing GST liability**.
     - **Key Legal Benefit**: Supplier does NOT alter GST paid; **Recipient is NOT required to reverse ITC**.
     - **Industry Standard**: Both Ajanta Shoes and SKIL Lifestyle LLP use **Commercial / Financial Credit Notes** for cash discounts, schemes, and turnover bonuses to avoid GST reconciliation disputes and ITC mismatches.

---

### 7.2 The "Non-Double Book Entry" Single Ledger Framework
"Non-double book entry" means maintaining a clean, single set of accounts without creating duplicate party ledgers or redundant offsetting journal entries:

* **Rule 1 (Single Party Ledger)**: All transactions with a party (purchases, payments, credit notes) MUST touch the exact same primary ledger:
  - Supplier: `Ajanta Shoes India Pvt. Ltd.` (Under: `Sundry Creditors`)
  - Customers: `M/S. SHREE FOOTWEAR`, `K G N FOOTWARE`, etc. (Under: `Sundry Debtors`)
  - *Never* create artificial ledgers like "Ajanta CD Account" or "Customer Discount Ledger" under Debtors/Creditors.
* **Rule 2 (Single Voucher Entry)**: Never enter a transaction twice (e.g., entering once in Credit Note and then passing an offsetting Journal or Payment entry). One event = exactly ONE voucher.
* **Rule 3 (Strict Bill-Wise Allocation)**: Always select **`Against Ref`** and tag the exact purchase or sales invoice being settled. This automatically knocks off outstanding balances without leaving floating unadjusted balances.

---

### 7.3 Master Ledger Setup in Tally Prime

| Ledger Name | Parent Group | GST Applicable | Purpose |
| :--- | :--- | :---: | :--- |
| `Ajanta Shoes India Pvt. Ltd.` | **Sundry Creditors** | Yes (Registered) | Vendor balance for Ajanta |
| `Cash Discount Received` | **Indirect Incomes** | Not Applicable | 3% and 1.88% CD from Ajanta |
| `Retail Scheme Incentives (Ajanta)` | **Indirect Incomes** | Not Applicable | 3.78% HW+FTW retail scheme |
| `Rate Difference Account` | **Indirect Incomes** | Not Applicable | Price protection / under-margin rebate |
| `Turnover Bonus & Target Incentives` | **Indirect Incomes** | Not Applicable | 3% Monthly, 2% Quarterly, Yearly bonuses |
| `Promotional Scheme Incentives` | **Indirect Incomes** | Not Applicable | Non-Bengal scratch coupon scheme |
| `Cash Discount Allowed - 30 Days` | **Indirect Expenses** | Not Applicable | Prompt payment discount given to customers (30d) |
| `Cash Discount Allowed - 45 Days` | **Indirect Expenses** | Not Applicable | Settlement discount given to customers (45d) |
| Customer Ledgers (e.g. `K G N FOOTWARE`) | **Sundry Debtors** | Yes (Registered/Unreg) | Customer receivable balance |

---

### 7.4 Standard Operating Procedures (SOP) for All 9 Credit Note Types

#### [Type 1] AJ 3% Cash Discount Credit Note from Supplier
- **Nature**: Financial credit note from Ajanta for prompt payment of monthly invoices.
- **Tally Voucher**: `Credit Note` (`Alt + F6`) or `Journal` (`F7`)
- **Accounting Entry**:
  - **Debit (By)**: `Ajanta Shoes India Pvt. Ltd.` &rarr; Reduces payable to Ajanta
  - **Credit (To)**: `Cash Discount Received` (Indirect Incomes)
- **Bill Allocation**: Select `Against Ref` &rarr; Pick the specific cleared invoices (or `New Ref: <CN_NO>`).
- **Standard Narration**:
  ```text
  Being Commercial Credit Note #160005126 dt 16.09.2026 received from Ajanta Shoes (India) Pvt. Ltd. towards 3% Cash Discount for prompt settlement of August 2026 purchases as per agreed terms. Commercial credit note without GST adjustment as per CBIC Circular 92/11/2019-GST.
  ```

#### [Type 2] AJ 3.78% HW+FTW RETAIL SCHEME Credit Note from Supplier
- **Nature**: Trade promotional scheme on qualifying Hardware & Footwear purchases.
- **Tally Voucher**: `Credit Note` (`Alt + F6`) or `Journal` (`F7`)
- **Accounting Entry**:
  - **Debit (By)**: `Ajanta Shoes India Pvt. Ltd.`
  - **Credit (To)**: `Retail Scheme Incentives (Ajanta)` (Indirect Incomes)
- **Bill Allocation**: `Against Ref` (or `New Ref: 160005123`).
- **Standard Narration**:
  ```text
  Being Commercial Credit Note #160005123 dt 16.09.2026 received from Ajanta Shoes (India) Pvt. Ltd. towards HW+FTW Retail Scheme @ 3.78% on August 2026 purchases credited to Scheme Incentives Received.
  ```

#### [Type 3] AJ RATE DIFFERENCE Credit Note from Supplier
- **Nature**: Margin correction / price protection settling under-discount claims (billed < 37.5%).
- **Tally Voucher**: `Credit Note` (`Alt + F6`) or `Journal` (`F7`)
- **Accounting Entry**:
  - **Debit (By)**: `Ajanta Shoes India Pvt. Ltd.`
  - **Credit (To)**: `Rate Difference Account` (Indirect Incomes)
- **Bill Allocation**: `Against Ref` &rarr; Link to invoices `1900405893` & `1900402693` (or `New Ref: 160005127`).
- **Standard Narration**:
  ```text
  Being Commercial Credit Note #160005127 dt 16.09.2026 received from Ajanta Shoes (India) Pvt. Ltd. towards rate difference on invoices 1900405893 & 1900402693 for article UL 979E/CH+M settling under-margin claim to maintain 37.5% net margin.
  ```

#### [Type 4] AJ 3% Monthly Bonus Credit Note from Supplier
- **Nature**: Monthly sales turnover target achievement incentive.
- **Tally Voucher**: `Credit Note` (`Alt + F6`) or `Journal` (`F7`)
- **Accounting Entry**:
  - **Debit (By)**: `Ajanta Shoes India Pvt. Ltd.`
  - **Credit (To)**: `Turnover Bonus & Target Incentives` (Indirect Incomes)
- **Standard Narration**:
  ```text
  Being Commercial Credit Note #<CN_NO> dt <DATE> received from Ajanta Shoes (India) Pvt. Ltd. towards 3% Monthly Turnover Target Bonus for the month of <MONTH> 2026 as per distributor agreement.
  ```

#### [Type 5] AJ 2% Quarterly Bonus Credit Note from Supplier
- **Nature**: Quarterly volume milestone achievement rebate.
- **Tally Voucher**: `Credit Note` (`Alt + F6`) or `Journal` (`F7`)
- **Accounting Entry**:
  - **Debit (By)**: `Ajanta Shoes India Pvt. Ltd.`
  - **Credit (To)**: `Turnover Bonus & Target Incentives` (Indirect Incomes)
- **Standard Narration**:
  ```text
  Being Commercial Credit Note #<CN_NO> dt <DATE> received from Ajanta Shoes (India) Pvt. Ltd. towards 2% Quarterly Volume Target Bonus for Q<X> (Period: <START_DATE> to <END_DATE>) as per distributor agreement.
  ```

#### [Type 6] AJ Yearly Bonus Credit Note from Supplier
- **Nature**: Annual volume milestone / distributor loyalty incentive rebate.
- **Tally Voucher**: `Credit Note` (`Alt + F6`) or `Journal` (`F7`)
- **Accounting Entry**:
  - **Debit (By)**: `Ajanta Shoes India Pvt. Ltd.`
  - **Credit (To)**: `Turnover Bonus & Target Incentives` (Indirect Incomes)
- **Standard Narration**:
  ```text
  Being Commercial Credit Note #<CN_NO> dt <DATE> received from Ajanta Shoes (India) Pvt. Ltd. towards Annual Volume Milestone Bonus for FY 2026-27 as per distributor agreement.
  ```

#### [Type 7] AJ NON BENGAL SCRATCH COUPON SCHEME_01.8.26 TO 31.8.26 from Supplier
- **Nature**: Consumer/retail promotional campaign scratch coupon reimbursement for Non-Bengal territory.
- **Tally Voucher**: `Credit Note` (`Alt + F6`) or `Journal` (`F7`)
- **Accounting Entry**:
  - **Debit (By)**: `Ajanta Shoes India Pvt. Ltd.`
  - **Credit (To)**: `Promotional Scheme Incentives` (Indirect Incomes)
- **Standard Narration**:
  ```text
  Being Commercial Credit Note #160005179 dt 16.09.2026 received from Ajanta Shoes (India) Pvt. Ltd. towards Non-Bengal Scratch Coupon Scheme reimbursement for the period 01.08.2026 to 31.08.2026.
  ```

#### [Type 8] 30 Days Cash Discount to Customers (Outward from SKIL)
- **Nature**: Commercial Credit Note issued by SKIL to customer for prompt settlement within 30 days.
- **GST Compliance**: Issued as a **Commercial / Financial Credit Note (without GST)** under CBIC Circular 92/11/2019. Customer does not reverse ITC; SKIL does not adjust output tax.
- **Tally Voucher**: `Credit Note` (`Alt + F6`) &rarr; Change Mode to **Accounting Invoice** or **As Voucher** (`Ctrl + H`)
- **Accounting Entry**:
  - **Debit (By)**: `Cash Discount Allowed - 30 Days` (Indirect Expenses)
  - **Credit (To)**: `<Customer Ledger>` (Sundry Debtors)
- **Bill Allocation**: Select **`Against Ref`** &rarr; Tag the exact customer sales invoice (e.g. `SKIL-004`).
- **Standard Narration**:
  ```text
  Being Commercial Credit Note issued to <Customer Name> towards 30-day prompt payment Cash Discount @ <X>% on Sales Invoice #<Invoice No> dt <Date> against payment received on <Date>. Commercial credit note without GST adjustment as per CBIC Circular 92/11/2019-GST.
  ```

#### [Type 9] 45 Days Cash Discount to Customers (Outward from SKIL)
- **Nature**: Commercial Credit Note issued by SKIL to customer for settlement within 45 days.
- **Tally Voucher**: `Credit Note` (`Alt + F6`) &rarr; Change Mode to **Accounting Invoice** or **As Voucher** (`Ctrl + H`)
- **Accounting Entry**:
  - **Debit (By)**: `Cash Discount Allowed - 45 Days` (Indirect Expenses)
  - **Credit (To)**: `<Customer Ledger>` (Sundry Debtors)
- **Bill Allocation**: Select **`Against Ref`** &rarr; Tag the relevant sales invoice.
- **Standard Narration**:
  ```text
  Being Commercial Credit Note issued to <Customer Name> towards 45-day settlement Cash Discount @ <X>% on Sales Invoice #<Invoice No> dt <Date> against payment received on <Date>. Commercial credit note without GST adjustment as per CBIC Circular 92/11/2019-GST.
  ```

---

## 8. Live Audit Findings & Historical Typo Log (as of 01-10-2026)

### 8.1 Active Typo Identified: Stock Item MRP Discrepancy in Tally
- **Stock Item Name in Tally**: `AJ FITNESS PLUS 101 DP.S.BLUE 07/10 MRP165/-`
- **Vouchers Affected**:
  - Purchase Voucher #42 (Invoice `1900416622` dt 28.09.2026, Sharvani Footwear)
  - Purchase Voucher #44 (Invoice `1900416912` dt 29.09.2026, M/s Sri Brundaban Enterprises)
- **Root Cause & Evidence**:
  - On both physical Ajanta tax invoices, the printed line is:
    `H2TK300171048 1FITNESS PLUS 101 DP.S.BLUE- SZ-7X10 (48) | MRP: 159.00 | Rate: 94.66`
  - Mathematical cross-check: $159.00 \times (1 - 0.4048) = 159.00 \times 0.5952 = 94.6368 \approx ₹94.66$.
  - The item was mistakenly created in Tally with **`MRP165/-`** instead of **`MRP159/-`**.
- **Corrective Action**:
  - Open Tally Prime &rarr; **`Alter`** &rarr; **`Stock Item`** &rarr; Select `AJ FITNESS PLUS 101 DP.S.BLUE 07/10 MRP165/-`.
  - Rename to: **`AJ FITNESS PLUS 101 DP.S.BLUE 07/10 MRP159/-`**.
  - Save with `Ctrl + A`. Tally automatically updates all historical references.

### 8.2 Resolved Typo: 10x Rate Multiplier in Purchase Voucher #45
- **Voucher**: Purchase #45 (Invoice `1900416927` dt 29.09.2026, M/s Sri Brundaban Enterprises)
- **Typo**: First line item `AJ PUG 8438/4 06/09 MRP399/-` was keyed in with rate **`₹2,377.50`** instead of **`₹237.50`**, inflating voucher total from ₹24,675.00 to ₹92,085.00.
- **Resolution**: Successfully corrected in Tally to **`₹237.50`**, restoring total to exactly **₹24,675.00**.

### 8.3 Inward Purchase Final Reconciliation (All 53 Vouchers Entered — 100% Complete)
- **Status of Invoice `1900416566`**:
  - **Invoice No:** `1900416566` (Dated 28.09.2026, ₹2,67,563.00, Sri Sharvani Traders, Visakhapatnam)
  - **Status:** **CONFIRMED CANCELLED** by user/supplier.
  - **Action Taken:** Excluded from Tally entries and excluded from purchase turnover calculations.
  - **Net Purchase Vouchers in Tally:** Exactly **53 Purchase Vouchers** entered, representing 100% of all valid physical invoices. **Zero purchase entries pending.**

---

### 8.4 Tax Audit Finding: Output IGST in Purchase Vouchers #38 to #42 (✅ RESOLVED & VERIFIED)
- **Original Discrepancy**: Vouchers #38, #39, #40, #41, and #42 had `Output IGST` mistakenly selected instead of `Input IGST`.
- **Live Verification (01-10-2026 at 21:10 hrs)**:
  - Vch #38 (`1900415903`): Corrected to **`Input IGST`** (₹497.98) ✅
  - Vch #39 (`1900415994`): Corrected to **`Input IGST`** (₹266.97) ✅
  - Vch #40 (`1900416575`): Corrected to **`Input IGST`** (₹14,381.87) ✅
  - Vch #41 (`1900416574`): Corrected to **`Input IGST`** (₹3,726.85) ✅
  - Vch #42 (`1900416622`): Corrected to **`Input IGST`** (₹2,394.39) ✅
- **Current Status**: **100% RESOLVED.** All 53 purchase vouchers now strictly use `Input IGST`.

---

### 8.5 Comprehensive GST Ledger Classification Master Summary (100% Audited)

| Transaction Type | Total Vouchers | Input GST Present? | Output GST Present? | Compliance Status & Legal Rationale |
|:---|:---:|:---:|:---:|:---|
| **Purchases (Inward)** | **53** | **53 / 53** (100%) | **0 / 53** (None) | **100% Clean & Verified.** All 53 purchase vouchers strictly debit `Input IGST`. Zero instances of Output GST. |
| **Sales (Outward)** | **38** | **0 / 38** (None) | **38 / 38** (100%) | **100% Clean & Verified.** Uses `Output IGST` for Odisha customers and `Output CGST` + `Output SGST` for Andhra Pradesh customers. |
| **Debit Notes (Ajanta)** | **4** | **4 / 4** (100%) | **0 / 4** (None) | **100% Correct.** All 4 Debit Notes credit `Input IGST`, reversing 5% proportionate ITC on discounts received from Ajanta. |
| **Credit Notes (Customers)** | **4** | **0 / 4** (None) | **0 / 4** (None) | **Commercial / Financial Credit Notes.** Debited to `Cash Discount` (Indirect Expense) without altering Output GST liability, compliant under CBIC Circular 92/11/2019-GST. |




