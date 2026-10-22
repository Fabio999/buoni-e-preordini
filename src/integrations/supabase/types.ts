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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_operators: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          user_id?: string
        }
        Relationships: []
      }
      balance_movements: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          client_id: string
          created_at: string
          description: string
          id: string
          operator_name: string
          purchase_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          client_id: string
          created_at?: string
          description?: string
          id?: string
          operator_name?: string
          purchase_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          operator_name?: string
          purchase_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "balance_movements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_movements_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_items: {
        Row: {
          booking_id: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          booking_id: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price: number
        }
        Update: {
          booking_id?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_id: string
          created_at: string
          discount: number
          event_id: string
          id: string
          notes: string
          operator_name: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          client_id: string
          created_at?: string
          discount?: number
          event_id: string
          id?: string
          notes?: string
          operator_name?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          client_id?: string
          created_at?: string
          discount?: number
          event_id?: string
          id?: string
          notes?: string
          operator_name?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          category: string
          created_at: string
          done: boolean
          event_id: string
          id: string
          label: string
        }
        Insert: {
          category?: string
          created_at?: string
          done?: boolean
          event_id: string
          id?: string
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          done?: boolean
          event_id?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_name: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          event_date: string
          id: string
          location: string
          name: string
          notes: string
          status: Database["public"]["Enums"]["event_status"]
        }
        Insert: {
          created_at?: string
          event_date: string
          id?: string
          location?: string
          name: string
          notes?: string
          status?: Database["public"]["Enums"]["event_status"]
        }
        Update: {
          created_at?: string
          event_date?: string
          id?: string
          location?: string
          name?: string
          notes?: string
          status?: Database["public"]["Enums"]["event_status"]
        }
        Relationships: []
      }
      operator_sessions: {
        Row: {
          operator_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          operator_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          operator_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          game: string
          id: string
          name: string
          price: number
          product_type: string
          sku: string | null
          stock: number
          track_stock: boolean
        }
        Insert: {
          category?: string
          created_at?: string
          game?: string
          id?: string
          name: string
          price?: number
          product_type?: string
          sku?: string | null
          stock?: number
          track_stock?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          game?: string
          id?: string
          name?: string
          price?: number
          product_type?: string
          sku?: string | null
          stock?: number
          track_stock?: boolean
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          notes: string
          operator_name: string
          product_id: string | null
          product_name: string
          purchase_date: string
          quantity: number
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          notes?: string
          operator_name?: string
          product_id?: string | null
          product_name: string
          purchase_date?: string
          quantity?: number
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          notes?: string
          operator_name?: string
          product_id?: string | null
          product_name?: string
          purchase_date?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          booking_id: string | null
          created_at: string
          delta: number
          id: string
          label: string
          operator_name: string
          product_id: string
          purchase_id: string | null
          source: string
          stock_after: number
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          delta: number
          id?: string
          label?: string
          operator_name?: string
          product_id: string
          purchase_id?: string | null
          source: string
          stock_after: number
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          label?: string
          operator_name?: string
          product_id?: string
          purchase_id?: string | null
          source?: string
          stock_after?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      add_balance_movement: {
        Args: {
          _amount: number
          _client: string
          _description: string
          _type: Database["public"]["Enums"]["movement_type"]
        }
        Returns: string
      }
      client_balance: { Args: { _client: string }; Returns: number }
      current_operator: { Args: never; Returns: string }
      delete_balance_movement: { Args: { _id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_stock: {
        Args: {
          _booking: string
          _delta: number
          _label: string
          _product: string
          _purchase: string
          _source: string
        }
        Returns: undefined
      }
      recompute_client_ledger: { Args: { _client: string }; Returns: undefined }
      register_purchase: {
        Args: {
          _amount: number
          _client: string
          _date: string
          _notes: string
          _product: string
          _product_name: string
          _quantity: number
        }
        Returns: string
      }
      register_sale: {
        Args: {
          _amount: number
          _buono_used: number
          _client: string
          _date: string
          _notes: string
          _product: string
          _product_name: string
          _quantity: number
        }
        Returns: string
      }
      update_balance_movement: {
        Args: { _amount: number; _description: string; _id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin"
      booking_status: "da_preparare" | "pronta" | "consegnata" | "annullata"
      event_status: "programmato" | "in_preparazione" | "concluso"
      movement_type: "ricarica" | "acquisto" | "correzione"
      payment_status: "non_pagato" | "pagato"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
      booking_status: ["da_preparare", "pronta", "consegnata", "annullata"],
      event_status: ["programmato", "in_preparazione", "concluso"],
      movement_type: ["ricarica", "acquisto", "correzione"],
      payment_status: ["non_pagato", "pagato"],
    },
  },
} as const
