export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      asset_media: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          media_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          media_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_media_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          admin_approved: string | null
          created_at: string
          creator: string | null
          description: string | null
          id: string
          lora_base_model: string | null
          lora_link: string | null
          lora_type: string | null
          model_variant: string | null
          name: string
          primary_media_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          admin_approved?: string | null
          created_at?: string
          creator?: string | null
          description?: string | null
          id?: string
          lora_base_model?: string | null
          lora_link?: string | null
          lora_type?: string | null
          model_variant?: string | null
          name: string
          primary_media_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          admin_approved?: string | null
          created_at?: string
          creator?: string | null
          description?: string | null
          id?: string
          lora_base_model?: string | null
          lora_link?: string | null
          lora_type?: string | null
          model_variant?: string | null
          name?: string
          primary_media_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_primary_media_id_fkey"
            columns: ["primary_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          admin_approved: string | null
          classification: string | null
          created_at: string
          creator: string | null
          id: string
          model_variant: string | null
          title: string
          type: string
          url: string
          user_id: string | null
        }
        Insert: {
          admin_approved?: string | null
          classification?: string | null
          created_at?: string
          creator?: string | null
          id?: string
          model_variant?: string | null
          title: string
          type: string
          url: string
          user_id?: string | null
        }
        Update: {
          admin_approved?: string | null
          classification?: string | null
          created_at?: string
          creator?: string | null
          id?: string
          model_variant?: string | null
          title?: string
          type?: string
          url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          background_image_url: string | null
          created_at: string
          description: string | null
          display_name: string | null
          id: string
          links: string[] | null
          real_name: string | null
          username: string
          video_upload_consent: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          background_image_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          id: string
          links?: string[] | null
          real_name?: string | null
          username: string
          video_upload_consent?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          background_image_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          links?: string[] | null
          real_name?: string | null
          username?: string
          video_upload_consent?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      debug_asset_media: {
        Args: { asset_id: string }
        Returns: {
          asset_id: string
          created_at: string
          id: string
          media_id: string
        }[]
      }
      debug_get_all_assets: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      has_role: {
        Args: { user_id: string; role: string }
        Returns: boolean
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
