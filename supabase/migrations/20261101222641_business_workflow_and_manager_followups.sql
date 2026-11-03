create schema if not exists srp_private;
revoke all on schema srp_private from public, anon, authenticated;
grant usage on schema srp_private to authenticated;

create table public.business_workflow_settings (
 organization_id uuid primary key references public.organizations(id),
 manager_id uuid not null references public.profiles(id),
 enabled boolean not null default true,
 activated_at timestamptz not null default now()
);
create table public.business_workflow_items (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 source_type text not null check(source_type in ('intervention','chantier','odoo_quote')),
 source_key text not null check(length(source_key) between 1 and 100),
 owner_id uuid references public.profiles(id),
 manager_id uuid not null references public.profiles(id),
 title text not null,
 status text not null default 'todo' check(status in ('todo','planned','in_progress','waiting','procedure','cancelled','completed')),
 reason text not null default '',
 last_activity_at timestamptz not null default now(),
 due_at timestamptz,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 check ((source_type='odoo_quote' and owner_id is not null and manager_id=owner_id) or (source_type<>'odoo_quote' and owner_id is null))
);
create unique index business_workflow_source on public.business_workflow_items(organization_id,source_type,source_key) where owner_id is null;
create unique index business_workflow_quote_source on public.business_workflow_items(organization_id,source_type,source_key,owner_id) where owner_id is not null;
create index business_workflow_due on public.business_workflow_items(organization_id,due_at) where status not in ('completed','cancelled');
create index business_workflow_manager on public.business_workflow_items(manager_id);
create index business_workflow_owner on public.business_workflow_items(owner_id) where owner_id is not null;
create index business_workflow_settings_manager on public.business_workflow_settings(manager_id);
create table public.business_workflow_events (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.business_workflow_items(id),
 organization_id uuid not null references public.organizations(id),
 actor_id uuid references public.profiles(id),
 actor_name text not null,
 from_status text,
 to_status text not null,
 reason text not null,
 next_review_at timestamptz,
 request_id uuid,
 payload_digest text,
 created_at timestamptz not null default now(),
 unique(item_id,request_id)
);
create index business_workflow_history on public.business_workflow_events(item_id,created_at desc);
create index business_workflow_events_org on public.business_workflow_events(organization_id);
create index business_workflow_events_actor on public.business_workflow_events(actor_id);
create table public.business_workflow_reminders (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.business_workflow_items(id),
 organization_id uuid not null references public.organizations(id),
 manager_id uuid not null references public.profiles(id),
 revision integer not null,
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 unique(item_id,revision)
);
create index business_workflow_reminders_manager on public.business_workflow_reminders(manager_id,created_at desc) where resolved_at is null;
create index business_workflow_reminders_org on public.business_workflow_reminders(organization_id);

-- State mutations go through the atomic command protocol; history is append-only.
alter table public.business_workflow_settings enable row level security;
alter table public.business_workflow_items enable row level security;
alter table public.business_workflow_events enable row level security;
alter table public.business_workflow_reminders enable row level security;
revoke all on public.business_workflow_settings,public.business_workflow_items,public.business_workflow_events,public.business_workflow_reminders from anon,authenticated;
grant select on public.business_workflow_settings,public.business_workflow_items,public.business_workflow_events,public.business_workflow_reminders to authenticated;
create policy own_admin on public.business_workflow_settings for select to authenticated using(organization_id=(select p.organization_id from public.profiles p where p.id=(select auth.uid()) and (p.is_admin or p.is_super_admin)));
create policy own_admin on public.business_workflow_items for select to authenticated using(organization_id=(select p.organization_id from public.profiles p where p.id=(select auth.uid()) and (p.is_admin or p.is_super_admin)) and (owner_id is null or owner_id=(select auth.uid())));
create policy own_admin on public.business_workflow_events for select to authenticated using(exists(select 1 from public.business_workflow_items i where i.id=item_id and i.organization_id=business_workflow_events.organization_id));
create policy own_admin on public.business_workflow_reminders for select to authenticated using(manager_id=(select auth.uid()) and exists(select 1 from public.business_workflow_items i where i.id=item_id and i.organization_id=business_workflow_reminders.organization_id));

-- Private definer is intentional: clients cannot mutate state/history directly.
-- Every command derives its tenant/admin identity from the verified Auth subject.
create function srp_private.workflow_command(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
     insert into public.business_workflow_items(organization_id,source_type,source_key,owner_id,manager_id,title,status,due_at)
     values(v_org,'odoo_quote',v_key,v_user,v_user,left(coalesce(v_quote->>'title','Devis Odoo'),200),'todo',now()+interval '7 days') on conflict do nothing;
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
 if length(v_reason) not between 3 and 2000 then raise exception 'Un motif de 3 à 2000 caractères est requis'; end if;
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
revoke all on function srp_private.workflow_command(text,jsonb) from public,anon,authenticated;
grant execute on function srp_private.workflow_command(text,jsonb) to authenticated;
create function public.business_workflow_command(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select srp_private.workflow_command(p_action,p_payload) $$;
revoke all on function public.business_workflow_command(text,jsonb) from public,anon;
grant execute on function public.business_workflow_command(text,jsonb) to authenticated;

create function srp_private.workflow_source_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare v_type text; v_key text; v_org uuid; v_title text; v_status text; v_anchor timestamptz; v_item public.business_workflow_items%rowtype; v_manager uuid;
begin
 if TG_TABLE_NAME='interventions' then
   v_type:='intervention'; v_key:=new.id::text; v_org:=new.organization_id; v_title:=coalesce(new.client,'Intervention');
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
   if v_type='chantier' or not coalesce(new.is_archived,false) then v_status:=v_item.status; end if;
 end if;
 update public.business_workflow_items set status=v_status,last_activity_at=now(),due_at=case when v_status in ('completed','cancelled') then null else v_anchor+interval '7 days' end,revision=revision+1 where id=v_item.id;
 update public.business_workflow_reminders set resolved_at=now() where item_id=v_item.id and resolved_at is null;
 insert into public.business_workflow_events(item_id,organization_id,actor_id,actor_name,from_status,to_status,reason,next_review_at)
 values(v_item.id,v_org,auth.uid(),coalesce((select full_name from public.profiles where id=auth.uid()),'Système'),v_item.status,v_status,'Évolution du dossier source',case when v_status in ('completed','cancelled') then null else v_anchor+interval '7 days' end);
 return new;
end $$;
revoke all on function srp_private.workflow_source_changed() from public,anon,authenticated;
create trigger business_workflow_activity after insert or update on public.interventions for each row execute function srp_private.workflow_source_changed();
create trigger business_workflow_activity after insert or update on public.chantiers for each row execute function srp_private.workflow_source_changed();

create function srp_private.workflow_chantier_progress() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.event_type not in ('lot_statut','lot_avancement','tache_faite','tache_validee','tache_statut','photo_ajoutee','document_ajoute','document_modifie') then return new; end if;
 if not exists(select 1 from public.business_workflow_settings where organization_id=new.organization_id and enabled) then return new; end if;
 update public.business_workflow_items set last_activity_at=now(),due_at=now()+interval '7 days',revision=revision+1 where organization_id=new.organization_id and source_type='chantier' and source_key=new.chantier_id::text and status not in ('completed','cancelled');
 update public.business_workflow_reminders r set resolved_at=now() from public.business_workflow_items i where r.item_id=i.id and i.organization_id=new.organization_id and i.source_type='chantier' and i.source_key=new.chantier_id::text and r.resolved_at is null;
 return new;
end $$;
revoke all on function srp_private.workflow_chantier_progress() from public,anon,authenticated;
create trigger business_workflow_progress after insert on public.chantier_events for each row execute function srp_private.workflow_chantier_progress();

create function srp_private.workflow_source_deleted() returns trigger language plpgsql security definer set search_path='' as $$
declare v_type text:=case TG_TABLE_NAME when 'interventions' then 'intervention' else 'chantier' end; v_item public.business_workflow_items%rowtype;
begin
 update public.business_workflow_items set status='cancelled',reason='Dossier source supprimé',due_at=null,last_activity_at=now(),revision=revision+1
 where organization_id=old.organization_id and source_type=v_type and source_key=old.id::text and owner_id is null returning * into v_item;
 if found then
   update public.business_workflow_reminders set resolved_at=now() where item_id=v_item.id and resolved_at is null;
   insert into public.business_workflow_events(item_id,organization_id,actor_id,actor_name,to_status,reason)
   values(v_item.id,old.organization_id,auth.uid(),'Système','cancelled','Dossier source supprimé');
 end if;
 return old;
end $$;
revoke all on function srp_private.workflow_source_deleted() from public,anon,authenticated;
create trigger business_workflow_deleted after delete on public.interventions for each row execute function srp_private.workflow_source_deleted();
create trigger business_workflow_deleted after delete on public.chantiers for each row execute function srp_private.workflow_source_deleted();

create function srp_private.workflow_tick() returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('srp-business-workflow-tick',0)) then return 0; end if;
 insert into public.business_workflow_reminders(item_id,organization_id,manager_id,revision)
 select i.id,i.organization_id,i.manager_id,i.revision from public.business_workflow_items i join public.business_workflow_settings s on s.organization_id=i.organization_id and s.enabled
 join public.profiles p on p.id=i.manager_id and p.organization_id=i.organization_id and (p.is_admin or p.is_super_admin)
 where i.status not in ('completed','cancelled') and i.due_at<=now()
 and (i.source_type<>'intervention' or exists(select 1 from public.interventions x where x.id::text=i.source_key and x.organization_id=i.organization_id and not coalesce(x.is_archived,false) and x.status not in ('Annulée','Terminée')))
 and (i.source_type<>'chantier' or exists(select 1 from public.chantiers x where x.id::text=i.source_key and x.organization_id=i.organization_id and x.status not in ('clos','receptionne')))
 on conflict(item_id,revision) do nothing;
 get diagnostics v_count=row_count; return v_count;
end $$;
revoke all on function srp_private.workflow_tick() from public,anon,authenticated;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('srp-business-followups','17 * * * *','select srp_private.workflow_tick();');
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   alter publication supabase_realtime add table public.business_workflow_items,public.business_workflow_reminders;
 end if;
end $$;

