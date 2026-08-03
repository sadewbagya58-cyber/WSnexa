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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
    };
    Enums: {
      user_role: UserRole;
      business_status: BusinessStatus;
      branch_status: BranchStatus;
      membership_status: MembershipStatus;
    };
  };
}
