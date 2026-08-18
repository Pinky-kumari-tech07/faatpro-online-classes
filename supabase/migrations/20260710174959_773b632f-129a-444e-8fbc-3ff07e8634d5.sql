
-- Dedup safely (keep oldest per workspace+slug and workspace+lower(name)), moving course refs
DO $$
DECLARE
  dup RECORD;
  survivor_name TEXT;
BEGIN
  -- Merge duplicates by slug
  FOR dup IN
    SELECT workspace_id, slug, MIN(created_at) AS oldest
    FROM public.course_categories
    GROUP BY workspace_id, slug
    HAVING COUNT(*) > 1
  LOOP
    -- pick survivor
    PERFORM 1;
    WITH survivor AS (
      SELECT id, name FROM public.course_categories
      WHERE workspace_id = dup.workspace_id AND slug = dup.slug
      ORDER BY created_at ASC LIMIT 1
    )
    UPDATE public.courses c
    SET category = (SELECT name FROM survivor)
    FROM public.course_categories dupcat, survivor s
    WHERE dupcat.workspace_id = dup.workspace_id
      AND dupcat.slug = dup.slug
      AND dupcat.id <> s.id
      AND c.category = dupcat.name
      AND c.workspace_id = dup.workspace_id;

    DELETE FROM public.course_categories cc
    USING (
      SELECT id FROM public.course_categories
      WHERE workspace_id = dup.workspace_id AND slug = dup.slug
      ORDER BY created_at ASC OFFSET 1
    ) losers
    WHERE cc.id = losers.id;
  END LOOP;

  -- Merge duplicates by lower(name)
  FOR dup IN
    SELECT workspace_id, LOWER(name) AS lname
    FROM public.course_categories
    GROUP BY workspace_id, LOWER(name)
    HAVING COUNT(*) > 1
  LOOP
    WITH survivor AS (
      SELECT id, name FROM public.course_categories
      WHERE workspace_id = dup.workspace_id AND LOWER(name) = dup.lname
      ORDER BY created_at ASC LIMIT 1
    )
    UPDATE public.courses c
    SET category = (SELECT name FROM survivor)
    FROM public.course_categories dupcat, survivor s
    WHERE dupcat.workspace_id = dup.workspace_id
      AND LOWER(dupcat.name) = dup.lname
      AND dupcat.id <> s.id
      AND c.category = dupcat.name
      AND c.workspace_id = dup.workspace_id;

    DELETE FROM public.course_categories cc
    USING (
      SELECT id FROM public.course_categories
      WHERE workspace_id = dup.workspace_id AND LOWER(name) = dup.lname
      ORDER BY created_at ASC OFFSET 1
    ) losers
    WHERE cc.id = losers.id;
  END LOOP;
END $$;

-- Unique constraints (workspace-scoped)
CREATE UNIQUE INDEX IF NOT EXISTS course_categories_workspace_slug_key
  ON public.course_categories (workspace_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS course_categories_workspace_name_key
  ON public.course_categories (workspace_id, LOWER(name));
