# Calendar Intake (Google Calendar ICS)

This intake is **read-only** and pulls upcoming events from a private Google Calendar ICS URL.

## 1) Get your private ICS URL (Google Calendar)

1. Open Google Calendar in browser.
2. In left sidebar, hover your calendar → `⋮` → **Settings and sharing**.
3. Under **Integrate calendar**, copy the **Secret address in iCal format** URL.

> Treat this URL like a password. Anyone with it can read calendar events.

## 2) Run importer

```bash
GCAL_ICS_URL='<your-secret-ics-url>' node mission-control/calendar/import-upcoming-from-ics.mjs
```

Optional window (days):

```bash
GCAL_ICS_URL='<your-secret-ics-url>' node mission-control/calendar/import-upcoming-from-ics.mjs '' 14
```

Or pass URL as arg:

```bash
node mission-control/calendar/import-upcoming-from-ics.mjs '<your-secret-ics-url>' 21
```

## Output

- `dashboard/data/calendar_events.json`

Contains:
- `generated_at`
- `window_days`
- `total_events_parsed`
- `upcoming_count`
- `events[]` (title, start/end, location, organizer, status)

## Recommended secret handling

- Do **not** commit the ICS URL to git.
- Keep URL in runtime env only.
- Rotate by regenerating secret URL in Google Calendar settings if exposed.
