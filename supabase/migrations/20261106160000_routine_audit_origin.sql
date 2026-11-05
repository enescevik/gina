-- Gece birleşimi düzeltmesi: 20261106090000 (L04) gina.task_routine_audit()'i yeniden tanımlarken
-- 20261106030000 (L02) ile eklenen origin sütununu yazmayı düşürmüştü; iki davranış birleştirildi.
create or replace function gina.task_routine_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare today date;eff date;act text;
begin
 if TG_OP='UPDATE' and new.revision=old.revision then return new;end if;
 select gina.local_day(timezone,now()) into today from public.families where id=new.family_id;
 act:=case when TG_OP='INSERT' then 'create' when old.archived_at is null and new.archived_at is not null then 'archive' when old.archived_at is not null and new.archived_at is null then 'restore' when old.active is distinct from new.active then case when new.active then 'resume' else 'pause' end else 'save' end;
 eff:=case when TG_OP='INSERT' then coalesce(gina.requested_effective_from(),new.effective_from,new.starts_on)
  when act='save' then coalesce(gina.requested_effective_from(),today) else today end;
 update gina.task_routine_changes set superseded_by=new.revision where template_id=new.id and superseded_by is null and effective_from is not null and effective_from>eff;
 insert into gina.task_routine_changes(template_id,family_id,revision,action,before_value,after_value,actor,effective_from,known_since,origin)
 values(new.id,new.family_id,new.revision,act,case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new),auth.uid(),eff,today,gina.change_origin());
 insert into public.task_routine_sync(child_id,family_id) values(new.child_id,new.family_id) on conflict(child_id) do update set revision=public.task_routine_sync.revision+1;
 return new;
end $$;

-- Q03 hijyeni (20261106150000) yazıldığında henüz birleşmemiş paketlerin (S02, L04) gina.* tabloları:
-- RLS'i tablo adından bağımsız olarak kapat/aç — gina.* tablolarına istemci rolleri doğrudan erişmez (grant yok),
-- bu yüzden davranış değişmez; savunma katmanı tamamlanır.
do $$
declare r record;
begin
 for r in select c.oid::regclass as rel from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='gina' and c.relkind in ('r','p') and not c.relrowsecurity loop
  execute format('alter table %s enable row level security', r.rel);
 end loop;
end $$;

-- Q03 "şablon sapması": NULL ACL taşıyan (varsayılan PUBLIC EXECUTE) yönetici fonksiyonları. Yetki kontrolü
-- fonksiyon içinde olsa da anon/PUBLIC çağrısını açıkça kapat; authenticated (yönetici paneli) korunur.
revoke execute on function public.admin_save_contribution_reward(uuid,text,integer,text,integer,plan_code,integer,boolean) from public, anon;
revoke execute on function public.admin_set_ai_operation_policy(text,plan_code,boolean,integer,integer,integer) from public, anon;
revoke execute on function public.admin_set_library_quota(plan_code,integer) from public, anon;
grant execute on function public.admin_save_contribution_reward(uuid,text,integer,text,integer,plan_code,integer,boolean) to authenticated, service_role;
grant execute on function public.admin_set_ai_operation_policy(text,plan_code,boolean,integer,integer,integer) to authenticated, service_role;
grant execute on function public.admin_set_library_quota(plan_code,integer) to authenticated, service_role;
