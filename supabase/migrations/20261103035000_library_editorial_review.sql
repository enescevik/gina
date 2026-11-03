-- Editorial decisions are append-only and tied to one immutable package/question.
-- No decision publishes content, consumes quota or changes a family assignment.
create table gina.library_editorial_reviews (
 request_id uuid primary key, actor_id uuid not null, payload_hash text not null,
 package_id uuid not null, question_key text not null, question_revision int not null,
 review_revision int not null check(review_revision>0),
 outcome text not null check(outcome in('unreviewed','changes_requested','suitable')),
 note text not null, created_at timestamptz not null default now(),
 foreign key(package_id,question_key) references gina.library_import_questions(package_id,question_key),
 unique(package_id,question_key,review_revision)
);
alter table gina.library_editorial_reviews enable row level security;
revoke all on gina.library_editorial_reviews from public,anon,authenticated,service_role;
create trigger immutable before update or delete on gina.library_editorial_reviews
 for each row execute function gina.guard_library_import();

create function public.admin_review_library_question(p_request_id uuid,p_package_id uuid,p_question_key text,p_question_revision int,p_expected_review_revision int,p_outcome text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); h text; old gina.library_editorial_reviews; row gina.library_editorial_reviews;
 q gina.library_import_questions; current_revision int; result jsonb;
begin
 perform gina.assert_admin();
 if actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_package_id is null or p_question_key is null or length(p_question_key) not between 1 and 100
 or p_question_revision is null or p_question_revision<1 or p_expected_review_revision is null or p_expected_review_revision<0
 or p_outcome is null or p_outcome not in('unreviewed','changes_requested','suitable')
 or p_note is null or length(p_note)>4000 or (p_outcome='changes_requested' and length(trim(p_note))<3) then raise exception 'library_review_input';end if;
 h:=encode(extensions.digest(jsonb_build_array(p_package_id,p_question_key,p_question_revision,p_expected_review_revision,p_outcome,p_note)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,86));
 select * into old from gina.library_editorial_reviews where request_id=p_request_id;
 if found then
  if old.actor_id<>actor or old.payload_hash<>h then raise exception 'library_review_request_conflict';end if;
  return to_jsonb(old)-array['payload_hash','actor_id'];
 end if;
 select * into q from gina.library_import_questions where package_id=p_package_id and question_key=p_question_key;
 if not found then raise exception 'library_review_not_found';end if;
 if q.revision<>p_question_revision then raise exception 'library_review_question_changed';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_package_id::text||':'||p_question_key,87));
 select coalesce(max(review_revision),0) into current_revision from gina.library_editorial_reviews where package_id=p_package_id and question_key=p_question_key;
 if current_revision<>p_expected_review_revision then raise exception 'library_review_changed';end if;
 insert into gina.library_editorial_reviews values(p_request_id,actor,h,p_package_id,p_question_key,p_question_revision,current_revision+1,p_outcome,p_note,now()) returning * into row;
 result:=to_jsonb(row)-array['payload_hash','actor_id'];
 insert into public.audit_log(actor_id,action,target_table,target_id,details)
 values(actor,'library_question.reviewed','gina.library_import_packages',p_package_id::text,jsonb_build_object('question_key',p_question_key,'question_revision',p_question_revision,'review_revision',row.review_revision,'outcome',p_outcome));
 return result;
end;$$;

create function public.admin_get_library_reviews(p_package_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if not exists(select 1 from gina.library_import_packages where id=p_package_id) then raise exception 'library_review_not_found';end if;
 return (select coalesce(jsonb_agg(to_jsonb(r)-array['payload_hash','actor_id'] order by r.question_key),'[]') from (
 select distinct on(question_key) * from gina.library_editorial_reviews where package_id=p_package_id order by question_key,review_revision desc)r);
end;$$;

create function public.admin_list_library_draft_packages(p_before_created_at timestamptz default null,p_before_id uuid default null,p_limit int default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if p_limit is null or p_limit not between 1 and 100 or (p_before_created_at is null)<>(p_before_id is null) then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
 select p.id,p.package_key,p.revision,p.title,p.grade,p.subject,p.status,p.created_at,
 (select count(*) from gina.library_import_questions q where q.package_id=p.id) question_count,
 (select count(*) from gina.library_import_sources s where s.package_id=p.id) source_count
 from gina.library_import_packages p
 where p_before_id is null or (p.created_at,p.id)<(p_before_created_at,p_before_id)
 order by p.created_at desc,p.id desc limit p_limit)r);
end;$$;
revoke all on function public.admin_review_library_question(uuid,uuid,text,int,int,text,text),public.admin_get_library_reviews(uuid),public.admin_list_library_draft_packages(timestamptz,uuid,int) from public,anon,service_role;
grant execute on function public.admin_review_library_question(uuid,uuid,text,int,int,text,text),public.admin_get_library_reviews(uuid),public.admin_list_library_draft_packages(timestamptz,uuid,int) to authenticated;
