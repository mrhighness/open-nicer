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
      chats: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_duration: number | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          chat_id: string
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          attachment_duration?: number | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          chat_id: string
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          attachment_duration?: number | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_incoming_messages: boolean
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          claim_token: string | null
          created_at: string
          discoverable: boolean
          id: string
          invited_by: string | null
          is_online: boolean
          last_seen: string
          show_online_status: boolean
          status: string | null
          suspended_at: string | null
          username: string
          retention_public_id: number | null
          retention_enabled_at: string | null
          retention_failed_attempts: number
          retention_lockout_until: string | null
        }
        Insert: {
          allow_incoming_messages?: boolean
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          claim_token?: string | null
          created_at?: string
          discoverable?: boolean
          id?: string
          invited_by?: string | null
          is_online?: boolean
          last_seen?: string
          show_online_status?: boolean
          status?: string | null
          suspended_at?: string | null
          username: string
          retention_public_id?: number | null
          retention_enabled_at?: string | null
          retention_failed_attempts?: number
          retention_lockout_until?: string | null
        }
        Update: {
          allow_incoming_messages?: boolean
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          claim_token?: string | null
          created_at?: string
          discoverable?: boolean
          id?: string
          invited_by?: string | null
          is_online?: boolean
          last_seen?: string
          show_online_status?: boolean
          status?: string | null
          suspended_at?: string | null
          username?: string
          retention_public_id?: number | null
          retention_enabled_at?: string | null
          retention_failed_attempts?: number
          retention_lockout_until?: string | null
        }
        Relationships: []
      }
      status_updates: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          image_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_updates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_views: {
        Row: {
          status_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          status_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          status_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_profile_for_invite: {
        Args: { target_id: string }
        Returns: {
          id: string
          username: string
          avatar_url: string | null
          status: string | null
          bio: string | null
          allow_incoming_messages: boolean
        }[]
      }
      finalize_call_log_for_call: {
        Args: {
          p_chat_id: string
          p_call_id: string
          p_attachment_name: string
          p_content: string
        }
        Returns: number
      }
      is_app_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      admin_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_list_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          username: string
          avatar_url: string | null
          status: string | null
          bio: string | null
          created_at: string
          suspended_at: string | null
          invited_by: string | null
          auth_user_id: string | null
          email: string | null
          user_agent: string | null
          ip: string | null
          country: string | null
          invite_count: number
        }[]
      }
      admin_list_groups: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          title: string | null
          created_at: string
          member_count: number
        }[]
      }
      admin_update_profile: {
        Args: {
          p_id: string
          p_username?: string | null
          p_avatar_url?: string | null
          p_bio?: string | null
        }
        Returns: undefined
      }
      admin_set_suspended: {
        Args: { p_id: string; p_suspend: boolean }
        Returns: undefined
      }
      admin_delete_profiles: {
        Args: { p_ids: string[] }
        Returns: number
      }
      admin_delete_groups: {
        Args: { p_ids: string[] }
        Returns: number
      }
      record_signup_client_info: {
        Args: {
          p_user_agent: string
          p_ip?: string | null
          p_country?: string | null
        }
        Returns: undefined
      }
      retention_bootstrap_my_code: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      retention_bootstrap_code_claim: {
        Args: { p_profile_id: string; p_claim_token: string }
        Returns: Json
      }
      retention_activate_pin: {
        Args: { p_pin: string; p_old_pin?: string | null }
        Returns: Json
      }
      retention_activate_pin_claim: {
        Args: {
          p_profile_id: string
          p_claim_token: string
          p_pin: string
          p_old_pin?: string | null
        }
        Returns: Json
      }
      retention_recover_swap: {
        Args: { p_public_id: number; p_pin: string }
        Returns: Json
      }
      retention_recover_claim: {
        Args: { p_public_id: number; p_pin: string }
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
    Enums: {},
  },
} as const
