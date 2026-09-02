# Staff feature verification — 2026-09-02

The shared admin dashboard was visually inspected in Design Studio and its mobile frame measured 375px content width / 375px scroll width. Public verification loaded the existing barangay identity, original ID-number-plus-last-name form, camera-off default, and saved-QR input.

Automated tests cover actual form submit handlers, error retention, safe table/result rendering, cover max-five validation and atomic merge, role checks on usage cache hits, original expiry rules, production QR URL construction, and decoding a generated QR with an independent decoder.

The existing database timezone was read as UTC; dashboard expiry boundaries match it, and the public result trusts the original RPC's returned status. No existing table, policy, RPC, account, token or record was changed.

Not exercised against production: authenticated save/delete/upload, invitation/approval emails, actual camera hardware scanning, and printing a physical QR. These actions require the user's normal staff session or hardware and were not simulated as production successes. Billing, plan quotas, database disk size and bandwidth are not connected, and are explicitly labeled unavailable rather than zero.
