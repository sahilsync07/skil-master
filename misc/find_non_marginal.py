import json

with open("misc/audit_purchase_sales_deviation.json", "r", encoding="utf-8") as f:
    d = json.load(f)

combos = d["combinations"]["not_matching"]

print(f"Total non-matching entries: {len(combos)}")

non_marginal = []
marginal = []

for c in combos:
    diff = c["diff_amount"]
    pdiffs = c["product_diffs"]
    
    substantive_items = []
    for p in pdiffs:
        ad = abs(p.get("amount_diff", 0))
        if ad > 5.0 or "status" in p:
            substantive_items.append(p)
            
    if abs(diff) >= 20.0 or len(substantive_items) > 0:
        non_marginal.append((c, substantive_items))
    else:
        marginal.append(c)

print(f"Non-marginal count: {len(non_marginal)}")
print(f"Marginal count: {len(marginal)}\n")

print("="*100)
print("NON-MARGINAL DIFFERENCES (SUBSTANTIAL VARIANCE IN FINAL AMOUNT):")
print("="*100)

for c, items in non_marginal:
    pv = c["purchase_vno"]
    sv = c["sales_vno"]
    ref = c["reference"]
    pa = c["purchase_amount"]
    sa = c["sales_amount"]
    diff = c["diff_amount"]
    cust = c["customer"]
    print(f"\n[Voucher Pair #{str(pv)} / Sales {sv}] | Inv Ref: {ref} | Customer: {cust}")
    print(f"   Purchase: Rs {pa:10,.2f}  -->  Sales: Rs {sa:10,.2f}  | Variance: Rs {diff:+10,.2f}")
    if items:
        print("   Responsible Products:")
        for it in items:
            pname = it.get("product")
            if "status" in it:
                print(f"     - {pname}: Status = {it['status']}")
            else:
                ad = it.get("amount_diff")
                pr = it.get("purchase_rate")
                sr = it.get("sales_rate")
                pd = it.get("purchase_disc")
                sd = it.get("sales_disc")
                print(f"     - {pname}")
                print(f"         Purch Rate: Rs {pr:.2f} ({pd}%) | Sales Rate: Rs {sr:.2f} ({sd}%) | Diff: Rs {ad:+,.2f}")
    else:
        print("   [!] No product rate discrepancy! Variance is due to wholesale trade markup, freight/expenses, or billing structure.")

print("\n" + "="*100)
print("MARGINAL DIFFERENCES (ROUNDING / DECIMAL DIFFERENCES < Rs 20):")
print("="*100)
for c in marginal:
    pv = c["purchase_vno"]
    sv = c["sales_vno"]
    ref = c["reference"]
    pa = c["purchase_amount"]
    sa = c["sales_amount"]
    diff = c["diff_amount"]
    cust = c["customer"]
    print(f"  Vch #{str(pv)} (Sales {sv:8}) | Ref: {ref:10} | Purch: Rs {pa:10,.2f} | Sales: Rs {sa:10,.2f} | Diff: Rs {diff:+6.2f} | Cust: {cust}")
