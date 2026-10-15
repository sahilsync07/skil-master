import fitz, glob, os, re

purchases_dir = glob.glob(r'c:\Projects\SKIL Master\user-documents-read-only-access\Purchases*')[0]

party_gstins = {}

for pf in os.listdir(purchases_dir):
    if not pf.endswith('.pdf'):
        continue
    p = os.path.join(purchases_dir, pf)
    doc = fitz.open(p)
    txt = doc[0].get_text()
    
    # Search for GSTINs in txt
    gstins = re.findall(r'[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}', txt)
    
    # We know Ajanta is 19AAECB6793N1ZV and SKIL is 37AFZFS2777J1ZV
    consignee_gstins = [g for g in gstins if g not in ['19AAECB6793N1ZV', '37AFZFS2777J1ZV']]
    
    # Match party name
    for party in ['SHREE', 'BRUNDABAN', 'K G N', 'JYOTHI', 'SHARVANI', 'DELIGHT', 'SUSHILA', 'MAHAVIR']:
        if party in txt.upper():
            if consignee_gstins:
                # Determine specific party
                p_name = party
                if party == 'BRUNDABAN':
                    if 'MALKANGIRI' in txt.upper() or 'MALAKANGIRI' in txt.upper():
                        p_name = 'BRUNDABAN (MALKANGIRI)'
                    else:
                        p_name = 'BRUNDABAN (RAYAGADA)'
                if p_name not in party_gstins:
                    party_gstins[p_name] = set()
                party_gstins[p_name].update(consignee_gstins)

print("PARSED GSTINS FROM SUPPLIER INVOICES:")
for p, g in sorted(party_gstins.items()):
    print(f"{p:<28}: {list(g)}")
