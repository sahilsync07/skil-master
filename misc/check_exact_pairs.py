import json

with open('sync-engine/data/vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

purchases = {int(x['voucherNumber']): x for x in v.values() if x.get('voucherType') == 'Purchase' and str(x.get('voucherNumber')).isdigit()}
sales = {}
for x in v.values():
    if x.get('voucherType') == 'Sales':
        vn = str(x.get('voucherNumber')).replace('SKIL-', '')
        if vn.isdigit():
            sales[int(vn)] = x

print(f"Total Purchases: {len(purchases)}, Total Sales: {len(sales)}")
print("=" * 115)
print(f"{'Idx':3} | {'P_Ref':10} | {'S_Ref':10} | {'RefOK':5} | {'Purch Amt':12} | {'Sales Amt':12} | {'Diff (S-P)':11} | {'Customer'}")
print("=" * 115)

exact = []
marginal = []
non_marginal = []

for i in range(1, 54):
    p = purchases.get(i)
    s = sales.get(i)
    if not p or not s:
        print(f"Missing pair for index {i}: p={p is not None}, s={s is not None}")
        continue
    pa = float(p.get('amount', 0))
    sa = float(s.get('amount', 0))
    pref = str(p.get('reference', '')).strip()
    sref = str(s.get('reference', '')).strip()
    diff = round(sa - pa, 2)
    ref_match = (pref == sref)
    cust = s.get('partyName', '')
    
    row = {
        'idx': i,
        'pref': pref,
        'sref': sref,
        'ref_match': ref_match,
        'pa': pa,
        'sa': sa,
        'diff': diff,
        'cust': cust,
        'p': p,
        's': s
    }
    
    if abs(diff) <= 1.0:
        exact.append(row)
    elif abs(diff) <= 20.0:
        marginal.append(row)
    else:
        non_marginal.append(row)
        
    print(f"{i:02d}  | {pref:10} | {sref:10} | {str(ref_match):5} | {pa:12,.2f} | {sa:12,.2f} | {diff:+11,.2f} | {cust}")

print("\n" + "=" * 80)
print(f"SUMMARY: Exact: {len(exact)} | Marginal (<= 20): {len(marginal)} | Non-Marginal (> 20): {len(non_marginal)}")
print("=" * 80)
