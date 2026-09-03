# BRGYWEBLITEV3

Logic-first continuation of `Brgysibulan/BRGYWEB-LITE`, using the **same existing Supabase project**, records, Auth accounts, permissions, RPCs, and Storage buckets.

## Current stage

The redesigned staff workspace now supports editable public content, real dashboard aggregates, ID records and downloadable QR files, up to five compressed homepage covers, site settings, Content Admin management, and measured file-storage/GitHub status. The shared Design Studio provides eight government layouts plus validated typography, spacing, surface, navigation, card, header, and hero-photo controls with confirmed admin-only publishing. Existing System Admin credentials and the original verification rules are unchanged.

Design Studio includes main, secondary, and accent color pickers with matching hex inputs. Its hero layer follows the chosen main or secondary color, offers controlled photo visibility/treatment/position, and previews the same existing Dashboard cover without copying its record. The secondary color controls supporting panels while preserving older saved palettes. The authored interface is fully English; stored barangay content is not translated or modified.

Live Page Settings is `admin/index.html#settings` (existing System Admin access required), not the sample Design Studio iframe. Maintenance has dedicated enable/disable, notice editing, and preview controls. The existing flag pauses public pages and ID verification, including open tabs after the next availability check, while keeping staff login/workspaces accessible. No backend permissions or live maintenance state are changed by this release.

Public service pages are informational and do not collect online payments; any required transaction is completed directly at the Barangay Hall with an official receipt.

Public verification is at `verify.html`. Manual lookup requires ID number plus last name, as in the original website. QR codes use the existing record token and the permanent GitHub Pages address. No new backend/schema/RLS changes were deployed for this update. Billing, quota, bandwidth and database disk size are explicitly unavailable until a separately authorized provider integration exists.

Writes run only after an explicit staff action. The application/activation screens reuse existing eligibility and role guards. All CSS remains in the central design system. Pinned local QR assets can be refreshed with `npm run vendor`; no external QR generation service receives ID tokens. See [Design Studio documentation](docs/DESIGN-STUDIO.md) and [debugging map](docs/DEBUGGING.md).

## Existing system preserved

- Supabase: `pkvorwvkqjnbgktkgjhr` (`BRGYWEB-LITE`), **not WebSaaS**.
- Auth: existing `auth.users` and active roles in `public.profiles`.
- All 12 existing public tables retain their schema, data, IDs, and RLS.
- Existing QR tokens, file URLs, and 4 Storage buckets are unchanged.
- The deployed `manage-editors` Edge Function and 3 existing RPCs are reused.
- The V3 design is saved only under `site_settings.design_theme.brgyweblitev3`; legacy JSON keys and color columns are preserved. No legacy CSS is executed.
- V3 has a separate browser-session storage key. The same account can sign in, but old-site session tokens are not copied, cleared, or overwritten.

**Shared data warning:** a future explicit edit through V3 changes the same records used by the old website. There is no copied or staging database.

## Structure

```text
index.html                    Public shell
admin/index.html              System Admin shell
editor/index.html             Content Admin shell
login.html                    Existing staff login
assets/js/core/               Client, verified roles, service composition, routing
assets/js/data/               Presentation-independent data operations
assets/js/staff/              Read-only staff workspace
assets/js/design/             Shared layouts, live design runtime, and isolated previews
assets/css/design-system.css  All CSS and responsive layout rules
design-studio.html            Public sample playground (no publishing)
signup.html / activate.html   Existing Content Admin application/activation flows
assets/js/public/             Published public data view
tests/                        Mocked safety and contract tests
scripts/                      Local checks and read-only live verification
docs/REWIRE-AUDIT.md           Exact migration boundaries and remaining work
docs/DEBUGGING.md              Where to look when a feature fails
```

No frontend framework, build step, or Node backend is required for hosting. The optional Node scripts are developer tools only. The browser SDK is pinned to `@supabase/supabase-js@2.112.4`; no floating `@2` dependency.

Every JavaScript module has a purpose/dependency/debugging header, with focused comments on important safeguards. See `AGENTS.md` for the continuing comment requirement and `docs/DEBUGGING.md` for the troubleshooting map.

## Local checks

```sh
npm test
npm run check
npm run dev
```

The local server prints its exact URL. The live verifier needs network access and performs reads only:

```sh
npm run verify:live
```

Never put a Supabase secret/service-role key in this frontend. The configured publishable key is intentionally public; the existing database policies and Edge Function authorization enforce access.

## Deployment boundary

The static source can be served by the existing GitHub Pages workflow or ordinary static hosting. No new hosting provider, Supabase project, schema migration, or Auth redirect allowlist was created. Application/activation screens reuse the existing services; invitation email redirects still need the owner to validate their production URL against the existing Auth configuration. No invitation, signup, password update, or live theme publication is performed by the automated tests.


## Footer design options

Design Studio includes four responsive footer styles: Civic columns, Light institutional, Accent band, and Minimal. Every style follows the published primary, secondary, and accent colors and keeps the same official navigation and contact data.
