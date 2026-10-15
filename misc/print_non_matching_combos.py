import json

with open("misc/audit_purchase_sales_deviation.json", "r", encoding="utf-8") as f:
    d = json.load(f)

combos = d["combinations"]["not_matching"]

print(f"Total Non-Matching Combos: {len(combos)}")
print(f"{'PVch#':5} | {'SVch#':10} | {'Ref/Inv':14} | {'Purch Amt':12} | {'Sales Amt':12} | {'Diff (S-P)':12} | {'Customer':30} | {'# Diff Items':12}")
print("-" * 115)

for c in combos:
    pv = c["purchase_vno"]
    sv = c["sales_vno"]
    ref = c["reference"]
    pa = f"Rs {c['purchase_amount']:,.2f}"
    sa = f"Rs {c['sales_amount']:,.2f}"
    diff = f"Rs {c['diff_amount']:,.2f}"
    cust = c["customer"][:28]
    p_cnt = c["product_diffs_count"]
    print(f"{pv:5} | {sv:10} | {ref:14} | {pa:12} | {sa:12} | {diff:12} | {cust:30} | {p_cnt:12}")

print("\n" + "="*80)
print("PRODUCT LEVEL BREAKDOWN FOR NON-MATCHING COMBINATIONS:")
print("="*80)

for c in combos:
    pv = c["purchase_vno"]
    sv = c["sales_vno"]
    ref = c["reference"]
    diff = c["diff_amount"]
    cust = c["customer"]
    pdiffs = c["product_diffs"]
    
    print(f"\n>>> Combination: Purchase #{pv} vs Sales #{sv} (Ref: {ref}) | Diff: Rs {diff:+,.2f} | Customer: {cust}")
    if not pdiffs:
        print("    [!] Products rates match exactly! Difference is due to GST / Round-Off calculation variance.")
    else:
        for p in pdiffs:
            pname = p.get("product")
            if "status" in p:
                print(f"    - Product: {pname} -> Status: {p['status']}")
            else:
                pr = p.get("purchase_rate")
                sr = p.get("sales_rate")
                rd = p.get("rate_diff")
                pa = p.get("purchase_amount")
                sa = p.get("sales_amount")
                ad = p.get("amount_diff")
                pd = p.get("purchase_disc")
                sd = p.get("sales_disc")
                print(f"    - {pname}")
                print(f"        Purchase Rate: Rs {pr:.2f} ({pd}% disc) | Amount: Rs {pa:,.2f}")
                print(f"        Sales Rate:    Rs {sr:.2f} ({sd}% disc) | Amount: Rs {sa:,.2f}")
                print(f"        Variance:      Rate Diff: Rs {rd:+.2f} | Amount Diff: Rs {ad:+,.2f}")
