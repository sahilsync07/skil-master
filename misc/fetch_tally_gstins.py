import urllib.request, re

xml_req = '''<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>LedgerColl</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME='LedgerColl'>
            <TYPE>Ledger</TYPE>
            <FETCH>Name, PartyGSTIN, StateName, LedgerContact</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>'''

req = urllib.request.Request('http://localhost:9000', data=xml_req.encode('utf-8'), headers={'Content-Type': 'text/xml'})
with urllib.request.urlopen(req, timeout=10) as resp:
    raw = resp.read().decode('utf-8', errors='ignore')

# Split by <LEDGER
chunks = raw.split('<LEDGER ')
for ch in chunks[1:]:
    name_m = re.search(r'NAME="([^"]+)"', ch)
    gstin_m = re.search(r'<PARTYGSTIN>([^<]+)</PARTYGSTIN>', ch)
    state_m = re.search(r'<STATENAME>([^<]+)</STATENAME>', ch)
    name = name_m.group(1) if name_m else ''
    gstin = gstin_m.group(1) if gstin_m else ''
    state = state_m.group(1) if state_m else ''
    if any(k in name.upper() for k in ['SHREE', 'BRUNDABAN', 'K G N', 'JYOTHI', 'SHARVANI', 'DELIGHT', 'SUSHILA', 'MAHAVIR']):
        print(f"{name:<45} | GSTIN: {gstin:<16} | State: {state}")
