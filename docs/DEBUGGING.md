# Troubleshooting guide

## Previous/default design flashes during reload

Live HTML shells and `preview.html` start with `data-design-state="loading"`. The central stylesheet hides the themed content and displays a small neutral loading notice. `design/boot.js` is dependency-free and loads before the SDK, so a missing entry script gets a retry message after 12 seconds instead of an indefinite blank page. A failed theme read does not silently reveal a guessed preset.

`design/runtime.js` applies the saved tokens, runs the layout callback, and only then calls `designReady()` in the same task. The initial read also runs in a hidden tab; subsequent background reads still skip hidden tabs and preserve the last working design on failure. Public and verification pages re-arm the gate when restored from Back/Forward cache. The preview waits for its parent's origin/source/channel-validated draft before its first render; it no longer paints Modern LGU before receiving that draft.

This changes display timing only. It does not save designs, add browser-storage caches, or change existing accounts, records, maintenance, or permissions. Preview-only drafts remain in memory; a design must be confirmed with **Publish Everywhere** in the authenticated System Admin studio to survive a reload. `tests/design-loading.test.js` covers deferred/failed theme reads, hidden tabs, recovery, real public/verification controllers, HTML gates, and the preview handshake without production requests.

## Page Settings and maintenance

The standalone `design-studio.html` and its iframe are a sample appearance preview, not live staff editing. Use **Open live Page Settings** or sign in at `login.html?next=settings`. The existing active System Admin account can edit `admin/index.html#settings`. Content Admins still cannot change system settings; the live profile and existing RLS enforce this.

- `core/navigation.js` preserves only allowlisted, role-appropriate destinations after login, never arbitrary URLs.
- `staff/settings-screen.js` has separate confirmed **Enable/Disable maintenance mode**, **Edit maintenance notice**, and write-free **Preview maintenance notice** controls. A toggle updates only `maintenance_mode`; blank notice text cannot block turning maintenance off.
- `public/availability.js` reads existing settings on entry, focus/visibility, and once per minute while visible. Public navigation, pagination, and ID lookup also recheck availability. Concurrent reads are deduplicated; ordinary polls do not reload content tables.
- `public/app.js` disposes its router and carousel on maintenance or a failed availability check. Late content/theme responses cannot restore the public view. Turning maintenance off restores the current public route.
- `public/verify.js` removes verification controls, stops camera tracks, and discards pending results when availability changes. A direct QR link does not make a verification request while maintenance is on.
- Login and staff workspaces are not gated by maintenance. Back/Forward-cache restores of public pages recheck availability.

This preserves the original website-level maintenance contract. It is not a new security boundary: existing database RLS, public file links, and already-downloaded copies remain unchanged. No database schema, RPC, policy, account, or live maintenance value is changed by deployment or automated tests.

`tests/maintenance.test.js` covers real controller/form paths with fake services, including editing, confirmation, denied saves, maintenance transitions, and late-response/scanner cleanup. These tests do not prove a real authenticated save or physical camera behavior.

## Staff editing / ID / cover update

- `staff/content-screen.js`: content/ID Create, Read, Update, and Delete from one searchable screen. Directory Records provides the approved Contact, Barangay Staff, and functionary categories plus photo/icon upload. Read uses a details dialog; writes remain allowlisted by `data/contracts.js`; deletion uses an in-page confirmation before the existing service/RLS call.
- `staff/ui.js`: shared typed forms, record details, mobile record cards, and in-page action confirmations. Save errors remain inside the open editor so the draft is not lost.
- `staff/settings-screen.js`: singleton settings and five-cover draft/publish flow with in-page confirmations. Photos are compressed in `media/images.js` before upload.
- `staff/dashboard.js`: current counts and recent stored updates. Missing counts are not silently treated as zero.
- `staff/qr.js`: local PNG generation; existing tokens are preserved. `public/verify.js` uses the original manual and QR RPCs.
- `data/covers.js`: up to five public slides in `design_theme.brgyweblitev3_covers`. Atomic JSON comparison prevents a cover save from overwriting a concurrent theme edit.
- `design/public-renderer.js` nests those same saved covers inside `.hero` as `.hero-cover`; `design-system.css` darkens the image for readable hero text. No cover record, URL, bucket, or CRUD path is duplicated. If no cover is saved, the plain hero fallback remains.
- `public/app.js` maps Staff and Functionaries routes back to filtered `directory_entries`. If a record appears in the wrong public directory, check its exact category against `DIRECTORY_GROUPS` in `data/contracts.js`, then check `is_active`.
- `data/usage.js`: existing Storage metadata and public GitHub REST metadata only. No secret key or privileged backend was added.

When a create/save request fails after upload, close and refresh before retrying to avoid duplicates. Uploaded files are retained when a save outcome is uncertain. Existing files are not automatically deleted because they may have other references. Billing/quota/bandwidth/database size are deliberately unavailable, not zero.

For CSS, five-layout presets, previews, and safe publishing, read the [Design Studio guide](DESIGN-STUDIO.md). The only stylesheet is `assets/css/design-system.css`. New and changed code includes Purpose/dependencies/Debug comments.

Each JavaScript module starts with Purpose, dependencies, and Debug notes. Safeguards and request sequencing have nearby comments. Find the actual failing request instead of removing a safeguard to hide an error.

## Quick reference

| Problem | First place to look | Next check |
| --- | --- | --- |
| Local preview will not open | Output from `npm run dev` | Use the exact printed URL; a stopped server's old URL will not work |
| Supabase SDK will not load | `assets/js/core/client.js`, HTML script URL | Network/CDN availability and pinned version in `core/config.js` |
| Login fails | `assets/js/login.js`, `core/auth.js` | Auth response, matching `profiles.user_id`, active status, and required role |
| Incorrect staff destination/access | `core/auth.js`, `staff/workspace.js` | The live profile is authoritative, not user metadata or a cached role |
| Missing public content | `data/contracts.js`, `data/content.js` | Table/column names, public flag, pagination, and RLS errors |
| Incorrect profile/settings | `data/settings.js` | `site_settings.id=1` and existing `barangay-*` slugs, not legacy CSS/theme |
| ID/QR verification fails | `data/verification.js` | Original RPC arguments and existing QR token; never expose the private table |
| Upload/save problem | `data/storage.js` | Bucket policy, permitted file type/size, and `error.retainedUpload` |
| Content Admin approval problem | `data/editors.js` | `manage-editors` action, server error, System Admin role, and activation redirect configuration |
| Signup/activation problem | `data/applications.js` | Identify the failing stage: eligibility, Auth signup, application insert, or activation |
| Stale data appears after navigation | `core/router.js`, `staff/workspace.js` | `isCurrent()` and request-sequence checks after awaited calls |
| Secondary color does not appear | `design/model.js`, `design/runtime.js`, `design/studio.js` | Check `--secondary`/`--on-secondary`, selected preview screen, and the light sidebar override |
| Unexpected non-English text | Authored interface vs. stored content | All HTML shells use `lang="en"`; existing records and provider messages are displayed unchanged |

## Code flow

1. The HTML shell loads the pinned SDK and entry module.
2. The entry module obtains services from `core/services.js`.
3. `core/auth.js` validates the user and current staff profile.
4. A module in `data/` requests the existing Supabase resources.
5. Existing RLS/Edge Function rules enforce the actual permissions.
6. The public/staff view displays the result or error without changing permissions.

## Safe checks

```sh
npm test
npm run check
```

Tests use mock data and do not change live accounts or records. The source checker validates syntax, imports, script URLs, module headers, English HTML language metadata, and separation of logic from presentation.

To confirm public connectivity and anonymous-access restrictions:

```sh
npm run verify:live
```

This check is read-only. It does not verify real password login, authenticated writes, uploads, or approval actions; those need separate end-to-end verification.

## Important debugging rules

- Never log passwords, session tokens, secret keys, or private resident details.
- If a request is denied, inspect the actual role and server rules. Never remove RLS or put a service-role key in the browser.
- If an error includes `retainedUpload`, do not immediately retry or delete. A record may have saved even if the response was lost. Confirm the existing record and file reference first.
- V3 and the old website share a database. Real saves/deletions affect those shared records.
- Editing/upload controls require the correct active role. The public Design Studio is preview-only; publishing is available in the authenticated System Admin workspace.
- Update nearby comments and related tests when behavior changes.
