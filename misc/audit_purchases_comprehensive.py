import os
import json
import re
import fitz
import glob

base_dir = r"c:\Projects\SKIL Master"
purchases_dir = glob.glob(os.path.join(base_dir, "user-documents-read-only-access", "Purchases*"))[0]
vouchers_json_path = os.path.join(base_dir, "sync-engine", "data", "vouchers.json")

with open(vouchers_json_path, "r", encoding="utf-8") as f:
    vouchers_dict = json.load(f)

purchase_vouchers = [v for v in vouchers_dict.values() if v.get("voucherType") == "Purchase"]

def sort_key(v):
    vn = str(v.get("voucherNumber", "0"))
    if vn.isdigit():
        return int(vn)
    return 999999

purchase_vouchers.sort(key=sort_key)

def extract_pdf_data(pdf_path):
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"

    # Invoice No
    inv_no = None
    m_xp = re.search(r"\b(XPL-[0-9\-]+)\b", full_text, re.IGNORECASE)
    if m_xp:
        inv_no = m_xp.group(1).strip()
    else:
        m_aj = re.search(r"Invoice\s*No\.?\s*[:\s]*([0-9]{10})", full_text, re.IGNORECASE)
        if m_aj:
            inv_no = m_aj.group(1).strip()
        else:
            m_any = re.search(r"\b(19004\d{5})\b", full_text)
            if m_any:
                inv_no = m_any.group(1).strip()
    if not inv_no:
        fn = os.path.basename(pdf_path)
        m_fn = re.search(r"^([0-9A-Za-z\-]+)", fn)
        if m_fn:
            inv_no = m_fn.group(1).strip()

    # Grand Total
    grand_total = None
    m_aj_tot = re.search(r"Grand\s*Total:\s*Rupees[\s\S]*?Only\s*\n\s*([0-9,]+\.[0-9]{2})", full_text, re.IGNORECASE)
    if m_aj_tot:
        grand_total = float(m_aj_tot.group(1).replace(",", ""))
    else:
        # Xpania
        lines = [l.strip() for l in full_text.splitlines() if l.strip()]
        for i, l in enumerate(lines):
            if l == "Total" and i + 1 < len(lines):
                # Look ahead for amount
                for offset in range(1, 5):
                    candidate = lines[i + offset].replace(",", "")
                    candidate = re.sub(r"^[^\d.]+", "", candidate)
                    if re.match(r"^\d+\.\d{2}$", candidate):
                        val = float(candidate)
                        if val > 1000:
                            grand_total = val
                            break
                if grand_total:
                    break

    # Consignee
    consignee_block = ""
    m_cons = re.search(r"Consignee\s*\([^\)]*\)\s*(.*?)(Buyer\s*\(|Dispatch|Declaration|$)", full_text, re.DOTALL | re.IGNORECASE)
    if m_cons:
        consignee_block = m_cons.group(1).strip()

    c_lower = consignee_block.lower()
    full_lower = full_text.lower()

    detected_code = "UNKNOWN"
    detected_party = "UNKNOWN"
    detected_city = "UNKNOWN"

    if "brundabana" in c_lower or "brundaban" in c_lower:
        if "malkangiri" in c_lower or "malakangiri" in c_lower:
            detected_code = "SBEM"
            detected_party = "Sri Brundabana Enterprises (Malkangiri)"
            detected_city = "Malkangiri"
        else:
            detected_code = "SBE"
            detected_party = "Sri Brundabana Enterprises"
            detected_city = "Rayagada"
    elif "shree footwear" in c_lower:
        detected_code = "SF"
        detected_party = "M/s. Shree Footwear"
        detected_city = "Srikakulam"
    elif "delight" in c_lower:
        detected_code = "Delight"
        detected_party = "Delight Footwear"
        detected_city = "Vizianagaram"
    elif "k.g.n" in c_lower or "kgn" in c_lower or "k g n" in c_lower:
        detected_code = "KGN"
        detected_party = "K G N Footware"
        detected_city = "Parvathipuram"
    elif "sharvani" in c_lower:
        detected_code = "Sharvani"
        detected_party = "Sharvani Footwear"
        detected_city = "Srikakulam"
    elif "jyothi" in c_lower:
        detected_code = "Jyothi"
        detected_party = "Jyothi Footwear"
        detected_city = "Vizianagaram"
    elif "sushila" in c_lower:
        detected_code = "Sushila"
        detected_party = "M/s Sushila Boot House"
        detected_city = "Jharsuguda"
    elif "mahavir" in c_lower:
        detected_code = "Mahavir"
        detected_party = "Mahavir Shoe House"
        detected_city = "Dhenkanal"

    # Cartons
    ctns = None
    m_ctn = re.search(r"(\d+)\s*(?:Ctns?|Cartons?|Box(?:es)?)", full_text, re.IGNORECASE)
    if m_ctn:
        ctns = int(m_ctn.group(1))

    return {
        "invoice_no": inv_no,
        "grand_total": grand_total,
        "consignee_block": consignee_block.replace("\n", " ")[:200],
        "detected_code": detected_code,
        "detected_party": detected_party,
        "detected_city": detected_city,
        "ctns": ctns,
        "filename": os.path.basename(pdf_path)
    }

pdf_map = {}
for pf in os.listdir(purchases_dir):
    if pf.lower().endswith(".pdf"):
        ppath = os.path.join(purchases_dir, pf)
        pdata = extract_pdf_data(ppath)
        inv = pdata["invoice_no"]
        pdf_map[inv] = pdata
        if inv:
            pdf_map[inv.replace("-", "/")] = pdata
            pdf_map[inv.replace("/", "-")] = pdata

audit_rows = []
all_issues = []

for pv in purchase_vouchers:
    vch_no = str(pv.get("voucherNumber", ""))
    ref = pv.get("reference", "").strip()
    vch_amt = abs(float(pv.get("amount", 0)))
    vch_date = pv.get("date", "")
    narration = pv.get("narration", "").strip()
    inv_entries = pv.get("inventoryEntries", [])
    supplier = pv.get("partyName", "")

    pdata = pdf_map.get(ref)
    if not pdata:
        pdata = pdf_map.get(ref.replace("/", "-"))

    # 1. Amount match
    amt_match = True
    amt_diff = 0.0
    pdf_amt = None
    if pdata and pdata.get("grand_total") is not None:
        pdf_amt = pdata["grand_total"]
        amt_diff = abs(vch_amt - pdf_amt)
        if amt_diff > 1.0:
            amt_match = False
            all_issues.append(f"Vch #{vch_no} (Ref {ref}): AMOUNT MISMATCH -> Tally: {vch_amt}, PDF: {pdf_amt} (Diff: {amt_diff})")

    # 2. Narration ship-to match
    narr_match = True
    narr_reason = ""
    if pdata:
        exp_code = pdata["detected_code"]
        exp_party = pdata["detected_party"]
        exp_city = pdata["detected_city"]
        n_up = narration.upper()

        if exp_code == "SBEM":
            if "SBEM" not in n_up and "MALKANGIRI" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is SBEM ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
        elif exp_code == "SBE":
            if "SBE" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is SBE ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
            elif "MALKANGIRI" in n_up or "SBEM" in n_up:
                narr_match = False
                narr_reason = f"Ship-To is SBE Rayagada but narration mentions Malkangiri: '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
        elif exp_code == "SF":
            if "SF" not in n_up and "SHREE" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is SF ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
        elif exp_code == "Delight":
            if "DELIGHT" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is Delight ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
        elif exp_code == "KGN":
            if "KGN" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is KGN ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
        elif exp_code == "Sharvani":
            if "SHARVANI" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is Sharvani ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
        elif exp_code == "Jyothi":
            if "JYOTHI" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is Jyothi ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
        elif exp_code == "Sushila":
            if "SUSHILA" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is Sushila ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
        elif exp_code == "Mahavir":
            if "MAHAVIR" not in n_up:
                narr_match = False
                narr_reason = f"Ship-To is Mahavir ({exp_city}) but narration is '{narration}'"
                all_issues.append(f"Vch #{vch_no} (Ref {ref}): SHIP-TO MISMATCH -> {narr_reason}")
    else:
        narr_match = True # No PDF to cross-check, check manually

    # 3. Item naming & prefixes
    item_errors = []
    for it in inv_entries:
        it_name = it.get("stockItemName", "")
        if "Ajanta" in supplier and not it_name.startswith("AJ "):
            item_errors.append(f"Missing 'AJ ' prefix: '{it_name}'")
        elif "Xpania" in supplier and not it_name.startswith("XP "):
            item_errors.append(f"Missing 'XP ' prefix: '{it_name}'")
        if not re.search(r"MRP\d+(\.\d+)?/-$", it_name):
            item_errors.append(f"Wrong MRP suffix: '{it_name}'")

    if item_errors:
        for ie in item_errors:
            all_issues.append(f"Vch #{vch_no} (Ref {ref}): ITEM ERROR -> {ie}")

    audit_rows.append({
        "vch_no": vch_no,
        "date": vch_date,
        "reference": ref,
        "supplier": supplier,
        "tally_amount": vch_amt,
        "pdf_amount": pdf_amt,
        "amt_match": amt_match,
        "narration": narration,
        "consignee_code": pdata["detected_code"] if pdata else "NO_PDF",
        "consignee_party": pdata["detected_party"] if pdata else "NO_PDF",
        "consignee_city": pdata["detected_city"] if pdata else "NO_PDF",
        "narr_match": narr_match,
        "narr_reason": narr_reason,
        "item_count": len(inv_entries),
        "item_errors": item_errors,
        "has_pdf": pdata is not None
    })

print(f"\n================ AUDIT SUMMARY ================")
print(f"Total Purchase Vouchers Audited: {len(audit_rows)}")
print(f"Total Strict Issues Found: {len(all_issues)}")
for iss in all_issues:
    print("  ->", iss)

with open(os.path.join(base_dir, "misc", "audit_complete_report.json"), "w", encoding="utf-8") as f:
    json.dump({"total": len(audit_rows), "issueCount": len(all_issues), "issues": all_issues, "rows": audit_rows}, f, indent=2)
