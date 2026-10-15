import json, re
from collections import defaultdict

with open(r'c:\Projects\SKIL Master\sync-engine\data\vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

sales = {}
for x in v.values():
    if x.get('voucherType') == 'Sales':
        vn = str(x.get('voucherNumber')).replace('SKIL-', '')
        if vn.isdigit():
            sales[int(vn)] = x

# September sales: SKIL-023 to SKIL-053
sept_range = range(23, 54)

# Group by party
party_invoices = defaultdict(list)

for i in sept_range:
    s = sales.get(i)
    if not s:
        continue
    
    # Get party name
    party = None
    for le in s.get('ledgerEntries', []):
        ln = le.get('ledgerName', '')
        if ln not in ['Output IGST', 'Output CGST', 'Output SGST', 'Sales Account', 'Cash Discount', 'IGST', 'CGST', 'SGST']:
            if 'GST' not in ln.upper() and 'SALES' not in ln.upper() and 'DISCOUNT' not in ln.upper():
                party = ln
                break
    
    if not party:
        # Try partyLedgerName
        party = s.get('partyLedgerName', 'Unknown')
    
    svno = s.get('voucherNumber', '')
    ref = s.get('reference', '')
    date = s.get('date', '')
    amt = abs(float(s.get('amount', 0)))
    narr = s.get('narration', '').strip()
    
    # Format date
    if len(date) == 8:
        d = f"{date[6:8]}-{date[4:6]}-{date[:4]}"
    else:
        d = date
    
    party_invoices[party].append({
        'svno': svno,
        'ref': ref,
        'date': d,
        'amt': amt,
        'narr': narr,
        'idx': i
    })

print("=" * 120)
print("SEPTEMBER 2026 — 5% CREDIT NOTE DETAILS BY PARTY")
print("=" * 120)

for party in sorted(party_invoices.keys()):
    invs = sorted(party_invoices[party], key=lambda x: x['idx'])
    total_sales = sum(inv['amt'] for inv in invs)
    cn_5pct = round(total_sales * 5 / 100, 2)
    
    print(f"\n{'='*120}")
    print(f"PARTY: {party}")
    print(f"{'='*120}")
    print(f"  Total Sales Invoices: {len(invs)}")
    print(f"  Total Sales Value: Rs {total_sales:,.2f}")
    print(f"  5% Credit Note: Rs {cn_5pct:,.2f}")
    print()
    
    # List individual invoices
    inv_refs = []
    for inv in invs:
        print(f"    {inv['svno']:>10} | Ref: {inv['ref']:>14} | Date: {inv['date']} | Amt: Rs {inv['amt']:>10,.2f}")
        inv_refs.append(inv['svno'])
    
    # Generate narration
    print()
    if len(invs) == 1:
        inv = invs[0]
        narration = f"Being 5% Cash Discount on Invoice No. {inv['svno']} dt. {inv['date']} amounting to Rs. {inv['amt']:,.2f}"
    else:
        # Group consecutive invoice numbers
        first = invs[0]['svno']
        last = invs[-1]['svno']
        dates = [inv['date'] for inv in invs]
        first_date = dates[0]
        last_date = dates[-1]
        
        inv_list = ", ".join(inv['svno'] for inv in invs)
        
        # Check if consecutive
        idxs = [inv['idx'] for inv in invs]
        is_consecutive = all(idxs[j] == idxs[j-1] + 1 for j in range(1, len(idxs)))
        
        if is_consecutive:
            narration = f"Being 5% Cash Discount on Invoice No. {first} to {last} dt. {first_date} to {last_date} amounting to Rs. {total_sales:,.2f}"
        else:
            narration = f"Being 5% Cash Discount on Invoice No. {inv_list} dt. {first_date} to {last_date} amounting to Rs. {total_sales:,.2f}"
    
    print(f"  NARRATION:")
    print(f"  {narration}")
    print(f"  Credit Note Amount: Rs {cn_5pct:,.2f}")

# Also compute overall total
all_total = sum(sum(inv['amt'] for inv in invs) for invs in party_invoices.values())
all_cn = round(all_total * 5 / 100, 2)
print(f"\n{'='*120}")
print(f"GRAND TOTAL: Sales Rs {all_total:,.2f} | 5% CN Rs {all_cn:,.2f}")
print(f"{'='*120}")
