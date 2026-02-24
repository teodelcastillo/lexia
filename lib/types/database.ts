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
      activity_log: {
        Row: {
          action_type: string
          case_id: string | null
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          case_id?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          case_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          case_id: string
          case_role: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          case_id: string
          case_role: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          case_id?: string
          case_role?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_assignments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          case_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          is_pinned: boolean
          is_visible_to_client: boolean
          updated_at: string
        }
        Insert: {
          case_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_pinned?: boolean
          is_visible_to_client?: boolean
          updated_at?: string
        }
        Update: {
          case_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_pinned?: boolean
          is_visible_to_client?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_participants: {
        Row: {
          case_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          person_id: string
          role: Database["public"]["Enums"]["participant_role"]
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          person_id: string
          role: Database["public"]["Enums"]["participant_role"]
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          person_id?: string
          role?: Database["public"]["Enums"]["participant_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_participants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: string
          case_type: string
          company_id: string | null
          court_name: string | null
          court_number: string | null
          created_at: string
          description: string | null
          estimated_value: number | null
          fee_arrangement: string | null
          filing_date: string | null
          id: string
          is_visible_to_client: boolean
          jurisdiction: string | null
          next_hearing_date: string | null
          notes: string | null
          opposing_counsel: string | null
          opposing_party: string | null
          status: Database["public"]["Enums"]["case_status"]
          statute_of_limitations: string | null
          title: string
          updated_at: string
        }
        Insert: {
          case_number: string
          case_type: string
          company_id?: string | null
          court_name?: string | null
          court_number?: string | null
          created_at?: string
          description?: string | null
          estimated_value?: number | null
          fee_arrangement?: string | null
          filing_date?: string | null
          id?: string
          is_visible_to_client?: boolean
          jurisdiction?: string | null
          next_hearing_date?: string | null
          notes?: string | null
          opposing_counsel?: string | null
          opposing_party?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          statute_of_limitations?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          case_number?: string
          case_type?: string
          company_id?: string | null
          court_name?: string | null
          court_number?: string | null
          created_at?: string
          description?: string | null
          estimated_value?: number | null
          fee_arrangement?: string | null
          filing_date?: string | null
          id?: string
          is_visible_to_client?: boolean
          jurisdiction?: string | null
          next_hearing_date?: string | null
          notes?: string | null
          opposing_counsel?: string | null
          opposing_party?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          statute_of_limitations?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          company_type: 'client' | 'supplier' | null
          country: string | null
          created_at: string | null
          created_by: string | null
          cuit: string | null
          email: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          legal_form: string | null
          legal_name: string | null
          name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          province: string | null
          tax_id: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          company_type?: 'client' | 'supplier' | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          cuit?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          legal_form?: string | null
          legal_name?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          company_type?: 'client' | 'supplier' | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          cuit?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          legal_form?: string | null
          legal_name?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          assigned_to: string | null
          case_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          deadline_type: string | null
          description: string | null
          due_date: string
          google_calendar_event_id: string | null
          id: string
          is_completed: boolean
          reminder_days: number[] | null
          status: Database["public"]["Enums"]["deadline_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          deadline_type?: string | null
          description?: string | null
          due_date: string
          google_calendar_event_id?: string | null
          id?: string
          is_completed?: boolean
          reminder_days?: number[] | null
          status?: Database["public"]["Enums"]["deadline_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          deadline_type?: string | null
          description?: string | null
          due_date?: string
          google_calendar_event_id?: string | null
          id?: string
          is_completed?: boolean
          reminder_days?: number[] | null
          status?: Database["public"]["Enums"]["deadline_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          case_id: string
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          description: string | null
          file_path: string | null
          file_size: number | null
          google_drive_id: string | null
          google_drive_url: string | null
          id: string
          is_visible_to_client: boolean
          mime_type: string | null
          name: string
          parent_document_id: string | null
          updated_at: string
          uploaded_by: string
          version: number
        }
        Insert: {
          case_id: string
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          google_drive_id?: string | null
          google_drive_url?: string | null
          id?: string
          is_visible_to_client?: boolean
          mime_type?: string | null
          name: string
          parent_document_id?: string | null
          updated_at?: string
          uploaded_by: string
          version?: number
        }
        Update: {
          case_id?: string
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          google_drive_id?: string | null
          google_drive_url?: string | null
          id?: string
          is_visible_to_client?: boolean
          mime_type?: string | null
          name?: string
          parent_document_id?: string | null
          updated_at?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          id: string
          user_id: string
          service: string
          access_token: string
          refresh_token: string | null
          token_expires_at: string | null
          google_email: string | null
          google_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          service: string
          access_token: string
          refresh_token?: string | null
          token_expires_at?: string | null
          google_email?: string | null
          google_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          service?: string
          access_token?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          google_email?: string | null
          google_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_events: {
        Row: {
          id: string
          user_id: string
          calendar_id: string
          google_event_id: string
          etag: string | null
          google_updated_at: string | null
          status: string
          summary: string | null
          description: string | null
          location: string | null
          start_at: string
          end_at: string
          all_day: boolean
          event_kind: string | null
          preparation_override: string | null
          prepared_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          calendar_id?: string
          google_event_id: string
          etag?: string | null
          google_updated_at?: string | null
          status?: string
          summary?: string | null
          description?: string | null
          location?: string | null
          start_at: string
          end_at: string
          all_day?: boolean
          event_kind?: string | null
          preparation_override?: string | null
          prepared_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          calendar_id?: string
          google_event_id?: string
          etag?: string | null
          google_updated_at?: string | null
          status?: string
          summary?: string | null
          description?: string | null
          location?: string | null
          start_at?: string
          end_at?: string
          all_day?: boolean
          event_kind?: string | null
          preparation_override?: string | null
          prepared_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_sync_state: {
        Row: {
          id: string
          user_id: string
          calendar_id: string
          sync_token: string | null
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          calendar_id?: string
          sync_token?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          calendar_id?: string
          sync_token?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          address: string | null
          city: string | null
          client_type: string
          company_id: string | null
          company_name: string | null
          company_role: Database["public"]["Enums"]["company_role"] | null
          created_at: string
          cuit: string | null
          dni: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          legal_representative: string | null
          name: string | null
          notes: string | null
          person_type: Database["public"]["Enums"]["person_type"] | null
          phone: string | null
          portal_user_id: string | null
          postal_code: string | null
          province: string | null
          secondary_phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_type: string
          company_id?: string | null
          company_name?: string | null
          company_role?: Database["public"]["Enums"]["company_role"] | null
          created_at?: string
          cuit?: string | null
          dni?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          legal_representative?: string | null
          name?: string | null
          notes?: string | null
          person_type?: Database["public"]["Enums"]["person_type"] | null
          phone?: string | null
          portal_user_id?: string | null
          postal_code?: string | null
          province?: string | null
          secondary_phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_type?: string
          company_id?: string | null
          company_name?: string | null
          company_role?: Database["public"]["Enums"]["company_role"] | null
          created_at?: string
          cuit?: string | null
          dni?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          legal_representative?: string | null
          name?: string | null
          notes?: string | null
          person_type?: Database["public"]["Enums"]["person_type"] | null
          phone?: string | null
          portal_user_id?: string | null
          postal_code?: string | null
          province?: string | null
          secondary_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bar_number: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          system_role: Database["public"]["Enums"]["user_role"]
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bar_number?: string | null
          created_at?: string
          email: string
          first_name: string
          id: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          system_role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bar_number?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          system_role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          case_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          google_calendar_event_id: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          reminder_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          google_calendar_event_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          case_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          google_calendar_event_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_billing_settings: {
        Row: {
          id: string
          organization_id: string
          default_currency: string
          invoice_prefix: string
          default_tax_rate: number
          default_payment_terms_days: number
          default_participation_studio_assigned: number
          default_participation_lawyer_recruited: number
          current_jus_value: number | null
          jus_currency: string | null
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          default_currency?: string
          invoice_prefix?: string
          default_tax_rate?: number
          default_payment_terms_days?: number
          default_participation_studio_assigned?: number
          default_participation_lawyer_recruited?: number
          current_jus_value?: number | null
          jus_currency?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          default_currency?: string
          invoice_prefix?: string
          default_tax_rate?: number
          default_payment_terms_days?: number
          default_participation_studio_assigned?: number
          default_participation_lawyer_recruited?: number
          current_jus_value?: number | null
          jus_currency?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_billing_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_agreements: {
        Row: {
          id: string
          client_id: string | null
          company_id: string | null
          case_id: string | null
          type: Database["public"]["Enums"]["fee_agreement_type"]
          status: Database["public"]["Enums"]["fee_agreement_status"]
          currency: string
          valid_from: string
          valid_until: string | null
          terms: Json
          notes: string | null
          created_by: string
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          case_id?: string | null
          type: Database["public"]["Enums"]["fee_agreement_type"]
          status?: Database["public"]["Enums"]["fee_agreement_status"]
          currency?: string
          valid_from?: string
          valid_until?: string | null
          terms?: Json
          notes?: string | null
          created_by: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          case_id?: string | null
          type?: Database["public"]["Enums"]["fee_agreement_type"]
          status?: Database["public"]["Enums"]["fee_agreement_status"]
          currency?: string
          valid_from?: string
          valid_until?: string | null
          terms?: Json
          notes?: string | null
          created_by?: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_agreements_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_items: {
        Row: {
          id: string
          client_id: string
          company_id: string | null
          case_id: string | null
          fee_agreement_id: string | null
          invoice_id: string | null
          type: Database["public"]["Enums"]["billing_item_type"]
          description: string
          amount: number
          quantity: number
          line_total: number
          currency: string
          period: string | null
          status: Database["public"]["Enums"]["billing_item_status"]
          created_by: string
          approved_by: string | null
          approved_at: string | null
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          company_id?: string | null
          case_id?: string | null
          fee_agreement_id?: string | null
          invoice_id?: string | null
          type: Database["public"]["Enums"]["billing_item_type"]
          description: string
          amount: number
          quantity?: number
          currency?: string
          period?: string | null
          status?: Database["public"]["Enums"]["billing_item_status"]
          created_by: string
          approved_by?: string | null
          approved_at?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          company_id?: string | null
          case_id?: string | null
          fee_agreement_id?: string | null
          invoice_id?: string | null
          type?: Database["public"]["Enums"]["billing_item_type"]
          description?: string
          amount?: number
          quantity?: number
          currency?: string
          period?: string | null
          status?: Database["public"]["Enums"]["billing_item_status"]
          created_by?: string
          approved_by?: string | null
          approved_at?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_fee_agreement_id_fkey"
            columns: ["fee_agreement_id"]
            isOneToOne: false
            referencedRelation: "fee_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          client_id: string | null
          company_id: string | null
          invoice_number: string
          status: Database["public"]["Enums"]["invoice_status"]
          issue_date: string
          due_date: string | null
          subtotal: number
          tax_rate: number
          tax_amount: number
          total: number
          currency: string
          period: string | null
          notes: string | null
          created_by: string
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          invoice_number: string
          status?: Database["public"]["Enums"]["invoice_status"]
          issue_date?: string
          due_date?: string | null
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total?: number
          currency?: string
          period?: string | null
          notes?: string | null
          created_by: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          invoice_number?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          issue_date?: string
          due_date?: string | null
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total?: number
          currency?: string
          period?: string | null
          notes?: string | null
          created_by?: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_accounts: {
        Row: {
          id: string
          client_id: string | null
          company_id: string | null
          credit_limit: number | null
          grace_days: number
          currency: string
          notes: string | null
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          credit_limit?: number | null
          grace_days?: number
          currency?: string
          notes?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          credit_limit?: number | null
          grace_days?: number
          currency?: string
          notes?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      account_movements: {
        Row: {
          id: string
          client_id: string | null
          company_id: string | null
          type: Database["public"]["Enums"]["account_movement_type"]
          amount: number
          currency: string
          movement_date: string
          reference_id: string | null
          reference_type: string | null
          invoice_id: string | null
          notes: string | null
          created_by: string
          organization_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          type: Database["public"]["Enums"]["account_movement_type"]
          amount: number
          currency?: string
          movement_date?: string
          reference_id?: string | null
          reference_type?: string | null
          invoice_id?: string | null
          notes?: string | null
          created_by: string
          organization_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          type?: Database["public"]["Enums"]["account_movement_type"]
          amount?: number
          currency?: string
          movement_date?: string
          reference_id?: string | null
          reference_type?: string | null
          invoice_id?: string | null
          notes?: string | null
          created_by?: string
          organization_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_movements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          id: string
          client_id: string | null
          company_id: string | null
          amount: number
          currency: string
          payment_date: string
          payment_method: string
          reference_number: string | null
          invoice_id: string | null
          notes: string | null
          created_by: string
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          amount: number
          currency?: string
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          invoice_id?: string | null
          notes?: string | null
          created_by: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          company_id?: string | null
          amount?: number
          currency?: string
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          invoice_id?: string | null
          notes?: string | null
          created_by?: string
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_participations: {
        Row: {
          id: string
          case_id: string
          lawyer_id: string
          participation_type: Database["public"]["Enums"]["participation_type"]
          percentage: number
          base_amount: number | null
          calculated_amount: number | null
          status: string
          notes: string | null
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_id: string
          lawyer_id: string
          participation_type: Database["public"]["Enums"]["participation_type"]
          percentage: number
          base_amount?: number | null
          calculated_amount?: number | null
          status?: string
          notes?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          lawyer_id?: string
          participation_type?: Database["public"]["Enums"]["participation_type"]
          percentage?: number
          base_amount?: number | null
          calculated_amount?: number | null
          status?: string
          notes?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_participations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_participations_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_compensations: {
        Row: {
          id: string
          lawyer_id: string
          period: string
          base_salary_jus: number | null
          jus_value_at_period: number | null
          base_amount_ars: number | null
          participations_total: number
          deductions: number
          total_gross: number
          status: Database["public"]["Enums"]["compensation_status"]
          payment_date: string | null
          notes: string | null
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lawyer_id: string
          period: string
          base_salary_jus?: number | null
          jus_value_at_period?: number | null
          base_amount_ars?: number | null
          participations_total?: number
          deductions?: number
          total_gross?: number
          status?: Database["public"]["Enums"]["compensation_status"]
          payment_date?: string | null
          notes?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lawyer_id?: string
          period?: string
          base_salary_jus?: number | null
          jus_value_at_period?: number | null
          base_amount_ars?: number | null
          participations_total?: number
          deductions?: number
          total_gross?: number
          status?: Database["public"]["Enums"]["compensation_status"]
          payment_date?: string | null
          notes?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_compensations_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      case_participants_detail: {
        Row: {
          case_id: string | null
          case_number: string | null
          case_status: Database["public"]["Enums"]["case_status"] | null
          case_title: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          person_email: string | null
          person_id: string | null
          person_name: string | null
          person_phone: string | null
          person_type: Database["public"]["Enums"]["person_type"] | null
          role: Database["public"]["Enums"]["participant_role"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_participants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string | null
          company_name: string | null
          company_role: Database["public"]["Enums"]["company_role"] | null
          email: string | null
          first_name: string | null
          last_name: string | null
          person_id: string | null
          person_type: Database["public"]["Enums"]["person_type"] | null
          phone: string | null
        }
        Relationships: []
      }
      client_account_summary: {
        Row: {
          client_id: string | null
          company_id: string | null
          organization_id: string | null
          total_invoiced: number
          total_paid: number
          balance: number
          last_invoice_date: string | null
          last_payment_date: string | null
          credit_limit: number | null
          grace_days: number | null
        }
        Relationships: []
      }
      monthly_billing_summary: {
        Row: {
          organization_id: string | null
          client_id: string | null
          company_id: string | null
          period: string | null
          items_draft: number
          items_approved: number
          items_invoiced: number
          total_draft: number
          total_approved: number
          total_invoiced: number
        }
        Relationships: []
      }
      case_profitability: {
        Row: {
          case_id: string | null
          case_title: string | null
          organization_id: string | null
          total_billed: number
          total_collected: number
          total_participation_cost: number
          net_margin: number
        }
        Relationships: []
      }
    }
    Functions: {
      get_person_name: { Args: { person_id: string }; Returns: string }
      has_case_access: { Args: { check_case_id: string }; Returns: boolean }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_case_leader: { Args: { check_case_id: string }; Returns: boolean }
      is_client_for_case: { Args: { check_case_id: string }; Returns: boolean }
      is_internal_user: { Args: Record<string, never>; Returns: boolean }
      next_invoice_number: { Args: { p_org_id: string }; Returns: string }
      calculate_client_balance: { Args: { p_client_id?: string; p_company_id?: string }; Returns: number }
    }
    Enums: {
      case_status: "active" | "pending" | "on_hold" | "closed" | "archived"
      company_role:
        | "legal_representative"
        | "attorney"
        | "contact"
        | "shareholder"
        | "director"
        | "other"
      deadline_status: "pending" | "completed" | "missed" | "cancelled"
      document_category:
        | "contract"
        | "court_filing"
        | "correspondence"
        | "evidence"
        | "internal_memo"
        | "client_document"
        | "other"
      participant_role:
        | "client_representative"
        | "opposing_party"
        | "opposing_lawyer"
        | "judge"
        | "prosecutor"
        | "expert_witness"
        | "witness"
        | "mediator"
        | "court_clerk"
        | "other"
      person_type:
        | "client"
        | "judge"
        | "opposing_lawyer"
        | "prosecutor"
        | "witness"
        | "expert"
        | "other"
      task_priority: "urgent" | "high" | "medium" | "low"
      task_status:
        | "pending"
        | "in_progress"
        | "under_review"
        | "completed"
        | "cancelled"
      user_role: "admin_general" | "case_leader" | "lawyer_executive" | "client"
      fee_agreement_type:
        | "monthly_retainer"
        | "retainer_plus_task"
        | "custom_quote"
        | "per_consultation"
        | "hourly"
        | "judicial_regulation"
        | "hybrid"
      fee_agreement_status: "active" | "suspended" | "closed"
      billing_item_type:
        | "monthly_fee"
        | "task_fee"
        | "consultation"
        | "hours"
        | "judicial_regulation"
        | "expense_reimbursement"
        | "other"
      billing_item_status: "draft" | "approved" | "invoiced" | "void"
      invoice_status:
        | "draft"
        | "issued"
        | "paid"
        | "partially_paid"
        | "overdue"
        | "cancelled"
      account_movement_type: "invoice" | "payment" | "credit_note" | "adjustment"
      participation_type: "studio_assigned" | "lawyer_recruited"
      compensation_status: "draft" | "approved" | "paid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier access
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"]

// Convenience exports for common types
export type Profile = Tables<"profiles">
export type Case = Tables<"cases">
export type Company = Tables<"companies">
export type Person = Tables<"people">
export type Task = Tables<"tasks">
export type Document = Tables<"documents">
export type Deadline = Tables<"deadlines">
export type CaseAssignment = Tables<"case_assignments">
export type CaseNote = Tables<"case_notes">
export type CaseParticipant = Tables<"case_participants">
export type ActivityLog = Tables<"activity_log">

// Billing module types
export type OrganizationBillingSettings = Tables<"organization_billing_settings">
export type FeeAgreement = Tables<"fee_agreements">
export type BillingItem = Tables<"billing_items">
export type Invoice = Tables<"invoices">
export type ClientAccount = Tables<"client_accounts">
export type AccountMovement = Tables<"account_movements">
export type Payment = Tables<"payments">
export type CaseParticipationRow = Tables<"case_participations">
export type LawyerCompensation = Tables<"lawyer_compensations">

// Enum types
export type CaseStatus = Enums<"case_status">
export type CompanyRole = Enums<"company_role">
export type DeadlineStatus = Enums<"deadline_status">
export type DeadlineType =
  | 'court_date'
  | 'filing_deadline'
  | 'meeting'
  | 'other'

export type DocumentCategory = Enums<"document_category">
export type ParticipantRole = Enums<"participant_role">
export type PersonType = Enums<"person_type">
export type TaskPriority = Enums<"task_priority">
export type TaskStatus = Enums<"task_status">
export type UserRole = Enums<"user_role">

// Billing enum types
export type FeeAgreementType = Enums<"fee_agreement_type">
export type FeeAgreementStatus = Enums<"fee_agreement_status">
export type BillingItemType = Enums<"billing_item_type">
export type BillingItemStatus = Enums<"billing_item_status">
export type InvoiceStatus = Enums<"invoice_status">
export type AccountMovementType = Enums<"account_movement_type">
export type ParticipationType = Enums<"participation_type">
export type CompensationStatus = Enums<"compensation_status">

// View types
export type CaseParticipantDetail = Views<"case_participants_detail">
export type CompanyMember = Views<"company_members">
export type ClientAccountSummary = Views<"client_account_summary">
export type MonthlyBillingSummary = Views<"monthly_billing_summary">
export type CaseProfitability = Views<"case_profitability">
