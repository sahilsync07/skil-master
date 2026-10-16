import os
import fitz
import re
import json

def get_purchases_dir():
    base_dir = r"C:\Projects\SKIL Master\user-documents-read-only-access"
    if os.path.exists(base_dir):
        for d in os.listdir(base_dir):
            if d.lower().startswith("purchases") and os.path.isdir(os.path.join(base_dir, d)):
                return os.path.join(base_dir, d)
    # Fallback to misc folder
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    matching = [d for d in os.listdir(root) if d.startswith("Invoices - Aug 2026") and os.path.isdir(os.path.join(root, d))]
    return os.path.join(root, matching[0]) if matching else os.path.join(root, "Invoices - Aug 2026 (Updated 31-08-2026)")

def parse_ajanta_invoice(full_text, fname):
    inv_m = re.search(r"Inv\.\s*No\.\s*:\s*(\d+)", full_text)
    parts = fname.replace(".pdf", "").split(" - ")
    fallback_no = parts[1] if (len(parts) > 1 and (parts[0].isdigit() or parts[0] == "PENDING")) else parts[0].strip()
    inv_no = inv_m.group(1) if inv_m else fallback_no

    date_m = re.search(r"Inv\.\s*Date\s*:\s*([\d\.]+)", full_text)
    inv_date = date_m.group(1) if date_m else ""

    ship_to_name = ""
    ship_to_addr = ""
    ship_to_gstin = ""
    ship_to_phone = ""

    ship_to_block_m = re.search(r"(?:Ship-To|Consignee):\s*\n(.*?)(?:Bill-To|Buyer|Order No|Dealer Code)", full_text, re.DOTALL)
    if ship_to_block_m:
        lines = [l.strip() for l in ship_to_block_m.group(1).split("\n") if l.strip()]
        if lines:
            ship_to_name = lines[0]
            for l in lines:
                if "GSTIN" in l:
                    gm = re.search(r"GSTIN:\s*([A-Z0-9]{15})", l)
                    if gm:
                        ship_to_gstin = gm.group(1)
                elif "Phone" in l or "Ph" in l:
                    ship_to_phone = l.replace("Phone:", "").replace("Ph:", "").strip()
            addr_lines = [l for l in lines[1:] if not l.startswith("GSTIN") and not l.startswith("Phone") and not l.startswith("[Code") and not l.startswith("[code")]
            ship_to_addr = ", ".join(addr_lines)

    items = []
    sections = re.split(r"-{20,}", full_text)

    for sec in sections:
        sec_clean = sec.strip()
        if "HSN/SAC:" in sec_clean:
            raw_lines = [l.strip() for l in sec_clean.split("\n") if l.strip() and not l.startswith("Page:") and not l.startswith("Continued")]
            hsn_m = re.search(r"HSN/SAC:\s*(\d+)", sec_clean)
            hsn = hsn_m.group(1) if hsn_m else "640220"

            hsn_idx = -1
            for idx, l in enumerate(raw_lines):
                if "HSN/SAC:" in l:
                    hsn_idx = idx
                    break

            if hsn_idx != -1 and len(raw_lines) > hsn_idx + 6:
                desc_lines = raw_lines[:hsn_idx]
                full_desc = " ".join(desc_lines)
                brand_code = desc_lines[0] if len(desc_lines) > 1 else ""
                prod_desc = " ".join(desc_lines[1:]) if len(desc_lines) > 1 else full_desc

                pack_val = raw_lines[hsn_idx+1].replace(",", "")
                carton_val = raw_lines[hsn_idx+2].replace(",", "")
                pair_val = raw_lines[hsn_idx+3].replace(",", "")
                mrp_val = raw_lines[hsn_idx+4].replace(",", "")
                rate_val = raw_lines[hsn_idx+5].replace(",", "")
                amt_val = raw_lines[hsn_idx+6].replace(",", "")

                try:
                    pack = int(float(pack_val))
                    carton = int(float(carton_val))
                    pair = int(float(pair_val))
                    mrp = float(mrp_val)
                    rate = float(rate_val)
                    amt = float(amt_val)
                except ValueError:
                    pack = 0
                    carton = 0
                    pair = 0
                    mrp = 0.0
                    rate = 0.0
                    amt = 0.0

                items.append({
                    "Brand/Product": brand_code or prod_desc,
                    "Description": prod_desc,
                    "HSN/SAC": hsn,
                    "Pack": pack,
                    "Carton": carton,
                    "Pair": pair,
                    "MRP": mrp,
                    "Rate": rate,
                    "Amount(Rs.)": amt
                })

    total_carton = sum(it["Carton"] for it in items)
    total_pair = sum(it["Pair"] for it in items)
    total_taxable = round(sum(it["Amount(Rs.)"] for it in items), 2)

    gst_rate = 5.0
    gst_amt = round(total_taxable * 0.05, 2)
    gst_m = re.search(r"Add:IN:Integrated GST[^\n]*\n+([\d,]+\.\d{2})", full_text)
    if gst_m:
        gst_amt = float(gst_m.group(1).replace(",", ""))

    gt_m = re.search(r"Grand Total:.*?(?:Only\s*\n+)?\s*([\d,]+\.\d{2})", full_text, re.DOTALL)
    grand_total = float(gt_m.group(1).replace(",", "")) if gt_m else round(total_taxable + gst_amt, 2)

    ro_m = re.search(r"(?:Add|Less):Sales RO(?:\(([+-]?)\))?\s*\n+([-\d,]+\.\d{2})", full_text)
    if ro_m:
        val = float(ro_m.group(2).replace(",", ""))
        if "Less" in ro_m.group(0) or ro_m.group(1) == "-":
            ro_amt = -abs(val)
        else:
            ro_amt = abs(val)
    else:
        ro_amt = round(grand_total - (total_taxable + gst_amt), 2)

    return {
        "invoice no": inv_no,
        "supplier": "Ajanta Shoes (India) Pvt. Ltd.",
        "ship to": {
            "name": ship_to_name,
            "address": ship_to_addr,
            "gstin": ship_to_gstin,
            "phone": ship_to_phone
        },
        "date": inv_date,
        "data": {
            "bill data": items,
            "total": {
                "Carton": total_carton,
                "Pair": total_pair,
                "Amount(Rs.)": total_taxable
            },
            "gst": {
                "description": "Add:IN:Integrated GST-OP(5.00%)",
                "rate": gst_rate,
                "amount": gst_amt
            },
            "round off": {
                "description": "Sales Round Off",
                "amount": ro_amt
            },
            "grand total": grand_total
        }
    }

def parse_xpania_invoice(doc, fname):
    pages_text = []
    for page in doc:
        t = page.get_text()
        if "DUPLICATE FOR TRANSPORTER" in t or "TRIPLICATE" in t:
            break
        pages_text.append(t)
    full_text = "\n".join(pages_text)

    inv_m = re.search(r"XPL\/[0-9]+\/[0-9\-]+", full_text)
    parts = fname.replace(".pdf", "").split(" - ")
    fallback_no = parts[1] if (len(parts) > 1 and (parts[0].isdigit() or parts[0] == "PENDING")) else parts[0].strip()
    inv_no = inv_m.group(0) if inv_m else fallback_no

    date_m = re.search(r"Dated\s*\n+([0-9A-Za-z\-]+)", full_text)
    inv_date = date_m.group(1) if date_m else ""

    ship_m = re.search(r"Consignee \(Ship to\)\s*\n+(.*?)(?:Buyer|GSTIN)", full_text, re.DOTALL)
    consignee_lines = [l.strip() for l in ship_m.group(1).splitlines() if l.strip()] if ship_m else []
    ship_to_name = consignee_lines[0] if consignee_lines else "Unknown"
    ship_to_addr = ", ".join(consignee_lines[1:]) if len(consignee_lines) > 1 else ""

    gstin_m = re.search(r"GSTIN/UIN\s*:\s*([A-Z0-9]{15})", full_text)
    ship_to_gstin = gstin_m.group(1) if gstin_m else ""

    lines = [l.strip() for l in full_text.splitlines() if l.strip()]
    items = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(\d+)\s+(.*(?:ART\s*NO|V/A|VIA).*)", line, re.IGNORECASE)
        if m:
            sl = m.group(1)
            desc_parts = [m.group(2)]
            i += 1
            while i < len(lines) and not re.match(r"^[\d,]+\.\d{2}$", lines[i]):
                desc_parts.append(lines[i])
                i += 1
            desc = " ".join(desc_parts)

            amount = float(lines[i].replace(",", "")) if i < len(lines) else 0.0
            i += 1
            if i < len(lines) and lines[i] == "PRS":
                i += 1
            rate = float(lines[i].replace(",", "")) if i < len(lines) else 0.0
            i += 1
            qty = 0
            if i < len(lines):
                qm = re.match(r"(\d+)\s*PRS", lines[i])
                if qm:
                    qty = int(qm.group(1))
                i += 1
            cases = 0
            if i < len(lines):
                cm = re.match(r"(\d+)\s*CASE", lines[i])
                if cm:
                    cases = int(cm.group(1))
                i += 1
            mrp = 0.0
            if i < len(lines):
                mm = re.match(r"([\d,]+\.\d{2})/PRS", lines[i])
                if mm:
                    mrp = float(mm.group(1).replace(",", ""))
                i += 1
            hsn = lines[i] if i < len(lines) else "640299"
            i += 1

            items.append({
                "Brand/Product": desc,
                "Description": desc,
                "HSN/SAC": hsn,
                "Pack": qty // cases if cases > 0 else qty,
                "Carton": cases,
                "Pair": qty,
                "MRP": mrp,
                "Rate": rate,
                "Amount(Rs.)": amount
            })
        else:
            i += 1

    total_carton = sum(it["Carton"] for it in items)
    total_pair = sum(it["Pair"] for it in items)
    total_taxable = round(sum(it["Amount(Rs.)"] for it in items), 2)

    gst_amt = round(total_taxable * 0.05, 2)
    igst_m = re.search(r"OUT PUT IGST 5%\s*\n+([\d,]+\.\d{2})", full_text) or re.search(r"IGST\s*Total.*?([\d,]+\.\d{2})", full_text, re.DOTALL)
    if igst_m:
        gst_amt = float(igst_m.group(1).replace(",", ""))

    gt_m = re.search(r"Total\s*\n+[^\d]*([\d,]+\.\d{2})\s*\n+[\d,]+\s*PRS", full_text)
    grand_total = float(gt_m.group(1).replace(",", "")) if gt_m else round(total_taxable + gst_amt, 2)

    ro_m = re.search(r"ROUND OFF\s*\n+([-\(\)\d\.]+)", full_text)
    ro_amt = 0.0
    if ro_m:
        val_str = ro_m.group(1).replace("(", "-").replace(")", "")
        try:
            ro_amt = float(val_str)
        except ValueError:
            ro_amt = 0.0

    return {
        "invoice no": inv_no,
        "supplier": "Xpania Footcare LLP",
        "ship to": {
            "name": ship_to_name,
            "address": ship_to_addr,
            "gstin": ship_to_gstin,
            "phone": ""
        },
        "date": inv_date,
        "data": {
            "bill data": items,
            "total": {
                "Carton": total_carton,
                "Pair": total_pair,
                "Amount(Rs.)": total_taxable
            },
            "gst": {
                "description": "Add:IN:Integrated GST-OP(5.00%)",
                "rate": 5.0,
                "amount": gst_amt
            },
            "round off": {
                "description": "Sales Round Off",
                "amount": ro_amt
            },
            "grand total": grand_total
        }
    }

def main():
    pdf_folder = get_purchases_dir()
    print(f"Reading invoices from: {pdf_folder}")

    truth_folder = os.path.join(r"C:\Projects\SKIL Master\misc\SKIL Purchase Supplier Invoices\Truth_Data_Sources")
    os.makedirs(truth_folder, exist_ok=True)
    output_json_path = os.path.join(truth_folder, "invoice.json")

    invoices_list = []

    for fname in sorted(os.listdir(pdf_folder)):
        if not fname.lower().endswith(".pdf"):
            continue
        fpath = os.path.join(pdf_folder, fname)
        doc = fitz.open(fpath)

        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"

        if "XPANIA FOOTCARE" in full_text or fname.startswith("XPL"):
            entry = parse_xpania_invoice(doc, fname)
        else:
            entry = parse_ajanta_invoice(full_text, fname)

        doc.close()
        invoices_list.append(entry)

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(invoices_list, f, indent=2)

    # Also save copy in misc invoice folder
    misc_folder = r"C:\Projects\SKIL Master\misc\SKIL Purchase Supplier Invoices\Invoices - Aug 2026 (Updated 31-08-2026)"
    if os.path.exists(misc_folder):
        with open(os.path.join(misc_folder, "invoice.json"), "w", encoding="utf-8") as f:
            json.dump(invoices_list, f, indent=2)

    total_items = sum(len(x["data"]["bill data"]) for x in invoices_list)
    total_pairs = sum(x["data"]["total"]["Pair"] for x in invoices_list)
    total_amount = sum(x["data"]["grand total"] for x in invoices_list)

    print(f"Extracted {len(invoices_list)} invoices ({len([x for x in invoices_list if x.get('supplier', '').startswith('Ajanta')])} Ajanta, {len([x for x in invoices_list if 'Xpania' in x.get('supplier', '')])} Xpania)")
    print(f"Total line items: {total_items}, Total Pairs: {total_pairs}, Total Amount: Rs {total_amount:,.2f}")
    print(f"Saved to: {output_json_path}")

if __name__ == "__main__":
    main()
