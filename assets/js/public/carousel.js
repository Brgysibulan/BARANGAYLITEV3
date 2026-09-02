/**
 * Purpose: accessible cover slideshow with only the current photo requested from Storage.
 * Depends on: validated public cover slides, native timers and shared CSS; no carousel library.
 * Debug: pause/hidden/reduced-motion prevent automatic movement; call dispose when leaving home.
 */
import { element as el } from '../core/dom.js';
export function createCarousel(slides, { autoplay = true } = {}) {
  const root = el('section', '', { class: 'cover-slideshow', 'aria-label': 'Barangay cover photos', 'aria-roledescription': 'carousel' });
  const image = el('img', '', { alt: slides[0]?.alt || '', width: 1600, height: 700, decoding: 'async', fetchpriority: 'high' });
  const caption = el('p', '', { class: 'cover-caption' }); const controls = el('div', '', { class: 'slideshow-controls' });
  let index = 0, paused = !autoplay || matchMedia('(prefers-reduced-motion: reduce)').matches, hovered = false, focused = false;
  const position = el('span', '', { 'aria-live': 'off' });
  const previous = el('button', '←', { type: 'button', 'aria-label': 'Previous cover photo' });
  const next = el('button', '→', { type: 'button', 'aria-label': 'Next cover photo' });
  const pause = el('button', paused ? 'Play slideshow' : 'Pause slideshow', { type: 'button' });
  function show(target) { index = (target + slides.length) % slides.length; image.src = slides[index].url; image.alt = slides[index].alt; caption.textContent = slides[index].caption || ''; caption.hidden = !caption.textContent; position.textContent = `${index + 1} / ${slides.length}`; }
  previous.addEventListener('click', () => show(index - 1)); next.addEventListener('click', () => show(index + 1));
  pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Play slideshow' : 'Pause slideshow'; });
  root.addEventListener('mouseenter', () => { hovered = true; }); root.addEventListener('mouseleave', () => { hovered = false; });
  root.addEventListener('focusin', () => { focused = true; }); root.addEventListener('focusout', event => { focused = root.contains(event.relatedTarget); });
  controls.append(previous, position, next, pause); controls.hidden = slides.length < 2; root.append(image, caption, controls);
  show(0);
  const timer = slides.length > 1 && autoplay ? setInterval(() => { if (!paused && !hovered && !focused && !document.hidden && root.isConnected) show(index + 1); }, 6000) : null;
  return { element: root, dispose: () => { if (timer) clearInterval(timer); } };
}
