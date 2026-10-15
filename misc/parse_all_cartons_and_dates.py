import fitz, glob, os, json, re

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
    
    # Extract invoice number
    m_inv = re.search(r'Inv\.\s*No\.\s*:\s*([^\n\r]+)', txt)
    inv_no = m_inv.group(1).strip() if m_inv else None
    
    # Extract date
    m_date = re.search(r'Inv\.\s*Date\s*:\s*([^\n\r]+)', txt)
    inv_date = m_date.group(1).strip() if m_date else None
    
    # Extract total cartons
    # Looking for Total line like: Total : \n 11 \n 354
    m_ctn = re.search(r'To\s*tal\s*:\s*\n\s*(\d+)\s*\n\s*(\d+)', txt, re.IGNORECASE)
    ctns = int(m_ctn.group(1)) if m_ctn else None
    pairs = int(m_ctn.group(2)) if m_ctn else None
    
    # If not found, try other carton patterns
    if not ctns:
        m_ctn2 = re.search(r'Total\s*Carton[s]?\s*[:\s]*(\d+)', txt, re.IGNORECASE)
        if m_ctn2:
            ctns = int(m_ctn2.group(1))
            
    # Extract Ship-To
    ship_to = "UNKNOWN"
    m_ship = re.search(r'Ship-To:\s*\n(.*?)\n(?:Bill-To|Order No)', txt, re.DOTALL | re.IGNORECASE)
    if m_ship:
        s_block = m_ship.group(1)
        s_low = s_block.lower()
        if 'malkangiri' in s_low or 'malakangiri' in s_low:
            ship_to = 'Sri Brundaban Enterprises (Malkangiri)'
        elif 'brundaban' in s_low:
            ship_to = 'Sri Brundabana Enterprises (Rayagada)'
        elif 'shree footwear' in s_low:
            ship_to = 'M/s. Shree Footwear (Srikakulam)'
        elif 'delight' in s_low:
            ship_to = 'Delight Footwear (Vizianagaram)'
        elif 'k g n' in s_low or 'kgn' in s_low:
            ship_to = 'K G N Footware (Parvathipuram)'
        elif 'sharvani' in s_low:
            ship_to = 'Sri Sharvani Traders (Visakhapatnam)'
        elif 'jyothi' in s_low:
            ship_to = 'Jyothi Footwear (Vizianagaram)'
        elif 'sushila' in s_low:
            ship_to = 'M/s Sushila Boot House (Jharsuguda)'
        elif 'mahavir' in s_low:
            ship_to = 'Mahavir Shoe House (Dhenkanal)'
            
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

print(f"Total PDFs parsed: {len(pdf_data)}")

# Now match with all 53 vouchers
bills = []
for i in range(1, 54):
    p = purchases.get(i)
    s = sales.get(i)
    ref = p.get('reference', '').strip() if p else ''
    pdate = p.get('date', '') if p else ''
    pnarr = p.get('narration', '') if p else ''
    snarr = s.get('narration', '') if s else ''
    cust = s.get('partyName', '') if s else ''
    p_amt = float(p.get('amount', 0)) if p else 0
    s_amt = float(s.get('amount', 0)) if s else 0
    
    # Cartons from PDF or Narration
    pdf_info = pdf_data.get(ref) or pdf_data.get(ref.replace('/', '-'))
    ctns = None
    if pdf_info and pdf_info.get('ctns'):
        ctns = pdf_info['ctns']
    else:
        # extract from narration
        m_c = re.search(r'(\d+)\s*(?:ctn|ctns)', pnarr, re.IGNORECASE) or re.search(r'(\d+)\s*(?:ctn|ctns)', snarr, re.IGNORECASE)
        if m_c:
            ctns = int(m_c.group(1))
            
    bills.append({
        'idx': i,
        'ref': ref,
        'date': pdate,
        'pdf_date': pdf_info['inv_date'] if pdf_info else None,
        'p_vno': p.get('voucherNumber') if p else '',
        's_vno': s.get('voucherNumber') if s else '',
        'customer': cust,
        'ship_to': pdf_info['ship_to'] if pdf_info and pdf_info['ship_to'] != 'UNKNOWN' else cust,
        'ctns': ctns,
        'p_amt': p_amt,
        's_amt': s_amt,
        'pnarr': pnarr,
        'snarr': snarr
    })

print(f"Matched bills: {len(bills)}")
for b in bills:
    print(f"#{b['idx']:02d} | Date: {b['date']} | Ref: {b['ref']:14} | Ctns: {str(b['ctns']):3} | Cust: {b['ship_to'][:30]} | P_Amt: {b['p_amt']:10,.2f} | S_Amt: {b['s_amt']:10,.2f}")
