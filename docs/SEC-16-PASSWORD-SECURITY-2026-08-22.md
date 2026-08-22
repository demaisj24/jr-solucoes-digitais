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

The Pwned Passwords API is free and supports k-anonymity; HIBP requires a User-Agent on API requests. The backend proxy is used so the browser does not need to set a restricted User-Agent header.

## Policy

- Minimum 8 characters for new passwords.
- No mandatory uppercase/lowercase/digit/symbol composition rules.
- Encourage longer, unique passwords in the UI.
- Known compromised passwords are rejected.
- If the HIBP verification service is unavailable, signup/password reset fails closed rather than silently skipping the security check.

This policy deliberately separates password strength from arbitrary composition requirements. The goal is strong protection with lower signup/reset friction. Administrative accounts will receive stronger controls such as mandatory MFA and step-up authentication in the later admin-security phase.

## Abuse controls

`/api/pwned-password-range` has a durable Supabase `rate_limit_hit` gate of 30 requests/hour per client IP and fails closed if the rate-limit dependency is unavailable.

## Covered flows

- New account signup in `conta.html`.
- Password reset in `redefinir-senha.html`.

Existing login does not verify the current password against HIBP because doing so would require handling the user's existing password on every login and would add no benefit after a successful authentication. Password changes are checked before `updateUser`.

## Tests

`tests/sec-16-password-security.test.js` is dependency-free and verifies:

- 8-character minimum without composition rules;
- five-character hash prefix boundary;
- local hashing before the request;
- HIBP proxy User-Agent and padding;
- durable rate-limit gate;
- no password/full-hash logging or transmission;
- signup and reset integration;
- UI consistency with the 8+ policy;
- subscription cancellation route regression.

## Production rule

This branch must pass the local SEC-16 test suite before merge. Do not execute a real password signup/reset against production as an automated test. A manual browser smoke test may use a dedicated test account and a non-sensitive test password.
