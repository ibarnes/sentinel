# Reveal (Phase 1 Scaffold)

Product-intelligence capture system at `/reveal`.

## Scope included
- Chrome extension capture scaffold
- API ingestion scaffold
- Deterministic normalization pipeline scaffold
- Reviewed-flow mutation API + persistence
- True highlight rendering pipeline (extension-rendered overlay + persisted assets)
- Coordinate replay debugger endpoint + editor inspector
- Replay integrity checksum + drift detection (step + flow)
- Stage-diff mismatch explainer (first divergence + structured diff)
- Semantic reason refinement for mismatches (rule-based path/stage mapping)
- Semantic sub-reason drilldown (deterministic subtype classification)
- Immutable review snapshots + exportable reviewed/snapshot artifacts (JSON/Markdown)
- Portable package export (`.revealpkg.zip`) for reviewed flows and snapshots

## Semantic mismatch mapping notes
- Rule priority is top-down and deterministic; first matching rule wins.
- Mapping uses diff path + stage + field + reason context only.
- Raw reason/path are always preserved; semantic reason is additive.
- semanticSubReason is applied after semanticReason selection using semantic-specific rules.
- If no semantic rule matches: `semanticReason=unclassified_change`.
- If no sub-rule matches: `semanticSubReason=null`.
- If multiple rules match, first rule is used and ambiguity note is attached.
- Use broad semanticReason for clustering; use semanticSubReason for triage/root-cause hints.

## Mapping test matrix
- Fixture file: `admin-server/src/reveal/normalization/fixtures/semantic-mapping-matrix.json`
- Runner: `node admin-server/src/reveal/normalization/fixtures/run-semantic-mapping-tests.mjs`
- Runner validates:
  - duplicate ids
  - expected semantic/subreason validity
  - orphan sub-reasons
  - full taxonomy coverage
- To add a new semanticReason:
  1) extend taxonomy in `semanticDiffReasonService.js`
  2) add broad rule
  3) add sub-rules
  4) add explicit matrix cases
- To intentionally update outputs after rule changes: update matrix expectations and rerun; keep precedence cases explicit.

## Snapshots + exports
- Snapshot storage: `reveal/storage/review-snapshots/{flowId}/{snapshotId}.json`
- Snapshot routes:
  - `POST /reveal/api/flows/:flowId/snapshots`
  - `GET /reveal/api/flows/:flowId/snapshots`
  - `GET /reveal/api/flows/:flowId/snapshots/:snapshotId`
- Snapshot integrity routes:
  - `GET /reveal/api/flows/:flowId/snapshots/:snapshotId/integrity`
  - `POST /reveal/api/flows/:flowId/snapshots/integrity/recompute`
- Export routes:
  - `GET /reveal/api/flows/:flowId/export?format=json|markdown|package`
  - `GET /reveal/api/flows/:flowId/snapshots/:snapshotId/export?format=json|markdown|package`
- Package format:
  - archive extension: `.revealpkg.zip`
  - deterministic layout:
    - `manifest.json`
    - `reviewed-flow.json` or `snapshot.json`
    - `reviewed-flow.md` or `snapshot.md`
    - `integrity.json`
    - `assets/screenshots/*`
    - `assets/highlights/*`
- Package signature metadata:
  - `signatureStatus` = `signed|unsigned|verification_failed`
  - `packageSignature`, `packageSignatureVersion`, `signingKeyId`, `signingAlgorithm`
  - `signerKeyFingerprint`, `publicKeyAlgorithm`, `publicKeyHint`
  - `trustProfileId`, `trustProfileName`, `trustProfileVersion`, `trustProfileType`, `verificationPolicyVersion`
  - `packageVerificationScope` (exact signed fields)
- Verification metadata routes:
  - `GET /reveal/api/verification/keyset`
  - `GET /reveal/api/verification/keyset/integrity`
  - `GET /reveal/api/verification/trust-profiles`
  - `GET /reveal/api/flows/:flowId/export/verification-metadata`
  - `GET /reveal/api/flows/:flowId/snapshots/:snapshotId/export/verification-metadata`
  - `POST /reveal/api/revealpkg/verify`
- Local signing config (optional):
  - package signing env: `REVEAL_SIGNING_PRIVATE_KEY`, `REVEAL_SIGNING_PUBLIC_KEY`, `REVEAL_SIGNING_KEY_ID`
  - keyset signing env: `REVEAL_KEYSET_SIGNING_PRIVATE_KEY`, `REVEAL_KEYSET_SIGNING_PUBLIC_KEY`, `REVEAL_KEYSET_SIGNING_KEY_ID`
  - trust profile env: `REVEAL_TRUST_PROFILE_ID` (`local_dev|internal_verified|unsigned_export`)
  - additional key metadata env: `REVEAL_ADDITIONAL_KEYS_JSON`
  - file fallback: `reveal/keys/package-signing-private.pem`, `reveal/keys/package-signing-public.pem`, `reveal/keys/keyset-signing-private.pem`, `reveal/keys/keyset-signing-public.pem`

### Keyset continuity + rotation
- Keyset includes chain metadata:
  - `keysetVersion`, `previousKeysetVersion`, `previousKeysetHash`, `keysetChainIndex`
  - `keysetContentHash`, `keysetHashVersion`
  - keyset signature fields (`keysetSignature*`)
- Key lifecycle fields per key:
  - `keyStatus`, `activatedAt`, `retiresAt`, `revokedAt`, `previousKeyId`, `nextKeyId`, `rotationGroupId`, `verificationUse`

## Reveal Flow Player (Phase 2 foundation)
- Modules: `admin-server/src/reveal/player/*`
- UI: `/reveal/player/:flowId` (optionally `?snapshotId=<id>`)
- Stateless API (kept for direct model access):
  - `GET /reveal/api/player/flows/:flowId`
  - `GET /reveal/api/player/snapshots/:snapshotId`
  - `POST /reveal/api/player/packages` (multipart field `package`)
- Stateful Session API:
  - `POST /reveal/api/player/sessions`
  - `GET /reveal/api/player/sessions`
  - `GET /reveal/api/player/sessions/:sessionId`
  - `PATCH /reveal/api/player/sessions/:sessionId`
  - `POST /reveal/api/player/sessions/:sessionId/resume`
  - `DELETE /reveal/api/player/sessions/:sessionId`
  - `POST /reveal/api/player/sessions/sweep`
  - `GET /reveal/api/player/sessions/:sessionId/assets/:kind/:file`
- Session actions: `next`, `prev`, `jump`, `restart`, `play`, `pause`, `setAutoPlay` via `autoPlayEnabled`, `interactHotspot`, `dismissOverlay`.
- Share links + embed:
  - `POST /reveal/api/player/share-links`
  - `GET /reveal/api/player/share-links/:shareId`
  - `GET /reveal/api/player/share-links/:shareId/resolve`
  - `PATCH /reveal/api/player/share-links/:shareId`
  - `DELETE /reveal/api/player/share-links/:shareId`
  - share playback pages: `/reveal/share/:shareId` and `/reveal/share/:shareId/embed`
  - embed modes: `standard_embed | minimal_embed | kiosk_embed`
- Interactive model per step:
  - `hotspots[]` (primary/info/navigation regions)
  - `overlay` (guided title/body/emphasis/progression)
  - `progression` (manual/hotspot/auto rules)
- Narration scripts:
  - `POST /reveal/api/scripts` (flowId|snapshotId|sessionId|package + styleProfile)
  - `GET /reveal/api/scripts/:scriptId`
  - `GET /reveal/api/scripts/:scriptId/export?format=json|markdown`
  - review pipeline:
    - `POST /reveal/api/scripts/:scriptId/review/init`
    - `GET /reveal/api/scripts/:scriptId/review`
    - `PATCH /reveal/api/scripts/:scriptId/review/sections/:sectionId`
    - `POST /reveal/api/scripts/:scriptId/review/sections/reorder`
    - `POST /reveal/api/scripts/:scriptId/review/sections/:sectionId/notes`
    - `PUT /reveal/api/scripts/:scriptId/review`
    - `POST /reveal/api/scripts/:scriptId/review/status`
    - `GET /reveal/api/scripts/:scriptId/review/diff`
    - `POST /reveal/api/scripts/:scriptId/review/snapshots`
    - `GET /reveal/api/scripts/:scriptId/review/snapshots`
    - `GET /reveal/api/scripts/:scriptId/review/snapshots/:reviewedSnapshotId`
    - `GET /reveal/api/scripts/:scriptId/review/audit-report`
    - `GET /reveal/api/scripts/:scriptId/review/export?format=json|markdown&mode=standard|publish_ready`
  - reviewed snapshot integrity:
    - `GET /reveal/api/scripts/:scriptId/review/snapshots/:reviewedSnapshotId/integrity`
    - `POST /reveal/api/scripts/:scriptId/review/snapshots/integrity/recompute`
    - snapshot fields: `reviewedSnapshotContentHash`, `reviewedSnapshotHashVersion=sha256-v1`, `parentReviewedSnapshotId`, `parentReviewedSnapshotContentHash`, `reviewedSnapshotChainIndex`
    - canonical hash rules: sorted keys, undefined removed, null preserved, arrays keep order, numeric values normalized to 6 decimals.
  - trust publications + verifier:
    - `POST /reveal/api/scripts/:scriptId/review/trust-publications`
    - `GET /reveal/api/scripts/:scriptId/review/trust-publications`
    - `GET /reveal/api/scripts/:scriptId/review/trust-publications/latest`
    - `GET /reveal/api/scripts/:scriptId/review/trust-publications/:trustPublicationId`
    - `GET /reveal/api/scripts/:scriptId/review/verify-latest`
    - `GET /reveal/api/scripts/:scriptId/review/export-with-proof?format=json|zip`
    - trust publication canonicalization mirrors deterministic object sort/normalization and signs canonical payload when keys are available.
  - publish gate blocks `mode=publish_ready` export when requirements fail; supports optional `requireLatestReviewedSnapshotIntegrity=1` and `requireLatestTrustPublication=1`.
  - production shot lists:
    - `POST /reveal/api/production/shot-lists`
    - `GET /reveal/api/production/shot-lists/:shotListId`
    - `GET /reveal/api/production/shot-lists/:shotListId/export?format=json|markdown`
    - storage: `reveal/storage/shot-lists/{shotListId}.json`
  - style profiles: `neutral_walkthrough`, `concise_training`, `executive_overview`
- Session lifecycle:
  - TTL + optional idle policy for `playing` sessions
  - in-process sweeper interval (`REVEAL_PLAYER_SWEEP_INTERVAL_MS`)
  - package session cleanup status: `none|pending|cleaned|failed`
  - resume endpoint: `POST /reveal/api/player/sessions/:sessionId/resume`
  - listing filters: `status`, `sourceType`, `flowId`, `snapshotId`, `includeExpired=1`, `recoverable=1`, `sourceRetentionPolicy=...`
- Package source retention policy:
  - `ephemeral_only`
  - `retained_local_source`
  - `retained_package_copy`
  - `non_recoverable`
- Recovery registry fields include `recoverabilityStatus`, `lastRecoveryStatus`, `lastRecoveryAttemptAt`, `recoveryError`.
  - recovery registry: `reveal/storage/player-recovery-registry/*.json`
  - retention policy for package sessions:
    - `ephemeral_only`
    - `retained_local_source`
    - `retained_package_copy`
    - `non_recoverable`
- Fixture runners:
  - `node admin-server/src/reveal/normalization/fixtures/run-player-fixtures.mjs`
  - `node admin-server/src/reveal/normalization/fixtures/run-player-session-fixtures.mjs`

## Reveal CLI
- Entrypoint: `admin-server/src/reveal/cli/reveal-cli.js`
- Test runner: `node admin-server/src/reveal/cli/run-cli-tests.mjs`

### Commands
- `reveal flows list`
- `reveal flows show <flowId>`
- `reveal snapshot create <flowId>`
- `reveal snapshot list <flowId>`
- `reveal snapshot show <flowId> <snapshotId>`
- `reveal export flow <flowId> --format json|markdown|package`
- `reveal export snapshot <flowId> <snapshotId> --format json|markdown|package`
- `reveal package flow <flowId>`
- `reveal package snapshot <flowId> <snapshotId>`
- `reveal verify snapshot <flowId> <snapshotId>`
- `reveal verify package <pathToRevealPkg>`
- `reveal keyset show`
- `reveal keyset verify`

### JSON mode
Add `--json` for deterministic machine output.

### CLI config
- Optional config file: `reveal.config.json` at workspace root (or `REVEAL_CONFIG`).
- Environment/config fields:
  - `serverBaseUrl`
  - `defaultExportDir`
  - signing env vars documented above

### Examples
- `node admin-server/src/reveal/cli/reveal-cli.js snapshot create flow_123 --json`
- `node admin-server/src/reveal/cli/reveal-cli.js export snapshot flow_123 snap_abc --format package --output reveal/exports/flow.revealpkg.zip`
- `node admin-server/src/reveal/cli/reveal-cli.js verify package reveal/exports/flow.revealpkg.zip --summary --json`

### CI exit codes
- `0` success
- `1` verification failure
- `2` malformed package/runtime failure
- `3` missing inputs
- `4` unsupported command

### CI usage sketch
- Build package: `node .../reveal-cli.js package flow <flowId> --output <artifact>`
- Verify package: `node .../reveal-cli.js verify package <artifact> --json`
- Fail pipeline when exit code != 0.
- Snapshot fixture runner: `node admin-server/src/reveal/normalization/fixtures/run-snapshot-fixtures.mjs`

### Snapshot hash canonicalization
- Hash: `sha256` over canonical frozen snapshot payload
- Snapshot hash version: `sha256-v1`
- Rules:
  - stable object key ordering
  - numbers rounded to 6dp
  - semantic arrays keep order
  - `undefined` removed, `null` preserved
  - transient presentation fields excluded (`exportAvailability`)
- Chain model:
  - first snapshot: `snapshotChainIndex=1`, parent fields null
  - later snapshots link `parentSnapshotId` + `parentSnapshotContentHash`
- Flow editor compare mode (baseline vs reviewed diffs)
- Flow editor shell with live reviewed mutations
- Storage conventions for sessions/events/flows/assets

## Storage layout
- `reveal/storage/sessions/{sessionId}.json`
- `reveal/storage/raw-events/{sessionId}.jsonl`
- `reveal/storage/normalized-flows/{flowId}.json`
- `reveal/storage/reviewed-flows/{flowId}.json`
- `reveal/storage/assets/{sessionId}/{stepId}/{before|after|highlight}.jpg`

## Test path
1. Start admin server.
2. Load unpacked extension from `reveal/extension` in Chrome.
3. Click extension action to start recording.
4. Interact with any web app.
5. Click extension action again to stop.
6. Response from `/reveal/api/sessions/:id/stop` returns `flowId`.
7. Open `/reveal/editor/{flowId}`.
