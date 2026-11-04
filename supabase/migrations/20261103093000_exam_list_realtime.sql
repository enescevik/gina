-- New assignments change exams before there is any exam_attempts row.
-- Publish only the existing RLS-protected exam metadata; no answers/review drafts.
alter publication supabase_realtime add table public.exams;
