/**
 * Purpose: connect the login form to the existing-account authentication service.
 * Depends on: login.html field IDs and core/auth.js through the service container.
 * Debug: form errors appear in #status; incorrect redirects require checking the live role.
 */
import { getServices } from './core/services.js';

// Waiting for DOMContentLoaded also waits for the deferred SDK script.
function start() {
  const form = document.querySelector('#login-form');
  const status = document.querySelector('#status');
  const button = form.querySelector('button');
  let auth;
  try { auth = getServices().auth; }
  catch (error) { status.textContent = error.message; button.disabled = true; return; }
  const destination = role => role === 'admin' ? 'admin/index.html' : 'editor/index.html';
  let submitting = false;
  // Reuse a valid V3 session, but do not race a newly submitted login form.
  auth.currentStaff().then(staff => {
    if (staff && !submitting) location.replace(destination(staff.profile.role));
  }).catch(() => { status.textContent = 'Mag-sign in gamit ang existing account.'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    // Prevent double submissions and clear password fields after either outcome.
    submitting = true;
    button.disabled = true;
    status.textContent = 'Signing in…';
    try {
      const staff = await auth.signIn(form.elements.email.value, form.elements.password.value);
      form.elements.password.value = '';
      location.replace(destination(staff.profile.role));
    } catch (error) {
      status.textContent = error.message || 'Hindi makapag-sign in.';
      form.elements.password.value = '';
      button.disabled = false;
      submitting = false;
    }
  });
}
if (document.readyState === 'loading' || document.readyState === 'interactive') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
