-- Safe additive backfill: assign any access_codes where campaign_id IS NULL
-- to the shop's default campaign (is_default = true).
-- No data loss: only NULL rows are touched, already-assigned rows are skipped.
-- Run once; idempotent (re-running has no effect after all NULLs are cleared).

UPDATE access_codes ac
SET campaign_id = c.id
FROM campaigns c
WHERE ac.shop_id  = c.shop_id
  AND c.is_default = true
  AND ac.campaign_id IS NULL;
