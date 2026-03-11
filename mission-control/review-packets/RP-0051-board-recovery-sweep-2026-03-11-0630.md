# RP-0051 — Board Recovery Sweep (2026-03-11 06:30 UTC)

## Objective
Collapse aging Ready-for-Review queue by shipping a high-leverage decision tranche of the 12 oldest items.

## Tranche-D (Oldest 12 RFR)
1. **TASK-0014** — TS-A1.1 Create DeckSpec v2 schema + defaults
   - Age: 246.6h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

2. **TASK-0015** — TS-A1.2 Implement deck resolver by selectors
   - Age: 246.5h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

3. **TASK-0047** — TS-A2.1a.1 Define legacy layout -> templateId mapping table
   - Age: 244.9h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

4. **TASK-0048** — TS-A2.1a.2 Implement fallback resolver for missing/unknown layouts
   - Age: 244.8h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

5. **TASK-0049** — TS-A2.1a.3 Wire mapper integration path + smoke test
   - Age: 244.8h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

6. **TASK-0050** — TS-A2.1b.1 Define SlideSpec v2 slot schema + mapper contract
   - Age: 243.9h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

7. **TASK-0051** — TS-A2.1b.2 Implement legacy title/bullets/imagePrompt -> slots mapper
   - Age: 223.5h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

8. **TASK-0052** — TS-A2.1b.3 Persist slot normalization + add smoke verify endpoint
   - Age: 223.5h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

9. **TASK-0067** — TS-SBP1.1 Create Beacon Doctrine spec + examples
   - Age: 205.6h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

10. **TASK-0068** — TS-SBP1.2 Implement lint guardrails for Rule A/Rule B
   - Age: 205.0h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

11. **TASK-0078** — TS-SBP2.1a Create beacon queue schema and storage file
   - Age: 204.2h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

12. **TASK-0079** — TS-SBP2.1b Add beacon create endpoint + validation
   - Age: 203.8h
   - Recommendation: **Approve**
   - Why: Aging item with completed implementation notes; approval clears long-tail queue pressure.

## Decision Prompt
- Isaac: reply with **Approve all**, or list specific defers as TASK-XXXX defer (reason).

## Expected Unblock Effect
- Reduces oldest RFR tail immediately and increases signal quality for remaining truly blocked chain (credentialed smoke path).
