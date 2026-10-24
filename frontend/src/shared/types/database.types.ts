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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_slots: {
        Row: {
          booked_count: number | null
          branch_id: string | null
          capacity: number | null
          clinic_id: string
          created_at: string | null
          doctor_id: string
          end_time: string
          id: string
          slot_date: string
          start_time: string
          status: string | null
        }
        Insert: {
          booked_count?: number | null
          branch_id?: string | null
          capacity?: number | null
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          end_time: string
          id?: string
          slot_date: string
          start_time: string
          status?: string | null
        }
        Update: {
          booked_count?: number | null
          branch_id?: string | null
          capacity?: number | null
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          end_time?: string
          id?: string
          slot_date?: string
          start_time?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_status_history: {
        Row: {
          appointment_id: string
          changed_by: string | null
          clinic_id: string
          created_at: string | null
          id: string
          new_status: string
          old_status: string | null
          reason: string | null
        }
        Insert: {
          appointment_id: string
          changed_by?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          new_status: string
          old_status?: string | null
          reason?: string | null
        }
        Update: {
          appointment_id?: string
          changed_by?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string | null
          assigned_by: string | null
          branch_id: string | null
          cancelled_reason: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          department: string | null
          doctor_id: string | null
          id: string
          is_new_patient: boolean | null
          main_problem: string | null
          metadata: Json | null
          patient_id: string
          slot_id: string | null
          source: string | null
          status: string | null
          token_number: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time?: string | null
          assigned_by?: string | null
          branch_id?: string | null
          cancelled_reason?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          doctor_id?: string | null
          id?: string
          is_new_patient?: boolean | null
          main_problem?: string | null
          metadata?: Json | null
          patient_id: string
          slot_id?: string | null
          source?: string | null
          status?: string | null
          token_number?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string | null
          assigned_by?: string | null
          branch_id?: string | null
          cancelled_reason?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          doctor_id?: string | null
          id?: string
          is_new_patient?: boolean | null
          main_problem?: string | null
          metadata?: Json | null
          patient_id?: string
          slot_id?: string | null
          source?: string | null
          status?: string | null
          token_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "appointment_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          branch_id: string | null
          clinic_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          branch_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          branch_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          clinic_id: string
          created_at: string | null
          id: string
          is_main: boolean | null
          name: string
          phone: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          is_main?: boolean | null
          name: string
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          is_main?: boolean | null
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_modules: {
        Row: {
          clinic_id: string
          created_at: string | null
          enabled: boolean
          module_key: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          enabled?: boolean
          module_key: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          enabled?: boolean
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_modules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          clinic_mode: string
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json
          slug: string
          specialty: string | null
          status: string
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          clinic_mode: string
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json
          slug: string
          specialty?: string | null
          status?: string
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          clinic_mode?: string
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          slug?: string
          specialty?: string | null
          status?: string
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      consultation_notes: {
        Row: {
          clinic_id: string
          consultation_id: string
          created_at: string | null
          created_by: string | null
          id: string
          note: string
          note_type: string | null
        }
        Insert: {
          clinic_id: string
          consultation_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note: string
          note_type?: string | null
        }
        Update: {
          clinic_id?: string
          consultation_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_vitals: {
        Row: {
          blood_pressure: string | null
          blood_sugar: string | null
          clinic_id: string
          consultation_id: string
          created_at: string | null
          height_cm: number | null
          id: string
          notes: string | null
          oxygen_saturation: number | null
          patient_id: string
          pulse_rate: number | null
          respiratory_rate: number | null
          temperature_c: number | null
          weight_kg: number | null
        }
        Insert: {
          blood_pressure?: string | null
          blood_sugar?: string | null
          clinic_id: string
          consultation_id: string
          created_at?: string | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          oxygen_saturation?: number | null
          patient_id: string
          pulse_rate?: number | null
          respiratory_rate?: number | null
          temperature_c?: number | null
          weight_kg?: number | null
        }
        Update: {
          blood_pressure?: string | null
          blood_sugar?: string | null
          clinic_id?: string
          consultation_id?: string
          created_at?: string | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          oxygen_saturation?: number | null
          patient_id?: string
          pulse_rate?: number | null
          respiratory_rate?: number | null
          temperature_c?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_vitals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_vitals_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          advice: string | null
          appointment_id: string
          branch_id: string | null
          clinic_id: string
          clinical_notes: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          diagnosis: string | null
          doctor_id: string
          follow_up_date: string | null
          follow_up_reason: string | null
          id: string
          metadata: Json | null
          patient_id: string
          status: string | null
          symptoms: string | null
          updated_at: string | null
        }
        Insert: {
          advice?: string | null
          appointment_id: string
          branch_id?: string | null
          clinic_id: string
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          diagnosis?: string | null
          doctor_id: string
          follow_up_date?: string | null
          follow_up_reason?: string | null
          id?: string
          metadata?: Json | null
          patient_id: string
          status?: string | null
          symptoms?: string | null
          updated_at?: string | null
        }
        Update: {
          advice?: string | null
          appointment_id?: string
          branch_id?: string | null
          clinic_id?: string
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          diagnosis?: string | null
          doctor_id?: string
          follow_up_date?: string | null
          follow_up_reason?: string | null
          id?: string
          metadata?: Json | null
          patient_id?: string
          status?: string | null
          symptoms?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_availability: {
        Row: {
          branch_id: string | null
          break_end: string | null
          break_start: string | null
          clinic_id: string
          created_at: string | null
          day_of_week: number | null
          doctor_id: string
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
        }
        Insert: {
          branch_id?: string | null
          break_end?: string | null
          break_start?: string | null
          clinic_id: string
          created_at?: string | null
          day_of_week?: number | null
          doctor_id: string
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
        }
        Update: {
          branch_id?: string | null
          break_end?: string | null
          break_start?: string | null
          clinic_id?: string
          created_at?: string | null
          day_of_week?: number | null
          doctor_id?: string
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_availability_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_availability_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_availability_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_blocked_dates: {
        Row: {
          blocked_date: string
          clinic_id: string
          created_at: string | null
          created_by: string | null
          doctor_id: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          doctor_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_blocked_dates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_blocked_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_blocked_dates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_profiles: {
        Row: {
          branch_id: string | null
          clinic_id: string
          consultation_fee: number | null
          created_at: string | null
          department: string | null
          id: string
          max_appointments_per_slot: number | null
          qualification: string | null
          slot_duration_minutes: number | null
          specialization: string | null
          staff_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          consultation_fee?: number | null
          created_at?: string | null
          department?: string | null
          id?: string
          max_appointments_per_slot?: number | null
          qualification?: string | null
          slot_duration_minutes?: number | null
          specialization?: string | null
          staff_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          consultation_fee?: number | null
          created_at?: string | null
          department?: string | null
          id?: string
          max_appointments_per_slot?: number | null
          qualification?: string | null
          slot_duration_minutes?: number | null
          specialization?: string | null
          staff_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_profiles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string
          discount_amount: number
          id: string
          invoice_id: string
          item_type: string
          line_total: number
          quantity: number
          reference_id: string | null
          tax_amount: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          description: string
          discount_amount?: number
          id?: string
          invoice_id: string
          item_type?: string
          line_total?: number
          quantity?: number
          reference_id?: string | null
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          description?: string
          discount_amount?: number
          id?: string
          invoice_id?: string
          item_type?: string
          line_total?: number
          quantity?: number
          reference_id?: string | null
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_history: {
        Row: {
          changed_by: string | null
          clinic_id: string
          created_at: string | null
          id: string
          invoice_id: string
          new_payment_status: string | null
          new_status: string | null
          old_payment_status: string | null
          old_status: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          invoice_id: string
          new_payment_status?: string | null
          new_status?: string | null
          old_payment_status?: string | null
          old_status?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          new_payment_status?: string | null
          new_status?: string | null
          old_payment_status?: string | null
          old_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_status_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_id: string | null
          balance_amount: number
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          clinic_id: string
          consultation_id: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number
          id: string
          invoice_number: string
          invoice_status: string
          invoice_type: string | null
          metadata: Json | null
          notes: string | null
          paid_amount: number
          patient_id: string
          payment_status: string
          pharmacy_order_id: string | null
          prescription_id: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          balance_amount?: number
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinic_id: string
          consultation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number
          id?: string
          invoice_number: string
          invoice_status?: string
          invoice_type?: string | null
          metadata?: Json | null
          notes?: string | null
          paid_amount?: number
          patient_id: string
          payment_status?: string
          pharmacy_order_id?: string | null
          prescription_id?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          balance_amount?: number
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinic_id?: string
          consultation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number
          id?: string
          invoice_number?: string
          invoice_status?: string
          invoice_type?: string | null
          metadata?: Json | null
          notes?: string | null
          paid_amount?: number
          patient_id?: string
          payment_status?: string
          pharmacy_order_id?: string | null
          prescription_id?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pharmacy_order_id_fkey"
            columns: ["pharmacy_order_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_alerts: {
        Row: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          current_stock: number
          id: string
          medicine_id: string
          reorder_level: number
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          current_stock?: number
          id?: string
          medicine_id: string
          reorder_level?: number
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          current_stock?: number
          id?: string
          medicine_id?: string
          reorder_level?: number
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_payment_records: {
        Row: {
          amount: number
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          id: string
          invoice_id: string
          patient_id: string
          payment_mode: string
          payment_note: string | null
          received_at: string | null
          received_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          invoice_id: string
          patient_id: string
          payment_mode: string
          payment_note?: string | null
          received_at?: string | null
          received_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          patient_id?: string
          payment_mode?: string
          payment_note?: string | null
          received_at?: string | null
          received_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_payment_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payment_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payment_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payment_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payment_records_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_reminders: {
        Row: {
          clinic_id: string
          consent_confirmed: boolean | null
          created_at: string | null
          created_by: string | null
          delivery_status: string | null
          dosage: string | null
          end_date: string | null
          frequency: string | null
          id: string
          medicine_name: string
          metadata: Json | null
          next_run_at: string | null
          patient_id: string
          prescription_id: string
          prescription_item_id: string | null
          start_date: string
          status: string | null
          timing: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          consent_confirmed?: boolean | null
          created_at?: string | null
          created_by?: string | null
          delivery_status?: string | null
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          medicine_name: string
          metadata?: Json | null
          next_run_at?: string | null
          patient_id: string
          prescription_id: string
          prescription_item_id?: string | null
          start_date: string
          status?: string | null
          timing?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          consent_confirmed?: boolean | null
          created_at?: string | null
          created_by?: string | null
          delivery_status?: string | null
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          medicine_name?: string
          metadata?: Json | null
          next_run_at?: string | null
          patient_id?: string
          prescription_id?: string
          prescription_item_id?: string | null
          start_date?: string
          status?: string | null
          timing?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicine_reminders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_reminders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_reminders_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_reminders_prescription_item_id_fkey"
            columns: ["prescription_item_id"]
            isOneToOne: false
            referencedRelation: "prescription_items"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_stock_batches: {
        Row: {
          batch_no: string
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          expiry_date: string | null
          id: string
          medicine_id: string
          mrp: number | null
          purchase_id: string | null
          purchase_price: number | null
          quantity_available: number
          selling_price: number | null
          status: string | null
          supplier_name: string | null
          updated_at: string | null
        }
        Insert: {
          batch_no: string
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          medicine_id: string
          mrp?: number | null
          purchase_id?: string | null
          purchase_price?: number | null
          quantity_available?: number
          selling_price?: number | null
          status?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_no?: string
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          medicine_id?: string
          mrp?: number | null
          purchase_id?: string | null
          purchase_price?: number | null
          quantity_available?: number
          selling_price?: number | null
          status?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicine_stock_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_stock_batches_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_stock_batches_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          branch_id: string | null
          category: string | null
          clinic_id: string
          created_at: string | null
          generic_name: string | null
          gst_rate: number | null
          hsn_code: string | null
          id: string
          manufacturer: string | null
          metadata: Json | null
          name: string
          reorder_level: number | null
          status: string | null
          strength: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          clinic_id: string
          created_at?: string | null
          generic_name?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          manufacturer?: string | null
          metadata?: Json | null
          name: string
          reorder_level?: number | null
          status?: string | null
          strength?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          clinic_id?: string
          created_at?: string | null
          generic_name?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          manufacturer?: string | null
          metadata?: Json | null
          name?: string
          reorder_level?: number | null
          status?: string | null
          strength?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicines_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      patient_family_members: {
        Row: {
          clinic_id: string
          created_at: string | null
          id: string
          linked_patient_id: string
          primary_patient_id: string
          relationship: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          id?: string
          linked_patient_id: string
          primary_patient_id: string
          relationship?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          id?: string
          linked_patient_id?: string
          primary_patient_id?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_family_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_family_members_linked_patient_id_fkey"
            columns: ["linked_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_family_members_primary_patient_id_fkey"
            columns: ["primary_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_notes: {
        Row: {
          clinic_id: string
          created_at: string | null
          created_by: string | null
          id: string
          note: string
          patient_id: string
          visibility: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note: string
          patient_id: string
          visibility?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string
          patient_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          age: number | null
          allergies: string | null
          blood_group: string | null
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          current_medications: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          existing_conditions: string | null
          full_name: string
          gender: string | null
          id: string
          medical_history: string | null
          metadata: Json | null
          patient_code: string | null
          phone: string
          reminder_consent: boolean | null
          source: string | null
          status: string | null
          updated_at: string | null
          whatsapp_consent: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          allergies?: string | null
          blood_group?: string | null
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          current_medications?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          existing_conditions?: string | null
          full_name: string
          gender?: string | null
          id?: string
          medical_history?: string | null
          metadata?: Json | null
          patient_code?: string | null
          phone: string
          reminder_consent?: boolean | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_consent?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          allergies?: string | null
          blood_group?: string | null
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          current_medications?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          existing_conditions?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          medical_history?: string | null
          metadata?: Json | null
          patient_code?: string | null
          phone?: string
          reminder_consent?: boolean | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_consent?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          key: string
          module_key: string | null
          name: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          module_key?: string | null
          name: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          module_key?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      pharmacy_order_items: {
        Row: {
          batch_id: string | null
          clinic_id: string
          created_at: string | null
          dispensed_quantity: number | null
          id: string
          medicine_id: string | null
          medicine_name: string
          notes: string | null
          pharmacy_order_id: string
          prescription_item_id: string | null
          requested_quantity: number | null
          status: string | null
        }
        Insert: {
          batch_id?: string | null
          clinic_id: string
          created_at?: string | null
          dispensed_quantity?: number | null
          id?: string
          medicine_id?: string | null
          medicine_name: string
          notes?: string | null
          pharmacy_order_id: string
          prescription_item_id?: string | null
          requested_quantity?: number | null
          status?: string | null
        }
        Update: {
          batch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          dispensed_quantity?: number | null
          id?: string
          medicine_id?: string | null
          medicine_name?: string
          notes?: string | null
          pharmacy_order_id?: string
          prescription_item_id?: string | null
          requested_quantity?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_order_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_items_pharmacy_order_id_fkey"
            columns: ["pharmacy_order_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_items_prescription_item_id_fkey"
            columns: ["prescription_item_id"]
            isOneToOne: false
            referencedRelation: "prescription_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_orders: {
        Row: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          dispensed_at: string | null
          dispensed_by: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          patient_id: string
          prescription_id: string
          status: string | null
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          prescription_id: string
          status?: string | null
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          prescription_id?: string
          status?: string | null
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_orders_dispensed_by_fkey"
            columns: ["dispensed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_orders_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: true
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_delivery_logs: {
        Row: {
          changed_by: string | null
          channel: string
          clinic_id: string
          created_at: string | null
          id: string
          message: string | null
          new_status: string
          old_status: string | null
          prescription_id: string
        }
        Insert: {
          changed_by?: string | null
          channel: string
          clinic_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          new_status: string
          old_status?: string | null
          prescription_id: string
        }
        Update: {
          changed_by?: string | null
          channel?: string
          clinic_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          new_status?: string
          old_status?: string | null
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_delivery_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_delivery_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_delivery_logs_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          clinic_id: string
          created_at: string | null
          dosage: string | null
          duration: string | null
          food_instruction: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medicine_id: string | null
          medicine_name: string
          metadata: Json | null
          prescription_id: string
          quantity: string | null
          reminder_enabled: boolean | null
          reminder_end_date: string | null
          reminder_frequency: string | null
          reminder_start_date: string | null
          sort_order: number | null
          timing: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          dosage?: string | null
          duration?: string | null
          food_instruction?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_id?: string | null
          medicine_name: string
          metadata?: Json | null
          prescription_id: string
          quantity?: string | null
          reminder_enabled?: boolean | null
          reminder_end_date?: string | null
          reminder_frequency?: string | null
          reminder_start_date?: string | null
          sort_order?: number | null
          timing?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          dosage?: string | null
          duration?: string | null
          food_instruction?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_id?: string | null
          medicine_name?: string
          metadata?: Json | null
          prescription_id?: string
          quantity?: string | null
          reminder_enabled?: boolean | null
          reminder_end_date?: string | null
          reminder_frequency?: string | null
          reminder_start_date?: string | null
          sort_order?: number | null
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          advice: string | null
          appointment_id: string | null
          branch_id: string | null
          clinic_id: string
          consultation_id: string | null
          created_at: string | null
          created_by: string | null
          delivery_channel: string | null
          delivery_status: string | null
          diagnosis_summary: string | null
          doctor_id: string
          finalized_at: string | null
          follow_up_date: string | null
          id: string
          metadata: Json | null
          patient_id: string
          pharmacy_status: string | null
          send_to_pharmacy: boolean | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          advice?: string | null
          appointment_id?: string | null
          branch_id?: string | null
          clinic_id: string
          consultation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_channel?: string | null
          delivery_status?: string | null
          diagnosis_summary?: string | null
          doctor_id: string
          finalized_at?: string | null
          follow_up_date?: string | null
          id?: string
          metadata?: Json | null
          patient_id: string
          pharmacy_status?: string | null
          send_to_pharmacy?: boolean | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          advice?: string | null
          appointment_id?: string | null
          branch_id?: string | null
          clinic_id?: string
          consultation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_channel?: string | null
          delivery_status?: string | null
          diagnosis_summary?: string | null
          doctor_id?: string
          finalized_at?: string | null
          follow_up_date?: string | null
          id?: string
          metadata?: Json | null
          patient_id?: string
          pharmacy_status?: string | null
          send_to_pharmacy?: boolean | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          data: Json
          generated_at: string | null
          generated_by: string | null
          id: string
          period_end: string | null
          period_start: string | null
          report_type: string
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          data?: Json
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_type: string
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          data?: Json
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_snapshots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_snapshots_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_modules: {
        Row: {
          created_at: string | null
          enabled: boolean
          module_key: string
          role_key: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          module_key: string
          role_key: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          module_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_modules_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          created_at: string | null
          permission_key: string
          role_key: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string | null
          permission_key: string
          role_key: string
        }
        Update: {
          allowed?: boolean
          created_at?: string | null
          permission_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          key: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key?: string
          name?: string
        }
        Relationships: []
      }
      staff_modules: {
        Row: {
          created_at: string | null
          enabled: boolean
          module_key: string
          staff_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          module_key: string
          staff_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          module_key?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "staff_modules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          allowed: boolean
          created_at: string | null
          permission_key: string
          staff_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string | null
          permission_key: string
          staff_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string | null
          permission_key?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "staff_permissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          clinic_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          metadata: Json
          phone: string | null
          role_key: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id: string
          metadata?: Json
          phone?: string | null
          role_key: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          metadata?: Json
          phone?: string | null
          role_key?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          id: string
          medicine_id: string
          movement_type: string
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          batch_id?: string | null
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          medicine_id: string
          movement_type: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          batch_id?: string | null
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          medicine_id?: string
          movement_type?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          current_step: string | null
          id: string
          last_message: string | null
          linked_appointment_id: string | null
          metadata: Json
          patient_id: string | null
          phone_number: string
          source: string
          status: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          current_step?: string | null
          id?: string
          last_message?: string | null
          linked_appointment_id?: string | null
          metadata?: Json
          patient_id?: string | null
          phone_number: string
          source?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          current_step?: string | null
          id?: string
          last_message?: string | null
          linked_appointment_id?: string | null
          metadata?: Json
          patient_id?: string | null
          phone_number?: string
          source?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_linked_appointment_id_fkey"
            columns: ["linked_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_delivery_logs: {
        Row: {
          branch_id: string | null
          clinic_id: string
          conversation_id: string | null
          created_at: string | null
          created_by: string | null
          delivery_status: string
          id: string
          message_id: string | null
          metadata: Json
          patient_id: string | null
          payload: Json
          phone_number: string | null
          provider_message_id: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_status?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          patient_id?: string | null
          payload?: Json
          phone_number?: string | null
          provider_message_id?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_status?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          patient_id?: string | null
          payload?: Json
          phone_number?: string | null
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_delivery_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_delivery_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_delivery_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_delivery_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_delivery_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_delivery_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          branch_id: string | null
          clinic_id: string
          conversation_id: string | null
          created_at: string | null
          delivery_status: string
          direction: string
          id: string
          message_type: string
          metadata: Json
          patient_id: string | null
          payload: Json
          phone_number: string
          provider_message_id: string | null
          related_id: string | null
          related_type: string | null
          sender_type: string
          sent_by: string | null
          status: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          branch_id?: string | null
          clinic_id: string
          conversation_id?: string | null
          created_at?: string | null
          delivery_status?: string
          direction: string
          id?: string
          message_type?: string
          metadata?: Json
          patient_id?: string | null
          payload?: Json
          phone_number: string
          provider_message_id?: string | null
          related_id?: string | null
          related_type?: string | null
          sender_type?: string
          sent_by?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          branch_id?: string | null
          clinic_id?: string
          conversation_id?: string | null
          created_at?: string | null
          delivery_status?: string
          direction?: string
          id?: string
          message_type?: string
          metadata?: Json
          patient_id?: string | null
          payload?: Json
          phone_number?: string
          provider_message_id?: string | null
          related_id?: string | null
          related_type?: string | null
          sender_type?: string
          sent_by?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_patient_consents: {
        Row: {
          branch_id: string | null
          clinic_id: string
          consent_source: string
          consent_status: string
          consented_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json
          patient_id: string | null
          payload: Json
          phone_number: string
          revoked_at: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          consent_source?: string
          consent_status?: string
          consented_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json
          patient_id?: string | null
          payload?: Json
          phone_number: string
          revoked_at?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          consent_source?: string
          consent_status?: string
          consented_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json
          patient_id?: string | null
          payload?: Json
          phone_number?: string
          revoked_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_patient_consents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_patient_consents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_patient_consents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_patient_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          branch_id: string | null
          category: string
          clinic_id: string
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json
          name: string
          provider_template_id: string | null
          status: string
          updated_at: string | null
          variables: Json
        }
        Insert: {
          body: string
          branch_id?: string | null
          category?: string
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json
          name: string
          provider_template_id?: string | null
          status?: string
          updated_at?: string | null
          variables?: Json
        }
        Update: {
          body?: string
          branch_id?: string | null
          category?: string
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json
          name?: string
          provider_template_id?: string | null
          status?: string
          updated_at?: string | null
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          event_type: string
          id: string
          metadata: Json
          payload: Json
          provider: string
          provider_event_id: string | null
          received_at: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          payload?: Json
          provider?: string
          provider_event_id?: string | null
          received_at?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          payload?: Json
          provider?: string
          provider_event_id?: string | null
          received_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_services: {
        Row: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          department: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_bookable: boolean
          metadata: Json
          name: string
          price: number
          sort_order: number
          status: string
          tax_rate: number
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_bookable?: boolean
          metadata?: Json
          name: string
          price?: number
          sort_order?: number
          status?: string
          tax_rate?: number
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_bookable?: boolean
          metadata?: Json
          name?: string
          price?: number
          sort_order?: number
          status?: string
          tax_rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_favorite_medicines: {
        Row: {
          clinic_id: string
          created_at: string | null
          default_dosage: string | null
          default_duration: string | null
          default_frequency: string | null
          default_timing: string | null
          doctor_id: string | null
          id: string
          medicine_id: string | null
          medicine_name: string
          sort_order: number
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          default_dosage?: string | null
          default_duration?: string | null
          default_frequency?: string | null
          default_timing?: string | null
          doctor_id?: string | null
          id?: string
          medicine_id?: string | null
          medicine_name: string
          sort_order?: number
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          default_dosage?: string | null
          default_duration?: string | null
          default_frequency?: string | null
          default_timing?: string | null
          doctor_id?: string | null
          id?: string
          medicine_id?: string | null
          medicine_name?: string
          sort_order?: number
          updated_at?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_favorite_medicines_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_refunds: {
        Row: {
          approved_by: string | null
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          id: string
          invoice_id: string
          metadata: Json
          original_amount: number
          patient_id: string
          processed_at: string | null
          reason: string
          refund_amount: number
          refund_mode: string
          requested_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          invoice_id: string
          metadata?: Json
          original_amount?: number
          patient_id: string
          processed_at?: string | null
          reason: string
          refund_amount?: number
          refund_mode?: string
          requested_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json
          original_amount?: number
          patient_id?: string
          processed_at?: string | null
          reason?: string
          refund_amount?: number
          refund_mode?: string
          requested_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_refunds_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_refunds_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          category: string | null
          clinic_id: string
          created_at: string | null
          id: string
          name: string
          price: number
          sort_order: number
          status: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          name: string
          price?: number
          sort_order?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          sort_order?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      prescription_template_items: {
        Row: {
          clinic_id: string
          created_at: string | null
          dosage: string | null
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medicine_id: string | null
          medicine_name: string
          quantity: string | null
          sort_order: number
          template_id: string
          timing: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_id?: string | null
          medicine_name: string
          quantity?: string | null
          sort_order?: number
          template_id: string
          timing?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_id?: string | null
          medicine_name?: string
          quantity?: string | null
          sort_order?: number
          template_id?: string
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prescription_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_templates: {
        Row: {
          advice: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          doctor_id: string | null
          id: string
          name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          advice?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          doctor_id?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          advice?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          doctor_id?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_templates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          clinic_id: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json
          priority: string
          raised_by: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          priority?: string
          raised_by?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          priority?: string
          raised_by?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_purchases: {
        Row: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          id: string
          invoice_number: string
          metadata: Json
          notes: string | null
          purchase_date: string
          status: string
          supplier_name: string
          supplier_phone: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_number: string
          metadata?: Json
          notes?: string | null
          purchase_date?: string
          status?: string
          supplier_name: string
          supplier_phone?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_number?: string
          metadata?: Json
          notes?: string | null
          purchase_date?: string
          status?: string
          supplier_name?: string
          supplier_phone?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_medicine_stock: {
        Args: { input: Json }
        Returns: {
          batch_no: string
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          expiry_date: string | null
          id: string
          medicine_id: string
          mrp: number | null
          purchase_id: string | null
          purchase_price: number | null
          quantity_available: number
          selling_price: number | null
          status: string | null
          supplier_name: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "medicine_stock_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      book_appointment_for_patient: {
        Args: { input: Json }
        Returns: {
          appointment_date: string
          appointment_time: string | null
          assigned_by: string | null
          branch_id: string | null
          cancelled_reason: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          department: string | null
          doctor_id: string | null
          id: string
          is_new_patient: boolean | null
          main_problem: string | null
          metadata: Json | null
          patient_id: string
          slot_id: string | null
          source: string | null
          status: string | null
          token_number: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_manage_whatsapp: { Args: { action_key: string }; Returns: boolean }
      can_view_patient_whatsapp: {
        Args: { target_clinic_id: string; target_patient_id: string }
        Returns: boolean
      }
      cancel_invoice: {
        Args: { invoice_id: string; reason: string }
        Returns: {
          appointment_id: string | null
          balance_amount: number
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          clinic_id: string
          consultation_id: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number
          id: string
          invoice_number: string
          invoice_status: string
          invoice_type: string | null
          metadata: Json | null
          notes: string | null
          paid_amount: number
          patient_id: string
          payment_status: string
          pharmacy_order_id: string | null
          prescription_id: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_appointment_with_slot: {
        Args: { input: Json }
        Returns: {
          appointment_date: string
          appointment_time: string | null
          assigned_by: string | null
          branch_id: string | null
          cancelled_reason: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          department: string | null
          doctor_id: string | null
          id: string
          is_new_patient: boolean | null
          main_problem: string | null
          metadata: Json | null
          patient_id: string
          slot_id: string | null
          source: string | null
          status: string | null
          token_number: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invoice_from_pharmacy_order: {
        Args: { pharmacy_order_id: string }
        Returns: {
          appointment_id: string | null
          balance_amount: number
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          clinic_id: string
          consultation_id: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number
          id: string
          invoice_number: string
          invoice_status: string
          invoice_type: string | null
          metadata: Json | null
          notes: string | null
          paid_amount: number
          patient_id: string
          payment_status: string
          pharmacy_order_id: string | null
          prescription_id: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invoice_with_items: { Args: { input: Json }; Returns: Json }
      create_pharmacy_order_from_prescription: {
        Args: { prescription_id: string }
        Returns: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          dispensed_at: string | null
          dispensed_by: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          patient_id: string
          prescription_id: string
          status: string | null
          total_items: number | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pharmacy_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_prescription_with_items: { Args: { input: Json }; Returns: Json }
      create_pharmacy_counter_sale: { Args: { input: Json }; Returns: Json }
      create_stock_purchase: { Args: { input: Json }; Returns: Json }
      current_clinic_id: { Args: never; Returns: string }
      current_staff_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          branch_id: string | null
          clinic_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          metadata: Json
          phone: string | null
          role_key: string
          status: string
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dispense_pharmacy_order: {
        Args: { input: Json }
        Returns: {
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          dispensed_at: string | null
          dispensed_by: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          patient_id: string
          prescription_id: string
          status: string | null
          total_items: number | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pharmacy_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_doctor_slots: {
        Args: { p_date: string; p_doctor_id: string }
        Returns: undefined
      }
      has_module: { Args: { module_key: string }; Returns: boolean }
      has_permission: { Args: { permission_key: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      next_invoice_number: {
        Args: { target_clinic_id: string }
        Returns: string
      }
      next_token_number: {
        Args: { target_clinic_id: string; target_date: string }
        Returns: string
      }
      public_booking_status: {
        Args: { p_phone: string; p_reference: string }
        Returns: Json
      }
      public_clinic_booking_profile: {
        Args: { clinic_slug: string }
        Returns: Json
      }
      public_published_clinics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      public_clinic_doctors: { Args: { clinic_slug: string }; Returns: Json }
      public_clinic_services: { Args: { clinic_slug: string }; Returns: Json }
      public_create_booking: { Args: { input: Json }; Returns: Json }
      public_doctor_available_dates: {
        Args: { p_days?: number; p_doctor_id: string }
        Returns: Json
      }
      public_doctor_available_slots: {
        Args: { p_date: string; p_doctor_id: string }
        Returns: Json
      }
      record_manual_payment: {
        Args: { input: Json }
        Returns: {
          appointment_id: string | null
          balance_amount: number
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          clinic_id: string
          consultation_id: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number
          id: string
          invoice_number: string
          invoice_status: string
          invoice_type: string | null
          metadata: Json | null
          notes: string | null
          paid_amount: number
          patient_id: string
          payment_status: string
          pharmacy_order_id: string | null
          prescription_id: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_low_stock_alerts: {
        Args: { branch_id?: string; clinic_id: string }
        Returns: number
      }
      acknowledge_pharmacy_order: { Args: { order_id: string }; Returns: Json }
      mark_pharmacy_order_item_unavailable: { Args: { input: Json }; Returns: Json }
      set_medicine_batch_status: {
        Args: { input: Json }
        Returns: {
          batch_no: string
          branch_id: string | null
          clinic_id: string
          created_at: string | null
          expiry_date: string | null
          id: string
          medicine_id: string
          mrp: number | null
          purchase_id: string | null
          purchase_price: number | null
          quantity_available: number
          selling_price: number | null
          status: string | null
          supplier_name: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "medicine_stock_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_staff_login_email: {
        Args: { staff_user_id: string }
        Returns: string
      }
      route_prescription_to_pharmacy: {
        Args: { prescription_id: string }
        Returns: {
          advice: string | null
          appointment_id: string | null
          branch_id: string | null
          clinic_id: string
          consultation_id: string | null
          created_at: string | null
          created_by: string | null
          delivery_channel: string | null
          delivery_status: string | null
          diagnosis_summary: string | null
          doctor_id: string
          finalized_at: string | null
          follow_up_date: string | null
          id: string
          metadata: Json | null
          patient_id: string
          pharmacy_status: string | null
          send_to_pharmacy: boolean | null
          status: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "prescriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_appointment_status: {
        Args: { appointment_id: string; new_status: string; reason?: string }
        Returns: {
          appointment_date: string
          appointment_time: string | null
          assigned_by: string | null
          branch_id: string | null
          cancelled_reason: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          department: string | null
          doctor_id: string | null
          id: string
          is_new_patient: boolean | null
          main_problem: string | null
          metadata: Json | null
          patient_id: string
          slot_id: string | null
          source: string | null
          status: string | null
          token_number: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_prescription_delivery_status: {
        Args: { message?: string; new_status: string; prescription_id: string }
        Returns: {
          advice: string | null
          appointment_id: string | null
          branch_id: string | null
          clinic_id: string
          consultation_id: string | null
          created_at: string | null
          created_by: string | null
          delivery_channel: string | null
          delivery_status: string | null
          diagnosis_summary: string | null
          doctor_id: string
          finalized_at: string | null
          follow_up_date: string | null
          id: string
          metadata: Json | null
          patient_id: string
          pharmacy_status: string | null
          send_to_pharmacy: boolean | null
          status: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "prescriptions"
          isOneToOne: true
          isSetofReturn: false
        }
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
