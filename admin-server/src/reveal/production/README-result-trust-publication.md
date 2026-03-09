# Reveal Result Trust Publication (Phase 2)

Deterministic rules for produced-output trust publications:

1. Head digest uses canonical publication head payload (`result-head-core`) with stable key ordering.
2. Signing payload uses canonical publication content (`result-trust-publication-core`) and excludes transport/runtime fields.
3. Numeric precision normalized to 6 decimals.
4. Arrays preserve semantic order.
5. `undefined` removed; `null` preserved.

Result head digest includes:
- latestExecutionResultArtifactId
- latestResultArtifactDigest
- latestResultArtifactType
- sourceExecutionReceiptId
- sourceProviderSubmissionContractId
- providerType/providerProfileId
- previousPublishedResultHeadDigest
- publicationVersion

Unsigned signing fallback is explicit via `resultTrustPublicationSignatureStatus=unsigned` + `unsignedReason`.
