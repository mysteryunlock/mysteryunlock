export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          campaign_id: string | null
          code: string
          created_at: string
          customer_contact: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          is_used: boolean
          prize_won: string | null
          shop_id: string
          spun_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          code: string
          created_at?: string
          customer_contact?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          is_used?: boolean
          prize_won?: string | null
          shop_id: string
          spun_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          code?: string
          created_at?: string
          customer_contact?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          is_used?: boolean
          prize_won?: string | null
          shop_id?: string
          spun_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_codes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_codes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_codes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_customers: {
        Row: {
          customer_id: string
          first_seen: string
          id: string
          shop_id: string
        }
        Insert: {
          customer_id: string
          first_seen?: string
          id?: string
          shop_id: string
        }
        Update: {
          customer_id?: string
          first_seen?: string
          id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_claims: {
        Row: {
          claim_code:  string
          claimed_at:  string | null
          code:        string
          created_at:  string
          customer_id: string
          expires_at:  string | null
          id:          string
          prize_name:  string
          shop_id:     string
          status:      string
        }
        Insert: {
          claim_code?:  string
          claimed_at?:  string | null
          code:         string
          created_at?:  string
          customer_id:  string
          expires_at?:  string | null
          id?:          string
          prize_name:   string
          shop_id:      string
          status?:      string
        }
        Update: {
          claim_code?:  string
          claimed_at?:  string | null
          code?:        string
          created_at?:  string
          customer_id?: string
          expires_at?:  string | null
          id?:          string
          prize_name?:  string
          shop_id?:     string
          status?:      string
        }
        Relationships: [
          {
            foreignKeyName: "prize_claims_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "prize_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_claims_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          shop_id: string
          slug: string
          theme: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          shop_id: string
          slug: string
          theme?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          shop_id?: string
          slug?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          password: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shop_name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          password: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          password?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      prizes: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          image_url: string
          is_win: boolean
          name: string
          probability: number
          shop_id: string
          short: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id: string
          image_url: string
          is_win?: boolean
          name: string
          probability?: number
          shop_id: string
          short: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_win?: boolean
          name?: string
          probability?: number
          shop_id?: string
          short?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prizes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prizes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prizes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          recorded_by: string | null
          reference: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          reference?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          reference?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          billing_notes: string | null
          created_at: string
          current_period_end: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_user_id: string | null
          plan: Database["public"]["Enums"]["shop_plan"]
          slug: string
          subscription_status: Database["public"]["Enums"]["shop_sub_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_notes?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["shop_plan"]
          slug: string
          subscription_status?: Database["public"]["Enums"]["shop_sub_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_notes?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["shop_plan"]
          slug?: string
          subscription_status?: Database["public"]["Enums"]["shop_sub_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          code: string
          contact_url: string | null
          created_at: string
          cta_label: string | null
          currency: string
          features: Json
          id: string
          is_active: boolean
          is_highlighted: boolean
          name: string
          period: string
          price_amount: number
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          code: string
          contact_url?: string | null
          created_at?: string
          cta_label?: string | null
          currency?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          name: string
          period?: string
          price_amount?: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          contact_url?: string | null
          created_at?: string
          cta_label?: string | null
          currency?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          name?: string
          period?: string
          price_amount?: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      shops_public: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "super_admin"
      shop_plan: "free" | "pro" | "lifetime"
      shop_sub_status: "trial" | "active" | "past_due" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin"],
      shop_plan: ["free", "pro", "lifetime"],
      shop_sub_status: ["trial", "active", "past_due", "suspended"],
    },
  },
} as const
