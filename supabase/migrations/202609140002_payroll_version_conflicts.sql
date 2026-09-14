begin;
-- A version conflict is a user-actionable HTTP 409, not a transient SQL error.
-- PT409 prevents database/proxy retries of an intentional stale-version rejection.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.payroll_import_atomic(jsonb,text,text,uuid,text)'::regprocedure) into definition;
  if position('errcode=''40001''' in definition)=0 and position('errcode=''PT409''' in definition)=0 then
    raise exception 'Unexpected import function definition';
  end if;
  execute replace(definition,'errcode=''40001''','errcode=''PT409''');
end $$;
notify pgrst,'reload schema';
commit;
