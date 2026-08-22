# SEC-16 — Password Security Hardening

Date: 2026-08-22

## Decision

Do not upgrade Supabase solely for leaked-password protection. Supabase's native leaked-password protection is a Pro+ feature. VENCIVO uses the free Have I Been Pwned Pwned Passwords range API through a privacy-preserving k-anonymity flow.

## Privacy model

1. Browser receives the password only in the password input.
2. Browser computes SHA-1 locally using Web Crypto.
3. Browser sends only the first five hash characters to `/api/pwned-password-range`.
4. The VENCIVO backend forwards only that five-character prefix to HIBP.
5. Backend adds the required identifying User-Agent and response padding.
6. Browser searches the returned suffix list locally for the remaining hash.
7. The password, full hash, and HIBP API key are never sent or stored by VENCIVO.

The Pwned Passwords API is free and supports k-anonymity; HIBP requires a User-Agent on API requests and supports CORS for the non-authenticated Pwned Passwords API. The backend proxy is used so the browser does not need to spoof or set a forbidden User-Agent header.

## Policy

- Minimum 12 characters for new passwords.
- At least one lowercase letter.
- At least one uppercase letter.
- At least one digit.
- At least one symbol.
- Known compromised passwords are rejected.
- If the HIBP verification service is unavailable, signup/password reset fails closed rather than silently skipping the security check.

## Abuse controls

`/api/pwned-password-range` has a durable Supabase `rate_limit_hit` gate of 30 requests/hour per client IP and fails closed if the rate-limit dependency is unavailable.

## Covered flows

- New account signup in `conta.html`.
- Password reset in `redefinir-senha.html`.

Existing login does not verify the current password against HIBP because doing so would require handling the user's existing password on every login and would add no benefit after a successful authentication. Password changes are checked before `updateUser`.

## Tests

`tests/sec-16-password-security.test.js` is dependency-free and verifies:

- 12-character/mixed-class policy;
- five-character hash prefix boundary;
- local hashing before the request;
- HIBP proxy User-Agent and padding;
- durable rate-limit gate;
- no password/full-hash logging or transmission;
- signup and reset integration;
- subscription cancellation route regression.

## Production rule

This branch must pass the local SEC-16 test suite before merge. Do not execute a real password signup/reset against production as an automated test. A manual browser smoke test may use a dedicated test account and a non-sensitive test password.
