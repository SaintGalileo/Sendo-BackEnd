-- Backfill missing merchant operating hours.
-- Makes isMerchantAvailable behave consistently after enforcing hours as required.

BEGIN;

UPDATE public.merchants
SET
  opening_time = '00:00:00',
  closing_time = '23:59:59'
WHERE
  opening_time IS NULL
  OR closing_time IS NULL;

COMMIT;
