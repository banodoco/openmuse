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
          lora_link: string | null
          lora_type: string | null
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
          lora_link?: string | null
          lora_type?: string | null
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
          lora_link?: string | null
          lora_type?: string | null
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
          created_at: string
          id: string
          username: string
          video_upload_consent: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          username: string
          video_upload_consent?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
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
      debug_get_all_assets: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      has_role: {
        Args: {
          user_id: string
          role: string
        }
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
