---
name: Resumable email signup
description: The email signup flow must distinguish between an auth identity and an active merchant account.
---

Do not reject email signup solely because the email already has a Supabase auth record. Email OTP delivery can create that record before verification, shop creation, or password setup finishes.

**Why:** A failed, abandoned, or interrupted signup otherwise leaves a no-shop auth user that is permanently blocked from retrying the email path, while OAuth can resume the same identity and complete setup.

**How to apply:** Send the email verification OTP first. After verification, only redirect the person to sign in when their verified user already owns a shop; otherwise let them complete shop creation and password setup. Respect the provider's OTP resend cooldown rather than treating it as an existing-account error.