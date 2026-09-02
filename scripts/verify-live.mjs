/**
 * Purpose: verify existing table/column connectivity and anonymous-access restrictions.
 * Depends on: the public Supabase configuration, current network access, and pinned SDK URL.
 * Debug: each PASS/error names the exact contract or protected table being checked.
 * Safety: reads only; no login mutation, record write, file mutation, or private-data logging.
 */
import assert from 'node:assert/strict';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SDK_VERSION } from '../assets/js/core/config.js';
import { CONTENT, SETTINGS_SELECT } from '../assets/js/data/contracts.js';

const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
/** Use the public key only; never add admin credentials to make a failed check pass. */
async function get(route) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${route}`, { headers, signal: AbortSignal.timeout(20000) });
  return { ok: response.ok, status: response.status, data: await response.json() };
}
const settings = await get(`site_settings?select=${SETTINGS_SELECT}&id=eq.1`);
assert.equal(settings.ok, true, `site_settings HTTP ${settings.status}`);
assert.equal(settings.data.length, 1, 'Expected existing singleton settings row');
console.log('PASS: existing site_settings singleton readable; no theme fields requested.');
for (const [table, def] of Object.entries(CONTENT)) {
  const result = await get(`${table}?select=id,${def.fields.join(',')}&${def.flag}=eq.true&limit=1`);
  assert.equal(result.ok, true, `${table} HTTP ${result.status}`);
  assert.ok(Array.isArray(result.data));
  console.log(`PASS: ${table} existing column contract and public read access.`);
}
// Both a denied request and an empty RLS-filtered response are safe for anonymous users.
for (const table of ['profiles', 'verification_records', 'content_admin_applications']) {
  const result = await get(`${table}?select=*&limit=1`);
  assert.ok([401, 403].includes(result.status) || (result.ok && Array.isArray(result.data) && result.data.length === 0), `Anonymous access must not expose ${table}`);
  console.log(`PASS: anonymous ${table} access returns no private rows.`);
}
const sdk = await fetch(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SDK_VERSION}/dist/umd/supabase.js`, { signal: AbortSignal.timeout(20000) });
assert.equal(sdk.ok, true, `Pinned SDK HTTP ${sdk.status}`);
assert.ok((await sdk.text()).length > 10000, 'Expected browser SDK bundle');
console.log(`PASS: pinned Supabase SDK ${SDK_VERSION} is available.`);
console.log('Live read-only verification passed. No passwords requested and no live records changed.');
