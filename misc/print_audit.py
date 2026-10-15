import json

with open('misc/audit_complete_report.json', 'r', encoding='utf-8') as f:
    rep = json.load(f)

print(f"{'Vch#':4} | {'Date':8} | {'Invoice Ref':16} | {'Tally Amount':12} | {'PDF Amount':12} | {'Amt Match':9} | {'Narration':18} | {'Ship-To Code':12} | {'Ship-To City':14}")
print("-" * 125)

for r in rep['rows']:
    vch = r['vch_no']
    dt = r['date']
    ref = r['reference']
    t_amt = f"Rs {r['tally_amount']:,.2f}"
    p_amt = f"Rs {r['pdf_amount']:,.2f}" if r['pdf_amount'] else "NO PDF"
    m_str = "MATCH" if r['amt_match'] else "DIFF"
    narr = r['narration']
    code = r['consignee_code']
    city = r['consignee_city']
    print(f"{vch:4} | {dt:8} | {ref:16} | {t_amt:12} | {p_amt:12} | {m_str:9} | {narr:18} | {code:12} | {city:14}")
