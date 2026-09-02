/**
 * Purpose: sample staff shell matching live workspace classes without private queries.
 * Depends on: central CSS and DOM helpers; none of the values represent private records.
 * Debug: counts are omitted; navigation cannot grant access in this isolated preview.
 */
import { element as el } from '../core/dom.js';
export function staffPreview(mode) {
  const root = el('div', '', { class: 'workspace' });
  const role = mode === 'admin' ? 'System Admin' : 'Content Admin';
  const header = el('header', '', { class: 'workspace-header' });
  header.append(el('strong', 'BRGYWEBLITEV3'), el('p', `${role} · Sample workspace`));
  const nav = el('nav', '', { class: 'workspace-nav', 'aria-label': `${role} preview modules` });
  const list = el('ul');
  const labels = ['Dashboard', 'Announcements', 'Services', 'Officials', 'Directory', 'Transparency', 'Forms', 'Gallery'];
  if (mode === 'admin') labels.push('Design Studio', 'Site Settings', 'Content Admin Accounts');
  labels.forEach((label, index) => { const li = el('li'); li.append(el('a', label, { href: '#', 'aria-current': index === 0 ? 'page' : null })); list.append(li); });
  nav.append(list);
  const main = el('main', '', { class: 'workspace-main' });
  main.append(el('p', `${role.toUpperCase()} / OVERVIEW`, { class: 'eyebrow muted' }), el('h1', 'Your barangay workspace'), el('p', 'Manage public information with one consistent design.', { class: 'muted' }));
  const cards = el('div', '', { class: 'cards' });
  ['Announcements', 'Barangay services', 'Public documents'].forEach(label => { const card = el('article', '', { class: 'content-card' }); card.append(el('p', 'CONTENT MODULE', { class: 'eyebrow' }), el('h2', label), el('p', 'Existing records appear after staff sign-in. This preview contains no private data.')); cards.append(card); });
  main.append(cards, el('p', 'Preview only · Access rules and account roles do not change with a theme.', { class: 'notice' }));
  root.append(header, nav, main); return root;
}
