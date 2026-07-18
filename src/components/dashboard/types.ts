export type Shop = {
  id: string;
  owner_user_id: string | null;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  /** Minimum prize weight a shop owner may set. 0 = no minimum. Default 5. */
  minimum_probability: number;
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
  | "codes" | "qr" | "messages" | "claims";

export type RecordRow = {
  code: string;
  spun_at: string | null;
  prize_won: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  customer_email: string | null;
  campaign_id: string | null;
};

export type CustomerRecord = {
  key: string;
  name: string | null;
  contact: string | null;
  email: string | null;
  totalSpins: number;
  totalWins: number;
  prizes: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  campaignIds: string[];
  segments: string[];
};

export type CustomerSpinRow = {
  code: string;
  spun_at: string | null;
  prize_won: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
};
