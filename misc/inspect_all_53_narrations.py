import fitz, glob, os, json, re

with open(r'c:\Projects\SKIL Master\sync-engine\data\vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

purchases = {int(x['voucherNumber']): x for x in v.values() if x.get('voucherType') == 'Purchase' and str(x.get('voucherNumber')).isdigit()}
sales = {}
for x in v.values():
    if x.get('voucherType') == 'Sales':
        vn = str(x.get('voucherNumber')).replace('SKIL-', '')
        if vn.isdigit():
            sales[int(vn)] = x

for i in range(1, 54):
    p = purchases.get(i)
    s = sales.get(i)
    pnarr = p.get('narration', '') if p else ''
    snarr = s.get('narration', '') if s else ''
    pref = p.get('reference', '') if p else ''
    sref = s.get('reference', '') if s else ''
    sparty = s.get('partyName', '') if s else ''
    print(f"#{i:02d} | Ref: {pref:14} | P_Narr: {pnarr:25} | S_Narr: {snarr:25} | Customer: {sparty}")
