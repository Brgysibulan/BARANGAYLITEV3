/**
 * Purpose: edit existing identity/contact/maintenance settings and manage five cover photos.
 * Depends on: settings, covers and Storage services; native forms and image compression.
 * Debug: settings errors keep the draft open; cover conflicts require reloading the baseline.
 */
import { element as el } from '../core/dom.js';
import { heading, button, editorDialog, labelFor } from './ui.js';
import { optimizeImage } from '../media/images.js';
import { formatBytes } from '../data/usage.js';

const GROUPS = [
  { title: 'Barangay identity', keys: ['barangay_name', 'municipality_city', 'province', 'logo_url'] },
  { title: 'Public homepage', keys: ['hero_title', 'hero_text'] },
  { title: 'Contact & location', keys: ['address', 'contact_number', 'email', 'facebook_url', 'map_embed_url'] },
  { title: 'Maintenance notice', keys: ['maintenance_mode', 'maintenance_title', 'maintenance_message'] },
];
/** Settings stay admin-only, reuse the singleton, and patch only edited fields. */
export function mountSettings(root, services, isCurrent) {
  let disposed = false, dialog;
  heading(root, 'Site settings', 'Edit the public identity, contact information and homepage text. Existing account settings stay unchanged.');
  const slot = el('div', '', { class: 'dashboard-grid' }); const message = el('p', '', { role: 'status' }); root.append(message, slot);
  async function load() {
    try {
      const settings = await services.settings.read(); if (disposed || !isCurrent()) return; slot.replaceChildren();
      GROUPS.forEach(group => {
        const card = el('section', '', { class: 'dashboard-panel' }); card.append(el('h3', group.title));
        group.keys.forEach(key => { const row = el('div', '', { class: 'setting-row' }); row.append(el('small', labelFor(key)), el('p', typeof settings[key] === 'boolean' ? (settings[key] ? 'Enabled' : 'Disabled') : settings[key] || 'Not set')); card.append(row); });
        card.append(button('Edit ' + group.title.toLowerCase(), () => {
          const fields = group.keys.map(key => ({ key, type: key === 'maintenance_mode' ? 'checkbox' : key.endsWith('_url') ? 'url' : key === 'email' ? 'email' : ['hero_text', 'address', 'maintenance_message'].includes(key) ? 'textarea' : 'text', wide: true, required: ['barangay_name', 'hero_title', 'maintenance_title', 'maintenance_message'].includes(key) }));
          if (group.keys.includes('logo_url')) fields.push({ key: 'upload', label: 'Upload logo (optional)', type: 'file', accept: 'image/jpeg,image/png,image/webp', wide: true });
          dialog = editorDialog({ title: group.title, fields, original: settings,
            async onSave(values, file) {
              if (values.maintenance_mode === true && !settings.maintenance_mode && !confirm('Enable maintenance mode? Residents will see the maintenance notice instead of public content.')) throw new Error('Maintenance change cancelled.');
              let uploaded;
              if (file) { uploaded = await services.storage.upload('branding-media', await optimizeImage(file, { maxSide: 512, target: 120 * 1024 })); values.logo_url = uploaded.url; }
              const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== (settings[key] ?? null)));
              if (!Object.keys(changed).length) return settings;
              try { return await services.settings.update(changed); } catch (error) { if (uploaded) { error.retainedUpload = uploaded; error.message += ' Logo retained; copy its URL before retrying.'; } throw error; }
            }, afterSave: async () => { if (!disposed && isCurrent()) { message.textContent = 'Settings saved.'; await load(); } },
          });
        })); slot.append(card);
      });
    } catch (error) { if (!disposed && isCurrent()) message.textContent = error.message; }
  }
  load(); const cleanup = () => { disposed = true; dialog?.(); }; cleanup.canLeave = () => !dialog?.canLeave || dialog.canLeave(); return cleanup;
}

/** Upload/save is explicit. Reorder and descriptions remain local until Publish covers. */
export function mountCovers(root, services, isCurrent) {
  let baseline, slides = [], disposed = false, dirty = false, busy = false;
  const temporary = new Set(); const message = el('p', '', { role: 'status', class: 'module-message' }); const list = el('div', '', { class: 'cover-grid' });
  const publish = button('Publish cover photos', save, true); const reload = button('Reload saved photos', () => { if (!dirty || confirm('Discard unsaved cover changes?')) load(); });
  heading(root, 'Homepage cover photos', 'Up to five compressed images. Reorder them here; residents can pause or step through the slideshow.', [reload, publish]);
  const add = el('input', '', { id: 'cover-upload', type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', multiple: '' }); const addLabel = el('label', '+ Select cover photos', { for: 'cover-upload' });
  const uploader = el('div', '', { class: 'upload-zone' }); uploader.append(addLabel, add, el('small', 'Maximum 5 photos. Up to 15 MB input each; automatically resized before upload. GIFs become still covers.')); root.append(uploader, message, list);
  const beforeUnload = event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload);
  function setBusy(value) { busy = value; root.querySelectorAll('button,input,textarea').forEach(input => { input.disabled = value; }); }
  function draw() {
    list.replaceChildren(); publish.disabled = busy || !dirty || !baseline; add.disabled = busy || slides.length >= 5 || !baseline;
    slides.forEach((slide, i) => {
      const card = el('article', '', { class: 'cover-card' }); card.append(el('img', '', { src: slide.preview || slide.url, alt: slide.alt, width: 600, height: 338 }), el('strong', `Cover ${i + 1}`));
      const alt = el('input', '', { value: slide.alt, maxlength: 180, 'aria-label': `Photo description ${i + 1}`, placeholder: 'Describe this photo (required)' });
      const caption = el('input', '', { value: slide.caption || '', maxlength: 300, 'aria-label': `Caption ${i + 1}`, placeholder: 'Optional caption' });
      alt.addEventListener('input', () => { slide.alt = alt.value; dirty = true; publish.disabled = false; }); caption.addEventListener('input', () => { slide.caption = caption.value; dirty = true; publish.disabled = false; });
      const controls = el('div', '', { class: 'cluster' });
      const move = direction => { [slides[i], slides[i + direction]] = [slides[i + direction], slides[i]]; dirty = true; draw(); };
      const up = button('← Earlier', () => move(-1)); up.disabled = i === 0;
      const down = button('Later →', () => move(1)); down.disabled = i === slides.length - 1;
      controls.append(up, down, button('Remove', () => { slides.splice(i, 1); dirty = true; draw(); }));
      card.append(el('label', 'Photo description'), alt, el('label', 'Caption'), caption, controls); if (slide.file) card.append(el('small', `${formatBytes(slide.file.size)} selected · not yet uploaded`)); list.append(card);
      if (slide.url) card.append(el('a', 'Stored photo link ↗', { href: slide.url, target: '_blank', rel: 'noopener noreferrer', class: 'compact' }));
    });
    if (!slides.length) list.append(el('p', 'No cover photos yet. Your existing homepage remains visible.', { class: 'empty' }));
  }
  add.addEventListener('change', () => {
    const files = [...add.files]; add.value = '';
    if (files.length + slides.length > 5) { message.textContent = 'Only five cover photos are allowed. Remove one or choose fewer files.'; return; }
    for (const file of files) { const preview = URL.createObjectURL(file); temporary.add(preview); slides.push({ id: crypto.randomUUID(), file, preview, alt: '', caption: '' }); }
    dirty = true; message.textContent = 'Add a description to each photo, then publish.'; draw();
  });
  async function load() {
    setBusy(true);
    try { const result = await services.covers.read(); if (disposed || !isCurrent()) return; baseline = result; slides = result.slides.map(slide => ({ ...slide })); dirty = false; temporary.forEach(url => URL.revokeObjectURL(url)); temporary.clear(); message.textContent = 'Saved cover photos loaded.'; }
    catch (error) { if (!disposed) message.textContent = error.message; }
    finally { setBusy(false); if (!disposed) draw(); }
  }
  async function save() {
    if (busy || !baseline) return;
    if (slides.some(slide => !slide.alt.trim())) { message.textContent = 'Please add a photo description to every cover.'; return; }
    if (!confirm(`Publish ${slides.length} cover photos to the public homepage?`)) return;
    setBusy(true); message.textContent = 'Compressing and saving cover photos…';
    try {
      for (const slide of slides) if (slide.file) { const image = await optimizeImage(slide.file); const uploaded = await services.storage.upload('branding-media', image); slide.url = uploaded.url; delete slide.file; }
      const saved = await services.covers.save(slides, baseline); if (disposed || !isCurrent()) return;
      baseline = saved; slides = saved.slides; dirty = false; message.textContent = 'Cover photos published. Previous files were retained because they may still be linked elsewhere.';
      temporary.forEach(url => URL.revokeObjectURL(url)); temporary.clear();
    } catch (error) { if (!disposed) message.textContent = error.message + ' Already uploaded photos are retained. Copy their links before discarding this draft.'; }
    finally { setBusy(false); if (!disposed) draw(); }
  }
  load(); const cleanup = () => { disposed = true; temporary.forEach(url => URL.revokeObjectURL(url)); window.removeEventListener('beforeunload', beforeUnload); };
  cleanup.canLeave = () => !busy && (!dirty || confirm('Discard unsaved cover changes?')); return cleanup;
}
