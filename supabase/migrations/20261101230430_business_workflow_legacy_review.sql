alter table public.business_workflow_events add column legacy_origin_digest text;

-- Computed inventory only: opening the queue does not enrol or modify sources.
create view srp_private.workflow_legacy_sources with (security_invoker=true) as
 select i.organization_id,'intervention'::text as source_type,i.id::text as source_key,
 coalesce(i.client,'Intervention') as title,i.date as source_date,i.updated_at as last_activity_at,
 case i.status when 'En cours' then 'in_progress' when 'Planifiée' then 'planned' else 'todo' end as status,
 md5(jsonb_build_object('status',i.status,'date',i.date,'time',i.time,'dates',i.scheduled_dates,'updated_at',i.updated_at)::text) as legacy_revision
 from public.interventions i
 where not coalesce(i.is_archived,false) and i.status not in ('Terminée','Annulée')
 and i.date <= (now() at time zone 'Europe/Paris')::date-7
 and not exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(i.scheduled_dates)='array' then i.scheduled_dates else '[]'::jsonb end) d where d.value ~ '^\d{4}-\d{2}-\d{2}$' and d.value > (now() at time zone 'Europe/Paris')::date::text)
 union all
 select c.organization_id,'chantier'::text,c.id::text,c.name,coalesce(c.start_date,c.end_date,(c.updated_at at time zone 'Europe/Paris')::date),c.updated_at,
 case c.status when 'en_cours' then 'in_progress' else 'planned' end,
 md5(jsonb_build_object('status',c.status,'start',c.start_date,'end',c.end_date,'updated_at',c.updated_at)::text)
 from public.chantiers c where c.status not in ('clos','receptionne')
 and coalesce(c.start_date,c.end_date,(c.updated_at at time zone 'Europe/Paris')::date) <= (now() at time zone 'Europe/Paris')::date-7;
revoke all on srp_private.workflow_legacy_sources from public,anon,authenticated;
grant select on srp_private.workflow_legacy_sources to authenticated;

create function public.business_workflow_legacy(p_page integer default 0,p_type text default '') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_org uuid; v_result jsonb;
begin
 select p.organization_id into v_org from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin);
 if v_org is null then raise exception 'Administrateur de votre entité requis' using errcode='42501'; end if;
 if p_page is null or p_page not between 0 and 10000 or p_type is null or p_type not in ('','intervention','chantier') then raise exception 'Filtre invalide'; end if;
 with pending as (
 select s.* from srp_private.workflow_legacy_sources s where s.organization_id=v_org and (p_type='' or s.source_type=p_type)
 and not exists(select 1 from public.business_workflow_items i join public.business_workflow_events e on e.item_id=i.id
 where i.organization_id=v_org and i.source_type=s.source_type and i.source_key=s.source_key and i.owner_id is null and e.request_id is not null and e.actor_id is not null)
 ), page_rows as (
 select jsonb_build_object('id','legacy:'||source_type||':'||source_key,'source_type',source_type,'source_key',source_key,'title',title,'source_date',source_date,'last_activity_at',last_activity_at,
 'status',status,'legacy',true,'legacy_revision',legacy_revision,'revision',null,'reason','','due_at',(source_date::timestamp at time zone 'Europe/Paris')+interval '7 days') as item
 from pending order by source_date,source_type,source_key limit 25 offset p_page*25
 ) select jsonb_build_object('count',(select count(*) from pending),'items',coalesce((select jsonb_agg(item) from page_rows),'[]'::jsonb)) into v_result;
 return v_result;
end $$;
revoke all on function public.business_workflow_legacy(integer,text) from public,anon;
grant execute on function public.business_workflow_legacy(integer,text) to authenticated;

-- Enrol one source only when its manager applies an explicit decision.
-- This does not activate the global reminder setting or batch-enrol sources.
create function srp_private.workflow_review_legacy(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_user uuid:=auth.uid(); v_type text; v_key text; v_request uuid; v_source record;
 v_item public.business_workflow_items%rowtype; v_event public.business_workflow_events%rowtype; v_result jsonb;
begin
 select p.organization_id into v_org from public.profiles p where p.id=v_user and (p.is_admin or p.is_super_admin);
 if v_org is null then raise exception 'Administrateur de votre entité requis' using errcode='42501'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Demande invalide'; end if;
 v_type:=p_payload->>'sourceType';v_key:=p_payload->>'sourceKey';v_request:=(p_payload->>'requestId')::uuid;
 if v_type is null or v_type not in ('intervention','chantier') or v_key is null or v_request is null then raise exception 'Source ou identifiant de demande invalide'; end if;
 if v_type='intervention' then
   perform 1 from public.interventions where organization_id=v_org and id::text=v_key for update;
 else perform 1 from public.chantiers where organization_id=v_org and id::text=v_key for update; end if;
 if not found then raise exception 'Dossier absent ou non autorisé' using errcode='42501'; end if;
 select * into v_item from public.business_workflow_items where organization_id=v_org and source_type=v_type and source_key=v_key and owner_id is null for update;
 if found then
   select * into v_event from public.business_workflow_events where item_id=v_item.id and request_id=v_request;
   if found then
     if v_event.actor_id is distinct from v_user or v_event.legacy_origin_digest is distinct from md5(p_payload::text) then raise exception 'Cette demande a déjà été utilisée'; end if;
     return to_jsonb(v_item);
   end if;
 end if;
 select * into v_source from srp_private.workflow_legacy_sources where organization_id=v_org and source_type=v_type and source_key=v_key;
 if not found then raise exception 'Ce dossier ne figure plus dans les anciens dossiers à qualifier. Actualisez.' using errcode='40001'; end if;
 if v_source.legacy_revision is distinct from p_payload->>'legacyRevision' then raise exception 'Le dossier a changé. Actualisez avant de le qualifier.' using errcode='40001'; end if;
 if v_item.id is not null and exists(select 1 from public.business_workflow_events where item_id=v_item.id and request_id is not null and actor_id is not null) then
   raise exception 'Ce dossier a déjà reçu une décision. Actualisez.' using errcode='40001';
 end if;
 insert into public.business_workflow_items(organization_id,source_type,source_key,manager_id,title,status,last_activity_at,due_at)
 values(v_org,v_type,v_key,v_user,left(v_source.title,200),v_source.status,coalesce(v_source.last_activity_at,now()),now()) on conflict do nothing;
 select * into v_item from public.business_workflow_items where organization_id=v_org and source_type=v_type and source_key=v_key and owner_id is null for update;
 v_result:=srp_private.workflow_command('reply',p_payload||jsonb_build_object('itemId',v_item.id,'revision',v_item.revision));
 update public.business_workflow_events set legacy_origin_digest=md5(p_payload::text) where item_id=v_item.id and request_id=v_request and actor_id=v_user and legacy_origin_digest is null;
 return v_result;
end $$;
revoke all on function srp_private.workflow_review_legacy(jsonb) from public,anon,authenticated;
grant execute on function srp_private.workflow_review_legacy(jsonb) to authenticated;
create function public.business_workflow_review_legacy(p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select srp_private.workflow_review_legacy(p_payload) $$;
revoke all on function public.business_workflow_review_legacy(jsonb) from public,anon;
grant execute on function public.business_workflow_review_legacy(jsonb) to authenticated;

