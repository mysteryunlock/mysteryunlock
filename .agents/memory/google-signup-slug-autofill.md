---
name: Google signup slug autofill
description: Preserve automatic shop URL generation on the Google OAuth setup form despite mobile partial URL input events.
---

The Google OAuth shop-setup form must keep its URL slug derived from the shop name until the user provides a URL that differs from the generated name slug. A partial value matching a prefix of the generated slug is not an intentional custom URL.

**Why:** Mobile browsers can emit an early partial input event for the URL field while the user is still entering the shop name. Treating that event as a manual edit freezes the slug at a single character and forces the user to retype it.

**How to apply:** Keep generated-name prefixes in automatic mode; only preserve a manually edited slug once it diverges from the normalized shop-name slug.