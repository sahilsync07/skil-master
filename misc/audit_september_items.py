import fitz, glob, os, json, re

purchases_dir = glob.glob(r'c:\Projects\SKIL Master\user-documents-read-only-access\Purchases*')[0]

with open(r'c:\Projects\SKIL Master\sync-engine\data\vouchers.json', 'r', encoding='utf-8') as f:
    tally_vch = json.load(f)

pvs_by_ref = {}
for v in tally_vch.values():
    if v.get('voucherType') == 'Purchase' and v.get('reference'):
        r = v.get('reference')
        pvs_by_ref[r] = v
        pvs_by_ref[r.replace('/', '-')] = v
        pvs_by_ref[r.replace('-', '/')] = v

sep_mismatches = []
audited_count = 0

for f in sorted(os.listdir(purchases_dir)):
    if not f.endswith('.pdf'):
        continue
    if not (f.startswith('190041') or f.startswith('XPL')):
        continue
    
    m_inv = re.search(r'^(190041\d+|XPL-[0-9\-]+)', f)
    if not m_inv:
        continue
    inv_no = m_inv.group(1)
    
    pv = pvs_by_ref.get(inv_no)
    if not pv:
        if inv_no == '1900416566':
            print(f"NOTE: Invoice {inv_no} ({f}) is PENDING ENTRY in Tally!")
        else:
            print(f"WARNING: Invoice {inv_no} ({f}) NOT FOUND IN TALLY!")
        continue
        
    audited_count += 1
    doc = fitz.open(os.path.join(purchases_dir, f))
    txt = ''
    for p in doc:
        txt += p.get_text() + '\n'
        
    m_tot = re.search(r'Total:\s*\n\s*(\d+)\s*\n\s*([0-9,]+)\s*\n\s*([0-9,]+\.[0-9]{2})', txt)
    if m_tot:
        pdf_ctns = int(m_tot.group(1))
        pdf_pairs = int(m_tot.group(2).replace(',', ''))
        pdf_taxable = float(m_tot.group(3).replace(',', ''))
        
        t_items = pv.get('inventoryEntries', [])
        t_pairs = sum(int(it['actualQty'].split()[0]) for it in t_items if 'Pairs' in it['actualQty'])
        t_ctns = sum(int(it['actualQty'].split('=')[1].strip().split()[0]) for it in t_items if '=' in it['actualQty'])
        t_taxable = sum(abs(float(it.get('amount', 0))) for it in t_items)
        
        vno = pv.get('voucherNumber')
        if t_ctns != pdf_ctns:
            sep_mismatches.append(f"Vch #{vno} ({inv_no}): Cartons Tally={t_ctns} vs PDF={pdf_ctns}")
        if t_pairs != pdf_pairs:
            sep_mismatches.append(f"Vch #{vno} ({inv_no}): Pairs Tally={t_pairs} vs PDF={pdf_pairs}")
        if abs(t_taxable - pdf_taxable) > 1.0:
            sep_mismatches.append(f"Vch #{vno} ({inv_no}): Taxable Tally={t_taxable:.2f} vs PDF={pdf_taxable:.2f}")
    else:
        if 'XPL' in inv_no:
            m_xp_tot = re.search(r'([0-9,]+)\s*PRS\s*\n\s*(\d+)\s*CASE', txt)
            if m_xp_tot:
                pdf_pairs = int(m_xp_tot.group(1).replace(',', ''))
                t_items = pv.get('inventoryEntries', [])
                t_pairs = sum(int(it['actualQty'].split()[0]) for it in t_items if 'Pairs' in it['actualQty'])
                vno = pv.get('voucherNumber')
                if t_pairs != pdf_pairs:
                    sep_mismatches.append(f"Xpania Vch #{vno}: Pairs Tally={t_pairs} vs PDF={pdf_pairs}")

print(f"\nSeptember Invoices Audited: {audited_count}")
print(f"Mismatches found in September invoices: {len(sep_mismatches)}")
for m in sep_mismatches:
    print("  ->", m)
