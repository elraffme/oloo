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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ar_sessions: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          participants: Json | null
          session_data: Json | null
          space_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          participants?: Json | null
          session_data?: Json | null
          space_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          participants?: Json | null
          session_data?: Json | null
          space_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coin_packages: {
        Row: {
          active: boolean | null
          best_value: boolean | null
          bonus_coins: number | null
          coin_amount: number
          created_at: string | null
          currency: string | null
          display_order: number | null
          id: number
          name: string
          popular: boolean | null
          price_cents: number
        }
        Insert: {
          active?: boolean | null
          best_value?: boolean | null
          bonus_coins?: number | null
          coin_amount: number
          created_at?: string | null
          currency?: string | null
          display_order?: number | null
          id?: number
          name: string
          popular?: boolean | null
          price_cents: number
        }
        Update: {
          active?: boolean | null
          best_value?: boolean | null
          bonus_coins?: number | null
          coin_amount?: number
          created_at?: string | null
          currency?: string | null
          display_order?: number | null
          id?: number
          name?: string
          popular?: boolean | null
          price_cents?: number
        }
        Relationships: []
      }
      currency_balances: {
        Row: {
          coin_balance: number | null
          created_at: string | null
          gold_balance: number | null
          id: string
          lifetime_coins_purchased: number | null
          lifetime_coins_spent: number | null
          lifetime_gifts_received: number | null
          lifetime_gifts_sent: number | null
          updated_at: string | null
          user_id: string
          vip_tier: string | null
        }
        Insert: {
          coin_balance?: number | null
          created_at?: string | null
          gold_balance?: number | null
          id?: string
          lifetime_coins_purchased?: number | null
          lifetime_coins_spent?: number | null
          lifetime_gifts_received?: number | null
          lifetime_gifts_sent?: number | null
          updated_at?: string | null
          user_id: string
          vip_tier?: string | null
        }
        Update: {
          coin_balance?: number | null
          created_at?: string | null
          gold_balance?: number | null
          id?: string
          lifetime_coins_purchased?: number | null
          lifetime_coins_spent?: number | null
          lifetime_gifts_received?: number | null
          lifetime_gifts_sent?: number | null
          updated_at?: string | null
          user_id?: string
          vip_tier?: string | null
        }
        Relationships: []
      }
      currency_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          currency_type: string
          id: string
          metadata: Json | null
          reason: string | null
          reference_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          currency_type: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          reference_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          currency_type?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          reference_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      demo_profiles: {
        Row: {
          age: number
          bio: string | null
          created_at: string
          display_name: string
          education: string | null
          height_cm: number | null
          id: string
          interests: string[] | null
          languages: string[] | null
          location: string
          occupation: string | null
          profile_photos: string[] | null
          prompt_responses: Json | null
          relationship_goals: string | null
        }
        Insert: {
          age: number
          bio?: string | null
          created_at?: string
          display_name: string
          education?: string | null
          height_cm?: number | null
          id?: string
          interests?: string[] | null
          languages?: string[] | null
          location: string
          occupation?: string | null
          profile_photos?: string[] | null
          prompt_responses?: Json | null
          relationship_goals?: string | null
        }
        Update: {
          age?: number
          bio?: string | null
          created_at?: string
          display_name?: string
          education?: string | null
          height_cm?: number | null
          id?: string
          interests?: string[] | null
          languages?: string[] | null
          location?: string
          occupation?: string | null
          profile_photos?: string[] | null
          prompt_responses?: Json | null
          relationship_goals?: string | null
        }
        Relationships: []
      }
      face_verifications: {
        Row: {
          created_at: string
          id: string
          provider: string | null
          provider_job_id: string | null
          score: number | null
          status: string
          updated_at: string
          user_id: string | null
          verification_data: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          provider?: string | null
          provider_job_id?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
          verification_data?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string | null
          provider_job_id?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
          verification_data?: Json | null
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          coin_cost: number
          created_at: string | null
          expires_at: string | null
          gift_id: number
          id: string
          message: string | null
          metadata: Json | null
          opened_at: string | null
          receiver_id: string
          sender_id: string
          status: string | null
        }
        Insert: {
          coin_cost: number
          created_at?: string | null
          expires_at?: string | null
          gift_id: number
          id?: string
          message?: string | null
          metadata?: Json | null
          opened_at?: string | null
          receiver_id: string
          sender_id: string
          status?: string | null
        }
        Update: {
          coin_cost?: number
          created_at?: string | null
          expires_at?: string | null
          gift_id?: number
          id?: string
          message?: string | null
          metadata?: Json | null
          opened_at?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          animation_url: string | null
          asset_url: string | null
          available_until: string | null
          category: string | null
          cost_tokens: number
          created_at: string
          description: string | null
          id: number
          limited_edition: boolean | null
          name: string
          purchased_count: number | null
          rarity: string | null
          sound_url: string | null
        }
        Insert: {
          animation_url?: string | null
          asset_url?: string | null
          available_until?: string | null
          category?: string | null
          cost_tokens: number
          created_at?: string
          description?: string | null
          id?: number
          limited_edition?: boolean | null
          name: string
          purchased_count?: number | null
          rarity?: string | null
          sound_url?: string | null
        }
        Update: {
          animation_url?: string | null
          asset_url?: string | null
          available_until?: string | null
          category?: string | null
          cost_tokens?: number
          created_at?: string
          description?: string | null
          id?: number
          limited_edition?: boolean | null
          name?: string
          purchased_count?: number | null
          rarity?: string | null
          sound_url?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          expires_at: string | null
          features: Json | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          features?: Json | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          features?: Json | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          message_type: string | null
          metadata: Json | null
          read_at: string | null
          receiver_id: string | null
          sender_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          read_at?: string | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          read_at?: string | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Relationships: []
      }
      otp_attempts: {
        Row: {
          attempt_count: number
          blocked_until: string | null
          created_at: string
          id: string
          last_attempt_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_audit_log: {
        Row: {
          amount_cents: number | null
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_status: string | null
          old_status: string | null
          operation_type: string
          payment_intent_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          operation_type: string
          payment_intent_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          operation_type?: string
          payment_intent_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          access_restricted_until: string | null
          amount_cents: number
          created_at: string
          currency: string
          customer_id: string
          data_classification: string | null
          encrypted_amount_hash: string | null
          encrypted_customer_id: string | null
          id: string
          security_flags: Json | null
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_restricted_until?: string | null
          amount_cents: number
          created_at?: string
          currency?: string
          customer_id: string
          data_classification?: string | null
          encrypted_amount_hash?: string | null
          encrypted_customer_id?: string | null
          id: string
          security_flags?: Json | null
          status?: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_restricted_until?: string | null
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_id?: string
          data_classification?: string | null
          encrypted_amount_hash?: string | null
          encrypted_customer_id?: string | null
          id?: string
          security_flags?: Json | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number
          allow_messages: boolean | null
          ar_avatar_url: string | null
          ar_model_data: Json | null
          avatar_url: string | null
          bio: string
          created_at: string
          display_name: string
          education: string | null
          gender: string | null
          have_kids: boolean | null
          height_cm: number | null
          id: string
          interests: string[] | null
          is_demo_profile: boolean | null
          languages: string[] | null
          location: string
          main_profile_photo_index: number | null
          membership_tier: string | null
          notify_matches: boolean | null
          notify_messages: boolean | null
          notify_streams: boolean | null
          occupation: string | null
          open_to_kids: boolean | null
          profile_photos: string[] | null
          prompt_responses: Json | null
          relationship_goals: string | null
          show_online_status: boolean | null
          show_profile: boolean | null
          subscription_tier: string | null
          updated_at: string
          user_id: string
          verified: boolean | null
          want_kids: boolean | null
        }
        Insert: {
          age: number
          allow_messages?: boolean | null
          ar_avatar_url?: string | null
          ar_model_data?: Json | null
          avatar_url?: string | null
          bio: string
          created_at?: string
          display_name: string
          education?: string | null
          gender?: string | null
          have_kids?: boolean | null
          height_cm?: number | null
          id?: string
          interests?: string[] | null
          is_demo_profile?: boolean | null
          languages?: string[] | null
          location: string
          main_profile_photo_index?: number | null
          membership_tier?: string | null
          notify_matches?: boolean | null
          notify_messages?: boolean | null
          notify_streams?: boolean | null
          occupation?: string | null
          open_to_kids?: boolean | null
          profile_photos?: string[] | null
          prompt_responses?: Json | null
          relationship_goals?: string | null
          show_online_status?: boolean | null
          show_profile?: boolean | null
          subscription_tier?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
          want_kids?: boolean | null
        }
        Update: {
          age?: number
          allow_messages?: boolean | null
          ar_avatar_url?: string | null
          ar_model_data?: Json | null
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          education?: string | null
          gender?: string | null
          have_kids?: boolean | null
          height_cm?: number | null
          id?: string
          interests?: string[] | null
          is_demo_profile?: boolean | null
          languages?: string[] | null
          location?: string
          main_profile_photo_index?: number | null
          membership_tier?: string | null
          notify_matches?: boolean | null
          notify_messages?: boolean | null
          notify_streams?: boolean | null
          occupation?: string | null
          open_to_kids?: boolean | null
          profile_photos?: string[] | null
          prompt_responses?: Json | null
          relationship_goals?: string | null
          show_online_status?: boolean | null
          show_profile?: boolean | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
          want_kids?: boolean | null
        }
        Relationships: []
      }
      rate_limit_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      streaming_analytics: {
        Row: {
          created_at: string | null
          ended_at: string | null
          host_user_id: string | null
          id: string
          original_session_id: string
          peak_viewers: number | null
          started_at: string | null
          title: string | null
          total_duration_minutes: number | null
          total_viewers: number | null
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          host_user_id?: string | null
          id?: string
          original_session_id: string
          peak_viewers?: number | null
          started_at?: string | null
          title?: string | null
          total_duration_minutes?: number | null
          total_viewers?: number | null
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          host_user_id?: string | null
          id?: string
          original_session_id?: string
          peak_viewers?: number | null
          started_at?: string | null
          title?: string | null
          total_duration_minutes?: number | null
          total_viewers?: number | null
        }
        Relationships: []
      }
      streaming_sessions: {
        Row: {
          ar_space_data: Json | null
          created_at: string
          current_viewers: number | null
          description: string | null
          ended_at: string | null
          host_user_id: string | null
          id: string
          is_private: boolean | null
          max_viewers: number | null
          started_at: string | null
          status: string
          stream_key: string | null
          stream_url: string | null
          title: string
        }
        Insert: {
          ar_space_data?: Json | null
          created_at?: string
          current_viewers?: number | null
          description?: string | null
          ended_at?: string | null
          host_user_id?: string | null
          id?: string
          is_private?: boolean | null
          max_viewers?: number | null
          started_at?: string | null
          status?: string
          stream_key?: string | null
          stream_url?: string | null
          title: string
        }
        Update: {
          ar_space_data?: Json | null
          created_at?: string
          current_viewers?: number | null
          description?: string | null
          ended_at?: string | null
          host_user_id?: string | null
          id?: string
          is_private?: boolean | null
          max_viewers?: number | null
          started_at?: string | null
          status?: string
          stream_key?: string | null
          stream_url?: string | null
          title?: string
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          balance: number
          created_at: string
          delta: number
          id: string
          metadata: Json | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          delta: number
          id?: string
          metadata?: Json | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_connections: {
        Row: {
          ar_interaction_data: Json | null
          connected_user_id: string | null
          connection_type: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          ar_interaction_data?: Json | null
          connected_user_id?: string | null
          connection_type: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          ar_interaction_data?: Json | null
          connected_user_id?: string | null
          connection_type?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sensitive_info: {
        Row: {
          access_count: number | null
          created_at: string
          emergency_contact_name_encrypted: string | null
          emergency_contact_phone_encrypted: string | null
          id: string
          last_accessed_at: string | null
          phone_encrypted: string | null
          security_flags: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number | null
          created_at?: string
          emergency_contact_name_encrypted?: string | null
          emergency_contact_phone_encrypted?: string | null
          id?: string
          last_accessed_at?: string | null
          phone_encrypted?: string | null
          security_flags?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number | null
          created_at?: string
          emergency_contact_name_encrypted?: string | null
          emergency_contact_phone_encrypted?: string | null
          id?: string
          last_accessed_at?: string | null
          phone_encrypted?: string | null
          security_flags?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_attempts: {
        Row: {
          attempt_count: number | null
          blocked_until: string | null
          created_at: string | null
          id: string
          last_attempt_at: string | null
          user_id: string
        }
        Insert: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          last_attempt_at?: string | null
          user_id: string
        }
        Update: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          last_attempt_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_calls: {
        Row: {
          answered_at: string | null
          call_id: string
          call_type: string
          caller_id: string
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          metadata: Json | null
          receiver_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          answered_at?: string | null
          call_id: string
          call_type: string
          caller_id: string
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          receiver_id: string
          started_at?: string | null
          status: string
        }
        Update: {
          answered_at?: string | null
          call_id?: string
          call_type?: string
          caller_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          receiver_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      video_verification_requests: {
        Row: {
          call_link: string | null
          created_at: string
          id: string
          metadata: Json | null
          requester_id: string
          requester_name: string
          status: string
          target_user_id: string
          updated_at: string
        }
        Insert: {
          call_link?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          requester_id: string
          requester_name: string
          status?: string
          target_user_id: string
          updated_at?: string
        }
        Update: {
          call_link?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          requester_id?: string
          requester_name?: string
          status?: string
          target_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: {
        Args: { requester_user_id: string }
        Returns: Json
      }
      admin_access_biometric_data: {
        Args: { access_reason: string; verification_id: string }
        Returns: Json
      }
      admin_get_verification_data: {
        Args: { admin_reason: string; verification_id: string }
        Returns: Json
      }
      are_users_connected: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      can_user_call: {
        Args: { caller_uuid: string; receiver_uuid: string }
        Returns: boolean
      }
      check_deployment_readiness: { Args: never; Returns: Json }
      check_mutual_match: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
      check_otp_threshold: { Args: { user_uuid: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_action_type: string
          p_max_attempts: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: Json
      }
      check_sensitive_info_rate_limit: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      check_user_can_message: {
        Args: { receiver_uuid: string; sender_uuid: string }
        Returns: boolean
      }
      check_verification_rate_limit: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      cleanup_abandoned_streams: { Args: never; Returns: undefined }
      cleanup_old_streaming_sessions: { Args: never; Returns: undefined }
      cleanup_stale_streams: { Args: never; Returns: undefined }
      convert_gold_to_coins: { Args: { p_gold_amount: number }; Returns: Json }
      create_secure_token_transaction: {
        Args: {
          operation_reason: string
          operation_type?: string
          target_user_id: string
          token_amount: number
        }
        Returns: string
      }
      create_video_call: {
        Args: { p_call_id: string; p_call_type: string; p_receiver_id: string }
        Returns: string
      }
      decrement_stream_viewers: {
        Args: { p_stream_id: string }
        Returns: undefined
      }
      emergency_freeze_user_tokens: {
        Args: { freeze_reason: string; target_user_id: string }
        Returns: boolean
      }
      encrypt_payment_field: {
        Args: { field_type: string; plaintext: string }
        Returns: string
      }
      generate_afrocentric_profiles: {
        Args: { batch_size?: number }
        Returns: number
      }
      get_anonymized_ride_data: { Args: { ride_id: string }; Returns: Json }
      get_available_drivers: {
        Args: never
        Returns: {
          driver_avatar: string
          driver_name: string
          id: string
          location_info: Json
          rating: number
          total_rides: number
          vehicle_color: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year: number
        }[]
      }
      get_available_drivers_safe: {
        Args: never
        Returns: {
          driver_avatar: string
          driver_name: string
          id: string
          location_info: Json
          rating: number
          total_rides: number
          vehicle_color: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year: number
        }[]
      }
      get_demo_profiles_paginated: {
        Args: { page_offset?: number; page_size?: number }
        Returns: {
          age: number
          bio: string | null
          created_at: string
          display_name: string
          education: string | null
          height_cm: number | null
          id: string
          interests: string[] | null
          languages: string[] | null
          location: string
          occupation: string | null
          profile_photos: string[] | null
          prompt_responses: Json | null
          relationship_goals: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "demo_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_discovery_profile: {
        Args: { profile_user_id: string }
        Returns: Json
      }
      get_discovery_profile_preview: {
        Args: { profile_user_id: string }
        Returns: Json
      }
      get_encryption_key: { Args: never; Returns: string }
      get_friend_requests: {
        Args: { target_user_id?: string }
        Returns: {
          avatar_url: string
          display_name: string
          profile_photos: string[]
          request_date: string
          requester_user_id: string
        }[]
      }
      get_full_profile: {
        Args: { profile_user_id: string; requesting_user_id?: string }
        Returns: Json
      }
      get_or_create_currency_balance: {
        Args: { p_user_id: string }
        Returns: {
          coin_balance: number | null
          created_at: string | null
          gold_balance: number | null
          id: string
          lifetime_coins_purchased: number | null
          lifetime_coins_spent: number | null
          lifetime_gifts_received: number | null
          lifetime_gifts_sent: number | null
          updated_at: string | null
          user_id: string
          vip_tier: string | null
        }
        SetofOptions: {
          from: "*"
          to: "currency_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_profile_data: {
        Args: { profile_user_id: string }
        Returns: Json
      }
      get_public_streams: {
        Args: never
        Returns: {
          ar_space_data: Json
          created_at: string
          current_viewers: number
          description: string
          host_user_id: string
          id: string
          max_viewers: number
          started_at: string
          status: string
          title: string
        }[]
      }
      get_ride_summaries: {
        Args: never
        Returns: {
          created_at: string
          duration_tier: string
          id: string
          price_tier: string
          ride_type: string
          status: string
        }[]
      }
      get_safe_profile_fields: {
        Args: { profile_row: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: Json
      }
      get_safe_streaming_data: {
        Args: never
        Returns: {
          ar_space_data: Json
          created_at: string
          current_viewers: number
          description: string
          host_user_id: string
          id: string
          max_viewers: number
          started_at: string
          status: string
          title: string
        }[]
      }
      get_secure_ride_details: { Args: { ride_id: string }; Returns: Json }
      get_secure_verification_status: {
        Args: { target_user_id?: string }
        Returns: Json
      }
      get_user_friends: {
        Args: { target_user_id?: string }
        Returns: {
          avatar_url: string
          display_name: string
          friend_since: string
          friend_user_id: string
          profile_photos: string[]
        }[]
      }
      get_user_matches: {
        Args: { target_user_id?: string }
        Returns: {
          avatar_url: string
          display_name: string
          match_created_at: string
          match_user_id: string
          profile_photos: string[]
        }[]
      }
      get_user_membership_status: {
        Args: { target_user_id?: string }
        Returns: Json
      }
      get_user_membership_tier: {
        Args: { target_user_id?: string }
        Returns: string
      }
      get_user_sensitive_info: { Args: never; Returns: Json }
      get_user_streams: {
        Args: { target_user_id?: string }
        Returns: {
          ar_space_data: Json
          created_at: string
          current_viewers: number
          description: string
          is_private: boolean
          max_viewers: number
          started_at: string
          status: string
          stream_id: string
          title: string
        }[]
      }
      get_user_token_balance: {
        Args: { target_user_id?: string }
        Returns: number
      }
      get_user_verification_status: {
        Args: { target_user_id?: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_stream_viewers: {
        Args: { p_stream_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      log_membership_access: {
        Args: { action_type: string; target_user_id: string }
        Returns: undefined
      }
      log_payment_security_event: {
        Args: {
          p_details?: Json
          p_operation: string
          p_payment_intent_id: string
          p_user_id?: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type?: string
        }
        Returns: undefined
      }
      log_sensitive_info_access:
        | {
            Args: {
              action_type: string
              field_name: string
              target_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              access_type: string
              additional_metadata?: Json
              field_accessed: string
              user_uuid?: string
            }
            Returns: undefined
          }
      log_system_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      make_user_admin: { Args: { target_email: string }; Returns: boolean }
      open_gift: { Args: { p_transaction_id: string }; Returns: Json }
      purchase_coins: {
        Args: { p_package_id: number; p_payment_intent_id: string }
        Returns: Json
      }
      record_rate_limit_action: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: undefined
      }
      reject_friend_request: {
        Args: { requester_user_id: string }
        Returns: Json
      }
      secure_payment_operation: {
        Args: {
          operation_type: string
          payment_data?: Json
          payment_intent_id?: string
        }
        Returns: Json
      }
      send_friend_request: { Args: { target_user_id: string }; Returns: Json }
      send_gift: {
        Args: { p_gift_id: number; p_message?: string; p_receiver_id: string }
        Returns: Json
      }
      update_profile_verification_status: {
        Args: { is_verified: boolean; target_user_id: string }
        Returns: boolean
      }
      update_user_sensitive_info: {
        Args: {
          new_emergency_contact_name?: string
          new_emergency_contact_phone?: string
          new_phone?: string
        }
        Returns: Json
      }
      validate_membership_operation: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      validate_payment_access: {
        Args: { p_operation_type?: string; p_payment_intent_id: string }
        Returns: boolean
      }
      validate_payment_amount: {
        Args: { amount_cents: number; tier: string }
        Returns: boolean
      }
      validate_ride_access: {
        Args: { access_type: string; ride_id: string }
        Returns: boolean
      }
      validate_sensitive_field: {
        Args: {
          encrypted_data: string
          field_type: string
          plaintext_data: string
          user_uuid?: string
        }
        Returns: boolean
      }
      validate_token_operation: {
        Args: {
          operation_reason?: string
          operation_type: string
          target_user_id: string
          token_delta: number
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
