# Internal Admin Dashboard - Deployment Guide

## Overview

The internal admin dashboard is a founder-only tool for monitoring store metrics, managing health scores, and administering trial extensions. It's protected by password authentication and hidden from merchants.

**Route:** `https://shopmate-ai-helper-production.up.railway.app/internal-admin?password=YOUR_PASSWORD`

---

## Deployment Steps

### 1. **Create Prisma Migration on Railway**

The schema has already been updated locally. When Railway redeploys, you need to run the migration:

```bash
# On your local machine, create the migration file
npx prisma migrate dev --name add_admin_dashboard_fields

# Push changes to GitHub
git push origin main
```

Railway will automatically:
1. Pull the latest code from GitHub
2. Build the app
3. Run `npm run setup` which executes `prisma migrate deploy`

This will apply the schema changes to the production PostgreSQL database.

### 2. **Verify Environment Variable**

Ensure `ADMIN_PASSWORD` is set in Railway:

1. Go to Railway dashboard → ShopMate AI project
2. Navigate to **Variables**
3. Add/verify: `ADMIN_PASSWORD=YOUR_SECRET_PASSWORD`
4. Redeploy the app

### 3. **Test the Dashboard**

Once deployed, visit:
```
https://shopmate-ai-helper-production.up.railway.app/internal-admin?password=YOUR_PASSWORD
```

If the password is correct, you should see:
- Global stats cards (Total Stores, Active Plans, Deflection %, At Risk)
- Searchable/sortable stores table
- Click any store row to expand details

---

## Features

### Global Overview Cards
- **Total Stores:** Count of all ShopSettings rows
- **Active (Pro):** Count of stores with `plan = "pro"`
- **Avg Deflection:** Average deflection % across all stores
- **At Risk:** Count of stores with `healthScore = "red"`

### Stores Table
**Columns:**
- **Domain:** Shop name (clickable to expand)
- **Plan:** "free" or "pro" (color-coded badge)
- **Health:** Color indicator (green/yellow/red)
- **Active:** Last activity time (relative: "5m ago", "2d ago", etc.)
- **Chats:** Total conversations for this store
- **Revenue:** Total AI-attributed revenue ($)

**Sorting:**
- Domain (A-Z)
- Plan (free/pro)
- Health Score (red/yellow/green)
- Revenue (high to low)

**Search:** Filter by shop domain (case-insensitive)

### Inline Store Details (Expandable)

Click any store row to reveal:

#### Store Metrics (left column)
- Total Chats
- AI Revenue (green highlighted)
- Deflection Rate (%)
- Trial End Date (if applicable)

#### Admin Controls (right column)
- **Widget Toggle:** Turn merchant's chat widget on/off
- **Extend Trial:** Add 7 days to trial (free plans only)
- **Health Score Dropdown:** Override calculated health (green/yellow/red)

#### Internal Notes (bottom)
- Text area for private admin notes
- Auto-saves on blur (no submit button)
- Visible only to admin

---

## Schema Changes

### New Fields in `ShopSettings` Model

```prisma
// Private notes visible only to admin
internalNotes   String?

// Last time merchant accessed the app
lastActiveAt    DateTime?

// Cumulative attributed revenue (populated by orders webhook)
totalAiRevenue  Float     @default(0)

// Health status: "green" | "yellow" | "red"
healthScore     String    @default("green")

// Can admin disable the widget?
widgetEnabled   Boolean   @default(true)

// When does the trial expire?
trialEndsAt     DateTime?
```

---

## Health Score Logic

Automatically calculated based on:

| Criteria | Score |
|----------|-------|
| Inactive 30+ days OR (free plan + 0 chats) | 🔴 Red |
| Inactive 7-29 days | 🟡 Yellow |
| Active within last 7 days | 🟢 Green |

**Override:** Admin can manually set health score via dropdown in store details.

---

## Usage Examples

### Extend a Trial for a Promising Free User
1. Search for their shop domain
2. Click the row to expand
3. Click **"Extend Trial +7d"** button
4. Trial end date updates immediately

### Track Revenue Attribution
- **totalAiRevenue** field is populated by the `orders/create` webhook
- Tracks cumulative revenue attributed to product recommendations in chat
- Updated automatically when customers complete orders within 24h of clicking a product

### Monitor At-Risk Stores
1. Check the **"At Risk"** card for count
2. Sort by Health Score to see all red-status stores first
3. Add notes like "Customer churned" or "Follow up scheduled"
4. Use notes for your own record-keeping

### Disable Widget for Spammy Store
1. Find the store
2. Click the **"Widget: ON"** button to toggle off
3. Chat widget disappears from their storefront immediately

---

## API Actions

All dashboard actions POST to the same route with form data:

### Update Internal Notes
```
_action=update-notes
shopId=<id>
notes=<text>
```

### Toggle Widget
```
_action=toggle-widget
shopId=<id>
enabled=<true|false>
```

### Extend Trial
```
_action=extend-trial
shopId=<id>
```

### Update Health Score
```
_action=update-health
shopId=<id>
healthScore=<green|yellow|red>
```

---

## Security

✅ **Password Protected:** Only accessible with `?password=` matching `ADMIN_PASSWORD`
✅ **No Merchant Access:** Completely separate from merchant-facing app
✅ **Read/Write Control:** Only founder should have the password
✅ **Private Notes:** Only visible to admin

---

## Troubleshooting

### Dashboard Shows 404
- ✓ Check password in URL matches Railway `ADMIN_PASSWORD` var
- ✓ Verify you're on the correct production URL

### Store Metrics Not Updating
- ✓ Ensure Conversation/Message records exist in DB
- ✓ Check that `lastActiveAt` is populated when merchants use the app

### Trial Extension Button Missing
- ✓ Button only shows for `plan = "free"` stores
- ✓ Pro plan stores don't have trial extensions

### Notes Not Saving
- ✓ Verify you're not on a 404 (password error)
- ✓ Check browser console for form submission errors

---

## Future Enhancements

- [ ] Bulk actions (extend multiple trials, toggle multiple widgets)
- [ ] Charts: revenue over time, chat volume trends
- [ ] Feedback inbox: display submitted feedback messages
- [ ] Export stores to CSV
- [ ] Webhook health monitoring
- [ ] Churn prediction flagging

---

## Code Location

- **Route:** `app/routes/internal-admin.tsx`
- **Schema:** `prisma/schema.prisma` (ShopSettings model)
- **Environment:** Set `ADMIN_PASSWORD` in Railway Variables

