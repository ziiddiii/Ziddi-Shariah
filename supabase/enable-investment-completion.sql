-- Optional setup for external hosting after restoring the full database and
-- drizzle/migrations/0003_investment_maturity_and_claims.sql.
-- Run as the database owner on a host supporting pg_cron.
-- This idempotently schedules one job, not one job per investment.
-- 1,440 bounded runs/day; notifications may arrive up to one minute after maturity.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'complete-investment-plans',
  '* * * * *',
  'SELECT public.complete_due_investments();'
);