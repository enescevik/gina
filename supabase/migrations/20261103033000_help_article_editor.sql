-- Explicit editor contract: null platform means all platforms; 'all' is the
-- generic article audience. Public mobile reader keeps its existing semantics.
create function public.list_help_editor_articles(p_locale text default 'tr',p_platform text default null,p_after_slug text default null,p_after_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 if p_locale is null or p_locale not in('tr','en') or (p_platform is not null and p_platform not in('all','ios','android','web')) or (p_after_slug is null)<>(p_after_id is null) then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
 select a.id,a.slug,a.locale,a.platform,a.revision,a.published_revision,v.title,v.reviewed_at from public.help_articles a
 join public.help_article_versions v on v.article_id=a.id and v.revision=a.revision
 where a.locale=p_locale and (p_platform is null or a.platform=p_platform)
 and (p_after_slug is null or (a.slug,a.id)>(p_after_slug,p_after_id)) order by a.slug,a.id limit 50
 )r);
end;$$;
create function public.get_help_editor_article(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.help_articles;draft jsonb;published jsonb;
begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 select * into a from public.help_articles where id=p_id;if not found then raise exception 'article_not_found';end if;
 select jsonb_build_object('revision',revision,'title',title,'body',body,'reviewed_at',reviewed_at) into draft from public.help_article_versions where article_id=a.id and revision=a.revision;
 select jsonb_build_object('revision',revision,'title',title,'body',body,'reviewed_at',reviewed_at) into published from public.help_article_versions where article_id=a.id and revision=a.published_revision;
 return jsonb_build_object('id',a.id,'slug',a.slug,'locale',a.locale,'platform',a.platform,'revision',a.revision,'published_revision',a.published_revision,'draft',draft,'published',published);
end;$$;
revoke all on function public.list_help_editor_articles(text,text,text,uuid),public.get_help_editor_article(uuid) from public,anon;
grant execute on function public.list_help_editor_articles(text,text,text,uuid),public.get_help_editor_article(uuid) to authenticated;
