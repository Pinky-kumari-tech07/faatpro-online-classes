
-- =====================================================================
-- 1. Course status: add review workflow values
-- =====================================================================
ALTER TYPE public.course_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE public.course_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.course_status ADD VALUE IF NOT EXISTS 'rejected';

-- =====================================================================
-- 2. Review tracking columns on courses
-- =====================================================================
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- =====================================================================
-- 3. Helper: only true admin/staff (NOT instructor)
-- =====================================================================
-- is_admin_or_staff_anywhere already exists — admin/staff/super_admin only.

-- =====================================================================
-- 4. COURSES policies — tighten visibility
-- =====================================================================
DROP POLICY IF EXISTS "Instructors can read all courses" ON public.courses;
DROP POLICY IF EXISTS "Admins instructors staff can read all courses" ON public.courses;
DROP POLICY IF EXISTS "courses_not_deleted_select_anon" ON public.courses;
DROP POLICY IF EXISTS "courses_not_deleted_select_authenticated" ON public.courses;
DROP POLICY IF EXISTS "courses_read_workspace" ON public.courses;
DROP POLICY IF EXISTS "courses_update" ON public.courses;
DROP POLICY IF EXISTS "courses_insert" ON public.courses;

-- SELECT: admin/staff see everything
CREATE POLICY "courses_admin_staff_read"
  ON public.courses FOR SELECT
  USING (public.is_admin_or_staff_anywhere(auth.uid()));

-- INSERT: admin/staff create anywhere; instructors create with self as instructor_id only
CREATE POLICY "courses_insert"
  ON public.courses FOR INSERT
  WITH CHECK (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR (
      instructor_id = auth.uid()
      AND public.is_workspace_member(auth.uid(), workspace_id)
    )
  );

-- UPDATE: admin/staff update anything;
-- instructor may update their own/co-instructed course
-- (status-transition restrictions enforced by trigger below).
CREATE POLICY "courses_update"
  ON public.courses FOR UPDATE
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR instructor_id = auth.uid()
    OR public.is_course_instructor(auth.uid(), id)
  )
  WITH CHECK (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR instructor_id = auth.uid()
    OR public.is_course_instructor(auth.uid(), id)
  );

-- =====================================================================
-- 5. Trigger: instructors cannot self-publish / self-approve
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_course_status_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := public.is_admin_or_staff_anywhere(auth.uid());
BEGIN
  -- Staff/admins bypass all restrictions
  IF is_staff THEN
    -- Auto-stamp reviewed_at when staff moves to approved/rejected/published
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('approved','rejected','published') THEN
      NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
      NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  -- For instructors:
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft') THEN
      RAISE EXCEPTION 'Instructors can only create courses in draft status';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allowed instructor transitions only
    IF NOT (
      (OLD.status = 'draft'          AND NEW.status = 'pending_review') OR
      (OLD.status = 'rejected'       AND NEW.status = 'pending_review') OR
      (OLD.status = 'pending_review' AND NEW.status = 'draft')          OR
      (OLD.status = 'approved'       AND NEW.status = 'draft')
    ) THEN
      RAISE EXCEPTION 'Instructors cannot change status from % to %', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'pending_review' THEN
      NEW.submitted_for_review_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_course_status ON public.courses;
CREATE TRIGGER trg_enforce_course_status
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_course_status_transitions();

-- =====================================================================
-- 6. LESSONS — instructor scoped
-- =====================================================================
DROP POLICY IF EXISTS "lessons_manage" ON public.lessons;
DROP POLICY IF EXISTS "lessons_read"   ON public.lessons;

CREATE POLICY "lessons_admin_staff_manage"
  ON public.lessons FOR ALL
  USING (public.is_admin_or_staff_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

CREATE POLICY "lessons_instructor_manage"
  ON public.lessons FOR ALL
  USING (public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));

CREATE POLICY "lessons_read"
  ON public.lessons FOR SELECT
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
    OR is_preview
    OR public.is_enrolled(auth.uid(), course_id)
  );

-- =====================================================================
-- 7. QUIZZES
-- =====================================================================
DROP POLICY IF EXISTS "quizzes_manage" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_read"   ON public.quizzes;

CREATE POLICY "quizzes_admin_staff_manage"
  ON public.quizzes FOR ALL
  USING (public.is_admin_or_staff_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

CREATE POLICY "quizzes_instructor_manage"
  ON public.quizzes FOR ALL
  USING (public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));

CREATE POLICY "quizzes_read"
  ON public.quizzes FOR SELECT
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
    OR public.is_enrolled(auth.uid(), course_id)
  );

-- =====================================================================
-- 8. ASSIGNMENTS
-- =====================================================================
DROP POLICY IF EXISTS "assignments_manage" ON public.assignments;
DROP POLICY IF EXISTS "assignments_read"   ON public.assignments;

CREATE POLICY "assignments_admin_staff_manage"
  ON public.assignments FOR ALL
  USING (public.is_admin_or_staff_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

CREATE POLICY "assignments_instructor_manage"
  ON public.assignments FOR ALL
  USING (public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));

CREATE POLICY "assignments_read"
  ON public.assignments FOR SELECT
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
    OR (status = 'published'::assignment_status AND public.is_enrolled(auth.uid(), course_id))
  );

-- =====================================================================
-- 9. LIVE CLASSES
-- =====================================================================
DROP POLICY IF EXISTS "live_classes_manage" ON public.live_classes;
DROP POLICY IF EXISTS "live_classes_read"   ON public.live_classes;

CREATE POLICY "live_classes_admin_staff_manage"
  ON public.live_classes FOR ALL
  USING (public.is_admin_or_staff_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

CREATE POLICY "live_classes_instructor_manage"
  ON public.live_classes FOR ALL
  USING (public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));

CREATE POLICY "live_classes_read"
  ON public.live_classes FOR SELECT
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
    OR public.is_enrolled(auth.uid(), course_id)
  );

-- =====================================================================
-- 10. ENROLLMENTS — restrict instructor reads to their courses only
-- =====================================================================
DROP POLICY IF EXISTS "enroll_read" ON public.enrollments;
CREATE POLICY "enroll_read"
  ON public.enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  );
