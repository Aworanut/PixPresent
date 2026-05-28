export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      credit_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          note: string | null
          reason: string
          ref_id: string | null
          tenant_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          reason: string
          ref_id?: string | null
          tenant_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: string
          ref_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_storage_folders: {
        Row: {
          created_at: string
          event_id: string
          folder_id: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          event_id: string
          folder_id: string
          id?: string
          label?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          folder_id?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_storage_folders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          activated_at: string | null
          commerce_enabled: boolean
          created_at: string
          credits_used: number
          currency: string | null
          data_retention_days: number
          default_photo_price: number | null
          deleted_at: string | null
          event_date: string | null
          highlight_reel_enabled: boolean
          id: string
          is_indexed: boolean
          link_active_days: number
          name: string
          reel_quota: number | null
          rekognition_collection_id: string | null
          share_link_expires_days: number
          share_token: string | null
          share_token_expires_at: string | null
          storage_limit_gb: number
          sync_completed_at: string | null
          sync_photo_count: number
          sync_started_at: string | null
          tenant_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          commerce_enabled?: boolean
          created_at?: string
          credits_used?: number
          currency?: string | null
          data_retention_days?: number
          default_photo_price?: number | null
          deleted_at?: string | null
          event_date?: string | null
          highlight_reel_enabled?: boolean
          id?: string
          is_indexed?: boolean
          link_active_days?: number
          name: string
          reel_quota?: number | null
          rekognition_collection_id?: string | null
          share_link_expires_days?: number
          share_token?: string | null
          share_token_expires_at?: string | null
          storage_limit_gb?: number
          sync_completed_at?: string | null
          sync_photo_count?: number
          sync_started_at?: string | null
          tenant_id: string
          tier?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          commerce_enabled?: boolean
          created_at?: string
          credits_used?: number
          currency?: string | null
          data_retention_days?: number
          default_photo_price?: number | null
          deleted_at?: string | null
          event_date?: string | null
          highlight_reel_enabled?: boolean
          id?: string
          is_indexed?: boolean
          link_active_days?: number
          name?: string
          reel_quota?: number | null
          rekognition_collection_id?: string | null
          share_link_expires_days?: number
          share_token?: string | null
          share_token_expires_at?: string | null
          storage_limit_gb?: number
          sync_completed_at?: string | null
          sync_photo_count?: number
          sync_started_at?: string | null
          tenant_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      face_blacklist: {
        Row: {
          created_at: string
          event_id: string
          face_id: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          face_id: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          face_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "face_blacklist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          consent_at: string | null
          created_at: string
          event_id: string
          expires_at: string
          highlight_reel_status: string | null
          highlight_reel_url: string | null
          id: string
          matched_photo_ids: string[]
          purchased_photo_ids: string[]
          selfie_r2_key: string | null
        }
        Insert: {
          consent_at?: string | null
          created_at?: string
          event_id: string
          expires_at: string
          highlight_reel_status?: string | null
          highlight_reel_url?: string | null
          id?: string
          matched_photo_ids?: string[]
          purchased_photo_ids?: string[]
          selfie_r2_key?: string | null
        }
        Update: {
          consent_at?: string | null
          created_at?: string
          event_id?: string
          expires_at?: string
          highlight_reel_status?: string | null
          highlight_reel_url?: string | null
          id?: string
          matched_photo_ids?: string[]
          purchased_photo_ids?: string[]
          selfie_r2_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          event_id: string
          face_details: Json
          id: string
          indexed_at: string | null
          price: number | null
          r2_full_url: string | null
          r2_web_url: string | null
          rekognition_face_ids: string[]
          storage_file_id: string
          visibility: string
          watermark_url: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          face_details?: Json
          id?: string
          indexed_at?: string | null
          price?: number | null
          r2_full_url?: string | null
          r2_web_url?: string | null
          rekognition_face_ids?: string[]
          storage_file_id: string
          visibility?: string
          watermark_url?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          face_details?: Json
          id?: string
          indexed_at?: string | null
          price?: number | null
          r2_full_url?: string | null
          r2_web_url?: string | null
          rekognition_face_ids?: string[]
          storage_file_id?: string
          visibility?: string
          watermark_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      slip_uploads: {
        Row: {
          amount_thb: number
          credits_claimed: number
          id: string
          package_id: string
          reject_reason: string | null
          slip_image_url: string
          status: string
          tenant_id: string
          uploaded_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_thb: number
          credits_claimed: number
          id?: string
          package_id: string
          reject_reason?: string | null
          slip_image_url: string
          status?: string
          tenant_id: string
          uploaded_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_thb?: number
          credits_claimed?: number
          id?: string
          package_id?: string
          reject_reason?: string | null
          slip_image_url?: string
          status?: string
          tenant_id?: string
          uploaded_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slip_uploads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          credit_balance: number
          google_connected_at: string | null
          google_refresh_token: string | null
          id: string
          name: string
          owner_user_id: string
          payment_provider: string | null
          payout_account_id: string | null
          plan: string
          storage_provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_balance?: number
          google_connected_at?: string | null
          google_refresh_token?: string | null
          id?: string
          name: string
          owner_user_id: string
          payment_provider?: string | null
          payout_account_id?: string | null
          plan?: string
          storage_provider?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_balance?: number
          google_connected_at?: string | null
          google_refresh_token?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          payment_provider?: string | null
          payout_account_id?: string | null
          plan?: string
          storage_provider?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_topup_credit: { Args: { p_slip_id: string }; Returns: undefined }
      create_event_deduct_credit: {
        Args: {
          p_tenant_id: string
          p_name: string
          p_event_date: string | null
          p_tier: string
          p_storage_limit_gb: number
          p_link_active_days: number
          p_data_retention_days: number
          p_credit_cost: number
        }
        Returns: string
      }
      current_tenant_id: { Args: never; Returns: string }
      delete_event_with_refund: {
        Args: { p_event_id: string; p_tenant_id: string }
        Returns: undefined
      }
      is_super_admin: { Args: never; Returns: boolean }
      reject_topup: {
        Args: { p_reason: string; p_slip_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

