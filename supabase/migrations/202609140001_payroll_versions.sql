begin;
-- Only the existing server-side service role may use the new payroll storage.
create table if not exists public.payroll_import_versions (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id),
  created_at timestamptz not null default now(), actor text not null,
  source_name text not null, reason text not null default 'import',
  payload jsonb not null
);
alter table public.payroll_import_versions enable row level security;
revoke all on public.payroll_import_versions from public, anon, authenticated;
grant select, insert on public.payroll_import_versions to service_role;
alter table public.payroll_periods add column if not exists active_version_id uuid references public.payroll_import_versions(id);
create index if not exists payroll_versions_period_idx on public.payroll_import_versions(payroll_period_id, created_at desc);

create table if not exists public.payroll_review_events (
  id uuid primary key default gen_random_uuid(), alert_id uuid not null,
  payroll_period_id uuid not null references public.payroll_periods(id),
  created_at timestamptz not null default now(), actor text not null,
  is_reviewed boolean not null, note text not null default '', alert jsonb not null
);
alter table public.payroll_review_events enable row level security;
revoke all on public.payroll_review_events from public, anon, authenticated;
grant select, insert on public.payroll_review_events to service_role;
create index if not exists payroll_reviews_alert_idx on public.payroll_review_events(alert_id, created_at desc);

-- Preserve the currently reconciled data before enabling replacement imports.
insert into public.payroll_import_versions(payroll_period_id, actor, source_name, reason, payload)
select p.id, 'Historical import — uploader not recorded', 'Retained Paychex journal', 'baseline',
  jsonb_build_object('period_start',p.period_start,'period_end',p.period_end,'check_date',p.check_date,
    'run_date',p.run_date,'raw_text',p.raw_text,'totals',to_jsonb(p),
    'employees',coalesce((select jsonb_agg((to_jsonb(e)-'id') || jsonb_build_object('department', pe.department, 'payroll_entry', to_jsonb(pe)-'id'-'employee_id'-'payroll_period_id'-'created_at'))
      from public.payroll_entries pe join public.employees e on e.id=pe.employee_id where pe.payroll_period_id=p.id),'[]'::jsonb))
from public.payroll_periods p where p.active_version_id is null
  and not exists(select 1 from public.payroll_import_versions v where v.payroll_period_id=p.id);
update public.payroll_periods p set active_version_id=v.id
from public.payroll_import_versions v where v.payroll_period_id=p.id and p.active_version_id is null;

create or replace function public.payroll_import_atomic(p_payload jsonb, p_actor text, p_source text, p_expected_version uuid, p_reason text default 'import')
returns jsonb language plpgsql set search_path=public, pg_temp as $$
declare
  period_id uuid; version_id uuid; current_version uuid; employee_uuid uuid; item jsonb; totals jsonb;
  imported_count integer; entry_row public.payroll_entries; first_date date; last_date date;
begin
  -- Serialize imports across periods because employee metadata spans all periods.
  perform pg_advisory_xact_lock(90420914);
  if length(trim(p_actor)) not between 1 and 120 then raise exception 'Importer name is required'; end if;
  if coalesce(jsonb_array_length(p_payload->'employees'),0)=0 then raise exception 'No employee entries'; end if;
  if (p_payload->>'period_start')::date > (p_payload->>'period_end')::date then raise exception 'Invalid payroll dates'; end if;
  if p_payload->>'check_date' is null then raise exception 'Check date is required'; end if;
  if (select count(*)<>count(distinct value->>'employee_id') from jsonb_array_elements(p_payload->'employees')) then raise exception 'Duplicate employee numbers'; end if;
  totals:=p_payload->'totals';
  select id,active_version_id into period_id,current_version from payroll_periods
    where period_start=(p_payload->>'period_start')::date and period_end=(p_payload->>'period_end')::date for update;
  if current_version is distinct from p_expected_version then raise exception 'Payroll changed. Refresh and preview again.' using errcode='40001'; end if;
  if period_id is null then
    insert into payroll_periods(period_start,period_end,check_date) values((p_payload->>'period_start')::date,(p_payload->>'period_end')::date,(p_payload->>'check_date')::date) returning id into period_id;
  end if;
  -- Snapshot is immutable. An exception anywhere rolls back all writes below.
  insert into payroll_import_versions(payroll_period_id,actor,source_name,reason,payload)
    values(period_id,trim(p_actor),left(p_source,255),p_reason,p_payload) returning id into version_id;
  delete from payroll_entries where payroll_period_id=period_id;
  for item in select value from jsonb_array_elements(p_payload->'employees') loop
    insert into employees(employee_id,last_name,first_name,middle_initial,department,first_seen,last_seen)
    values((item->>'employee_id')::integer,item->>'last_name',item->>'first_name',item->>'middle_initial',(item->>'department')::integer,(p_payload->>'period_start')::date,(p_payload->>'period_end')::date)
    on conflict(employee_id) do nothing;
    select id into strict employee_uuid from employees where employee_id=(item->>'employee_id')::integer;
    entry_row:=jsonb_populate_record(null::payroll_entries, (item->'payroll_entry') || jsonb_build_object('id',gen_random_uuid(),'employee_id',employee_uuid,'payroll_period_id',period_id,'department',item->'department','created_at',now()));
    if entry_row.total_earnings is null or entry_row.total_hours is null or entry_row.net_pay is null then raise exception 'Incomplete employee totals'; end if;
    if abs(coalesce(entry_row.regular_hours,0)+coalesce(entry_row.overtime_hours,0)+coalesce(entry_row.double_time_hours,0)+coalesce(entry_row.vacation_hours,0)-entry_row.total_hours)>.0001
      or abs(coalesce(entry_row.regular_earnings,0)+coalesce(entry_row.overtime_earnings,0)+coalesce(entry_row.double_time_earnings,0)+coalesce(entry_row.vacation_earnings,0)-entry_row.total_earnings)>.011
      or abs(entry_row.total_earnings+coalesce(entry_row.reimb_other_payments,0)-entry_row.total_withholdings-entry_row.total_deductions-entry_row.net_pay)>.011
    then raise exception 'Employee totals do not reconcile'; end if;
    insert into payroll_entries select (entry_row).*;
    -- Names come from the latest observed payroll; backdated imports cannot replace them.
    if not exists(select 1 from payroll_entries pe join payroll_periods pp on pp.id=pe.payroll_period_id where pe.employee_id=employee_uuid and pp.period_end>(p_payload->>'period_end')::date) then
      update employees set last_name=item->>'last_name',first_name=item->>'first_name',middle_initial=item->>'middle_initial',department=(item->>'department')::integer where id=employee_uuid;
    end if;
  end loop;
  select count(*) into imported_count from payroll_entries where payroll_period_id=period_id;
  if imported_count<>(totals->>'total_persons')::integer then raise exception 'Employee count does not reconcile'; end if;
  if exists(select 1 from (select sum(total_hours) h,sum(total_earnings) g,sum(net_pay) n,sum(total_withholdings) w,sum(total_deductions) d from payroll_entries where payroll_period_id=period_id) t
    where abs(t.h-(totals->>'total_hours')::numeric)>.0001 or abs(t.g-(totals->>'total_earnings')::numeric)>.011 or abs(t.n-(totals->>'total_net_pay')::numeric)>.011
      or abs(t.w-(totals->>'total_withholdings')::numeric)>.011 or abs(t.d-(totals->>'total_deductions')::numeric)>.011) then raise exception 'Company totals do not reconcile'; end if;
  update payroll_periods set check_date=(p_payload->>'check_date')::date,run_date=(p_payload->>'run_date')::timestamp,
    total_persons=(totals->>'total_persons')::integer,total_transactions=(totals->>'total_transactions')::integer,
    total_hours=(totals->>'total_hours')::numeric,total_earnings=(totals->>'total_earnings')::numeric,total_net_pay=(totals->>'total_net_pay')::numeric,
    total_withholdings=(totals->>'total_withholdings')::numeric,total_deductions=(totals->>'total_deductions')::numeric,
    total_employer_liability=(totals->>'total_employer_liability')::numeric,total_tax_liability=(totals->>'total_tax_liability')::numeric,
    raw_text=p_payload->>'raw_text',updated_at=now(),active_version_id=version_id where id=period_id;
  update employees e set first_seen=x.first_date,last_seen=x.last_date,updated_at=now()
    from (select pe.employee_id,min(p.period_start) first_date,max(p.period_end) last_date from payroll_entries pe join payroll_periods p on p.id=pe.payroll_period_id group by pe.employee_id) x where e.id=x.employee_id;
  return jsonb_build_object('payrollPeriodId',period_id,'versionId',version_id,'employeeCount',imported_count);
end $$;
revoke all on function public.payroll_import_atomic(jsonb,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.payroll_import_atomic(jsonb,text,text,uuid,text) to service_role;

create or replace function public.payroll_restore_version(p_version_id uuid,p_expected_version uuid,p_actor text)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare v public.payroll_import_versions;
begin
  select * into strict v from payroll_import_versions where id=p_version_id;
  return payroll_import_atomic(v.payload,p_actor,v.source_name,p_expected_version,'restore of '||v.id::text);
end $$;
revoke all on function public.payroll_restore_version(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.payroll_restore_version(uuid,uuid,text) to service_role;

-- Repair observed payroll dates without claiming an employment start/end date.
update public.employees e set first_seen=x.first_date,last_seen=x.last_date
from (select pe.employee_id,min(p.period_start) first_date,max(p.period_end) last_date from public.payroll_entries pe join public.payroll_periods p on p.id=pe.payroll_period_id group by pe.employee_id) x where e.id=x.employee_id;
notify pgrst,'reload schema';
commit;
