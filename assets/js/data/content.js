/**
 * Purpose: reusable reads and explicit writes for the eight public-content tables.
 * Depends on: contracts.js, a Supabase client, and verified staff authorization.
 * Debug: inspect the chosen table/fields, publish flag, pagination, and RLS error.
 */
import { unwrap } from '../core/client.js';
import { contentContract, pickFields, validatePayload } from './contracts.js';

export function createContent(client, auth) {
  /** Staff sees authorized content; publicOnly always excludes unpublished records. */
  async function list(table, { publicOnly = false, page = 0, pageSize = 50, search = '' } = {}) {
    const def = contentContract(table);
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid pagination.');
    if (!publicOnly) await auth.requireStaff();
    let query = client.from(table).select(['id', ...def.fields].join(','), { count: 'exact' });
    // Keep the public predicate even when a staff session is present.
    if (publicOnly) query = query.eq(def.flag, true);
    if (search) {
      if (table !== 'services' || typeof search !== 'string' || search.length > 100) throw new Error('Service searches must be at most 100 characters.');
      // Escaping LIKE wildcards keeps resident searches literal, not filter expressions.
      query = query.ilike('name', '%' + search.replace(/[\\%_]/g, '\\$&') + '%');
    }
    const result = await query.order(def.order, { ascending: !def.descending, nullsFirst: false })
      .order('id', { ascending: true }).range(page * pageSize, (page + 1) * pageSize - 1);
    return { rows: unwrap(result) || [], count: result.count ?? 0 };
  }

  /** A null ID creates a record; an existing ID updates only whitelisted fields. */
  async function save(table, values, id = null) {
    await auth.requireStaff();
    const def = contentContract(table);
    const payload = validatePayload(pickFields(values, def.fields));
    if (!Object.keys(payload).length) throw new Error('No supported fields to save.');
    if ((id === null || Object.hasOwn(payload, def.title)) && !String(payload[def.title] || '').trim()) throw new Error(`${def.label}: a name/title is required.`);
    if (id === null && table === 'pages' && !payload.slug?.trim()) throw new Error('A page slug is required.');
    if (id === null && def.fileField && !payload[def.fileField]) throw new Error('An uploaded file or existing HTTPS file URL is required.');
    const query = id === null ? client.from(table).insert(payload) : client.from(table).update(payload).eq('id', id);
    // single() detects denied/zero-row writes instead of reporting false success.
    return unwrap(await query.select(['id', ...def.fields].join(',')).single());
  }

  /** Explicit record deletion only. Callers must confirm intent; linked files remain. */
  async function remove(table, id) {
    await auth.requireStaff();
    contentContract(table);
    if (id === null || id === undefined || id === '') throw new Error('Record ID required.');
    return unwrap(await client.from(table).delete().eq('id', id).select('id').single());
  }

  /** Fetch counts without downloading records; a failed count stays null, not zero. */
  async function counts({ publicOnly = false } = {}) {
    if (!publicOnly) await auth.requireStaff();
    const { CONTENT } = await import('./contracts.js');
    return Promise.all(Object.entries(CONTENT).map(async ([table, def]) => {
      let query = client.from(table).select('id', { count: 'exact', head: true });
      if (publicOnly) query = query.eq(def.flag, true);
      const result = await query;
      if (result.error) return { table, label: def.label, count: null, error: result.error.message };
      return { table, label: def.label, count: result.count };
    }));
  }
  return Object.freeze({ list, save, remove, counts });
}
