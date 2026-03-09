# Reveal Execution Result Artifacts (Phase 2)

Deterministic canonicalization rules for result artifact ingestion:

1. Stable key ordering for all objects.
2. Numeric precision normalized to 6 decimals.
3. Array order preserved.
4. `undefined` removed, `null` preserved.
5. Transient runtime/transport fields (`transportId`, `requestId`, `headers`, `runtimeMs`, `receivedAt`) excluded from digest/signature scope unless explicitly added in future scope versions.

Digest/signature scope: `result-artifact-payload-core`.

Trust handling:
- Signed artifacts use key-registry resolution by signing key id + provider profile.
- Unsigned artifacts are accepted only when policy permits (`dev` or explicit `unsignedAllowed=true`).
