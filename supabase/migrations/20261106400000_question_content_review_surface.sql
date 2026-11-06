-- D10: D9/B6 kişi adı uyarısı (`question_bank.provenance.content_review`) veliye görünür olur.
-- `complete_prova_generation_v2` dönüşündeki her `questions[]` öğesine, uyarı varsa yalnız özet eklenir:
--   content_review: { status: "needs_review", flags: [{ code, names, fields, suggestion }] }
-- Provenance'ın başka hiçbir alanı (istem, model, taslak kimliği…) dönüşe girmez; `detector` da girmez.
-- Uyarısız soru öğesi alan alan eskisiyle aynıdır (anahtar yazılmaz). Eski alanlar korunur; sonuç işe yazılır,
-- bu yüzden kayıp yanıtın tekrarı (status='done') aynı sonucu döner. Taslak/kütüphane ekranları soruyu zaten
-- aile RLS'iyle `question_bank`tan (provenance dahil) okur; çocuk cihazı soru satırı okuyamaz (değişmedi).
-- C07 rol kontrollü admin RPC'lerine dokunulmaz. Yeni yardımcılar hiçbir role açık değildir.

create function gina.question_content_review_summary(p_provenance jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when s.flags is not null and jsonb_array_length(s.flags)>0
  then jsonb_build_object('status','needs_review','flags',s.flags) end
 from (select (
  select jsonb_agg(jsonb_build_object(
    'code','person_name',
    'names',(select coalesce(jsonb_agg(n order by o),'[]'::jsonb) from jsonb_array_elements(f->'names') with ordinality y(n,o)
             where jsonb_typeof(n)='string' and length(btrim(n#>>'{}'))>0),
    'fields',(select coalesce(jsonb_agg(n order by o),'[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(f->'fields')='array' then f->'fields' else '[]'::jsonb end) with ordinality y(n,o)
             where jsonb_typeof(n)='string'),
    'suggestion',left(coalesce(case when jsonb_typeof(f->'suggestion')='string' then f->>'suggestion' end,''),500)) order by x.o)
  from jsonb_array_elements(p_provenance#>'{content_review,flags}') with ordinality x(f,o)
  where jsonb_typeof(f)='object' and f->>'code'='person_name' and jsonb_typeof(f->'names')='array'
   and exists(select 1 from jsonb_array_elements(f->'names') n where jsonb_typeof(n)='string' and length(btrim(n#>>'{}'))>0)
 ) flags
 where jsonb_typeof(p_provenance->'content_review')='object'
  and p_provenance#>>'{content_review,status}'='needs_review'
  and jsonb_typeof(p_provenance#>'{content_review,flags}')='array') s
$$;
revoke all on function gina.question_content_review_summary(jsonb) from public,anon,authenticated,service_role;

create function gina.attach_question_content_review(p_family uuid,p_result jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare qs jsonb:=p_result->'questions'; v_out jsonb;
begin
 if jsonb_typeof(qs) is distinct from 'array' or jsonb_array_length(qs)=0 then return p_result; end if;
 select jsonb_agg(case when r.summary is null then x.v else x.v||jsonb_build_object('content_review',r.summary) end order by x.ord)
 into v_out
 from jsonb_array_elements(qs) with ordinality x(v,ord)
 left join public.question_bank q on q.family_id=p_family
  and q.id=case when x.v->>'id' ~ '^[0-9a-fA-F-]{36}$' then (x.v->>'id')::uuid end
 left join lateral (select gina.question_content_review_summary(q.provenance) summary) r on true;
 return jsonb_set(p_result,'{questions}',v_out);
end; $$;
revoke all on function gina.attach_question_content_review(uuid,jsonb) from public,anon,authenticated,service_role;

-- Gövde 20261106350000 ile aynı; tek ek satır: içerik uyarısı özeti sonuca (ve işe) yazılır.
create or replace function public.complete_prova_generation_v2(p_id uuid,p_lease uuid,p_rows jsonb,p_model text,p_prompt_version text,p_input int,p_output int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.prova_generation_jobs; a record; remaining int; take int; v_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 select family_id into j.family_id from public.prova_generation_jobs where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended(j.family_id::text,13));
 select * into j from public.prova_generation_jobs where id=p_id for update;
 if j.lease is distinct from p_lease or p_lease is null then raise exception 'lease_lost'; end if;
 if j.status='done' then return j.result; end if;
 if j.status<>'working' or j.provider_result is null or coalesce(jsonb_typeof(p_rows),'null')<>'array' or jsonb_array_length(p_rows)<>j.items then raise exception 'invalid_generation'; end if;
 remaining:=jsonb_array_length(p_rows);
 for a in select * from public.generation_credit_allocations where job_id=p_id order by grant_id nulls first loop
 take:=least(remaining,a.units); update public.generation_credit_allocations set consumed=take where id=a.id; remaining:=remaining-take; end loop;
 if remaining<>0 then raise exception 'credit_allocation_failed'; end if;
 v_result:=public.complete_prova_generation(p_id,p_rows,p_model,p_prompt_version,p_input,p_output);
 -- D1: bağlı sorular tek ortak kaynak grubu olur (aynı işlem; yarım grup kalmaz).
 v_result:=gina.link_ai_shared_sources(j.family_id,v_result);
 perform gina.tag_ai_generation_periods(j.family_id,v_result);
 -- D10: kişi adı uyarısı özeti (yalnız status + flags) veli yanıtına.
 v_result:=gina.attach_question_content_review(j.family_id,v_result);
 v_result:=jsonb_set(v_result,'{remaining}',to_jsonb((public.get_prova_entitlement(j.family_id)->>'ai_generate_remaining')::int));
 update public.prova_generation_jobs set result=v_result where id=p_id;
 perform gina.ai_provider_outcome(j.provider, true, null, false);
 return v_result;
end; $$;
