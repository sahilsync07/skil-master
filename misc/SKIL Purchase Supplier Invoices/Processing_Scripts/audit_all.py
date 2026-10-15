import os
import fitz
import re
import json
import sys

def main():
    # 1. Load Vouchers from sync-engine database
    vouchers_path = r"C:\Projects\SKIL Master\sync-engine\data\vouchers.json"
    with open(vouchers_path, "r", encoding="utf-8") as f:
        tally_vouchers = json.load(f)

    # 2. Load Invoice JSON
    invoice_json_path = r"C:\Projects\SKIL Master\misc\SKIL Purchase Supplier Invoices\Truth_Data_Sources\invoice.json"
    with open(invoice_json_path, "r", encoding="utf-8") as f:
        invoices_data = json.load(f)

    # 3. Load Ajanta Ledger entries
    base_user_docs = r"C:\Projects\SKIL Master\user-documents-read-only-access"
    vendor_ledgers_dir = None
    for d in os.listdir(base_user_docs):
        if d.lower().startswith("vendor ledgers"):
            vendor_ledgers_dir = os.path.join(base_user_docs, d)
            break

    ledger_path = os.path.join(vendor_ledgers_dir, "AJANTA LEDGER FOR SKIL LIFESTYLE till 18-09-2026.pdf") if vendor_ledgers_dir else None
    ledger_entries = []

    if ledger_path and os.path.exists(ledger_path):
        ledger_doc = fitz.open(ledger_path)
        ledger_text = "\n".join([p.get_text() for p in ledger_doc])
        lines = [l.strip() for l in ledger_text.splitlines() if l.strip()]
        for i, l in enumerate(lines):
            dm = re.match(r"^\d{2}\.\d{2}\.\d{4}$", l)
            if dm and i + 5 < len(lines):
                doc_date = l
                doc_no = lines[i+1]
                doc_type = lines[i+2]
                debit = None
                credit = None
                for j in range(i+3, min(len(lines), i+10)):
                    if lines[j] in ["1001", "Page:"]:
                        break
                    if re.match(r"^[\d,]+\.\d{2}$", lines[j]):
                        val = float(lines[j].replace(",", ""))
                        if debit is None:
                            debit = val
                        elif credit is None:
                            credit = val
                ledger_entries.append({
                    "date": doc_date,
                    "doc_no": doc_no,
                    "doc_type": doc_type,
                    "debit": debit,
                    "credit": credit
                })

    print("=" * 80)
    print(f"1. TOTAL INVOICES IN INVOICE.JSON: {len(invoices_data)}")
    print(f"2. TOTAL VOUCHERS IN TALLY: {len(tally_vouchers)}")
    print(f"3. TOTAL ENTRIES IN AJANTA LEDGER: {len(ledger_entries)}")
    print("=" * 80)

    tally_purchases = [v for v in tally_vouchers.values() if (v.get("voucherType") or "").lower() == "purchase"]
    tally_sales = [v for v in tally_vouchers.values() if (v.get("voucherType") or "").lower() == "sales"]
    tally_payments = [v for v in tally_vouchers.values() if (v.get("voucherType") or "").lower() == "payment"]

    # CHECK A: PHYSICAL INVOICES VS TALLY PURCHASES
    print("\n--- CHECK A: PHYSICAL INVOICES VS TALLY PURCHASES ---")
    missing_in_tally = []
    amount_mismatches = []
    for inv in invoices_data:
        inv_no = str(inv["invoice no"])
        inv_amt = inv["data"]["grand total"]
        supplier = inv.get("supplier", "")
        match_tp = None
        for tp in tally_purchases:
            ref = str(tp.get("reference") or "")
            vnum = str(tp.get("voucherNumber") or "")
            narr = str(tp.get("narration") or "")
            if inv_no in ref or inv_no in vnum or inv_no in narr or (ref and ref in inv_no):
                match_tp = tp
                break
        if not match_tp:
            missing_in_tally.append((inv_no, supplier, inv_amt))
            print(f"[MISSING IN TALLY] Inv #{inv_no} ({supplier}) - Amount: Rs {inv_amt:,.2f}")
        else:
            t_amt = match_tp.get("amount", 0)
            if abs(t_amt - inv_amt) > 1.0:
                amount_mismatches.append((inv_no, inv_amt, match_tp.get("voucherNumber"), t_amt, t_amt - inv_amt))
                print(f"[AMOUNT MISMATCH] Inv #{inv_no}: PDF=Rs {inv_amt:,.2f} vs Tally Vch #{match_tp.get('voucherNumber')}=Rs {t_amt:,.2f} (Diff: Rs {t_amt - inv_amt:,.2f})")

    if not missing_in_tally and not amount_mismatches:
        print("[ALL CLEAR] All physical invoices match Tally Purchases!")

    # CHECK B: TALLY PURCHASES VS PHYSICAL INVOICES
    print("\n--- CHECK B: TALLY PURCHASES VS PHYSICAL INVOICES ---")
    pdf_inv_nos = set(str(inv["invoice no"]) for inv in invoices_data)
    missing_pdfs = []
    for tp in tally_purchases:
        ref = str(tp.get("reference") or "")
        vnum = str(tp.get("voucherNumber") or "")
        found = any((ref and ref in pno) or (ref and pno in ref) for pno in pdf_inv_nos)
        if not found:
            missing_pdfs.append((vnum, ref, tp.get("date"), tp.get("amount")))
            print(f"[MISSING PHYSICAL PDF] Tally Purchase Vch #{vnum} (Ref: {ref}) - Date: {tp.get('date')} - Amount: Rs {tp.get('amount'):,.2f}")

    if not missing_pdfs:
        print("[ALL CLEAR] Every Tally purchase voucher has a physical PDF invoice!")

    # CHECK C: BILL-TO-SHIP-TO SALES VS PURCHASE VOUCHERS
    print("\n--- CHECK C: BILL-TO-SHIP-TO SALES VS PURCHASE VOUCHERS ---")
    sales_diffs = []
    for tp in tally_purchases:
        vnum = tp.get("voucherNumber")
        ref = tp.get("reference")
        expected_sales_num = f"SKIL-{int(vnum):03d}" if str(vnum).isdigit() else None
        match_sale = next((s for s in tally_sales if s.get("voucherNumber") == expected_sales_num), None)
        if match_sale:
            diff = match_sale.get("amount", 0) - tp.get("amount", 0)
            if abs(diff) > 0.01:
                sales_diffs.append((vnum, ref, tp.get("amount"), expected_sales_num, match_sale.get("amount"), diff))
                print(f"[PURCHASE VS SALES DIFF] Vch #{vnum} (Ref: {ref}): Purchase=Rs {tp.get('amount'):,.2f} vs Sales #{expected_sales_num}=Rs {match_sale.get('amount'):,.2f} (Diff: Rs {diff:,.2f})")
        else:
            print(f"[NO MATCHING SALES VOUCHER] Purchase Vch #{vnum} has no Sales {expected_sales_num}")

    # CHECK D: AJANTA LEDGER CREDIT NOTES (DG) VS TALLY
    print("\n--- CHECK D: AJANTA LEDGER CREDIT NOTES (DG) VS TALLY ---")
    tally_cn = [v for v in tally_vouchers.values() if "credit" in (v.get("voucherType") or "").lower()]
    print(f"Total Credit Note vouchers in Tally: {len(tally_cn)}")
    for le in ledger_entries:
        if le.get("doc_type") == "DG":
            c_amt = le.get("credit") or le.get("debit") or 0.0
            print(f"[UNRECORDED CREDIT NOTE IN TALLY] Doc #{le['doc_no']} Date: {le['date']} Credit: Rs {c_amt:,.2f}")

    # CHECK E: AJANTA LEDGER PURCHASES (RV) VS TALLY
    print("\n--- CHECK E: AJANTA LEDGER PURCHASES (RV) VS TALLY ---")
    for le in ledger_entries:
        if le.get("doc_type") == "RV":
            doc_no = le.get("doc_no")
            d_amt = le.get("debit") or le.get("credit") or 0.0
            match = any(doc_no in str(tp.get("reference") or "") for tp in tally_purchases)
            if not match:
                print(f"[LEDGER INVOICE NOT IN TALLY] Inv #{doc_no} Date: {le['date']} Debit: Rs {d_amt:,.2f}")

    # CHECK F: AJANTA 37.5% DISCOUNT AUDIT (ONLY FOR AJANTA!)
    print("\n--- CHECK F: AJANTA 37.5% DISCOUNT AUDIT (ONLY FOR AJANTA!) ---")
    ajanta_invoices = [inv for inv in invoices_data if "ajanta" in inv.get("supplier", "").lower()]
    under_discount_count = 0
    total_overcharge = 0.0
    for inv in ajanta_invoices:
        inv_no = inv["invoice no"]
        for it in inv["data"]["bill data"]:
            mrp = float(it.get("MRP") or 0)
            rate = float(it.get("Rate") or 0)
            pairs = int(it.get("Pair") or 0)
            landed = round(rate * 1.05, 2)
            discount = round(((mrp - landed) / mrp) * 100, 2) if mrp > 0 else 0
            if discount < 37.45:
                expected_landed = round(mrp * 0.625, 2)
                loss_per_pair = max(0, round(landed - expected_landed, 2))
                line_loss = round(loss_per_pair * pairs, 2)
                under_discount_count += 1
                total_overcharge += line_loss
                print(f"[UNDER DISCOUNT] Inv #{inv_no} | {it.get('Description')} | MRP: {mrp} | Rate: {rate} | Disc: {discount:.2f}% (Expected 37.5%) | Loss: Rs {line_loss:,.2f}")

    print(f"\nAjanta Discount Summary: {under_discount_count} items billed under 37.5% discount. Total Overcharge Claim: Rs {total_overcharge:,.2f}")

if __name__ == "__main__":
    main()
