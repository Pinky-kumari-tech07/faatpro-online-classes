export type AppRole =
  | "super_admin"
  | "organization_admin"
  | "instructor"
  | "student"
  | "staff"
  | "parent";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string | null;
  tagline: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  profile_id: string;
  role: AppRole;
  status: "active" | "invited" | "suspended";
  created_at: string;
}

export type CourseStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "published"
  | "archived";
export type CourseVisibility = "public" | "private";

export interface Course {
  id: string;
  workspace_id: string;
  title: string;
  slug: string;
  description: string | null;
  summary: string | null;
  thumbnail_url: string | null;
  status: CourseStatus;
  visibility: CourseVisibility;
  category: string | null;
  tags: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  instructor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseSection {
  id: string;
  workspace_id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
}

export type LessonType = "video" | "pdf" | "text" | "embed";

export interface Lesson {
  id: string;
  workspace_id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  lesson_type: LessonType;
  content: string | null;
  asset_url: string | null;
  duration_seconds: number | null;
  position: number;
  is_preview: boolean;
  created_at: string;
}

export interface Enrollment {
  id: string;
  workspace_id: string;
  course_id: string;
  student_id: string;
  status: "active" | "completed" | "expired";
  enrolled_at: string;
  completed_at: string | null;
}

export interface LessonProgress {
  id: string;
  workspace_id: string;
  enrollment_id: string;
  lesson_id: string;
  student_id: string;
  progress_seconds: number;
  is_completed: boolean;
  last_viewed_at: string;
}

export interface Quiz {
  id: string;
  workspace_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  time_limit_minutes: number | null;
  status: "draft" | "published";
  created_at: string;
}

export type QuestionType = "mcq" | "multi_select" | "true_false";

export interface QuizQuestion {
  id: string;
  workspace_id: string;
  quiz_id: string;
  question_type: QuestionType;
  prompt: string;
  options: string[];
  correct_answers: (string | number | boolean)[];
  points: number;
  position: number;
}

export interface QuizAttempt {
  id: string;
  workspace_id: string;
  quiz_id: string;
  student_id: string;
  answers: Record<string, unknown>;
  score: number;
  max_score: number;
  submitted_at: string;
}

export interface Assignment {
  id: string;
  workspace_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  due_at: string | null;
  max_points: number;
  allow_file_upload: boolean;
  status: "draft" | "published";
  created_at: string;
}

export interface AssignmentSubmission {
  id: string;
  workspace_id: string;
  assignment_id: string;
  student_id: string;
  submission_text: string | null;
  file_path: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
}

export interface StudentNote {
  id: string;
  workspace_id: string;
  student_id: string;
  course_id: string;
  lesson_id: string | null;
  timestamp_seconds: number | null;
  body: string;
  created_at: string;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CourseStatus | "all";
  sort?: { column: string; ascending: boolean };
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type LiveClassProvider = "zoom" | "google_meet" | "teams" | "jitsi" | "custom";
export type LiveClassStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface LiveClass {
  id: string;
  workspace_id: string;
  course_id: string | null;
  instructor_id: string | null;
  title: string;
  description: string | null;
  provider: LiveClassProvider;
  meeting_url: string | null;
  meeting_password: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  status: LiveClassStatus;
  recording_url: string | null;
  created_at: string;
  is_public: boolean;
  banner_url: string | null;
  thumbnail_url: string | null;
  max_participants: number | null;
  waiting_room: boolean;
  recording_enabled: boolean;
  price: number;
  bundle_id: string | null;
  batch_id: string | null;
  institution_id: string | null;
  assigned_student_ids: string[];
}

export interface CertificateTemplate {
  id: string;
  workspace_id: string;
  name: string;
  title: string;
  body_template: string;
  signature_name: string | null;
  logo_url: string | null;
  background_url: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Certificate {
  id: string;
  workspace_id: string;
  course_id: string;
  student_id: string;
  template_id: string | null;
  certificate_number: string;
  verification_code: string;
  pdf_url: string | null;
  issued_at: string;
}

export interface WorkspaceSettings {
  workspace_id: string;
  contact_email: string | null;
  timezone: string | null;
  primary_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  certificate_signature_name: string | null;
  certificate_signature_url: string | null;
  default_course_visibility: CourseVisibility;
  auto_issue_certificates: boolean;
  completion_threshold: number;
}

export interface PaymentProvider {
  id: string;
  workspace_id: string;
  provider: string;
  status: "not_connected" | "pending" | "connected" | "disabled";
  config_public: Record<string, unknown>;
  created_at: string;
}

export interface Coupon {
  id: string;
  workspace_id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  status: "active" | "expired" | "disabled";
}

export interface NotificationItem {
  id: string;
  workspace_id: string;
  profile_id: string;
  channel: string;
  event_type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceSession {
  id: string;
  workspace_id: string;
  course_id: string;
  live_class_id: string | null;
  title: string;
  session_date: string;
  notes: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  workspace_id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  notes: string | null;
  marked_at: string;
}

export type AnnouncementTarget = "workspace" | "course" | "role";
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "archived";

export interface Announcement {
  id: string;
  workspace_id: string;
  title: string;
  body: string | null;
  target_type: AnnouncementTarget;
  target_id: string | null;
  target_role: AppRole | null;
  publish_at: string | null;
  status: AnnouncementStatus;
  created_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  title: string | null;
  is_group: boolean;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  workspace_id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface Discussion {
  id: string;
  workspace_id: string;
  course_id: string;
  lesson_id: string | null;
  author_id: string;
  title: string;
  body: string | null;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  created_at: string;
}

export interface DiscussionReply {
  id: string;
  workspace_id: string;
  discussion_id: string;
  author_id: string;
  body: string;
  is_instructor_answer: boolean;
  created_at: string;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "void" | "refunded";

export interface Invoice {
  id: string;
  workspace_id: string;
  payment_id: string | null;
  student_id: string;
  course_id: string | null;
  invoice_number: string;
  amount: number;
  tax: number;
  currency: string;
  gst_number: string | null;
  status: InvoiceStatus;
  issued_at: string;
  notes: string | null;
}

export interface Payment {
  id: string;
  workspace_id: string;
  student_id: string;
  course_id: string | null;
  provider: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  external_payment_id: string | null;
  invoice_url: string | null;
  created_at: string;
}