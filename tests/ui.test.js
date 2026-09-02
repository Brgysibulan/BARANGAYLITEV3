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
const { window } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = window.document; globalThis.Node = window.Node;
globalThis.confirm = () => true;
window.HTMLElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLElement.prototype.close = function () { this.removeAttribute('open'); };

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
