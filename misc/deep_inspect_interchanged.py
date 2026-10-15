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

# Focus on P#15/16 and P#19 — check invoice number cross-match with items
print("="*100)
print("DEEP INSPECTION: Vouchers #15, #16, #19")
print("="*100)

for i in [15, 16, 19]:
    p = purchases.get(i)
    s = sales.get(i)
    print(f"\n--- Voucher #{i} ---")
    print(f"  Purchase #{i}: Ref={p.get('reference')} | Date={p.get('date')} | Amt=Rs {abs(float(p.get('amount',0))):,.2f} | Narr='{p.get('narration')}'")
    print(f"  Sales SKIL-{i:03d}: Ref={s.get('reference')} | Date={s.get('date')} | Amt=Rs {abs(float(s.get('amount',0))):,.2f} | Narr='{s.get('narration')}'")
    
    # Compare items
    p_items = {it.get('stockItemName'): it for it in p.get('inventoryEntries', [])}
    s_items = {it.get('stockItemName'): it for it in s.get('inventoryEntries', [])}
    
    p_only = set(p_items.keys()) - set(s_items.keys())
    s_only = set(s_items.keys()) - set(p_items.keys())
    common = set(p_items.keys()) & set(s_items.keys())
    
    print(f"  Products: Common={len(common)} | Only in Purchase={len(p_only)} | Only in Sales={len(s_only)}")
    if p_only:
        for name in sorted(p_only):
            amt = abs(float(p_items[name].get('amount', 0)))
            print(f"    [PURCHASE ONLY] {name} -> Rs {amt:,.2f}")
    if s_only:
        for name in sorted(s_only):
            amt = abs(float(s_items[name].get('amount', 0)))
            print(f"    [SALES ONLY] {name} -> Rs {amt:,.2f}")

# Now check: does SKIL-016 items match Purchase #15 or #16?
print("\n" + "="*100)
print("CROSS-MATCH TEST: Does SKIL-016 actually match P#15 or P#16?")
print("="*100)

s16_items = set(it.get('stockItemName') for it in sales[16].get('inventoryEntries', []))
p15_items = set(it.get('stockItemName') for it in purchases[15].get('inventoryEntries', []))
p16_items = set(it.get('stockItemName') for it in purchases[16].get('inventoryEntries', []))

s16_p15_common = s16_items & p15_items
s16_p16_common = s16_items & p16_items

print(f"  SKIL-016 items: {len(s16_items)}")
print(f"  P#15 items: {len(p15_items)}")
print(f"  P#16 items: {len(p16_items)}")
print(f"  SKIL-016 vs P#15 common items: {len(s16_p15_common)} / {len(s16_items)}")
print(f"  SKIL-016 vs P#16 common items: {len(s16_p16_common)} / {len(s16_items)}")

# Same for SKIL-015
s15_items = set(it.get('stockItemName') for it in sales[15].get('inventoryEntries', []))
s15_p15_common = s15_items & p15_items
s15_p16_common = s15_items & p16_items

print(f"\n  SKIL-015 items: {len(s15_items)}")
print(f"  SKIL-015 vs P#15 common items: {len(s15_p15_common)} / {len(s15_items)}")
print(f"  SKIL-015 vs P#16 common items: {len(s15_p16_common)} / {len(s15_items)}")

# Check P#19 vs S#19 carton mismatch
print("\n" + "="*100)
print("P#19 CARTON INVESTIGATION: Purchase narr says 8CTN, Sales narr says 11CTN")
print("="*100)
p19 = purchases[19]
s19 = sales[19]
p19_items = p19.get('inventoryEntries', [])
s19_items = s19.get('inventoryEntries', [])
print(f"  P#19 items count: {len(p19_items)}")
print(f"  S#19 items count: {len(s19_items)}")
print(f"  P#19 ref: {p19.get('reference')} | P#19 narr: '{p19.get('narration')}'")
print(f"  S#19 ref: {s19.get('reference')} | S#19 narr: '{s19.get('narration')}'")

# Actual cartons from PDF was 11. So purchase narration "sf 8ctn" is wrong.
# Check what the actual carton count is in the invoice PDF (already confirmed = 11)
print(f"  PDF actual cartons for invoice 1900405893: 11")
print(f"  VERDICT: Purchase narration says 8 but actual is 11. Sales narration (11CTN) is correct.")
