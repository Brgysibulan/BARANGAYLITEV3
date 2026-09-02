/**
 * Purpose: preserve a requested staff destination through existing-account login.
 * Depends on: the verified profile role and a fixed module allowlist, never an arbitrary URL.
 * Debug: unsupported destinations fall back to the appropriate workspace overview.
 */
export function staffDestination(role, requested = '') {
  const admin = role === 'admin';
  const allowed = admin ? ['settings', 'design-studio', 'covers', 'pages'] : ['pages'];
  const hash = allowed.includes(requested) ? '#' + requested : '';
  return (admin ? 'admin/index.html' : 'editor/index.html') + hash;
}
