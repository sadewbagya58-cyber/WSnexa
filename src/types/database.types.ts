export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | 'business_owner'
  | 'branch_manager'
  | 'kitchen_staff'
  | 'cashier'
  | 'waiter';

export type BusinessStatus = 'active' | 'suspended' | 'archived';
export type BranchStatus = 'active' | 'inactive' | 'archived';
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked';
export type MenuItemAvailability = 'available' | 'out_of_stock' | 'hidden';
export type ModifierSelectionType = 'single' | 'multiple';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'unavailable';
export type TableShape = 'square' | 'rectangle' | 'round' | 'other';

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          preferred_language: string;
          account_status: 'active' | 'suspended' | 'deactivated';
          onboarding_status: 'not_started' | 'in_progress' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name: string;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          account_status?: 'active' | 'suspended' | 'deactivated';
          onboarding_status?: 'not_started' | 'in_progress' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          account_status?: 'active' | 'suspended' | 'deactivated';
          onboarding_status?: 'not_started' | 'in_progress' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          business_type: string;
          description: string | null;
          logo_url: string | null;
          email: string | null;
          phone: string | null;
          website: string | null;
          country_code: string;
          default_currency: string;
          timezone: string;
          status: BusinessStatus;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          business_type?: string;
          description?: string | null;
          logo_url?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          country_code?: string;
          default_currency?: string;
          timezone?: string;
          status?: BusinessStatus;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          business_type?: string;
          description?: string | null;
          logo_url?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          country_code?: string;
          default_currency?: string;
          timezone?: string;
          status?: BusinessStatus;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "businesses_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      branches: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          code: string;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          region: string | null;
          postal_code: string | null;
          country_code: string;
          phone: string | null;
          email: string | null;
          timezone: string;
          status: BranchStatus;
          is_default: boolean;
          require_table_selection: boolean;
          require_table_pin: boolean;
          table_pin_length: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          code: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          region?: string | null;
          postal_code?: string | null;
          country_code?: string;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          status?: BranchStatus;
          is_default?: boolean;
          require_table_selection?: boolean;
          require_table_pin?: boolean;
          table_pin_length?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          code?: string;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          region?: string | null;
          postal_code?: string | null;
          country_code?: string;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          status?: BranchStatus;
          is_default?: boolean;
          require_table_selection?: boolean;
          require_table_pin?: boolean;
          table_pin_length?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          }
        ];
      };
      menu_categories: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          display_order: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_categories_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_categories_branch_id_fkey";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          }
        ];
      };
      menu_items: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          category_id: string;
          name: string;
          slug: string;
          description: string | null;
          price_cents: number;
          currency: string;
          preparation_time_minutes: number | null;
          is_active: boolean;
          availability_status: MenuItemAvailability;
          is_featured: boolean;
          display_order: number;
          primary_image_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          category_id: string;
          name: string;
          slug: string;
          description?: string | null;
          price_cents: number;
          currency?: string;
          preparation_time_minutes?: number | null;
          is_active?: boolean;
          availability_status?: MenuItemAvailability;
          is_featured?: boolean;
          display_order?: number;
          primary_image_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          category_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          price_cents?: number;
          currency?: string;
          preparation_time_minutes?: number | null;
          is_active?: boolean;
          availability_status?: MenuItemAvailability;
          is_featured?: boolean;
          display_order?: number;
          primary_image_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_branch_id_fkey";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      modifier_groups: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          menu_item_id: string;
          name: string;
          description: string | null;
          selection_type: ModifierSelectionType;
          is_required: boolean;
          min_selections: number;
          max_selections: number | null;
          display_order: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          menu_item_id: string;
          name: string;
          description?: string | null;
          selection_type?: ModifierSelectionType;
          is_required?: boolean;
          min_selections?: number;
          max_selections?: number | null;
          display_order?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          menu_item_id?: string;
          name?: string;
          description?: string | null;
          selection_type?: ModifierSelectionType;
          is_required?: boolean;
          min_selections?: number;
          max_selections?: number | null;
          display_order?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "modifier_groups_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "modifier_groups_branch_id_fkey";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "modifier_groups_menu_item_id_fkey";
            columns: ["menu_item_id"];
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          }
        ];
      };
      modifier_options: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          modifier_group_id: string;
          name: string;
          additional_price_cents: number;
          display_order: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          modifier_group_id: string;
          name: string;
          additional_price_cents?: number;
          display_order?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          modifier_group_id?: string;
          name?: string;
          additional_price_cents?: number;
          display_order?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "modifier_options_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "modifier_options_branch_id_fkey";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "modifier_options_modifier_group_id_fkey";
            columns: ["modifier_group_id"];
            referencedRelation: "modifier_groups";
            referencedColumns: ["id"];
          }
        ];
      };
      service_areas: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          name: string;
          code: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          name: string;
          code: string;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          name?: string;
          code?: string;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_areas_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_areas_branch_id_fkey";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          }
        ];
      };
      dining_tables: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          service_area_id: string;
          name: string;
          code: string;
          table_number: number | null;
          capacity: number;
          status: TableStatus;
          shape: TableShape | null;
          position_x: number | null;
          position_y: number | null;
          display_order: number;
          is_active: boolean;
          table_pin_hash: string | null;
          table_pin_updated_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          service_area_id: string;
          name: string;
          code: string;
          table_number?: number | null;
          capacity?: number;
          status?: TableStatus;
          shape?: TableShape | null;
          position_x?: number | null;
          position_y?: number | null;
          display_order?: number;
          is_active?: boolean;
          table_pin_hash?: string | null;
          table_pin_updated_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          service_area_id?: string;
          name?: string;
          code?: string;
          table_number?: number | null;
          capacity?: number;
          status?: TableStatus;
          shape?: TableShape | null;
          position_x?: number | null;
          position_y?: number | null;
          display_order?: number;
          is_active?: boolean;
          table_pin_hash?: string | null;
          table_pin_updated_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dining_tables_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dining_tables_branch_id_fkey";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dining_tables_service_area_id_fkey";
            columns: ["service_area_id"];
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          }
        ];
      };
      menu_item_images: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          menu_item_id: string;
          storage_path: string;
          alt_text: string | null;
          display_order: number;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          menu_item_id: string;
          storage_path: string;
          alt_text?: string | null;
          display_order?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          menu_item_id?: string;
          storage_path?: string;
          alt_text?: string | null;
          display_order?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_images_menu_item_id_fkey";
            columns: ["menu_item_id"];
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          }
        ];
      };
      branch_operating_hours: {
        Row: {
          id: string;
          branch_id: string;
          day_of_week: number;
          is_closed: boolean;
          opens_at: string | null;
          closes_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          day_of_week: number;
          is_closed?: boolean;
          opens_at?: string | null;
          closes_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          day_of_week?: number;
          is_closed?: boolean;
          opens_at?: string | null;
          closes_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "branch_operating_hours_branch_id_fkey";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          }
        ];
      };
      onboarding_drafts: {
        Row: {
          id: string;
          user_id: string;
          current_step: string;
          payload: Json;
          created_at: string;
          updated_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          current_step?: string;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          current_step?: string;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_drafts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      business_memberships: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: UserRole;
          membership_status: MembershipStatus;
          joined_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role?: UserRole;
          membership_status?: MembershipStatus;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: UserRole;
          membership_status?: MembershipStatus;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_memberships_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_memberships_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      branch_assignments: {
        Row: {
          id: string;
          business_membership_id: string;
          branch_id: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_membership_id: string;
          branch_id: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_membership_id?: string;
          branch_id?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "branch_assignments_business_membership_id_fkey";
            columns: ["business_membership_id"];
            referencedRelation: "business_memberships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "branch_assignments_branch_id_fkey";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          business_id: string | null;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id?: string | null;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id: string;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string | null;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string;
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      branch_qr_codes: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          token_hash: string;
          token_prefix: string | null;
          encrypted_token: string | null;
          version: number;
          is_active: boolean;
          generated_by: string | null;
          generated_at: string;
          last_regenerated_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          token_hash: string;
          token_prefix?: string | null;
          encrypted_token?: string | null;
          version?: number;
          is_active?: boolean;
          generated_by?: string | null;
          generated_at?: string;
          last_regenerated_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          token_hash?: string;
          token_prefix?: string | null;
          encrypted_token?: string | null;
          version?: number;
          is_active?: boolean;
          generated_by?: string | null;
          generated_at?: string;
          last_regenerated_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      table_qr_codes: {
        Row: {
          id: string;
          business_id: string;
          branch_id: string;
          dining_table_id: string;
          token_hash: string;
          token_prefix: string | null;
          version: number;
          is_active: boolean;
          generated_by: string | null;
          generated_at: string;
          last_regenerated_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_id: string;
          dining_table_id: string;
          token_hash: string;
          token_prefix?: string | null;
          version?: number;
          is_active?: boolean;
          generated_by?: string | null;
          generated_at?: string;
          last_regenerated_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_id?: string;
          dining_table_id?: string;
          token_hash?: string;
          token_prefix?: string | null;
          version?: number;
          is_active?: boolean;
          generated_by?: string | null;
          generated_at?: string;
          last_regenerated_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      qr_scan_events: {
        Row: {
          id: number;
          qr_code_id: string | null;
          business_id: string | null;
          branch_id: string | null;
          dining_table_id: string | null;
          scanned_at: string;
          user_agent_hash: string | null;
          ip_hash: string | null;
          referrer: string | null;
          session_fingerprint_hash: string | null;
          is_valid: boolean;
          failure_reason: string | null;
        };
        Insert: {
          id?: number;
          qr_code_id?: string | null;
          business_id?: string | null;
          branch_id?: string | null;
          dining_table_id?: string | null;
          scanned_at?: string;
          user_agent_hash?: string | null;
          ip_hash?: string | null;
          referrer?: string | null;
          session_fingerprint_hash?: string | null;
          is_valid?: boolean;
          failure_reason?: string | null;
        };
        Update: {
          id?: number;
          qr_code_id?: string | null;
          business_id?: string | null;
          branch_id?: string | null;
          dining_table_id?: string | null;
          scanned_at?: string;
          user_agent_hash?: string | null;
          ip_hash?: string | null;
          referrer?: string | null;
          session_fingerprint_hash?: string | null;
          is_valid?: boolean;
          failure_reason?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      resolve_public_branch_menu: {
        Args: {
          p_token_hash: string;
        };
        Returns: Json;
      };
      verify_table_checkout_access: {
        Args: {
          p_branch_id: string;
          p_table_id: string;
          p_pin_hash?: string | null;
        };
        Returns: Json;
      };
      resolve_public_table_menu: {
        Args: {
          p_token_hash: string;
        };
        Returns: Json;
      };
      create_business_with_default_branch: {
        Args: {
          p_name: string;
          p_slug: string;
          p_business_type?: string;
          p_country_code?: string;
          p_default_currency?: string;
          p_timezone?: string;
          p_branch_name?: string;
          p_branch_code?: string;
        };
        Returns: Json;
      };
      complete_business_onboarding: {
        Args: {
          p_name: string;
          p_slug: string;
          p_business_type: string;
          p_description?: string;
          p_country_code?: string;
          p_default_currency?: string;
          p_timezone?: string;
          p_email?: string;
          p_phone?: string;
          p_website?: string;
          p_logo_url?: string;
          p_branch_name?: string;
          p_branch_code?: string;
          p_branch_address_line_1?: string;
          p_branch_address_line_2?: string;
          p_branch_city?: string;
          p_branch_region?: string;
          p_branch_postal_code?: string;
          p_hours?: Json;
        };
        Returns: Json;
      };
      bulk_create_dining_tables: {
        Args: {
          p_business_id: string;
          p_branch_id: string;
          p_service_area_id: string;
          p_prefix: string;
          p_start_number: number;
          p_count: number;
          p_capacity: number;
          p_shape?: TableShape;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      business_status: BusinessStatus;
      branch_status: BranchStatus;
      membership_status: MembershipStatus;
      menu_item_availability: MenuItemAvailability;
      modifier_selection_type: ModifierSelectionType;
      table_status: TableStatus;
      table_shape: TableShape;
    };
  };
}
