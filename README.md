# BRGYWEBLITEV3

Logic-first continuation of `Brgysibulan/BRGYWEB-LITE`, using the **same existing Supabase project**, records, Auth accounts, permissions, RPCs, and Storage buckets.

## Current stage

The shared Design Studio now provides five actual government layouts, configurable color/font/corners/navigation/width, isolated previews for six screen types, and confirmed admin-only publishing. Public pages display the existing published data with the same shared design used by staff and access screens. Staff content/account lists remain read-only in this stage. Existing System Admin credentials are unchanged.

The headless service modules retain content writes, uploads, settings/profile updates, verification, and Content Admin workflows. These never execute automatically. New application/activation screens reuse existing eligibility and role guards. See [Design Studio documentation](docs/DESIGN-STUDIO.md) for the shared CSS architecture and debugging flow.

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
