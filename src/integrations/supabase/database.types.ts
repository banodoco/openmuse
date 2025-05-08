// This is a simplified type definition for the Database
// It can be expanded as needed for specific table types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      api_keys: {
        Row: {
          id: string
          user_id: string
          service: string
          key_value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          service: string
          key_value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          service?: string
          key_value?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      media: {
        Row: {
          id: string
          title: string
          url: string
          type: string
          creator?: string | null
          classification?: string | null
          user_id?: string | null
          created_at: string
          admin_status?: string | null
          user_status?: string | null
          description?: string | null
          admin_reviewed: boolean
        }
      }
      assets: {
        Row: {
          id: string
          name: string
          type: string
          description?: string | null
          creator?: string | null
          primary_media_id?: string | null
          user_id?: string | null
          created_at: string
          admin_status?: string | null
          user_status?: string | null
          lora_type?: string | null
          lora_base_model?: string | null
          lora_link?: string | null
          admin_reviewed: boolean
        }
      }
      asset_media: {
        Row: {
          id: string
          asset_id: string
          media_id: string
          created_at: string
        }
      }
      profiles: {
        Row: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          created_at: string
          video_upload_consent?: boolean | null
          discord_user_id?: string | null
          discord_username?: string | null
        }
      }
    }
    Functions: {
      debug_asset_media: {
        Args: {
          asset_id: string
        }
        Returns: {
          id: string
          asset_id: string
          media_id: string
          created_at: string
        }[]
      }
      debug_get_all_assets: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
  }
}
