create or replace function srp_private.workflow_source_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare v_type text; v_key text; v_org uuid; v_title text; v_status text; v_anchor timestamptz; v_item public.business_workflow_items%rowtype; v_manager uuid; v_archived boolean:=false;
begin
 if TG_TABLE_NAME='interventions' then
   v_type:='intervention'; v_key:=new.id::text; v_org:=new.organization_id; v_title:=coalesce(new.client,'Intervention'); v_archived:=coalesce(new.is_archived,false);
   v_status:=case when new.is_archived then 'completed' when new.status='Terminée' then 'completed' when new.status='Annulée' then 'cancelled' when new.status='En cours' then 'in_progress' when new.status='Planifiée' then 'planned' else 'todo' end;
   v_anchor:=greatest(now(),coalesce((new.date+coalesce(new.time,time '08:00')) at time zone 'Europe/Paris',now()));
   if TG_OP='UPDATE' and (new.status,new.date,new.time,new.duration_minutes,new.report,new.is_archived) is not distinct from (old.status,old.date,old.time,old.duration_minutes,old.report,old.is_archived) then return new; end if;
 else
   v_type:='chantier'; v_key:=new.id::text; v_org:=new.organization_id; v_title:=new.name;
   v_status:=case when new.status in ('clos','receptionne') then 'completed' when new.status='en_cours' then 'in_progress' else 'planned' end;
   v_anchor:=greatest(now(),coalesce(new.start_date::timestamp at time zone 'Europe/Paris',now()));
   if TG_OP='UPDATE' and (new.status,new.start_date,new.end_date,new.description) is not distinct from (old.status,old.start_date,old.end_date,old.description) then return new; end if;
 end if;
 if current_setting('srp.workflow_reply',true)=v_type||':'||v_key then return new; end if;
 select manager_id into v_manager from public.business_workflow_settings where organization_id=v_org and enabled;
 if v_manager is null then return new; end if;
 insert into public.business_workflow_items(organization_id,source_type,source_key,manager_id,title,status,due_at)
 values(v_org,v_type,v_key,v_manager,left(v_title,200),v_status,case when v_status in ('completed','cancelled') then null else v_anchor+interval '7 days' end) on conflict do nothing;
 select * into v_item from public.business_workflow_items where organization_id=v_org and source_type=v_type and source_key=v_key and owner_id is null for update;
 if TG_OP='UPDATE' and new.status is not distinct from old.status then
   if v_item.status in ('completed','cancelled') then return new; end if;
   if not v_archived then v_status:=v_item.status; end if;
 end if;
 update public.business_workflow_items set status=v_status,last_activity_at=now(),due_at=case when v_status in ('completed','cancelled') then null else v_anchor+interval '7 days' end,revision=revision+1 where id=v_item.id;
 update public.business_workflow_reminders set resolved_at=now() where item_id=v_item.id and resolved_at is null;
 insert into public.business_workflow_events(item_id,organization_id,actor_id,actor_name,from_status,to_status,reason,next_review_at)
 values(v_item.id,v_org,auth.uid(),coalesce((select full_name from public.profiles where id=auth.uid()),'Système'),v_item.status,v_status,'Évolution du dossier source',case when v_status in ('completed','cancelled') then null else v_anchor+interval '7 days' end);
 return new;
end $$;

