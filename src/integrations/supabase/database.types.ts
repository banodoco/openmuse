
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
          admin_approved?: string | null
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
          admin_approved?: string | null
          lora_type?: string | null
          lora_base_model?: string | null
          lora_link?: string | null
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
    }
  }
}
