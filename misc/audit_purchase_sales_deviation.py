import json
import re

with open('sync-engine/data/vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

purchases = [x for x in v.values() if x.get('voucherType') == 'Purchase']
sales = [x for x in v.values() if x.get('voucherType') == 'Sales']

def sort_p(p):
    vn = str(p.get('voucherNumber', '0'))
    return int(vn) if vn.isdigit() else 999999

def sort_s(s):
    vn = str(s.get('voucherNumber', '0')).replace('SKIL-', '')
    return int(vn) if vn.isdigit() else 999999

purchases.sort(key=sort_p)
sales.sort(key=sort_s)

# Map sales by reference and by voucher number
sales_by_ref = {}
for s in sales:
    ref = s.get('reference', '').strip()
    if ref:
        sales_by_ref[ref] = s
        sales_by_ref[ref.replace('/', '-')] = s
        sales_by_ref[ref.replace('-', '/')] = s

def get_mrp(item_name):
    m = re.search(r'MRP\s*(\d+(\.\d+)?)/-', item_name, re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None

def clean_rate(rate_str):
    if not rate_str:
        return 0.0
    r = rate_str.split('/')[0].strip().replace(',', '')
    try:
        return float(r)
    except:
        return 0.0

# 1. Check deviations from 37.5% in Purchases
purchase_deviation_summary = {
    'under_37_5': [], # Rate difference shortfall (< 37.5%)
    'exact_37_5': [], # Exactly 37.5%
    'over_37_5': []   # Higher margin (> 37.5%)
}

all_purchase_items = []

for p in purchases:
    pvno = p.get('voucherNumber')
    pref = p.get('reference')
    pdate = p.get('date')
    supplier = p.get('partyName')

    for it in p.get('inventoryEntries', []):
        iname = it.get('stockItemName', '')
        mrp = get_mrp(iname)
        prate = clean_rate(it.get('rate', ''))
        b_qty_str = it.get('billedQty', '')
        m_qty = re.search(r'(\d+)\s*Pairs?', b_qty_str)
        p_pairs = int(m_qty.group(1)) if m_qty else 0
        p_amt = abs(float(it.get('amount', 0)))

        if mrp and mrp > 0:
            discount_pct = ((mrp - prate) / mrp) * 100
            diff_from_37_5 = discount_pct - 37.50

            item_info = {
                'vch_no': pvno,
                'ref': pref,
                'date': pdate,
                'supplier': supplier,
                'item_name': iname,
                'mrp': mrp,
                'rate': prate,
                'pairs': p_pairs,
                'amount': p_amt,
                'discount_pct': round(discount_pct, 4),
                'deviation': round(diff_from_37_5, 4)
            }

            all_purchase_items.append(item_info)

            if diff_from_37_5 < -0.05:
                # Under 37.5% discount -> Shortfall
                shortfall_per_pair = (mrp * 0.625) - prate
                total_shortfall = shortfall_per_pair * p_pairs
                item_info['shortfall_per_pair'] = round(shortfall_per_pair, 2)
                item_info['total_shortfall'] = round(total_shortfall, 2)
                purchase_deviation_summary['under_37_5'].append(item_info)
            elif abs(diff_from_37_5) <= 0.05:
                purchase_deviation_summary['exact_37_5'].append(item_info)
            else:
                purchase_deviation_summary['over_37_5'].append(item_info)

# 2. Check Purchase-Sales Combination Matching
combo_results = []
unmatched_combos = []

for p in purchases:
    pvno = p.get('voucherNumber')
    pref = p.get('reference')
    pdate = p.get('date')
    pamt = abs(float(p.get('amount', 0)))
    pnarr = p.get('narration', '')

    # Find matching sales voucher
    s = sales_by_ref.get(pref)
    if not s:
        # try matching by corresponding voucher number
        padded_vno = f"SKIL-{int(pvno):03d}" if pvno.isdigit() else pvno
        s = next((x for x in sales if x.get('voucherNumber') == padded_vno), None)

    if not s:
        unmatched_combos.append({
            'purchase_vno': pvno,
            'ref': pref,
            'purchase_amount': pamt,
            'status': 'NO_MATCHING_SALES_FOUND'
        })
        continue

    svno = s.get('voucherNumber')
    samt = abs(float(s.get('amount', 0)))
    sparty = s.get('partyName')
    sref = s.get('reference')
    snarr = s.get('narration', '')

    diff_amt = samt - pamt
    is_matching = abs(diff_amt) <= 1.0 # 1 rupee rounding allowance

    # Compare items between purchase and sales
    p_inv = {it.get('stockItemName'): it for it in p.get('inventoryEntries', [])}
    s_inv = {it.get('stockItemName'): it for it in s.get('inventoryEntries', [])}

    product_diffs = []

    # Check all purchase items
    all_keys = set(p_inv.keys()) | set(s_inv.keys())
    for k in sorted(all_keys):
        p_it = p_inv.get(k)
        s_it = s_inv.get(k)

        if p_it and s_it:
            pr = clean_rate(p_it.get('rate', ''))
            sr = clean_rate(s_it.get('rate', ''))
            pa = abs(float(p_it.get('amount', 0)))
            sa = abs(float(s_it.get('amount', 0)))

            if abs(pr - sr) > 0.01 or abs(pa - sa) > 0.5:
                mrp = get_mrp(k)
                p_disc = ((mrp - pr) / mrp * 100) if mrp else None
                s_disc = ((mrp - sr) / mrp * 100) if mrp else None
                product_diffs.append({
                    'product': k,
                    'mrp': mrp,
                    'purchase_rate': pr,
                    'sales_rate': sr,
                    'rate_diff': round(sr - pr, 2),
                    'purchase_amount': pa,
                    'sales_amount': sa,
                    'amount_diff': round(sa - pa, 2),
                    'purchase_disc': round(p_disc, 2) if p_disc else None,
                    'sales_disc': round(s_disc, 2) if s_disc else None
                })
        elif p_it and not s_it:
            product_diffs.append({
                'product': k,
                'status': 'ONLY_IN_PURCHASE',
                'purchase_amount': abs(float(p_it.get('amount', 0)))
            })
        elif s_it and not p_it:
            product_diffs.append({
                'product': k,
                'status': 'ONLY_IN_SALES',
                'sales_amount': abs(float(s_it.get('amount', 0)))
            })

    combo_info = {
        'purchase_vno': pvno,
        'sales_vno': svno,
        'reference': pref,
        'purchase_amount': pamt,
        'sales_amount': samt,
        'diff_amount': round(diff_amt, 2),
        'is_matching': is_matching,
        'customer': sparty,
        'product_diffs_count': len(product_diffs),
        'product_diffs': product_diffs
    }

    combo_results.append(combo_info)

with open('misc/audit_purchase_sales_deviation.json', 'w', encoding='utf-8') as f:
    json.dump({
        'purchase_deviation': {
            'total_items': len(all_purchase_items),
            'under_37_5_count': len(purchase_deviation_summary['under_37_5']),
            'exact_37_5_count': len(purchase_deviation_summary['exact_37_5']),
            'over_37_5_count': len(purchase_deviation_summary['over_37_5']),
            'under_37_5_items': purchase_deviation_summary['under_37_5'],
            'over_37_5_sample': purchase_deviation_summary['over_37_5'][:20]
        },
        'combinations': {
            'total': len(combo_results),
            'matching_count': sum(1 for c in combo_results if c['is_matching']),
            'not_matching_count': sum(1 for c in combo_results if not c['is_matching']),
            'not_matching': [c for c in combo_results if not c['is_matching']],
            'matching': [c for c in combo_results if c['is_matching']]
        }
    }, f, indent=2)

print("AUDIT EXECUTION COMPLETE!")
print(f"Total Purchase items analyzed: {len(all_purchase_items)}")
print(f"  Items < 37.5% (Shortfall liable by Ajanta): {len(purchase_deviation_summary['under_37_5'])}")
print(f"  Items == 37.5% (Exact 37.5%): {len(purchase_deviation_summary['exact_37_5'])}")
print(f"  Items > 37.5% (Extra margin retained by SKIL): {len(purchase_deviation_summary['over_37_5'])}")

print(f"\nTotal Purchase-Sales Combos Analyzed: {len(combo_results)}")
print(f"  Combos MATCHING in Final Amount: {sum(1 for c in combo_results if c['is_matching'])}")
print(f"  Combos NOT MATCHING in Final Amount: {sum(1 for c in combo_results if not c['is_matching'])}")
