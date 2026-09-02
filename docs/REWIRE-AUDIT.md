# BRGYWEBLITEV3 — data rewiring audit

Date: 2026-09-02 (Asia/Manila).

Source: `Brgysibulan/BRGYWEB-LITE` at `a602a8f17123aab7dc7dc13fed44b7f9b9a7e55d`.
Destination: `Brgysibulan/BARANGAYLITEV3`, based on its initial README commit.

## Non-destructive boundary

The legacy repository is a read-only reference. No legacy file was removed or overwritten. No database migration, seed, row update/delete, Auth mutation, password reset, storage upload/delete, or Edge Function deployment was performed during this work. The unrelated WebSaaS project is not referenced by the runtime.

The four legacy CSS files (`style.css`, `admin.css`, `admin-shell.css`, `access.css`) and Bootstrap CSS are intentionally **not copied into V3**. This is not deletion from the original website or from Supabase.

## Separating logic from presentation

| Legacy responsibility | V3 destination | Preserved contract |
| --- | --- | --- |
| `core/supabase-config.js` | `core/config.js`, `core/client.js` | Same project URL/publishable key; no injected shells, styles, service worker, or legacy-cache deletion |
| Login and repeated staff guards | `core/auth.js` | `signInWithPassword`, server-validated user, `profiles.role` plus strict `is_active` |
| Announcements, officials, services, directory, disclosures, gallery, forms | `data/contracts.js`, `data/content.js` | Existing table/column names, IDs, publish/active predicates, explicit CRUD |
| Site settings and maintenance | `data/settings.js` | Existing singleton `id=1`; field-level updates, no legacy theme overwrite |
| Barangay profile | `data/settings.js` | Existing five `barangay-*` slugs, upsert on `slug`, preserve unedited fields |
| File uploads | `data/storage.js` | Same four buckets and MIME/size limits; no automatic rewrite of existing URLs |
| Public ID verification | `data/verification.js` | `verify_barangay_record(p_control_number,p_last_name)` and `verify_barangay_record_qr(p_token)` |
| Admin verification management | `data/verification.js` | Admin-only table access, IDs and database-owned QR tokens preserved |
| Content Admin approvals/accounts | `data/editors.js` | Existing `manage-editors` function/actions, no frontend admin secret |
| Content Admin application/activation | `data/applications.js` | Name eligibility RPC, signup/request flow, editor-only activation |

`admin/shell.js`, `admin/shell-prime.js`, `public/shell.js`, `public/responsive-guard.js`, `public/content-placement.js`, the old Design Studio UI, navigation injectors, and old service-worker cache registration are not loaded by V3. **Mixed modules were not blindly deleted:** role checks, sign-out, content operations, maintenance state, application validation, and file constraints were extracted into the modules above.

The three small new shells share the data services. Headless data code does not generate markup, set styles, inject scripts, choose themes, or read cached roles as authorization. The old `design_theme` JSON and color columns remain in the database for recoverability; a future Design Studio can be designed separately.

## Intentional safety differences

- Missing/inactive profiles fail closed. Editable user metadata never grants a role.
- Existing RLS remains authoritative; UI checks do not replace server permissions.
- Public views explicitly filter published/active rows, even if opened by signed-in staff.
- Generic content operations cannot read or write private tables.
- Write payloads use table-specific allowlists. IDs, role fields, QR tokens, and theme settings cannot be silently overwritten.
- Write success requires the returned row, not merely absence of an error.
- Uploads use new paths without upsert. If a record save fails or its response is lost, the new file is retained: the database write might have committed. The caller receives the retained upload reference for reconciliation before retrying.
- Existing files are retained by default, including when content changes. An explicit `removeObject` operation validates project origin and bucket before deletion; link/reference checks and a clear UI confirmation are required before exposing file deletion in the UI.
- V3 sessions are separated from old-site session storage, and sign-out is local rather than global.
- No actual private records or credential/session values were copied into source or test fixtures.

## Verification completed

- Read-only schema/policy inspection: all 12 public tables had RLS enabled.
- Account integrity check: 2 existing Auth users and 1 active System Admin; no password values read.
- Storage inspection: 4 existing buckets; 1 existing object. No object was downloaded, removed, or replaced during the audit.
- Mocked automated safety/contract tests: 25 passing at the first validation pass (run `npm test` for current total).
- Live public read checks passed for site settings and all 8 public content modules.
- Anonymous reads returned no private profile, verification, or application rows.
- Exact pinned browser SDK URL returned successfully.
- JavaScript syntax, relative imports, script paths, and absence of old CSS/presentation side effects checked.

## Not yet verified / not yet built

- Real System Admin login requires the account holder to sign in; no password was requested or reset.
- Authenticated writes, uploads, staff Edge Function actions, and account creation/activation were tested with mocks only, not by changing production data.
- Read-only screens are not the finished CMS. Content editing forms, upload controls, camera QR scanning/generation, richer public pages, search, signup/activation screens, and the redesigned Design Studio still need UI integration.
- The existing activation redirect allowlist was not changed. Validate the exact future deployment origin before enabling invitation/activation UI.
- No browser interaction/screenshot test was requested or performed.
- No live-site rollout or change of hosting provider is part of this foundation commit.
