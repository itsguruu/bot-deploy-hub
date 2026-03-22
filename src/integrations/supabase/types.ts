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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      deployments: {
        Row: {
          created_at: string
          heroku_app_name: string | null
          heroku_key_id: string | null
          id: string
          logs: string[] | null
          name: string
          session_id: string
          status: Database["public"]["Enums"]["deployment_status"]
          updated_at: string
          uptime_start: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          heroku_app_name?: string | null
          heroku_key_id?: string | null
          id?: string
          logs?: string[] | null
          name: string
          session_id: string
          status?: Database["public"]["Enums"]["deployment_status"]
          updated_at?: string
          uptime_start?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          heroku_app_name?: string | null
          heroku_key_id?: string | null
          id?: string
          logs?: string[] | null
          name?: string
          session_id?: string
          status?: Database["public"]["Enums"]["deployment_status"]
          updated_at?: string
          uptime_start?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_heroku_key_id_fkey"
            columns: ["heroku_key_id"]
            isOneToOne: false
            referencedRelation: "heroku_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      heroku_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_global: boolean
          team_or_personal: string
          user_id: string | null
          valid: boolean
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_global?: boolean
          team_or_personal?: string
          user_id?: string | null
          valid?: boolean
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_global?: boolean
          team_or_personal?: string
          user_id?: string | null
          valid?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          email: string
          id: string
          screenshot_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          email: string
          id?: string
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          email?: string
          id?: string
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_stats: {
        Row: {
          failed_bots: number
          id: string
          running_bots: number
          total_bots: number
          total_requests: number
          total_users: number
          updated_at: string
        }
        Insert: {
          failed_bots?: number
          id?: string
          running_bots?: number
          total_bots?: number
          total_requests?: number
          total_users?: number
          updated_at?: string
        }
        Update: {
          failed_bots?: number
          id?: string
          running_bots?: number
          total_bots?: number
          total_requests?: number
          total_users?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          display_name: string | null
          email: string
          free_deploys_used: number
          id: string
          restricted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          display_name?: string | null
          email: string
          free_deploys_used?: number
          id?: string
          restricted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          display_name?: string | null
          email?: string
          free_deploys_used?: number
          id?: string
          restricted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      deployment_status:
        | "running"
        | "stopped"
        | "pending"
        | "deploying"
        | "failed"
      payment_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "user"],
      deployment_status: [
        "running",
        "stopped",
        "pending",
        "deploying",
        "failed",
      ],
      payment_status: ["pending", "approved", "rejected"],
    },
  },
} as const
