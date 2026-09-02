# Troubleshooting guide

## Staff editing / ID / cover update

- `staff/content-screen.js`: content/ID table, search, pagination, edit dialogs and confirmed record deletion.
- `staff/settings-screen.js`: singleton settings and five-cover draft/publish flow. Photos are compressed in `media/images.js` before upload.
- `staff/dashboard.js`: current counts and recent stored updates. Missing counts are not silently treated as zero.
- `staff/qr.js`: local PNG generation; existing tokens are preserved. `public/verify.js` uses the original manual and QR RPCs.
- `data/covers.js`: up to five public slides in `design_theme.brgyweblitev3_covers`. Atomic JSON comparison prevents a cover save from overwriting a concurrent theme edit.
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
