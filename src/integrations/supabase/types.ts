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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          key_value: string
          service: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_value: string
          service: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key_value?: string
          service?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      asset_media: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          media_id: string
          status: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          media_id: string
          status?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          media_id?: string
          status?: string
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
          admin_reviewed: boolean
          admin_status: string | null
          created_at: string
          creator: string | null
          curator_id: string | null
          description: string | null
          download_link: string | null
          id: string
          lora_base_model: string | null
          lora_link: string | null
          lora_type: string | null
          model_variant: string | null
          name: string
          primary_media_id: string | null
          type: string
          user_id: string | null
          user_status: string | null
        }
        Insert: {
          admin_reviewed?: boolean
          admin_status?: string | null
          created_at?: string
          creator?: string | null
          curator_id?: string | null
          description?: string | null
          download_link?: string | null
          id?: string
          lora_base_model?: string | null
          lora_link?: string | null
          lora_type?: string | null
          model_variant?: string | null
          name: string
          primary_media_id?: string | null
          type: string
          user_id?: string | null
          user_status?: string | null
        }
        Update: {
          admin_reviewed?: boolean
          admin_status?: string | null
          created_at?: string
          creator?: string | null
          curator_id?: string | null
          description?: string | null
          download_link?: string | null
          id?: string
          lora_base_model?: string | null
          lora_link?: string | null
          lora_type?: string | null
          model_variant?: string | null
          name?: string
          primary_media_id?: string | null
          type?: string
          user_id?: string | null
          user_status?: string | null
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
      channel_summary: {
        Row: {
          channel_id: number
          created_at: string | null
          summary_thread_id: number | null
          updated_at: string | null
        }
        Insert: {
          channel_id: number
          created_at?: string | null
          summary_thread_id?: number | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: number
          created_at?: string | null
          summary_thread_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_summary_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "discord_channels"
            referencedColumns: ["channel_id"]
          },
          {
            foreignKeyName: "channel_summary_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "message_stats"
            referencedColumns: ["channel_id"]
          },
        ]
      }
      daily_summaries: {
        Row: {
          channel_id: number
          created_at: string | null
          daily_summary_id: number
          date: string
          dev_mode: boolean | null
          full_summary: string | null
          included_in_main_summary: boolean | null
          short_summary: string | null
        }
        Insert: {
          channel_id: number
          created_at?: string | null
          daily_summary_id?: number
          date: string
          dev_mode?: boolean | null
          full_summary?: string | null
          included_in_main_summary?: boolean | null
          short_summary?: string | null
        }
        Update: {
          channel_id?: number
          created_at?: string | null
          daily_summary_id?: number
          date?: string
          dev_mode?: boolean | null
          full_summary?: string | null
          included_in_main_summary?: boolean | null
          short_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_summaries_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "discord_channels"
            referencedColumns: ["channel_id"]
          },
          {
            foreignKeyName: "daily_summaries_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "message_stats"
            referencedColumns: ["channel_id"]
          },
        ]
      }
      dataset_contents: {
        Row: {
          based_on: string | null
          character_reference: string | null
          created_at: string | null
          dataset_id: number | null
          filename: string
          generation_prompt: string | null
          height: number | null
          id: number
          orientation: string | null
          params: string | null
          prompt: string | null
          review_status: string | null
          reviewed_at: string | null
          scene_reference: string | null
          size_category: string | null
          storage_url: string | null
          style_reference: string | null
          suitable_aspect_ratios: Json | null
          updated_at: string | null
          uploaded_at: string | null
          width: number | null
        }
        Insert: {
          based_on?: string | null
          character_reference?: string | null
          created_at?: string | null
          dataset_id?: number | null
          filename: string
          generation_prompt?: string | null
          height?: number | null
          id?: number
          orientation?: string | null
          params?: string | null
          prompt?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          scene_reference?: string | null
          size_category?: string | null
          storage_url?: string | null
          style_reference?: string | null
          suitable_aspect_ratios?: Json | null
          updated_at?: string | null
          uploaded_at?: string | null
          width?: number | null
        }
        Update: {
          based_on?: string | null
          character_reference?: string | null
          created_at?: string | null
          dataset_id?: number | null
          filename?: string
          generation_prompt?: string | null
          height?: number | null
          id?: number
          orientation?: string | null
          params?: string | null
          prompt?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          scene_reference?: string | null
          size_category?: string | null
          storage_url?: string | null
          style_reference?: string | null
          suitable_aspect_ratios?: Json | null
          updated_at?: string | null
          uploaded_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dataset_contents_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          additional_instructions: string | null
          backup_completed_at: string | null
          backup_error: string | null
          backup_started_at: string | null
          backup_status: string | null
          created_at: string | null
          dataset_type: string | null
          description: string | null
          generation_config: Json | null
          id: number
          license: string | null
          model_name: string | null
          name: string
          preserve_references: Json | null
          source: string | null
          source_dataset_id: number[] | null
          source_url: string | null
          status: string | null
          subject_filter: Json | null
          system_prompt: string | null
          tags: string[] | null
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          additional_instructions?: string | null
          backup_completed_at?: string | null
          backup_error?: string | null
          backup_started_at?: string | null
          backup_status?: string | null
          created_at?: string | null
          dataset_type?: string | null
          description?: string | null
          generation_config?: Json | null
          id?: number
          license?: string | null
          model_name?: string | null
          name: string
          preserve_references?: Json | null
          source?: string | null
          source_dataset_id?: number[] | null
          source_url?: string | null
          status?: string | null
          subject_filter?: Json | null
          system_prompt?: string | null
          tags?: string[] | null
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          additional_instructions?: string | null
          backup_completed_at?: string | null
          backup_error?: string | null
          backup_started_at?: string | null
          backup_status?: string | null
          created_at?: string | null
          dataset_type?: string | null
          description?: string | null
          generation_config?: Json | null
          id?: number
          license?: string | null
          model_name?: string | null
          name?: string
          preserve_references?: Json | null
          source?: string | null
          source_dataset_id?: number[] | null
          source_url?: string | null
          status?: string | null
          subject_filter?: Json | null
          system_prompt?: string | null
          tags?: string[] | null
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      discord_channels: {
        Row: {
          category_id: number | null
          channel_id: number
          channel_name: string
          description: string | null
          enriched: boolean | null
          nsfw: boolean | null
          rules: string | null
          setup_complete: boolean | null
          suitable_posts: string | null
          synced_at: string | null
          unsuitable_posts: string | null
        }
        Insert: {
          category_id?: number | null
          channel_id: number
          channel_name: string
          description?: string | null
          enriched?: boolean | null
          nsfw?: boolean | null
          rules?: string | null
          setup_complete?: boolean | null
          suitable_posts?: string | null
          synced_at?: string | null
          unsuitable_posts?: string | null
        }
        Update: {
          category_id?: number | null
          channel_id?: number
          channel_name?: string
          description?: string | null
          enriched?: boolean | null
          nsfw?: boolean | null
          rules?: string | null
          setup_complete?: boolean | null
          suitable_posts?: string | null
          synced_at?: string | null
          unsuitable_posts?: string | null
        }
        Relationships: []
      }
      discord_members: {
        Row: {
          accent_color: number | null
          avatar_url: string | null
          banner_url: string | null
          bot: boolean | null
          created_at: string | null
          discord_created_at: string | null
          discriminator: string | null
          dm_preference: boolean | null
          global_name: string | null
          guild_join_date: string | null
          instagram_handle: string | null
          member_id: number
          permission_to_curate: boolean | null
          role_ids: Json | null
          server_nick: string | null
          sharing_consent: boolean | null
          synced_at: string | null
          system: boolean | null
          tiktok_handle: string | null
          twitter_handle: string | null
          updated_at: string | null
          username: string
          website: string | null
          youtube_handle: string | null
        }
        Insert: {
          accent_color?: number | null
          avatar_url?: string | null
          banner_url?: string | null
          bot?: boolean | null
          created_at?: string | null
          discord_created_at?: string | null
          discriminator?: string | null
          dm_preference?: boolean | null
          global_name?: string | null
          guild_join_date?: string | null
          instagram_handle?: string | null
          member_id: number
          permission_to_curate?: boolean | null
          role_ids?: Json | null
          server_nick?: string | null
          sharing_consent?: boolean | null
          synced_at?: string | null
          system?: boolean | null
          tiktok_handle?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          username: string
          website?: string | null
          youtube_handle?: string | null
        }
        Update: {
          accent_color?: number | null
          avatar_url?: string | null
          banner_url?: string | null
          bot?: boolean | null
          created_at?: string | null
          discord_created_at?: string | null
          discriminator?: string | null
          dm_preference?: boolean | null
          global_name?: string | null
          guild_join_date?: string | null
          instagram_handle?: string | null
          member_id?: number
          permission_to_curate?: boolean | null
          role_ids?: Json | null
          server_nick?: string | null
          sharing_consent?: boolean | null
          synced_at?: string | null
          system?: boolean | null
          tiktok_handle?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          username?: string
          website?: string | null
          youtube_handle?: string | null
        }
        Relationships: []
      }
      discord_messages: {
        Row: {
          attachments: Json | null
          author_id: number
          channel_id: number
          content: string | null
          created_at: string
          edited_at: string | null
          embeds: Json | null
          flags: number | null
          indexed_at: string | null
          is_deleted: boolean | null
          is_pinned: boolean | null
          message_id: number
          message_type: string | null
          reaction_count: number | null
          reactors: Json | null
          reference_id: number | null
          synced_at: string | null
          thread_id: number | null
        }
        Insert: {
          attachments?: Json | null
          author_id: number
          channel_id: number
          content?: string | null
          created_at: string
          edited_at?: string | null
          embeds?: Json | null
          flags?: number | null
          indexed_at?: string | null
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          message_id: number
          message_type?: string | null
          reaction_count?: number | null
          reactors?: Json | null
          reference_id?: number | null
          synced_at?: string | null
          thread_id?: number | null
        }
        Update: {
          attachments?: Json | null
          author_id?: number
          channel_id?: number
          content?: string | null
          created_at?: string
          edited_at?: string | null
          embeds?: Json | null
          flags?: number | null
          indexed_at?: string | null
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          message_id?: number
          message_type?: string | null
          reaction_count?: number | null
          reactors?: Json | null
          reference_id?: number | null
          synced_at?: string | null
          thread_id?: number | null
        }
        Relationships: []
      }
      generation_tasks: {
        Row: {
          additional_instructions: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          current_item: string | null
          dataset_id: number
          error_message: string | null
          id: number
          items_processed: number | null
          max_items: number
          model_name: string | null
          preserve_references: Json | null
          priority: number | null
          progress_percentage: number | null
          result_summary: Json | null
          source_dataset_id: number[] | null
          started_at: string | null
          status: string
          subject_filter: Json | null
          system_prompt: string | null
          worker_id: string | null
          worker_last_heartbeat: string | null
          worker_started_at: string | null
        }
        Insert: {
          additional_instructions?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_item?: string | null
          dataset_id: number
          error_message?: string | null
          id?: number
          items_processed?: number | null
          max_items: number
          model_name?: string | null
          preserve_references?: Json | null
          priority?: number | null
          progress_percentage?: number | null
          result_summary?: Json | null
          source_dataset_id?: number[] | null
          started_at?: string | null
          status?: string
          subject_filter?: Json | null
          system_prompt?: string | null
          worker_id?: string | null
          worker_last_heartbeat?: string | null
          worker_started_at?: string | null
        }
        Update: {
          additional_instructions?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_item?: string | null
          dataset_id?: number
          error_message?: string | null
          id?: number
          items_processed?: number | null
          max_items?: number
          model_name?: string | null
          preserve_references?: Json | null
          priority?: number | null
          progress_percentage?: number | null
          result_summary?: Json | null
          source_dataset_id?: number[] | null
          started_at?: string | null
          status?: string
          subject_filter?: Json | null
          system_prompt?: string | null
          worker_id?: string | null
          worker_last_heartbeat?: string | null
          worker_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_tasks_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          admin_reviewed: boolean
          admin_status: string | null
          backup_thumbnail_url: string | null
          backup_url: string | null
          classification: string | null
          cloudflare_playback_dash_url: string | null
          cloudflare_playback_hls_url: string | null
          cloudflare_stream_uid: string | null
          cloudflare_thumbnail_url: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          placeholder_image: string | null
          storage_provider: string | null
          title: string | null
          type: string
          updated_at: string | null
          url: string
          user_id: string | null
          user_status: string | null
        }
        Insert: {
          admin_reviewed?: boolean
          admin_status?: string | null
          backup_thumbnail_url?: string | null
          backup_url?: string | null
          classification?: string | null
          cloudflare_playback_dash_url?: string | null
          cloudflare_playback_hls_url?: string | null
          cloudflare_stream_uid?: string | null
          cloudflare_thumbnail_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          placeholder_image?: string | null
          storage_provider?: string | null
          title?: string | null
          type: string
          updated_at?: string | null
          url: string
          user_id?: string | null
          user_status?: string | null
        }
        Update: {
          admin_reviewed?: boolean
          admin_status?: string | null
          backup_thumbnail_url?: string | null
          backup_url?: string | null
          classification?: string | null
          cloudflare_playback_dash_url?: string | null
          cloudflare_playback_hls_url?: string | null
          cloudflare_stream_uid?: string | null
          cloudflare_thumbnail_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          placeholder_image?: string | null
          storage_provider?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
          url?: string
          user_id?: string | null
          user_status?: string | null
        }
        Relationships: []
      }
      models: {
        Row: {
          created_at: string
          default_variant: string | null
          display_name: string
          id: string
          internal_identifier: string
          is_active: boolean
          sort_order: number | null
          variants: Json
        }
        Insert: {
          created_at?: string
          default_variant?: string | null
          display_name: string
          id?: string
          internal_identifier: string
          is_active?: boolean
          sort_order?: number | null
          variants?: Json
        }
        Update: {
          created_at?: string
          default_variant?: string | null
          display_name?: string
          id?: string
          internal_identifier?: string
          is_active?: boolean
          sort_order?: number | null
          variants?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          background_image_url: string | null
          created_at: string
          description: string | null
          discord_connected: boolean | null
          discord_user_id: string | null
          discord_username: string | null
          display_name: string | null
          id: string
          links: string[] | null
          real_name: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          background_image_url?: string | null
          created_at?: string
          description?: string | null
          discord_connected?: boolean | null
          discord_user_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          id?: string
          links?: string[] | null
          real_name?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          background_image_url?: string | null
          created_at?: string
          description?: string | null
          discord_connected?: boolean | null
          discord_user_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          id?: string
          links?: string[] | null
          real_name?: string | null
          username?: string
        }
        Relationships: []
      }
      sync_status: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: number
          last_sync_timestamp: string | null
          records_synced: number | null
          sync_status: string | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: number
          last_sync_timestamp?: string | null
          records_synced?: number | null
          sync_status?: string | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: number
          last_sync_timestamp?: string | null
          records_synced?: number | null
          sync_status?: string | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string | null
          exception: string | null
          extra: Json | null
          function_name: string | null
          hostname: string | null
          id: number
          level: string
          line_number: number | null
          logger_name: string
          message: string
          module: string | null
          timestamp: string
        }
        Insert: {
          created_at?: string | null
          exception?: string | null
          extra?: Json | null
          function_name?: string | null
          hostname?: string | null
          id?: number
          level: string
          line_number?: number | null
          logger_name: string
          message: string
          module?: string | null
          timestamp?: string
        }
        Update: {
          created_at?: string | null
          exception?: string | null
          extra?: Json | null
          function_name?: string | null
          hostname?: string | null
          id?: number
          level?: string
          line_number?: number | null
          logger_name?: string
          message?: string
          module?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      training_run_data: {
        Row: {
          created_at: string | null
          id: number
          image_transformation_instruction: string | null
          input_images: Json | null
          output_image_url: string | null
          review_status: string | null
          reviewed_at: string | null
          source_content_ids: number[] | null
          source_dataset_id: number | null
          source_type: string | null
          tags: string[] | null
          training_prompt: string | null
          training_run_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          image_transformation_instruction?: string | null
          input_images?: Json | null
          output_image_url?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          source_content_ids?: number[] | null
          source_dataset_id?: number | null
          source_type?: string | null
          tags?: string[] | null
          training_prompt?: string | null
          training_run_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          image_transformation_instruction?: string | null
          input_images?: Json | null
          output_image_url?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          source_content_ids?: number[] | null
          source_dataset_id?: number | null
          source_type?: string | null
          tags?: string[] | null
          training_prompt?: string | null
          training_run_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_run_data_source_dataset_id_fkey"
            columns: ["source_dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_run_data_training_run_id_fkey"
            columns: ["training_run_id"]
            isOneToOne: false
            referencedRelation: "training_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: number
          metrics: Json | null
          model_base: string | null
          name: string
          notes: string | null
          output_model_path: string | null
          params: Json | null
          started_at: string | null
          status: string | null
          tags: string[] | null
          total_samples: number | null
          training_type: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          metrics?: Json | null
          model_base?: string | null
          name: string
          notes?: string | null
          output_model_path?: string | null
          params?: Json | null
          started_at?: string | null
          status?: string | null
          tags?: string[] | null
          total_samples?: number | null
          training_type?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          metrics?: Json | null
          model_base?: string | null
          name?: string
          notes?: string | null
          output_model_path?: string | null
          params?: Json | null
          started_at?: string | null
          status?: string | null
          tags?: string[] | null
          total_samples?: number | null
          training_type?: string | null
          updated_at?: string | null
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
      log_stats: {
        Row: {
          count: number | null
          hour: string | null
          level: string | null
        }
        Relationships: []
      }
      message_stats: {
        Row: {
          channel_id: number | null
          channel_name: string | null
          first_message_at: string | null
          last_message_at: string | null
          message_count: number | null
          unique_authors: number | null
        }
        Relationships: []
      }
      recent_errors: {
        Row: {
          exception: string | null
          function_name: string | null
          id: number | null
          level: string | null
          logger_name: string | null
          message: string | null
          module: string | null
          timestamp: string | null
        }
        Insert: {
          exception?: string | null
          function_name?: string | null
          id?: number | null
          level?: string | null
          logger_name?: string | null
          message?: string | null
          module?: string | null
          timestamp?: string | null
        }
        Update: {
          exception?: string | null
          function_name?: string | null
          id?: number | null
          level?: string | null
          logger_name?: string | null
          message?: string | null
          module?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      recent_messages: {
        Row: {
          attachments: Json | null
          author_id: number | null
          channel_id: number | null
          channel_name: string | null
          content: string | null
          created_at: string | null
          edited_at: string | null
          embeds: Json | null
          flags: number | null
          global_name: string | null
          indexed_at: string | null
          is_deleted: boolean | null
          is_pinned: boolean | null
          message_id: number | null
          message_type: string | null
          reaction_count: number | null
          reactors: Json | null
          reference_id: number | null
          synced_at: string | null
          thread_id: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_logs: { Args: { days_to_keep?: number }; Returns: number }
      cleanup_old_logs_48h: { Args: never; Returns: number }
      debug_asset_media: {
        Args: { asset_id: string }
        Returns: {
          asset_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          media_id: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "asset_media"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      debug_get_all_assets: { Args: never; Returns: Json }
      get_top_community_topics: {
        Args: never
        Returns: {
          channel_id: number
          channel_name: string
          media_count: number
          media_message_ids: string[]
          summary_date: string
          topic_main_text: string
          topic_sub_topics: Json
          topic_title: string
        }[]
      }
      has_role: { Args: { role: string; user_id: string }; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
      set_primary_media: {
        Args: { p_asset_id: string; p_media_id: string }
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
  public: {
    Enums: {},
  },
} as const
