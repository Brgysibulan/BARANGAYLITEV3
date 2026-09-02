/**
 * Purpose: retain public ID verification and protected System Admin record operations.
 * Depends on: the two existing verification RPCs and verification_records table.
 * Debug: public lookup errors belong to RPCs; admin list/save errors need role/RLS checks.
 */
import { unwrap } from '../core/client.js';
import { VERIFICATION_FIELDS, pickFields } from './contracts.js';

/** Accept an existing UUID token or printed legacy QR URL, not arbitrary query text. */
export function extractQrToken(value) {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const raw = String(value || '').trim();
  if (pattern.test(raw)) return raw;
  try {
    const token = new URL(raw).searchParams.get('qr') || '';
    return pattern.test(token) ? token : '';
  } catch { return ''; }
}

export function createVerification(client, auth) {
  /** Public manual lookup: send the exact existing RPC arguments, never list private rows. */
  async function verifyManual(control, lastName) {
    if (!control.trim() || !lastName.trim()) throw new Error('Control number and last name are required.');
    const rows = unwrap(await client.rpc('verify_barangay_record', {
      p_control_number: control.trim(), p_last_name: lastName.trim(),
    }));
    return rows?.[0] || null;
  }
  /** A valid QR uses the existing database-owned token without rotating it. */
  async function verifyQr(value) {
    const token = extractQrToken(value);
    if (!token) throw new Error('Invalid barangay QR token.');
    const rows = unwrap(await client.rpc('verify_barangay_record_qr', { p_token: token }));
    return rows?.[0] || null;
  }
  /** Private records require System Admin access and bounded pagination. */
  async function list({ page = 0, pageSize = 50 } = {}) {
    await auth.requireStaff(['admin']);
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid pagination.');
    const result = await client.from('verification_records').select(['id', 'qr_token', ...VERIFICATION_FIELDS].join(','), { count: 'exact' })
      .order('control_number').order('id').range(page * pageSize, (page + 1) * pageSize - 1);
    return { rows: unwrap(result) || [], count: result.count ?? 0 };
  }
  /** Update only editable ID details; the token and database ID are never in the payload. */
  async function save(values, id = null) {
    await auth.requireStaff(['admin']);
    // qr_token is database-owned. Editing an ID must not invalidate printed QR codes.
    const payload = pickFields(values, VERIFICATION_FIELDS);
    if ((id === null || Object.hasOwn(payload, 'control_number')) && !payload.control_number?.trim()) throw new Error('Control number is required.');
    if (payload.status && !['ACTIVE', 'INACTIVE', 'EXPIRED'].includes(payload.status)) throw new Error('Invalid status.');
    if (payload.date_acquired && payload.expiration_date && payload.expiration_date < payload.date_acquired) throw new Error('Expiration must not precede the acquisition date.');
    const query = id === null ? client.from('verification_records').insert(payload) : client.from('verification_records').update(payload).eq('id', id);
    return unwrap(await query.select(['id', 'qr_token', ...VERIFICATION_FIELDS].join(',')).single());
  }
  /** Explicit admin deletion; the UI must confirm the exact record before calling. */
  async function remove(id) {
    await auth.requireStaff(['admin']);
    if (id === null || id === undefined || id === '') throw new Error('Record ID required.');
    return unwrap(await client.from('verification_records').delete().eq('id', id).select('id').single());
  }
  return Object.freeze({ verifyManual, verifyQr, list, save, remove });
}
