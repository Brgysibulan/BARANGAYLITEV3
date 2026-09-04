/**
 * Purpose: regression coverage for delegated access and privacy-safe activity counters.
 * Depends on: mocked Supabase query/RPC clients; no live account or record is changed.
 * Debug: test names identify grant expiry, permission scope, and approved metric behavior.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../assets/js/core/auth.js';
import { createPermissions, permissionEnabled } from '../assets/js/data/permissions.js';
import { activityRange, createActivity } from '../assets/js/data/activity.js';

function queryResult(data, count = null) {
  const query = { data, count, steps: [] };
  for (const name of ['select', 'eq', 'gte', 'lte', 'lt', 'order', 'range', 'upsert', 'single', 'maybeSingle']) {
    query[name] = (...args) => { query.steps.push([name, ...args]); return query; };
  }
  query.then = (resolve, reject) => Promise.resolve({ data: query.data, error: null, count: query.count }).then(resolve, reject);
  return query;
}

test('delegated grant is effective only while enabled and unexpired', () => {
  assert.equal(permissionEnabled({ is_enabled: true, expires_at: '2099-01-01T00:00:00Z' }, Date.parse('2026-01-01')), true);
  assert.equal(permissionEnabled({ is_enabled: false, expires_at: '2099-01-01T00:00:00Z' }), false);
  assert.equal(permissionEnabled({ is_enabled: true, expires_at: '2020-01-01T00:00:00Z' }), false);
});

test('editor permission guard reads the exact user and module grant', async () => {
  const calls = [];
  const user = { id: '12345678-1234-4123-8123-123456789012' };
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const data = table === 'profiles' ? { user_id: user.id, role: 'editor', is_active: true } : { permission_key: 'covers', is_enabled: true, expires_at: '2099-01-01T00:00:00Z' };
      const query = queryResult(data); calls.push({ table, query }); return query;
    },
  };
  const staff = await createAuth(client).requirePermission('covers');
  assert.equal(staff.profile.role, 'editor');
  assert.deepEqual(calls[1].query.steps.filter(step => step[0] === 'eq'), [
    ['eq', 'target_user_id', user.id], ['eq', 'permission_key', 'covers'],
  ]);
});

test('System Admin saves one validated permission row with an explicit expiry', async () => {
  const calls = [];
  const result = { target_user_id: '12345678-1234-4123-8123-123456789012', permission_key: 'verification', is_enabled: true, expires_at: '2099-01-01T00:00:00.000Z' };
  const client = { from(table) { const query = queryResult(result); calls.push({ table, query }); return query; } };
  const auth = { requireStaff: async roles => { assert.deepEqual(roles, ['admin']); return { user: { id: '87654321-4321-4321-8321-210987654321' } }; } };
  await createPermissions(client, auth).save(result.target_user_id, 'verification', true, result.expires_at);
  const upsert = calls[0].query.steps.find(step => step[0] === 'upsert');
  assert.equal(upsert[1].permission_key, 'verification'); assert.equal(upsert[1].is_enabled, true);
  assert.equal(upsert[2].onConflict, 'target_user_id,permission_key');
});

test('activity periods use Manila calendar boundaries', () => {
  const now = new Date('2026-09-04T08:00:00Z');
  assert.equal(activityRange('daily', now).from, '2026-09-03T16:00:00.000Z');
  assert.equal(activityRange('monthly', now).from, '2026-08-31T16:00:00.000Z');
  assert.equal(activityRange('annual', now).from, '2025-12-31T16:00:00.000Z');
});

test('public analytics accepts only approved counters and stores no visitor payload', async () => {
  const calls = [];
  const activity = createActivity({ rpc: async (name, args) => { calls.push({ name, args }); return { data: true, error: null }; } }, { requireStaff: async () => {} });
  assert.equal(await activity.recordPublic('page.home'), true);
  assert.equal(await activity.recordPublic('page.secret'), false);
  assert.deepEqual(calls, [{ name: 'record_public_metric', args: { p_metric_key: 'page.home' } }]);
});
