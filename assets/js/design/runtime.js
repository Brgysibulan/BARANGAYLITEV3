/**
 * Purpose: apply the same approved design to Public, staff, access, and preview shells.
 * Depends on: model.js and one central assets/css/design-system.css stylesheet.
 * Debug: inspect the html data-theme attributes; only validated CSS variables are written.
 */
import { normalizeDesign, contrastText, FONTS } from './model.js';

/** No stylesheet injection: every page uses the same tokens and layout selectors. */
export function applyDesign(value, root = document.documentElement) {
  const config = normalizeDesign(value);
  root.dataset.theme = config.preset;
  root.dataset.corners = config.corners;
  root.dataset.width = config.width;
  root.dataset.sidebar = config.sidebar;
  root.style.setProperty('--primary', config.primary);
  root.style.setProperty('--on-primary', contrastText(config.primary));
  root.style.setProperty('--accent', config.accent);
  root.style.setProperty('--on-accent', contrastText(config.accent));
  root.style.setProperty('--heading-font', FONTS[config.font]);
  return config;
}

/** Refresh already-open tabs without Realtime/schema changes; retain last good design offline. */
export async function watchDesign(service, onChange = () => {}) {
  let disposed = false;
  let running = false;
  let previous = '';
  const refresh = async () => {
    if (disposed || running || document.hidden) return;
    running = true;
    try {
      const snapshot = await service.read();
      if (disposed) return;
      const next = JSON.stringify(snapshot.config);
      if (next !== previous) { previous = next; applyDesign(snapshot.config); onChange(snapshot.config); }
    } finally { running = false; }
  };
  // A rejected first read is reported to the caller; background failures never erase a design.
  try { await refresh(); } catch (error) { applyDesign(); onChange(null, error); }
  const background = () => refresh().catch(() => {});
  const timer = setInterval(background, 60000);
  window.addEventListener('focus', background);
  document.addEventListener('visibilitychange', background);
  return () => { disposed = true; clearInterval(timer); window.removeEventListener('focus', background); document.removeEventListener('visibilitychange', background); };
}
