/**
 * Purpose: display existing published barangay information without legacy design code.
 * Depends on: index.html, the shared service container, router, and text-safe DOM helpers.
 * Debug: check maintenance_mode first, then the route's publish flag and field contract.
 */
import { getServices } from '../core/services.js';
import { CONTENT } from '../data/contracts.js';
import { element, showRecords } from '../core/dom.js';
import { startRouter } from '../core/router.js';

/** Read site identity first; maintenance blocks public views but not staff login. */
async function start() {
  const status = document.querySelector('#status');
  const view = document.querySelector('#view');
  const nav = document.querySelector('#navigation');
  try {
    const services = getServices();
    const settings = await services.settings.read();
    document.querySelector('#site-name').textContent = settings.barangay_name || 'BRGYWEBLITEV3';
    if (settings.maintenance_mode) {
      status.textContent = settings.maintenance_title || 'Under maintenance';
      view.append(element('p', settings.maintenance_message || 'Please check back later.'));
      return;
    }
    const list = element('ul');
    [['home', 'Home'], ...Object.entries(CONTENT).map(([key, def]) => [key, def.label])].forEach(([key, label]) => {
      const li = element('li'); li.append(element('a', label, { href: `#${key}` })); list.append(li);
    });
    nav.append(list);
    startRouter(async (route, isCurrent) => {
      view.replaceChildren();
      status.textContent = 'Loading published information…';
      try {
        if (route === 'home') {
          view.append(element('h2', settings.hero_title || settings.barangay_name));
          view.append(element('p', settings.hero_text || ''));
          view.append(element('p', [settings.address, settings.contact_number, settings.email].filter(Boolean).join(' · ')));
        } else {
          const def = CONTENT[route];
          if (!def) throw new Error('Page not found.');
          let page = 0;
          const slot = element('div');
          const summary = element('p');
          const next = element('button', 'Load more', { type: 'button' });
          view.append(element('h2', def.label), summary, slot, next);
          // Load small pages only; publicOnly is required even if staff is signed in.
          const load = async () => {
            next.disabled = true;
            try {
              const data = await services.content.list(route, { publicOnly: true, page });
              if (!isCurrent()) return;
              slot.append(showRecords(data.rows, def.fields.filter(key => key !== 'slug' && !key.startsWith('is_'))));
              page++;
              summary.textContent = `${data.count} published records`;
              next.hidden = page * 50 >= data.count;
            } finally { next.disabled = false; }
          };
          next.addEventListener('click', () => load().catch(error => { if (isCurrent()) status.textContent = error.message; }));
          await load();
        }
        if (isCurrent()) {
          document.title = `${route === 'home' ? 'Home' : CONTENT[route].label} — ${settings.barangay_name || 'BRGYWEBLITEV3'}`;
          status.textContent = 'Published data from the existing barangay database.';
        }
      } catch (error) { if (isCurrent()) status.textContent = error.message; }
    }, 'home');
  } catch (error) { status.textContent = `Unable to load: ${error.message}`; }
}
if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
