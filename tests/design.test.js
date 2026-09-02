/**
 * Purpose: regression coverage for shared themes, unsafe input, and atomic design publishing.
 * Depends on: Node test runner and mocked query builders; never writes live Supabase data.
 * Debug: compare recorded query steps for authorization, payload scope, and conflict handling.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign, designSnapshot } from '../assets/js/data/design.js';
import { createContent } from '../assets/js/data/content.js';
import { PRESETS, presetDesign, normalizeDesign, mergeDesign, contrastText, luminance, sameDesign } from '../assets/js/design/model.js';
import { applyDesign } from '../assets/js/design/runtime.js';

/** This builder logs only fake test data and never constructs a network client. */
function fixture(result = { data: { id: 1, design_theme: null }, error: null }) {
  const log = [];
  const client = { from(table) {
    const steps = []; log.push({ table, steps });
    const query = {};
    for (const name of ['select', 'eq', 'is', 'ilike', 'order', 'range', 'update', 'single', 'maybeSingle']) query[name] = (...args) => { steps.push([name, ...args]); return query; };
    query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return query;
  } };
  const auth = { requireStaff: async roles => { log.push({ roles }); } };
  return { client, auth, log };
}

test('five named presets all have genuinely different section orders', () => {
  assert.equal(Object.keys(PRESETS).length, 5);
  assert.equal(new Set(Object.values(PRESETS).map(item => item.name)).size, 5);
  assert.equal(new Set(Object.values(PRESETS).map(item => item.sectionOrder.join(','))).size, 5);
  for (const preset of Object.values(PRESETS)) assert.equal(new Set(preset.sectionOrder).size, 8);
});
test('service-first places services and forms before announcements', () => {
  assert.deepEqual(PRESETS['public-service'].sectionOrder.slice(0, 3), ['services', 'forms', 'announcements']);
});
test('normalization refuses CSS injections, arbitrary properties, and unknown fonts', () => {
  const clean = normalizeDesign({ preset: 'public-service', primary: '#123456', accent: 'url(javascript:bad)', css: 'body{}', font: 'url(remote)', extra: '<script>' });
  assert.equal(clean.primary, '#123456');
  assert.equal(clean.accent, PRESETS['public-service'].accent);
  assert.equal(clean.font, PRESETS['public-service'].font);
  assert.equal(Object.hasOwn(clean, 'css'), false);
  assert.equal(Object.hasOwn(clean, 'extra'), false);
});
test('null, arrays, unknown presets and future versions safely use defaults', () => {
  for (const input of [null, [], 'bad', { preset: 'unknown' }, { version: 99, preset: 'institutional' }]) assert.deepEqual(normalizeDesign(input), presetDesign());
});
test('preset reset returns fresh copies and never mutates another draft', () => {
  const draft = presetDesign(); draft.primary = '#000000'; draft.secondary = '#ffffff';
  assert.notEqual(draft.primary, presetDesign().primary);
  assert.notEqual(draft.secondary, presetDesign().secondary);
  assert.ok(sameDesign(presetDesign(), normalizeDesign({})));
});
test('older designs preserve their custom primary color on secondary panels', () => {
  for (const preset of Object.keys(PRESETS)) {
    assert.equal(presetDesign(preset).secondary, PRESETS[preset].primary);
    const legacy = { version: 1, preset, primary: '#AABBCC' };
    assert.equal(normalizeDesign(legacy).secondary, '#aabbcc');
    assert.ok(sameDesign(legacy, { ...legacy, secondary: '#aabbcc' }));
  }
});
test('secondary colors normalize hex values and refuse arbitrary CSS', () => {
  assert.equal(normalizeDesign({ secondary: '#ABCDEF' }).secondary, '#abcdef');
  for (const secondary of [null, '#fff', 'red', 'url(remote)', '#ffffff;display:none', {}]) {
    assert.equal(normalizeDesign({ primary: '#123456', secondary }).secondary, '#123456');
  }
  assert.equal(sameDesign(presetDesign(), { ...presetDesign(), secondary: '#ffffff' }), false);
});
test('shared runtime applies independent main, secondary, and accent contrast pairs', () => {
  const properties = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value) } };
  applyDesign({ primary: '#123456', secondary: '#ffffff', accent: '#abcdef' }, root);
  assert.equal(properties.get('--primary'), '#123456');
  assert.equal(properties.get('--secondary'), '#ffffff');
  assert.equal(properties.get('--on-secondary'), '#000000');
  assert.equal(properties.get('--accent'), '#abcdef');
  applyDesign({ secondary: '#000000' }, root);
  assert.equal(properties.get('--on-secondary'), '#ffffff');
  applyDesign(undefined, root);
  assert.equal(properties.get('--secondary'), presetDesign().secondary);
});
test('contrast text meets 4.5:1 for every RGB luminance sampled across the gamut', () => {
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const color = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    const a = luminance(color); const c = luminance(contrastText(color));
    assert.ok((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05) >= 4.5);
  }
});
test('design merge preserves legacy JSON and does not mutate its input', () => {
  const old = { legacy: { keep: true }, primary_color: 'untouched' };
  const merged = mergeDesign(old, presetDesign('institutional'));
  assert.deepEqual(merged.legacy, old.legacy); assert.equal(merged.primary_color, 'untouched');
  assert.equal(merged.brgyweblitev3.preset, 'institutional'); assert.equal(Object.hasOwn(old, 'brgyweblitev3'), false);
});
test('unsupported legacy JSON types fail without overwriting', () => {
  for (const value of ['old-string', [], 5, false]) assert.throws(() => mergeDesign(value, presetDesign()), /Unsupported/);
});
test('public design read requests only theme singleton fields', async () => {
  const { client, auth, log } = fixture(); await createDesign(client, auth).read();
  assert.deepEqual(log[0], { table: 'site_settings', steps: [['select', 'id,design_theme,updated_at'], ['eq', 'id', 1], ['single']] });
});
test('missing settings singleton cannot become a fabricated published design', () => {
  assert.throws(() => designSnapshot(null), /not found/);
  assert.throws(() => designSnapshot({ id: 2 }), /not found/);
});
test('publish is admin-only and patches only design_theme, preserving legacy data', async () => {
  const row = { id: 1, design_theme: { legacy: 'keep', brgyweblitev3_covers: { version: 1, slides: [] } } };
  const { client, auth, log } = fixture({ data: row, error: null });
  await createDesign(client, auth).publish({ ...presetDesign('national-authority'), secondary: '#abcdef' }, designSnapshot(row));
  assert.deepEqual(log[0], { roles: ['admin'] });
  const query = log[1]; assert.equal(query.table, 'site_settings');
  const update = query.steps.find(step => step[0] === 'update')[1];
  assert.deepEqual(Object.keys(update), ['design_theme']); assert.equal(update.design_theme.legacy, 'keep');
  assert.equal(update.design_theme.brgyweblitev3.preset, 'national-authority');
  assert.equal(update.design_theme.brgyweblitev3.secondary, '#abcdef');
  assert.deepEqual(update.design_theme.brgyweblitev3_covers, row.design_theme.brgyweblitev3_covers);
  assert.ok(query.steps.some(step => step[0] === 'eq' && step[1] === 'design_theme' && step[2] === JSON.stringify(row.design_theme)));
});
test('initial null theme uses IS NULL atomic comparison, never equality with null', async () => {
  const { client, auth, log } = fixture(); await createDesign(client, auth).publish(presetDesign(), designSnapshot({ id: 1, design_theme: null }));
  assert.ok(log[1].steps.some(step => step[0] === 'is' && step[1] === 'design_theme' && step[2] === null));
});
test('denied account never reaches a theme query', async () => {
  const { client, log } = fixture();
  await assert.rejects(createDesign(client, { requireStaff: async () => { throw new Error('denied'); } }).publish(presetDesign(), { id: 1, raw: null }), /denied/);
  assert.equal(log.length, 0);
});
test('zero-row write is a conflict, not false publish success', async () => {
  const { client, auth } = fixture({ data: null, error: null });
  await assert.rejects(createDesign(client, auth).publish(presetDesign(), { id: 1, raw: null }), { code: 'DESIGN_CONFLICT' });
});
test('network error cannot become publish success', async () => {
  const { client, auth } = fixture({ data: null, error: new Error('offline') });
  await assert.rejects(createDesign(client, auth).publish(presetDesign(), { id: 1, raw: null }), /offline/);
});
test('missing baselines and newer saved versions cannot be overwritten', async () => {
  const { client, auth, log } = fixture();
  for (const baseline of [null, { id: 1 }, { id: 2, raw: null }, { id: 1, raw: { brgyweblitev3: { version: 2 } } }]) await assert.rejects(createDesign(client, auth).publish(presetDesign(), baseline));
  assert.equal(log.filter(item => item.table).length, 0);
});
test('service-name search retains published flag, escapes wildcards and paginates', async () => {
  const { client, auth, log } = fixture({ data: [], error: null, count: 0 });
  await createContent(client, auth).list('services', { publicOnly: true, search: '100%_test' });
  assert.ok(log[0].steps.some(step => step[0] === 'eq' && step[1] === 'is_active' && step[2] === true));
  assert.deepEqual(log[0].steps.find(step => step[0] === 'ilike'), ['ilike', 'name', '%100\\%\\_test%']);
});
