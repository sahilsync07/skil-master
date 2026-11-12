-- ============================================================================
-- SKIL LIFESTYLE LLP — Supabase Cloud Schema (Project: psykhsowmqtdffqcsbxf)
-- Run this once in Supabase Dashboard -> SQL Editor to enable full Cloud Sync
-- ============================================================================

-- 1. JSON Snapshots Store (Instant Dashboard, Aging, 45-Day Sheet & Status Sync)
CREATE TABLE IF NOT EXISTS public.skil_snapshots (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  record_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Normalized Ledgers (Debtors, Creditors, Bank, GST & Capital Accounts)
CREATE TABLE IF NOT EXISTS public.skil_parties (
  name TEXT PRIMARY KEY,
  parent TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  state TEXT DEFAULT '',
  city TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  mobile TEXT DEFAULT '',
  address TEXT DEFAULT '',
  opening_balance NUMERIC DEFAULT 0,
  closing_balance NUMERIC DEFAULT 0,
  current_outstanding NUMERIC DEFAULT 0,
  balance_type TEXT DEFAULT 'Dr',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tally & Manual Vouchers Register
CREATE TABLE IF NOT EXISTS public.skil_vouchers (
  id TEXT PRIMARY KEY,
  guid TEXT DEFAULT '',
  voucher_date DATE,
  raw_date TEXT DEFAULT '',
  voucher_type TEXT NOT NULL DEFAULT '',
  voucher_number TEXT DEFAULT '',
  party_name TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  reference TEXT DEFAULT '',
  narration TEXT DEFAULT '',
  ledger_entries JSONB DEFAULT '[]'::jsonb,
  inventory_entries JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skil_vouchers_date ON public.skil_vouchers (voucher_date);
CREATE INDEX IF NOT EXISTS idx_skil_vouchers_party ON public.skil_vouchers (party_name);

-- 4. Manual Bahi Khata / Daybook Entries & Field Notes
CREATE TABLE IF NOT EXISTS public.skil_manual_entries (
  id TEXT PRIMARY KEY,
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL, -- 'Receipt', 'Payment', 'Sales', 'Note'
  party_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  mode TEXT DEFAULT 'UPI', -- 'Cash', 'UPI', 'NEFT/RTGS', 'Cheque'
  narration TEXT DEFAULT '',
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security & Access Policies for SKIL Master App / Web
ALTER TABLE public.skil_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skil_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skil_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skil_manual_entries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['skil_snapshots', 'skil_parties', 'skil_vouchers', 'skil_manual_entries']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "skil_open_read" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "skil_open_write" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "skil_open_read" ON public.%I FOR SELECT USING (true)', tbl);
    EXECUTE format('CREATE POLICY "skil_open_write" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
