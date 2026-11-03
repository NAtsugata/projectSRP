create or replace function srp_private.workflow_command(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_org uuid; v_name text; v_setting public.business_workflow_settings%rowtype;
 v_item public.business_workflow_items%rowtype; v_previous public.business_workflow_events%rowtype;
 v_type text; v_key text; v_status text; v_reason text; v_next timestamptz; v_native text; v_day date;
 v_request uuid; v_digest text; v_quote jsonb; v_count integer:=0;
begin
 select p.organization_id,p.full_name into v_org,v_name from public.profiles p where p.id=v_user and (p.is_admin or p.is_super_admin);
 if v_user is null or v_org is null then raise exception 'Administrateur de votre entité requis' using errcode='42501'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Commande invalide'; end if;
 if p_action='enable' then
   insert into public.business_workflow_settings(organization_id,manager_id) values(v_org,v_user) on conflict(organization_id) do update set enabled=true;
   select * into v_setting from public.business_workflow_settings where organization_id=v_org;
   insert into public.business_workflow_items(organization_id,source_type,source_key,manager_id,title,status,due_at)
   select v_org,'intervention',i.id::text,v_setting.manager_id,left(coalesce(i.client,'Intervention'),200),case i.status when 'En cours' then 'in_progress' when 'Planifiée' then 'planned' else 'todo' end,
     greatest(now(),coalesce((i.date+coalesce(i.time,time '08:00')) at time zone 'Europe/Paris',now()))+interval '7 days'
   from public.interventions i where i.organization_id=v_org and not coalesce(i.is_archived,false) and i.status not in ('Terminée','Annulée') on conflict do nothing;
   insert into public.business_workflow_items(organization_id,source_type,source_key,manager_id,title,status,due_at)
   select v_org,'chantier',c.id::text,v_setting.manager_id,c.name,case c.status when 'en_cours' then 'in_progress' else 'planned' end,
     greatest(now(),coalesce(c.start_date::timestamp at time zone 'Europe/Paris',now()))+interval '7 days'
   from public.chantiers c where c.organization_id=v_org and c.status not in ('receptionne','clos') on conflict do nothing;
   return to_jsonb(v_setting);
 elsif p_action='pause' then
   update public.business_workflow_settings set enabled=false where organization_id=v_org returning * into v_setting;
   return to_jsonb(v_setting);
 elsif p_action='register_quotes' then
   if jsonb_typeof(p_payload->'quotes') is distinct from 'array' or jsonb_array_length(p_payload->'quotes')>25 then raise exception 'Lot de devis invalide'; end if;
   if not exists(select 1 from public.business_workflow_settings where organization_id=v_org and enabled) then return jsonb_build_object('registered',0); end if;
   for v_quote in select value from jsonb_array_elements(p_payload->'quotes') loop
     v_key:=v_quote->>'id';
     if v_key is null or v_key !~ '^[1-9][0-9]{0,15}$' then raise exception 'Identifiant de devis invalide'; end if;
     if coalesce((v_quote->>'invoiced')::boolean,false) then continue; end if;
     select work_status into v_native from public.odoo_quote_tracking where organization_id=v_org and owner_id=v_user and odoo_order_id=v_key::bigint;
     insert into public.business_workflow_items(organization_id,source_type,source_key,owner_id,manager_id,title,status,due_at)
     values(v_org,'odoo_quote',v_key,v_user,v_user,left(coalesce(v_quote->>'title','Devis Odoo'),200),case v_native when 'in_progress' then 'in_progress' else 'todo' end,now()+interval '7 days') on conflict do nothing;
     get diagnostics v_count=row_count;
   end loop;
   return jsonb_build_object('registered',v_count);
 elsif p_action<>'reply' then raise exception 'Commande inconnue'; end if;
 select * into v_item from public.business_workflow_items where id=(p_payload->>'itemId')::uuid and organization_id=v_org and (owner_id is null or owner_id=v_user);
 if not found then raise exception 'Dossier absent ou non autorisé' using errcode='42501'; end if;
 -- Lock source before workflow state to avoid lock inversion with source triggers.
 if v_item.source_type='intervention' then
   perform 1 from public.interventions where id=v_item.source_key::bigint and organization_id=v_org for update;
   if not found then raise exception 'Intervention absente'; end if;
 elsif v_item.source_type='chantier' then
   perform 1 from public.chantiers where id=v_item.source_key::uuid and organization_id=v_org for update;
   if not found then raise exception 'Chantier absent'; end if;
 end if;
 select * into v_item from public.business_workflow_items where id=v_item.id for update;
 v_request:=(p_payload->>'requestId')::uuid; v_digest:=md5(p_payload::text);
 if v_request is null then raise exception 'Identifiant de demande requis'; end if;
 select * into v_previous from public.business_workflow_events where item_id=v_item.id and request_id=v_request;
 if found then
   if v_previous.payload_digest<>v_digest then raise exception 'Cette demande a déjà été utilisée'; end if;
   return to_jsonb(v_item);
 end if;
 if (p_payload->>'revision')::integer is distinct from v_item.revision then raise exception 'Le dossier a changé. Actualisez avant de répondre.' using errcode='40001'; end if;
 v_status:=p_payload->>'status'; v_reason:=trim(coalesce(p_payload->>'reason',''));
 if v_status is null or v_status not in ('todo','planned','in_progress','waiting','procedure','cancelled','completed') then raise exception 'Statut invalide'; end if;
 if (v_status <> 'completed' and length(v_reason) < 3) or length(v_reason) > 2000 then raise exception 'Un motif de 3 à 2000 caractères est requis'; end if;
 if v_status in ('cancelled','completed') and coalesce((p_payload->>'confirmed')::boolean,false) is not true then raise exception 'Confirmation explicite requise'; end if;
 if v_status in ('waiting','procedure') and coalesce(p_payload->>'nextReview','')='' then raise exception 'Date du prochain contrôle requise'; end if;
 if nullif(p_payload->>'nextReview','') is not null then
   v_day:=(p_payload->>'nextReview')::date;
   if v_day <= (now() at time zone 'Europe/Paris')::date or v_day > (now() at time zone 'Europe/Paris')::date+366 then raise exception 'Choisissez une date entre demain et les 366 prochains jours'; end if;
   v_next:=(v_day+time '09:00') at time zone 'Europe/Paris';
 else v_next:=now()+interval '7 days'; end if;
 if v_status in ('cancelled','completed') then v_next:=null; end if;
 insert into public.business_workflow_events(item_id,organization_id,actor_id,actor_name,from_status,to_status,reason,next_review_at,request_id,payload_digest)
 values(v_item.id,v_org,v_user,coalesce(v_name,'Administrateur'),v_item.status,v_status,v_reason,v_next,v_request,v_digest);
 update public.business_workflow_items set status=v_status,reason=v_reason,last_activity_at=now(),due_at=v_next,revision=revision+1 where id=v_item.id returning * into v_item;
 update public.business_workflow_reminders set resolved_at=now() where item_id=v_item.id and resolved_at is null;
 perform set_config('srp.workflow_reply',v_item.source_type||':'||v_item.source_key,true);
 if v_item.source_type='intervention' then
   v_native:=case v_status when 'todo' then 'À venir' when 'planned' then 'Planifiée' when 'in_progress' then 'En cours' when 'completed' then 'Terminée' when 'cancelled' then 'Annulée' else null end;
   if v_native is not null then update public.interventions set status=v_native where id=v_item.source_key::bigint and organization_id=v_org and status is distinct from v_native; end if;
 elsif v_item.source_type='chantier' and v_status in ('planned','in_progress') then
   update public.chantiers set status=case v_status when 'planned' then 'preparation' else 'en_cours' end where id=v_item.source_key::uuid and organization_id=v_org and status is distinct from case v_status when 'planned' then 'preparation' else 'en_cours' end;
 end if;
 perform set_config('srp.workflow_reply','',true);
 return to_jsonb(v_item);
end $$;

