/**
 * Purpose: searchable CRUD screens for existing public content and admin ID records.
 * Depends on: existing data/storage services, shared form components, and lazy QR/image tools.
 * Debug: errors stay beside the operation; page generations prevent stale request repainting.
 */
import { CONTENT, VERIFICATION_FIELDS } from '../data/contracts.js';
import { element as el } from '../core/dom.js';
import { button, heading, badge, recordTable, editorDialog, dateText } from './ui.js';
import { fullName, idStatus } from '../data/id-model.js';

/** Defaults publish nothing accidentally; edits send only fields the operator changed. */
export function editFields(table, original = {}) {
  const verification = table === 'verification'; const def = verification ? null : CONTENT[table];
  const keys = verification ? VERIFICATION_FIELDS : def.fields;
  return keys.filter(key => !['file_name', 'file_type', 'file_size'].includes(key)).map(key => {
    const field = { key, required: key === (def?.title || 'control_number') || (['pages', 'announcements'].includes(table) && key === 'slug') || (table === 'officials' && key === 'position') || (table === 'directory_entries' && key === 'category') };
    if (/^is_/.test(key)) Object.assign(field, { type: 'checkbox', default: false });
    else if (key === 'status') Object.assign(field, { options: ['ACTIVE', 'INACTIVE', 'EXPIRED'], default: 'ACTIVE' });
    else if (key === 'sort_order') Object.assign(field, { type: 'number', default: 0 });
    else if (['date_acquired', 'expiration_date', 'document_date'].includes(key)) field.type = 'date';
    else if (key === 'published_at') Object.assign(field, { type: 'datetime-local', help: 'Local time on this device. Date is optional.' });
    else if (key.endsWith('_url')) Object.assign(field, { type: 'url', wide: true, help: 'Use an existing HTTPS link, or select a file below.' });
    else if (['excerpt', 'content', 'summary', 'description', 'requirements', 'bio', 'caption'].includes(key)) Object.assign(field, { type: 'textarea', wide: true });
    if (key === 'slug') field.help = 'Stable short page name, for example barangay-history. Keep existing slugs when editing.';
    return field;
  }).concat(def?.bucket ? [{ key: 'upload', label: original.id ? 'Upload replacement file (optional)' : 'Upload file (optional)', type: 'file', wide: true, accept: def.bucket === 'gallery-media' ? 'image/jpeg,image/png,image/webp,image/gif' : '.pdf,.doc,.docx,.xls,.xlsx', help: def.bucket === 'gallery-media' ? 'Photos are resized and compressed before upload. GIFs become still images.' : 'Maximum 10 MB. Existing linked files are retained.' }] : []);
}
function localDateTime(value) { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

/** Mount returns cleanup immediately so navigation can protect an in-progress editor. */
export function mountContent(root, table, services, isCurrent) {
  const verification = table === 'verification'; const def = verification ? null : CONTENT[table];
  const service = verification ? services.verification : services.content;
  let dialog, page = 0, generation = 0, disposed = false;
  const message = el('p', '', { role: 'status', class: 'module-message' });
  const active = () => !disposed && isCurrent();
  async function openEditor(row = {}) {
    if (!active()) return;
    const original = { ...row }; if (row.published_at) original.published_at = localDateTime(row.published_at);
    dialog = editorDialog({ title: (row.id ? 'Edit ' : 'Add ') + (verification ? 'ID record' : def.label), fields: editFields(table, row), original,
      description: verification ? 'Existing QR tokens are retained. These details are visible only through the current verification rules.' : 'Only checked Published / Active records appear on the public website.',
      async onSave(values, file) {
        if (values.published_at) values.published_at = new Date(values.published_at).toISOString();
        // Only changed values are patched; an unrelated update in another tab is not blanked.
        const payload = row.id ? Object.fromEntries(Object.entries(values).filter(([key, value]) => key === 'published_at' ? localDateTime(value) !== localDateTime(row[key]) : value !== (row[key] ?? null))) : values;
        if (!file && !Object.keys(payload).length) return row;
        try {
          if (verification) return await service.save(payload, row.id ?? null);
          let prepared = file;
          if (file && def.bucket === 'gallery-media') { const { optimizeImage } = await import('../media/images.js'); prepared = await optimizeImage(file); }
          return prepared ? await services.storage.saveWithUpload(table, payload, row.id ?? null, prepared) : await services.content.save(table, payload, row.id ?? null);
        } catch (error) { if (!row.id) error.message += ' If the connection dropped, close and refresh the list before creating again to avoid duplicates.'; throw error; }
      },
      afterSave: async () => { if (!active()) return; message.textContent = 'Saved successfully. Published changes are available on the public website.'; await load(page); },
    });
  }
  heading(root, verification ? 'ID records & QR codes' : def.label, verification ? 'Manage existing IDs and download print-ready verification QR codes.' : 'Keep barangay information clear, current and ready for residents.', [button(verification ? '+ Add ID' : '+ Add record', () => openEditor(), true)]);
  const toolbar = el('form', '', { class: 'list-toolbar', role: 'search' });
  const search = el('input', '', { type: 'search', maxlength: 100, placeholder: verification ? 'Search ID number…' : 'Search name or title…', 'aria-label': verification ? 'Search ID number' : 'Search name or title' });
  const filter = el('select', '', { 'aria-label': verification ? 'Stored status filter' : 'Visibility filter' });
  (verification ? [['all', 'All stored statuses'], ['ACTIVE', 'Stored: ACTIVE'], ['INACTIVE', 'Stored: INACTIVE'], ['EXPIRED', 'Stored: EXPIRED']] : [['all', 'All records'], ['published', 'Published / active'], ['draft', 'Draft / hidden']]).forEach(([value, text]) => filter.append(el('option', text, { value })));
  toolbar.append(search, filter, el('button', 'Search', { type: 'submit' }));
  const slot = el('div'); const footer = el('div', '', { class: 'list-footer' }); const summary = el('span', 'Loading records…');
  const previous = button('← Previous', () => load(page - 1)); const next = button('Next →', () => load(page + 1)); footer.append(summary, previous, next); root.append(toolbar, message, slot, footer);
  let appliedSearch = '', appliedFilter = 'all';
  toolbar.addEventListener('submit', event => { event.preventDefault(); appliedSearch = search.value.trim(); appliedFilter = filter.value; load(0); });
  const columns = verification ? [
    { key: 'control_number' }, { key: 'full_name', label: 'Name', render: fullName },
    { key: 'date_acquired', render: row => dateText(row.date_acquired) }, { key: 'expiration_date', render: row => dateText(row.expiration_date) },
    { key: 'status', label: 'Current validity', render: row => { const status = idStatus(row); return badge(status, status === 'Valid' ? 'good' : 'warning'); } },
  ] : [{ key: def.title }, ...(['officials', 'directory_entries', 'forms', 'disclosures', 'gallery_items'].includes(table) ? [{ key: table === 'officials' ? 'position' : table === 'gallery_items' ? 'album' : 'category' }] : []), { key: def.flag, label: 'Visibility', render: row => badge(row[def.flag] ? 'Published' : 'Draft / hidden', row[def.flag] ? 'good' : '') }, { key: def.order, render: row => def.order.endsWith('_at') ? dateText(row[def.order]) : row[def.order] }];
  async function remove(row, trigger) {
    const name = verification ? row.control_number : row[def.title];
    if (!confirm(`Delete “${name}”? This removes the database record. Linked files are retained; this cannot be undone here.`)) return;
    trigger.disabled = true;
    message.textContent = 'Deleting record…';
    try { if (verification) await service.remove(row.id); else await service.remove(table, row.id); if (active()) { message.textContent = `Deleted “${name}”.`; await load(page); } }
    catch (error) { if (active()) message.textContent = error.message; }
    finally { trigger.disabled = false; }
  }
  function actions(row) {
    const result = [button('Edit', () => openEditor(row))];
    if (verification) result.push(button('QR / Download', async () => { try { const { showQr } = await import('./qr.js'); if (active()) dialog = await showQr(row, { isCurrent: active }); } catch (error) { if (active()) message.textContent = error.message; } }));
    result.push(button('Delete', event => remove(row, event.currentTarget))); return result;
  }
  async function load(target) {
    const request = ++generation; previous.disabled = next.disabled = true; summary.textContent = 'Loading…';
    try {
      const options = { page: Math.max(0, target), pageSize: 20, search: appliedSearch, ...(verification ? { status: appliedFilter } : { visibility: appliedFilter }) };
      const data = verification ? await service.list(options) : await service.list(table, options);
      if (!active() || request !== generation) return;
      if (!data.rows.length && target > 0) { await load(target - 1); return; }
      page = options.page; slot.replaceChildren(recordTable(data.rows, columns, actions)); summary.textContent = `${data.count} records · Page ${page + 1}`;
      previous.disabled = page === 0; next.disabled = (page + 1) * 20 >= data.count;
    } catch (error) { if (active() && request === generation) { message.textContent = error.message; summary.textContent = 'Could not load records. Search to retry.'; } }
  }
  load(0);
  const cleanup = () => { disposed = true; generation++; dialog?.(); };
  cleanup.canLeave = () => !dialog?.canLeave || dialog.canLeave(); return cleanup;
}
