/**
 * Purpose: small, unstyled presentation helpers; no database or auth operations.
 * Used by: the public and staff read-only connection screens.
 * Debug: check requested field names if a table cell is empty.
 */
/** Use textContent for database text so stored content cannot inject HTML/scripts. */
export function element(tag, text = '', attributes = {}) {
  const node = document.createElement(tag);
  if (text !== null) node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) node.setAttribute(key, String(value));
  }
  return node;
}

/** Only create HTTPS links; escaping text alone would not block javascript: URLs. */
export function safeLink(value, label = 'Open file') {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return element('span', 'Invalid file URL');
    return element('a', label, { href: url.href, target: '_blank', rel: 'noopener noreferrer' });
  } catch { return element('span', 'No file'); }
}

/** Render only the requested fields, preserving booleans and empty-state feedback. */
export function showRecords(rows, fields) {
  if (!rows.length) return element('p', 'Wala pang records.');
  const table = element('table');
  const caption = element('caption', `${rows.length} records on this page`);
  const head = element('thead');
  const header = element('tr');
  fields.forEach(field => header.append(element('th', field.replaceAll('_', ' '), { scope: 'col' })));
  head.append(header);
  const body = element('tbody');
  for (const row of rows) {
    const tr = element('tr');
    fields.forEach(field => {
      const td = element('td');
      if (field.endsWith('_url') && row[field]) td.append(safeLink(row[field]));
      else td.textContent = typeof row[field] === 'boolean' ? (row[field] ? 'Yes' : 'No') : String(row[field] ?? '—');
      tr.append(td);
    });
    body.append(tr);
  }
  table.append(caption, head, body);
  return table;
}
