# MEETING_MINUTES_PROTOCOL.md

Purpose: standardize how future sessions ingest Isaac-provided meeting minutes into the dashboard data model.

## Storage Location
- Canonical file: `dashboard/data/meeting_minutes.json`
- Format: JSON array of meeting minute objects

## Required Fields (minimum)
```json
{
  "meeting_id": "MM-YYYY-MM-DD-<slug>-001",
  "date_time": "2026-03-19T12:00:00Z",
  "title": "Meeting title",
  "participants": ["Name / Org"],
  "summary": "3-6 sentence concise summary",
  "initiative_ids": [],
  "buyer_ids": [],
  "signal_ids": [],
  "decisions": [],
  "next_actions": [
    {
      "action": "Action statement",
      "owner": "Owner",
      "due": "YYYY-MM-DD",
      "status": "open"
    }
  ],
  "risks": [],
  "source": {
    "type": "isaac_direct",
    "notes": "Copied from user-provided minutes"
  },
  "created_at": "2026-03-19T12:00:00Z",
  "updated_at": "2026-03-19T12:00:00Z"
}
```

## Linking Rules
When Isaac shares meeting minutes, always map links where applicable:
1. `initiative_ids` -> IDs in `dashboard/data/initiatives.json`
2. `buyer_ids` -> IDs in `dashboard/data/buyers.json`
3. `signal_ids` -> IDs in `dashboard/data/signals.json` for validated/disputed/new signals
4. Optional references to paths/actors can be added in `notes` or extended fields if needed

## Ingestion Workflow
1. Parse the minutes into:
   - Observations
   - Decisions
   - Risks
   - Next Actions (owner + due)
2. Resolve object links (`initiative_ids`, `buyer_ids`, `signal_ids`) from existing registries.
3. Append new record to `meeting_minutes.json` (do not overwrite historical entries).
4. If minutes change a signal/buyer/initiative state, update those files in the same commit.
5. Commit with message format:
   - `Add meeting minutes: <meeting_id>`
   - or `Add meeting minutes + linked object updates: <meeting_id>`

## Default Status Values
- `next_actions[].status`: `open` | `in_progress` | `blocked` | `done`
- Meeting-level status can be added later if needed, but is not required for ingestion.

## Notes for Future Sessions
- If Isaac provides partial notes, ingest with best available structure and mark unknowns explicitly (`"TBD"` or empty arrays).
- Preserve Isaac wording for strategic claims; normalize formatting only.
- Keep minutes factual and decision-oriented; avoid speculative interpretation.
