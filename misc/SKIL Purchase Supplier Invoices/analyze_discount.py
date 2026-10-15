import json

f = open('Truth_Data_Sources/DayBook.json', 'r', encoding='utf-16')
d = json.load(f)
f.close()

msgs = d.get('tallymessage', [])
print(f'Total vouchers: {len(msgs)}')

v = msgs[0] if msgs else {}
print(f'Keys in first voucher: {list(v.keys())}')
print(f'Reference: {v.get("reference")}')
print(f'Voucher Number: {v.get("vouchernumber")}')
print(f'Date: {v.get("date")}')

les = v.get('ledgerentries', [])
print(f'Ledger entries: {len(les)}')
for le in les[:3]:
    print(f'  {le.get("ledgername")}: {le.get("amount")}')

invs = v.get('allinventoryentries', [])
print(f'Inventory entries: {len(invs)}')
if invs:
    print(json.dumps(invs[0], indent=2))

# Check all top-level keys in daybook
print(f'\nTop-level keys in DayBook: {list(d.keys())}')
