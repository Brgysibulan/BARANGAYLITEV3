# Design Studio verification — 2026-09-02

## Automated and read-only checks

- 73 automated tests pass: existing account/data contracts, all five preset definitions, unsafe style input, fresh reset defaults, sampled text contrast, namespace preservation, admin-only writes, NULL/equality baseline filters, conflict/error responses, search, cover validation/concurrency, typed edit forms, unchanged ID rules, missing usage, XSS-safe rendering and independent QR decode round-trip.
- Page Settings/maintenance regressions cover actual controllers with fake services: homepage editing, confirmation-only flag updates, blank notice defaults, denied saves, write-free previews, safe post-login destinations, initial/open-page maintenance, failure recovery, deduplicated reads, suppressed content/QR requests, and late-response/camera cleanup. The live maintenance flag was only read, not toggled.
- The added secondary picker has unit coverage for old-theme compatibility, unsafe/invalid colors, independent runtime contrast pairs, picker/hex synchronization, preview messages, discard/reset, and confirmation-only publishing. English empty/login copy and unchanged stored content are also tested.
- Static validation passes: JavaScript syntax, module paths, debugging headers, all HTML script references, English language metadata on every HTML shell, exactly one central stylesheet per shell, and no DOM/presentation side effects in data/auth services.
- Live read-only checks pass for the existing settings/theme fields, baseline filter, all eight public content modules, private-table anonymous restrictions, and pinned Supabase SDK.
- Read-only account verification still finds the existing two Auth users and one active System Admin. The live design field remains unchanged (NULL).

## Earlier browser checks performed

- Switched all five layouts and inspected their distinct public section orders.
- Public mobile preview and all five other preview screen types fit the 390px frame (375px content viewport with scrollbar), with no horizontal content overflow in the measured previews.
- Preview Login, Signup/Application, and Activation form submission buttons stay disabled.
- Custom white primary color updates immediately and derives black button text; reset restores Modern LGU. A delayed hex-input change was found and fixed with input/blur handlers.
- Actual public data loads with the existing Sibulan identity/logo and published announcement; empty modules show honest empty states, not demo content.
- Public Services navigation and service-name search work against the published-data query. Staff login link opens the existing-account form. Navigation now returns to the top after route changes.
- The unauthenticated admin Design Studio route remains locked without private navigation or publishing controls.
- The existing Supabase theme and account records were not changed during these tests.

## Not claimed as verified

No authenticated live theme publish, new application, account activation/password update, or invitation email delivery was performed. These need owner approval and a suitable account/session. The secondary picker was tested with the mocked DOM, not a new browser interaction session. Website code is published separately through the existing GitHub Pages workflow. Test results are not a guarantee of zero defects in every device or environment.
