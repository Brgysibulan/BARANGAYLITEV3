/**
 * Purpose: keep default/previous colors hidden until the requested design is applied.
 * Depends on: HTML data-design-state and the neutral loader in the central stylesheet.
 * Debug: loading -> ready follows a successful theme/preview render; error offers a retry.
 */
const timers = new WeakMap();
const LOADING = 'Loading website design…';
const FAILED = 'The website design could not load. Check your connection, then reload this page.';

function clearTimer(root) { clearTimeout(timers.get(root)); timers.delete(root); }
function message(root, text) { const label = root.querySelector('[data-design-message]'); if (label) label.textContent = text; }

/** An explicit HTML gate prevents the first paint; no cached theme or draft is persisted. */
export function beginDesignLoad(root = document.documentElement, { timeoutMs = 12000 } = {}) {
  if (!root.hasAttribute('data-design-state')) return;
  clearTimer(root); root.dataset.designState = 'loading'; message(root, LOADING);
  // This independent module can report a missing SDK/entry script instead of a blank screen.
  timers.set(root, setTimeout(() => designFailed(FAILED, root), timeoutMs));
}

/** Call only after both CSS tokens and the matching layout have been updated synchronously. */
export function designReady(root = document.documentElement) {
  if (!root.hasAttribute('data-design-state')) return;
  clearTimer(root); root.dataset.designState = 'ready';
}

/** Background failures must not hide an already-working design or reset its colors. */
export function designFailed(text = FAILED, root = document.documentElement) {
  if (!root.hasAttribute('data-design-state') || root.dataset.designState === 'ready') return;
  clearTimer(root); message(root, text); root.dataset.designState = 'error';
}

if (typeof document !== 'undefined') {
  beginDesignLoad();
  document.addEventListener('click', event => {
    if (event.target.closest('[data-design-retry]')) location.reload();
  });
}
