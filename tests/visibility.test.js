/**
 * Purpose: verify independent public visibility saves, parent switches, and admin controls.
 * Depends on: Node test runner, Linkedom, and fake services; no production settings are read or written.
 * Debug: inspect the saved namespaced JSON and each card's one-key save call.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createVisibility, defaultVisibility, moduleVisible, normalizeVisibility, visibilitySnapshot, VISIBILITY_KEY } from '../assets/js/data/visibility.js';
import { publicHeader, publicHome } from '../assets/js/design/public-renderer.js';
import { presetDesign } from '../assets/js/design/model.js';
import { mountVisibility } from '../assets/js/staff/visibility-screen.js';
import { unavailableSurface } from '../assets/js/public/visibility.js';
import { startVerificationPage } from '../assets/js/public/verify.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

/** Stateful fake query builder models the singleton JSON without network access. */
function visibilityClient(initial) {
  let row = structuredClone(initial); const calls = [];
  return {
    calls,
    row: () => structuredClone(row),
    from(table) {
      const call = { table, steps: [], update: null }; calls.push(call);
      const query = {};
      for (const name of ['select', 'eq', 'is', 'single', 'maybeSingle']) query[name] = (...args) => { call.steps.push([name, ...args]); return query; };
      query.update = value => { call.update = value; call.steps.push(['update', value]); return query; };
      query.then = (resolve, reject) => {
        if (call.update) row = { ...row, ...structuredClone(call.update), updated_at: '2026-09-03T00:00:00Z' };
        return Promise.resolve({ data: structuredClone(row), error: null }).then(resolve, reject);
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      row = { ...row, design_theme: structuredClone(args.p_next), updated_at: '2026-09-03T00:00:00Z' };
      return { data: [structuredClone(row)], error: null };
    },
  };
}

test('missing visibility preserves the existing fully visible website', () => {
  const config = visibilitySnapshot({ id: 1, design_theme: null }).config;
  assert.equal(moduleVisible(config, 'directory'), true);
  assert.equal(moduleVisible(config, 'verify'), true);
  assert.equal(moduleVisible(config, 'officials'), true);
  assert.throws(() => normalizeVisibility({ version: 2 }), /newer website/);
});

test('Directory master hides children without erasing their own saved switches', () => {
  const config = defaultVisibility(); config.modules.directory = false; config.modules.officials = true;
  assert.equal(moduleVisible(config, 'directory'), false);
  assert.equal(moduleVisible(config, 'officials'), false);
  config.modules.directory = true;
  assert.equal(moduleVisible(config, 'officials'), true);
});

test('one visibility save preserves design, covers, and unrelated module settings', async () => {
  const original = { id: 1, design_theme: { legacy: 'keep', brgyweblitev3: { version: 1 }, brgyweblitev3_covers: { version: 1, slides: [] }, [VISIBILITY_KEY]: { version: 1, modules: { verify: false }, groups: { Lupon: false } } } };
  const client = visibilityClient(original); const roles = [];
  const saved = await createVisibility(client, { requirePermission: async value => roles.push(value) }).saveModule('directory', false);
  assert.deepEqual(roles, ['public_visibility']);
  assert.equal(client.row().design_theme.legacy, 'keep');
  assert.deepEqual(client.row().design_theme.brgyweblitev3_covers, original.design_theme.brgyweblitev3_covers);
  assert.equal(saved.config.modules.directory, false);
  assert.equal(saved.config.modules.verify, false);
  assert.equal(saved.config.groups.Lupon, false);
  assert.equal(client.calls[1].rpc, 'staff_update_design_namespace');
  assert.equal(client.calls[1].args.p_namespace, VISIBILITY_KEY);
});

test('hidden modules leave Home available while removing their links and previews', () => {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.window = window; globalThis.document = window.document; globalThis.Node = window.Node;
  globalThis.matchMedia = () => ({ matches: true });
  const visibility = defaultVisibility(); visibility.modules.directory = false; visibility.modules.verify = false; visibility.modules.announcements = false;
  const header = publicHeader({ barangay_name: 'Sibulan' }, 'home', visibility);
  assert.match(header.textContent, /Home/);
  assert.doesNotMatch(header.textContent, /Directory|Verify Barangay ID|News & Updates/);
  const home = publicHome({ barangay_name: 'Sibulan' }, { officials: [{ full_name: 'Hidden Official' }], announcements: [{ title: 'Hidden news' }] }, presetDesign(), { preview: true, visibility });
  assert.equal(home.querySelector('[data-section=officials]'), null);
  assert.equal(home.querySelector('[data-section=announcements]'), null);
});

test('disabled Verify notice never labels the printed ID invalid', () => {
  const { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document; globalThis.Node = document.defaultView.Node;
  const notice = unavailableSurface({ barangay_name: 'Sibulan' }, { verification: true });
  assert.match(notice.textContent, /temporarily unavailable/);
  assert.match(notice.textContent, /has not been marked invalid/);
  assert.doesNotMatch(notice.textContent, /No matching ID/);
});

test('Verify OFF blocks an old QR link before either verification RPC runs', async () => {
  const { window } = parseHTML('<!doctype html><html lang="en" data-design-state="loading"><body><p id="status"></p><div id="verify-root"></div></body></html>');
  globalThis.window = window; globalThis.document = window.document; globalThis.Node = window.Node;
  globalThis.location = { search: '?qr=existing-token', hash: '', pathname: '/verify.html' };
  globalThis.matchMedia = () => ({ matches: true }); document.hidden = false;
  const visibility = defaultVisibility(); visibility.modules.verify = false;
  let qrReads = 0;
  const cleanup = await startVerificationPage({ services: {
    settings: { read: async () => ({ id: 1, barangay_name: 'Sibulan', maintenance_mode: false }) },
    visibility: { read: async () => ({ config: visibility }) },
    design: { read: async () => ({ config: presetDesign() }) },
    verification: { verifyQr: async () => { qrReads++; return null; }, verifyManual: async () => { qrReads++; return null; } },
  } });
  try {
    assert.equal(qrReads, 0);
    assert.equal(document.querySelector('#verify-root form'), null);
    assert.match(document.querySelector('#verify-root').textContent, /temporarily unavailable/);
  } finally { cleanup(); }
});

test('Public Visibility renders one Save per card and actual Directory headings', async () => {
  const { window } = parseHTML('<!doctype html><html><body><main id="root"></main></body></html>');
  globalThis.window = window; globalThis.document = window.document; globalThis.Node = window.Node;
  globalThis.confirm = () => true;
  const root = document.querySelector('#root'), saved = [];
  const config = defaultVisibility();
  const services = {
    visibility: {
      read: async () => ({ config }),
      saveModule: async (key, enabled) => { saved.push({ key, enabled }); const next = structuredClone(config); next.modules[key] = enabled; return { config: next }; },
      saveGroup: async (key, enabled) => { saved.push({ group: key, enabled }); const next = structuredClone(config); next.groups[key] = enabled; return { config: next }; },
    },
    directory: { headings: async () => [{ section: 'functionaries', name: 'Lupon' }, { section: 'staff', name: 'Barangay Clerk' }] },
  };
  const cleanup = mountVisibility(root, services, () => true); await flush();
  try {
    assert.match(root.textContent, /Directory subcategories/);
    assert.ok([...root.querySelectorAll('.visibility-card h3')].some(node => node.textContent === 'Lupon'));
    let directoryCard = [...root.querySelectorAll('.visibility-card')].find(card => card.querySelector('h3')?.textContent === 'Directory');
    const toggle = directoryCard.querySelector('input'); toggle.checked = false; toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
    directoryCard = [...root.querySelectorAll('.visibility-card')].find(card => card.querySelector('h3')?.textContent === 'Directory');
    const save = [...directoryCard.querySelectorAll('button')].find(node => /Save Directory visibility/.test(node.textContent));
    assert.equal(save.disabled, false); save.click(); await flush();
    assert.deepEqual(saved[0], { key: 'directory', enabled: false });
  } finally { cleanup(); }
});
