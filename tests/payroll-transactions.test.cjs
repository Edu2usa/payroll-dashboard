const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
test('payroll versions are atomic, restorable, conflict checked and private', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create table employees(id uuid primary key default gen_random_uuid(),employee_id integer unique,last_name text,first_name text,middle_initial text,department integer,first_seen date,last_seen date,updated_at timestamp);
   create table payroll_periods(id uuid primary key default gen_random_uuid(),period_start date,period_end date,check_date date,run_date timestamp,total_persons integer,total_transactions integer,total_hours numeric,total_earnings numeric,total_withholdings numeric,total_deductions numeric,total_net_pay numeric,total_employer_liability numeric,total_tax_liability numeric,raw_text text,updated_at timestamp);
   create table payroll_entries(id uuid primary key default gen_random_uuid(),payroll_period_id uuid references payroll_periods(id),employee_id uuid references employees(id),department integer,regular_hours numeric,regular_earnings numeric,overtime_hours numeric,overtime_earnings numeric,double_time_hours numeric,double_time_earnings numeric,vacation_hours numeric,vacation_earnings numeric,total_hours numeric,total_earnings numeric,reimb_other_payments numeric,total_withholdings numeric,total_deductions numeric,net_pay numeric,created_at timestamp);
   grant all on employees,payroll_periods,payroll_entries to service_role;`)
    await db.exec(
      fs.readFileSync(
        path.join(
          __dirname,
          '../supabase/migrations/202609140001_payroll_versions.sql',
        ),
        'utf8',
      ),
    )
    await db.exec(
      fs.readFileSync(
        path.join(
          __dirname,
          '../supabase/migrations/202609140002_payroll_version_conflicts.sql',
        ),
        'utf8',
      ),
    )
    const payload = {
      // Synthetic payroll only. No production data is read by this test.
      period_start: '2026-08-29',
      period_end: '2026-09-11',
      check_date: '2026-09-16',
      run_date: '2026-09-14',
      raw_text: 'Synthetic test journal',
      totals: {
        total_persons: 1,
        total_transactions: 1,
        total_hours: 80,
        total_earnings: 1600,
        total_withholdings: 200,
        total_deductions: 100,
        total_net_pay: 1300,
        total_employer_liability: 0,
        total_tax_liability: 200,
      },
      employees: [
        {
          employee_id: 99,
          last_name: 'Test',
          first_name: 'Sample',
          department: 1,
          payroll_entry: {
            regular_hours: 80,
            regular_earnings: 1600,
            total_hours: 80,
            total_earnings: 1600,
            total_withholdings: 200,
            total_deductions: 100,
            net_pay: 1300,
          },
        },
      ],
    }
    const save = async (p, version) =>
      (
        await db.query('select payroll_import_atomic($1,$2,$3,$4) result', [
          p,
          'Test importer',
          'test.pdf',
          version,
        ])
      ).rows[0].result
    const initial = await save(payload, null)
    const before = (await db.query('select * from payroll_entries')).rows
    const bad = structuredClone(payload)
    bad.employees[0].payroll_entry.net_pay = 1290
    await assert.rejects(save(bad, initial.versionId), /do not reconcile/)
    assert.deepEqual(
      (await db.query('select * from payroll_entries')).rows,
      before,
    )
    assert.equal(
      (await db.query('select count(*) from payroll_import_versions')).rows[0]
        .count,
      1,
    )
    const replacement = await save(payload, initial.versionId)
    await assert.rejects(
      save(payload, initial.versionId),
      (error) => error.code === 'PT409',
    )
    const restore = (
      await db.query('select payroll_restore_version($1,$2,$3) result', [
        initial.versionId,
        replacement.versionId,
        'Test restorer',
      ])
    ).rows[0].result
    assert.equal(restore.payrollPeriodId, initial.payrollPeriodId)
    assert.equal(
      (await db.query('select count(*) from payroll_import_versions')).rows[0]
        .count,
      3,
    )
    const old = structuredClone(payload)
    old.period_start = '2026-08-01'
    old.period_end = '2026-08-14'
    old.check_date = '2026-08-19'
    old.employees[0].last_name = 'Earlier'
    old.employees[0].department = 2
    await save(old, null)
    const employee = (
      await db.query(
        'select last_name,department,first_seen::text,last_seen::text from employees',
      )
    ).rows[0]
    assert.deepEqual(employee, {
      last_name: 'Test',
      department: 1,
      first_seen: '2026-08-01',
      last_seen: '2026-09-11',
    })
    await db.exec('set role anon')
    await assert.rejects(
      db.query('select * from payroll_import_versions'),
      /permission denied/,
    )
    await assert.rejects(save(payload, restore.versionId), /permission denied/)
  } finally {
    await db.close()
  }
})
