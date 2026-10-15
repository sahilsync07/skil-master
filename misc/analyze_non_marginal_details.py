import json
import re

with open('sync-engine/data/vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

purchases = {int(x['voucherNumber']): x for x in v.values() if x.get('voucherType') == 'Purchase' and str(x.get('voucherNumber')).isdigit()}
sales = {}
for x in v.values():
    if x.get('voucherType') == 'Sales':
        vn = str(x.get('voucherNumber')).replace('SKIL-', '')
        if vn.isdigit():
            sales[int(vn)] = x

def clean_rate(rate_str):
    if not rate_str:
        return 0.0
    r = rate_str.split('/')[0].strip().replace(',', '')
    try:
        return float(r)
    except:
        return 0.0

def get_mrp(item_name):
    m = re.search(r'MRP\s*(\d+(\.\d+)?)/-', item_name, re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None

non_marginal_list = []

for i in range(1, 54):
    p = purchases.get(i)
    s = sales.get(i)
    if not p or not s:
        continue
    pa = float(p.get('amount', 0))
    sa = float(s.get('amount', 0))
    diff = round(sa - pa, 2)
    
    if abs(diff) > 20.0:
        pref = str(p.get('reference', '')).strip()
        cust = s.get('partyName', '')
        
        # compare products
        p_inv = {it.get('stockItemName'): it for it in p.get('inventoryEntries', [])}
        s_inv = {it.get('stockItemName'): it for it in s.get('inventoryEntries', [])}
        
        diff_items = []
        for iname in sorted(set(p_inv.keys()) | set(s_inv.keys())):
            pit = p_inv.get(iname)
            sit = s_inv.get(iname)
            if pit and sit:
                pr = clean_rate(pit.get('rate', ''))
                sr = clean_rate(sit.get('rate', ''))
                p_amt = abs(float(pit.get('amount', 0)))
                s_amt = abs(float(sit.get('amount', 0)))
                mrp = get_mrp(iname)
                if abs(p_amt - s_amt) > 2.0 or abs(pr - sr) > 0.05:
                    diff_items.append({
                        'item': iname,
                        'mrp': mrp,
                        'purch_rate': pr,
                        'sales_rate': sr,
                        'purch_amt': p_amt,
                        'sales_amt': s_amt,
                        'amt_diff': round(s_amt - p_amt, 2),
                        'rate_diff': round(sr - pr, 2)
                    })
            elif pit and not sit:
                diff_items.append({
                    'item': iname,
                    'status': 'MISSING_IN_SALES',
                    'purch_amt': abs(float(pit.get('amount', 0)))
                })
            elif sit and not pit:
                diff_items.append({
                    'item': iname,
                    'status': 'MISSING_IN_PURCHASE',
                    'sales_amt': abs(float(sit.get('amount', 0)))
                })
                
        non_marginal_list.append({
            'idx': i,
            'vch': f"P#{i:02d} vs S#SKIL-{i:03d}",
            'ref': pref,
            'customer': cust,
            'purch_amt': pa,
            'sales_amt': sa,
            'diff': diff,
            'items': diff_items
        })

print(f"Total Non-Marginal Vouchers Found: {len(non_marginal_list)}")

with open('misc/non_marginal_detailed.json', 'w', encoding='utf-8') as f:
    json.dump(non_marginal_list, f, indent=2)

for item in non_marginal_list:
    print(f"\n[{item['vch']}] | Ref: {item['ref']} | Diff: Rs {item['diff']:+,.2f} | Customer: {item['customer']}")
    for it in item['items']:
        if 'status' in it:
            print(f"  * {it['item']}: {it['status']}")
        else:
            print(f"  * {it['item']} -> Purch: Rs {it['purch_rate']} (Rs {it['purch_amt']:,.2f}) vs Sales: Rs {it['sales_rate']} (Rs {it['sales_amt']:,.2f}) | Diff: Rs {it['amt_diff']:+,.2f}")
