-- Realtime: yalnız geçersizleme sinyali olarak kullanılır (istemci sorguyu yeniden çeker).
-- RLS, postgres_changes akışında da uygulanır; cihaz yalnız kendi ailesinin satırlarını görür.

alter publication supabase_realtime add table public.task_completions;
alter publication supabase_realtime add table public.star_events;
alter publication supabase_realtime add table public.task_templates;
alter publication supabase_realtime add table public.events;
