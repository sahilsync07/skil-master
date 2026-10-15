import fitz, glob, os, json, re

purchases_dir = glob.glob(r'c:\Projects\SKIL Master\user-documents-read-only-access\Purchases*')[0]

with open(r'c:\Projects\SKIL Master\sync-engine\data\vouchers.json', 'r', encoding='utf-8') as f:
    tally_vch = json.load(f)

pvs = [v for v in tally_vch.values() if v.get('voucherType') == 'Purchase']

def sort_key(v):
    vn = str(v.get('voucherNumber', '0'))
    return int(vn) if vn.isdigit() else 999999

pvs.sort(key=sort_key)

# Map PDF ship-to
pdf_ship_map = {}
for pf in os.listdir(purchases_dir):
    if not pf.endswith('.pdf'):
        continue
    p = os.path.join(purchases_dir, pf)
    doc = fitz.open(p)
    txt = doc[0].get_text()
    
    # Check ship-to party
    ship_to = 'UNKNOWN'
    city = 'UNKNOWN'
    code = 'UNKNOWN'
    
    m_inv = re.search(r'^(19004\d+|XPL-[0-9\-]+)', pf)
    inv_no = m_inv.group(1) if m_inv else None
    
    # Find ship-to block
    m_ship = re.search(r'(?:Ship-To|Consignee)\s*:\s*\n(.*?)\n(Buyer|Bill-To|Order\s*No|Dispatched|$)', txt, re.DOTALL | re.IGNORECASE)
    s_block = m_ship.group(1) if m_ship else txt[:1000]
    sb_low = s_block.lower()
    
    if 'brundaban' in sb_low:
        if 'malkangiri' in sb_low or 'malakangiri' in sb_low:
            ship_to = 'Sri Brundabana Enterprises'
            city = 'Malkangiri'
            code = 'SBEM'
        else:
            ship_to = 'Sri Brundabana Enterprises'
            city = 'Rayagada'
            code = 'SBE'
    elif 'shree footwear' in sb_low:
        ship_to = 'M/s. Shree Footwear'
        city = 'Srikakulam'
        code = 'SF'
    elif 'delight' in sb_low:
        ship_to = 'Delight Footwear'
        city = 'Vizianagaram'
        code = 'Delight'
    elif 'k g n' in sb_low or 'kgn' in sb_low or 'k.g.n' in sb_low:
        ship_to = 'K G N Footware'
        city = 'Parvathipuram'
        code = 'KGN'
    elif 'sharvani' in sb_low:
        ship_to = 'Sri Sharvani Traders'
        city = 'Visakhapatnam'
        code = 'Sharvani'
    elif 'jyothi' in sb_low:
        ship_to = 'Jyothi Footwear'
        city = 'Vizianagaram'
        code = 'Jyothi'
    elif 'sushila' in sb_low:
        ship_to = 'M/s Sushila Boot House'
        city = 'Jharsuguda'
        code = 'SBH'
    elif 'mahavir' in sb_low:
        ship_to = 'Mahavir Shoe House'
        city = 'Dhenkanal'
        code = 'Mahavir'
        
    if inv_no:
        pdf_ship_map[inv_no] = {'party': ship_to, 'city': city, 'code': code, 'filename': pf}
        pdf_ship_map[inv_no.replace('-', '/')] = {'party': ship_to, 'city': city, 'code': code, 'filename': pf}

# Audit every voucher
discrepancies = []
for pv in pvs:
    vno = pv.get('voucherNumber')
    ref = pv.get('reference')
    narr = pv.get('narration', '').strip()
    n_up = narr.upper()
    
    ship_info = pdf_ship_map.get(ref)
    if not ship_info:
        # Check by known ref
        if ref in ['1900410889', '1900410928', '1900410970', '1900411104']:
            ship_info = {'party': 'Jyothi Footwear', 'city': 'Vizianagaram', 'code': 'Jyothi', 'filename': 'NO_PDF'}
        elif ref in ['1900410890', '1900410929', '1900410971']:
            ship_info = {'party': 'K G N Footware', 'city': 'Parvathipuram', 'code': 'KGN', 'filename': 'NO_PDF'}
        elif ref in ['1900413999', '1900414047']:
            ship_info = {'party': 'M/s. Shree Footwear', 'city': 'Srikakulam', 'code': 'SF', 'filename': 'NO_PDF'}
        else:
            ship_info = {'party': 'UNKNOWN', 'city': 'UNKNOWN', 'code': 'UNKNOWN', 'filename': 'NO_PDF'}

    exp_code = ship_info['code']
    exp_city = ship_info['city']
    exp_party = ship_info['party']
    
    match = True
    reason = ''
    
    if exp_code == 'SBEM':
        if 'SBEM' not in n_up:
            match = False
            reason = f'Should be SBEM (Malkangiri) but is {narr}'
    elif exp_code == 'SBE':
        if 'SBE' not in n_up or 'SBEM' in n_up or 'MALKANGIRI' in n_up:
            match = False
            reason = f'Should be SBE (Rayagada) but is {narr}'
    elif exp_code == 'SF':
        if 'SF' not in n_up and 'SHREE' not in n_up:
            match = False
            reason = f'Should be SF (Srikakulam) but is {narr}'
    elif exp_code == 'Delight':
        if 'DELIGHT' not in n_up:
            match = False
            reason = f'Should be Delight (Vizianagaram) but is {narr}'
    elif exp_code == 'KGN':
        if 'KGN' not in n_up:
            match = False
            reason = f'Should be KGN (Parvathipuram) but is {narr}'
    elif exp_code == 'Sharvani':
        if 'SHARVANI' not in n_up:
            match = False
            reason = f'Should be Sharvani (Visakhapatnam) but is {narr}'
    elif exp_code == 'Jyothi':
        if 'JYOTHI' not in n_up:
            match = False
            reason = f'Should be Jyothi (Vizianagaram) but is {narr}'
    elif exp_code == 'SBH':
        if 'SBH' not in n_up and 'SUSHILA' not in n_up:
            match = False
            reason = f'Should be SBH / Sushila (Jharsuguda) but is {narr}'
    elif exp_code == 'Mahavir':
        if 'MAHAVIR' not in n_up:
            match = False
            reason = f'Should be Mahavir (Dhenkanal) but is {narr}'
            
    if not match:
        discrepancies.append((vno, ref, narr, exp_code, exp_city, reason))

print(f"Total Vouchers Audited: {len(pvs)}")
print(f"Total Ship-To vs Narration Discrepancies: {len(discrepancies)}")
for d in discrepancies:
    print("  ->", d)
