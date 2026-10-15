import fitz, glob, os, json, re

# 1. Load vouchers from sync-engine
with open(r'c:\Projects\SKIL Master\sync-engine\data\vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

print("Voucher types in vouchers.json:")
vtypes = {}
for x in v.values():
    vt = x.get('voucherType')
    vtypes[vt] = vtypes.get(vt, 0) + 1
print(vtypes)

# Inspect Credit Notes & Debit Notes
print("\n--- DEBIT NOTES ---")
for x in v.values():
    if x.get('voucherType') == 'Debit Note':
        print(x.get('voucherNumber'), '| Date:', x.get('date'), '| Party:', x.get('partyName'), '| Amt:', x.get('amount'), '| Narr:', x.get('narration'))

print("\n--- CREDIT NOTES ---")
for x in v.values():
    if x.get('voucherType') == 'Credit Note':
        print(x.get('voucherNumber'), '| Date:', x.get('date'), '| Party:', x.get('partyName'), '| Amt:', x.get('amount'), '| Narr:', x.get('narration'))

# Inspect Purchase Narrations for Carton info
purchases = [x for x in v.values() if x.get('voucherType') == 'Purchase']
def sort_p(p):
    vn = str(p.get('voucherNumber', '0'))
    return int(vn) if vn.isdigit() else 999999
purchases.sort(key=sort_p)

print("\nSample Purchase Narrations (First 10):")
for p in purchases[:10]:
    print(f"P#{p.get('voucherNumber')} | Ref: {p.get('reference')} | Narr: {p.get('narration')}")

