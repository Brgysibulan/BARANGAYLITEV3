/**
 * Purpose: copy pinned, audited QR assets into the static site for private on-device processing.
 * Depends on: npm lockfile and the exact qrcode-generator/qr-scanner development packages.
 * Debug: run after npm ci; vendor files retain their original licenses and are not hand-edited.
 */
import { copyFile, mkdir } from 'node:fs/promises';
const target = new URL('../assets/vendor/', import.meta.url);
await mkdir(target, { recursive: true });
for (const [from, to] of [
  ['qrcode-generator/qrcode.js', 'qrcode-generator.js'],
  ['qr-scanner/qr-scanner.min.js', 'qr-scanner.min.js'],
  ['qr-scanner/qr-scanner-worker.min.js', 'qr-scanner-worker.min.js'],
  ['qr-scanner/LICENSE', 'qr-scanner.LICENSE'],
]) await copyFile(new URL('../node_modules/' + from, import.meta.url), new URL(to, target));
console.log('Copied pinned QR generator/scanner and licenses. No CDN request is needed to process IDs.');
