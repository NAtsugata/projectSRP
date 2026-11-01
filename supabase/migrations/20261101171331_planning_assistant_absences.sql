create or replace function public.create_planning_batch(p_request_id uuid, p_events jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_org uuid; v_event jsonb; v_staff uuid[]; v_member uuid;
  v_client public.clients%rowtype; v_day date; v_time time; v_duration integer;
  v_start integer; v_end integer; v_id bigint; v_result jsonb := '[]'::jsonb;
  v_previous public.planning_assistant_requests%rowtype; v_service text;
begin
  select p.organization_id into v_org from public.profiles p where p.id=v_user and (p.is_admin or p.is_super_admin);
  if v_user is null or v_org is null then raise exception 'Administrateur de l''entit� requis' using errcode='42501'; end if;
  if p_request_id is null or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 14 then
    raise exception 'Lot de rendez-vous invalide';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_org::text||':'||p_request_id::text,0));
  select * into v_previous from public.planning_assistant_requests r where r.organization_id=v_org and r.requester_id=v_user and r.request_id=p_request_id;
  if found then
    if v_previous.payload_digest <> md5(p_events::text) then raise exception 'Cette demande a d�j� �t� utilis�e pour un autre lot'; end if;
    return v_previous.result;
  end if;
  -- The lock order is stable across concurrent assistant requests.
  for v_member in select distinct x.value::uuid from jsonb_array_elements(p_events) e cross join lateral jsonb_array_elements_text(e->'staffIds') x order by 1 loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_org::text||':'||v_member::text,1));
  end loop;
  for v_event in select value from jsonb_array_elements(p_events) loop
    select array_agg(distinct x.value::uuid) into v_staff from jsonb_array_elements_text(v_event->'staffIds') x;
    if coalesce(cardinality(v_staff),0) not between 1 and 20 or
      (select count(*) from public.profiles p where p.id=any(v_staff) and p.organization_id=v_org) <> cardinality(v_staff) then
      raise exception 'Les intervenants doivent appartenir � votre entit�' using errcode='42501';
    end if;
    select * into v_client from public.clients c where c.id=(v_event->>'clientId')::uuid and c.organization_id=v_org and c.is_active;
    if not found then raise exception 'Client absent ou non autoris�' using errcode='42501'; end if;
    v_day := (v_event->>'date')::date;
    v_time := (v_event->>'time')::time;
    v_duration := (v_event->>'duration')::integer;
    v_service := left(trim(coalesce(v_event->>'service','Rendez-vous')),200);
    if v_day is null or v_day < (now() at time zone 'Europe/Paris')::date or v_day > (now() at time zone 'Europe/Paris')::date + 366 or
       v_time is null or v_duration is null or v_duration not between 15 and 480 or v_duration % 15 <> 0 then
      raise exception 'Date, heure ou dur�e invalide';
    end if;
    v_start := (extract(epoch from v_time)/60)::integer; v_end := v_start + v_duration;
    if v_start < 480 or v_end > 1080 or (v_start < 780 and v_end > 720) then raise exception 'Choisir un cr�neau entre 08h-12h ou 13h-18h'; end if;
    if exists (select 1 from public.employee_absences a where a.organization_id=v_org and a.employee_id=any(v_staff)
      and a.start_date <= v_day and a.end_date >= v_day) then
      raise exception 'Un intervenant est absent � cette date';
    end if;
    if exists (select 1 from public.leave_requests l where l.organization_id=v_org and l.user_id=any(v_staff)
      and l.start_date <= v_day and l.end_date >= v_day and lower(l.status) in ('approved','approuv�','approuv�e','valid�','valid�e')) then
      raise exception 'Un intervenant est en cong� � cette date';
    end if;
    if exists (select 1 from public.interventions i join public.intervention_assignments a on a.intervention_id=i.id
      where i.organization_id=v_org and a.user_id=any(v_staff) and not coalesce(i.is_archived,false) and i.status not in ('Annul�e','Termin�e')
      and (i.date=v_day or i.scheduled_dates @> jsonb_build_array(v_day::text))
      and (i.time is null or i.duration_minutes is null or
        ((extract(epoch from i.time)/60)::integer < v_end and (extract(epoch from i.time)/60)::integer + i.duration_minutes > v_start))) then
      raise exception 'Cr�neau devenu indisponible ; actualisez les propositions';
    end if;
    insert into public.interventions(organization_id,client_id,client,address,client_phone,client_email,service,date,time,duration_minutes,status,is_archived,scheduled_dates)
      values(v_org,v_client.id,v_client.name,concat_ws(', ',nullif(v_client.address,''),nullif(concat_ws(' ',v_client.postal_code,v_client.city),'')),v_client.phone,v_client.email,
        coalesce(nullif(v_service,''),'Rendez-vous'),v_day,v_time,v_duration,'Planifi�e',false,jsonb_build_array(v_day::text)) returning id into v_id;
    insert into public.intervention_assignments(organization_id,intervention_id,user_id) select v_org,v_id,unnest(v_staff);
    v_result := v_result || jsonb_build_array(jsonb_build_object('id',v_id,'date',v_day,'time',v_time,'client',v_client.name));
  end loop;
  v_result := jsonb_build_object('events',v_result);
  insert into public.planning_assistant_requests(organization_id,requester_id,request_id,payload_digest,result)
    values(v_org,v_user,p_request_id,md5(p_events::text),v_result);
  return v_result;
end $$;
revoke all on function public.create_planning_batch(uuid,jsonb) from public, anon;
grant execute on function public.create_planning_batch(uuid,jsonb) to authenticated;


