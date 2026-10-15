import json, re
from datetime import datetime
from collections import defaultdict

with open(r'c:\Projects\SKIL Master\sync-engine\data\vouchers.json', 'r', encoding='utf-8') as f:
    vouchers = json.load(f)

# 1. DROP-SHIP 1:1 MATCHING
purchases = {}
sales = {}
receipts = []
payments = []
debit_notes = []
credit_notes = []

for v in vouchers.values():
    vt = v.get('voucherType')
    vno = str(v.get('voucherNumber', ''))
    if vt == 'Purchase':
        idx = int(vno) if vno.isdigit() else 999
        purchases[idx] = v
    elif vt == 'Sales':
        s_num = vno.replace('SKIL-', '')
        idx = int(s_num) if s_num.isdigit() else 999
        sales[idx] = v
    elif vt == 'Receipt':
        receipts.append(v)
    elif vt == 'Payment':
        payments.append(v)
    elif vt == 'Debit Note':
        debit_notes.append(v)
    elif vt == 'Credit Note':
        credit_notes.append(v)

print(f"Loaded: Purchases={len(purchases)}, Sales={len(sales)}, Receipts={len(receipts)}, Payments={len(payments)}, DN={len(debit_notes)}, CN={len(credit_notes)}")

# Match purchases to sales
matches = []
for i in sorted(set(list(purchases.keys()) + list(sales.keys()))):
    p = purchases.get(i)
    s = sales.get(i)
    
    p_amt = abs(float(p.get('amount', 0))) if p else 0.0
    s_amt = abs(float(s.get('amount', 0))) if s else 0.0
    
    # Cartons
    p_narr = p.get('narration', '') if p else ''
    s_narr = s.get('narration', '') if s else ''
    m_pctn = re.search(r'(\d+)\s*CTN', p_narr, re.IGNORECASE)
    m_sctn = re.search(r'(\d+)\s*CTN', s_narr, re.IGNORECASE)
    p_ctn = int(m_pctn.group(1)) if m_pctn else 0
    s_ctn = int(m_sctn.group(1)) if m_sctn else 0
    
    # Pairs
    p_pairs = 0
    if p:
        for it in p.get('inventoryEntries', []):
            m = re.search(r'(\d+)', str(it.get('billedQty', '')))
            if m: p_pairs += int(m.group(1))
            
    s_pairs = 0
    if s:
        for it in s.get('inventoryEntries', []):
            m = re.search(r'(\d+)', str(it.get('billedQty', '')))
            if m: s_pairs += int(m.group(1))

    # Party
    s_party = s.get('partyLedgerName') if s else 'None'
    if s and (not s_party or s_party == 'None'):
        for le in s.get('ledgerEntries', []):
            ln = le.get('ledgerName', '')
            if 'GST' not in ln.upper() and 'SALES' not in ln.upper() and 'DISCOUNT' not in ln.upper() and 'ROUND' not in ln.upper():
                s_party = ln; break
                
    # Dates
    p_date = p.get('date', '') if p else ''
    s_date = s.get('date', '') if s else ''
    
    # Variance
    variance = round(s_amt - p_amt, 2)
    
    status = 'MATCHED'
    if not p: status = 'UNMAPPED_SALE'
    elif not s: status = 'UNBILLED_PURCHASE'
    elif p_pairs != s_pairs and (p_pairs > 0 and s_pairs > 0): status = 'PAIRS_MISMATCH'
    elif i == 16: status = 'INTERCHANGED_REF'
    elif i == 19: status = 'NARRATION_CTN_TYPO'
    elif abs(variance) > 20: status = 'MARGIN_VARIANCE'
    
    matches.append({
        'pair_no': i,
        'p_vno': p.get('voucherNumber') if p else None,
        's_vno': s.get('voucherNumber') if s else None,
        'p_ref': p.get('reference') if p else None,
        'p_date': p_date,
        's_date': s_date,
        'customer': s_party,
        'p_ctn': p_ctn,
        's_ctn': s_ctn,
        'pairs': max(p_pairs, s_pairs),
        'p_amt': p_amt,
        's_amt': s_amt,
        'variance': variance,
        'status': status
    })

print(f"Total Dropship Pairs: {len(matches)}")
status_counts = defaultdict(int)
for m in matches: status_counts[m['status']] += 1
print("Status Counts:", dict(status_counts))
