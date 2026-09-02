/**
 * Purpose: expose the existing Content Admin account/application workflow with confirmations.
 * Depends on: unchanged manage-editors service and server-side authorization; no Auth admin keys.
 * Debug: function errors appear in the screen; System Admin accounts are never offered as targets.
 */
import { element as el } from '../core/dom.js';
import { heading, button, badge, recordTable, editorDialog, dateText } from './ui.js';
import { PUBLIC_SITE } from '../data/id-model.js';
export function mountAccounts(root, services, isCurrent) {
  let disposed = false, dialog, busy = false;
  const status = el('p', '', { role: 'status', class: 'module-message' }); const slot = el('div', '', { class: 'stack' });
  const redirectTo = new URL('activate.html', PUBLIC_SITE).href;
  const invite = button('+ Invite Content Admin', () => {
    dialog = editorDialog({ title: 'Invite Content Admin', fields: [{ key: 'email', type: 'email', required: true }, { key: 'displayName', label: 'Full name', required: true }], description: 'This sends an invitation email through the existing account backend. The production activation URL must be allowed in Supabase Auth.', saveLabel: 'Send invitation',
      onSave: values => services.editors.invite({ ...values, redirectTo }), afterSave: () => { if (!disposed) { status.textContent = 'Invitation request completed.'; return load(); } },
    });
  }, true);
  heading(root, 'Content Admin accounts', 'Review access requests and manage content permissions. Your existing System Admin account is unchanged.', [invite]); root.append(status, slot);
  async function action(prompt, operation) {
    if (busy || !confirm(prompt)) return; busy = true; root.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { await operation(); if (!disposed && isCurrent()) { status.textContent = 'Account action completed.'; await load(); } }
    catch (error) { if (!disposed && isCurrent()) status.textContent = error.message; }
    finally { busy = false; if (!disposed) root.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }
  async function load() {
    try {
      const data = await services.editors.list(); if (disposed || !isCurrent()) return; slot.replaceChildren();
      const accounts = (data.content_admins || data.editors || []).filter(row => row.role !== 'admin');
      slot.append(el('h3', 'Current Content Admins'), recordTable(accounts, [{ key: 'display_name', label: 'Name' }, { key: 'email' }, { key: 'is_active', label: 'Access', render: row => badge(row.is_active ? 'Active' : 'Disabled', row.is_active ? 'good' : 'warning') }], row => [
        button(row.is_active ? 'Disable' : 'Enable', () => action(`${row.is_active ? 'Disable' : 'Enable'} access for ${row.email}?`, () => services.editors.setActive(row.user_id || row.id, !row.is_active))),
        button('Remove account', () => { const typed = prompt(`Permanently remove Content Admin ${row.email}? Type the exact email to confirm.`); if (typed !== null) action(`Confirm permanent removal of ${row.email}?`, () => services.editors.remove(row.user_id || row.id, row.email, typed)); }),
      ]));
      slot.append(el('h3', 'Applications'), recordTable(data.applications || [], [{ key: 'display_name', label: 'Name' }, { key: 'email' }, { key: 'status', render: row => badge(row.status) }, { key: 'submitted_at', render: row => dateText(row.submitted_at || row.created_at) }], row => row.status === 'pending' ? [
        button('Approve & invite', () => action(`Approve ${row.email} and send the activation invitation?`, () => services.editors.approve(row.id, redirectTo))),
        button('Reject', () => action(`Reject the application from ${row.email}?`, () => services.editors.reject(row.id))),
      ] : []));
    } catch (error) { if (!disposed && isCurrent()) status.textContent = error.message; }
  }
  load(); const cleanup = () => { disposed = true; dialog?.(); }; cleanup.canLeave = () => !busy && (!dialog?.canLeave || dialog.canLeave()); return cleanup;
}
