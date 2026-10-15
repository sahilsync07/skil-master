import json

with open('sync-engine/data/vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

groups = {
    'DELIGHT': {'cn_no': '3', 'total_cn': 7436.0, 'vnos': [2]},
    'KGN': {'cn_no': '1', 'total_cn': 5421.0, 'vnos': [4, 5, 6]},
    'SF': {'cn_no': '2', 'total_cn': 26539.0, 'vnos': list(range(11, 21))},
    'SBE': {'cn_no': '4', 'total_cn': 20480.0, 'vnos': [1, 3, 7, 8, 9, 10, 21, 22]}
}

for gname, ginfo in groups.items():
    vnos = ginfo['vnos']
    tot_cn = ginfo['total_cn']
    tot_taxable = 0.0
    for vno in vnos:
        s = next(x for x in v.values() if x.get('voucherType') == 'Sales' and x.get('voucherNumber') == f'SKIL-{vno:03d}')
        s_tax = sum([abs(float(it.get('amount', 0))) for it in s.get('inventoryEntries', [])])
        tot_taxable += s_tax
    print(f"{gname}: Target CN = Rs {tot_cn:,.2f} | Sum Taxable = Rs {tot_taxable:,.2f} | 5% = Rs {tot_taxable*0.05:,.2f}")
