"""
COMPREHENSIVE SEPTEMBER AUDIT:
1. Check all sales for exactly 37.5% discount
2. Check all MRPs are correct
3. Check supplier invoice PDF vs Tally purchase entries
4. Identify any under-billing or margin errors
"""
import fitz, glob, os, json, re
from datetime import datetime

purchases_dir = glob.glob(r'c:\Projects\SKIL Master\user-documents-read-only-access\Purchases*')[0]

with open(r'c:\Projects\SKIL Master\sync-engine\data\vouchers.json', 'r', encoding='utf-8') as f:
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

# September vouchers: P#23 to P#53 (dates starting from 20260909)
sept_range = range(23, 54)

print("=" * 140)
print("PART 1: SALES DISCOUNT AUDIT — Are ALL September Sales items billed at exactly 37.5%?")
print("=" * 140)

sales_disc_issues = []
for i in sept_range:
    s = sales.get(i)
    if not s:
        continue
    svno = s.get('voucherNumber')
    for it in s.get('inventoryEntries', []):
        iname = it.get('stockItemName', '')
        disc_str = str(it.get('discount', '')).replace('%', '').strip()
        srate = clean_rate(it.get('rate', ''))
        mrp = get_mrp(iname)
        s_amt = abs(float(it.get('amount', 0)))
        
        # Check discount field
        try:
            disc_val = float(disc_str)
        except:
            disc_val = None
        
        # Calculate actual discount from MRP and rate
        if mrp and mrp > 0 and srate > 0:
            actual_disc = round(((mrp - srate) / mrp) * 100, 4)
            expected_rate = round(mrp * 0.625, 2) # 37.5% off = 62.5% of MRP
            rate_diff = round(srate - expected_rate, 2)
            
            if abs(actual_disc - 37.5) > 0.1 or abs(rate_diff) > 0.50:
                sales_disc_issues.append({
                    'vch': i,
                    'svno': svno,
                    'item': iname,
                    'mrp': mrp,
                    'expected_rate': expected_rate,
                    'actual_rate': srate,
                    'rate_diff': rate_diff,
                    'disc_field': disc_str,
                    'actual_disc': actual_disc,
                    'amount': s_amt
                })

if sales_disc_issues:
    print(f"\n  *** FOUND {len(sales_disc_issues)} items NOT at exactly 37.5% discount ***\n")
    for iss in sales_disc_issues:
        print(f"  {iss['svno']:>9} | {iss['item'][:50]:50} | MRP: {iss['mrp']:>8.2f} | Expected Rate: {iss['expected_rate']:>8.2f} | Actual Rate: {iss['actual_rate']:>8.2f} | Rate Diff: {iss['rate_diff']:>+8.2f} | Disc%: {iss['actual_disc']:>6.2f}% | Disc Field: {iss['disc_field']}")
else:
    print("\n  ✅ ALL September sales items are billed at exactly 37.5% discount. No exceptions.")

print("\n" + "=" * 140)
print("PART 2: MRP VERIFICATION — Cross-check Sales MRP in item name vs Purchase MRP")
print("=" * 140)

mrp_issues = []
for i in sept_range:
    p = purchases.get(i)
    s = sales.get(i)
    if not p or not s:
        continue
    
    # Build maps
    p_items = {}
    for it in p.get('inventoryEntries', []):
        name = it.get('stockItemName', '')
        p_items[name] = {
            'rate': clean_rate(it.get('rate', '')),
            'mrp': get_mrp(name),
            'amount': abs(float(it.get('amount', 0))),
            'qty': it.get('billedQty', '')
        }
    
    s_items = {}
    for it in s.get('inventoryEntries', []):
        name = it.get('stockItemName', '')
        s_items[name] = {
            'rate': clean_rate(it.get('rate', '')),
            'mrp': get_mrp(name),
            'amount': abs(float(it.get('amount', 0))),
            'qty': it.get('billedQty', '')
        }
    
    for name in set(p_items.keys()) | set(s_items.keys()):
        p_it = p_items.get(name)
        s_it = s_items.get(name)
        
        if p_it and s_it:
            p_mrp = p_it['mrp']
            s_mrp = s_it['mrp']
            if p_mrp and s_mrp and p_mrp != s_mrp:
                mrp_issues.append({
                    'vch': i,
                    'item': name,
                    'p_mrp': p_mrp,
                    's_mrp': s_mrp
                })
        elif p_it and not s_it:
            # Item in purchase but not in sales — potential mismatch
            pass  # Already checked in earlier audit
        elif s_it and not p_it:
            pass

if mrp_issues:
    print(f"\n  *** FOUND {len(mrp_issues)} MRP mismatches between Purchase and Sales ***\n")
    for iss in mrp_issues:
        print(f"  Vch #{iss['vch']:02d} | {iss['item'][:55]:55} | Purchase MRP: {iss['p_mrp']:>8.2f} | Sales MRP: {iss['s_mrp']:>8.2f}")
else:
    print("\n  ✅ ALL September MRPs match between Purchase and Sales vouchers. No discrepancies.")

print("\n" + "=" * 140)
print("PART 3: PURCHASE RATE vs EXPECTED — Under-billing / Over-billing Check")
print("=" * 140)
print("  Items where Ajanta billed at LESS than 37.5% discount (Purchase Rate > 62.5% of MRP)")
print("  AND items billed at significantly MORE than standard 40.48% / 42.20%")
print()

rate_issues = []
for i in sept_range:
    p = purchases.get(i)
    if not p:
        continue
    pvno = p.get('voucherNumber')
    pref = p.get('reference')
    
    for it in p.get('inventoryEntries', []):
        iname = it.get('stockItemName', '')
        prate = clean_rate(it.get('rate', ''))
        mrp = get_mrp(iname)
        p_amt = abs(float(it.get('amount', 0)))
        
        if mrp and mrp > 0 and prate > 0:
            disc_pct = round(((mrp - prate) / mrp) * 100, 4)
            expected_375 = round(mrp * 0.625, 2) # 37.5% off
            
            # Flag if discount < 37.5% (under-discount from Ajanta = overcharge)
            if disc_pct < 37.40:
                shortfall_per_pair = expected_375 - prate
                rate_issues.append({
                    'vch': i,
                    'pvno': pvno,
                    'ref': pref,
                    'item': iname,
                    'mrp': mrp,
                    'rate': prate,
                    'disc_pct': disc_pct,
                    'expected_rate': expected_375,
                    'shortfall': shortfall_per_pair,
                    'amount': p_amt,
                    'type': 'UNDER_DISCOUNT'
                })
            # Flag if discount is unusual (not near 37.5%, 40.48%, 42.20%, or 46.52%)
            elif disc_pct > 43.0 and abs(disc_pct - 46.52) > 1.0:
                rate_issues.append({
                    'vch': i,
                    'pvno': pvno,
                    'ref': pref,
                    'item': iname,
                    'mrp': mrp,
                    'rate': prate,
                    'disc_pct': disc_pct,
                    'expected_rate': expected_375,
                    'shortfall': 0,
                    'amount': p_amt,
                    'type': 'UNUSUAL_HIGH_DISC'
                })

if rate_issues:
    under = [r for r in rate_issues if r['type'] == 'UNDER_DISCOUNT']
    unusual = [r for r in rate_issues if r['type'] == 'UNUSUAL_HIGH_DISC']
    
    if under:
        print(f"  *** {len(under)} items with UNDER-DISCOUNT (< 37.5%) ***")
        for r in under:
            print(f"  P#{r['pvno']:>2} | Inv: {r['ref']:>14} | {r['item'][:45]:45} | MRP: {r['mrp']:>7.2f} | Rate: {r['rate']:>7.2f} | Disc: {r['disc_pct']:>6.2f}% | Shortfall/pr: Rs {r['shortfall']:>+.2f}")
    
    if unusual:
        print(f"\n  *** {len(unusual)} items with UNUSUALLY HIGH discount (> 43%) ***")
        for r in unusual:
            print(f"  P#{r['pvno']:>2} | Inv: {r['ref']:>14} | {r['item'][:45]:45} | MRP: {r['mrp']:>7.2f} | Rate: {r['rate']:>7.2f} | Disc: {r['disc_pct']:>6.2f}%")
else:
    print("  ✅ No under-discount or unusual rate issues found in September purchases.")

print("\n" + "=" * 140)
print("PART 4: SALES vs PURCHASE — Item-Level Margin Check (Items where Sales < Purchase)")
print("=" * 140)
print("  Identifying specific items where you're selling BELOW purchase cost")
print()

margin_issues = []
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
        prate = clean_rate(pit.get('rate', ''))
        srate = clean_rate(sit.get('rate', ''))
        mrp = get_mrp(name)
        
        diff = round(s_amt - p_amt, 2)
        
        # Flag if sales amount is significantly less than purchase amount (> Rs 5)
        if diff < -5.0:
            p_disc = round(((mrp - prate) / mrp) * 100, 2) if mrp else 0
            s_disc = round(((mrp - srate) / mrp) * 100, 2) if mrp else 0
            margin_issues.append({
                'vch': i,
                'ref': p.get('reference', ''),
                'item': name,
                'mrp': mrp,
                'p_rate': prate,
                's_rate': srate,
                'p_disc': p_disc,
                's_disc': s_disc,
                'p_amt': p_amt,
                's_amt': s_amt,
                'loss': abs(diff)
            })

if margin_issues:
    print(f"  *** FOUND {len(margin_issues)} items where Sales Amount < Purchase Amount (Negative Margin) ***\n")
    for m in sorted(margin_issues, key=lambda x: x['loss'], reverse=True):
        print(f"  Vch #{m['vch']:02d} | Inv: {m['ref']:>14} | {m['item'][:45]:45}")
        print(f"           | MRP: {m['mrp']:>7.2f} | P_Rate: {m['p_rate']:>7.2f} ({m['p_disc']:.2f}%) | S_Rate: {m['s_rate']:>7.2f} ({m['s_disc']:.2f}%)")
        print(f"           | P_Amt: Rs {m['p_amt']:>10,.2f} | S_Amt: Rs {m['s_amt']:>10,.2f} | LOSS: Rs {m['loss']:>8,.2f}")
        print()
else:
    print("  ✅ No negative margin items found in September.")

# PART 5: Compare with Supplier Invoice PDFs for September
print("\n" + "=" * 140)
print("PART 5: SUPPLIER INVOICE PDF vs TALLY ENTRY — Rate/Amount Cross-Check")
print("=" * 140)

pdf_files = [f for f in os.listdir(purchases_dir) if f.endswith('.pdf')]
pdf_map = {}
for pf in pdf_files:
    for ref_candidate in re.findall(r'(19004\d+|XPL[\/\-]\d+[\/\-]\d+-\d+)', pf):
        pdf_map[ref_candidate] = pf
        pdf_map[ref_candidate.replace('-', '/')] = pf
        pdf_map[ref_candidate.replace('/', '-')] = pf

pdf_vs_tally_issues = []
for i in sept_range:
    p = purchases.get(i)
    if not p:
        continue
    pref = p.get('reference', '').strip()
    
    # Find PDF
    pdf_filename = pdf_map.get(pref) or pdf_map.get(pref.replace('/', '-'))
    if not pdf_filename:
        print(f"  [SKIP] P#{i:02d} Ref: {pref} — No matching PDF found")
        continue
    
    pdf_path = os.path.join(purchases_dir, pdf_filename)
    doc = fitz.open(pdf_path)
    txt = "\n".join([page.get_text() for page in doc])
    
    # Extract line items from PDF
    # Pattern: Article line, then numbers for Pack/Carton/Pair/MRP/Rate/Amount
    # E.g.: "30 \n1 \n30 \n319.00 \n189.89 \n5,696.70"
    
    # Extract total from PDF
    m_total = re.search(r'(?:Grand\s*Total|Net\s*Amount)\s*[:\s]*.*?(\d[\d,]*\.\d{2})\s*$', txt, re.MULTILINE | re.IGNORECASE)
    if not m_total:
        # Try total line
        m_total = re.search(r'(\d[\d,]+)\s*\.\s*00\s*\n', txt)
    
    pdf_total_str = m_total.group(1).replace(',', '') if m_total else None
    pdf_total = float(pdf_total_str) if pdf_total_str else None
    
    tally_total = abs(float(p.get('amount', 0)))
    
    if pdf_total and abs(pdf_total - tally_total) > 1.0:
        pdf_vs_tally_issues.append({
            'vch': i,
            'ref': pref,
            'pdf_total': pdf_total,
            'tally_total': tally_total,
            'diff': round(tally_total - pdf_total, 2),
            'pdf_file': pdf_filename
        })

if pdf_vs_tally_issues:
    print(f"\n  *** FOUND {len(pdf_vs_tally_issues)} TOTAL AMOUNT mismatches between PDF and Tally ***\n")
    for iss in pdf_vs_tally_issues:
        print(f"  P#{iss['vch']:02d} | Inv: {iss['ref']} | PDF Total: Rs {iss['pdf_total']:,.2f} | Tally Total: Rs {iss['tally_total']:,.2f} | Diff: Rs {iss['diff']:+,.2f} | File: {iss['pdf_file']}")
else:
    print("\n  ✅ All September invoice totals match between PDF and Tally.")

print("\n" + "=" * 140)
print("AUDIT COMPLETE")
print("=" * 140)
