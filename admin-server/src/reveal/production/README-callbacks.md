# Reveal Execution Callbacks (Phase 2)

Canonicalization rules used for callback digests, signature scope, and reconciliation comparison:

1. Stable key ordering for all objects (lexicographic).
2. Numeric precision normalized to 6 decimal places.
3. Arrays preserve semantic order (no sorting).
4. `undefined` values are removed, `null` is preserved.
5. Transient transport fields (`transportId`, `requestId`, `headers`, `receivedAt`) are excluded unless explicitly included by future verification scopes.

Digest/signature scope: `callback-payload-core` (canonicalized callback payload).

Unsigned callbacks are only accepted when policy allows (`dev` default) or `trustMetadata.unsignedAllowed=true`; this is recorded as warning and trust origin status `unsigned`.

Policy profiles:
- `dev`: permissive, duplicate replays usually idempotent-ignore.
- `internal_verified`: key-registry verification for signed callbacks and conflicting replay blocking.
- `production_verified`: strict signature + key registry + replay hard blocking.
