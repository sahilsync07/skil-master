import json

with open(r"C:\Projects\SKIL Master\misc\SKIL Purchase Supplier Invoices\Truth_Data_Sources\invoice.json", "r", encoding="utf-8") as f:
    invoices = json.load(f)

print("=" * 70)
print("1. CHECKING INVOICES 1900405893 AND 1900402693:")
print("=" * 70)

target_items = []
all_august_under_margin = []

for inv in invoices:
    inv_no = inv["invoice no"]
    inv_date = inv["date"]
    ship_to = inv["ship to"]["name"]
    is_august = "08.2026" in inv_date or "Aug" in inv_date

    for item in inv["data"]["bill data"]:
        mrp = item["MRP"]
        rate = item["Rate"]
        pair = item["Pair"]
        landed = round(rate * 1.05, 2)
        disc = round(((mrp - landed) / mrp) * 100, 2) if mrp > 0 else 0

        # Check if under 37.5%
        if disc < 37.45 and "ajanta" in inv.get("supplier", "").lower():
            exp_landed = round(mrp * 0.625, 2)
            loss_pair = round(landed - exp_landed, 2)
            tot_loss = round(loss_pair * pair, 2)
            entry = {
                "inv_no": inv_no,
                "date": inv_date,
                "desc": item["Description"],
                "mrp": mrp,
                "rate": rate,
                "landed": landed,
                "disc": disc,
                "pair": pair,
                "loss": tot_loss
            }
            if is_august:
                all_august_under_margin.append(entry)
            if inv_no in ["1900405893", "1900402693"]:
                target_items.append(entry)

print("Items in Invoices 1900405893 & 1900402693 with under-margin:")
for it in target_items:
    print(f"  Inv #{it['inv_no']} ({it['date']}): {it['desc']} | MRP: {it['mrp']} | Rate: {it['rate']} | Landed: {it['landed']} | Disc: {it['disc']}% | Pairs: {it['pair']} | Loss: Rs {it['loss']:,.2f}")

target_loss_sum = sum(it["loss"] for it in target_items)
print(f"\nSum of Loss on 1900405893 & 1900402693: Rs {target_loss_sum:,.2f}")

print("\n" + "=" * 70)
print("2. ALL AUGUST UNDER-MARGIN ITEMS (AJANTA):")
print("=" * 70)
for it in all_august_under_margin:
    print(f"  Inv #{it['inv_no']} ({it['date']}): {it['desc']} | MRP: {it['mrp']} | Rate: {it['rate']} | Disc: {it['disc']}% | Pairs: {it['pair']} | Loss: Rs {it['loss']:,.2f}")

total_august_loss = sum(it["loss"] for it in all_august_under_margin)
print(f"\nTOTAL CALCULATED UNDER-MARGIN LOSS FOR AUGUST: Rs {total_august_loss:,.2f}")
print("AJANTA CREDIT NOTE #160005127 ISSUED AMOUNT: Rs 2,773.95")
print(f"DIFFERENCE (CN Amount - Calculated Loss): Rs {2773.95 - total_august_loss:,.2f}")

# Let's also check without rounding intermediate values
exact_august_loss = 0.0
for inv in invoices:
    inv_date = inv["date"]
    if ("08.2026" in inv_date or "Aug" in inv_date) and "ajanta" in inv.get("supplier", "").lower():
        for item in inv["data"]["bill data"]:
            mrp = float(item["MRP"])
            rate = float(item["Rate"])
            pair = float(item["Pair"])
            landed = rate * 1.05
            disc = ((mrp - landed) / mrp) * 100 if mrp > 0 else 0
            if disc < 37.45:
                exp_landed = mrp * 0.625
                loss = (landed - exp_landed) * pair
                exact_august_loss += loss

print(f"EXACT (unrounded) UNDER-MARGIN LOSS FOR AUGUST: Rs {exact_august_loss:,.2f}")
print(f"DIFFERENCE with CN #160005127 (Rs 2,773.95): Rs {2773.95 - exact_august_loss:,.2f}")
