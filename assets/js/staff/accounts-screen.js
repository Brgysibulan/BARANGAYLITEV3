/**
 * Purpose: manage Content Admin accounts and applications with in-page confirmation dialogs.
 * Depends on: manage-editors service and server-side authorization; no Auth admin keys.
 * Debug: function errors appear in the screen; System Admin accounts are never offered as targets.
 */
import { element as el } from '../core/dom.js';
import { heading, button, badge, recordTable, dateText } from './ui.js';
import { PUBLIC_SITE } from '../data/id-model.js';

export function mountAccounts(root, services, isCurrent) {
  let disposed = false, dialog = null, busy = false;
  const status = el('p', '', { role: 'status', class: 'module-message' });
  const slot = el('div', '', { class: 'stack' });
  const redirectTo = new URL('activate.html', PUBLIC_SITE).href;

  // Standalone invitations were intentionally removed. New Content Admins must apply first,
  // then the System Admin can approve the application from the list below.
  heading(root, 'Content Admin accounts', 'Review access requests and manage content permissions. Your existing System Admin account is unchanged.');
  root.append(status, slot);

  function closeDialog() {
    if (!dialog) return;
    dialog.close();
    dialog.remove();
    dialog = null;
  }

  function confirmAction({ title, description, confirmLabel = 'Confirm', requireEmail = '', operation, success = 'Account action completed.' }) {
    if (busy || dialog) return;
    const modal = el('dialog', '', { class: 'edit-dialog', 'aria-label': title });
    const form = el('form', '', { class: 'editor-form' });
    const message = el('p', '', { role: 'status', 'aria-live': 'polite', class: 'form-message' });
    const actions = el('div', '', { class: 'form-actions field-wide' });
    const cancel = button('Cancel', () => closeDialog());
    const submit = el('button', confirmLabel, { type: 'submit', class: 'primary' });
    let emailInput = null;

    modal.append(el('div', '', { class: 'dialog-heading' }));
    modal.querySelector('.dialog-heading').append(el('h2', title));
    if (description) modal.append(el('p', description, { class: 'muted' }));

    if (requireEmail) {
      const field = el('div', '', { class: 'field field-wide' });
      const id = 'confirm-admin-email';
      emailInput = el('input', '', { id, name: 'confirmation', type: 'email', autocomplete: 'off', required: true });
      field.append(
        el('label', `Type ${requireEmail} to confirm`, { for: id }),
        emailInput,
        el('small', 'This permanently removes the selected Content Admin account from Supabase Auth and its editor profile.')
      );
      form.append(field);
    }

    actions.append(cancel, submit);
    form.append(message, actions);
    modal.append(form);
    document.body.append(modal);
    dialog = modal;

    modal.addEventListener('cancel', event => {
      event.preventDefault();
      if (!busy) closeDialog();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const typed = emailInput?.value?.trim() || '';
      if (requireEmail && typed.toLowerCase() !== requireEmail.trim().toLowerCase()) {
        message.textContent = 'Email confirmation did not match.';
        message.setAttribute('role', 'alert');
        return;
      }
      busy = true;
      form.querySelectorAll('input,button').forEach(node => { node.disabled = true; });
      message.textContent = 'Processing…';
      try {
        await operation(typed);
        if (disposed || !isCurrent()) return;
        closeDialog();
        status.textContent = success;
        await load();
      } catch (error) {
        if (!disposed && isCurrent()) {
          message.textContent = error.message || 'Unable to complete this action.';
          message.setAttribute('role', 'alert');
        }
      } finally {
        busy = false;
        if (dialog) form.querySelectorAll('input,button').forEach(node => { node.disabled = false; });
      }
    });

    modal.showModal();
    emailInput?.focus();
  }

  async function load() {
    try {
      const data = await services.editors.list();
      if (disposed || !isCurrent()) return;
      slot.replaceChildren();

      const accounts = (data.content_admins || data.editors || []).filter(row => row.role !== 'admin');
      slot.append(
        el('h3', 'Current Content Admins'),
        recordTable(accounts, [
          { key: 'display_name', label: 'Name' },
          { key: 'email' },
          { key: 'is_active', label: 'Access', render: row => badge(row.is_active ? 'Active' : 'Disabled', row.is_active ? 'good' : 'warning') },
        ], row => [
          button(row.is_active ? 'Disable' : 'Enable', () => confirmAction({
            title: row.is_active ? 'Disable Content Admin' : 'Enable Content Admin',
            description: `${row.is_active ? 'Disable' : 'Enable'} access for ${row.email}?`,
            confirmLabel: row.is_active ? 'Disable' : 'Enable',
            operation: () => services.editors.setActive(row.user_id || row.id, !row.is_active),
          })),
          button('Delete', () => confirmAction({
            title: 'Delete Content Admin',
            description: `Permanently delete ${row.email}. This cannot be undone.`,
            confirmLabel: 'Delete account',
            requireEmail: row.email,
            operation: typed => services.editors.remove(row.user_id || row.id, row.email, typed),
            success: 'Content Admin deleted.',
          })),
        ])
      );

      slot.append(
        el('h3', 'Applications'),
        recordTable(data.applications || [], [
          { key: 'display_name', label: 'Name' },
          { key: 'email' },
          { key: 'status', render: row => badge(row.status) },
          { key: 'submitted_at', render: row => dateText(row.submitted_at || row.created_at) },
        ], row => {
          const actions = [];
          if (row.status === 'pending') {
            actions.push(
              button('Approve & invite', () => confirmAction({
                title: 'Approve Content Admin application',
                description: `Approve ${row.email} and send the activation invitation?`,
                confirmLabel: 'Approve & invite',
                operation: () => services.editors.approve(row.id, redirectTo),
                success: 'Application approved.',
              })),
              button('Reject', () => confirmAction({
                title: 'Reject application',
                description: `Reject the application from ${row.email}?`,
                confirmLabel: 'Reject',
                operation: () => services.editors.reject(row.id),
                success: 'Application rejected.',
              }))
            );
          }
          actions.push(button('Delete', () => confirmAction({
            title: 'Delete application record',
            description: `Delete the application record for ${row.email}? This removes only this application record.`,
            confirmLabel: 'Delete record',
            operation: () => services.editors.deleteApplication(row.id),
            success: 'Application record deleted.',
          })));
          return actions;
        })
      );
    } catch (error) {
      if (!disposed && isCurrent()) status.textContent = error.message;
    }
  }

  load();
  const cleanup = () => {
    disposed = true;
    if (!busy) closeDialog();
  };
  cleanup.canLeave = () => !busy;
  return cleanup;
}
