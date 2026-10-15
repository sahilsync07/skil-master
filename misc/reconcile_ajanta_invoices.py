import json, fitz, re

# Load Tally Vouchers
with open('sync-engine/data/vouchers.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

tally_invoices = {}
for x in v.values():
    if x.get('voucherType') == 'Purchase':
        ref = x.get('reference', '').strip()
        amt = abs(float(x.get('amount', 0)))
        tally_invoices[ref] = amt

# Parse Ajanta PDF
doc = fitz.open('93081.pdf')
lines = []
for i in range(len(doc)):
    lines.extend(doc[i].get_text().split('\n'))

ajanta_invoices = {}
for i, line in enumerate(lines):
    if re.match(r'^\d{2}\.\d{2}\.\d{4}$', line):
        doc_no = lines[i+1].strip()
        doc_type = lines[i+2].strip()
        
        debit = 0.0
        credit = 0.0
        for j in range(i+3, i+15):
            val = lines[j].strip()
            if ',' in val or '.' in val:
                val_clean = val.replace(',', '').replace('-', '')
                try:
                    num = float(val_clean)
                    if num > 0:
                        if doc_type == 'RV':
                            if '1900416566' in doc_no and len(ajanta_invoices) > 0 and list(ajanta_invoices.keys())[-1] == '1900416566':
                                credit = num
                            else:
                                debit = num
                        elif doc_type == 'DZ':
                            credit = num
                        elif doc_type == 'DG':
                            credit = num
                        elif doc_no.startswith('160'):
                            credit = num
                        break
                except:
                    pass
                    
        if doc_type == 'RV' and debit > 0:
            ajanta_invoices[doc_no] = debit

# Reconcile
print("RECONCILIATION OF INVOICES (Tally vs Ajanta PDF)")
print("="*80)
missing_in_tally = []
mismatch_amounts = []

for inv, amt in ajanta_invoices.items():
    if inv not in tally_invoices:
        missing_in_tally.append((inv, amt))
    elif abs(tally_invoices[inv] - amt) > 1.0:
        mismatch_amounts.append((inv, amt, tally_invoices[inv]))

print(f"Invoices in Ajanta PDF: {len(ajanta_invoices)}")
print(f"Invoices in Tally: {len(tally_invoices)}")
print("-"*80)

if missing_in_tally:
    print("MISSING IN TALLY (In Ajanta PDF but not booked as Purchase in Tally):")
    for inv, amt in missing_in_tally:
        print(f"  - {inv}: Rs {amt}")
else:
    print("No invoices missing in Tally.")

print("-"*80)
if mismatch_amounts:
    print("AMOUNT MISMATCHES (Ajanta PDF vs Tally):")
    for inv, a_amt, t_amt in mismatch_amounts:
        print(f"  - {inv}: Ajanta=Rs {a_amt} | Tally=Rs {t_amt} | Diff={a_amt - t_amt}")
else:
    print("No amount mismatches found.")
