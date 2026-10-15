import json, re

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

sept_range = range(23, 54)

print("=" * 130)
print("AUDIT 1: ALL Sales items - Is Rate = MRP * 20/21 (4.76% off MRP) consistently?")
print("=" * 130)

sales_rate_errors = []
total_sales_items = 0
for i in sept_range:
    s = sales.get(i)
    if not s:
        continue
    svno = s.get('voucherNumber')
    for it in s.get('inventoryEntries', []):
        iname = it.get('stockItemName', '')
        srate = clean_rate(it.get('rate', ''))
        mrp = get_mrp(iname)
        
        if mrp and mrp > 0 and srate > 0:
            total_sales_items += 1
            expected_rate = round(mrp * 20 / 21, 2)
            if abs(srate - expected_rate) > 0.02:
                sales_rate_errors.append({
                    'svno': svno,
                    'item': iname,
                    'mrp': mrp,
                    'expected_rate': expected_rate,
                    'actual_rate': srate,
                    'diff': round(srate - expected_rate, 2)
                })

print(f"  Total September Sales items checked: {total_sales_items}")
if sales_rate_errors:
    print(f"  FOUND {len(sales_rate_errors)} items where Sales Rate != MRP*20/21:\n")
    for e in sales_rate_errors:
        svno = e['svno']
        item = e['item'][:50]
        mrp = e['mrp']
        exp = e['expected_rate']
        act = e['actual_rate']
        diff = e['diff']
        print(f"  {svno:>9} | {item:50} | MRP: {mrp:>7.2f} | Expected: {exp:>7.2f} | Actual: {act:>7.2f} | Diff: {diff:>+.2f}")
else:
    print("  [OK] ALL September sales items follow MRP*20/21 formula perfectly.")

print("\n" + "=" * 130)
print("AUDIT 2: NEGATIVE MARGIN items (Sales Amt < Purchase Amt by > Rs 5)")
print("  These are items where you're LOSING money compared to purchase cost")
print("=" * 130)

neg_margin = []
for i in sept_range:
    p = purchases.get(i)
    s = sales.get(i)
    if not p or not s:
        continue
    p_items = {it.get('stockItemName'): it for it in p.get('inventoryEntries', [])}
    s_items = {it.get('stockItemName'): it for it in s.get('inventoryEntries', [])}
    for name in set(p_items.keys()) & set(s_items.keys()):
        pit = p_items[name]
        sit = s_items[name]
        p_amt = abs(float(pit.get('amount', 0)))
        s_amt = abs(float(sit.get('amount', 0)))
        diff = round(s_amt - p_amt, 2)
        if diff < -5.0:
            prate = clean_rate(pit.get('rate', ''))
            srate = clean_rate(sit.get('rate', ''))
            mrp = get_mrp(name)
            p_disc = round(((mrp - prate) / mrp) * 100, 2) if mrp else 0
            neg_margin.append({
                'vch': i,
                'ref': p.get('reference', ''),
                'item': name,
                'mrp': mrp,
                'p_rate': prate,
                's_rate': srate,
                'p_disc': p_disc,
                'p_amt': p_amt,
                's_amt': s_amt,
                'loss': abs(diff)
            })

neg_margin.sort(key=lambda x: x['loss'], reverse=True)
if neg_margin:
    print(f"\n  FOUND {len(neg_margin)} items with NEGATIVE MARGIN:\n")
    for m in neg_margin:
        vch = m['vch']
        ref = m['ref']
        item = m['item'][:48]
        mrp = m['mrp']
        pr = m['p_rate']
        sr = m['s_rate']
        pd = m['p_disc']
        pa = m['p_amt']
        sa = m['s_amt']
        loss = m['loss']
        
        print(f"  Vch #{vch:02d} | Inv: {ref:>14} | {item:48}")
        print(f"           | MRP: {mrp:>7.2f} | PurchRate: {pr:>7.2f} ({pd:.2f}%) | SalesRate: {sr:>7.2f}")
        print(f"           | PurchAmt: Rs {pa:>10,.2f} | SalesAmt: Rs {sa:>10,.2f} | LOSS: Rs {loss:>8.2f}")
        
        if pd < 40.0:
            print(f"           >>> ROOT CAUSE: Ajanta billed at {pd:.2f}% disc (below 40.48% standard)")
            print(f"           >>> MRP*20/21 = {round(mrp*20/21, 2):.2f} < PurchRate {pr:.2f} = UNDER-BILLING")
        elif pd >= 40.0 and pd <= 40.50:
            print(f"           >>> ROOT CAUSE: Decimal rounding on bulk cartons (40.47% vs 4.76%)")
        print()
else:
    print("  [OK] No negative margin items found in September.")

print("\n" + "=" * 130)
print("AUDIT 3: Purchase discount distribution in September")
print("  Checking what discounts Ajanta is giving")
print("=" * 130)

disc_buckets = {}
for i in sept_range:
    p = purchases.get(i)
    if not p:
        continue
    for it in p.get('inventoryEntries', []):
        iname = it.get('stockItemName', '')
        prate = clean_rate(it.get('rate', ''))
        mrp = get_mrp(iname)
        if mrp and mrp > 0 and prate > 0:
            disc = round(((mrp - prate) / mrp) * 100, 2)
            bucket = round(disc, 0)
            if bucket not in disc_buckets:
                disc_buckets[bucket] = []
            disc_buckets[bucket].append({
                'vch': i,
                'item': iname,
                'mrp': mrp,
                'rate': prate,
                'disc': disc
            })

print()
for bucket in sorted(disc_buckets.keys()):
    items = disc_buckets[bucket]
    print(f"  {bucket:>5.0f}% discount: {len(items):>3} items")

# Flag items < 37.5%
under_disc = [item for items in disc_buckets.values() for item in items if item['disc'] < 37.40]
if under_disc:
    print(f"\n  *** {len(under_disc)} items with discount BELOW 37.5% ***")
    for u in under_disc:
        vch = u['vch']
        item = u['item'][:45]
        mrp = u['mrp']
        rate = u['rate']
        disc = u['disc']
        print(f"  P#{vch:02d} | {item:45} | MRP: {mrp:>7.2f} | Rate: {rate:>7.2f} | Disc: {disc:.2f}%")
else:
    print("\n  [OK] No September items below 37.5% discount from Ajanta.")
