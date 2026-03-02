# Beacon Lint Guardrails (TS-SBP1.2)

## Purpose
Reject Sponsor Beacon drafts that violate:
- Rule A: No future-tense authority claims
- Rule B: No embedded mandate offer / CTA

## Usage

### Lint direct text
```bash
python3 mission-control/beacon/lint_beacon.py "Capital hesitates when FID boundary is undefined."
```

### Lint a draft file
```bash
python3 mission-control/beacon/lint_beacon.py mission-control/beacon/examples/weak.txt
```

## Output contract
JSON object:
- `status`: `PASS` | `REJECT`
- `violationCount`: integer
- `violations[]`: list of `{rule, phrase, description}`

Exit codes:
- `0` = PASS
- `2` = REJECT

## Reviewer flow
1. Draft beacon text.
2. Run linter.
3. If `REJECT`, revise until `PASS`.
4. Submit only PASS drafts to approval gate.

## Fixtures
- `examples/weak.txt` -> REJECT (Rule A/B)
- `examples/soft-term-fail.txt` -> REJECT (L1 soft-term dictionary)
- `examples/hard-term-fail.txt` -> REJECT (L2 insufficient hard-term matches)
- `examples/hard-term-pass.txt` -> PASS (meets hard-term threshold)
