/**
 * Purpose: regressions for the five-cover limit, original ID rules, usage and QR compatibility.
 * Depends on: pure data modules and pinned local test tools; no live account/data mutations.
 * Debug: test names identify the contract, especially unknown-versus-zero usage values.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';
import { createCovers, validateCovers, coverSnapshot } from '../assets/js/data/covers.js';
import { idStatus, verificationUrl, PUBLIC_SITE } from '../assets/js/data/id-model.js';
import { formatBytes, createUsage } from '../assets/js/data/usage.js';

test('cover settings enforce five unique HTTPS slides and omit unknown fields', () => {
  const slides = Array.from({ length: 5 }, (_, i) => ({ id: `slide-${i}`, url: `https://example.com/${i}.webp`, alt: `Photo ${i}`, caption: 'Caption', extra: 'omit' }));
  assert.deepEqual(validateCovers(slides)[0], { id: 'slide-0', url: 'https://example.com/0.webp', alt: 'Photo 0', caption: 'Caption' });
  assert.throws(() => validateCovers([...slides, slides[0]]), /maximum/);
  assert.throws(() => validateCovers([slides[0], slides[0]]), /unique/);
  assert.throws(() => validateCovers([{ id: 'x', url: 'javascript:alert(1)', alt: 'x' }]), /HTTPS/);
  assert.throws(() => validateCovers([{ id: 'x', url: 'https://example.com/a.jpg', alt: '' }]), /description/);
  assert.equal(coverSnapshot({ id: 1, design_theme: { old: true } }).slides.length, 0);
});
test('cover saves remain admin-only, merge legacy keys and reject stale baselines', async () => {
  const roles = [], writes = []; let result = { id: 1, design_theme: {} };
  const chain = { update(value) { writes.push(value); return this; }, eq() { return this; }, is() { return this; }, select() { return this; }, maybeSingle: async () => ({ data: result }) };
  const service = createCovers({ from: () => chain }, { requireStaff: async role => roles.push(role) });
  await service.save([], { raw: { legacy: true, brgyweblitev3: { version: 1 } } });
  assert.deepEqual(roles, [['admin']]); assert.equal(writes[0].design_theme.legacy, true); assert.equal(writes[0].design_theme.brgyweblitev3.version, 1);
  result = null; await assert.rejects(service.save([], { raw: null }), /changed/);
});
test('ID validity preserves original inclusive expiry and inactive rules', () => {
  assert.equal(idStatus({ status: 'ACTIVE', expiration_date: '2026-09-02' }, '2026-09-02'), 'Valid');
  assert.equal(idStatus({ status: 'ACTIVE', expiration_date: '2026-09-01' }, '2026-09-02'), 'Expired');
  assert.equal(idStatus({ status: 'INACTIVE', expiration_date: '2099-01-01' }, '2026-09-02'), 'Inactive');
  assert.equal(idStatus({ status: 'ACTIVE', date_acquired: '2099-01-01' }, '2026-09-02'), 'Valid');
});
test('QR URL contains a permanent HTTPS address and only the unchanged token', () => {
  const token = '123e4567-e89b-12d3-a456-426614174000'; const url = new URL(verificationUrl(token));
  assert.equal(url.href.startsWith(PUBLIC_SITE + 'verify.html'), true); assert.equal(url.searchParams.get('qr'), token); assert.equal(url.searchParams.size, 1);
  assert.throws(() => verificationUrl('bad'), /valid QR/);
});
test('usage formatting never turns missing values into zero storage', () => {
  assert.equal(formatBytes(null), 'Not available'); assert.equal(formatBytes(1536), '1.50 KB'); assert.equal(formatBytes(0), '0 B');
});
test('usage cache still rechecks admin access and sums existing Storage metadata', async () => {
  let authorized = true, requests = 0;
  const service = createUsage({ from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: { id: 1 } }) }), storage: { from: () => ({ list: async () => ({ data: [{ id: 'object', name: 'photo', metadata: { size: 32 } }] }) }) } },
    { requireStaff: async roles => { assert.deepEqual(roles, ['admin']); if (!authorized) throw new Error('denied'); } },
    async url => { requests++; return { ok: true, json: async () => url.includes('/deployments') ? [] : { size: 3, pushed_at: null } }; });
  const result = await service.read(); assert.equal(result.supabase.buckets.length, 4); assert.equal(result.supabase.buckets[0].bytes, 32); assert.equal(result.billing, null); assert.equal(result.supabase.database_bytes, null);
  await service.read({ force: true }); assert.equal(requests, 2); authorized = false; await assert.rejects(service.read(), /denied/);
});
test('generated ID QR round-trips through an independent QR decoder', () => {
  const url = verificationUrl('123e4567-e89b-12d3-a456-426614174000'); const qr = qrcode(0, 'M'); qr.addData(url, 'Byte'); qr.make();
  const scale = 8, margin = 4, side = (qr.getModuleCount() + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4); pixels.fill(255);
  for (let y = 0; y < qr.getModuleCount(); y++) for (let x = 0; x < qr.getModuleCount(); x++) if (qr.isDark(y, x)) {
    for (let py = 0; py < scale; py++) for (let px = 0; px < scale; px++) { const i = (((y + margin) * scale + py) * side + (x + margin) * scale + px) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0; }
  }
  assert.equal(jsQR(pixels, side, side)?.data, url);
});
