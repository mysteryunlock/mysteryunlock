---
name: Site settings table
description: Supabase table for editable landing page content, and how to apply the migration
---

The site_settings table (key TEXT PK, value JSONB, updated_at) lives in Supabase and must be applied manually via the Supabase SQL editor — there is no Supabase CLI and the REST API doesn't support DDL via exec_sql RPC.

Migration file: supabase/migrations/20260703100000_site_settings.sql

Default keys seeded: hero, announcement, contact.

getSiteSettings() fails gracefully (returns {}) if table doesn't exist — landing page falls back to hardcoded defaults.

**Why:** Couldn't apply migration programmatically; exec_sql RPC not available, no supabase CLI, no direct PostgreSQL password for Supabase project onpowanouhwgfkrnpite (note: config.toml shows gvrmaebesrovvjhfvbon, different from running env vars).

**How to apply:** Go to Supabase dashboard → SQL Editor → paste contents of the migration file → Run.
