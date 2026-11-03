-- Private, immutable intake. No publication/redemption path is added here.
-- PNG bytes + shared context + student question + teacher rubric commit together.
create table gina.library_import_packages (
 id uuid primary key, package_key text not null, revision int not null check(revision>0),
 previous_id uuid references gina.library_import_packages(id), content_hash text not null,
 title text not null, grade int not null check(grade between 1 and 12), subject text not null,
 provenance jsonb not null, status text not null default 'draft' check(status='draft'),
 created_by uuid not null, created_at timestamptz not null default now(),
 unique(package_key,revision)
);
create table gina.library_import_assets (
 sha256 text primary key, png bytea not null, width int not null, height int not null
);
create table gina.library_import_sources (
 package_id uuid not null references gina.library_import_packages(id), source_key text not null,
 title text not null, body text not null, alt text not null,
 asset_hash text references gina.library_import_assets(sha256),
 minimum_reading_width int not null, provenance jsonb not null,
 primary key(package_id,source_key)
);
create table gina.library_import_questions (
 package_id uuid not null references gina.library_import_packages(id), question_key text not null,
 revision int not null, position int not null, source_key text, student jsonb not null, metadata jsonb not null,
 primary key(package_id,question_key), unique(package_id,position),
 foreign key(package_id,source_key) references gina.library_import_sources(package_id,source_key)
);
create table gina.library_import_answers (
 package_id uuid not null, question_key text not null, teacher jsonb not null,
 primary key(package_id,question_key),
 foreign key(package_id,question_key) references gina.library_import_questions(package_id,question_key)
);
create table gina.library_import_requests (
 request_id uuid primary key, actor_id uuid not null, payload_hash text not null,
 package_id uuid not null references gina.library_import_packages(id), result jsonb not null
);
-- No account FK: immutable editorial provenance must not block account deletion.
-- Audit actor references use the existing audit_log ON DELETE SET NULL contract.
create function gina.guard_library_import() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'library_import_immutable'; end; $$;
do $$declare t text;begin
 foreach t in array array['library_import_packages','library_import_assets','library_import_sources','library_import_questions','library_import_answers','library_import_requests'] loop
  execute format('alter table gina.%I enable row level security',t);
  execute format('revoke all on gina.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger immutable before update or delete on gina.%I for each row execute function gina.guard_library_import()',t);
 end loop;
end;$$;

create function gina.import_keys(p jsonb,keys text[]) returns void language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'library_import_shape';end if;
 if not(p ?& keys) or exists(select 1 from jsonb_object_keys(p) k where not(k=any(keys))) then raise exception 'library_import_shape';end if;
end;$$;
create function gina.import_text(p jsonb,min_length int,max_length int) returns text language plpgsql immutable set search_path='' as $$
declare v text:=p#>>'{}';begin
 if jsonb_typeof(p) is distinct from 'string' or length(trim(v)) not between min_length and max_length then raise exception 'library_import_text';end if;
 return v;
end;$$;
create function gina.import_int(p jsonb,min_value int,max_value int) returns int language plpgsql immutable set search_path='' as $$
declare v numeric;begin
 if jsonb_typeof(p) is distinct from 'number' then raise exception 'library_import_number';end if;
 v:=(p#>>'{}')::numeric;
 if v<>trunc(v) or v<min_value or v>max_value then raise exception 'library_import_number';end if;
 return v::int;
end;$$;
create function gina.import_key(p jsonb) returns text language plpgsql immutable set search_path='' as $$
declare v text:=gina.import_text(p,1,100);begin
 if v!~'^[a-zA-Z0-9][a-zA-Z0-9_-]*$' then raise exception 'library_import_key';end if;return v;
end;$$;

-- Signature, static RGB/RGBA IHDR, dimensions, bounded chunks and terminal IEND.
-- Does not decompress image pixels or certify CRC/colorimetry/editorial quality.
create function gina.import_png(p bytea) returns int[] language plpgsql immutable set search_path='' as $$
declare w bigint;h bigint;pos int:=9;n bigint;kind text;idat boolean:=false;ended boolean:=false;begin
 if p is null or octet_length(p) not between 57 and 524288 or substring(p from 1 for 8)<>decode('89504e470d0a1a0a','hex')
 or substring(p from 9 for 8)<>decode('0000000d49484452','hex') then raise exception 'library_import_png';end if;
 w:=('x'||encode(substring(p from 17 for 4),'hex'))::bit(32)::bigint;
 h:=('x'||encode(substring(p from 21 for 4),'hex'))::bit(32)::bigint;
 if w not between 1 and 4096 or h not between 1 and 4096 or w*h>4000000
 or get_byte(p,24)<>8 or get_byte(p,25) not in(2,6) or get_byte(p,26)<>0 or get_byte(p,27)<>0 or get_byte(p,28)<>0 then raise exception 'library_import_png';end if;
 while pos<=octet_length(p) loop
  if pos+11>octet_length(p) then raise exception 'library_import_png';end if;
  n:=('x'||encode(substring(p from pos for 4),'hex'))::bit(32)::bigint;
  if n>524288 or pos+n+11>octet_length(p) then raise exception 'library_import_png';end if;
  kind:=encode(substring(p from pos+4 for 4),'escape');
  if kind not in('IHDR','PLTE','IDAT','IEND','sRGB','iCCP','gAMA','cHRM','pHYs') or (kind='IHDR' and pos<>9) then raise exception 'library_import_png';end if;
  if kind='IDAT' then idat:=true;end if;
  if kind='IEND' then
   if n<>0 or pos+11<>octet_length(p) or not idat then raise exception 'library_import_png';end if;
   ended:=true;
  end if;
  pos:=pos+n::int+12;
 end loop;
 if not ended then raise exception 'library_import_png';end if;
 return array[w::int,h::int];
end;$$;

create function public.admin_import_library_bundle(p_request_id uuid,p_bundle jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();h text;receipt gina.library_import_requests;existing gina.library_import_packages;prev gina.library_import_packages;
 pid uuid:=gen_random_uuid();pk text;rev int;gr int;subj text;item jsonb;entry jsonb;asset jsonb;bytes bytea;dims int[];digest text;
 asset_ids text[]:='{}';source_ids text[]:='{}';question_ids text[]:='{}';key text;v_source_key text;pos int:=0;total_bytes int:=0;total_pixels bigint:=0;
 student jsonb;teacher jsonb;rubric jsonb;criterion jsonb;crit_ids text[];points int;maximum int;canonical jsonb;
 prior_q gina.library_import_questions;prior_teacher jsonb;source_changed boolean;result jsonb;
begin
 perform gina.assert_admin();
 if actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_bundle is null or octet_length(p_bundle::text)>6000000 then raise exception 'library_import_size';end if;
 perform gina.import_keys(p_bundle,array['schema','package_key','revision','previous_hash','title','grade','subject','provenance','assets','sources','questions']);
 if p_bundle->>'schema' is distinct from 'gina.library-import.v1' then raise exception 'library_import_schema';end if;
 pk:=gina.import_key(p_bundle->'package_key');rev:=gina.import_int(p_bundle->'revision',1,100000);
 gr:=gina.import_int(p_bundle->'grade',1,12);subj:=gina.import_text(p_bundle->'subject',1,80);
 perform gina.import_text(p_bundle->'title',3,160);
 if jsonb_typeof(p_bundle->'provenance') is distinct from 'object' or octet_length((p_bundle->'provenance')::text)>16000 then raise exception 'library_import_provenance';end if;
 if jsonb_typeof(p_bundle->'assets') is distinct from 'array' or jsonb_typeof(p_bundle->'sources') is distinct from 'array' or jsonb_typeof(p_bundle->'questions') is distinct from 'array' then raise exception 'library_import_shape';end if;
 if jsonb_array_length(p_bundle->'questions') not between 1 and 100 or jsonb_array_length(p_bundle->'sources')>100 or jsonb_array_length(p_bundle->'assets')>100 then raise exception 'library_import_size';end if;
 h:=encode(extensions.digest(p_bundle::text,'sha256'),'hex');
 -- Request lock first, then series lock. All asset conflicts are taken in hash order.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,84));
 select * into receipt from gina.library_import_requests where request_id=p_request_id;
 if found then
  if receipt.actor_id<>actor or receipt.payload_hash<>h then raise exception 'library_import_request_conflict';end if;
  return receipt.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(pk,85));
 select * into existing from gina.library_import_packages where package_key=pk and revision=rev;
 if found then
  if existing.content_hash<>h then raise exception 'library_import_revision_conflict';end if;
  result:=jsonb_build_object('id',existing.id,'content_hash',h,'status','draft','revision',rev,'created',false);
  insert into gina.library_import_requests values(p_request_id,actor,h,existing.id,result);
  return result;
 end if;
 select * into prev from gina.library_import_packages where package_key=pk order by revision desc limit 1;
 if prev.id is null then
  if rev<>1 or p_bundle->'previous_hash' is distinct from 'null'::jsonb then raise exception 'library_import_previous_changed';end if;
 else
  if rev<>prev.revision+1 or p_bundle->>'previous_hash' is distinct from prev.content_hash then raise exception 'library_import_previous_changed';end if;
  if gr<>prev.grade or subj<>prev.subject then raise exception 'library_import_scope_locked';end if;
 end if;
 insert into gina.library_import_packages(id,package_key,revision,previous_id,content_hash,title,grade,subject,provenance,created_by)
 values(pid,pk,rev,prev.id,h,p_bundle->>'title',gr,subj,p_bundle->'provenance',actor);
 for asset in select value from jsonb_array_elements(p_bundle->'assets') order by value->>'sha256' loop
  perform gina.import_keys(asset,array['key','mime','sha256','width','height','base64']);
  key:=gina.import_key(asset->'key');
  if key=any(asset_ids) then raise exception 'library_import_duplicate_key';end if;asset_ids:=array_append(asset_ids,key);
  if asset->>'mime' is distinct from 'image/png' or coalesce(asset->>'sha256','')!~'^[a-f0-9]{64}$' then raise exception 'library_import_asset';end if;
  perform gina.import_text(asset->'base64',1,700000);
  if (asset->>'base64')!~'^[A-Za-z0-9+/]*={0,2}$' then raise exception 'library_import_asset';end if;
  begin bytes:=decode(asset->>'base64','base64');exception when others then raise exception 'library_import_asset';end;
  if replace(encode(bytes,'base64'),E'\n','')<>asset->>'base64' then raise exception 'library_import_asset';end if;
  dims:=gina.import_png(bytes);digest:=encode(extensions.digest(bytes,'sha256'),'hex');
  if digest<>asset->>'sha256' or dims<>array[gina.import_int(asset->'width',1,4096),gina.import_int(asset->'height',1,4096)] then raise exception 'library_import_asset';end if;
  total_bytes:=total_bytes+octet_length(bytes);total_pixels:=total_pixels+dims[1]*dims[2];
  if total_bytes>3000000 or total_pixels>24000000 then raise exception 'library_import_size';end if;
  insert into gina.library_import_assets values(digest,bytes,dims[1],dims[2]) on conflict(sha256) do nothing;
 end loop;
 for item in select value from jsonb_array_elements(p_bundle->'sources') loop
  perform gina.import_keys(item,array['key','title','body','alt','asset_key','minimum_reading_width','provenance']);
  key:=gina.import_key(item->'key');
  if key=any(source_ids) then raise exception 'library_import_duplicate_key';end if;source_ids:=array_append(source_ids,key);
  if item->'asset_key'='null'::jsonb then
   perform gina.import_text(item->'body',1,6000);digest:=null;
  else
   if not(gina.import_key(item->'asset_key')=any(asset_ids)) then raise exception 'library_import_missing_asset';end if;
   select value->>'sha256' into digest from jsonb_array_elements(p_bundle->'assets') where value->>'key'=item->>'asset_key';
  end if;
  if jsonb_typeof(item->'provenance') is distinct from 'object' or octet_length((item->'provenance')::text)>4000 then raise exception 'library_import_provenance';end if;
  insert into gina.library_import_sources values(pid,key,gina.import_text(item->'title',1,160),gina.import_text(item->'body',0,6000),gina.import_text(item->'alt',case when digest is null then 0 else 1 end,2000),digest,gina.import_int(item->'minimum_reading_width',0,1600),item->'provenance');
 end loop;
 for item in select value from jsonb_array_elements(p_bundle->'questions') loop
  perform gina.import_keys(item,array['key','revision','source_key','student','teacher','metadata']);
  key:=gina.import_key(item->'key');
  if key=any(question_ids) then raise exception 'library_import_duplicate_key';end if;question_ids:=array_append(question_ids,key);
  if item->'source_key'='null'::jsonb then v_source_key:=null;else v_source_key:=gina.import_key(item->'source_key');end if;
  if v_source_key is not null and not(v_source_key=any(source_ids)) then raise exception 'library_import_missing_source';end if;
  student:=item->'student';teacher:=item->'teacher';
  perform gina.import_keys(student,array['grade','subject','topic','kind','difficulty','stem','choices']);
  perform gina.import_keys(teacher,array['correct_key','expected_answer','solution','explanation','rubric','common_misconception','next_step']);
  if gina.import_int(student->'grade',1,12)<>gr or gina.import_text(student->'subject',1,80)<>subj then raise exception 'library_import_scope';end if;
  perform gina.import_text(student->'topic',1,200);perform gina.import_text(student->'stem',5,3500);
  perform gina.import_text(teacher->'expected_answer',1,10000);perform gina.import_text(teacher->'solution',1,10000);
  perform gina.import_text(teacher->'explanation',1,4000);perform gina.import_text(teacher->'common_misconception',1,2000);perform gina.import_text(teacher->'next_step',1,2000);
  canonical:=gina.library_question(student||(teacher-array['rubric','common_misconception','next_step']));
  if student->>'kind'='open_ended' and (student->'choices' is distinct from '[]'::jsonb or teacher->'correct_key' is distinct from 'null'::jsonb) then raise exception 'library_import_answer';end if;
  if student->>'kind'='multiple_choice' then
   for entry in select value from jsonb_array_elements(student->'choices') loop
    perform gina.import_keys(entry,array['key','text']);perform gina.import_text(entry->'text',1,2000);
   end loop;
  end if;
  rubric:=teacher->'rubric';perform gina.import_keys(rubric,array['max_points','scoring','criteria','missing_answer','review_required']);
  maximum:=gina.import_int(rubric->'max_points',1,100);points:=0;crit_ids:='{}';
  perform gina.import_text(rubric->'scoring',1,4000);perform gina.import_text(rubric->'missing_answer',1,2000);
  if rubric->'review_required' is distinct from 'true'::jsonb or jsonb_typeof(rubric->'criteria') is distinct from 'array' then raise exception 'library_import_rubric';end if;
  if jsonb_array_length(rubric->'criteria') not between 1 and 20 then raise exception 'library_import_rubric';end if;
  for criterion in select value from jsonb_array_elements(rubric->'criteria') loop
   perform gina.import_keys(criterion,array['id','points','criterion']);
   if gina.import_key(criterion->'id')=any(crit_ids) then raise exception 'library_import_rubric';end if;crit_ids:=array_append(crit_ids,criterion->>'id');
   points:=points+gina.import_int(criterion->'points',1,100);perform gina.import_text(criterion->'criterion',1,2000);
  end loop;
  if points<>maximum then raise exception 'library_import_rubric';end if;
  if jsonb_typeof(item->'metadata') is distinct from 'object' or octet_length((item->'metadata')::text)>12000 then raise exception 'library_import_provenance';end if;
  perform gina.import_int(item->'revision',1,100000);
  -- Changed question/teacher/source requires a new question revision. Old versions stay intact.
  select * into prior_q from gina.library_import_questions where package_id=prev.id and question_key=key;
  if found then
   select a.teacher into prior_teacher from gina.library_import_answers a where a.package_id=prev.id and a.question_key=key;
   select (select to_jsonb(s)-'package_id' from gina.library_import_sources s where s.package_id=prev.id and s.source_key=prior_q.source_key)
      is distinct from (select to_jsonb(s)-'package_id' from gina.library_import_sources s where s.package_id=pid and s.source_key=v_source_key) into source_changed;
   if prior_q.student is distinct from student or prior_teacher is distinct from teacher or prior_q.metadata is distinct from item->'metadata' or prior_q.source_key is distinct from v_source_key or source_changed then
    if (item->>'revision')::int<>prior_q.revision+1 then raise exception 'library_import_question_revision';end if;
   elsif (item->>'revision')::int<>prior_q.revision then raise exception 'library_import_question_revision';end if;
  elsif (item->>'revision')::int<>1 then raise exception 'library_import_question_revision';end if;
  pos:=pos+1;
  insert into gina.library_import_questions values(pid,key,(item->>'revision')::int,pos,v_source_key,student,item->'metadata');
  insert into gina.library_import_answers values(pid,key,teacher);
 end loop;
 -- No unused bytes/context can hide inside a nominal question bundle.
 if exists(select 1 from gina.library_import_sources s where s.package_id=pid and not exists(select 1 from gina.library_import_questions q where q.package_id=pid and q.source_key=s.source_key))
 or exists(select 1 from jsonb_array_elements(p_bundle->'assets') a where not exists(select 1 from jsonb_array_elements(p_bundle->'sources') s where s->>'asset_key'=a->>'key')) then raise exception 'library_import_unused_source';end if;
 result:=jsonb_build_object('id',pid,'content_hash',h,'status','draft','revision',rev,'created',true);
 insert into gina.library_import_requests values(p_request_id,actor,h,pid,result);
 insert into public.audit_log(actor_id,action,target_table,target_id,details)
 values(actor,'library_bundle.imported','gina.library_import_packages',pid::text,jsonb_build_object('package_key',pk,'revision',rev,'content_hash',h,'questions',pos,'sources',cardinality(source_ids)));
 return result;
end;$$;

create function public.admin_list_library_imports(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
 select p.id,p.package_key,p.revision,p.previous_id,p.content_hash,p.title,p.grade,p.subject,p.status,p.created_at,
 (select count(*) from gina.library_import_questions q where q.package_id=p.id) question_count,
 (select count(*) from gina.library_import_sources s where s.package_id=p.id) source_count
 from gina.library_import_packages p order by p.created_at desc,p.id limit p_limit)r);
end;$$;
create function public.admin_get_library_import(p_id uuid,p_include_answers boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p gina.library_import_packages;result jsonb;begin
 perform gina.assert_admin();
 if p_include_answers is null then raise exception 'invalid_input';end if;
 select * into p from gina.library_import_packages where id=p_id;
 if not found then raise exception 'library_import_not_found';end if;
 result:=jsonb_build_object('id',p.id,'package_key',p.package_key,'revision',p.revision,'content_hash',p.content_hash,'status',p.status,'title',p.title,'grade',p.grade,'subject',p.subject,
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('key',s.source_key,'title',s.title,'body',s.body,'alt',s.alt,'sha256',s.asset_hash,'width',a.width,'height',a.height,'minimum_reading_width',s.minimum_reading_width,'png_base64',replace(encode(a.png,'base64'),E'\n',''))
 ||case when p_include_answers then jsonb_build_object('provenance',s.provenance) else '{}'::jsonb end order by s.source_key),'[]') from gina.library_import_sources s left join gina.library_import_assets a on a.sha256=s.asset_hash where s.package_id=p.id),
 'questions',(select jsonb_agg(jsonb_build_object('key',q.question_key,'revision',q.revision,'position',q.position,'source_key',q.source_key,'student',q.student)
 ||case when p_include_answers then jsonb_build_object('teacher',a.teacher,'metadata',q.metadata) else '{}'::jsonb end order by q.position)
 from gina.library_import_questions q join gina.library_import_answers a using(package_id,question_key) where q.package_id=p.id));
 if p_include_answers then result:=result||jsonb_build_object('provenance',p.provenance);end if;
 return result;
end;$$;
revoke all on function gina.guard_library_import(),gina.import_keys(jsonb,text[]),gina.import_text(jsonb,int,int),gina.import_int(jsonb,int,int),gina.import_key(jsonb),gina.import_png(bytea) from public,anon,authenticated,service_role;
revoke all on function public.admin_import_library_bundle(uuid,jsonb),public.admin_list_library_imports(int),public.admin_get_library_import(uuid,boolean) from public,anon,service_role;
grant execute on function public.admin_import_library_bundle(uuid,jsonb),public.admin_list_library_imports(int),public.admin_get_library_import(uuid,boolean) to authenticated;
