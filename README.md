# FAATPRO

Build a production-quality Core LMS SaaS web application using React, Tailwind, shadcn/ui patterns, and Supabase. This is a fresh rebuild inspired by Rocket LMS, but do not port Laravel/Blade/MySQL code or names. Use a modular architecture: Presentation Layer -> Feature Modules -> Service Layer -> Supabase Database/API Layer. The first release includes authentication, tenant workspaces, role-based dashboards, course authoring, enrollments, student learning UI, basic quizzes, and assignments.

Architecture requirements:
- Organize code conceptually as: src/modules/auth, workspace, dashboard, courses, learning, quizzes, assignments, students; shared/components, shared/layouts, shared/hooks, shared/utils; services/supabase, services/queries; routes; types.
- Pages must stay thin and render module containers.
- Module containers call service/query functions.
- Only service/query functions should call Supabase.
- Use Supabase Auth, PostgreSQL, Supabase Storage, and Row Level Security.

Data model requirements with workspace_id on tenant-owned tables:
- workspaces: id, name, slug, branding fields, created_at
- profiles: id matching auth user id, full_name, avatar_url, phone, created_at
- workspace_members: id, workspace_id, profile_id, role, status, created_at
- roles enum-like values: super_admin, organization_admin, instructor, student, staff, parent
- courses: id, workspace_id, title, slug, description, summary, thumbnail_url, status draft/published/archived, visibility public/private, category, tags, seo_title, seo_description, instructor_id, created_at, updated_at
- course_sections: id, workspace_id, course_id, title, position
- lessons: id, workspace_id, course_id, section_id, title, lesson_type video/pdf/text/embed, content, asset_url, duration_seconds, position, is_preview, created_at
- lesson_assets: id, workspace_id, lesson_id, asset_type, storage_path, public_url, title
- enrollments: id, workspace_id, course_id, student_id, status active/completed/expired, enrolled_at, completed_at
- lesson_progress: id, workspace_id, enrollment_id, lesson_id, student_id, progress_seconds, is_completed, last_viewed_at
- quizzes: id, workspace_id, course_id, lesson_id nullable, title, instructions, time_limit_minutes nullable, status draft/published
- quiz_questions: id, workspace_id, quiz_id, question_type mcq/multi_select/true_false, prompt, options json, correct_answers json, points, position
- quiz_attempts: id, workspace_id, quiz_id, student_id, answers json, score, max_score, submitted_at
- assignments: id, workspace_id, course_id, lesson_id nullable, title, instructions, due_at, max_points, allow_file_upload, status draft/published
- assignment_submissions: id, workspace_id, assignment_id, student_id, submission_text, file_path, grade, feedback, submitted_at, graded_at
- student_notes: id, workspace_id, student_id, course_id, lesson_id, timestamp_seconds, body, created_at
- notifications: id, workspace_id, profile_id, channel in_app/email/whatsapp/push, event_type, title, body, read_at, created_at

RLS/access requirements:
- super_admin can access platform-level views.
- organization_admin can manage all records in their workspace.
- instructor can manage assigned courses, lessons, quizzes, and assignments.
- student can access enrolled learning content and submit work.
- staff has limited workspace management access.
- parent is optional read-only for linked students.
- Prevent cross-workspace reads/writes.

UI requirements:
- Clean, premium, educational SaaS style. Use Inter or Plus Jakarta Sans, generous whitespace, light borders, restrained shadows, 12-16px radius.
- Avoid an overloaded ERP/admin look. Dashboards should feel calm and scannable like Linear/Notion/ClickUp. Student learning should feel content-first like Coursera/Udemy.
- Use a persistent sidebar app shell with Logo, Search, Dashboard, Courses, Students, Assignments, Quizzes, Live Classes placeholder, Certificates placeholder, Reports placeholder, Settings.
- Use lucide-style icons and shadcn-like components: Button, Card, Badge, Tabs, Dialog, Sheet, Dropdown, Input, Select, Table, Progress, Textarea.

Feature requirements:
1. Foundation
- Supabase client setup, auth guards, protected routes, session handling.
- Login, register, forgot password UX.
- Workspace selector/resolver and role-based redirect after login.
- Role-aware sidebar and route protection.

2. Dashboards
- Student dashboard: enrolled courses, progress, upcoming assignments, continue learning.
- Instructor dashboard: assigned courses, recent submissions, quiz summaries.
- Organization admin dashboard: active users, courses, enrollments, basic revenue placeholder.

3. Course Management
- Course list with pagination, workspace filtering, search, status filter, explicit sorting.
- Course create/edit form with draft/publish, category, tags, thumbnail, description, SEO fields.
- Course builder with sections and lessons.
- Lesson types for v1: video URL/upload reference, PDF/resource, rich text, embedded content.
- Live class, drip content, course expiry, certificates, payments, and coupons should appear as thoughtful placeholders or future-ready fields only, not complete workflows.

4. Learning Experience
- Student learning route with left curriculum sidebar, center content area, right notes/resources/discussion panel, and bottom previous/next controls.
- Auto-save lesson progress, mark complete, resume lesson, and timestamped notes.
- Fetch only the selected course, section list, current lesson, notes, and progress.

5. Quizzes and Assignments
- Basic quiz builder with MCQ, multi-select, and true/false.
- Quiz attempts with score calculation for auto-gradable questions.
- Assignment create/edit with deadline and upload requirements.
- Student submissions through Supabase Storage.
- Instructor grading and feedback.

Service interface requirements:
- Define TypeScript types for Workspace, Profile, WorkspaceMember, Course, CourseSection, Lesson, Enrollment, LessonProgress, Quiz, QuizQuestion, QuizAttempt, Assignment, AssignmentSubmission, StudentNote.
- Create service methods: authService.getCurrentUser(), workspaceService.getCurrentWorkspace(), courseService.listCourses(filters), courseService.getCourseBuilder(courseId), learningService.getLearningSession(courseId, lessonId), learningService.saveProgress(payload), quizService.submitAttempt(payload), assignmentService.submitAssignment(payload).
- All list methods must use pagination, workspace filtering, and explicit sorting.

Acceptance criteria:
- New user can register/login, get a profile, join or create a workspace, and land on correct dashboard.
- Organization admin can create a course, add sections, add lessons, publish the course, and enroll a student.
- Student only sees courses in their workspace and only opens enrolled course content.
- Instructor only manages courses assigned to them.
- Student learning page resumes latest lesson and saves progress without refresh.
- Student can complete a lesson, add timestamped notes, move previous/next, and see progress update.
- Instructor can create a basic quiz; student can submit; score is stored.
- Instructor can create an assignment; student can upload a submission; instructor can grade it.
- RLS blocks cross-workspace reads and writes.
- Course, student, quiz, and assignment lists use pagination and do not fetch all rows.

Seed/demo data: Include realistic demo content for a workspace called FAATPRO Academy with admin, instructor, and student views, so the app feels complete even before a real production setup.


## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
