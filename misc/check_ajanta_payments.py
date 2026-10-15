import json

with open('sync-engine/data/vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

payments = [x for x in v.values() if x.get('voucherType') == 'Payment']
payments.sort(key=lambda x: int(str(x.get('voucherNumber')).replace('SKIL-', '')))

print("TALLY PAYMENTS TO AJANTA:")
for p in payments:
    has_ajanta = False
    for le in p.get('ledgerEntries', []):
        if 'Ajanta' in le.get('ledgerName', ''):
            has_ajanta = True
    
    if has_ajanta:
        print(f"Payment #{p.get('voucherNumber')} | Date: {p.get('date')} | Amt: {p.get('amount')}")
