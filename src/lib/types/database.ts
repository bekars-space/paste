/**
 * Hand-written mirror of the live schema (supabase/migrations/).
 * Regenerate with:
 *   bunx supabase gen types typescript --project-id <ref> --schema public \
 *     > src/lib/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      pastes: {
        Row: {
          id: string;
          content: string | null;
          storage_path: string | null;
          size_bytes: number;
          created_at: string;
          expires_at: string;
          ip_hash: string;
        };
        Insert: {
          id: string;
          content?: string | null;
          storage_path?: string | null;
          size_bytes: number;
          created_at?: string;
          expires_at: string;
          ip_hash: string;
        };
        Update: {
          id?: string;
          content?: string | null;
          storage_path?: string | null;
          size_bytes?: number;
          created_at?: string;
          expires_at?: string;
          ip_hash?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          ip_hash: string;
          window_start: string;
          bytes_used: number;
        };
        Insert: {
          ip_hash: string;
          window_start: string;
          bytes_used?: number;
        };
        Update: {
          ip_hash?: string;
          window_start?: string;
          bytes_used?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_rate_budget: {
        Args: {
          p_ip_hash: string;
          p_request_bytes: number;
          p_budget: number;
          p_window: string;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type PasteRow = Database["public"]["Tables"]["pastes"]["Row"];
export type PasteInsert = Database["public"]["Tables"]["pastes"]["Insert"];
