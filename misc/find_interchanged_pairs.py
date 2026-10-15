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

print("="*120)
print("FULL AUDIT: Purchase vs Sales — Narration, Reference, Amount, Date Cross-Check")
print("="*120)
print(f"{'#':>3} | {'P_Ref':>14} | {'S_Ref':>14} | {'RefOK':>5} | {'P_Date':>10} | {'P_Narr':>25} | {'S_Narr':>25} | {'P_Amt':>12} | {'S_Amt':>12} | {'Diff':>10}")
print("-"*170)

mismatches = []

for i in range(1, 54):
    p = purchases.get(i)
    s = sales.get(i)
    pref = p.get('reference', '').strip()
    sref = s.get('reference', '').strip()
    pnarr = p.get('narration', '').strip()
    snarr = s.get('narration', '').strip()
    pdate = p.get('date', '')
    p_amt = abs(float(p.get('amount', 0)))
    s_amt = abs(float(s.get('amount', 0)))
    diff = round(s_amt - p_amt, 2)
    ref_ok = (pref == sref)
    
    # Extract carton count from narration
    m_pc = re.search(r'(\d+)\s*(?:ctn|ctns)', pnarr, re.IGNORECASE)
    m_sc = re.search(r'(\d+)\s*(?:ctn|ctns)', snarr, re.IGNORECASE)
    p_ctns = int(m_pc.group(1)) if m_pc else None
    s_ctns = int(m_sc.group(1)) if m_sc else None
    
    # Extract consignee code from narration
    p_code = pnarr.split()[0].upper() if pnarr else ''
    s_code = snarr.split()[0].upper() if snarr else ''
    
    flag = ""
    if not ref_ok:
        flag += " [REF MISMATCH!]"
    if p_ctns and s_ctns and p_ctns != s_ctns:
        flag += f" [CTN MISMATCH: P={p_ctns} vs S={s_ctns}]"
    if p_code != s_code and p_code and s_code:
        flag += f" [CODE MISMATCH: P={p_code} vs S={s_code}]"
    if pnarr.upper() != snarr.upper():
        flag += " [NARR DIFFERS]"
        
    print(f"{i:3} | {pref:>14} | {sref:>14} | {str(ref_ok):>5} | {pdate:>10} | {pnarr:>25} | {snarr:>25} | {p_amt:>12,.2f} | {s_amt:>12,.2f} | {diff:>+10,.2f}{flag}")
    
    if flag:
        mismatches.append((i, flag, pref, sref, pnarr, snarr, p_amt, s_amt))

print("\n" + "="*120)
print(f"MISMATCHES FOUND: {len(mismatches)}")
print("="*120)
for m in mismatches:
    print(f"  Voucher #{m[0]:02d}: {m[1]}")
    print(f"     P_Ref: {m[2]} | S_Ref: {m[3]}")
    print(f"     P_Narr: '{m[4]}' | S_Narr: '{m[5]}'")
    print(f"     P_Amt: Rs {m[6]:,.2f} | S_Amt: Rs {m[7]:,.2f}")

# Now check for interchanged pairs: does any Sales voucher's reference match a DIFFERENT purchase voucher?
print("\n" + "="*120)
print("CROSS-REFERENCE CHECK: Looking for interchanged invoice references")
print("="*120)

p_ref_map = {p.get('reference', '').strip(): int(p.get('voucherNumber')) for p in purchases.values()}
s_ref_map = {}
for si in range(1, 54):
    s = sales.get(si)
    sr = s.get('reference', '').strip()
    s_ref_map[si] = sr

for si in range(1, 54):
    sr = s_ref_map[si]
    expected_pref = purchases.get(si, {}).get('reference', '').strip()
    if sr != expected_pref:
        actual_p = p_ref_map.get(sr, '??')
        print(f"  SKIL-{si:03d} has ref '{sr}' -> matches Purchase #{actual_p}, but is paired with Purchase #{si} (ref '{expected_pref}')")

# Also check if two purchase narrations are swapped
print("\n" + "="*120)
print("NARRATION SWAP CHECK: Looking for pairs where narrations seem interchanged")
print("="*120)

for i in range(1, 54):
    p = purchases.get(i)
    pnarr_i = p.get('narration', '').strip().upper()
    snarr_i = sales.get(i, {}).get('narration', '').strip().upper()
    
    # Check if this purchase narration matches a different sales voucher
    for j in range(1, 54):
        if j == i:
            continue
        snarr_j = sales.get(j, {}).get('narration', '').strip().upper()
        pnarr_j = purchases.get(j, {}).get('narration', '').strip().upper()
        
        # Check if P#i narr == S#j narr AND P#j narr == S#i narr (swap)
        if pnarr_i and snarr_j and pnarr_i == snarr_j and pnarr_j == snarr_i and i < j:
            print(f"  SWAP DETECTED: P#{i:02d} narr '{pnarr_i}' matches S#{j:02d}, AND P#{j:02d} narr '{pnarr_j}' matches S#{i:02d}")
