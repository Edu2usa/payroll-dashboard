require('./load-ts.cjs')
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  Module = require('node:module')
const original = Module._load
let session = true,
  events = [],
  workspace = {
    alerts: [
      { id: 'alert', current_period_id: 'period', notes: 'Review hours' },
    ],
    periods: [
      {
        id: 'period',
        review_id: 'period-review',
        open_alerts: 1,
        reconciliation: { matches: true },
        active_version_id: 'version',
      },
    ],
  }
Module._load = function (name, ...args) {
  if (name === 'next/headers')
    return {
      cookies: () => ({
        get: () => (session ? { value: 'valid-test-session' } : undefined),
      }),
    }
  if (name === '@/lib/workspace-data')
    return { getWorkspace: async () => workspace }
  if (name === '@/lib/supabase')
    return {
      supabaseServer: {
        from: () => ({
          insert: async (event) => {
            events.push(event)
            return { error: null }
          },
        }),
      },
    }
  return original.call(this, name, ...args)
}
const { POST } = require('../app/api/reviews/route.ts')
Module._load = original
const request = (body) =>
  new Request('http://localhost/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
test('review validation rejects anonymous, stale and incomplete period reviews', async () => {
  session = false
  assert.equal((await POST(request({}))).status, 401)
  session = true
  assert.equal(
    (
      await POST(
        request({ id: 'alert', actor: '', note: '', is_reviewed: true }),
      )
    ).status,
    400,
  )
  assert.equal(
    (
      await POST(
        request({
          id: 'old-alert',
          actor: 'Tester',
          note: '',
          is_reviewed: true,
        }),
      )
    ).status,
    409,
  )
  assert.equal(
    (
      await POST(
        request({
          id: 'period-review',
          actor: 'Tester',
          note: '',
          is_reviewed: true,
        }),
      )
    ).status,
    409,
  )
  assert.equal(events.length, 0)
})
test('reviews and reopen actions append attributed history', async () => {
  for (const is_reviewed of [true, false])
    assert.equal(
      (
        await POST(
          request({
            id: 'alert',
            actor: ' Tester ',
            note: 'Checked source',
            is_reviewed,
          }),
        )
      ).status,
      200,
    )
  assert.equal(events.length, 2)
  assert.equal(events[0].actor, 'Tester')
  assert.equal(events[0].is_reviewed, true)
  assert.equal(events[1].is_reviewed, false)
  assert.equal(events[0].payroll_period_id, 'period')
})
