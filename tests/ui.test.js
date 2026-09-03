/**
 * Purpose: exercise native editing controls and public result rendering without live writes.
 * Depends on: linkedom test DOM and exported presentation helpers, not a browser session.
 * Debug: tests submit a fake form through its normal event handler and inspect service arguments.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { editorDialog, fieldsForm, recordTable } from '../assets/js/staff/ui.js';
import { verificationResult } from '../assets/js/public/verify.js';
import { mountStudio } from '../assets/js/design/studio.js';
import { presetDesign } from '../assets/js/design/model.js';
import { accessSurface } from '../assets/js/design/access-renderer.js';
import { contentCard, publicHome } from '../assets/js/design/public-renderer.js';
import { showRecords } from '../assets/js/core/dom.js';
const { window } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = window.document; globalThis.Node = window.Node;
globalThis.confirm = () => true;
globalThis.matchMedia = () => ({ matches: true });
window.HTMLElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLElement.prototype.close = function () { this.removeAttribute('open'); };
// Linkedom omits the native select.value setter; emulate option selection for unit tests.
Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
  configurable: true,
  get() { return this.querySelector('option[selected]')?.value || ''; },
  set(value) { for (const option of this.options) option.toggleAttribute('selected', option.value === value); },
});

test('editor dialog submits typed values and closes only after successful save', async () => {
  let payload;
  const cleanup = editorDialog({ title: 'Service', fields: [{ key: 'name', required: true }, { key: 'sort_order', type: 'number', default: 0 }, { key: 'is_active', type: 'checkbox' }], original: { name: 'Existing service', is_active: false }, onSave: async values => { payload = values; } });
  document.querySelector('[name=name]').value = 'Updated service';
  document.querySelector('[name=is_active]').checked = true;
  document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(payload, { name: 'Updated service', sort_order: 0, is_active: true }); assert.equal(document.querySelector('dialog'), null); cleanup();
});
test('failed saves preserve form values and display the error', async () => {
  const cleanup = editorDialog({ title: 'Service', fields: [{ key: 'name' }], original: { name: 'Keep my draft' }, onSave: async () => { throw new Error('Access denied'); } });
  document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector('[name=name]').value, 'Keep my draft'); assert.match(document.querySelector('dialog').textContent, /Access denied/); cleanup();
});
test('public verification result exposes no private extra fields and cannot inject HTML', () => {
  const result = verificationResult({ control_number: 'TEST-001', full_name: '<script>bad</script>', status: 'ACTIVE', date_acquired: '2025-01-01', expiration_date: '2099-01-01', private_note: 'never render' });
  assert.equal(result.querySelector('script'), null); assert.match(result.textContent, /<script>bad<\/script>/); assert.doesNotMatch(result.textContent, /never render/);
});
test('tables display safe content and empty states', () => {
  assert.match(recordTable([], [], () => []).textContent, /No matching/);
  const table = recordTable([{ title: '<img src=x onerror=bad>' }], [{ key: 'title' }], () => []);
  assert.equal(table.querySelector('img'), null);
});

/** No iframe or network runs here: the recorded message is the isolated preview contract. */
function studioFixture(options = {}) {
  const previousLocation = globalThis.location;
  globalThis.location = { origin: 'https://preview.example.test' };
  const root = document.createElement('main'); document.body.append(root);
  const cleanup = mountStudio(root, options);
  const messages = [];
  Object.defineProperty(root.querySelector('iframe'), 'contentWindow', { value: { postMessage: (message, origin) => messages.push({ message: structuredClone(message), origin }) } });
  const click = text => [...root.querySelectorAll('button')].find(button => button.textContent === text).click();
  return { root, messages, click, cleanup: () => { cleanup(); root.remove(); globalThis.location = previousLocation; } };
}
test('third picker synchronizes hex and preview, rejects invalid input, and supports discard/reset', () => {
  const fixture = studioFixture();
  try {
    const { root, messages, click } = fixture;
    assert.equal(root.querySelectorAll('input[type=color]').length, 3);
    const picker = root.querySelector('#design-secondary');
    assert.equal(root.querySelector('label[for=design-secondary]').firstChild.textContent, 'Secondary color');
    const hex = root.querySelector('[aria-label="Secondary color hex code"]');
    picker.value = '#ffffff'; picker.dispatchEvent(new window.Event('input'));
    assert.equal(hex.value, '#FFFFFF');
    assert.equal(messages.at(-1).message.config.secondary, '#ffffff');
    assert.equal(messages.at(-1).message.config.primary, presetDesign().primary);
    assert.equal(messages.at(-1).origin, 'https://preview.example.test');
    hex.value = '#123456'; hex.dispatchEvent(new window.Event('input'));
    assert.equal(picker.value, '#123456');
    hex.value = 'invalid'; hex.dispatchEvent(new window.Event('blur'));
    assert.equal(hex.value, '#123456');
    assert.match(root.querySelector('.studio-message').textContent, /last valid color was kept/);
    click('Discard changes'); assert.equal(picker.value, presetDesign().secondary);
    picker.value = '#000000'; picker.dispatchEvent(new window.Event('input'));
    click('Reset to Modern LGU default'); assert.equal(picker.value, presetDesign().secondary);
    assert.equal([...root.querySelectorAll('button')].find(button => button.textContent === 'Preview only').disabled, true);
  } finally { fixture.cleanup(); }
});
test('secondary draft calls the existing publish service only after confirmation', async () => {
  const saved = []; const published = [];
  const fixture = studioFixture({ service: { publish: async config => { saved.push(structuredClone(config)); return { config }; } }, onPublished: config => published.push(config) });
  try {
    const picker = fixture.root.querySelector('#design-secondary');
    picker.value = '#123456'; picker.dispatchEvent(new window.Event('input'));
    assert.equal(saved.length, 0);
    fixture.click('Publish Everywhere ↗'); assert.equal(saved.length, 0);
    fixture.click('Confirm publish');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(saved.length, 1); assert.equal(saved[0].secondary, '#123456');
    assert.equal(published[0].secondary, '#123456');
    assert.match(fixture.root.querySelector('.studio-message').textContent, /Published everywhere/);
  } finally { fixture.cleanup(); }
});
test('English interface copy does not translate stored barangay content', () => {
  assert.equal(showRecords([], []).textContent, 'No records yet.');
  assert.match(accessSurface('login').textContent, /Use your existing email and password/);
  assert.match(contentCard('announcements', { title: 'Pabatid sa mga residente', excerpt: 'Libreng serbisyo' }).textContent, /Pabatid sa mga residenteLibreng serbisyo/);
});
test('saved Dashboard cover is reused inside the public hero without a duplicate image source', () => {
  const cover = { id: 'barangay-hall', url: 'https://example.com/barangay-hall.webp', alt: 'Barangay hall', caption: 'Public service center' };
  const home = publicHome({ barangay_name: 'Sibulan', hero_title: 'Local Government of Sibulan' }, {}, presetDesign(), { preview: true, covers: [cover] });
  const hero = home.querySelector('.hero');
  assert.ok(hero.classList.contains('has-cover'));
  assert.equal(hero.querySelector('.hero-cover img').getAttribute('src'), cover.url);
  assert.equal(home.querySelectorAll('.cover-slideshow').length, 1);
  assert.equal(hero.parentElement.querySelector(':scope > .cover-slideshow'), null);
  home.dispose();
});
test('homepage keeps the existing plain hero fallback when no cover is saved', () => {
  const home = publicHome({ barangay_name: 'Sibulan', hero_title: 'Local Government of Sibulan' }, {}, presetDesign(), { preview: true });
  const hero = home.querySelector('.hero');
  assert.equal(hero.classList.contains('has-cover'), false);
  assert.equal(home.querySelector('.cover-slideshow'), null);
});
