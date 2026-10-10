-- =====================================================
-- KEEP-ALIVE TABLE
-- Supabase pauses free projects after ~7 days without activity. A plain read
-- is not always counted, so /api/keep-alive INSERTs a row here and DELETEs it
-- again (see src/app/api/keep-alive/route.ts), scheduled by Vercel Cron
-- (vercel.json) and, as a backup, by .github/workflows/keep-alive.yml.
-- Run in Supabase Dashboard -> SQL Editor. Idempotent.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.keep_alive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT
);

COMMENT ON TABLE public.keep_alive IS 'Scratch rows written and deleted by /api/keep-alive so the project is not paused for inactivity. Service role only.';

-- RLS on with no policies: anon/authenticated users cannot touch it; the
-- service-role client used by the route bypasses RLS.
ALTER TABLE public.keep_alive ENABLE ROW LEVEL SECURITY;
