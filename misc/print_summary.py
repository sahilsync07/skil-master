import json

with open('misc/non_marginal_detailed.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total Non-Marginal Vouchers: {len(data)}\n")
for item in data:
    diff = item['diff']
    vch = item['vch']
    ref = item['ref']
    cust = item['customer']
    pa = item['purch_amt']
    sa = item['sales_amt']
    significant_items = [it for it in item['items'] if abs(it.get('amt_diff', 0)) > 5.0 or 'status' in it]
    print(f"{vch:22} | Ref: {ref:10} | Purch: Rs {pa:10,.2f} | Sales: Rs {sa:10,.2f} | Diff: Rs {diff:+10,.2f} | {cust[:30]}")
    for it in significant_items:
        iname = it['item']
        ad = it.get('amt_diff', 0)
        pr = it.get('purch_rate', 0)
        sr = it.get('sales_rate', 0)
        print(f"   -> {iname[:45]}: Diff = Rs {ad:+,.2f} (PRate: Rs {pr} vs SRate: Rs {sr})")
