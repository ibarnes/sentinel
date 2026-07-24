# USG Asset Register (v1)

A governed register for value-bearing assets across initiatives. This is not CRM and not a lead list.

## Canonical files

- dashboard/schemas/asset-register.v1.schema.json
- dashboard/data/asset_register.json

## Asset definition

Each record must answer:

1. What is the asset?
2. Who controls it?
3. What value is trapped?
4. Why has it not moved?
5. What release conditions unlock movement?
6. What does it convert into?
7. What can USG capture?

## Operating rules

- No asset can be marked released or converted without evidence on all open release conditions.
- connector_only assets cannot be assigned to investor or capital roles.
- Sensitive assets require explicit owner and next_action on each update.
- Every release condition must include owner, due_date, and evidence_required.

## Suggested daily cadence

1. Add new assets discovered in briefs, calls, or initiative updates.
2. Update status.stage, next_action, and release condition states.
3. Escalate assets stuck with unchanged open conditions for more than 14 days.
4. Cross-check with initiative constraints and actor assignment policy.

## Initial integration targets

- Initiative cards should show related asset_id values.
- Constraint sweeps should include an asset release conditions due section.
- Commercial pipeline should map conversion_paths and usg_capture_options into fee architecture decisions.
