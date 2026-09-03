# Design Studio — maintenance and release notes

## One design source

All CSS lives in `assets/css/design-system.css`, in numbered sections: tokens, Public, eight layouts, Staff/Access, Studio, responsive rules. Every HTML shell loads exactly that one file; inline styles and extra stylesheets fail validation. Only validated runtime variables are assigned by JavaScript.

`assets/js/design/model.js` owns National Authority, Executive Civic, Public Service, Institutional, Community Showcase, Transparency First, Civic Minimal, and Modern LGU. Their actual DOM section order is different, alongside masthead, hero, navigation, staff, and access layout rules. The public map always sits before the footer.

## Draft → review → publish

1. Sign in using the existing System Admin credentials, then open **Design Studio** in the navigation.
2. Choose a preset; customize main, secondary, and accent colors, heading/body fonts, corners, header spacing, page width, hero layer/photo treatment, page surface, cards, section spacing, and public navigation. Preset selection restores that preset's defaults.
3. Preview Public, System Admin, Content Admin, Login, Signup/Application, or Activation at desktop, tablet, and mobile widths.
4. **Publish Everywhere** then **Confirm publish** saves the shared design. Until confirmation, changes exist only in memory inside the draft editor. Refresh/leave warnings protect unsaved drafts.
5. **Discard changes** restores the loaded published baseline. **Reset to Modern LGU default** changes the draft only, so it still needs publishing.

The public `design-studio.html` is a separate safe playground. Publishing is disabled there; it contains labelled sample data only. `preview.html` has no Supabase SDK and cannot submit login/application/activation forms. Origin, source-window, and random-channel checks isolate preview messages.

The staff navigation inside that iframe is also a sample. Use **Open live Page Settings** outside the preview to edit real homepage text/contact information or manage maintenance. The link opens the authenticated System Admin settings route and preserves that destination through login; it does not grant new permissions.

## Color controls and English interface

- **Main color** controls primary buttons and primary highlights.
- **Secondary color** controls the resident quick-links panel, public footer, colored staff sidebar, and access-screen side panel. The light sidebar option remains light. The Public Service layout intentionally hides the quick-links panel; its footer still uses the secondary color.
- **Accent color** controls accent buttons, selected staff navigation, and decorative accents.

## Expanded appearance controls

- **Hero photo & layer:** photo visibility, solid/gradient/vignette layer, main/secondary/neutral layer color, natural/muted/monochrome treatment, top/center/bottom crop position, hero height, and text alignment.
- **Typography & structure:** five safe local font stacks for headings and body text, four corner styles, three page widths, three header densities, and light/colored staff navigation.
- **Surfaces & components:** clean/tinted/high-contrast page backgrounds, outlined/soft/elevated cards, compact/comfortable/spacious section rhythm, and underline/pill/boxed navigation.
- The default hero treatment is a strong theme-colored gradient with a muted photo, so the existing Barangay Hall image remains atmospheric while text stays prominent. The layer color is derived from the selected Design Studio palette; it is never hardcoded to green.
- The authenticated Design Studio reads the existing Dashboard cover record for preview only. It does not upload, copy, duplicate, delete, or replace media. Cover CRUD remains exclusively in **Cover photos**.

The validated non-color choices alone provide well over 100,000 combinations. Custom color pickers expand that further without allowing arbitrary CSS or remote fonts. Older version-1 designs normalize to safe defaults, so no database migration is required.

Every color accepts a native picker or a six-digit hex value. Foreground text is derived as black or white for readability. Invalid text cannot reach the preview or saved theme. The optional `secondary` key stays within version 1; older saved themes inherit their existing main color, so they are not recolored on upgrade. Reset, discard, preview, and confirmed publishing all include the new color. No new dependency or database migration is needed.

All authored controls, instructions, empty/error messages, and HTML language metadata are English. Stored barangay records, names, and administrator-written content are displayed unchanged; this release does not translate live database content.

## Existing Supabase contract

`assets/js/data/design.js` reads the existing singleton `site_settings(id=1)` and updates only `design_theme`. The V3 config is namespaced at `design_theme.brgyweblitev3`. Other legacy JSON keys and old color columns are preserved, not imported as CSS. No table, role, account, RLS policy, password, RPC, bucket, or Edge Function is recreated.

The update is guarded by active-admin authorization and existing database RLS. An atomic equality check on the complete JSON baseline (or `IS NULL` on first publish) prevents overwriting a concurrent change. A zero-row response is an error. **Reload published** retrieves the latest baseline but keeps your draft for review. Unknown future schema versions cannot be overwritten.

All live shells read the same config. Already-open pages refresh on focus or within 60 seconds; offline pages retain their last successful appearance. Public content still uses explicit published/active predicates even when a staff account is signed in.

On reload, a neutral notice stays visible until the saved colors and layout have both been applied. A failed initial read offers **Reload page**, not a guessed default design. The isolated preview likewise waits for the current draft message before rendering. This first-paint safeguard is in `design/boot.js` and `design/runtime.js`; it does not persist or publish unfinished drafts.

## Debugging and verification

- Wrong section order: check `PRESETS[config.preset].sectionOrder`, then `public-renderer.js`.
- Inconsistent appearance: check the one stylesheet link, `runtime.js`, and the validated HTML `data-*` appearance attributes.
- Preview unchanged: check the iframe channel/origin handshake and sample screen selection. Preview content is intentionally not a live-data copy.
- Failed publish: distinguish access denial, offline failure, and `DESIGN_CONFLICT`. Never remove the admin guard or concurrency filter to hide an error.
- Public list errors: inspect `data/content.js`, published flags, and module-specific query errors. No fake records are substituted.
- `npm test` uses mocks only; `npm run check` verifies syntax, imports, comment headers, and single-stylesheet separation. `npm run verify:live` is read-only.
- Authenticated publishing, account signup, and password activation require a separate owner-approved live test; do not claim these were exercised just because the mock tests passed.

## Generated share image

Built-in image generation created `assets/images/social-card.png`, a landscape forest-green/off-white/gold typography card. Prompt: “BRGYWEBLITEV3”, “Barangay Sibulan”, “Public information & services”; restrained government digital identity; no seal, people, credentials, or browser screenshot. This is a static share card, not a government seal or a real barangay photograph.
