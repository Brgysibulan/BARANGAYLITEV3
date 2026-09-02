/**
 * Purpose: switch views within a single HTML shell using the URL hash.
 * Depends on: a render(route, isCurrent) callback that can return cleanup work.
 * Debug: check the hash/route allowlist and isCurrent() around awaited requests.
 * Hash URLs support static hosting, direct links, refresh, and browser Back.
 */
export function startRouter(render, fallback = 'dashboard') {
  let cleanup;
  let generation = 0;
  let previousHash = location.hash;
  async function update() {
    // Draft editors may veto in-app navigation/Back; sign-out still forcibly cleans up.
    if (cleanup?.canLeave && !cleanup.canLeave()) {
      history.replaceState(null, '', location.pathname + location.search + previousHash);
      return;
    }
    previousHash = location.hash;
    // A new route invalidates old requests, so late responses cannot replace it.
    const current = ++generation;
    cleanup?.();
    cleanup = undefined;
    const route = location.hash.slice(1).split('?')[0] || fallback;
    const isCurrent = () => current === generation;
    const nextCleanup = await render(route, isCurrent);
    // An old render may finish after a newer route. Dispose only its own resources.
    if (isCurrent()) { cleanup = nextCleanup; window.scrollTo(0, 0); }
    else nextCleanup?.();
  }
  window.addEventListener('hashchange', update);
  update();
  return () => { generation++; cleanup?.(); cleanup = undefined; window.removeEventListener('hashchange', update); };
}
