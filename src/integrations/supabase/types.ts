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
      announcements: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          publish_at: string | null
          status: Database["public"]["Enums"]["announcement_status"]
          target_id: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          target_type: Database["public"]["Enums"]["announcement_target"]
          title: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          publish_at?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          target_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_type?: Database["public"]["Enums"]["announcement_target"]
          title: string
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          publish_at?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          target_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_type?: Database["public"]["Enums"]["announcement_target"]
          title?: string
          workspace_id?: string
        }
        Relationships: []
      }
      assignment_submission_history: {
        Row: {
          assignment_id: string
          attempt_number: number
          file_paths: Json
          grade: number | null
          id: string
          private_feedback: string | null
          public_feedback: string | null
          snapshot_at: string
          status: string | null
          student_id: string
          submission_id: string
          submission_text: string | null
          workspace_id: string
        }
        Insert: {
          assignment_id: string
          attempt_number: number
          file_paths?: Json
          grade?: number | null
          id?: string
          private_feedback?: string | null
          public_feedback?: string | null
          snapshot_at?: string
          status?: string | null
          student_id: string
          submission_id: string
          submission_text?: string | null
          workspace_id: string
        }
        Update: {
          assignment_id?: string
          attempt_number?: number
          file_paths?: Json
          grade?: number | null
          id?: string
          private_feedback?: string | null
          public_feedback?: string | null
          snapshot_at?: string
          status?: string | null
          student_id?: string
          submission_id?: string
          submission_text?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submission_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submission_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submission_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submission_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          attempt_number: number
          feedback: string | null
          feedback_file_path: string | null
          file_path: string | null
          file_paths: Json
          grade: number | null
          graded_at: string | null
          id: string
          is_draft: boolean
          is_late: boolean
          passed: boolean | null
          private_feedback: string | null
          public_feedback: string | null
          returned_for_revision_at: string | null
          review_comments: string | null
          rubric_scores: Json
          status: string
          student_id: string
          submission_text: string | null
          submitted_at: string
          workspace_id: string
        }
        Insert: {
          assignment_id: string
          attempt_number?: number
          feedback?: string | null
          feedback_file_path?: string | null
          file_path?: string | null
          file_paths?: Json
          grade?: number | null
          graded_at?: string | null
          id?: string
          is_draft?: boolean
          is_late?: boolean
          passed?: boolean | null
          private_feedback?: string | null
          public_feedback?: string | null
          returned_for_revision_at?: string | null
          review_comments?: string | null
          rubric_scores?: Json
          status?: string
          student_id: string
          submission_text?: string | null
          submitted_at?: string
          workspace_id: string
        }
        Update: {
          assignment_id?: string
          attempt_number?: number
          feedback?: string | null
          feedback_file_path?: string | null
          file_path?: string | null
          file_paths?: Json
          grade?: number | null
          graded_at?: string | null
          id?: string
          is_draft?: boolean
          is_late?: boolean
          passed?: boolean | null
          private_feedback?: string | null
          public_feedback?: string | null
          returned_for_revision_at?: string | null
          review_comments?: string | null
          rubric_scores?: Json
          status?: string
          student_id?: string
          submission_text?: string | null
          submitted_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          additional_notes: string | null
          allow_file_upload: boolean
          allow_resubmission: boolean
          allowed_file_types: Json
          attachments: Json
          course_id: string
          created_at: string
          description: string | null
          due_at: string | null
          evaluation_criteria: string | null
          grading_type: string
          id: string
          instructions: string | null
          late_penalty_pct: number
          late_policy: string
          lesson_id: string | null
          max_file_size_mb: number
          max_files: number
          max_points: number
          max_resubmissions: number
          notify_settings: Json
          passing_marks: number | null
          position: number
          rubric: Json
          scheduled_publish_at: string | null
          section_id: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          submission_guidelines: string | null
          submission_type: string
          time_limit: number | null
          time_limit_unit: string
          title: string
          workspace_id: string
        }
        Insert: {
          additional_notes?: string | null
          allow_file_upload?: boolean
          allow_resubmission?: boolean
          allowed_file_types?: Json
          attachments?: Json
          course_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          evaluation_criteria?: string | null
          grading_type?: string
          id?: string
          instructions?: string | null
          late_penalty_pct?: number
          late_policy?: string
          lesson_id?: string | null
          max_file_size_mb?: number
          max_files?: number
          max_points?: number
          max_resubmissions?: number
          notify_settings?: Json
          passing_marks?: number | null
          position?: number
          rubric?: Json
          scheduled_publish_at?: string | null
          section_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          submission_guidelines?: string | null
          submission_type?: string
          time_limit?: number | null
          time_limit_unit?: string
          title: string
          workspace_id: string
        }
        Update: {
          additional_notes?: string | null
          allow_file_upload?: boolean
          allow_resubmission?: boolean
          allowed_file_types?: Json
          attachments?: Json
          course_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          evaluation_criteria?: string | null
          grading_type?: string
          id?: string
          instructions?: string | null
          late_penalty_pct?: number
          late_policy?: string
          lesson_id?: string | null
          max_file_size_mb?: number
          max_files?: number
          max_points?: number
          max_resubmissions?: number
          notify_settings?: Json
          passing_marks?: number | null
          position?: number
          rubric?: Json
          scheduled_publish_at?: string | null
          section_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          submission_guidelines?: string | null
          submission_type?: string
          time_limit?: number | null
          time_limit_unit?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          id: string
          marked_at: string
          marked_by: string | null
          notes: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          attendance_type: Database["public"]["Enums"]["attendance_type"]
          batch_id: string | null
          course_id: string
          created_at: string
          created_by: string | null
          end_time: string | null
          id: string
          instructor_id: string | null
          lesson_id: string | null
          live_class_id: string | null
          locked_at: string | null
          notes: string | null
          session_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["attendance_session_status"]
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attendance_type?: Database["public"]["Enums"]["attendance_type"]
          batch_id?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          instructor_id?: string | null
          lesson_id?: string | null
          live_class_id?: string | null
          locked_at?: string | null
          notes?: string | null
          session_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["attendance_session_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attendance_type?: Database["public"]["Enums"]["attendance_type"]
          batch_id?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          instructor_id?: string | null
          lesson_id?: string | null
          live_class_id?: string | null
          locked_at?: string | null
          notes?: string | null
          session_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["attendance_session_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          attendance_lock_hours: number
          auto_attendance_enabled: boolean
          created_at: string
          geo_enabled: boolean
          id: string
          late_threshold_minutes: number
          minimum_attendance_percentage: number
          notify_on_absent: boolean
          otp_enabled: boolean
          qr_enabled: boolean
          updated_at: string
          working_days: Json
          workspace_id: string
        }
        Insert: {
          attendance_lock_hours?: number
          auto_attendance_enabled?: boolean
          created_at?: string
          geo_enabled?: boolean
          id?: string
          late_threshold_minutes?: number
          minimum_attendance_percentage?: number
          notify_on_absent?: boolean
          otp_enabled?: boolean
          qr_enabled?: boolean
          updated_at?: string
          working_days?: Json
          workspace_id: string
        }
        Update: {
          attendance_lock_hours?: number
          auto_attendance_enabled?: boolean
          created_at?: string
          geo_enabled?: boolean
          id?: string
          late_threshold_minutes?: number
          minimum_attendance_percentage?: number
          notify_on_absent?: boolean
          otp_enabled?: boolean
          qr_enabled?: boolean
          updated_at?: string
          working_days?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_courses: {
        Row: {
          batch_id: string
          course_id: string
          created_at: string
          id: string
          position: number
        }
        Insert: {
          batch_id: string
          course_id: string
          created_at?: string
          id?: string
          position?: number
        }
        Update: {
          batch_id?: string
          course_id?: string
          created_at?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_courses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_students: {
        Row: {
          added_at: string
          added_by: string | null
          admission_date: string | null
          batch_id: string
          department: string | null
          gender: string | null
          id: string
          institution_id: string | null
          notes: string | null
          registration_number: string | null
          roll_number: string | null
          semester: string | null
          student_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          admission_date?: string | null
          batch_id: string
          department?: string | null
          gender?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          registration_number?: string | null
          roll_number?: string | null
          semester?: string | null
          student_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          admission_date?: string | null
          batch_id?: string
          department?: string | null
          gender?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          registration_number?: string | null
          roll_number?: string | null
          semester?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_students_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          code: string
          coordinator_email: string | null
          coordinator_id: string | null
          coordinator_name: string | null
          coordinator_phone: string | null
          created_at: string
          description: string | null
          duration_type: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
          validity_custom_end: string | null
          validity_type: string
          workspace_id: string
        }
        Insert: {
          code: string
          coordinator_email?: string | null
          coordinator_id?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string
          description?: string | null
          duration_type?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
          validity_custom_end?: string | null
          validity_type?: string
          workspace_id: string
        }
        Update: {
          code?: string
          coordinator_email?: string | null
          coordinator_id?: string | null
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string
          description?: string | null
          duration_type?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          validity_custom_end?: string | null
          validity_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_courses: {
        Row: {
          bundle_id: string
          course_id: string
          created_at: string
          id: string
          is_mandatory: boolean
          position: number
          workspace_id: string
        }
        Insert: {
          bundle_id: string
          course_id: string
          created_at?: string
          id?: string
          is_mandatory?: boolean
          position?: number
          workspace_id: string
        }
        Update: {
          bundle_id?: string
          course_id?: string
          created_at?: string
          id?: string
          is_mandatory?: boolean
          position?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_courses_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_courses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          accent_color: string
          background_style: string
          background_url: string | null
          body_template: string
          created_at: string
          design_json: Json | null
          id: string
          is_default: boolean
          layout_style: string
          logo_url: string | null
          name: string
          orientation: string
          show_certificate_number: boolean
          show_completion_date: boolean
          show_percentage: boolean
          show_qr: boolean
          signature_image_url: string | null
          signature_name: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accent_color?: string
          background_style?: string
          background_url?: string | null
          body_template?: string
          created_at?: string
          design_json?: Json | null
          id?: string
          is_default?: boolean
          layout_style?: string
          logo_url?: string | null
          name: string
          orientation?: string
          show_certificate_number?: boolean
          show_completion_date?: boolean
          show_percentage?: boolean
          show_qr?: boolean
          signature_image_url?: string | null
          signature_name?: string | null
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accent_color?: string
          background_style?: string
          background_url?: string | null
          body_template?: string
          created_at?: string
          design_json?: Json | null
          id?: string
          is_default?: boolean
          layout_style?: string
          logo_url?: string | null
          name?: string
          orientation?: string
          show_certificate_number?: boolean
          show_completion_date?: boolean
          show_percentage?: boolean
          show_qr?: boolean
          signature_image_url?: string | null
          signature_name?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          completion_date: string | null
          completion_percentage: number | null
          course_id: string
          id: string
          issued_at: string
          metadata: Json
          pdf_url: string | null
          revoked_at: string | null
          student_id: string
          template_id: string | null
          template_snapshot: Json | null
          updated_at: string
          verification_code: string
          workspace_id: string
        }
        Insert: {
          certificate_number: string
          completion_date?: string | null
          completion_percentage?: number | null
          course_id: string
          id?: string
          issued_at?: string
          metadata?: Json
          pdf_url?: string | null
          revoked_at?: string | null
          student_id: string
          template_id?: string | null
          template_snapshot?: Json | null
          updated_at?: string
          verification_code: string
          workspace_id: string
        }
        Update: {
          certificate_number?: string
          completion_date?: string | null
          completion_percentage?: number | null
          course_id?: string
          id?: string
          issued_at?: string
          metadata?: Json
          pdf_url?: string | null
          revoked_at?: string | null
          student_id?: string
          template_id?: string | null
          template_snapshot?: Json | null
          updated_at?: string
          verification_code?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          commission_percentage: number
          course_id: string | null
          created_at: string
          id: string
          instructor_id: string | null
          notes: string | null
          scope: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          commission_percentage: number
          course_id?: string | null
          created_at?: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          scope: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          commission_percentage?: number
          course_id?: string | null
          created_at?: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          scope?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_settings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_settings_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string
          subject: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
          subject?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
          subject?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      content_protection_settings: {
        Row: {
          apply_on_public_site: boolean
          created_at: string
          devtools_detection: boolean
          disable_copy: boolean
          disable_image_drag: boolean
          disable_keyboard_shortcuts: boolean
          disable_print: boolean
          disable_right_click: boolean
          disable_text_selection: boolean
          dynamic_watermark: boolean
          id: string
          pdf_protection: boolean
          screenshot_deterrence: boolean
          updated_at: string
          video_watermark: boolean
          workspace_id: string
        }
        Insert: {
          apply_on_public_site?: boolean
          created_at?: string
          devtools_detection?: boolean
          disable_copy?: boolean
          disable_image_drag?: boolean
          disable_keyboard_shortcuts?: boolean
          disable_print?: boolean
          disable_right_click?: boolean
          disable_text_selection?: boolean
          dynamic_watermark?: boolean
          id?: string
          pdf_protection?: boolean
          screenshot_deterrence?: boolean
          updated_at?: string
          video_watermark?: boolean
          workspace_id: string
        }
        Update: {
          apply_on_public_site?: boolean
          created_at?: string
          devtools_detection?: boolean
          disable_copy?: boolean
          disable_image_drag?: boolean
          disable_keyboard_shortcuts?: boolean
          disable_print?: boolean
          disable_right_click?: boolean
          disable_text_selection?: boolean
          dynamic_watermark?: boolean
          id?: string
          pdf_protection?: boolean
          screenshot_deterrence?: boolean
          updated_at?: string
          video_watermark?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_protection_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          profile_id: string
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          profile_id: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          profile_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          last_message_at: string
          title: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          title?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          title?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          applies_to: string
          code: string
          course_ids: Json | null
          created_at: string
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          ends_at: string | null
          id: string
          max_redemptions: number | null
          redeemed_count: number
          starts_at: string | null
          status: Database["public"]["Enums"]["coupon_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          applies_to?: string
          code: string
          course_ids?: Json | null
          created_at?: string
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          max_redemptions?: number | null
          redeemed_count?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["coupon_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          applies_to?: string
          code?: string
          course_ids?: Json | null
          created_at?: string
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          max_redemptions?: number | null
          redeemed_count?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["coupon_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      course_assets: {
        Row: {
          course_id: string
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          public_url: string
          storage_path: string | null
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          public_url: string
          storage_path?: string | null
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          public_url?: string
          storage_path?: string | null
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      course_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          course_id: string
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          new_status: string | null
          previous_status: string | null
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          course_id: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          new_status?: string | null
          previous_status?: string | null
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          course_id?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          new_status?: string | null
          previous_status?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_audit_log_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_bundles: {
        Row: {
          access_duration: number | null
          access_type: string
          banner_url: string | null
          category: string | null
          certificate_mode: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          instructor_id: string | null
          is_featured: boolean
          name: string
          regular_price: number
          sale_price: number | null
          short_description: string | null
          slug: string
          status: string
          tags: string[]
          thumbnail_url: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_duration?: number | null
          access_type?: string
          banner_url?: string | null
          category?: string | null
          certificate_mode?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          instructor_id?: string | null
          is_featured?: boolean
          name: string
          regular_price?: number
          sale_price?: number | null
          short_description?: string | null
          slug: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_duration?: number | null
          access_type?: string
          banner_url?: string | null
          category?: string | null
          certificate_mode?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          instructor_id?: string | null
          is_featured?: boolean
          name?: string
          regular_price?: number
          sale_price?: number | null
          short_description?: string | null
          slug?: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_bundles_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_bundles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      course_categories: {
        Row: {
          course_count: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_trending: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          course_count?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_trending?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          course_count?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_trending?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      course_deletion_requests: {
        Row: {
          course_id: string
          created_at: string
          executed_at: string | null
          execution_type: string | null
          id: string
          reason: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["course_deletion_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          executed_at?: string | null
          execution_type?: string | null
          id?: string
          reason?: string | null
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["course_deletion_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          executed_at?: string | null
          execution_type?: string | null
          id?: string
          reason?: string | null
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["course_deletion_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_deletion_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_deletion_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_deletion_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_deletion_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      course_instructors: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          course_id: string
          id: string
          instructor_id: string
          workspace_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          course_id: string
          id?: string
          instructor_id: string
          workspace_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          course_id?: string
          id?: string
          instructor_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      course_launch_subscribers: {
        Row: {
          course_id: string
          created_at: string
          email: string
          id: string
          notified_at: string | null
          profile_id: string | null
          workspace_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          profile_id?: string | null
          workspace_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          profile_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_launch_subscribers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_launch_subscribers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_launch_subscribers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      course_prerequisites: {
        Row: {
          course_id: string
          created_at: string
          id: string
          prerequisite_course_id: string
          workspace_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          prerequisite_course_id: string
          workspace_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          prerequisite_course_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_prerequisites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_prerequisites_prerequisite_course_id_fkey"
            columns: ["prerequisite_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_prerequisites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          course_id: string
          created_at: string
          id: string
          position: number
          title: string
          workspace_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          position?: number
          title: string
          workspace_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          access_duration: number | null
          access_duration_type: string
          allow_coupons: boolean
          allow_preview: boolean
          auto_issue_certificate: boolean
          badges: Json
          boards: string[]
          category: string | null
          cert_require_assignment_completion: boolean
          cert_require_full_completion: boolean
          cert_require_quiz_pass: boolean
          certificate_eligibility_threshold: number | null
          certificate_eligibility_type: string
          certificate_template_id: string | null
          child_category: string | null
          coming_soon_thumbnail_url: string | null
          course_password: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          difficulty: string
          discount_ends_at: string | null
          discount_starts_at: string | null
          discount_type: string
          discount_value: number | null
          discussion_settings: Json
          enable_certificates: boolean
          enable_discussion: boolean
          enrollment_end_at: string | null
          enrollment_start_at: string | null
          enrollment_type: string
          estimated_completion_minutes: number | null
          gst_rate: number | null
          id: string
          instructor_id: string | null
          intro_video_provider: string | null
          intro_video_url: string | null
          is_best_seller: boolean
          is_editors_choice: boolean
          is_enrollment_paused: boolean
          is_featured: boolean
          is_new: boolean
          is_trending: boolean
          language: string
          languages: string[]
          launch_at: string | null
          learning_outcomes: Json
          level: string
          materials_included: Json
          min_attendance_percentage: number
          og_image_url: string | null
          passing_percentage: number
          preview_mode: string
          price_amount: number
          pricing_type: string
          require_attendance: boolean
          requirements: Json
          revenue_fixed_amount: number | null
          revenue_instructor_pct: number | null
          revenue_max_settlement: number | null
          revenue_min_settlement: number | null
          revenue_model: Database["public"]["Enums"]["course_revenue_type"]
          revenue_one_time_amount: number | null
          revenue_one_time_paid_at: string | null
          revenue_per_student_amount: number | null
          revenue_platform_pct: number | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sale_price: number | null
          seo_description: string | null
          seo_focus_keyword: string | null
          seo_title: string | null
          settlement_frequency: Database["public"]["Enums"]["settlement_frequency"]
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          subcategory: string | null
          submitted_for_review_at: string | null
          summary: string | null
          tags: string[] | null
          target_audience: Json
          tax_inclusive: boolean
          thumbnail_url: string | null
          title: string
          total_duration_minutes: number | null
          updated_at: string
          visibility: Database["public"]["Enums"]["course_visibility"]
          workspace_id: string
        }
        Insert: {
          access_duration?: number | null
          access_duration_type?: string
          allow_coupons?: boolean
          allow_preview?: boolean
          auto_issue_certificate?: boolean
          badges?: Json
          boards?: string[]
          category?: string | null
          cert_require_assignment_completion?: boolean
          cert_require_full_completion?: boolean
          cert_require_quiz_pass?: boolean
          certificate_eligibility_threshold?: number | null
          certificate_eligibility_type?: string
          certificate_template_id?: string | null
          child_category?: string | null
          coming_soon_thumbnail_url?: string | null
          course_password?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          difficulty?: string
          discount_ends_at?: string | null
          discount_starts_at?: string | null
          discount_type?: string
          discount_value?: number | null
          discussion_settings?: Json
          enable_certificates?: boolean
          enable_discussion?: boolean
          enrollment_end_at?: string | null
          enrollment_start_at?: string | null
          enrollment_type?: string
          estimated_completion_minutes?: number | null
          gst_rate?: number | null
          id?: string
          instructor_id?: string | null
          intro_video_provider?: string | null
          intro_video_url?: string | null
          is_best_seller?: boolean
          is_editors_choice?: boolean
          is_enrollment_paused?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_trending?: boolean
          language?: string
          languages?: string[]
          launch_at?: string | null
          learning_outcomes?: Json
          level?: string
          materials_included?: Json
          min_attendance_percentage?: number
          og_image_url?: string | null
          passing_percentage?: number
          preview_mode?: string
          price_amount?: number
          pricing_type?: string
          require_attendance?: boolean
          requirements?: Json
          revenue_fixed_amount?: number | null
          revenue_instructor_pct?: number | null
          revenue_max_settlement?: number | null
          revenue_min_settlement?: number | null
          revenue_model?: Database["public"]["Enums"]["course_revenue_type"]
          revenue_one_time_amount?: number | null
          revenue_one_time_paid_at?: string | null
          revenue_per_student_amount?: number | null
          revenue_platform_pct?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_price?: number | null
          seo_description?: string | null
          seo_focus_keyword?: string | null
          seo_title?: string | null
          settlement_frequency?: Database["public"]["Enums"]["settlement_frequency"]
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          subcategory?: string | null
          submitted_for_review_at?: string | null
          summary?: string | null
          tags?: string[] | null
          target_audience?: Json
          tax_inclusive?: boolean
          thumbnail_url?: string | null
          title: string
          total_duration_minutes?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["course_visibility"]
          workspace_id: string
        }
        Update: {
          access_duration?: number | null
          access_duration_type?: string
          allow_coupons?: boolean
          allow_preview?: boolean
          auto_issue_certificate?: boolean
          badges?: Json
          boards?: string[]
          category?: string | null
          cert_require_assignment_completion?: boolean
          cert_require_full_completion?: boolean
          cert_require_quiz_pass?: boolean
          certificate_eligibility_threshold?: number | null
          certificate_eligibility_type?: string
          certificate_template_id?: string | null
          child_category?: string | null
          coming_soon_thumbnail_url?: string | null
          course_password?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          difficulty?: string
          discount_ends_at?: string | null
          discount_starts_at?: string | null
          discount_type?: string
          discount_value?: number | null
          discussion_settings?: Json
          enable_certificates?: boolean
          enable_discussion?: boolean
          enrollment_end_at?: string | null
          enrollment_start_at?: string | null
          enrollment_type?: string
          estimated_completion_minutes?: number | null
          gst_rate?: number | null
          id?: string
          instructor_id?: string | null
          intro_video_provider?: string | null
          intro_video_url?: string | null
          is_best_seller?: boolean
          is_editors_choice?: boolean
          is_enrollment_paused?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_trending?: boolean
          language?: string
          languages?: string[]
          launch_at?: string | null
          learning_outcomes?: Json
          level?: string
          materials_included?: Json
          min_attendance_percentage?: number
          og_image_url?: string | null
          passing_percentage?: number
          preview_mode?: string
          price_amount?: number
          pricing_type?: string
          require_attendance?: boolean
          requirements?: Json
          revenue_fixed_amount?: number | null
          revenue_instructor_pct?: number | null
          revenue_max_settlement?: number | null
          revenue_min_settlement?: number | null
          revenue_model?: Database["public"]["Enums"]["course_revenue_type"]
          revenue_one_time_amount?: number | null
          revenue_one_time_paid_at?: string | null
          revenue_per_student_amount?: number | null
          revenue_platform_pct?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_price?: number | null
          seo_description?: string | null
          seo_focus_keyword?: string | null
          seo_title?: string | null
          settlement_frequency?: Database["public"]["Enums"]["settlement_frequency"]
          slug?: string
          status?: Database["public"]["Enums"]["course_status"]
          subcategory?: string | null
          submitted_for_review_at?: string | null
          summary?: string | null
          tags?: string[] | null
          target_audience?: Json
          tax_inclusive?: boolean
          thumbnail_url?: string | null
          title?: string
          total_duration_minutes?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["course_visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_conversation_keys: {
        Row: {
          conversation_id: string
          user_a: string
          user_b: string
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          user_a: string
          user_b: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          user_a?: string
          user_b?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_conversation_keys_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          discussion_id: string
          id: string
          is_instructor_answer: boolean
          workspace_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          discussion_id: string
          id?: string
          is_instructor_answer?: boolean
          workspace_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          discussion_id?: string
          id?: string
          is_instructor_answer?: boolean
          workspace_id?: string
        }
        Relationships: []
      }
      discussions: {
        Row: {
          author_id: string
          body: string | null
          course_id: string
          created_at: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          lesson_id: string | null
          reply_count: number
          title: string
          workspace_id: string
        }
        Insert: {
          author_id: string
          body?: string | null
          course_id: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          lesson_id?: string | null
          reply_count?: number
          title: string
          workspace_id: string
        }
        Update: {
          author_id?: string
          body?: string | null
          course_id?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          lesson_id?: string | null
          reply_count?: number
          title?: string
          workspace_id?: string
        }
        Relationships: []
      }
      earning_adjustments: {
        Row: {
          amount: number
          course_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          instructor_id: string
          kind: Database["public"]["Enums"]["adjustment_kind"]
          reason: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          instructor_id: string
          kind: Database["public"]["Enums"]["adjustment_kind"]
          reason?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          instructor_id?: string
          kind?: Database["public"]["Enums"]["adjustment_kind"]
          reason?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earning_adjustments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earning_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earning_adjustments_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earning_adjustments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          access_expires_at: string | null
          batch_id: string | null
          bundle_id: string | null
          completed_at: string | null
          course_id: string
          enrolled_at: string
          enrollment_type: Database["public"]["Enums"]["enrollment_source"]
          id: string
          institution_id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          validity_type: string | null
          workspace_id: string
        }
        Insert: {
          access_expires_at?: string | null
          batch_id?: string | null
          bundle_id?: string | null
          completed_at?: string | null
          course_id: string
          enrolled_at?: string
          enrollment_type?: Database["public"]["Enums"]["enrollment_source"]
          id?: string
          institution_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          validity_type?: string | null
          workspace_id: string
        }
        Update: {
          access_expires_at?: string | null
          batch_id?: string | null
          bundle_id?: string | null
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string
          enrollment_type?: Database["public"]["Enums"]["enrollment_source"]
          id?: string
          institution_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          validity_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gst_settings: {
        Row: {
          authorized_signatory: string | null
          bank_details: Json | null
          business_address: string | null
          business_city: string | null
          business_country: string
          business_email: string | null
          business_phone: string | null
          business_pin: string | null
          business_state: string
          company_gstin: string | null
          company_name: string
          created_at: string
          default_gst_rate: number
          default_hsn_sac: string
          enable_digital_signature: boolean
          enable_gst: boolean
          enable_invoice_logo: boolean
          enable_qr_code: boolean
          invoice_footer_text: string | null
          invoice_notes: string | null
          invoice_prefix: string
          invoice_starting_number: number
          logo_url: string | null
          pan_number: string | null
          signatory_designation: string | null
          signature_url: string | null
          terms: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          authorized_signatory?: string | null
          bank_details?: Json | null
          business_address?: string | null
          business_city?: string | null
          business_country?: string
          business_email?: string | null
          business_phone?: string | null
          business_pin?: string | null
          business_state?: string
          company_gstin?: string | null
          company_name?: string
          created_at?: string
          default_gst_rate?: number
          default_hsn_sac?: string
          enable_digital_signature?: boolean
          enable_gst?: boolean
          enable_invoice_logo?: boolean
          enable_qr_code?: boolean
          invoice_footer_text?: string | null
          invoice_notes?: string | null
          invoice_prefix?: string
          invoice_starting_number?: number
          logo_url?: string | null
          pan_number?: string | null
          signatory_designation?: string | null
          signature_url?: string | null
          terms?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          authorized_signatory?: string | null
          bank_details?: Json | null
          business_address?: string | null
          business_city?: string | null
          business_country?: string
          business_email?: string | null
          business_phone?: string | null
          business_pin?: string | null
          business_state?: string
          company_gstin?: string | null
          company_name?: string
          created_at?: string
          default_gst_rate?: number
          default_hsn_sac?: string
          enable_digital_signature?: boolean
          enable_gst?: boolean
          enable_invoice_logo?: boolean
          enable_qr_code?: boolean
          invoice_footer_text?: string | null
          invoice_notes?: string | null
          invoice_prefix?: string
          invoice_starting_number?: number
          logo_url?: string | null
          pan_number?: string | null
          signatory_designation?: string | null
          signature_url?: string | null
          terms?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gst_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_students: {
        Row: {
          academic_year: string | null
          created_at: string
          enrollment_date: string | null
          id: string
          institution_id: string
          program: string | null
          registration_number: string | null
          semester: string | null
          status: string
          student_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          enrollment_date?: string | null
          id?: string
          institution_id: string
          program?: string | null
          registration_number?: string | null
          semester?: string | null
          status?: string
          student_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          enrollment_date?: string | null
          id?: string
          institution_id?: string
          program?: string | null
          registration_number?: string | null
          semester?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_students_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string | null
          state: string | null
          type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug?: string | null
          state?: string | null
          type?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string | null
          state?: string | null
          type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_earnings: {
        Row: {
          commission_amount: number
          commission_percentage: number
          coupon_code: string | null
          course_id: string
          created_at: string
          currency: string
          discount_amount: number
          earned_at: string
          gross_amount: number
          id: string
          instructor_id: string
          net_earning: number
          net_revenue_base: number | null
          notes: string | null
          original_commission_amount: number | null
          original_discount_amount: number | null
          original_gross_amount: number | null
          original_net_earning: number | null
          original_net_revenue_base: number | null
          original_tax_amount: number | null
          payment_id: string | null
          refunded_amount: number
          refunded_commission_amount: number
          refunded_discount_amount: number
          refunded_gross_amount: number
          refunded_net_revenue_base: number
          refunded_tax_amount: number
          revenue_model:
            | Database["public"]["Enums"]["course_revenue_type"]
            | null
          settled_amount: number
          settlement_request_id: string | null
          settlement_status: Database["public"]["Enums"]["earning_settlement_status"]
          status: Database["public"]["Enums"]["earning_status"]
          student_id: string | null
          tax_amount: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          commission_amount?: number
          commission_percentage?: number
          coupon_code?: string | null
          course_id: string
          created_at?: string
          currency?: string
          discount_amount?: number
          earned_at?: string
          gross_amount?: number
          id?: string
          instructor_id: string
          net_earning?: number
          net_revenue_base?: number | null
          notes?: string | null
          original_commission_amount?: number | null
          original_discount_amount?: number | null
          original_gross_amount?: number | null
          original_net_earning?: number | null
          original_net_revenue_base?: number | null
          original_tax_amount?: number | null
          payment_id?: string | null
          refunded_amount?: number
          refunded_commission_amount?: number
          refunded_discount_amount?: number
          refunded_gross_amount?: number
          refunded_net_revenue_base?: number
          refunded_tax_amount?: number
          revenue_model?:
            | Database["public"]["Enums"]["course_revenue_type"]
            | null
          settled_amount?: number
          settlement_request_id?: string | null
          settlement_status?: Database["public"]["Enums"]["earning_settlement_status"]
          status?: Database["public"]["Enums"]["earning_status"]
          student_id?: string | null
          tax_amount?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          commission_amount?: number
          commission_percentage?: number
          coupon_code?: string | null
          course_id?: string
          created_at?: string
          currency?: string
          discount_amount?: number
          earned_at?: string
          gross_amount?: number
          id?: string
          instructor_id?: string
          net_earning?: number
          net_revenue_base?: number | null
          notes?: string | null
          original_commission_amount?: number | null
          original_discount_amount?: number | null
          original_gross_amount?: number | null
          original_net_earning?: number | null
          original_net_revenue_base?: number | null
          original_tax_amount?: number | null
          payment_id?: string | null
          refunded_amount?: number
          refunded_commission_amount?: number
          refunded_discount_amount?: number
          refunded_gross_amount?: number
          refunded_net_revenue_base?: number
          refunded_tax_amount?: number
          revenue_model?:
            | Database["public"]["Enums"]["course_revenue_type"]
            | null
          settled_amount?: number
          settlement_request_id?: string | null
          settlement_status?: Database["public"]["Enums"]["earning_settlement_status"]
          status?: Database["public"]["Enums"]["earning_status"]
          student_id?: string | null
          tax_amount?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_earnings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_earnings_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_earnings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_earnings_settlement_request_id_fkey"
            columns: ["settlement_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_earnings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_earnings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_profiles: {
        Row: {
          aadhaar_back_url: string | null
          aadhaar_front_url: string | null
          aadhaar_number: string | null
          account_holder_name: string | null
          additional_certifications: Json
          address: string | null
          alternative_contact: string | null
          bank_account_number: string | null
          bank_document_url: string | null
          bank_name: string | null
          bank_verified: boolean
          bank_verified_at: string | null
          bank_verified_by: string | null
          board_certificate_url: string | null
          board_type: string | null
          branch_name: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          gender: string | null
          government_id_url: string | null
          highest_qualification: string | null
          highest_qualification_certificate_url: string | null
          id: string
          ifsc_code: string | null
          institution: string | null
          languages: Json
          linkedin_url: string | null
          pan_card_url: string | null
          pan_number: string | null
          passing_year: number | null
          pin_code: string | null
          registration_mobile: string | null
          resume_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          specialization: string | null
          state: string | null
          subjects: Json
          submitted_at: string | null
          updated_at: string
          upi_id: string | null
          user_id: string
          verification_notes: string | null
          verification_status: Database["public"]["Enums"]["instructor_verification_status"]
          website_url: string | null
          whatsapp_number: string | null
          workspace_id: string | null
          years_experience: number | null
          youtube_url: string | null
        }
        Insert: {
          aadhaar_back_url?: string | null
          aadhaar_front_url?: string | null
          aadhaar_number?: string | null
          account_holder_name?: string | null
          additional_certifications?: Json
          address?: string | null
          alternative_contact?: string | null
          bank_account_number?: string | null
          bank_document_url?: string | null
          bank_name?: string | null
          bank_verified?: boolean
          bank_verified_at?: string | null
          bank_verified_by?: string | null
          board_certificate_url?: string | null
          board_type?: string | null
          branch_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          gender?: string | null
          government_id_url?: string | null
          highest_qualification?: string | null
          highest_qualification_certificate_url?: string | null
          id?: string
          ifsc_code?: string | null
          institution?: string | null
          languages?: Json
          linkedin_url?: string | null
          pan_card_url?: string | null
          pan_number?: string | null
          passing_year?: number | null
          pin_code?: string | null
          registration_mobile?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialization?: string | null
          state?: string | null
          subjects?: Json
          submitted_at?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id: string
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["instructor_verification_status"]
          website_url?: string | null
          whatsapp_number?: string | null
          workspace_id?: string | null
          years_experience?: number | null
          youtube_url?: string | null
        }
        Update: {
          aadhaar_back_url?: string | null
          aadhaar_front_url?: string | null
          aadhaar_number?: string | null
          account_holder_name?: string | null
          additional_certifications?: Json
          address?: string | null
          alternative_contact?: string | null
          bank_account_number?: string | null
          bank_document_url?: string | null
          bank_name?: string | null
          bank_verified?: boolean
          bank_verified_at?: string | null
          bank_verified_by?: string | null
          board_certificate_url?: string | null
          board_type?: string | null
          branch_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          gender?: string | null
          government_id_url?: string | null
          highest_qualification?: string | null
          highest_qualification_certificate_url?: string | null
          id?: string
          ifsc_code?: string | null
          institution?: string | null
          languages?: Json
          linkedin_url?: string | null
          pan_card_url?: string | null
          pan_number?: string | null
          passing_year?: number | null
          pin_code?: string | null
          registration_mobile?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialization?: string | null
          state?: string | null
          subjects?: Json
          submitted_at?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["instructor_verification_status"]
          website_url?: string | null
          whatsapp_number?: string | null
          workspace_id?: string | null
          years_experience?: number | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_profiles_bank_verified_by_fkey"
            columns: ["bank_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          invoice_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          invoice_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          invoice_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_audit_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          doc_type: string
          next_number: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          doc_type: string
          next_number?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          doc_type?: string
          next_number?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          amount_in_words: string | null
          buyer_address: string | null
          buyer_city: string | null
          buyer_country: string | null
          buyer_email: string | null
          buyer_gstin: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_pin: string | null
          buyer_state: string | null
          cgst_amount: number
          cgst_rate: number
          course_id: string | null
          course_title: string | null
          created_at: string
          currency: string
          doc_type: string
          gst_number: string | null
          gst_type: string
          hsn_sac: string | null
          id: string
          igst_amount: number
          igst_rate: number
          invoice_number: string
          issued_at: string
          notes: string | null
          order_id: string | null
          original_invoice_id: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string
          pdf_url: string | null
          place_of_supply: string | null
          qty: number
          rate: number
          refund_id: string | null
          seller_address: string | null
          seller_email: string | null
          seller_gstin: string | null
          seller_name: string | null
          seller_pan: string | null
          seller_phone: string | null
          seller_state: string | null
          sgst_amount: number
          sgst_rate: number
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          tax: number
          taxable_amount: number
          total_amount: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          amount_in_words?: string | null
          buyer_address?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_gstin?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_pin?: string | null
          buyer_state?: string | null
          cgst_amount?: number
          cgst_rate?: number
          course_id?: string | null
          course_title?: string | null
          created_at?: string
          currency?: string
          doc_type?: string
          gst_number?: string | null
          gst_type?: string
          hsn_sac?: string | null
          id?: string
          igst_amount?: number
          igst_rate?: number
          invoice_number: string
          issued_at?: string
          notes?: string | null
          order_id?: string | null
          original_invoice_id?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string
          pdf_url?: string | null
          place_of_supply?: string | null
          qty?: number
          rate?: number
          refund_id?: string | null
          seller_address?: string | null
          seller_email?: string | null
          seller_gstin?: string | null
          seller_name?: string | null
          seller_pan?: string | null
          seller_phone?: string | null
          seller_state?: string | null
          sgst_amount?: number
          sgst_rate?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          tax?: number
          taxable_amount?: number
          total_amount?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          amount_in_words?: string | null
          buyer_address?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_gstin?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_pin?: string | null
          buyer_state?: string | null
          cgst_amount?: number
          cgst_rate?: number
          course_id?: string | null
          course_title?: string | null
          created_at?: string
          currency?: string
          doc_type?: string
          gst_number?: string | null
          gst_type?: string
          hsn_sac?: string | null
          id?: string
          igst_amount?: number
          igst_rate?: number
          invoice_number?: string
          issued_at?: string
          notes?: string | null
          order_id?: string | null
          original_invoice_id?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string
          pdf_url?: string | null
          place_of_supply?: string | null
          qty?: number
          rate?: number
          refund_id?: string | null
          seller_address?: string | null
          seller_email?: string | null
          seller_gstin?: string | null
          seller_name?: string | null
          seller_pan?: string | null
          seller_phone?: string | null
          seller_state?: string | null
          sgst_amount?: number
          sgst_rate?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          tax?: number
          taxable_amount?: number
          total_amount?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          lesson_id: string
          public_url: string | null
          storage_path: string | null
          title: string | null
          workspace_id: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          id?: string
          lesson_id: string
          public_url?: string | null
          storage_path?: string | null
          title?: string | null
          workspace_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          lesson_id?: string
          public_url?: string | null
          storage_path?: string | null
          title?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_assets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          enrollment_id: string
          id: string
          is_completed: boolean
          last_viewed_at: string
          lesson_id: string
          progress_seconds: number
          student_id: string
          workspace_id: string
        }
        Insert: {
          enrollment_id: string
          id?: string
          is_completed?: boolean
          last_viewed_at?: string
          lesson_id: string
          progress_seconds?: number
          student_id: string
          workspace_id: string
        }
        Update: {
          enrollment_id?: string
          id?: string
          is_completed?: boolean
          last_viewed_at?: string
          lesson_id?: string
          progress_seconds?: number
          student_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          asset_url: string | null
          content: string | null
          course_id: string
          created_at: string
          duration_seconds: number | null
          featured_image_url: string | null
          id: string
          is_preview: boolean
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          position: number
          section_id: string | null
          title: string
          video_provider: string | null
          workspace_id: string
        }
        Insert: {
          asset_url?: string | null
          content?: string | null
          course_id: string
          created_at?: string
          duration_seconds?: number | null
          featured_image_url?: string | null
          id?: string
          is_preview?: boolean
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          position?: number
          section_id?: string | null
          title: string
          video_provider?: string | null
          workspace_id: string
        }
        Update: {
          asset_url?: string | null
          content?: string | null
          course_id?: string
          created_at?: string
          duration_seconds?: number | null
          featured_image_url?: string | null
          id?: string
          is_preview?: boolean
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          position?: number
          section_id?: string | null
          title?: string
          video_provider?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_attendance: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          live_class_id: string
          status: Database["public"]["Enums"]["live_class_attendance_status"]
          student_id: string
          total_minutes: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          live_class_id: string
          status?: Database["public"]["Enums"]["live_class_attendance_status"]
          student_id: string
          total_minutes?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          live_class_id?: string
          status?: Database["public"]["Enums"]["live_class_attendance_status"]
          student_id?: string
          total_minutes?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_attendance_live_class_id_fkey"
            columns: ["live_class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          assigned_student_ids: string[]
          attendance_tracking: boolean
          banner_url: string | null
          batch_id: string | null
          bundle_id: string | null
          course_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string
          institution_id: string | null
          instructor_id: string | null
          is_public: boolean
          max_participants: number | null
          meeting_password: string | null
          meeting_url: string | null
          notify_students: boolean
          price: number
          provider: Database["public"]["Enums"]["live_class_provider"]
          recording_enabled: boolean
          recording_url: string | null
          section_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["live_class_status"]
          thumbnail_url: string | null
          timezone: string | null
          title: string
          updated_at: string
          waiting_room: boolean
          workspace_id: string
        }
        Insert: {
          assigned_student_ids?: string[]
          attendance_tracking?: boolean
          banner_url?: string | null
          batch_id?: string | null
          bundle_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          institution_id?: string | null
          instructor_id?: string | null
          is_public?: boolean
          max_participants?: number | null
          meeting_password?: string | null
          meeting_url?: string | null
          notify_students?: boolean
          price?: number
          provider?: Database["public"]["Enums"]["live_class_provider"]
          recording_enabled?: boolean
          recording_url?: string | null
          section_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["live_class_status"]
          thumbnail_url?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
          waiting_room?: boolean
          workspace_id: string
        }
        Update: {
          assigned_student_ids?: string[]
          attendance_tracking?: boolean
          banner_url?: string | null
          batch_id?: string | null
          bundle_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          institution_id?: string | null
          instructor_id?: string | null
          is_public?: boolean
          max_participants?: number | null
          meeting_password?: string | null
          meeting_url?: string | null
          notify_students?: boolean
          price?: number
          provider?: Database["public"]["Enums"]["live_class_provider"]
          recording_enabled?: boolean
          recording_url?: string | null
          section_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["live_class_status"]
          thumbnail_url?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
          waiting_room?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          workspace_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          workspace_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          event_type: string
          id: string
          profile_id: string
          read_at: string | null
          source_id: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          event_type: string
          id?: string
          profile_id: string
          read_at?: string | null
          source_id?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          profile_id?: string
          read_at?: string | null
          source_id?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          config_public: Json
          created_at: string
          id: string
          provider: string
          status: Database["public"]["Enums"]["provider_connection_status"]
          workspace_id: string
        }
        Insert: {
          config_public?: Json
          created_at?: string
          id?: string
          provider: string
          status?: Database["public"]["Enums"]["provider_connection_status"]
          workspace_id: string
        }
        Update: {
          config_public?: Json
          created_at?: string
          id?: string
          provider?: string
          status?: Database["public"]["Enums"]["provider_connection_status"]
          workspace_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          base_price: number | null
          bundle_id: string | null
          coupon_code: string | null
          course_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          external_payment_id: string | null
          id: string
          invoice_url: string | null
          provider: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          tax_amount: number
          total_amount: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          base_price?: number | null
          bundle_id?: string | null
          coupon_code?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          external_payment_id?: string | null
          id?: string
          invoice_url?: string | null
          provider: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          tax_amount?: number
          total_amount?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          base_price?: number | null
          bundle_id?: string | null
          coupon_code?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          external_payment_id?: string | null
          id?: string
          invoice_url?: string | null
          provider?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          tax_amount?: number
          total_amount?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          bank_snapshot: Json | null
          created_at: string
          currency: string
          earnings_count: number
          id: string
          instructor_id: string
          notes: string | null
          paid_amount: number
          paid_at: string | null
          payment_reference: string | null
          remarks: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_number: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          bank_snapshot?: Json | null
          created_at?: string
          currency?: string
          earnings_count?: number
          id?: string
          instructor_id: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_reference?: string | null
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_number?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          bank_snapshot?: Json | null
          created_at?: string
          currency?: string
          earnings_count?: number
          id?: string
          instructor_id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_reference?: string | null
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_number?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_full_name: string | null
          billing_gstin: string | null
          billing_phone: string | null
          billing_pin: string | null
          billing_state: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          designation: string | null
          email: string | null
          expertise: string | null
          full_name: string | null
          id: string
          instructor_status: string | null
          is_active: boolean
          last_login_at: string | null
          legal_name: string | null
          legal_name_confirmed_at: string | null
          legal_name_locked: boolean
          linkedin_url: string | null
          phone: string | null
          phone_normalized: string | null
          profile_completed: boolean
          qualification: string | null
          signup_role: string | null
          social_links: Json
          status: string
          teaching_sample_url: string | null
          total_login_count: number
          years_experience: number | null
        }
        Insert: {
          avatar_url?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_full_name?: string | null
          billing_gstin?: string | null
          billing_phone?: string | null
          billing_pin?: string | null
          billing_state?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          expertise?: string | null
          full_name?: string | null
          id: string
          instructor_status?: string | null
          is_active?: boolean
          last_login_at?: string | null
          legal_name?: string | null
          legal_name_confirmed_at?: string | null
          legal_name_locked?: boolean
          linkedin_url?: string | null
          phone?: string | null
          phone_normalized?: string | null
          profile_completed?: boolean
          qualification?: string | null
          signup_role?: string | null
          social_links?: Json
          status?: string
          teaching_sample_url?: string | null
          total_login_count?: number
          years_experience?: number | null
        }
        Update: {
          avatar_url?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_full_name?: string | null
          billing_gstin?: string | null
          billing_phone?: string | null
          billing_pin?: string | null
          billing_state?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          expertise?: string | null
          full_name?: string | null
          id?: string
          instructor_status?: string | null
          is_active?: boolean
          last_login_at?: string | null
          legal_name?: string | null
          legal_name_confirmed_at?: string | null
          legal_name_locked?: boolean
          linkedin_url?: string | null
          phone?: string | null
          phone_normalized?: string | null
          profile_completed?: boolean
          qualification?: string | null
          signup_role?: string | null
          social_links?: Json
          status?: string
          teaching_sample_url?: string | null
          total_login_count?: number
          years_experience?: number | null
        }
        Relationships: []
      }
      qa_results: {
        Row: {
          created_at: string | null
          detail: string | null
          step: string | null
        }
        Insert: {
          created_at?: string | null
          detail?: string | null
          step?: string | null
        }
        Update: {
          created_at?: string | null
          detail?: string | null
          step?: string | null
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          category_id: string | null
          correct_answers: Json
          created_at: string
          created_by: string | null
          difficulty: string
          explanation: string | null
          hint: string | null
          id: string
          media_type: string | null
          media_url: string | null
          options: Json
          points: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category_id?: string | null
          correct_answers?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          options?: Json
          points?: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category_id?: string | null
          correct_answers?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          options?: Json
          points?: number
          prompt?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      question_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          flagged_activity_count: number
          id: string
          instructor_feedback: string | null
          manual_review_pending: boolean
          max_score: number
          passed: boolean | null
          percentage: number | null
          quiz_id: string
          review_data: Json
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          student_id: string
          submitted_at: string
          time_spent_seconds: number | null
          workspace_id: string
        }
        Insert: {
          answers?: Json
          flagged_activity_count?: number
          id?: string
          instructor_feedback?: string | null
          manual_review_pending?: boolean
          max_score?: number
          passed?: boolean | null
          percentage?: number | null
          quiz_id: string
          review_data?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          student_id: string
          submitted_at?: string
          time_spent_seconds?: number | null
          workspace_id: string
        }
        Update: {
          answers?: Json
          flagged_activity_count?: number
          id?: string
          instructor_feedback?: string | null
          manual_review_pending?: boolean
          max_score?: number
          passed?: boolean | null
          percentage?: number | null
          quiz_id?: string
          review_data?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          student_id?: string
          submitted_at?: string
          time_spent_seconds?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_import_log: {
        Row: {
          course_id: string | null
          created_at: string
          error_rows: number
          errors: Json
          file_name: string | null
          id: string
          imported_by: string | null
          imported_rows: number
          ip_address: string | null
          quiz_id: string | null
          saved_to_bank: boolean
          skipped_rows: number
          total_rows: number
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          error_rows?: number
          errors?: Json
          file_name?: string | null
          id?: string
          imported_by?: string | null
          imported_rows?: number
          ip_address?: string | null
          quiz_id?: string | null
          saved_to_bank?: boolean
          skipped_rows?: number
          total_rows?: number
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          error_rows?: number
          errors?: Json
          file_name?: string | null
          id?: string
          imported_by?: string | null
          imported_rows?: number
          ip_address?: string | null
          quiz_id?: string | null
          saved_to_bank?: boolean
          skipped_rows?: number
          total_rows?: number
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_import_log_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_import_log_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_import_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          bank_question_id: string | null
          correct_answers: Json
          difficulty: string
          explanation: string | null
          hint: string | null
          id: string
          media_type: string | null
          media_url: string | null
          options: Json
          points: number
          position: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          tags: string[]
          workspace_id: string
        }
        Insert: {
          bank_question_id?: string | null
          correct_answers?: Json
          difficulty?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          options?: Json
          points?: number
          position?: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          tags?: string[]
          workspace_id: string
        }
        Update: {
          bank_question_id?: string | null
          correct_answers?: Json
          difficulty?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          options?: Json
          points?: number
          position?: number
          prompt?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id?: string
          tags?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          access_rules: Json
          allow_back_navigation: boolean
          allow_retake: boolean
          auto_evaluate: boolean
          auto_start: boolean
          available_from: string | null
          available_until: string | null
          course_id: string
          created_at: string
          description: string | null
          feedback_mode: string
          hide_timer: boolean
          id: string
          instructions: string | null
          lesson_id: string | null
          max_attempts: number | null
          max_questions: number | null
          passing_marks: number | null
          passing_percentage: number
          position: number
          proctoring_settings: Json
          question_layout: string
          question_order: string
          random_pick: number | null
          require_sequential_answering: boolean
          section_id: string | null
          security_settings: Json
          show_correct_answers: boolean
          show_detailed_feedback: boolean
          show_question_explanation: boolean
          show_question_number: boolean
          show_result_immediately: boolean
          show_score: boolean
          shuffle_answers: boolean
          shuffle_questions: boolean
          status: Database["public"]["Enums"]["quiz_status"]
          time_limit_minutes: number | null
          time_limit_unit: string
          title: string
          workspace_id: string
        }
        Insert: {
          access_rules?: Json
          allow_back_navigation?: boolean
          allow_retake?: boolean
          auto_evaluate?: boolean
          auto_start?: boolean
          available_from?: string | null
          available_until?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          feedback_mode?: string
          hide_timer?: boolean
          id?: string
          instructions?: string | null
          lesson_id?: string | null
          max_attempts?: number | null
          max_questions?: number | null
          passing_marks?: number | null
          passing_percentage?: number
          position?: number
          proctoring_settings?: Json
          question_layout?: string
          question_order?: string
          random_pick?: number | null
          require_sequential_answering?: boolean
          section_id?: string | null
          security_settings?: Json
          show_correct_answers?: boolean
          show_detailed_feedback?: boolean
          show_question_explanation?: boolean
          show_question_number?: boolean
          show_result_immediately?: boolean
          show_score?: boolean
          shuffle_answers?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["quiz_status"]
          time_limit_minutes?: number | null
          time_limit_unit?: string
          title: string
          workspace_id: string
        }
        Update: {
          access_rules?: Json
          allow_back_navigation?: boolean
          allow_retake?: boolean
          auto_evaluate?: boolean
          auto_start?: boolean
          available_from?: string | null
          available_until?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          feedback_mode?: string
          hide_timer?: boolean
          id?: string
          instructions?: string | null
          lesson_id?: string | null
          max_attempts?: number | null
          max_questions?: number | null
          passing_marks?: number | null
          passing_percentage?: number
          position?: number
          proctoring_settings?: Json
          question_layout?: string
          question_order?: string
          random_pick?: number | null
          require_sequential_answering?: boolean
          section_id?: string | null
          security_settings?: Json
          show_correct_answers?: boolean
          show_detailed_feedback?: boolean
          show_question_explanation?: boolean
          show_question_number?: boolean
          show_result_immediately?: boolean
          show_score?: boolean
          shuffle_answers?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["quiz_status"]
          time_limit_minutes?: number | null
          time_limit_unit?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          label: string
          module: string
          permission_key: string
          sort_order: number
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          module: string
          permission_key: string
          sort_order?: number
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          module?: string
          permission_key?: string
          sort_order?: number
        }
        Relationships: []
      }
      rbac_role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "rbac_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rbac_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rbac_role_permissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_roles: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_protected: boolean
          is_system: boolean
          name: string
          slug: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_protected?: boolean
          is_system?: boolean
          name: string
          slug: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_protected?: boolean
          is_system?: boolean
          name?: string
          slug?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rbac_user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          course_id: string | null
          created_at: string
          currency: string
          id: string
          payment_id: string
          processed_by: string | null
          reason: string | null
          status: string
          student_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          course_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_id: string
          processed_by?: string | null
          reason?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          course_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_id?: string
          processed_by?: string | null
          reason?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_role: Database["public"]["Enums"]["app_role"] | null
          previous_role: Database["public"]["Enums"]["app_role"] | null
          source: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_role?: Database["public"]["Enums"]["app_role"] | null
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          source?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_role?: Database["public"]["Enums"]["app_role"] | null
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          source?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      settlement_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_amount: number | null
          new_status: string | null
          old_amount: number | null
          old_status: string | null
          remarks: string | null
          settlement_request_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_amount?: number | null
          new_status?: string | null
          old_amount?: number | null
          old_status?: string | null
          remarks?: string | null
          settlement_request_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_amount?: number | null
          new_status?: string | null
          old_amount?: number | null
          old_status?: string | null
          remarks?: string | null
          settlement_request_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_audit_log_settlement_request_id_fkey"
            columns: ["settlement_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          instructor_id: string
          notes: string | null
          paid_at: string
          paid_by: string | null
          payment_mode: Database["public"]["Enums"]["settlement_payment_mode"]
          settlement_request_id: string
          transaction_reference: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          instructor_id: string
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          payment_mode?: Database["public"]["Enums"]["settlement_payment_mode"]
          settlement_request_id: string
          transaction_reference?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          instructor_id?: string
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          payment_mode?: Database["public"]["Enums"]["settlement_payment_mode"]
          settlement_request_id?: string
          transaction_reference?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_transactions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_transactions_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_transactions_settlement_request_id_fkey"
            columns: ["settlement_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      site_page_versions: {
        Row: {
          content: string
          created_at: string
          edited_by: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          page_id: string
          status: string
          title: string
          version_number: number
        }
        Insert: {
          content: string
          created_at?: string
          edited_by?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          page_id: string
          status: string
          title: string
          version_number: number
        }
        Update: {
          content?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          page_id?: string
          status?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "site_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      student_bundles: {
        Row: {
          access_expires_at: string | null
          assigned_at: string
          assigned_by: string | null
          bundle_id: string
          id: string
          institution_id: string | null
          payment_id: string | null
          source: string
          status: string
          student_id: string
          workspace_id: string
        }
        Insert: {
          access_expires_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          bundle_id: string
          id?: string
          institution_id?: string | null
          payment_id?: string | null
          source?: string
          status?: string
          student_id: string
          workspace_id: string
        }
        Update: {
          access_expires_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          bundle_id?: string
          id?: string
          institution_id?: string | null
          payment_id?: string | null
          source?: string
          status?: string
          student_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_bundles_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_bundles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_bundles_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_bundles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_bundles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      student_notes: {
        Row: {
          body: string
          course_id: string
          created_at: string
          id: string
          lesson_id: string | null
          student_id: string
          timestamp_seconds: number | null
          workspace_id: string
        }
        Insert: {
          body: string
          course_id: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          student_id: string
          timestamp_seconds?: number | null
          workspace_id: string
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          student_id?: string
          timestamp_seconds?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      student_notices: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          link_label: string | null
          link_url: string | null
          sort_order: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          academic_session: string | null
          address: string | null
          branch: string | null
          city: string | null
          country: string | null
          course_program: string | null
          created_at: string
          date_of_birth: string | null
          gender: string | null
          id: string
          institution_code: string | null
          institution_id: string | null
          pin_code: string | null
          registration_number: string | null
          roll_number: string | null
          semester: string | null
          state: string | null
          university_name: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
          workspace_id: string | null
        }
        Insert: {
          academic_session?: string | null
          address?: string | null
          branch?: string | null
          city?: string | null
          country?: string | null
          course_program?: string | null
          created_at?: string
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          institution_code?: string | null
          institution_id?: string | null
          pin_code?: string | null
          registration_number?: string | null
          roll_number?: string | null
          semester?: string | null
          state?: string | null
          university_name?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
          workspace_id?: string | null
        }
        Update: {
          academic_session?: string | null
          address?: string | null
          branch?: string | null
          city?: string | null
          country?: string | null
          course_program?: string | null
          created_at?: string
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          institution_code?: string | null
          institution_id?: string | null
          pin_code?: string | null
          registration_number?: string | null
          roll_number?: string | null
          semester?: string | null
          state?: string | null
          university_name?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          is_internal: boolean
          message: string
          sender_id: string | null
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          sender_id?: string | null
          sender_role?: string
          ticket_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_id?: string | null
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          ip_address: string | null
          last_activity_at: string
          metadata: Json
          phone: string | null
          priority: string
          source: string | null
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          ticket_number: string
          topic: string
          type: string
          updated_at: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_role: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          last_activity_at?: string
          metadata?: Json
          phone?: string | null
          priority?: string
          source?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          ticket_number: string
          topic?: string
          type?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          last_activity_at?: string
          metadata?: Json
          phone?: string | null
          priority?: string
          source?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          ticket_number?: string
          topic?: string
          type?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      user_agreements: {
        Row: {
          accepted_at: string
          accepted_code_of_conduct: boolean
          accepted_privacy: boolean
          accepted_terms: boolean
          agreement_version: string
          id: string
          ip_address: string | null
          role_at_signup: string | null
          user_agent: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string
          accepted_code_of_conduct?: boolean
          accepted_privacy?: boolean
          accepted_terms?: boolean
          agreement_version?: string
          id?: string
          ip_address?: string | null
          role_at_signup?: string | null
          user_agent?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string
          accepted_code_of_conduct?: boolean
          accepted_privacy?: boolean
          accepted_terms?: boolean
          agreement_version?: string
          id?: string
          ip_address?: string | null
          role_at_signup?: string | null
          user_agent?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_name: string | null
          device_type: string | null
          duration_seconds: number | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_active: string
          location: string | null
          login_method: string | null
          login_time: string
          logout_reason: string | null
          operating_system: string | null
          revoked_at: string | null
          revoked_reason: string | null
          session_token: string
          user_agent: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_active?: string
          location?: string | null
          login_method?: string | null
          login_time?: string
          logout_reason?: string | null
          operating_system?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_active?: string
          location?: string | null
          login_method?: string | null
          login_time?: string
          logout_reason?: string | null
          operating_system?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      video_access_logs: {
        Row: {
          course_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          ip_address: string | null
          lesson_id: string | null
          user_agent: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          ip_address?: string | null
          lesson_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          ip_address?: string | null
          lesson_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_access_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      video_security_settings: {
        Row: {
          concurrent_login_protection: boolean
          created_at: string
          device_limit: boolean
          disable_downloads: boolean
          dynamic_watermark: boolean
          hls_streaming: boolean
          screen_record_deterrence: boolean
          session_validation: boolean
          signed_urls: boolean
          updated_at: string
          workspace_id: string
          youtube_nocookie: boolean
        }
        Insert: {
          concurrent_login_protection?: boolean
          created_at?: string
          device_limit?: boolean
          disable_downloads?: boolean
          dynamic_watermark?: boolean
          hls_streaming?: boolean
          screen_record_deterrence?: boolean
          session_validation?: boolean
          signed_urls?: boolean
          updated_at?: string
          workspace_id: string
          youtube_nocookie?: boolean
        }
        Update: {
          concurrent_login_protection?: boolean
          created_at?: string
          device_limit?: boolean
          disable_downloads?: boolean
          dynamic_watermark?: boolean
          hls_streaming?: boolean
          screen_record_deterrence?: boolean
          session_validation?: boolean
          signed_urls?: boolean
          updated_at?: string
          workspace_id?: string
          youtube_nocookie?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "video_security_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_integrations: {
        Row: {
          category: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          mode: string | null
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          mode?: string | null
          provider: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          mode?: string | null
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_security_settings: {
        Row: {
          allow_multi_device: boolean
          auto_logout_oldest: boolean
          created_at: string
          max_devices: number
          session_expiry_days: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allow_multi_device?: boolean
          auto_logout_oldest?: boolean
          created_at?: string
          max_devices?: number
          session_expiry_days?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allow_multi_device?: boolean
          auto_logout_oldest?: boolean
          created_at?: string
          max_devices?: number
          session_expiry_days?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_settings: {
        Row: {
          accent_color: string | null
          auto_issue_certificates: boolean
          certificate_signature_name: string | null
          certificate_signature_url: string | null
          completion_threshold: number
          contact_email: string | null
          created_at: string
          default_course_visibility: Database["public"]["Enums"]["course_visibility"]
          logo_url: string | null
          primary_color: string | null
          timezone: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accent_color?: string | null
          auto_issue_certificates?: boolean
          certificate_signature_name?: string | null
          certificate_signature_url?: string | null
          completion_threshold?: number
          contact_email?: string | null
          created_at?: string
          default_course_visibility?: Database["public"]["Enums"]["course_visibility"]
          logo_url?: string | null
          primary_color?: string | null
          timezone?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accent_color?: string | null
          auto_issue_certificates?: boolean
          certificate_signature_name?: string | null
          certificate_signature_url?: string | null
          completion_threshold?: number
          contact_email?: string | null
          created_at?: string
          default_course_visibility?: Database["public"]["Enums"]["course_visibility"]
          logo_url?: string | null
          primary_color?: string | null
          timezone?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          brand_color: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          tagline: string | null
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          tagline?: string | null
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          tagline?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_archive_course: {
        Args: { _course_id: string; _request_id?: string }
        Returns: undefined
      }
      admin_bulk_reassign_courses: {
        Args: {
          _course_ids: string[]
          _ip?: string
          _new_instructor_id: string
          _notify?: boolean
          _reason?: string
          _transfer_live_classes?: boolean
          _user_agent?: string
        }
        Returns: Json
      }
      admin_deactivate_instructor:
        | {
            Args: {
              _instructor_id: string
              _ip?: string
              _mode: string
              _new_instructor_id?: string
              _reason?: string
              _user_agent?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _force?: boolean
              _instructor_id: string
              _ip?: string
              _mode: string
              _new_instructor_id?: string
              _reason?: string
              _user_agent?: string
            }
            Returns: Json
          }
      admin_enroll_student_in_bundle: {
        Args: {
          _bundle_id: string
          _expires_at?: string
          _notes?: string
          _source?: string
          _student_id: string
          _validity_type?: string
        }
        Returns: number
      }
      admin_enroll_student_in_course: {
        Args: {
          _course_id: string
          _expires_at?: string
          _notes?: string
          _source?: string
          _student_id: string
          _validity_type?: string
        }
        Returns: string
      }
      admin_pay_settlement: {
        Args: {
          _amount: number
          _mode?: string
          _notes?: string
          _reference?: string
          _request_id: string
        }
        Returns: string
      }
      admin_permanent_delete_course:
        | { Args: { _course_id: string; _request_id?: string }; Returns: Json }
        | {
            Args: {
              _course_id: string
              _ip?: string
              _remarks?: string
              _request_id?: string
              _user_agent?: string
            }
            Returns: Json
          }
      admin_reactivate_instructor: {
        Args: {
          _instructor_id: string
          _ip?: string
          _reason?: string
          _user_agent?: string
        }
        Returns: Json
      }
      admin_reassign_course_instructor:
        | {
            Args: {
              _course_id: string
              _new_instructor_id: string
              _notes?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _course_id: string
              _effective_date?: string
              _ip?: string
              _new_instructor_id: string
              _notify?: boolean
              _reason?: string
              _transfer_live_classes?: boolean
              _user_agent?: string
            }
            Returns: Json
          }
      admin_restore_course: { Args: { _course_id: string }; Returns: undefined }
      admin_soft_delete_student: {
        Args: { _student_id: string }
        Returns: undefined
      }
      admin_suspend_course: {
        Args: { _course_id: string; _reason: string }
        Returns: undefined
      }
      admin_update_settlement_status: {
        Args: { _new_status: string; _remarks?: string; _request_id: string }
        Returns: undefined
      }
      admin_verify_instructor_bank: {
        Args: {
          _instructor_profile_id: string
          _notes?: string
          _verified: boolean
        }
        Returns: undefined
      }
      allocate_invoice_number: {
        Args: { _doc_type: string; _workspace_id: string }
        Returns: string
      }
      apply_signup_role: {
        Args: {
          desired_role: Database["public"]["Enums"]["app_role"]
          source?: string
        }
        Returns: undefined
      }
      assign_bundle_to_institution: {
        Args: {
          _bundle_id: string
          _institution_id: string
          _program?: string
          _semester?: string
        }
        Returns: number
      }
      attendance_percentage: {
        Args: { _course_id: string; _student_id: string }
        Returns: number
      }
      attendance_session_is_locked: {
        Args: { _session_id: string }
        Returns: boolean
      }
      attendance_unlock_session: {
        Args: { _session_id: string }
        Returns: undefined
      }
      bulk_enroll_batch_students: {
        Args: { _batch_id: string }
        Returns: number
      }
      bulk_transfer_preview: { Args: { _course_ids: string[] }; Returns: Json }
      bundle_access_expiry: { Args: { _bundle_id: string }; Returns: string }
      can_join_live_class: { Args: { _class_id: string }; Returns: boolean }
      can_manage_attendance_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      close_user_session: {
        Args: { p_reason: string; p_token: string }
        Returns: boolean
      }
      compute_batch_expiry: { Args: { _batch_id: string }; Returns: string }
      course_completion_status: {
        Args: { _course: string; _student: string }
        Returns: Json
      }
      course_deletion_summary: { Args: { _course_id: string }; Returns: Json }
      create_support_ticket: {
        Args: { p_message: string; p_subject: string; p_topic: string }
        Returns: string
      }
      enroll_student_in_bundle: {
        Args: {
          _bundle_id: string
          _institution_id?: string
          _payment_id?: string
          _source?: string
          _student_id: string
        }
        Returns: number
      }
      generate_credit_note: { Args: { _refund_id: string }; Returns: string }
      generate_gst_invoice: { Args: { _payment_id: string }; Returns: string }
      get_or_create_direct_conversation: {
        Args: { _other_user: string; _workspace_id: string }
        Returns: string
      }
      get_public_course_categories: { Args: never; Returns: Json }
      get_public_course_curriculum: {
        Args: { _course_id: string }
        Returns: Json
      }
      get_public_homepage_stats: {
        Args: never
        Returns: {
          active_learners: number
          completion_rate: number
          courses: number
          expert_instructors: number
        }[]
      }
      get_public_instructors: { Args: never; Returns: Json }
      get_public_live_classes: {
        Args: { _limit?: number }
        Returns: {
          banner_url: string
          course_title: string
          description: string
          ends_at: string
          id: string
          instructor_name: string
          max_participants: number
          price: number
          starts_at: string
          status: Database["public"]["Enums"]["live_class_status"]
          thumbnail_url: string
          timezone: string
          title: string
        }[]
      }
      get_quiz_correct_answers: {
        Args: { _question_id: string }
        Returns: Json
      }
      get_security_settings: {
        Args: { _workspace_id: string }
        Returns: {
          allow_multi_device: boolean
          auto_logout_oldest: boolean
          created_at: string
          max_devices: number
          session_expiry_days: number
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_security_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_alpha: { Args: { _text: string }; Returns: boolean }
      has_any_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      instructor_deactivation_summary: {
        Args: { _instructor_id: string }
        Returns: Json
      }
      instructor_delete_draft_course: {
        Args: { _course_id: string }
        Returns: Json
      }
      instructor_request_settlement: {
        Args: { _notes?: string; _workspace_id: string }
        Returns: string
      }
      is_admin_anywhere: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_staff_anywhere: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_any_course_instructor: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_course_instructor: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_https_url: { Args: { _text: string }; Returns: boolean }
      is_instructor_verified: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin_strict: { Args: { _user_id: string }; Returns: boolean }
      is_phone_available: { Args: { _phone: string }; Returns: boolean }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      is_safe_name: { Args: { _text: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_valid_email: { Args: { _text: string }; Returns: boolean }
      is_valid_gstin: { Args: { _text: string }; Returns: boolean }
      is_valid_phone: { Args: { _text: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_staff_anywhere: {
        Args: { _user_id: string }
        Returns: boolean
      }
      issue_self_certificate: {
        Args: {
          _completion_date?: string
          _completion_percentage?: number
          _course_id: string
          _template_id?: string
          _workspace_id: string
        }
        Returns: {
          certificate_number: string
          completion_date: string | null
          completion_percentage: number | null
          course_id: string
          id: string
          issued_at: string
          metadata: Json
          pdf_url: string | null
          revoked_at: string | null
          student_id: string
          template_id: string | null
          template_snapshot: Json | null
          updated_at: string
          verification_code: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_assignable_instructors: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      list_course_transfers: {
        Args: { _from?: string; _to?: string; _workspace_id?: string }
        Returns: {
          actor_id: string
          actor_name: string
          category: string
          course_id: string
          course_title: string
          created_at: string
          from_instructor: string
          from_name: string
          id: string
          ip_address: string
          reason: string
          revenue: number
          students: number
          to_instructor: string
          to_name: string
          user_agent: string
        }[]
      }
      list_courses_with_stats: {
        Args: { _instructor_id: string }
        Returns: {
          category: string
          id: string
          revenue: number
          status: string
          students: number
          title: string
        }[]
      }
      lookup_active_coupon: {
        Args: { _code: string; _workspace_id: string }
        Returns: {
          applies_to: string
          code: string
          course_ids: Json
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          ends_at: string
          id: string
          max_redemptions: number
          redeemed_count: number
          starts_at: string
          status: Database["public"]["Enums"]["coupon_status"]
          workspace_id: string
        }[]
      }
      normalize_phone_number: { Args: { _raw: string }; Returns: string }
      num_to_words_inr: { Args: { _n: number }; Returns: string }
      num_to_words_two: { Args: { _n: number }; Returns: string }
      rbac_init_workspace: { Args: { _workspace_id: string }; Returns: number }
      record_live_class_join: {
        Args: { _class_id: string }
        Returns: undefined
      }
      register_user_session:
        | {
            Args: {
              p_browser: string
              p_device_name: string
              p_device_type: string
              p_ip: string
              p_location: string
              p_os: string
              p_token: string
              p_user_agent: string
              p_workspace_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_browser: string
              p_device_name: string
              p_device_type: string
              p_ip: string
              p_location: string
              p_login_method?: string
              p_os: string
              p_token: string
              p_user_agent: string
              p_workspace_id: string
            }
            Returns: Json
          }
      request_course_deletion: {
        Args: { _course_id: string; _reason: string }
        Returns: string
      }
      request_offline_payment: {
        Args: { _payment_id: string }
        Returns: {
          amount: number
          base_price: number | null
          bundle_id: string | null
          coupon_code: string | null
          course_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          external_payment_id: string | null
          id: string
          invoice_url: string | null
          provider: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          tax_amount: number
          total_amount: number | null
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_certificate_template: {
        Args: { _course_id: string; _workspace_id: string }
        Returns: string
      }
      resolve_commission_percentage: {
        Args: {
          _course_id: string
          _instructor_id: string
          _workspace_id: string
        }
        Returns: number
      }
      restore_admin: { Args: { _email: string }; Returns: Json }
      review_course_deletion: {
        Args: { _approve: boolean; _notes: string; _request_id: string }
        Returns: undefined
      }
      revoke_all_user_sessions: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: number
      }
      revoke_user_session: { Args: { p_session_id: string }; Returns: boolean }
      submit_student_support: {
        Args: { p_message: string; p_subject: string }
        Returns: string
      }
      submit_website_inquiry: {
        Args: {
          p_email: string
          p_ip?: string
          p_message: string
          p_name: string
          p_phone: string
          p_subject: string
          p_user_agent?: string
        }
        Returns: string
      }
      try_issue_course_certificate: {
        Args: { _course: string; _student: string }
        Returns: string
      }
      update_checkout_coupon: {
        Args: { _coupon_code?: string; _payment_id: string }
        Returns: {
          amount: number
          base_price: number | null
          bundle_id: string | null
          coupon_code: string | null
          course_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          external_payment_id: string | null
          id: string
          invoice_url: string | null
          provider: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          tax_amount: number
          total_amount: number | null
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_certificate: {
        Args: { _code: string }
        Returns: {
          accent_color: string
          certificate_number: string
          completion_date: string
          completion_percentage: number
          course_title: string
          issued_at: string
          pdf_url: string
          revoked_at: string
          student_name: string
          template_id: string
          template_snapshot: Json
          verification_code: string
          workspace_name: string
        }[]
      }
    }
    Enums: {
      adjustment_kind: "credit" | "debit"
      announcement_status: "draft" | "scheduled" | "published" | "archived"
      announcement_target: "workspace" | "course" | "role"
      app_role:
        | "super_admin"
        | "organization_admin"
        | "instructor"
        | "student"
        | "staff"
        | "parent"
      assignment_status: "draft" | "published" | "scheduled"
      attendance_session_status: "draft" | "submitted" | "locked"
      attendance_status: "present" | "absent" | "late" | "excused"
      attendance_type:
        | "live_class"
        | "recorded_lesson"
        | "offline_classroom"
        | "workshop"
        | "practical"
        | "exam"
        | "seminar"
      coupon_discount_type: "percent" | "fixed"
      coupon_status: "active" | "expired" | "disabled"
      course_deletion_status:
        | "pending"
        | "approved"
        | "rejected"
        | "archived"
        | "deleted"
        | "cancelled"
      course_revenue_type:
        | "revenue_share"
        | "custom_share"
        | "instructor_fixed"
        | "per_student_fixed"
        | "one_time_contract"
        | "no_share"
      course_status:
        | "draft"
        | "published"
        | "archived"
        | "pending_review"
        | "approved"
        | "rejected"
        | "upcoming"
        | "scheduled"
        | "suspended"
      course_visibility: "public" | "private" | "password_protected"
      earning_settlement_status:
        | "pending"
        | "requested"
        | "approved"
        | "paid"
        | "on_hold"
        | "reversed"
      earning_status:
        | "active"
        | "refunded"
        | "adjusted"
        | "reversed"
        | "partially_refunded"
      enrollment_source:
        | "individual"
        | "admin_assigned"
        | "bulk_import"
        | "corporate"
        | "college"
      enrollment_status: "active" | "completed" | "expired"
      instructor_verification_status:
        | "pending"
        | "approved"
        | "rejected"
        | "resubmission_required"
      invoice_status: "draft" | "issued" | "paid" | "void" | "refunded"
      lesson_type: "video" | "pdf" | "text" | "embed"
      live_class_attendance_status: "present" | "late" | "absent"
      live_class_provider: "zoom" | "google_meet" | "jitsi" | "custom" | "teams"
      live_class_status: "scheduled" | "live" | "completed" | "cancelled"
      member_status: "active" | "invited" | "suspended"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      payout_status:
        | "requested"
        | "approved"
        | "paid"
        | "rejected"
        | "cancelled"
      provider_connection_status:
        | "not_connected"
        | "pending"
        | "connected"
        | "disabled"
      question_type:
        | "mcq"
        | "multi_select"
        | "true_false"
        | "short_answer"
        | "long_answer"
        | "fill_blank"
        | "matching"
        | "ordering"
        | "numeric"
        | "image_choice"
        | "file_upload"
      quiz_status: "draft" | "published" | "scheduled" | "archived"
      settlement_frequency:
        | "instant"
        | "weekly"
        | "monthly"
        | "quarterly"
        | "manual"
        | "one_time"
      settlement_payment_mode:
        | "bank_transfer"
        | "upi"
        | "neft"
        | "rtgs"
        | "imps"
        | "cash"
        | "cheque"
        | "other"
      support_status: "open" | "pending" | "resolved" | "closed"
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
      adjustment_kind: ["credit", "debit"],
      announcement_status: ["draft", "scheduled", "published", "archived"],
      announcement_target: ["workspace", "course", "role"],
      app_role: [
        "super_admin",
        "organization_admin",
        "instructor",
        "student",
        "staff",
        "parent",
      ],
      assignment_status: ["draft", "published", "scheduled"],
      attendance_session_status: ["draft", "submitted", "locked"],
      attendance_status: ["present", "absent", "late", "excused"],
      attendance_type: [
        "live_class",
        "recorded_lesson",
        "offline_classroom",
        "workshop",
        "practical",
        "exam",
        "seminar",
      ],
      coupon_discount_type: ["percent", "fixed"],
      coupon_status: ["active", "expired", "disabled"],
      course_deletion_status: [
        "pending",
        "approved",
        "rejected",
        "archived",
        "deleted",
        "cancelled",
      ],
      course_revenue_type: [
        "revenue_share",
        "custom_share",
        "instructor_fixed",
        "per_student_fixed",
        "one_time_contract",
        "no_share",
      ],
      course_status: [
        "draft",
        "published",
        "archived",
        "pending_review",
        "approved",
        "rejected",
        "upcoming",
        "scheduled",
        "suspended",
      ],
      course_visibility: ["public", "private", "password_protected"],
      earning_settlement_status: [
        "pending",
        "requested",
        "approved",
        "paid",
        "on_hold",
        "reversed",
      ],
      earning_status: [
        "active",
        "refunded",
        "adjusted",
        "reversed",
        "partially_refunded",
      ],
      enrollment_source: [
        "individual",
        "admin_assigned",
        "bulk_import",
        "corporate",
        "college",
      ],
      enrollment_status: ["active", "completed", "expired"],
      instructor_verification_status: [
        "pending",
        "approved",
        "rejected",
        "resubmission_required",
      ],
      invoice_status: ["draft", "issued", "paid", "void", "refunded"],
      lesson_type: ["video", "pdf", "text", "embed"],
      live_class_attendance_status: ["present", "late", "absent"],
      live_class_provider: ["zoom", "google_meet", "jitsi", "custom", "teams"],
      live_class_status: ["scheduled", "live", "completed", "cancelled"],
      member_status: ["active", "invited", "suspended"],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      payout_status: ["requested", "approved", "paid", "rejected", "cancelled"],
      provider_connection_status: [
        "not_connected",
        "pending",
        "connected",
        "disabled",
      ],
      question_type: [
        "mcq",
        "multi_select",
        "true_false",
        "short_answer",
        "long_answer",
        "fill_blank",
        "matching",
        "ordering",
        "numeric",
        "image_choice",
        "file_upload",
      ],
      quiz_status: ["draft", "published", "scheduled", "archived"],
      settlement_frequency: [
        "instant",
        "weekly",
        "monthly",
        "quarterly",
        "manual",
        "one_time",
      ],
      settlement_payment_mode: [
        "bank_transfer",
        "upi",
        "neft",
        "rtgs",
        "imps",
        "cash",
        "cheque",
        "other",
      ],
      support_status: ["open", "pending", "resolved", "closed"],
    },
  },
} as const
