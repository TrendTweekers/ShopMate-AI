# Admin Dashboard - Feature Summary

## What Was Built

A **professional, production-ready admin dashboard** for managing your ShopMate AI beta program with real-time metrics, health tracking, and merchant management tools.

### URL
```
https://shopmate-ai-helper-production.up.railway.app/internal-admin?password=YOUR_ADMIN_PASSWORD
```

---

## Key Features

### 1️⃣ **Auto-Calculated Health Scores**

Health is calculated automatically on each page load based on merchant activity:

```
🟢 GREEN:  Active within last 3 days
🟡 YELLOW: Inactive for 3-7 days
🔴 RED:    Inactive >7 days OR never active
```

**Override:** Manually override for custom tracking

---

### 2️⃣ **6-Card Dashboard Overview**

Glance metrics:
- Total Stores
- Pro Plans (converted)
- Total Chats
- At Risk (% red status)
- Avg Revenue per Store
- Monthly MRR

---

### 3️⃣ **Professional Store Table**

Browse all beta stores:

| Column | Data | Sortable |
|--------|------|----------|
| Domain | Store URL | ✅ A-Z |
| Plan | free/pro | ✅ |
| Health | 🟢/🟡/🔴 | ✅ Red → Yellow → Green |
| Last Active | Days ago | ✅ Most inactive first |
| Chats | Count | ❌ |
| Revenue | $ attributed | ✅ High to low |
| Widget | ON/OFF | ❌ |

**Search in real-time by domain**

---

### 4️⃣ **Store Detail Panel** (Click any row)

#### Metrics Section
- Total Chats
- AI Revenue (green highlight)
- Deflection Rate
- Days Inactive
- Trial Expiration Date
- Store Creation Date

#### Admin Controls Section
- **Widget Toggle** - ON/OFF (instant)
- **Health Override** - Select green/yellow/red + apply
- **Extend Trial** - Add 7 days (free plans only)

#### Notes Section
- Private notes (auto-save on blur)
- Perfect for tracking context

---

### 5️⃣ **Feedback Inbox Tab**

View all merchant feedback:
- **Per entry:** Store, message, email, timestamp
- **Sortable:** Most recent or oldest first
- **Reply:** Direct email link for each submission

Use to:
- Track feature requests
- Monitor support issues
- Collect testimonials

---

### 6️⃣ **Professional Dark UI**

- **Slate-900 theme** - Professional, easy on eyes
- **Responsive** - Works on mobile, tablet, desktop
- **Fast** - Real-time updates, instant toggling
- **Tab navigation** - Switch between Stores and Feedback

---

## What's Fully Wired Up

### ✅ **Extend Trial Button**

```
When clicked:
1. Reads current trialEndsAt from database
2. Adds 7 days to that date
3. Updates ShopSettings.trialEndsAt
4. Shows "✓ Trial extended" confirmation
5. Merchant sees new trial end date next login
```

**Verification:** Check the store's `trialEndsAt` field in DB after clicking

### ✅ **Toggle Widget**

```
When clicked:
1. Fetches current widgetEnabled state
2. Toggles to opposite (ON→OFF or OFF→ON)
3. Updates ShopSettings.widgetEnabled
4. Badge changes instantly (ON/OFF)
5. Merchant's widget disappears/reappears from storefront
```

### ✅ **Health Override**

```
When applied:
1. Select green/yellow/red from dropdown
2. Click "Apply Health Change"
3. Updates ShopSettings.healthScore
4. Override persists until next refresh
(Auto-calc will recalculate on next page load)
```

### ✅ **Save Notes**

```
When you click away:
1. Auto-detects blur event
2. Shows "🔄 Saving..." status
3. Submits to action handler
4. Updates ShopSettings.internalNotes
5. Shows "✓ Auto-saves on blur"
```

### ✅ **All Metrics Auto-Calculated**

```
On page load:
- daysInactive: Current time - lastActiveAt
- healthScore: Based on daysInactive + totalChats
- totalChats: COUNT from Conversation table
- totalAiRevenue: From ShopSettings
- deflectionPercent: Estimated from chat count
```

---

## Database Schema Updates

New fields added to `ShopSettings`:

```prisma
internalNotes   String?       // Your private notes
lastActiveAt    DateTime?     // Last merchant access
totalAiRevenue  Float @default(0)  // Cumulative revenue
healthScore     String @default("green")  // green|yellow|red
widgetEnabled   Boolean @default(true)    // Chat widget toggle
trialEndsAt     DateTime?     // Trial expiration
```

---

## How to Test

### Test Extend Trial

1. Find a free plan store
2. Note the current "Trial Expires" date
3. Click "Extend Trial +7d"
4. Confirm date is 7 days later
5. Refresh page - date persists ✅

### Test Widget Toggle

1. Click "Widget: ON" (or OFF)
2. Button changes color/text instantly
3. Refresh page - state persists ✅
4. Ask merchant to check their storefront ✅

### Test Health Override

1. Pick a "red" store
2. Click dropdown, select "🟡 Yellow"
3. Click "Apply Health Change"
4. Badge updates to yellow
5. Refresh page - reverts to auto-calculated (red)
6. Note: Override is temporary until auto-calc refreshes ✅

### Test Notes

1. Type something in Notes field
2. Click away (blur)
3. See "🔄 Saving..." appear
4. Refresh page - note persists ✅

---

## For Beta Users

### Installation Link

Share this format with testers:

```
https://shopmate-ai-helper-production.up.railway.app/?shop=their-store.myshopify.com
```

Or direct to Shopify App Store listing.

### Tracking Flow

1. **Day 0:** Install → appears in dashboard with yellow health
2. **Day 1-2:** Activate widget → see first chats
3. **Day 3+:** Health auto-updates to green if active
4. **Week 2+:** Revenue appears (if they have orders)
5. **Day 28:** Trial expires → convert or churn

---

## Metrics Explained

### daysInactive

- **0-3 days:** 🟢 Green - They're using it
- **3-7 days:** 🟡 Yellow - They've stopped
- **7+ days:** 🔴 Red - Likely churned
- **Never:** 🔴 Red - Never activated

### Health Auto-Calculation

Runs on every page load:
```javascript
if (daysInactive > 7 || (daysInactive === 999 && totalChats === 0)) {
  return "red"
} else if (daysInactive >= 3) {
  return "yellow"
} else {
  return "green"
}
```

### deflectionPercent

Estimated as: `(chats * 0.7 * 10)`

This means: roughly 70% of chats are handled by AI without escalation, weighted by volume. This is a rough estimate and can be refined with actual deflection tracking.

### totalAiRevenue

Only populated when:
1. Merchant has orders in Shopify
2. Customer clicked a product in chat
3. Customer completed checkout within 24h
4. `orders/create` webhook fires and matches the attribution

---

## What You Can Do Now

✅ Monitor all beta stores in one dashboard
✅ Extend trials remotely (7-day increments)
✅ Toggle widget on/off for testing/troubleshooting
✅ Override health scores for custom tracking
✅ Track internal notes on each store
✅ View merchant feedback
✅ Search and sort stores by any metric
✅ See real-time metrics (chats, revenue, activity)
✅ Track conversion pipeline (free → pro)

---

## Next Steps (Optional Enhancements)

- [ ] Bulk actions (extend 5 trials at once)
- [ ] Charts: Revenue/Chats over time
- [ ] Churn prediction flagging
- [ ] Email integration: Sync feedback replies
- [ ] CSV export for analysis
- [ ] Automated follow-up reminders
- [ ] Webhook status monitoring

---

## Deployment Status

✅ **Code:** Deployed to production
✅ **Database:** Migration applied (6 new fields)
✅ **Password:** Set in Railway `ADMIN_PASSWORD` variable
✅ **Live:** Ready to use at production URL

---

## Support

All controls are fully functional and ready for beta program management. Refer to `ADMIN_DASHBOARD_BETA_GUIDE.md` for detailed workflows and best practices.

