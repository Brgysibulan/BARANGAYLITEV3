/**
 * Purpose: regression tests for account reuse, permissions, field safety, and file retention.
 * Depends on: Node's test runner and mocked Supabase methods; no production calls.
 * Debug: test titles describe the broken contract; inspect the mock call log for payloads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../assets/js/core/auth.js';
import { createContent } from '../assets/js/data/content.js';
import { createSettings } from '../assets/js/data/settings.js';
import { createVerification, extractQrToken } from '../assets/js/data/verification.js';
import { createStorage, ownedObjectPath } from '../assets/js/data/storage.js';
import { createEditors } from '../assets/js/data/editors.js';
import { createApplications } from '../assets/js/data/applications.js';
import { SUPABASE_URL, AUTH_STORAGE_KEY } from '../assets/js/core/config.js';

/** A thenable query builder records requests without touching the live database. */
function mockClient({ result = { data: [], error: null, count: 0 }, user = { id: 'existing-user' }, profile = { role: 'admin', is_active: true } } = {}) {
  const log = [];
  const client = {
    log,
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      signInWithPassword: async values => { log.push({ signIn: values }); return { data: { user }, error: null }; },
      signOut: async options => { log.push({ signOut: options }); return { error: null }; },
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from(table) {
      const call = { table, steps: [] };
      log.push(call);
      const chain = {};
      for (const name of ['select', 'eq', 'in', 'order', 'range', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete']) {
        chain[name] = (...args) => { call.steps.push([name, ...args]); return chain; };
      }
      chain.then = (resolve, reject) => Promise.resolve(table === 'profiles' ? { data: profile, error: null } : typeof result === 'function' ? result(call) : result).then(resolve, reject);
      return chain;
    },
    rpc: async (name, args) => { log.push({ rpc: name, args }); return result; },
    functions: { invoke: async (name, options) => { log.push({ fn: name, ...options }); return result; } },
    storage: {
      from: bucket => ({
        upload: async (path, file, options) => { log.push({ upload: { bucket, path, options } }); return { data: { path }, error: null }; },
        getPublicUrl: path => ({ data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` } }),
        remove: async paths => { log.push({ remove: { bucket, paths } }); return { data: [], error: null }; },
      }),
    },
  };
  return client;
}
const allowed = { requireStaff: async () => ({ profile: { role: 'admin' } }) };
const denied = { requireStaff: async () => { throw new Error('denied'); } };

test('same Supabase project, but V3 never overwrites the legacy session key', () => {
  assert.equal(SUPABASE_URL, 'https://pkvorwvkqjnbgktkgjhr.supabase.co');
  assert.notEqual(AUTH_STORAGE_KEY, 'sb-pkvorwvkqjnbgktkgjhr-auth-token');
});
test('login reuses an existing account and preserves password bytes', async () => {
  const client = mockClient();
  await createAuth(client).signIn(' user@example.com ', ' pass word ');
  assert.deepEqual(client.log[0], { signIn: { email: 'user@example.com', password: ' pass word ' } });
  assert.equal(client.log.filter(call => call.table === 'profiles').length, 1);
});
test('user_metadata cannot turn an editor into an admin', async () => {
  const client = mockClient({ user: { id: 'existing-user', user_metadata: { role: 'admin' } }, profile: { role: 'editor', is_active: true } });
  await assert.rejects(createAuth(client).requireStaff(['admin']), /access/);
});
test('inactive and missing profiles fail closed', async () => {
  for (const profile of [null, { role: 'admin', is_active: false }, { role: 'admin', is_active: 'true' }]) {
    assert.equal(await createAuth(mockClient({ profile })).currentStaff(), null);
  }
});
test('anonymous callers do not query profile rows', async () => {
  const client = mockClient({ user: null });
  assert.equal(await createAuth(client).currentStaff(), null);
  assert.equal(client.log.length, 0);
});
test('disabled login signs out only its own session', async () => {
  const client = mockClient({ profile: { role: 'admin', is_active: false } });
  await assert.rejects(createAuth(client).signIn('user@example.com', 'password'), /staff access/);
  assert.deepEqual(client.log.at(-1), { signOut: { scope: 'local' } });
});
test('network errors are not mistaken for signed-out state', async () => {
  const client = mockClient();
  client.auth.getUser = async () => ({ error: new Error('network') });
  await assert.rejects(createAuth(client).currentStaff(), /network/);
});
test('public queries always apply the publish flag and pagination', async () => {
  const client = mockClient();
  await createContent(client, denied).list('announcements', { publicOnly: true, page: 1, pageSize: 25 });
  assert.ok(client.log[0].steps.some(step => JSON.stringify(step) === JSON.stringify(['eq', 'is_published', true])));
  assert.ok(client.log[0].steps.some(step => JSON.stringify(step) === JSON.stringify(['range', 25, 49])));
});
test('public callers cannot enumerate profiles, verification records, or settings through generic content', async () => {
  for (const table of ['profiles', 'verification_records', 'site_settings', '__proto__']) {
    await assert.rejects(createContent(mockClient(), allowed).list(table, { publicOnly: true }), /Unsupported/);
  }
});
test('content writes verify staff access before touching data', async () => {
  const client = mockClient();
  await assert.rejects(createContent(client, denied).save('services', { name: 'Test' }), /denied/);
  assert.equal(client.log.length, 0);
});
test('content updates whitelist fields and preserve existing IDs', async () => {
  const client = mockClient({ result: { data: { id: 42, name: 'Service' }, error: null } });
  await createContent(client, allowed).save('services', { id: 100, role: 'admin', name: 'Service' }, 42);
  assert.deepEqual(client.log[0].steps.find(step => step[0] === 'update'), ['update', { name: 'Service' }]);
  assert.ok(client.log[0].steps.some(step => step[0] === 'eq' && step[2] === 42));
});
test('zero-row/denied write errors are surfaced', async () => {
  const client = mockClient({ result: { data: null, error: new Error('No matching row') } });
  await assert.rejects(createContent(client, allowed).save('services', { name: 'Service' }, 42), /No matching row/);
});
test('invalid pagination and unsafe URLs are rejected', async () => {
  const content = createContent(mockClient(), allowed);
  await assert.rejects(content.list('services', { pageSize: 1001 }), /pagination/);
  await assert.rejects(content.list('services', { page: -1 }), /pagination/);
  await assert.rejects(content.save('officials', { full_name: 'Name', photo_url: 'javascript:alert(1)' }), /HTTPS/);
});
test('site settings cannot overwrite old design or colors', async () => {
  const client = mockClient();
  await createSettings(client, allowed).update({ barangay_name: 'Barangay', design_theme: {}, primary_color: '#000' });
  assert.deepEqual(client.log[0].steps.find(step => step[0] === 'update'), ['update', { barangay_name: 'Barangay' }]);
  assert.ok(!client.log[0].steps.find(step => step[0] === 'select')[1].includes('design_theme'));
});
test('settings and verification restrict roles to System Admin', async () => {
  const roles = [];
  const auth = { requireStaff: async values => { roles.push(values); } };
  await createSettings(mockClient(), auth).update({ barangay_name: 'Barangay' });
  await createVerification(mockClient(), auth).list();
  assert.deepEqual(roles, [['admin'], ['admin']]);
});
test('saving profile sections preserves existing summary and uses existing slug conflict key', async () => {
  const client = mockClient();
  await createSettings(client, allowed).saveProfile([{ slug: 'barangay-history', content: 'History', is_published: true }]);
  const step = client.log[0].steps.find(item => item[0] === 'upsert');
  assert.deepEqual(step[2], { onConflict: 'slug' });
  assert.equal(Object.hasOwn(step[1][0], 'summary'), false);
});
test('public verification uses RPC with unchanged arguments, never a table dump', async () => {
  const client = mockClient();
  await createVerification(client, denied).verifyManual(' 123 ', ' Last ');
  assert.deepEqual(client.log, [{ rpc: 'verify_barangay_record', args: { p_control_number: '123', p_last_name: 'Last' } }]);
});
test('updating verification never replaces qr_token or record id', async () => {
  const client = mockClient();
  await createVerification(client, allowed).save({ control_number: '123', id: 5, qr_token: 'replace-me' }, 1);
  assert.deepEqual(client.log[0].steps.find(step => step[0] === 'update'), ['update', { control_number: '123' }]);
});
test('printed legacy QR URLs still yield the existing token', () => {
  const token = '12345678-1234-4123-8123-123456789012';
  assert.equal(extractQrToken(`https://example.test/BRGYWEB-LITE/verify.html?qr=${token}`), token);
  assert.equal(extractQrToken('not-a-qr'), '');
});
test('file deletion refuses foreign hosts, wrong buckets, and traversal', () => {
  assert.equal(ownedObjectPath('forms', `${SUPABASE_URL}/storage/v1/object/public/forms/2026/test.pdf?x=1`), '2026/test.pdf');
  assert.equal(ownedObjectPath('forms', 'https://other.example/storage/v1/object/public/forms/test.pdf'), null);
  assert.equal(ownedObjectPath('forms', `${SUPABASE_URL}/storage/v1/object/public/gallery-media/test.pdf`), null);
  assert.equal(ownedObjectPath('forms', `${SUPABASE_URL}/storage/v1/object/public/forms/%2e%2e%2fsecret`), null);
});
test('uploads use non-overwriting paths and keep old linked files', async () => {
  const client = mockClient();
  const content = { save: async (_table, values) => values };
  const file = { name: 'doc.pdf', type: 'application/pdf', size: 42 };
  const result = await createStorage(client, allowed, content).saveWithUpload('forms', { name: 'Form' }, 1, file);
  assert.equal(client.log[0].upload.options.upsert, false);
  assert.equal(client.log.some(call => call.remove), false);
  assert.equal(result.file_name, 'doc.pdf');
});
test('uncertain record save never deletes an upload that may already be referenced', async () => {
  const client = mockClient();
  const content = { save: async () => { throw new Error('save failed'); } };
  const file = { name: 'doc.pdf', type: 'application/pdf', size: 42 };
  await assert.rejects(createStorage(client, allowed, content).saveWithUpload('forms', { name: 'Form', file_url: 'https://example.test/old.pdf' }, 1, file), /save failed/);
  assert.equal(client.log.some(call => call.remove), false);
});
test('protected editor management stays in the existing Edge Function', async () => {
  const client = mockClient({ result: { data: { editors: [] }, error: null } });
  await createEditors(client, allowed).list();
  assert.deepEqual(client.log, [{ fn: 'manage-editors', body: { action: 'list' } }]);
});
test('editor deletion requires matching email and admin authorization', async () => {
  const client = mockClient();
  const editors = createEditors(client, denied);
  assert.throws(() => editors.remove('id', 'one@example.com', 'wrong@example.com'), /confirmation/);
  await assert.rejects(editors.remove('id', 'one@example.com', 'one@example.com'), /denied/);
  assert.equal(client.log.length, 0);
});
test('applications never create an account when name validation fails', async () => {
  const client = mockClient({ result: { data: false, error: null } });
  await assert.rejects(createApplications(client, allowed).apply({ displayName: 'Test Name', email: 'test@example.com', password: 'validpassword', confirmation: 'validpassword' }), /not found/);
  assert.deepEqual(client.log, [{ rpc: 'can_apply_content_admin', args: { candidate_name: 'Test Name' } }]);
});
