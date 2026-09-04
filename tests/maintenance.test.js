/**
 * Purpose: prove live-settings forms and public maintenance transitions using fake services.
 * Depends on: Node tests, Linkedom, and actual page controllers; no production requests/writes.
 * Debug: deferred responses reproduce stale content/QR races after maintenance is enabled.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { watchAvailability, maintenanceSurface } from '../assets/js/public/availability.js';
import { startPublicPage } from '../assets/js/public/app.js';
import { startVerificationPage } from '../assets/js/public/verify.js';
import { mountSettings } from '../assets/js/staff/settings-screen.js';
import { staffDestination } from '../assets/js/core/navigation.js';
import { presetDesign } from '../assets/js/design/model.js';

const { window } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = window.document; globalThis.Node = window.Node;
globalThis.location = { hash: '', search: '', pathname: '/index.html' };
globalThis.confirm = () => true; globalThis.matchMedia = () => ({ matches: false }); window.scrollTo = () => {};
window.HTMLElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLElement.prototype.close = function () { this.removeAttribute('open'); };
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const base = () => ({ id: 1, barangay_name: 'Test barangay', hero_title: 'Public homepage', hero_text: 'Original homepage text', maintenance_mode: false, maintenance_title: 'Planned maintenance', maintenance_message: 'Please return shortly.' });

/** Each fixture owns fake state; test writes never leave the process. */
function fixture() {
  let settings = base(), covers = [], failure = false; const writes = []; let reads = 0, contentReads = 0, directoryReads = 0, qrReads = 0;
  const services = {
    settings: { read: async () => { reads++; if (failure) throw new Error('Offline'); return { ...settings }; }, update: async values => { writes.push(values); settings = { ...settings, ...values }; return { ...settings }; } },
    design: { read: async () => ({ config: presetDesign() }) },
    covers: { read: async () => ({ slides: covers.map(slide => ({ ...slide })) }) },
    content: { list: async () => { contentReads++; return { rows: [], count: 0 }; } },
    directory: { listPublic: async () => { directoryReads++; return { rows: [], count: 0 }; } },
    verification: { verifyQr: async () => { qrReads++; return null; }, verifyManual: async () => { qrReads++; return null; } },
  };
  return { services, writes, settings: values => { settings = { ...settings, ...values }; }, covers: values => { covers = values.map(slide => ({ ...slide })); }, fail: value => { failure = value; }, counts: () => ({ reads, contentReads, directoryReads, qrReads }) };
}
function shell(id) {
  document.body.innerHTML = '<p id="status"></p><div id="' + id + '"></div>';
  location.hash = ''; location.search = ''; return document.getElementById(id);
}
const click = (root, text) => { const target = [...root.querySelectorAll('button')].find(button => button.textContent === text); assert.ok(target, text); target.click(); };

test('login preserves Page Settings only for a verified admin and rejects arbitrary redirects', () => {
  assert.equal(staffDestination('admin', 'settings'), 'admin/index.html#settings');
  assert.equal(staffDestination('admin', 'visibility'), 'admin/index.html#visibility');
  assert.equal(staffDestination('editor', 'settings'), 'editor/index.html');
  assert.equal(staffDestination('editor', 'pages'), 'editor/index.html#pages');
  for (const next of ['https://example.test', '//example.test', '../settings', 'settings?bad', null]) assert.equal(staffDestination('admin', next), 'admin/index.html');
});
test('availability deduplicates reads, reports actual transitions, and fails closed', async () => {
  const f = fixture(), changes = []; const stop = watchAvailability(f.services.settings, (settings, error) => changes.push({ settings, error }));
  try {
    await Promise.all([stop.refresh(), stop.refresh(), stop.refresh()]); assert.equal(f.counts().reads, 1);
    await stop.refresh(); assert.equal(changes.length, 1);
    f.settings({ maintenance_mode: true }); await stop.refresh(); assert.equal(changes.at(-1).settings.maintenance_mode, true);
    f.fail(true); await stop.refresh(); assert.equal(changes.at(-1).settings, null);
    f.fail(false); await stop.refresh(); assert.equal(changes.at(-1).settings.maintenance_mode, true);
  } finally { stop(); }
});
test('disposed availability ignores late reads and hidden tabs do not refresh on focus', async () => {
  const pending = deferred(), changes = []; let reads = 0;
  const stop = watchAvailability({ read: () => { reads++; return pending.promise; } }, value => changes.push(value));
  try {
    document.hidden = true; window.dispatchEvent(new window.Event('focus')); assert.equal(reads, 0);
    document.hidden = false; const request = stop.refresh(); stop(); pending.resolve(base()); await request; assert.equal(changes.length, 0);
  } finally { document.hidden = false; stop(); }
});
test('maintenance surface keeps staff recovery accessible and renders notice text safely', () => {
  const notice = maintenanceSurface({ ...base(), maintenance_title: '<script>bad</script>' });
  assert.equal(notice.querySelector('script'), null); assert.match(notice.textContent, /<script>bad/);
  assert.equal(notice.querySelector('a[href]').getAttribute('href'), 'login.html?next=settings');
  assert.equal(notice.querySelector('nav'), null);
  assert.match(maintenanceSurface({}).textContent, /We will be right back/);
});
test('Page Settings edits the real homepage payload without touching maintenance or account data', async () => {
  const root = shell('settings-test'), f = fixture(); const cleanup = mountSettings(root, f.services, () => true);
  try {
    await flush(); click(root, 'Edit public homepage');
    document.querySelector('[name=hero_title]').value = 'Updated homepage';
    document.querySelector('dialog form').dispatchEvent(new window.Event('submit', { cancelable: true })); await flush();
    assert.deepEqual(f.writes, [{ hero_title: 'Updated homepage' }]); assert.match(root.textContent, /Updated homepage/);
  } finally { cleanup(); }
});
test('maintenance toggle confirms first, patches only the flag, and can turn off with blank notice fields', async () => {
  const root = shell('settings-test'), f = fixture(); f.settings({ maintenance_title: null, maintenance_message: null });
  const cleanup = mountSettings(root, f.services, () => true);
  try {
    await flush(); click(root, 'Enable maintenance mode'); click(document.querySelector('dialog'), 'Cancel'); await flush(); assert.equal(f.writes.length, 0);
    click(root, 'Enable maintenance mode'); click(document.querySelector('dialog'), 'Enable maintenance'); await flush(); assert.deepEqual(f.writes[0], { maintenance_mode: true }); assert.match(root.textContent, /ON · Public website paused/);
    click(root, 'Disable maintenance mode'); click(document.querySelector('dialog'), 'Reopen website'); await flush(); assert.deepEqual(f.writes[1], { maintenance_mode: false }); assert.match(root.textContent, /OFF · Public website live/);
  } finally { cleanup(); }
});
test('maintenance preview is write-free and a denied toggle never displays false success', async () => {
  const root = shell('settings-test'), f = fixture(); f.services.settings.update = async () => { throw new Error('Access denied'); };
  const cleanup = mountSettings(root, f.services, () => true);
  try {
    await flush(); click(root, 'Preview maintenance notice'); assert.match(document.querySelector('dialog').textContent, /Preview only/); assert.equal(f.writes.length, 0);
    click(document.querySelector('dialog'), 'Close preview');
    click(root, 'Enable maintenance mode'); click(document.querySelector('dialog'), 'Enable maintenance'); await flush(); assert.match(root.textContent, /Access denied/); assert.match(root.textContent, /OFF · Public website live/);
  } finally { cleanup(); }
});
test('editing notice text keeps maintenance unchanged and supplies safe blank-field defaults', async () => {
  const root = shell('settings-test'), f = fixture(); const cleanup = mountSettings(root, f.services, () => true);
  try {
    await flush(); click(root, 'Edit maintenance notice');
    document.querySelector('[name=maintenance_title]').value = '';
    document.querySelector('[name=maintenance_message]').value = 'New public notice';
    document.querySelector('dialog form').dispatchEvent(new window.Event('submit', { cancelable: true })); await flush();
    assert.deepEqual(f.writes[0], { maintenance_title: 'We will be right back', maintenance_message: 'New public notice' });
    assert.match(root.textContent, /OFF · Public website live/);
  } finally { cleanup(); }
});
test('an initial maintenance screen does not load public content', async () => {
  const root = shell('public-root'), f = fixture(); f.settings({ maintenance_mode: true });
  const cleanup = await startPublicPage({ services: f.services });
  try { await flush(); assert.equal(f.counts().contentReads, 0); assert.match(root.textContent, /Planned maintenance/); }
  finally { cleanup(); }
});
test('open public page switches to maintenance and resumes its route when maintenance ends', async () => {
  const root = shell('public-root'), f = fixture(); const cleanup = await startPublicPage({ services: f.services });
  try {
    await flush(); assert.match(root.textContent, /Public homepage/);
    f.settings({ maintenance_mode: true }); window.dispatchEvent(new window.Event('focus')); await flush();
    assert.match(root.textContent, /Planned maintenance/); assert.equal(root.querySelector('.public-nav'), null);
    const count = f.counts().contentReads; location.hash = '#services'; window.dispatchEvent(new window.Event('hashchange')); await flush(); assert.equal(f.counts().contentReads, count);
    f.settings({ maintenance_mode: false }); window.dispatchEvent(new window.Event('focus')); await flush(); assert.ok(root.querySelector('.public-nav')); assert.match(root.textContent, /Barangay Services/);
    f.fail(true); window.dispatchEvent(new window.Event('focus')); await flush(); assert.match(root.textContent, /Website temporarily unavailable/); assert.equal(root.querySelector('.public-nav'), null);
  } finally { cleanup(); }
});
test('public personnel pages read the existing-person Directory RPC, not duplicate content rows', async () => {
  const root = shell('public-root'), f = fixture();
  const calls = [];
  f.services.directory.listPublic = async options => {
    calls.push(options);
    return { rows: [{ id: 17, name: 'Existing Database Person', designation: 'Barangay Clerk', role_title: 'Barangay Clerk', category: 'Administrative Staff', photo_url: null }], count: 1 };
  };
  location.hash = '#staff';
  const cleanup = await startPublicPage({ services: f.services });
  try {
    await flush();
    assert.equal(calls[0].section, 'staff');
    assert.match(root.textContent, /Existing Database Person/);
    assert.match(root.textContent, /Administrative Staff/);
  } finally { cleanup(); }
});
test('public hero reuses and refreshes the existing dashboard cover record', async () => {
  const root = shell('public-root'), f = fixture();
  f.covers([{ id: 'hall-1', url: 'https://example.test/hall-one.webp', alt: 'Barangay Hall', caption: 'Local Government of Sibulan' }]);
  const cleanup = await startPublicPage({ services: f.services });
  try {
    await flush();
    assert.ok(root.querySelector('.hero.has-cover .hero-cover'));
    assert.equal(root.querySelector('.hero-cover img').getAttribute('src'), 'https://example.test/hall-one.webp');
    f.covers([{ id: 'hall-2', url: 'https://example.test/hall-two.webp', alt: 'Updated Barangay Hall', caption: '' }]);
    window.dispatchEvent(new window.Event('focus')); await flush();
    assert.equal(root.querySelector('.hero-cover img').getAttribute('src'), 'https://example.test/hall-two.webp');
    f.covers([]); window.dispatchEvent(new window.Event('focus')); await flush();
    assert.equal(root.querySelector('.hero-cover'), null); assert.ok(root.querySelector('.hero:not(.has-cover) .hero-copy'));
  } finally { cleanup(); }
});
test('late content responses cannot replace an active maintenance screen', async () => {
  const root = shell('public-root'), f = fixture(), pending = deferred(); f.services.content.list = () => pending.promise;
  const cleanup = await startPublicPage({ services: f.services });
  try {
    await flush(); f.settings({ maintenance_mode: true }); window.dispatchEvent(new window.Event('focus')); await flush();
    pending.resolve({ rows: [{ title: 'Must not reappear' }], count: 1 }); await flush();
    assert.match(root.textContent, /Planned maintenance/); assert.doesNotMatch(root.textContent, /Must not reappear/);
  } finally { cleanup(); }
});
test('direct QR link never calls verification while maintenance is on', async () => {
  const root = shell('verify-root'), f = fixture(); f.settings({ maintenance_mode: true }); location.search = '?qr=sample';
  const cleanup = await startVerificationPage({ services: f.services });
  try { await flush(); assert.equal(f.counts().qrReads, 0); assert.equal(root.querySelector('form'), null); assert.match(root.textContent, /Planned maintenance/); }
  finally { cleanup(); }
});
test('manual verification rechecks maintenance even before the next focus or polling event', async () => {
  const root = shell('verify-root'), f = fixture(); const cleanup = await startVerificationPage({ services: f.services });
  try {
    f.settings({ maintenance_mode: true });
    root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true })); await flush();
    assert.equal(f.counts().qrReads, 0); assert.match(root.textContent, /Planned maintenance/);
  } finally { cleanup(); }
});
test('maintenance stops an open scanner and discards an outstanding ID result', async () => {
  const root = shell('verify-root'), f = fixture(), pending = deferred(); f.services.verification.verifyManual = () => pending.promise;
  const cleanup = await startVerificationPage({ services: f.services }); let stopped = 0;
  try {
    document.querySelector('#id-number').value = 'TEST-001'; document.querySelector('#last-name').value = 'Sample';
    root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true })); await flush();
    root.querySelector('video').srcObject = { getTracks: () => [{ stop: () => stopped++ }] };
    f.settings({ maintenance_mode: true }); window.dispatchEvent(new window.Event('focus')); await flush();
    pending.resolve({ full_name: 'Never show after maintenance', status: 'ACTIVE' }); await flush();
    assert.equal(stopped, 1); assert.equal(root.querySelector('video'), null); assert.doesNotMatch(root.textContent, /Never show after maintenance/); assert.match(root.textContent, /Planned maintenance/);
  } finally { cleanup(); }
});
