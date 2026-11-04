-- Capacity and panel brand are separate fields. Allow multiple packages to
-- share a capacity name without changing existing rows or their references.
DROP INDEX IF EXISTS "public"."course_name_key";
