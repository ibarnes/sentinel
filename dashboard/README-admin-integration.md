# Dashboard Integration Note (Last Updated Block)

Add this block in your dashboard HTML where you want read-only UOS freshness info:

```html
<div id="uos-last-updated">Loading…</div>
<script src="/dashboard/public/last-updated.js"></script>
```

The script reads `/dashboard/state/state.json`.
