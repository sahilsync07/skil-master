import json, re

with open(r'c:\Projects\SKIL Master\sync-engine\data\vouchers.json', 'r', encoding='utf-8') as f:
    vouchers = json.load(f)

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
        if vno.isdigit(): purchases[int(vno)] = v
    elif vt == 'Sales':
        s_num = vno.replace('SKIL-', '')
        if s_num.isdigit(): sales[int(s_num)] = v
    elif vt == 'Receipt': receipts.append(v)
    elif vt == 'Payment': payments.append(v)
    elif vt == 'Debit Note': debit_notes.append(v)
    elif vt == 'Credit Note': credit_notes.append(v)

print(f"Purchases: {len(purchases)}, Sales: {len(sales)}")

# Test creating 1 comprehensive flat record for Bill #31 (e.g. SKIL-031)
p = purchases.get(31)
s = sales.get(31)

p_amt = abs(float(p.get('amount', 0)))
s_amt = abs(float(s.get('amount', 0)))
trade_margin = round(s_amt - p_amt, 2)

# Supplier schemes (Ajanta)
is_ajanta = 'XPL' not in str(p.get('reference', ''))
supp_cd3 = round(p_amt * (0.03 / 1.05), 2) if is_ajanta else 0.0 # base 3%
supp_scheme378 = round(p_amt * 0.0378, 2) if is_ajanta else 0.0
total_supp_rebate = round(supp_cd3 + supp_scheme378, 2)

# Customer 5% CD
taxable = sum(abs(float(le.get('amount', 0))) for le in s.get('ledgerEntries', []) if 'Sales' in le.get('ledgerName', ''))
cust_cd5 = round(taxable * 0.05, 2)

# Net profit on this specific bill
net_bill_profit = round(trade_margin + total_supp_rebate - cust_cd5, 2)

print("Bill #31 Master Row:")
print(f"  Purchase: {p.get('reference')} | Amt: Rs {p_amt}")
print(f"  Sales: {s.get('voucherNumber')} | Customer: {s.get('partyLedgerName')} | Amt: Rs {s_amt}")
print(f"  Trade Margin: Rs {trade_margin}")
print(f"  Supplier Rebates (3% CD + 3.78%): Rs {total_supp_rebate}")
print(f"  Customer 5% CD: Rs {cust_cd5}")
print(f"  Net Realized Profit: Rs {net_bill_profit} ({(net_bill_profit/s_amt)*100:.2f}%)")
