/**
 * Purpose: role-separated staff shells with live editing, analysis, QR tools and Design Studio.
 * Depends on: existing Auth/RLS services, route modules and the shared central stylesheet.
 * Debug: access is rechecked on every route/write; stale views are disposed before navigation.
 */
import { getServices } from '../core/services.js';
import { getClient } from '../core/client.js';
import { CONTENT } from '../data/contracts.js';
import { element as el } from '../core/dom.js';
import { startRouter } from '../core/router.js';
import { applyDesign, watchDesign } from '../design/runtime.js';
import { designFailed } from '../design/boot.js';
import { mountStudio } from '../design/studio.js';
import { mountContent } from './content-screen.js';
import { mountDashboard, mountUsage } from './dashboard.js';
import { mountSettings, mountCovers } from './settings-screen.js';
import { mountAccounts } from './accounts-screen.js';

/** Verify an active database profile before revealing any staff navigation or private records. */
export async function startWorkspace(workspace) {
  const status = document.querySelector('#status'), view = document.querySelector('#view');
  const nav = document.querySelector('#navigation'), identity = document.querySelector('#identity');
  const signout = document.querySelector('#signout'), isAdmin = workspace === 'admin';
  let services, stopRouter, currentCleanup;
  document.querySelector('a[href="#main"]')?.addEventListener('click', event => { event.preventDefault(); document.querySelector('#main').focus(); });
  function lock(message) {
    stopRouter?.(); currentCleanup?.(); nav.hidden = true; signout.hidden = true;
    identity.textContent = 'Staff access required'; view.replaceChildren();
    status.textContent = message;
    // Login accepts only fixed, role-appropriate module names; it never redirects to external URLs.
    view.append(el('a', 'Sign in with your existing account →', { href: '../login.html?next=' + encodeURIComponent(location.hash.slice(1)), class: 'button primary' }));
  }
  try {
    services = getServices();
    const stopDesign = await watchDesign(services.design); window.addEventListener('pagehide', stopDesign, { once: true });
    const staff = await services.auth.requireStaff(isAdmin ? ['admin'] : ['admin', 'editor']);
    identity.textContent = staff.profile.display_name || staff.user.email;
    signout.hidden = false;
    const routes = [['dashboard', 'Overview', '◫'], ...Object.entries(CONTENT).map(([key, def], i) => [key, def.label, ['▤', '◇', '♙', '☷', '▧', '⇩', '▣', '▥'][i]])];
    if (isAdmin) routes.push(['verification', 'ID records & QR', '▦'], ['covers', 'Cover photos', '▣'], ['design-studio', 'Design Studio', '◈'], ['settings', 'Page settings', '⚙'], ['editors', 'Content Admins', '♙'], ['usage', 'System status & usage', '◷']);
    nav.replaceChildren();
    const navBrand = el('div', '', { class: 'nav-brand' }); navBrand.append(el('span', 'B', { class: 'nav-mark', 'aria-hidden': 'true' }), el('strong', 'Barangay workspace'), el('small', isAdmin ? 'SYSTEM ADMIN' : 'CONTENT ADMIN')); nav.append(navBrand);
    const list = el('ul');
    routes.forEach(([key, label, glyph], index) => {
      if (index === 1 || (isAdmin && key === 'verification')) { const group = el('li', index === 1 ? 'PUBLIC CONTENT' : 'SYSTEM MANAGEMENT', { class: 'nav-group' }); list.append(group); }
      const li = el('li'), link = el('a', '', { href: '#' + key }); link.append(el('span', glyph, { class: 'nav-icon', 'aria-hidden': 'true' }), el('span', label)); li.append(link); list.append(li);
    });
    nav.append(list, el('p', 'Existing data. Clearer controls.', { class: 'nav-footnote' })); nav.hidden = false;
    const menu = el('button', '☰ Modules', { type: 'button', class: 'menu-toggle', 'aria-controls': 'navigation', 'aria-expanded': 'false' });
    const closeMenu = () => { document.body.classList.remove('nav-open'); menu.setAttribute('aria-expanded', 'false'); };
    menu.addEventListener('click', () => { const open = document.body.classList.toggle('nav-open'); menu.setAttribute('aria-expanded', String(open)); });
    document.querySelector('.workspace-header').prepend(menu); nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
    signout.addEventListener('click', async () => {
      if (currentCleanup?.canLeave && !currentCleanup.canLeave()) return;
      signout.disabled = true;
      try { await services.auth.signOut(); lock('Signed out.'); location.replace('../login.html'); }
      catch (error) { status.textContent = error.message; signout.disabled = false; }
    });
    getClient().auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') lock('Signed out.'); });
    stopRouter = startRouter(async (route, isCurrent) => {
      const item = routes.find(([key]) => key === route); view.replaceChildren(); currentCleanup = null;
      document.querySelector('#workspace-title').hidden = true;
      if (!item) { status.textContent = 'Module not found.'; return; }
      document.title = item[1] + ' — BRGYWEBLITEV3';
      nav.querySelectorAll('a').forEach(link => { if (link.hash === '#' + route) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
      status.textContent = 'Checking workspace access…';
      try {
        // Role visibility is a convenience; the service and existing RLS remain authoritative.
        await services.auth.requireStaff(isAdmin ? ['admin'] : ['admin', 'editor']);
        if (!isCurrent()) return; status.textContent = '';
        if (route === 'design-studio') {
          const snapshot = await services.design.read(); if (!isCurrent()) return;
          // Reuse the existing Dashboard cover record in the isolated preview; no media is copied or saved here.
          const previewCovers = await services.covers.read().then(value => value.slides).catch(() => []);
          if (!isCurrent()) return;
          const studio = el('div', '', { class: 'studio-wrap' }); view.append(studio);
          currentCleanup = mountStudio(studio, { snapshot, service: services.design, previewUrl: '../preview.html', previewCovers, onPublished: applyDesign });
        } else if (route === 'dashboard') currentCleanup = mountDashboard(view, services, isAdmin, isCurrent);
        else if (route === 'usage') currentCleanup = mountUsage(view, services, isCurrent);
        else if (route === 'settings') currentCleanup = mountSettings(view, services, isCurrent);
        else if (route === 'covers') currentCleanup = mountCovers(view, services, isCurrent);
        else if (route === 'editors') currentCleanup = mountAccounts(view, services, isCurrent);
        else currentCleanup = mountContent(view, route, services, isCurrent);
        return currentCleanup;
      } catch (error) {
        if (!isCurrent()) return;
        if (error.code === 'STAFF_ACCESS_REQUIRED') lock(error.message);
        else status.textContent = 'Unable to load: ' + error.message;
      }
    });
  } catch (error) { if (!services) designFailed(); lock(error.message || 'Unable to verify your staff account.'); }
}
