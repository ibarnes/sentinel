# Airtable Formula Snippets

## Pipeline formulas

### Follow-Up Queue Flag
```airtable
IF(
  AND(
    {Follow-Up Date},
    {Follow-Up Date}<=TODAY(),
    {Status}!="Dead / Not Now"
  ),
  "Yes",
  "No"
)
```

### Handoff Ready (formula version)
```airtable
IF(
  AND(
    {Deal Mentioned}="Yes",
    OR({Live Deal Score}="4 Qualified Live Deal", {Live Deal Score}="5 Deal Review Ready"),
    OR({Urgency}="Medium", {Urgency}="High"),
    {Blocker Category}!=BLANK(),
    OR(
      {Decision-Maker Known}="Yes",
      {Budget Path}="Clear",
      {Budget Path}="Possible"
    )
  ),
  "Yes",
  "No"
)
```

### Stage sync for paid review
Use automation (not formula):
- Trigger when `Converted to Paid Review = Yes`
- Action `Update record: Status = Paid Deal Review`

---

## Conversion formulas (dashboard)
Create in a metrics table or interface computed values:

```text
Contacted to Reply = Replies Received / Messages Sent
Reply to Deal Mention = Deal Mentions / Replies Received
Deal Mention to Possible = Possible Live Deals / Deal Mentions
Possible to Qualified = Qualified Live Deals / Possible Live Deals
Qualified to Handoff = Deal Review Handoffs / Qualified Live Deals
Handoff to Paid = Paid Deal Reviews / Deal Review Handoffs
```

Use safe divide pattern where needed:
```airtable
IF({Denominator}>0,{Numerator}/{Denominator},0)
```
