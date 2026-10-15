import json
with open("sync-engine/data/vouchers.json", "r", encoding="utf-8") as f:
    v = json.load(f)

for x in v.values():
    if x.get("voucherType") == "Debit Note":
        print(f"DN #{x.get('voucherNumber')} | Amt: {x.get('amount')}")
        for le in x.get("ledgerEntries", []):
            print(f"  -> {le.get('ledgerName')}: {le.get('amount')}")
