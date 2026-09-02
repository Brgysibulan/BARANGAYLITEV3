# BRGYWEBLITEV3 development rules

## Explain code for maintenance and debugging

The owner requires clear comments whenever code is created or changed.

- Begin each code module with a short header explaining its purpose, dependencies, and the first place to check when debugging it.
- Comment exported functions and non-obvious decisions: authorization, request order, validation, asynchronous state, file retention, and error handling.
- Explain why a safeguard exists, not merely what an obvious statement does. Keep comments close to the relevant code and update them when behavior changes.
- Add brief HTML comments identifying the shell and its entry module. JSON files must remain valid JSON; document their settings in the README instead of adding invalid comments.
- Never put passwords, tokens, private records, or secret keys into comments, examples, logs, or test fixtures.
- Keep `docs/DEBUGGING.md` aligned with the actual module names and flows.

## Preserve the existing system

- Reuse the existing BRGYWEB-LITE Supabase project, accounts, data, permissions, RPCs, and buckets. Do not switch to WebSaaS or create replacement accounts.
- Do not alter live data, reset passwords, modify the schema, or deploy backend changes as part of debugging without a request covering that change.
- Keep data/auth logic separate from presentation. Do not reintroduce legacy CSS/design injectors into the connection layer.
- Validate with `npm test` and `npm run check`. `npm run verify:live` is a read-only network check, not an authenticated write test.
