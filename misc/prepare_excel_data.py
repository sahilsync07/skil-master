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

pdf_files = [f for f in os.listdir(purchases_dir) if f.endswith('.pdf')]

def parse_pdf(filepath):
    doc = fitz.open(filepath)
    txt = "\n".join([page.get_text() for page in doc])
    
    m_inv = re.search(r'Inv\.\s*No\.\s*:\s*([^\n\r]+)', txt)
    inv_no = m_inv.group(1).strip() if m_inv else None
    
    m_date = re.search(r'Inv\.\s*Date\s*:\s*([^\n\r]+)', txt)
    inv_date = m_date.group(1).strip() if m_date else None
    
    m_ctn = re.search(r'To\s*tal\s*:\s*\n\s*(\d+)\s*\n\s*(\d+)', txt, re.IGNORECASE)
    ctns = int(m_ctn.group(1)) if m_ctn else None
    pairs = int(m_ctn.group(2)) if m_ctn else None
    
    if not ctns:
        m_ctn2 = re.search(r'Total\s*Carton[s]?\s*[:\s]*(\d+)', txt, re.IGNORECASE)
        if m_ctn2:
            ctns = int(m_ctn2.group(1))
            
    ship_to = "UNKNOWN"
    m_ship = re.search(r'Ship-To:\s*\n(.*?)\n(?:Bill-To|Order No)', txt, re.DOTALL | re.IGNORECASE)
    if m_ship:
        s_block = m_ship.group(1)
        s_low = s_block.lower()
        if 'malkangiri' in s_low or 'malakangiri' in s_low:
            ship_to = 'Sri Brundabana Enterprises, Malkangiri'
        elif 'brundaban' in s_low:
            ship_to = 'Sri Brundabana Enterprises, Rayagada'
        elif 'shree footwear' in s_low:
            ship_to = 'M/s. Shree Footwear, Srikakulam'
        elif 'delight' in s_low:
            ship_to = 'Delight Footwear, Vizianagaram'
        elif 'k g n' in s_low or 'kgn' in s_low:
            ship_to = 'K G N Footware, Parvathipuram'
        elif 'sharvani' in s_low:
            ship_to = 'Sri Sharvani Traders, Visakhapatnam'
        elif 'jyothi' in s_low:
            ship_to = 'Jyothi Footwear, Vizianagaram'
        elif 'sushila' in s_low:
            ship_to = 'M/s Sushila Boot House, Jharsuguda'
        elif 'mahavir' in s_low:
            ship_to = 'Mahavir Shoe House, Dhenkanal'
            
    return {
        'inv_no': inv_no,
        'inv_date': inv_date,
        'ctns': ctns,
        'pairs': pairs,
        'ship_to': ship_to,
        'file': os.path.basename(filepath)
    }

pdf_data = {}
for pf in pdf_files:
    info = parse_pdf(os.path.join(purchases_dir, pf))
    if info['inv_no']:
        pdf_data[info['inv_no']] = info
        pdf_data[info['inv_no'].replace('/', '-')] = info

# Map consignees accurately if UNKNOWN
def get_consignee(code_or_party):
    cp = code_or_party.upper()
    if 'MALKANGIRI' in cp or 'SBEM' in cp:
        return 'Sri Brundabana Enterprises, Malkangiri'
    elif 'BRUNDABAN' in cp or 'SBE' in cp:
        return 'Sri Brundabana Enterprises, Rayagada'
    elif 'SHREE' in cp or 'SF' in cp:
        return 'M/s. Shree Footwear, Srikakulam'
    elif 'DELIGHT' in cp:
        return 'Delight Footwear, Vizianagaram'
    elif 'K G N' in cp or 'KGN' in cp:
        return 'K G N Footware, Parvathipuram'
    elif 'SHARVANI' in cp:
        return 'Sri Sharvani Traders, Visakhapatnam'
    elif 'JYOTHI' in cp:
        return 'Jyothi Footwear, Vizianagaram'
    elif 'SUSHILA' in cp or 'SBH' in cp:
        return 'M/s Sushila Boot House, Jharsuguda'
    elif 'MAHAVIR' in cp:
        return 'Mahavir Shoe House, Dhenkanal'
    return code_or_party

# Customer 5% CD Credit Notes
# KGN: SKIL-004 to SKIL-006 (Total 5421)
# Shree Footwear: SKIL-011 to SKIL-020 (Total 26539)
# Delight Footwear: SKIL-002 (Total 7436)
# Sri Brundabana (Rayagada): SKIL-001, SKIL-003, SKIL-007 to 010, SKIL-021, SKIL-022 (Total 20480)

# Build bills list
bills = []
for i in range(1, 54):
    p = purchases.get(i)
    s = sales.get(i)
    ref = p.get('reference', '').strip() if p else ''
    pdate_raw = str(p.get('date', '')) if p else ''
    # Convert 20260812 to 2026-08-12
    if len(pdate_raw) == 8 and pdate_raw.isdigit():
        pdate_dt = datetime.strptime(pdate_raw, '%Y%m%d')
        pdate_str = pdate_dt.strftime('%d-%m-%Y')
    else:
        pdate_dt = datetime(2026, 1, 1)
        pdate_str = pdate_raw

    pnarr = p.get('narration', '') if p else ''
    snarr = s.get('narration', '') if s else ''
    cust = s.get('partyName', '') if s else ''
    p_amt = float(p.get('amount', 0)) if p else 0
    s_amt = float(s.get('amount', 0)) if s else 0
    p_taxable = sum([float(it.get('amount', 0)) for it in p.get('inventoryEntries', [])])
    s_taxable = sum([float(it.get('amount', 0)) for it in s.get('inventoryEntries', [])])
    
    pdf_info = pdf_data.get(ref) or pdf_data.get(ref.replace('/', '-'))
    
    # Cartons
    ctns = None
    if pdf_info and pdf_info.get('ctns'):
        ctns = pdf_info['ctns']
    else:
        m_c = re.search(r'(\d+)\s*(?:ctn|ctns)', pnarr, re.IGNORECASE) or re.search(r'(\d+)\s*(?:ctn|ctns)', snarr, re.IGNORECASE)
        if m_c:
            ctns = int(m_c.group(1))
            
    # Fix special known cartons (e.g. invoice 1900405893 has 11 cartons on PDF)
    if ref == '1900405893':
        ctns = 11

    # End Consignee Name
    if pdf_info and pdf_info.get('ship_to') and pdf_info['ship_to'] != 'UNKNOWN':
        consignee = pdf_info['ship_to']
    else:
        # derive from customer or narration
        consignee = get_consignee(cust or pnarr or snarr)
        
    # Credit Note Given (to Customer)
    cn_given_amt = 0.0
    cn_given_desc = "-"
    
    # Check customer CD allocation
    if i == 2: # Delight
        cn_given_amt = 7436.00
        cn_given_desc = "₹7,436.00 (5% CD, CN #3)"
    elif i in [4, 5, 6]: # KGN
        # 5% of taxable
        cd_val = round(s_taxable * 0.05, 2)
        cn_given_amt = cd_val
        cn_given_desc = f"₹{cd_val:,.2f} (5% CD, CN #1)"
    elif 11 <= i <= 20: # Shree Footwear
        cd_val = round(s_taxable * 0.05, 2)
        cn_given_amt = cd_val
        cn_given_desc = f"₹{cd_val:,.2f} (5% CD, CN #2)"
    elif i in [1, 3, 7, 8, 9, 10, 21, 22]: # Sri Brundabana Rayagada
        cd_val = round(s_taxable * 0.05, 2)
        cn_given_amt = cd_val
        cn_given_desc = f"₹{cd_val:,.2f} (5% CD, CN #4)"
    else:
        cn_given_amt = 0.0
        cn_given_desc = "₹0.00"

    # Credit Note Received (from Ajanta Shoes)
    cn_rec_amt = 0.0
    cn_rec_desc = "-"
    if ref == '1900405893': # Voucher 19
        cn_rec_amt = 1008.54
        cn_rec_desc = "₹1,008.54 (Rate Diff CN #160005127)"
    elif ref == '1900402693': # Voucher 5
        cn_rec_amt = 30.19
        cn_rec_desc = "₹30.19 (Rate Diff CN #160005127)"
    elif 1 <= i <= 22: # August Purchases turnover CD & Retailer Scheme
        # Eligible for 3% CD + 3.78% Scheme received in lump-sum CN #160005126 & #160005123
        cd_3 = round(p_taxable * 0.03, 2)
        retail_cd = round(p_taxable * 0.0378, 2)
        tot_aug_cn = cd_3 + retail_cd
        cn_rec_amt = tot_aug_cn
        cn_rec_desc = f"₹{tot_aug_cn:,.2f} (3% CD + 3.78% Scheme, CN #126/#123)"
    else:
        cn_rec_amt = 0.0
        cn_rec_desc = "₹0.00"

    bills.append({
        'p_vno': p.get('voucherNumber', str(i)),
        's_vno': s.get('voucherNumber', f"SKIL-{i:03d}"),
        'inv_no': ref,
        'date_dt': pdate_dt,
        'date_str': pdate_str,
        'consignee': consignee,
        'ctns': ctns if ctns else 0,
        'p_amt': p_amt,
        's_amt': s_amt,
        'cn_rec_amt': cn_rec_amt,
        'cn_rec_desc': cn_rec_desc,
        'cn_given_amt': cn_given_amt,
        'cn_given_desc': cn_given_desc
    })

print(f"Total bills processed: {len(bills)}")
# Sort most recent on top (reverse chronological order)
bills_sorted = sorted(bills, key=lambda x: (x['date_dt'], int(x['p_vno']) if str(x['p_vno']).isdigit() else 0), reverse=True)

print("\nTop 5 Most Recent Bills:")
for b in bills_sorted[:5]:
    print(f"Date: {b['date_str']} | P#{b['p_vno']} | S#{b['s_vno']} | Inv: {b['inv_no']} | Cust: {b['consignee'][:28]} | Ctns: {b['ctns']} | Purch: {b['p_amt']:,.2f} | Sales: {b['s_amt']:,.2f}")

