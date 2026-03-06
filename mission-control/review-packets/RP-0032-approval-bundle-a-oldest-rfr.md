# RP-0032 — Approval Bundle A (Oldest Ready for Review Set)

- **Date (UTC):** 2026-03-06 11:40
- **Linked task:** TASK-0100
- **Scope:** oldest 10 Ready for Review items (age-priority triage)

## Bundle Summary
- Objective: reduce oldest approval debt first and clear foundational v2 compatibility chain.
- Recommendation: approve as a grouped tranche unless a specific item has unresolved test evidence concerns.

## Items + One-Line Decision Guidance
- **TASK-0014** — TS-A1.1 Create DeckSpec v2 schema + defaults  
  Recommendation: **Approve** | Risk note: Low; implementation complete, awaiting governance sign-off.
- **TASK-0015** — TS-A1.2 Implement deck resolver by selectors  
  Recommendation: **Approve** | Risk note: Low; implementation complete, awaiting governance sign-off.
- **TASK-0047** — TS-A2.1a.1 Define legacy layout -> templateId mapping table  
  Recommendation: **Approve** | Risk note: Low; implementation complete, awaiting governance sign-off.
- **TASK-0048** — TS-A2.1a.2 Implement fallback resolver for missing/unknown layouts  
  Recommendation: **Approve** | Risk note: Low; implementation complete, awaiting governance sign-off.
- **TASK-0049** — TS-A2.1a.3 Wire mapper integration path + smoke test  
  Recommendation: **Approve** | Risk note: Low; implementation complete, awaiting governance sign-off.
- **TASK-0050** — TS-A2.1b.1 Define SlideSpec v2 slot schema + mapper contract  
  Recommendation: **Approve** | Risk note: Low; implementation complete, awaiting governance sign-off.
- **TASK-0051** — TS-A2.1b.2 Implement legacy title/bullets/imagePrompt -> slots mapper  
  Recommendation: **Approve** | Risk note: Low; implementation complete, awaiting governance sign-off.
- **TASK-0052** — TS-A2.1b.3 Persist slot normalization + add smoke verify endpoint  
  Recommendation: **Approve** | Risk note: Low; implementation complete, awaiting governance sign-off.
- **TASK-0067** — TS-SBP1.1 Create Beacon Doctrine spec + examples  
  Recommendation: **Approve** | Risk note: Low-moderate; policy content should be tone-checked before broad use.
- **TASK-0068** — TS-SBP1.2 Implement lint guardrails for Rule A/Rule B  
  Recommendation: **Approve** | Risk note: Low-moderate; policy content should be tone-checked before broad use.

## Why this bundle first
- These are the oldest queued review items and represent accumulated governance debt.
- Clearing them improves board signal quality and prevents foundational work from being stranded.

## Decision Gate
- Isaac: approve/defer each item, or approve bundle-as-a-set with exceptions explicitly listed.
