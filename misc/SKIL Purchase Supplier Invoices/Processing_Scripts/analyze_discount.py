import json

with open('Truth_Data_Sources/invoice.json', 'r') as f:
    invoices = json.load(f)

below = []

for inv in invoices:
    for item in inv['data']['bill data']:
        mrp = item['MRP']
        rate = item['Rate']
        landed_cost = rate * 1.05
        net_discount = ((mrp - landed_cost) / mrp) * 100
        rounded = round(net_discount, 2)

        # Only products significantly below 37.5% (not in the ~37.48-37.50 range)
        if rounded < 37.45:
            below.append({
                'invoice': inv['invoice no'],
                'ship_to': inv['ship to']['name'],
                'date': inv['date'],
                'description': item['Description'],
                'mrp': mrp,
                'rate': rate,
                'pair': item['Pair'],
                'amount': item['Amount(Rs.)'],
                'landed_cost': round(landed_cost, 2),
                'net_discount': rounded,
            })

print(f'Products with net discount BELOW 37.5% (excluding ~37.48-37.50 rounding): {len(below)}')
print()

below_sorted = sorted(below, key=lambda x: x['net_discount'])
for i, p in enumerate(below_sorted, 1):
    print(f"  {i}. {p['description']}")
    print(f"     Invoice: {p['invoice']}  |  Date: {p['date']}  |  Ship To: {p['ship_to']}")
    print(f"     MRP: Rs.{p['mrp']:.2f}  |  Rate: Rs.{p['rate']:.2f}  |  Landed: Rs.{p['landed_cost']:.2f}  |  Pairs: {p['pair']}")
    print(f"     NET DISCOUNT: {p['net_discount']:.2f}%   (Gap from 37.5%: {37.5 - p['net_discount']:.2f}%)")
    print()
