-- Site settings table for editable landing page content
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings"
  ON public.site_settings FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Super admins manage site settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Seed default values
INSERT INTO public.site_settings (key, value) VALUES
  ('hero', '{
    "badge": "New · Premium spin SaaS",
    "title_main": "Turn every visit into a",
    "title_highlight": "memorable spin.",
    "subtitle": "Mystery Unlock is the elegant, modern way to run spin-to-win campaigns. Brand your wheel, share a QR, and track every winner from one beautiful dashboard.",
    "cta_primary": "Start Free",
    "cta_secondary": "Watch Demo"
  }'),
  ('announcement', '{
    "enabled": false,
    "text": "",
    "link": ""
  }'),
  ('contact', '{
    "whatsapp": "9779769402069",
    "email": ""
  }')
ON CONFLICT (key) DO NOTHING;
