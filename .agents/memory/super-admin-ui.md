---
name: Super admin separate UI
description: How the super admin experience is separated from the shop owner dashboard
---

When the user with SUPER_ADMIN_EMAIL logs into /dashboard, listMyShops auto-grants the super_admin role and returns superAdmin:true, which triggers navigate({ to: "/super-admin" }) — they never see the shop owner UI.

/super-admin is a completely separate React page with a dark navy sidebar (#0c2340) and white content area. Sections: Shops & Users, Subscription Plans, Landing Page editor.

**Why:** User explicitly wanted a dedicated management system, not the spinning wheel dashboard.

**How to apply:** The super admin must not be given a shop (or if they have one from before, they'll still be redirected). The dashboard redirect fires on every load.
