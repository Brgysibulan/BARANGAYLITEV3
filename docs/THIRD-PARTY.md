# Pinned local QR tools

These files are copied by `scripts/vendor.mjs` from the exact versions in the npm lockfile. They are not hand-edited, and their original copyright notices are retained.

- qrcode-generator 1.4.4 — Kazuhiko Arase, MIT. [Project](https://github.com/kazuhikoarase/qrcode-generator). Copyright/license notice is embedded in `assets/vendor/qrcode-generator.js`.
- qr-scanner 1.4.2 — Nimiq, MIT. [Project](https://github.com/nimiq/qr-scanner). License is copied to `assets/vendor/qr-scanner.LICENSE`.
- jsqr 1.4.0 and linkedom 0.18.12 are development-only test tools; they are not loaded by the public website.

Scanner and generator are loaded on demand. Camera frames and PNG generation remain on-device; only the existing verification token is sent to the existing Supabase RPC.
