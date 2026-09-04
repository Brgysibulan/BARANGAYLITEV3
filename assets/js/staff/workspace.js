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
import { mountVisibility } from './visibility-screen.js';
import { mountActivity } from './activity-screen.js';
import { DELEGATED_MODULES } from '../data/permissions.js';

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
    const delegated = await services.permissions.mine(staff);
    const protectedRoutes = [
      ['verification', 'ID records & QR', '▦', 'verification'],
      ['covers', 'Cover photos', '▣', 'covers'],
      ['design-studio', 'Design Studio', '◈', 'design_studio'],
      ['settings', 'Page settings', '⚙', 'page_settings'],
      ['visibility', 'Public visibility', '◉', 'public_visibility'],
      ['usage', 'System status & usage', '◷', 'system_usage'],
    ];
    routes.push(...protectedRoutes.filter(([, , , permission]) => isAdmin || delegated[permission]));
    if (isAdmin) routes.push(['editors', 'Content Admins', '♙'], ['activity', 'Activity & analytics', '◌']);
    nav.replaceChildren();
    const navBrand = el('div', '', { class: 'nav-brand' }); navBrand.append(el('span', 'B', { class: 'nav-mark', 'aria-hidden': 'true' }), el('strong', 'Barangay workspace'), el('small', isAdmin ? 'SYSTEM ADMIN' : 'CONTENT ADMIN')); nav.append(navBrand);
    const list = el('ul');
    let managementGroupAdded = false;
    routes.forEach(([key, label, glyph], index) => {
      if (index === 1) list.append(el('li', 'PUBLIC CONTENT', { class: 'nav-group' }));
      if (!managementGroupAdded && protectedRoutes.some(([route]) => route === key)) {
        list.append(el('li', isAdmin ? 'SYSTEM MANAGEMENT' : 'TEMPORARY ACCESS', { class: 'nav-group' })); managementGroupAdded = true;
      }
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
      try {
        await services.activity.recordStaff('auth.logout', 'authentication', 'Signed out of the staff workspace.').catch(() => {});
        await services.auth.signOut(); lock('Signed out.'); location.replace('../login.html');
      }
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
        // Menu visibility is a convenience; every delegated route is checked again
        // here and inside its data service before protected work is requested.
        const delegatedModule = DELEGATED_MODULES.find(module => module.route === route);
        if (!isAdmin && delegatedModule) await services.auth.requirePermission(delegatedModule.key);
        else await services.auth.requireStaff(isAdmin ? ['admin'] : ['admin', 'editor']);
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
        else if (route === 'visibility') currentCleanup = mountVisibility(view, services, isCurrent);
        else if (route === 'covers') currentCleanup = mountCovers(view, services, isCurrent);
        else if (route === 'editors') currentCleanup = mountAccounts(view, services, isCurrent);
        else if (route === 'activity') currentCleanup = mountActivity(view, services, isCurrent);
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
