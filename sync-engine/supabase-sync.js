const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://psykhsowmqtdffqcsbxf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_MTgBAGucScoLdwkvrz9Gqg_upz56zoq';

function headers(preferResolution = 'resolution=merge-duplicates,return=minimal') {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': preferResolution
  };
}

async function upsertTable(table, rows, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(rows)
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

async function fetchSnapshot(key) {
  const url = `${SUPABASE_URL}/rest/v1/skil_snapshots?key=eq.${encodeURIComponent(key)}&select=key,payload,updated_at`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) return { ok: false, status: res.status, data: null };
  const arr = await res.json();
  return { ok: true, status: res.status, data: arr?.[0]?.payload || null, updatedAt: arr?.[0]?.updated_at || null };
}

async function pushAllToSupabase(dataDir = path.join(__dirname, '..', 'data')) {
  const report = {
    url: SUPABASE_URL,
    timestamp: new Date().toISOString(),
    tablesReady: true,
    snapshots: {},
    parties: null,
    vouchers: null,
    errors: []
  };

  const readJson = (f) => {
    const p = path.join(dataDir, f);
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  };

  const snapshotMap = {
    'status': readJson('status.json'),
    'overview': readJson('overview.json'),
    'aging': readJson('aging.json'),
    'ledgers': readJson('ledgers.json'),
    'vouchers': readJson('vouchers.json'),
    'master_grid': readJson('master-grid.json'),
    'inventory': readJson('inventory.json'),
    'schemes': readJson('schemes.json'),
    'audit': readJson('audit.json'),
    'folders': readJson('folders.json'),
    'tally_guide': readJson('tally-guide.json'),
    'daybook_notes': readJson('daybook-notes.json'),
    'statement_45d': readJson('statement-45d.json')
  };

  // Push each snapshot to skil_snapshots
  for (const [key, payload] of Object.entries(snapshotMap)) {
    if (!payload) continue;
    const count = Array.isArray(payload) ? payload.length : (payload.items?.length || payload.rows?.length || 1);
    const res = await upsertTable('skil_snapshots', [{
      key,
      payload,
      record_count: count,
      updated_at: new Date().toISOString()
    }], 'key');

    report.snapshots[key] = res.ok ? 'synced' : `HTTP ${res.status}`;
    if (!res.ok) {
      if (res.body.includes('PGRST205') || res.status === 404) {
        report.tablesReady = false;
      }
      report.errors.push(`skil_snapshots[${key}]: ${res.status} ${res.body.slice(0, 140)}`);
      if (!report.tablesReady) break;
    }
  }

  // Push normalized parties & vouchers if schema is active
  if (report.tablesReady) {
    const ledgers = snapshotMap.ledgers;
    if (Array.isArray(ledgers) && ledgers.length > 0) {
      const partyRows = ledgers.map(l => ({
        name: l.name,
        parent: l.parent || '',
        category: l.category || '',
        state: l.state || '',
        city: l.city || '',
        gstin: l.gstin || '',
        mobile: l.mobile || '',
        address: l.address || '',
        opening_balance: Number(l.openingBalance) || 0,
        closing_balance: Number(l.closingBalance) || 0,
        current_outstanding: Number(l.currentOutstanding) || 0,
        balance_type: l.balanceType || 'Dr',
        updated_at: new Date().toISOString()
      }));
      const pRes = await upsertTable('skil_parties', partyRows, 'name');
      report.parties = pRes.ok ? `synced (${partyRows.length})` : `HTTP ${pRes.status}`;
      if (!pRes.ok) report.errors.push(`skil_parties: ${pRes.status} ${pRes.body.slice(0, 140)}`);
    }

    const vouchersObj = snapshotMap.vouchers;
    const vList = Array.isArray(vouchersObj)
      ? vouchersObj
      : (vouchersObj?.items || Object.values(vouchersObj || {}));
    if (vList.length > 0) {
      const vRows = vList.map(v => {
        const dStr = String(v.date || '');
        const isoDate = /^\d{8}$/.test(dStr) ? `${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6, 8)}` : (/^\d{4}-\d{2}-\d{2}$/.test(dStr) ? dStr : null);
        return {
          id: v.id,
          guid: v.guid || v.id || '',
          voucher_date: isoDate,
          raw_date: dStr.replace(/-/g, ''),
          voucher_type: v.voucherType || '',
          voucher_number: v.voucherNumber || '',
          party_name: v.partyName || '',
          amount: Number(v.amount) || 0,
          reference: v.reference || '',
          narration: v.narration || '',
          ledger_entries: v.ledgerEntries || [],
          inventory_entries: v.inventoryEntries || [],
          updated_at: new Date().toISOString()
        };
      });
      // Chunk in batches of 75
      let syncedCount = 0;
      for (let i = 0; i < vRows.length; i += 75) {
        const chunk = vRows.slice(i, i + 75);
        const vRes = await upsertTable('skil_vouchers', chunk, 'id');
        if (vRes.ok) syncedCount += chunk.length;
        else report.errors.push(`skil_vouchers batch ${i}: ${vRes.status} ${vRes.body.slice(0, 140)}`);
      }
      report.vouchers = `synced (${syncedCount}/${vRows.length})`;
    }
  }

  return report;
}

if (require.main === module) {
  pushAllToSupabase().then(res => {
    console.log(JSON.stringify(res, null, 2));
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { pushAllToSupabase, fetchSnapshot, SUPABASE_URL, SUPABASE_KEY };
