/**
 * Purpose: one text-safe public renderer used by the real site and Design Studio previews.
 * Depends on: model.js section ordering, DOM helpers, and published content passed by caller.
 * Debug: inspect the data-section order; sample preview records never enter data services.
 */
import { element as el, safeLink } from '../core/dom.js';
import { PRESETS, normalizeDesign } from './model.js';
import { createCarousel } from '../public/carousel.js';
export const SECTIONS = Object.freeze({ announcements: ['Latest updates', 'News & advisories'], services: ['For every resident', 'Barangay services'], officials: ['Public leadership', 'Your barangay officials'], disclosures: ['Open governance', 'Transparency & reports'], gallery_items: ['Life in our barangay', 'Community gallery'], pages: ['Our barangay', 'About & programs'], forms: ['Ready to download', 'Forms & documents'], directory_entries: ['Stay connected', 'Contact directory'] });

/** All links/images are constrained to HTTPS; database HTML is displayed as text, not executed. */
function https(value) { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } }
export function brand(settings, href = 'index.html') {
  const node = el('a', '', { class: 'brand', href });
  const logo = https(settings.logo_url);
  if (logo) node.append(el('img', '', { src: logo, alt: `${settings.barangay_name || 'Barangay'} seal`, width: 56, height: 56 }));
  else node.append(el('span', 'B', { class: 'brand-mark', 'aria-hidden': 'true' }));
  const copy = el('span');
  copy.append(el('small', 'Republic of the Philippines'), el('strong', `Barangay ${settings.barangay_name || 'Website'}`), el('small', [settings.municipality_city, settings.province].filter(Boolean).join(' · ')));
  node.append(copy);
  return node;
}

/** The same masthead/navigation is rendered on every public route. */
export function publicHeader(settings, route = 'home') {
  const header = el('header', '', { class: 'public-header' });
  const utility = el('div', '', { class: 'utility' });
  const utilityInner = el('div', '', { class: 'container' });
  utilityInner.append(el('span', 'OFFICIAL BARANGAY WEBSITE'), el('span', 'PUBLIC INFORMATION & SERVICES'));
  utility.append(utilityInner);
  const masthead = el('div', '', { class: 'masthead container' });
  masthead.append(brand(settings, '#home'), el('a', 'Staff portal ↗', { href: 'login.html', class: 'button' }));
  const nav = el('nav', '', { class: 'public-nav', 'aria-label': 'Public information' });
  const links = el('div', '', { class: 'container' });
  [['home', 'Home'], ['services', 'Services'], ['announcements', 'Announcements'], ['officials', 'Officials'], ['disclosures', 'Transparency'], ['directory_entries', 'Contact']].forEach(([key, label]) => links.append(el('a', label, { href: `#${key}`, 'aria-current': key === route ? 'page' : null })));
  links.append(el('a', 'Verify ID', { href: 'verify.html', 'aria-current': route === 'verify' ? 'page' : null }));
  nav.append(links); header.append(utility, masthead, nav); return header;
}

/** Cards retain module-specific information; no invented dates, counts, fees, or contacts. */
export function contentCard(table, row) {
  const card = el('article', '', { class: 'content-card' });
  const imageUrl = https(row.cover_url || row.photo_url || row.image_url);
  if (imageUrl) card.append(el('img', '', { src: imageUrl, alt: row.title || row.full_name || row.name || '', loading: 'lazy' }));
  const category = row.category || row.position || row.album || (table === 'announcements' ? 'Barangay advisory' : null);
  if (category) card.append(el('p', category, { class: 'eyebrow' }));
  card.append(el('h3', row.title || row.name || row.full_name || 'Barangay information'));
  const text = row.excerpt || row.description || row.bio || row.caption || row.summary || row.role_title;
  if (text) card.append(el('p', text, { class: 'body-copy' }));
  if (table === 'services') {
    for (const [key, label] of [['requirements', 'Requirements'], ['fee_text', 'Fee'], ['processing_time', 'Processing time']]) {
      if (row[key]) { const details = el('details'); details.append(el('summary', label), el('p', row[key], { class: 'body-copy' })); card.append(details); }
    }
  }
  if (row.content) { const details = el('details'); details.append(el('summary', 'Read more'), el('p', row.content, { class: 'body-copy' })); card.append(details); }
  if (row.file_url) card.append(safeLink(row.file_url, 'View / download document ↗'));
  if (row.contact) card.append(el('p', row.contact));
  if (row.location) card.append(el('p', row.location));
  if (row.published_at || row.document_date) {
    const date = new Date(row.published_at || row.document_date);
    if (!Number.isNaN(date.getTime())) card.append(el('small', date.toLocaleDateString('en-PH', { dateStyle: 'medium' })));
  }
  return card;
}

/** Map sits above the footer in all layouts; only a known Google Maps embed may be framed. */
export function publicFooter(settings, { preview = false } = {}) {
  const fragment = document.createDocumentFragment();
  const map = el('section', '', { class: 'map-section' });
  const layout = el('div', '', { class: 'container map-layout' });
  const contact = el('div');
  contact.append(el('p', 'WE ARE HERE TO HELP', { class: 'eyebrow' }), el('h2', 'Visit your barangay hall'), el('p', settings.address || [settings.barangay_name, settings.municipality_city, settings.province].filter(Boolean).join(', ')));
  if (settings.contact_number) contact.append(el('p', settings.contact_number));
  if (settings.email) contact.append(el('p', settings.email));
  const slot = el('div', '', { class: 'map-slot' });
  const source = https(settings.map_embed_url);
  const url = source && new URL(source);
  if (url && ['www.google.com', 'maps.google.com'].includes(url.hostname) && url.pathname.startsWith('/maps') && !preview) slot.append(el('iframe', '', { src: url.href, title: 'Barangay hall map', loading: 'lazy', referrerpolicy: 'no-referrer', sandbox: 'allow-scripts allow-same-origin' }));
  else slot.append(el('p', preview ? 'Barangay hall map · preview placeholder' : 'Map will appear when an approved map link is configured.'));
  layout.append(contact, slot); map.append(layout);
  const footer = el('footer', '', { class: 'public-footer' });
  const inner = el('div', '', { class: 'container' });
  const title = el('div'); title.append(el('h3', `Barangay ${settings.barangay_name || 'Website'}`), el('p', 'Public service. Open information. A connected community.'));
  const links = el('div', '', { class: 'cluster' });
  [['#forms', 'Forms'], ['#pages', 'About the barangay'], ['#gallery_items', 'Gallery'], ['login.html', 'Staff login']].forEach(([href, label]) => links.append(el('a', label, { href })));
  inner.append(title, links); footer.append(inner); fragment.append(map, footer); return fragment;
}

/** Layout-specific hero and DOM section order make presets genuinely different layouts. */
export function publicHome(settings, content, config, { preview = false, errors = {}, covers = [] } = {}) {
  const design = normalizeDesign(config);
  const root = el('div', '', { class: 'public-surface' });
  root.append(publicHeader(settings));
  const main = el('main', '', { id: 'public-main', tabindex: '-1', class: 'container' });
  if (covers.length) { const carousel = createCarousel(covers, { autoplay: !preview }); main.append(carousel.element); root.dispose = carousel.dispose; }
  const hero = el('section', '', { class: 'hero' });
  const copy = el('div', '', { class: 'hero-copy' });
  const featured = design.preset === 'executive-civic' && (content.announcements?.find(row => row.is_featured) || content.announcements?.[0]);
  copy.append(el('p', featured ? 'FEATURED BARANGAY ANNOUNCEMENT' : 'YOUR BARANGAY. YOUR COMMUNITY.', { class: 'eyebrow' }));
  const serviceFirst = design.preset === 'public-service';
  copy.append(el('h1', serviceFirst ? 'What can we help you with?' : featured?.title || settings.hero_title || `Welcome to Barangay ${settings.barangay_name || 'Website'}`), el('p', featured?.excerpt || settings.hero_text || 'Access barangay services, read the latest advisories, and stay connected with your local government.'));
  if (serviceFirst) {
    const search = el('form', '', { class: 'service-search', role: 'search' });
    search.append(el('label', 'Find a service', { for: 'service-query', class: 'sr-only' }), el('input', '', { id: 'service-query', name: 'q', placeholder: 'Search service names…', maxlength: 100, type: 'search' }), el('button', 'Find a service', { class: 'primary', type: 'submit' }));
    search.addEventListener('submit', event => { event.preventDefault(); location.hash = `services?q=${encodeURIComponent(search.elements.q.value.trim())}`; });
    copy.append(search);
  } else {
    const actions = el('div', '', { class: 'quick-links' });
    actions.append(el('a', 'Explore services →', { class: 'button primary', href: '#services' }), el('a', 'Latest announcements', { class: 'button', href: '#announcements' })); copy.append(actions);
  }
  const desk = el('aside', '', { class: 'resident-desk', 'aria-label': 'Resident quick actions' });
  desk.append(el('p', 'RESIDENT QUICK LINKS', { class: 'eyebrow' }));
  [['services', 'Barangay services'], ['forms', 'Downloadable forms'], ['directory_entries', 'Contact your barangay']].forEach(([key, title]) => desk.append(el('a', `${title} ↗`, { href: `#${key}` })));
  desk.append(el('a', 'Verify barangay ID ↗', { href: 'verify.html' }));
  hero.append(copy, desk); main.append(hero);
  const sections = el('div', '', { class: 'section-grid' });
  for (const table of PRESETS[design.preset].sectionOrder) {
    const [eyebrow, title] = SECTIONS[table];
    const section = el('section', '', { class: 'public-section', 'data-section': table });
    const heading = el('div', '', { class: 'section-heading' });
    const caption = el('div'); caption.append(el('p', eyebrow, { class: 'eyebrow' }), el('h2', title));
    heading.append(caption, el('a', 'View all ↗', { href: `#${table}` })); section.append(heading);
    const rows = content[table] || [];
    if (rows.length) { const cards = el('div', '', { class: 'cards' }); rows.slice(0, 3).forEach(row => cards.append(contentCard(table, row))); section.append(cards); }
    else section.append(el('p', errors[table] ? 'This section could not be loaded. Please try again.' : 'No published information in this section yet.', { class: 'empty' }));
    sections.append(section);
  }
  main.append(sections); root.append(main, publicFooter(settings, { preview })); return root;
}
