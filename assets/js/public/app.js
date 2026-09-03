/**
 * Purpose: show the selected public layout using only existing published Supabase records.
 * Depends on: service container, shared design renderers/runtime, cover watcher, and hash router.
 * Debug: section failures are visible; cover refreshes read the existing dashboard record only.
 */
import { getServices } from '../core/services.js';
import { CONTENT } from '../data/contracts.js';
import { element as el } from '../core/dom.js';
import { startRouter } from '../core/router.js';
import { watchDesign } from '../design/runtime.js';
import { beginDesignLoad, designFailed } from '../design/boot.js';
import { presetDesign } from '../design/model.js';
import { publicHome, publicHeader, publicFooter, contentCard, SECTIONS } from '../design/public-renderer.js';
import { watchAvailability, maintenanceSurface } from './availability.js';
import { watchCovers } from './carousel.js';

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
  const showHome = () => { homeCleanup?.(); const home = publicHome(settings, homeData, config, { errors: homeErrors, covers }); root.replaceChildren(home); homeCleanup = home.dispose; };
  const cleanup = () => { disposed = true; stopAvailability?.(); stopCovers?.(); stopRouter?.(); stopDesign?.(); homeCleanup?.(); };
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
          if (!Object.hasOwn(CONTENT, route)) throw new Error('Page not found. Choose a public information page from the navigation.');
          let page = 0;
          const query = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
          const shell = el('div', '', { class: 'public-surface' });
          const main = el('main', '', { id: 'public-main', tabindex: '-1', class: 'container page-content' });
          main.append(el('h1', SECTIONS[route][1], { class: 'page-heading' }));
          if (route === 'services') main.append(el('p', 'Service information only. This website does not collect online payments. Complete any required transaction directly at the Barangay Hall and request an official receipt.', { class: 'notice service-payment-notice' }));
          const summary = el('p', '', { role: 'status', class: 'muted' });
          const cards = el('div', '', { class: 'cards' });
          const more = el('button', 'Load more', { type: 'button' });
          if (route === 'services') {
            const search = el('form', '', { role: 'search', class: 'service-search' });
            search.append(el('label', 'Search service names', { for: 'service-filter', class: 'sr-only' }), el('input', '', { id: 'service-filter', name: 'q', type: 'search', value: query, maxlength: 100, placeholder: 'Search service names…' }), el('button', 'Search', { type: 'submit', class: 'primary' }));
            search.addEventListener('submit', event => { event.preventDefault(); location.hash = 'services?q=' + encodeURIComponent(search.elements.q.value.trim()); }); main.append(search);
          }
          main.append(summary, cards, more); shell.append(publicHeader(settings, route), main, publicFooter(settings)); root.replaceChildren(shell);
          const load = async () => {
            more.disabled = true;
            try {
              // The route already checked its first page; subsequent loads recheck explicitly.
              if (page > 0) {
                const currentSettings = await stopAvailability.refresh();
                if (!isCurrent() || !currentSettings || currentSettings.maintenance_mode) return;
              }
              const data = await services.content.list(route, { publicOnly: true, page, search: route === 'services' ? query : '' });
              if (!isCurrent()) return;
              data.rows.forEach(row => cards.append(contentCard(route, row)));
              if (page === 0 && !data.rows.length) cards.append(el('p', query ? 'No matching published services.' : 'No published records in this section yet.', { class: 'empty' }));
              page++; summary.textContent = data.count + ' published ' + (query ? 'matching ' : '') + 'records'; more.hidden = page * 50 >= data.count;
            } finally { more.disabled = false; }
          };
          more.addEventListener('click', () => load().catch(error => { if (isCurrent()) status.textContent = 'Could not load more: ' + error.message; }));
          await load();
        }
        if (isCurrent()) { document.title = (route === 'home' ? 'Home' : CONTENT[route].label) + ' — Barangay ' + settings.barangay_name; status.textContent = ''; }
        if (route === 'home') {
          const ownedCleanup = homeCleanup;
          return () => { ownedCleanup?.(); if (homeCleanup === ownedCleanup) homeCleanup = undefined; };
        }
      } catch (error) {
        if (!isCurrent()) return;
        status.textContent = error.message;
        if (!Object.hasOwn(CONTENT, route) && route !== 'home') root.replaceChildren(publicHeader(settings), el('p', error.message, { class: 'container notice' }));
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
    root.replaceChildren(el('a', 'Retry', { href: 'index.html', class: 'button' }), el('a', 'Staff login', { href: 'login.html', class: 'button' }));
  }
  return cleanup;
}
if (typeof document !== 'undefined' && document.querySelector('#public-root')) {
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', startPublicPage, { once: true });
  else startPublicPage();
  // Back/Forward cache restores a stopped page: hide cached content and recheck availability.
  window.addEventListener('pageshow', event => { if (event.persisted) { document.querySelector('#public-root').replaceChildren(); startPublicPage(); } });
}
