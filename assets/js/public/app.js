/**
 * Purpose: show the selected public layout using only existing published Supabase records.
 * Depends on: service container, shared design renderers/runtime, cover watcher, and hash router.
 * Debug: section failures are visible; cover refreshes read the existing dashboard record only.
 */
import { getServices } from '../core/services.js';
import { CONTENT, DIRECTORY_GROUPS } from '../data/contracts.js';
import { element as el, safeLink } from '../core/dom.js';
import { startRouter } from '../core/router.js';
import { watchDesign } from '../design/runtime.js';
import { beginDesignLoad, designFailed } from '../design/boot.js';
import { presetDesign } from '../design/model.js';
import { publicHome, publicHeader, publicFooter, contentCard } from '../design/public-renderer.js';
import { watchAvailability, maintenanceSurface } from './availability.js';
import { watchCovers } from './carousel.js';
import { installPhotoViewer } from './photo-viewer.js';

const PUBLIC_ROUTES = Object.freeze({
  announcements: { table: 'announcements', title: 'News & Updates' },
  services: { table: 'services', title: 'Barangay Services' },
  appointment: { table: 'services', title: 'Request Appointment', search: 'appointment', intro: 'Read the published appointment instructions, then contact the Barangay Hall through the official details below. This page does not collect payments.' },
  forms: { table: 'forms', title: 'Downloadable Forms' },
  contact: { title: 'Contact Us', contact: true },
  pages: { table: 'pages', title: 'Barangay Profile', intro: 'Published barangay profile and development information based on the BDP 2026.' },
  officials: { table: 'officials', title: 'Barangay Officials' },
  staff: { table: 'directory_entries', title: 'Barangay Staff', categories: DIRECTORY_GROUPS.staff, alphabetical: true, grouped: true, intro: 'Published personnel assigned to the Barangay Local Government Unit.' },
  functionaries: { table: 'directory_entries', title: 'Barangay Functionaries', categories: DIRECTORY_GROUPS.functionaries, alphabetical: true, grouped: true, intro: 'Published BHW, BNS, Tanod, DCW, Lupon, monitoring, enforcement, and sectoral functionaries.' },
  disclosures: { table: 'disclosures', title: 'Transparency & Reports' },
  gallery_items: { table: 'gallery_items', title: 'Community Gallery' },
  directory_entries: { table: 'directory_entries', title: 'Contact Directory' },
});
const publicRoute = route => PUBLIC_ROUTES[route] || null;

/** Maintenance and published flags stay authoritative regardless of the selected theme. */
export async function startPublicPage({ services: injectedServices } = {}) {
  // Also re-arm after a Back/Forward-cache restore before rechecking the published design.
  beginDesignLoad();
  const root = document.querySelector('#public-root');
  const status = document.querySelector('#status');
  let config = presetDesign();
  let settings;
  let homeData;
  let currentRoute;
  let homeErrors = {};
  let covers = [], homeCleanup;
  let stopAvailability, stopCovers, stopRouter, stopDesign, disposed = false;
  const stopPhotoViewer = installPhotoViewer(root);
  const showHome = () => { homeCleanup?.(); const home = publicHome(settings, homeData, config, { errors: homeErrors, covers }); root.replaceChildren(home); homeCleanup = home.dispose; };
  const cleanup = () => { disposed = true; stopAvailability?.(); stopCovers?.(); stopRouter?.(); stopDesign?.(); homeCleanup?.(); stopPhotoViewer(); };
  window.addEventListener('pagehide', cleanup, { once: true });
  try {
    const services = injectedServices || getServices();
    stopCovers = watchCovers(services.covers, next => {
      covers = next;
      // Rebuild only the active homepage; its prior carousel timer is disposed by showHome().
      if (settings?.maintenance_mode === false && currentRoute === 'home' && homeData) showHome();
    });
    document.querySelector('.skip-link')?.addEventListener('click', event => { event.preventDefault(); document.querySelector('#public-main')?.focus(); });
    const openPublic = () => { stopRouter = startRouter(async (route, isCurrent) => {
      // Each public navigation checks availability before requesting any content rows.
      const latest = await stopAvailability.refresh();
      if (!isCurrent() || !latest || latest.maintenance_mode) return;
      homeCleanup?.(); homeCleanup = undefined;
      currentRoute = route; status.textContent = 'Loading published information…';
      try {
        if (route === 'home') {
          // Always start from the dashboard's current saved cover record; no hardcoded hero path.
          homeData = null;
          try { covers = await stopCovers.refresh(); if (!isCurrent()) return; }
          catch { covers = []; }
          if (!isCurrent()) return;
          const results = await Promise.all(Object.keys(CONTENT).map(async table => {
            try { return { table, data: await services.content.list(table, { publicOnly: true, pageSize: 3 }) }; }
            catch { return { table, error: true }; }
          }));
          if (!isCurrent()) return;
          homeData = {}; homeErrors = {};
          results.forEach(({ table, data, error }) => { homeData[table] = data?.rows || []; if (error) homeErrors[table] = true; });
          showHome();
        } else {
          const routeInfo = publicRoute(route);
          if (!routeInfo) throw new Error('Page not found. Choose a public information page from the navigation.');
          const shell = el('div', '', { class: 'public-surface' });
          const main = el('main', '', { id: 'public-main', tabindex: '-1', class: 'container page-content' });
          main.append(el('h1', routeInfo.title, { class: 'page-heading' }));
          if (routeInfo.intro) main.append(el('p', routeInfo.intro, { class: 'page-intro muted' }));
          if (routeInfo.contact) {
            const panel = el('section', '', { class: 'contact-panel dashboard-panel' });
            panel.append(el('h2', 'Barangay Hall contact details'));
            const details = [
              ['Address', settings.address || [settings.barangay_name, settings.municipality_city, settings.province].filter(Boolean).join(', ')],
              ['Contact number', settings.contact_number],
              ['Email', settings.email],
            ].filter(([, value]) => value);
            details.forEach(([label, value]) => { const row = el('div', '', { class: 'setting-row' }); row.append(el('small', label), el('p', value)); panel.append(row); });
            if (settings.facebook_url) panel.append(safeLink(settings.facebook_url, 'Open official Facebook page ↗'));
            if (!details.length && !settings.facebook_url) panel.append(el('p', 'Contact information has not been published yet.', { class: 'empty' }));
            main.append(panel); shell.append(publicHeader(settings, route), main, publicFooter(settings)); root.replaceChildren(shell);
          } else {
          let page = 0;
          const query = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
          if (route === 'services') main.append(el('p', 'Service information only. This website does not collect online payments. Complete any required transaction directly at the Barangay Hall and request an official receipt.', { class: 'notice service-payment-notice' }));
          const summary = el('p', '', { role: 'status', class: 'muted' });
          const cards = el('div', '', { class: routeInfo.grouped ? 'directory-groups' : 'cards' });
          const groups = new Map();
          const more = el('button', 'Load more', { type: 'button' });
          if (route === 'services') {
            const search = el('form', '', { role: 'search', class: 'service-search' });
            search.append(el('label', 'Search service names', { for: 'service-filter', class: 'sr-only' }), el('input', '', { id: 'service-filter', name: 'q', type: 'search', value: query, maxlength: 100, placeholder: 'Search service names…' }), el('button', 'Search', { type: 'submit', class: 'primary' }));
            search.addEventListener('submit', event => { event.preventDefault(); location.hash = 'services?q=' + encodeURIComponent(search.elements.q.value.trim()); }); main.append(search);
          }
          main.append(summary, cards, more); shell.append(publicHeader(settings, route), main, publicFooter(settings)); root.replaceChildren(shell);
          const appendRow = row => {
            if (!routeInfo.grouped) { cards.append(contentCard(routeInfo.table, row)); return; }
            const category = row.category || 'Other';
            let group = groups.get(category);
            if (!group) {
              const section = el('section', '', { class: 'directory-group' });
              group = el('div', '', { class: 'cards' }); section.append(el('h2', category), group);
              groups.set(category, group); cards.append(section);
            }
            group.append(contentCard(routeInfo.table, row));
          };
          const load = async () => {
            more.disabled = true;
            try {
              // The route already checked its first page; subsequent loads recheck explicitly.
              if (page > 0) {
                const currentSettings = await stopAvailability.refresh();
                if (!isCurrent() || !currentSettings || currentSettings.maintenance_mode) return;
              }
              const searchValue = routeInfo.search || (route === 'services' ? query : '');
              const data = await services.content.list(routeInfo.table, { publicOnly: true, page, search: searchValue, categories: routeInfo.categories || [], alphabetical: routeInfo.alphabetical === true });
              if (!isCurrent()) return;
              data.rows.forEach(appendRow);
              if (page === 0 && !data.rows.length) cards.append(el('p', route === 'appointment' ? 'Appointment instructions have not been published yet. Please use the Contact Us page to reach the Barangay Hall.' : query ? 'No matching published services.' : 'No published records in this section yet.', { class: 'empty' }));
              page++; summary.textContent = data.count + ' published ' + ((query || routeInfo.search) ? 'matching ' : '') + 'records'; more.hidden = page * 50 >= data.count;
            } finally { more.disabled = false; }
          };
          more.addEventListener('click', () => load().catch(error => { if (isCurrent()) status.textContent = 'Could not load more: ' + error.message; }));
          await load();
          }
        }
        if (isCurrent()) { document.title = (route === 'home' ? 'Home' : publicRoute(route).title) + ' — Barangay ' + settings.barangay_name; status.textContent = ''; }
        if (route === 'home') {
          const ownedCleanup = homeCleanup;
          return () => { ownedCleanup?.(); if (homeCleanup === ownedCleanup) homeCleanup = undefined; };
        }
      } catch (error) {
        if (!isCurrent()) return;
        status.textContent = error.message;
        if (!publicRoute(route) && route !== 'home') root.replaceChildren(publicHeader(settings), el('p', error.message, { class: 'container notice' }));
      }
    }, 'home'); };
    stopAvailability = watchAvailability(services.settings, (next, error) => {
      // Stopping the router invalidates in-flight content responses before hiding the old view.
      stopRouter?.(); stopRouter = undefined; homeCleanup?.(); homeCleanup = undefined;
      currentRoute = undefined; homeData = null; settings = next; root.replaceChildren(); status.textContent = '';
      if (!next || next.maintenance_mode) {
        root.replaceChildren(maintenanceSurface(next || {}, { error, retry: () => stopAvailability.refresh() }));
        document.title = next ? 'Maintenance — Barangay ' + next.barangay_name : 'Website temporarily unavailable';
      } else openPublic();
    });
    await stopAvailability.refresh();
    if (disposed) return;
    stopDesign = await watchDesign(services.design, (next, error) => {
      if (disposed) return;
      if (next) config = next;
      if (error) status.textContent = 'The saved design could not load. Reload this page to try again.';
      // A late theme response must never put public content back over a maintenance notice.
      if (settings?.maintenance_mode === false && currentRoute === 'home' && homeData) showHome();
    });
    if (disposed) stopDesign();
  } catch (error) {
    if (disposed) return;
    designFailed();
    status.textContent = 'Unable to load barangay information: ' + error.message;
    root.replaceChildren(el('a', 'Retry', { href: 'index.html', class: 'button' }), el('a', 'Admin Portal', { href: 'login.html', class: 'button' }));
  }
  return cleanup;
}
if (typeof document !== 'undefined' && document.querySelector('#public-root')) {
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', startPublicPage, { once: true });
  else startPublicPage();
  // Back/Forward cache restores a stopped page: hide cached content and recheck availability.
  window.addEventListener('pageshow', event => { if (event.persisted) { document.querySelector('#public-root').replaceChildren(); startPublicPage(); } });
}
