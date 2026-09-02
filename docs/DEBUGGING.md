# Saan titingin kapag may problema

Para sa CSS, five-layout presets, preview, at safe publishing, basahin ang [Design Studio guide](DESIGN-STUDIO.md). Iisa lang ang stylesheet: `assets/css/design-system.css`. Ang bago o binagong code ay may Purpose/dependencies/Debug comments.

May `Purpose`, dependencies, at `Debug` notes sa simula ng bawat JavaScript module. May comments din sa safeguards at request flow. Huwag burahin ang safeguard para lamang mawala ang error; hanapin muna kung saan talaga pumalya ang request.

## Mabilis na mapa

| Problema | Unang titingnan | Susunod na check |
| --- | --- | --- |
| Hindi bumubukas ang localhost preview | Output ng `npm run dev` | Gamitin ang eksaktong URL na inilabas; hindi gagana ang lumang URL kapag patay na ang server |
| Hindi ma-load ang Supabase SDK | `assets/js/core/client.js`, HTML script URL | Network/CDN availability at pinned version sa `core/config.js` |
| Ayaw mag-login | `assets/js/login.js`, `core/auth.js` | Auth response, matching `profiles.user_id`, active status, at tamang role |
| Mali ang admin destination/access | `core/auth.js`, `staff/workspace.js` | Live profile ang basehan; hindi user metadata o cached role |
| Blank o kulang ang content | `data/contracts.js`, `data/content.js` | Table/column name, public flag, pagination, at RLS error |
| Hindi tama ang profile/settings | `data/settings.js` | `site_settings.id=1` at existing `barangay-*` slugs; hindi legacy CSS/theme |
| Ayaw mag-verify ng ID/QR | `data/verification.js` | Tamang RPC arguments o existing QR token; huwag i-public ang private table |
| Upload/save problem | `data/storage.js` | Bucket policy, allowed file type/size, at `error.retainedUpload` |
| Content Admin approval problem | `data/editors.js` | `manage-editors` action, server error, System Admin role, at activation redirect configuration |
| Signup/activation problem | `data/applications.js` | Aling stage ang pumalya: eligibility, Auth signup, application insert, o activation |
| Lumang data ang bumabalik paglipat ng page | `core/router.js`, `staff/workspace.js` | `isCurrent()` at request sequence checks pagkatapos ng awaited calls |

## Daloy ng code

1. Ang HTML shell ang naglo-load ng pinned SDK at entry module.
2. Ang entry module ay kumukuha ng services mula sa `core/services.js`.
3. Ang `core/auth.js` ang nagva-validate ng user at kasalukuyang staff profile.
4. Ang module sa `data/` ang gumagawa ng request sa existing Supabase resources.
5. Ang existing RLS/Edge Function rules ang tunay na nagpapatupad ng permissions.
6. Ang public/staff view ang nagpapakita ng resulta o error. Hindi nito binabago ang permissions.

## Safe na checks

```sh
npm test
npm run check
```

Mocked lang ang tests. Walang live account o record na babaguhin. Ang source checker ay tumitingin sa syntax, imports, script URLs, module headers, at separation ng logic at presentation.

Kung kailangang kumpirmahin ang public connection at privacy restrictions:

```sh
npm run verify:live
```

Read-only ito. Hindi ito patunay na gumagana na ang actual password login, authenticated writes, uploads, o approval actions; hiwalay na end-to-end verification ang mga iyon.

## Importanteng debugging rules

- Huwag ilagay sa logs/comments ang password, session token, secret key, o private resident details.
- Kapag denied ang request, tingnan ang tunay na role at server rules. Huwag alisin ang RLS o gumamit ng service-role key sa browser.
- Kapag may `retainedUpload`, huwag agad mag-retry o mag-delete. Posibleng na-save ang record pero nawala ang response. Kumpirmahin muna ang existing record at file reference.
- Ang V3 at lumang website ay parehong database. Ang tunay na save/delete ay makaaapekto sa shared records.
- Read-only pa ang kasalukuyang screens. Ang kawalan ng edit/upload buttons ay hindi bug sa data connection; nasa susunod na UI integration pa ang mga iyon.
- Kapag binago ang behavior, baguhin din ang katabing comment at kaugnay na test.
