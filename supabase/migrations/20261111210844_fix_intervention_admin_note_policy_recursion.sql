-- The organization-scoped UPDATE policy already covers the same rows.
-- Removing the redundant policy breaks the interventions/assignments RLS cycle.
drop policy if exists intervention_assigned_update on public.interventions;

create or replace function srp_private.guard_intervention_admin_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if current_user not in ('authenticated', 'anon') then
        return new;
    end if;

    if tg_op = 'UPDATE' then
        if new.admin_note is not distinct from old.admin_note then
            return new;
        end if;
    elsif nullif(btrim(new.admin_note), '') is null then
        return new;
    end if;

    if not exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.organization_id = new.organization_id
          and (p.is_admin or p.is_super_admin)
    ) then
        raise exception 'Modification de la note réservée à un administrateur de l’organisation.'
            using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists guard_intervention_admin_note on public.interventions;
create trigger guard_intervention_admin_note
before insert or update of admin_note on public.interventions
for each row execute function srp_private.guard_intervention_admin_note();
