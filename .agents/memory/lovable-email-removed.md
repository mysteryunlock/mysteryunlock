---
name: Lovable email endpoint removed
description: What was changed when removing the Lovable-specific email API call.
---

`pending-signups.functions.ts` previously called `${origin}/lovable/email/transactional/send`
to notify the admin of new signup requests.

**Fix:** Replaced with a call to `${origin}/api/notify-admin` gated on `SITE_URL` env var being set.
If `SITE_URL` is absent (default on Replit dev), the notification silently skips — the admin
badge in the super-admin dashboard still works regardless.

**Why:** The Lovable endpoint only exists on Lovable's hosting infrastructure, not Replit.

**How to apply:** If email notifications are needed, implement `GET /api/notify-admin` as a
TanStack Start API route, or wire up an email integration (SendGrid, Resend, etc.) via secrets.
