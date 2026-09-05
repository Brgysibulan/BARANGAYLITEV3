/**
 * Purpose: the single, versioned catalogue of supported government layouts and tokens.
 * Depends on: no browser, database, or third-party code; shared by previews and live views.
 * Debug: normalizeDesign rejects arbitrary CSS; compare sectionOrder to diagnose placement.
 */
export const DESIGN_KEY = 'brgyweblitev3';
export const PRESETS = Object.freeze({
  'national-authority': { name: 'National Authority', description: 'Formal masthead. Notices first. Clear public accountability.', primary: '#153957', accent: '#d6ad56', font: 'classic', corners: 'square', width: 'wide', sidebar: 'dark', footerStyle: 'banded', sectionOrder: ['announcements', 'services', 'disclosures', 'officials', 'pages', 'forms', 'directory_entries', 'gallery_items'] },
  'executive-civic': { name: 'Executive Civic', description: 'A focused announcement, quick links, and a compact civic overview.', primary: '#243e68', accent: '#e1bb76', font: 'humanist', corners: 'soft', width: 'wide', sidebar: 'light', heroAlign: 'center', footerStyle: 'light', sectionOrder: ['services', 'officials', 'announcements', 'pages', 'disclosures', 'forms', 'gallery_items', 'directory_entries'] },
  'public-service': { name: 'Public Service', description: 'Service search up front. Forms and requirements within reach.', primary: '#075c70', accent: '#eac35b', font: 'humanist', corners: 'soft', width: 'wide', sidebar: 'dark', footerStyle: 'civic', sectionOrder: ['services', 'forms', 'announcements', 'directory_entries', 'pages', 'disclosures', 'officials', 'gallery_items'] },
  institutional: { name: 'Institutional', description: 'A traditional information desk with a two-column editorial layout.', primary: '#642a36', accent: '#d6b777', font: 'classic', corners: 'square', width: 'boxed', sidebar: 'light', footerStyle: 'light', sectionOrder: ['announcements', 'pages', 'officials', 'services', 'disclosures', 'forms', 'directory_entries', 'gallery_items'] },
  'community-showcase': { name: 'Community Showcase', description: 'Visual community stories, gallery highlights, and welcoming public information.', primary: '#3d5d44', accent: '#d6a84b', font: 'friendly', corners: 'round', width: 'full', sidebar: 'dark', heroAlign: 'center', footerStyle: 'civic', sectionOrder: ['gallery_items', 'announcements', 'officials', 'services', 'pages', 'forms', 'directory_entries', 'disclosures'] },
  'transparency-first': { name: 'Transparency First', description: 'Disclosures and advisories lead a structured accountability-focused page.', primary: '#193c64', accent: '#cda548', font: 'classic', corners: 'square', width: 'wide', sidebar: 'dark', footerStyle: 'banded', sectionOrder: ['disclosures', 'announcements', 'services', 'officials', 'directory_entries', 'forms', 'pages', 'gallery_items'] },
  'civic-minimal': { name: 'Civic Minimal', description: 'Quiet typography, restrained panels, and a compact information-first rhythm.', primary: '#263936', accent: '#d59a63', font: 'contemporary', corners: 'soft', width: 'boxed', sidebar: 'light', footerStyle: 'minimal', sectionOrder: ['pages', 'services', 'announcements', 'forms', 'officials', 'disclosures', 'gallery_items', 'directory_entries'] },
  'modern-lgu': { name: 'Modern LGU', description: 'A confident split hero with resident actions and community stories.', primary: '#164b3f', accent: '#e4bd73', font: 'humanist', corners: 'soft', width: 'wide', sidebar: 'dark', footerStyle: 'civic', sectionOrder: ['announcements', 'services', 'officials', 'disclosures', 'gallery_items', 'pages', 'forms', 'directory_entries'] },
});
export const DEFAULT_PRESET = 'modern-lgu';
export const FONTS = Object.freeze({
  humanist: '"Segoe UI", Arial, sans-serif',
  classic: 'Georgia, "Times New Roman", serif',
  contemporary: 'Arial, Helvetica, sans-serif',
  geometric: '"Trebuchet MS", Arial, sans-serif',
  friendly: 'Verdana, Geneva, sans-serif',
});
export const DESIGN_OPTIONS = Object.freeze({
  corners: Object.freeze(['square', 'soft', 'round', 'extra-round']),
  width: Object.freeze(['boxed', 'wide', 'full']),
  sidebar: Object.freeze(['dark', 'light']),
  headerDensity: Object.freeze(['compact', 'comfortable', 'spacious']),
  surface: Object.freeze(['clean', 'tinted', 'contrast']),
  cardStyle: Object.freeze(['outlined', 'soft', 'elevated']),
  spacing: Object.freeze(['compact', 'comfortable', 'spacious']),
  navStyle: Object.freeze(['underline', 'pills', 'boxed']),
  footerStyle: Object.freeze(['civic', 'light', 'banded', 'minimal']),
  heroOverlay: Object.freeze(['soft', 'balanced', 'strong']),
  heroOverlayStyle: Object.freeze(['solid', 'gradient', 'vignette']),
  heroTone: Object.freeze(['primary', 'secondary', 'neutral']),
  heroImage: Object.freeze(['natural', 'muted', 'monochrome']),
  heroFocus: Object.freeze(['top', 'center', 'bottom']),
  heroHeight: Object.freeze(['compact', 'standard', 'tall']),
  heroAlign: Object.freeze(['left', 'center']),
  officialsLayout: Object.freeze(['rows', 'pyramid', 'compact']),
});
const validColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const choose = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

/** Fresh objects prevent one draft from mutating a preset or another screen's defaults. */
export function presetDesign(preset = DEFAULT_PRESET) {
  const key = Object.hasOwn(PRESETS, preset) ? preset : DEFAULT_PRESET;
  const def = PRESETS[key];
  return {
    version: 1, preset: key,
    primary: def.primary, secondary: def.primary, accent: def.accent,
    font: def.font, bodyFont: 'humanist',
    corners: def.corners, width: def.width, sidebar: def.sidebar,
    headerDensity: 'comfortable', surface: 'clean', cardStyle: 'outlined',
    spacing: 'comfortable', navStyle: 'underline', footerStyle: def.footerStyle || 'civic',
    heroOverlay: 'strong', heroOverlayStyle: 'gradient', heroTone: 'primary',
    heroImage: 'muted', heroFocus: 'center', heroHeight: 'standard',
    heroAlign: def.heroAlign || 'left',
    officialsLayout: 'rows',
  };
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
    corners: choose(source.corners, DESIGN_OPTIONS.corners, base.corners),
    width: choose(source.width, DESIGN_OPTIONS.width, base.width),
    sidebar: choose(source.sidebar, DESIGN_OPTIONS.sidebar, base.sidebar),
    bodyFont: choose(source.bodyFont, Object.keys(FONTS), base.bodyFont),
    headerDensity: choose(source.headerDensity, DESIGN_OPTIONS.headerDensity, base.headerDensity),
    surface: choose(source.surface, DESIGN_OPTIONS.surface, base.surface),
    cardStyle: choose(source.cardStyle, DESIGN_OPTIONS.cardStyle, base.cardStyle),
    spacing: choose(source.spacing, DESIGN_OPTIONS.spacing, base.spacing),
    navStyle: choose(source.navStyle, DESIGN_OPTIONS.navStyle, base.navStyle),
    footerStyle: choose(source.footerStyle, DESIGN_OPTIONS.footerStyle, base.footerStyle),
    heroOverlay: choose(source.heroOverlay, DESIGN_OPTIONS.heroOverlay, base.heroOverlay),
    heroOverlayStyle: choose(source.heroOverlayStyle, DESIGN_OPTIONS.heroOverlayStyle, base.heroOverlayStyle),
    heroTone: choose(source.heroTone, DESIGN_OPTIONS.heroTone, base.heroTone),
    heroImage: choose(source.heroImage, DESIGN_OPTIONS.heroImage, base.heroImage),
    heroFocus: choose(source.heroFocus, DESIGN_OPTIONS.heroFocus, base.heroFocus),
    heroHeight: choose(source.heroHeight, DESIGN_OPTIONS.heroHeight, base.heroHeight),
    heroAlign: choose(source.heroAlign, DESIGN_OPTIONS.heroAlign, base.heroAlign),
    officialsLayout: choose(source.officialsLayout, DESIGN_OPTIONS.officialsLayout, base.officialsLayout),
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
