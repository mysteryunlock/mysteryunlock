-- Phase 4.2 security hardening: remove plaintext passwords from pending_signups.
-- Credentials are no longer stored server-side; approved users receive a
-- "set your password" email instead of having their chosen password replayed.

-- 1. Wipe any plaintext passwords already in the table.
UPDATE public.pending_signups SET password = '' WHERE password <> '';

-- 2. Make the column nullable so future rows can omit it entirely.
ALTER TABLE public.pending_signups ALTER COLUMN password DROP NOT NULL;

-- 3. Default to empty string for any legacy inserts that still supply the column.
ALTER TABLE public.pending_signups ALTER COLUMN password SET DEFAULT '';
