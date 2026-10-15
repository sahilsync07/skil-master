import json

with open('sync-engine/data/vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

for x in v.values():
    if x.get('voucherType') in ['Debit Note', 'Credit Note']:
        vt = x.get('voucherType')
        vn = x.get('voucherNumber')
        vd = x.get('date')
        vp = x.get('partyName')
        va = x.get('amount')
        vr = x.get('reference')
        vnarr = x.get('narration')
        print(f"\n{vt} #{vn} | Date: {vd} | Party: {vp} | Amt: Rs {va:,.2f} | Ref: {vr}")
        print(f"  Narration: {vnarr}")
        for le in x.get('ledgerEntries', []):
            lname = le.get('ledgerName')
            lamt = le.get('amount')
            print(f"  Ledger: {lname} | Amt: Rs {lamt:,.2f}")
            for b in le.get('billAllocations', []):
                print(f"     -> Bill: {b.get('billType')} {b.get('name')} | Amt: Rs {b.get('amount'):,.2f}")
