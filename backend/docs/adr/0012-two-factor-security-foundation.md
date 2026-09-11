# ADR 0012: Two-Factor Security Foundation

## Status

Accepted on 2026-09-11.

## Decision

- Store one `TwoFactorCredential` per user instead of adding secret and backup
  code fields directly to `User`. A credential remains pending while
  `enabledAt` is null.
- Store every recovery code as a separate `TwoFactorBackupCode` row with a
  nullable `consumedAt` timestamp. This supports transactional, single-use
  consumption without rewriting a serialized list.
- Generate 160-bit Base32 TOTP secrets with `otplib`. Use the authenticator-app
  interoperability defaults: HMAC-SHA-1, six digits, and a 30-second period.
- Accept only the current TOTP period or up to 30 seconds of past clock drift.
  Never accept a future period. Persist the successful time step so subsequent
  verification can reject replay of the same code.
- Encrypt TOTP secrets at rest with AES-256-GCM and a random 96-bit
  initialization vector. Authenticate the user ID and key version as additional
  data so ciphertext cannot be moved between accounts or key versions.
- Load the current 32-byte encryption key from a canonical base64 environment
  value. Require an explicit key in production and store its positive integer
  version with every credential.
- Generate ten recovery codes with 80 bits of entropy each, using an alphabet
  that omits ambiguous characters. Return plaintext only at generation time.
- Store only user-bound HMAC-SHA-256 recovery-code hashes. Derive the HMAC key
  from the encryption key with HKDF-SHA-256 and a purpose-specific context.

## Consequences

The database alone does not disclose TOTP secrets or usable recovery codes. An
attacker must obtain both the database and the application encryption key to
recover a TOTP secret or test recovery codes efficiently. Authenticated
encryption also detects modification and account-to-account ciphertext swaps.

Changing `TWO_FACTOR_ENCRYPTION_KEY_VERSION` without re-encrypting existing
credentials makes those credentials unreadable. A production rotation must
therefore retain the previous key during a controlled re-encryption process;
recovery-code hashes must remain verifiable with the credential's prior key
version or be replaced with a newly generated set. That operational workflow is
deferred until multiple active key versions are required.

This phase provides storage and cryptographic primitives only. Setup,
verification, login challenges, step-up re-authentication, transactional backup
code consumption, and audit events are built on this foundation in subsequent
phases.
