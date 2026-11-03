-- Restrictive policies supplement existing tenant policies (AND, never OR).
create policy assignment_manager_write on public.intervention_assignments as restrictive for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
create policy assignment_manager_insert on public.intervention_assignments as restrictive for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
-- DELETE must also exclude self-assigned employees.
create policy assignment_manager_delete on public.intervention_assignments as restrictive for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
create policy leave_personal_read on public.leave_requests as restrictive for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
create policy leave_personal_insert on public.leave_requests as restrictive for insert to authenticated
with check ((user_id=auth.uid() and status='pending' and rejection_reason is null) or exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
create policy leave_manager_update on public.leave_requests as restrictive for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
create policy leave_manager_delete on public.leave_requests as restrictive for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
create policy intervention_manager_insert on public.interventions as restrictive for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
create policy intervention_assigned_update on public.interventions as restrictive for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)) or exists(select 1 from public.intervention_assignments a where a.intervention_id=interventions.id and a.user_id=auth.uid()))
with check (organization_id=(select p.organization_id from public.profiles p where p.id=auth.uid()));

create function public.guard_employee_expense() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)) then return new; end if;
  if new.user_id is distinct from auth.uid() or new.organization_id is distinct from (select p.organization_id from public.profiles p where p.id=auth.uid()) then raise exception 'Compte ou entité non autorisé' using errcode='42501'; end if;
  if tg_op='INSERT' then
    if new.status<>'pending' or coalesce(new.is_paid,false) or new.reviewed_by is not null or new.reviewed_at is not null or new.paid_by is not null or new.paid_date is not null or nullif(new.admin_comment,'') is not null then raise exception 'Validation réservée au responsable' using errcode='42501'; end if;
  else
    if old.status<>'pending' or coalesce(old.is_paid,false) or
       (to_jsonb(new)-array['date','category','amount','description','receipts','receipts_count','updated_at']) is distinct from
       (to_jsonb(old)-array['date','category','amount','description','receipts','receipts_count','updated_at']) then
      raise exception 'Seules les dépenses en attente peuvent être modifiées sans changer leur validation' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_employee_expense() from public,anon,authenticated;
create trigger a_guard_employee_expense before insert or update on public.expenses for each row execute function public.guard_employee_expense();
create policy expense_pending_delete on public.expenses as restrictive for delete to authenticated
using ((user_id=auth.uid() and status='pending' and not coalesce(is_paid,false)) or exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.is_super_admin)));
revoke truncate,trigger,references on public.intervention_assignments,public.interventions,public.expenses,public.leave_requests from authenticated,anon;
