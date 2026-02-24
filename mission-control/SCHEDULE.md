# Schedule & Dependency Plan
Timezone: America/New_York

## Daily Timers
- 06:30 ET — Run Workflow A (Buyer/Pressure Monitor)
- 07:00 ET — Run Workflow B (Salesforce Target Queue)
- 07:15 ET — Deliver Morning Brief
- 19:00 ET — Send Artifact Factory intake prompt
- 23:00 ET — Run Workflow C (Artifact Factory) on queued tasks only

## Dependencies
- Morning Brief should include outputs from A and B.
- If A or B is delayed, mark section as Partial with reason and ETA.
- Workflow C runs only when queue exists by 23:00 ET.

## State Rules
- Board columns: Backlog → In Progress → Ready for Review → Done
- No item moves to Done without Isaac explicit approval.
