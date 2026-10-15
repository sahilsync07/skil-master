import json

with open('misc/non_marginal_detailed.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

pos = [x for x in data if x['diff'] > 0]
neg = [x for x in data if x['diff'] < 0]

print(f"Total Non-Marginal Vouchers: {len(data)}")
print(f"Total Positive (Sales > Purch): {len(pos)}")
print(f"Total Negative (Sales < Purch): {len(neg)}\n")

print("="*115)
print("GROUP A: POSITIVE VARIANCE (SALES > PURCHASE — TRADE PROFIT / HIGHER PURCHASE DISCOUNT RETAINED)")
print("="*115)
for x in sorted(pos, key=lambda k: k['diff'], reverse=True):
    vch = x['vch']
    ref = x['ref']
    pa = x['purch_amt']
    sa = x['sales_amt']
    diff = x['diff']
    cust = x['customer']
    print(f"{vch:20} | Ref: {ref:10} | Purch: Rs {pa:10,.2f} | Sales: Rs {sa:10,.2f} | Diff: +Rs {diff:8,.2f} | {cust}")

print("\n" + "="*115)
print("GROUP B: NEGATIVE VARIANCE (SALES < PURCHASE — AJANTA UNDER-DISCOUNT / SHORTFALL CLAIMABLE)")
print("="*115)
for x in sorted(neg, key=lambda k: k['diff']):
    vch = x['vch']
    ref = x['ref']
    pa = x['purch_amt']
    sa = x['sales_amt']
    diff = x['diff']
    cust = x['customer']
    print(f"{vch:20} | Ref: {ref:10} | Purch: Rs {pa:10,.2f} | Sales: Rs {sa:10,.2f} | Diff: -Rs {abs(diff):8,.2f} | {cust}")
