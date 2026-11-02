-- Run inside a transaction with employee-access-hardening.sql, then ROLLBACK.
do $$
declare employee uuid; org uuid; manager uuid; expense uuid:=gen_random_uuid(); n integer;
begin
 select id,organization_id into employee,org from public.profiles where not coalesce(is_admin,false) and not coalesce(is_super_admin,false) and organization_id is not null limit 1;
 select id into manager from public.profiles where organization_id=org and (is_admin or is_super_admin) limit 1;
 if employee is null or manager is null then raise exception 'Test requires an employee and manager in the same organization'; end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 set local role authenticated;
 insert into public.expenses(id,organization_id,user_id,date,category,amount,description,status) values(expense,org,employee,current_date,'other',1,'TEST transaction annulée','pending');
 begin
   update public.expenses set status='approved' where id=expense;
   raise exception 'Employee approval unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 insert into public.leave_requests(id,organization_id,user_id,start_date,end_date,reason,status) values(8900101001001777,org,employee,current_date+1,current_date+1,'TEST transaction annulée','pending');
 update public.leave_requests set status='approved' where id=8900101001001777;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Employee leave approval unexpectedly allowed'; end if;
 begin
   insert into public.intervention_assignments(intervention_id,user_id) values(8900101001001777,employee);
   raise exception 'Employee assignment unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 select count(*) into n from public.leave_requests where user_id<>employee;
 if n<>0 then raise exception 'Other employees leave data visible'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',manager::text,true);
 set local role authenticated;
 select count(*) into n from public.leave_requests where id=8900101001001777;
 if n<>1 then raise exception 'Manager cannot read employee request'; end if;
 update public.leave_requests set reason='TEST manager update' where id=8900101001001777;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Manager cannot update employee request'; end if;
 reset role;
end $$;
