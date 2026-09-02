/**
 * Purpose: show the selected public layout using only existing published Supabase records.
 * Depends on: service container, shared design renderers/runtime, and hash router.
 * Debug: section failures are visible; sample data is never loaded by this entry point.
 */
import { getServices } from '../core/services.js';
import { CONTENT } from '../data/contracts.js';
import { element as el } from '../core/dom.js';
import { startRouter } from '../core/router.js';
import { watchDesign } from '../design/runtime.js';
import { presetDesign } from '../design/model.js';
import { publicHome, publicHeader, publicFooter, contentCard, SECTIONS } from '../design/public-renderer.js';

/** Maintenance and published flags stay authoritative regardless of the selected theme. */
async function start() {
  const root = document.querySelector('#public-root');
  const status = document.querySelector('#status');
  let config = presetDesign();
  let settings;
  let homeData;
  let currentRoute;
  let homeErrors = {};
  let covers = [], homeCleanup;
  const showHome = () => { homeCleanup?.(); const home = publicHome(settings, homeData, config, { errors: homeErrors, covers }); root.replaceChildren(home); homeCleanup = home.dispose; };
  try {
    const services = getServices();
    settings = await services.settings.read();
    const stopDesign = await watchDesign(services.design, (next, error) => {
      if (next) config = next;
      if (error) status.textContent = 'Design unavailable. Showing default appearance; existing content is unchanged.';
      if (currentRoute === 'home' && homeData) showHome();
    });
    window.addEventListener('pagehide', stopDesign, { once: true });
    if (settings.maintenance_mode) {
      const main = el('main', '', { class: 'container page-content' });
      main.append(el('h1', settings.maintenance_title || 'Under maintenance', { class: 'page-heading' }), el('p', settings.maintenance_message || 'Please check back later.'), el('a', 'Staff login', { href: 'login.html', class: 'button' }));
      root.replaceChildren(main); status.textContent = ''; return;
    }
    document.querySelector('.skip-link')?.addEventListener('click', event => { event.preventDefault(); document.querySelector('#public-main')?.focus(); });
    startRouter(async (route, isCurrent) => {
      homeCleanup?.(); homeCleanup = undefined;
      currentRoute = route; status.textContent = 'Loading published information…';
      try {
        if (route === 'home') {
          try { const saved = await services.covers.read(); if (!isCurrent()) return; covers = saved.slides; }
          catch { covers = []; }
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
        if (route === 'home') return () => { homeCleanup?.(); homeCleanup = undefined; };
      } catch (error) {
        if (!isCurrent()) return;
        status.textContent = error.message;
        if (!Object.hasOwn(CONTENT, route) && route !== 'home') root.replaceChildren(publicHeader(settings), el('p', error.message, { class: 'container notice' }));
      }
    }, 'home');
  } catch (error) {
    status.textContent = 'Unable to load barangay information: ' + error.message;
    root.replaceChildren(el('a', 'Retry', { href: 'index.html', class: 'button' }), el('a', 'Staff login', { href: 'login.html', class: 'button' }));
  }
}
if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
