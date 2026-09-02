/**
 * Purpose: shared staff data screens and admin-only Design Studio publishing.
 * Depends on: shell element IDs, router.js, DOM helpers, and the data service modules.
 * Debug: #status shows load errors; follow the active route to the service call below.
 * Scope: content/account lists stay read-only; only Design Studio explicitly saves appearance.
 */
import { getServices } from '../core/services.js';
import { getClient } from '../core/client.js';
import { CONTENT, SETTINGS_FIELDS, VERIFICATION_FIELDS } from '../data/contracts.js';
import { element, showRecords } from '../core/dom.js';
import { startRouter } from '../core/router.js';
import { applyDesign, watchDesign } from '../design/runtime.js';
import { mountStudio } from '../design/studio.js';

/** Verify access before exposing navigation or loading private records. */
export async function startWorkspace(workspace) {
  const status = document.querySelector('#status');
  const view = document.querySelector('#view');
  const nav = document.querySelector('#navigation');
  const identity = document.querySelector('#identity');
  const signout = document.querySelector('#signout');
  document.querySelector('a[href="#main"]')?.addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('#main').focus();
  });
  let services;
  let stopRouter;
  /** Clear visible private data and invalidate in-flight route renders on sign-out/denial. */
  function lock(message) {
    stopRouter?.();
    nav.hidden = true;
    identity.textContent = 'Staff access required';
    signout.hidden = true;
    view.replaceChildren();
    status.textContent = message;
    view.append(element('a', 'Sign in with your existing account', { href: '../login.html' }));
  }
  try {
    services = getServices();
    const stopDesign = await watchDesign(services.design);
    window.addEventListener('pagehide', stopDesign, { once: true });
    const staff = await services.auth.requireStaff(workspace === 'admin' ? ['admin'] : ['admin', 'editor']);
    identity.textContent = `${staff.profile.display_name || staff.user.email} · ${staff.profile.role === 'admin' ? 'System Admin' : 'Content Admin'}`;
    signout.hidden = false;
    // Shared content routes do not grant access to admin-only records/settings/actions.
    const routes = [['dashboard', 'Dashboard'], ...Object.entries(CONTENT).map(([key, def]) => [key, def.label])];
    if (workspace === 'admin') routes.push(['design-studio', 'Design Studio'], ['verification', 'Verification Records'], ['settings', 'Site Settings'], ['editors', 'Content Admin Accounts']);
    const list = element('ul');
    routes.forEach(([key, label]) => { const item = element('li'); item.append(element('a', label, { href: `#${key}` })); list.append(item); });
    nav.append(list);
    nav.hidden = false;
    signout.addEventListener('click', async () => {
      signout.disabled = true;
      try { await services.auth.signOut(); lock('Signed out.'); location.replace('../login.html'); }
      catch (error) { status.textContent = error.message; signout.disabled = false; }
    });
    getClient().auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') lock('Signed out.');
    });

    // Every async result checks isCurrent() so old requests cannot repaint another view.
    stopRouter = startRouter(async (route, isCurrent) => {
      const item = routes.find(([key]) => key === route);
      document.querySelector('#workspace-title').hidden = route === 'design-studio';
      view.replaceChildren();
      if (!item) { status.textContent = 'Module not found.'; return; }
      document.title = `${item[1]} — BRGYWEBLITEV3`;
      nav.querySelectorAll('a').forEach(link => {
        if (link.hash === `#${route}`) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      status.textContent = 'Reading existing Supabase data…';
      try {
        // Recheck the live profile on every navigation; no cached role grants access.
        await services.auth.requireStaff(workspace === 'admin' ? ['admin'] : ['admin', 'editor']);
        if (!isCurrent()) return;
        if (route === 'design-studio') {
          const snapshot = await services.design.read();
          if (!isCurrent()) return;
          status.textContent = '';
          const studioRoot = element('div', '', { class: 'studio-wrap' }); view.append(studioRoot);
          return mountStudio(studioRoot, { snapshot, service: services.design, previewUrl: '../preview.html', onPublished: applyDesign });
        }
        view.append(element('h2', item[1]));
        view.append(element('p', 'Read-only connection check. Walang ise-save, buburahin, o papalitang data mula sa screen na ito.'));
        if (route === 'dashboard') {
          const counts = await services.content.counts();
          if (!isCurrent()) return;
          view.append(showRecords(counts, ['label', 'count', 'error']));
        } else if (route === 'settings') {
          const settings = await services.settings.read();
          if (!isCurrent()) return;
          view.append(showRecords(SETTINGS_FIELDS.map(key => ({ field: key, value: settings[key] })), ['field', 'value']));
        } else if (route === 'editors') {
          const data = await services.editors.list();
          if (!isCurrent()) return;
          view.append(showRecords(data.content_admins || data.editors || [], ['display_name', 'email', 'is_active']));
          view.append(element('h3', 'Applications'));
          view.append(showRecords(data.applications || [], ['display_name', 'email', 'status', 'submitted_at']));
        } else {
          let page = 0;
          let request = 0;
          const tableSlot = element('div');
          const summary = element('p');
          const previous = element('button', 'Previous', { type: 'button' });
          const next = element('button', 'Next', { type: 'button' });
          view.append(summary, tableSlot, previous, next);
          const fields = route === 'verification' ? VERIFICATION_FIELDS : CONTENT[route].fields;
          /** Keep page state only after success; ignore responses from superseded requests. */
          async function loadPage(target) {
            const sequence = ++request;
            previous.disabled = next.disabled = true;
            try {
              const data = route === 'verification' ? await services.verification.list({ page: target }) : await services.content.list(route, { page: target });
              if (!isCurrent() || sequence !== request) return;
              page = target;
              tableSlot.replaceChildren(showRecords(data.rows, fields));
              summary.textContent = `${data.count} total records · Page ${page + 1}`;
              previous.disabled = page === 0;
              next.disabled = (page + 1) * 50 >= data.count;
            } catch (error) {
              if (!isCurrent()) return;
              status.textContent = error.message;
              previous.disabled = page === 0;
              next.disabled = false;
              throw error;
            }
          }
          previous.addEventListener('click', () => loadPage(Math.max(0, page - 1)).catch(() => {}));
          next.addEventListener('click', () => loadPage(page + 1).catch(() => {}));
          await loadPage(0);
        }
        if (isCurrent()) status.textContent = 'Loaded from the existing BRGYWEB-LITE project.';
      } catch (error) {
        if (!isCurrent()) return;
        if (error.code === 'STAFF_ACCESS_REQUIRED') lock(error.message);
        else status.textContent = `Unable to load: ${error.message}`;
      }
    });
  } catch (error) { lock(error.message || 'Unable to verify your staff account.'); }
}
