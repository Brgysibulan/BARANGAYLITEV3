/**
 * Purpose: manual and QR verification using the original BRGYWEB-LITE RPC contracts.
 * Depends on: unchanged verification services, lazy local qr-scanner and shared public design.
 * Debug: manual needs ID plus last name; camera permission is requested only after Start camera.
 * Privacy: never list records, navigate arbitrary scanned URLs, upload frames, or log tokens.
 */
import { getServices } from '../core/services.js';
import { element as el } from '../core/dom.js';
import { extractQrToken } from '../data/verification.js';
import { fullName } from '../data/id-model.js';
import { watchDesign } from '../design/runtime.js';
import { publicHeader } from '../design/public-renderer.js';

/** Render only the fields authorized by the existing public verification RPC. */
export function verificationResult(record) {
  const result = el('section', '', { class: 'verification-result', 'aria-label': 'Verification result' });
  if (!record) { result.append(el('h2', 'No matching ID found'), el('p', 'Check the ID number and last name, or scan the QR printed on the ID.')); return result; }
  // The original RPC has already applied its expiry rule; the viewer's clock must not override it.
  const state = record.status === 'ACTIVE' ? 'Valid' : record.status === 'EXPIRED' ? 'Expired' : 'Inactive';
  result.append(el('span', state === 'Valid' ? '✓ Valid ID' : state + ' ID', { class: `status-badge ${state === 'Valid' ? 'good' : 'warning'}` }), el('h2', fullName(record)));
  const details = el('dl', '', { class: 'id-details' });
  for (const [key, label] of [['control_number', 'ID number'], ['date_acquired', 'Date acquired'], ['expiration_date', 'Expiration date']]) { details.append(el('dt', label), el('dd', record[key] || 'Not recorded')); }
  result.append(details, el('p', 'This checks the stored ID record. Compare the result with the physical ID and its holder.', { class: 'muted compact' })); return result;
}

/** Scanner lifetime is tied to the page; hidden/closed pages release the camera immediately. */
export function mountVerification(root, service) {
  let scanner, Scanner, disposed = false, generation = 0, cameraGeneration = 0;
  const manual = el('form', '', { class: 'verification-form' });
  const number = el('input', '', { id: 'id-number', name: 'control_number', required: '', minlength: 4, maxlength: 40, pattern: '[A-Za-z0-9-]+', autocomplete: 'off', placeholder: 'Enter the printed ID number' });
  const lastName = el('input', '', { id: 'last-name', name: 'last_name', required: '', maxlength: 80, autocomplete: 'off', placeholder: 'Enter last name' });
  const submit = el('button', 'Verify ID →', { type: 'submit', class: 'primary' });
  manual.append(el('h2', 'Search by ID number'), el('p', 'Last name is required by the existing verification system.', { class: 'muted' }), el('label', 'ID number', { for: 'id-number' }), number, el('label', 'Last name', { for: 'last-name' }), lastName, submit);
  const scan = el('section', '', { class: 'scanner-panel' });
  const video = el('video', '', { muted: '', playsinline: '', hidden: '', 'aria-label': 'Live camera preview for QR scanning' });
  video.muted = true;
  const start = el('button', 'Start camera scanner', { type: 'button' }); const stop = el('button', 'Stop camera', { type: 'button', disabled: '' });
  const file = el('input', '', { type: 'file', id: 'scan-image', accept: 'image/png,image/jpeg,image/webp' });
  const scanStatus = el('p', 'Camera is off.', { role: 'status', class: 'muted compact' });
  const controls = el('div', '', { class: 'cluster' }); controls.append(start, stop);
  scan.append(el('h2', 'Or scan the ID QR'), el('p', 'Use the camera or select a QR photo. Processing happens on this device.', { class: 'muted' }), video, controls, scanStatus, el('label', 'Scan a saved QR image', { for: 'scan-image' }), file);
  const columns = el('div', '', { class: 'verify-options' }); columns.append(manual, scan);
  const result = el('div', '', { class: 'verification-output', role: 'status', 'aria-live': 'polite' }); root.append(columns, result);
  function stopCamera() { cameraGeneration++; scanner?.destroy(); scanner = undefined; video.srcObject?.getTracks().forEach(track => track.stop()); video.srcObject = null; video.hidden = true; start.disabled = false; stop.disabled = true; scanStatus.textContent = 'Camera is off.'; }
  async function getScanner() { if (!Scanner) Scanner = (await import('../../vendor/qr-scanner.min.js')).default; return Scanner; }
  async function lookup(operation) {
    const request = ++generation; stopCamera(); result.replaceChildren(el('p', 'Checking the existing ID record…', { class: 'notice' })); submit.disabled = true;
    try { const record = await operation(); if (!disposed && request === generation) result.replaceChildren(verificationResult(record)); }
    catch (error) { if (!disposed && request === generation) result.replaceChildren(el('p', 'Verification unavailable: ' + error.message, { class: 'notice' })); }
    finally { if (!disposed && request === generation) submit.disabled = false; }
  }
  function scanned(value) { const token = extractQrToken(value); if (!token) { scanStatus.textContent = 'This is not a supported barangay ID QR. Try the printed ID code.'; return; } lookup(() => service.verifyQr(token)); }
  manual.addEventListener('submit', event => { event.preventDefault(); const control = number.value, surname = lastName.value; lookup(() => service.verifyManual(control, surname)); });
  start.addEventListener('click', async () => {
    const attempt = ++cameraGeneration; start.disabled = true; stop.disabled = false; scanStatus.textContent = 'Starting camera…';
    try {
      const QrScanner = await getScanner(); if (disposed || attempt !== cameraGeneration) return;
      video.hidden = false;
      scanner = new QrScanner(video, data => { if (!disposed) scanned(data.data); }, { preferredCamera: 'environment', returnDetailedScanResult: true, maxScansPerSecond: 5 });
      await scanner.start(); if (disposed || attempt !== cameraGeneration) { scanner?.destroy(); return; }
      scanStatus.textContent = 'Point your camera at the QR printed on the ID.';
    } catch { if (!disposed && attempt === cameraGeneration) { stopCamera(); scanStatus.textContent = 'Camera unavailable or permission denied. Allow camera access on HTTPS, choose a QR image, or use manual search.'; } }
  });
  stop.addEventListener('click', stopCamera);
  file.addEventListener('change', async () => {
    const image = file.files?.[0]; file.value = ''; if (!image) return;
    if (image.size > 10 * 1024 * 1024) { scanStatus.textContent = 'Choose a QR image smaller than 10 MB.'; return; }
    file.disabled = true; stopCamera(); scanStatus.textContent = 'Reading QR image on this device…';
    try { const QrScanner = await getScanner(); const code = await QrScanner.scanImage(image, { returnDetailedScanResult: true }); if (!disposed) scanned(code.data); }
    catch { if (!disposed) scanStatus.textContent = 'No readable QR found. Choose a sharper photo with the full white border.'; }
    finally { file.disabled = false; }
  });
  const visibility = () => { if (document.hidden) stopCamera(); }; document.addEventListener('visibilitychange', visibility);
  const cleanup = () => { disposed = true; generation++; stopCamera(); document.removeEventListener('visibilitychange', visibility); };
  cleanup.verifyToken = value => lookup(() => service.verifyQr(value)); return cleanup;
}
async function startPage() {
  const root = document.querySelector('#verify-root'), status = document.querySelector('#status');
  try {
    const services = getServices(), settings = await services.settings.read();
    const stopDesign = await watchDesign(services.design);
    const header = publicHeader(settings, 'verify'); header.querySelectorAll('a[href^="#"]').forEach(link => { link.href = 'index.html' + link.getAttribute('href'); }); root.append(header);
    const main = el('main', '', { id: 'verification-main', tabindex: '-1', class: 'container verify-main' }); root.append(main);
    if (settings.maintenance_mode) { main.append(el('h1', settings.maintenance_title), el('p', settings.maintenance_message)); status.textContent = ''; return; }
    main.append(el('p', 'BARANGAY SIBULAN · RECORD VERIFICATION', { class: 'eyebrow muted' }), el('h1', 'Verify a barangay ID'), el('p', 'Check the name, acquisition date, expiration date and current status.', { class: 'muted' }));
    const cleanup = mountVerification(main, services.verification); status.textContent = '';
    window.addEventListener('pagehide', () => { cleanup(); stopDesign(); }, { once: true });
    const token = new URLSearchParams(location.search).get('qr'); if (token) cleanup.verifyToken(token);
  } catch (error) { status.textContent = 'Unable to load verification: ' + error.message; }
}
if (typeof document !== 'undefined' && document.querySelector('#verify-root')) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPage, { once: true }); else startPage();
}
