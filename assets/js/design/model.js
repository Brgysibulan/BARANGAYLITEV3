/**
 * Purpose: the single, versioned catalogue of supported government layouts and tokens.
 * Depends on: no browser, database, or third-party code; shared by previews and live views.
 * Debug: normalizeDesign rejects arbitrary CSS; compare sectionOrder to diagnose placement.
 */
export const DESIGN_KEY = 'brgyweblitev3';
export const PRESETS = Object.freeze({
  'national-authority': { name: 'National Authority', description: 'Formal masthead. Notices first. Clear public accountability.', primary: '#153957', accent: '#d6ad56', font: 'classic', corners: 'square', width: 'wide', sidebar: 'dark', sectionOrder: ['announcements', 'services', 'disclosures', 'officials', 'pages', 'forms', 'directory_entries', 'gallery_items'] },
  'executive-civic': { name: 'Executive Civic', description: 'A focused announcement, quick links, and a compact civic overview.', primary: '#243e68', accent: '#e1bb76', font: 'humanist', corners: 'soft', width: 'wide', sidebar: 'light', sectionOrder: ['services', 'officials', 'announcements', 'pages', 'disclosures', 'forms', 'gallery_items', 'directory_entries'] },
  'public-service': { name: 'Public Service', description: 'Service search up front. Forms and requirements within reach.', primary: '#075c70', accent: '#eac35b', font: 'humanist', corners: 'soft', width: 'wide', sidebar: 'dark', sectionOrder: ['services', 'forms', 'announcements', 'directory_entries', 'pages', 'disclosures', 'officials', 'gallery_items'] },
  institutional: { name: 'Institutional', description: 'A traditional information desk with a two-column editorial layout.', primary: '#642a36', accent: '#d6b777', font: 'classic', corners: 'square', width: 'boxed', sidebar: 'light', sectionOrder: ['announcements', 'pages', 'officials', 'services', 'disclosures', 'forms', 'directory_entries', 'gallery_items'] },
  'modern-lgu': { name: 'Modern LGU', description: 'A confident split hero with resident actions and community stories.', primary: '#164b3f', accent: '#e4bd73', font: 'humanist', corners: 'soft', width: 'wide', sidebar: 'dark', sectionOrder: ['announcements', 'services', 'officials', 'disclosures', 'gallery_items', 'pages', 'forms', 'directory_entries'] },
});
export const DEFAULT_PRESET = 'modern-lgu';
export const FONTS = Object.freeze({ humanist: '"Segoe UI", Arial, sans-serif', classic: 'Georgia, "Times New Roman", serif', contemporary: 'Arial, Helvetica, sans-serif' });
const validColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const choose = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

/** Fresh objects prevent one draft from mutating a preset or another screen's defaults. */
export function presetDesign(preset = DEFAULT_PRESET) {
  const key = Object.hasOwn(PRESETS, preset) ? preset : DEFAULT_PRESET;
  const def = PRESETS[key];
  return { version: 1, preset: key, primary: def.primary, secondary: def.primary, accent: def.accent, font: def.font, corners: def.corners, width: def.width, sidebar: def.sidebar };
}

/** Keep stored JSON backward-compatible while refusing unknown tokens, CSS, or URLs. */
export function normalizeDesign(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const base = presetDesign(source.preset);
  if (source.version !== undefined && source.version !== 1) return presetDesign();
  const primary = validColor(source.primary) ? source.primary.toLowerCase() : base.primary;
  return { ...base,
    primary,
    // Older version-1 designs used primary for these panels; preserve that appearance.
    secondary: validColor(source.secondary) ? source.secondary.toLowerCase() : primary,
    accent: validColor(source.accent) ? source.accent.toLowerCase() : base.accent,
    font: choose(source.font, Object.keys(FONTS), base.font),
    corners: choose(source.corners, ['square', 'soft', 'round'], base.corners),
    width: choose(source.width, ['wide', 'boxed'], base.width),
    sidebar: choose(source.sidebar, ['dark', 'light'], base.sidebar),
  };
}

/** Black/white contrast is derived, so custom buttons and colored panels stay readable. */
export function luminance(hex) {
  if (!validColor(hex)) throw new Error('Expected a six-digit hex color.');
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrastText(color) { return luminance(color) > 0.179 ? '#000000' : '#ffffff'; }
export function sameDesign(a, b) { return JSON.stringify(normalizeDesign(a)) === JSON.stringify(normalizeDesign(b)); }

/** Namespacing preserves all legacy theme keys and unrelated barangay settings. */
export function mergeDesign(existing, config) {
  if (existing !== null && (typeof existing !== 'object' || Array.isArray(existing))) throw new Error('Unsupported existing theme format. Ask the administrator to review it; nothing was overwritten.');
  return { ...(existing || {}), [DESIGN_KEY]: normalizeDesign(config) };
}
