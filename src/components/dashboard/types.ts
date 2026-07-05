export type Shop = {
  id: string;
  owner_user_id: string | null;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
};

export type Prize = {
  id: string;
  name: string;
  short: string;
  image_url: string;
  is_win: boolean;
  probability: number;
  sort_order: number;
};

export type CodeRow = {
  code: string;
  is_used: boolean;
  spun_at: string | null;
  prize_won: string | null;
  customer_name: string | null;
  created_at: string;
};

export type TabKey =
  | "overview" | "campaign" | "customers" | "analytics" | "settings"
  | "codes" | "qr" | "messages";

export type RecordRow = {
  code: string;
  spun_at: string | null;
  prize_won: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  customer_email: string | null;
};
