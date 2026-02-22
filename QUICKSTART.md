# Admin Dashboard - Quick Start

## Access Your Dashboard

```
https://shopmate-ai-helper-production.up.railway.app/internal-admin?password=YOUR_ADMIN_PASSWORD
```

Replace `YOUR_ADMIN_PASSWORD` with the password you set in Railway.

---

## First 5 Minutes

### 1. Dashboard Home
See 6 key metrics at a glance:
- Total Stores
- Pro Plans
- Total Chats
- At Risk Count
- Avg Revenue
- Monthly MRR

### 2. Browse Stores
Scroll through the stores table. Click any row to expand and see:
- Metrics (chats, revenue, activity)
- Admin Controls (extend trial, toggle widget)
- Your internal notes

### 3. Manage a Store

**To extend trial (free plans):**
1. Click the store row
2. Click "Extend Trial +7d"
3. ✓ Done - Trial extends 7 more days

**To toggle widget:**
1. Click "Widget: ON" or "Widget: OFF"
2. ✓ Done - Takes effect immediately

**To add notes:**
1. Type in Notes section
2. Click away
3. ✓ Auto-saves

### 4. View Feedback
Click the "Feedback" tab to see all merchant messages with:
- Store name
- Message text
- Their email (click to reply)
- Timestamp

### 5. Track Performance
Watch these metrics grow:
- **Chats** - Merchants are using the widget
- **Revenue** - Orders are happening
- **Last Active** - Engagement indicator

---

## Common Tasks

### Send Someone a Trial Extension

1. Find their store in the table
2. Click the row
3. Click "Extend Trial +7d"
4. Email them: "You're approved for 7 more days!"

### Debug a Store

1. Check if widget is ON
2. If OFF, click toggle to turn it ON
3. Add note: "Widget was off, toggled on for testing"

### Identify Churned Stores

1. Sort by "Activity"
2. Look for stores with "red" health and "100+ days" inactive
3. Mark for follow-up or archive

### Check Revenue Impact

1. Look at "Revenue" column
2. Sort by "Revenue" (highest first)
3. See which stores generated the most value

---

## Button Reference

| Button | Does | When to Use |
|--------|------|------------|
| Extend Trial +7d | Adds 7 days to trial | Customer needs more time |
| Widget: ON/OFF | Toggles chat widget | Testing or troubleshooting |
| Apply Health Change | Saves health override | Custom tracking needed |
| Reply (Feedback) | Opens email client | Respond to customer feedback |

---

## What Each Color Means

🟢 **Green Health**
- Merchant is actively using the app
- No action needed
- Monitor for conversion

🟡 **Yellow Health**
- Merchant was active but stopped
- Send follow-up email
- Offer support or trial extension

🔴 **Red Health**
- Merchant hasn't used it OR never activated
- Priority follow-up needed
- High churn risk

---

## Key Columns Explained

| Column | Means |
|--------|-------|
| Domain | Their Shopify store URL |
| Plan | free (trial) or pro (paid) |
| Health | 🟢🟡🔴 - Activity status |
| Last Active | When they last used the app (days ago) |
| Chats | Total conversations they've had |
| Revenue | $ from AI-attributed orders |
| Widget | ON = chat widget enabled, OFF = disabled |

---

## Things That Auto-Update

These update every time you refresh the page:
- ✅ Chat counts (real-time from database)
- ✅ Revenue totals (if orders webhook fired)
- ✅ Last Active timestamp (when they used it)
- ✅ Health scores (based on activity)
- ✅ Global stats cards (aggregate metrics)

These don't auto-revert:
- ⚠️ Health override (stays until you change it back)
- ⚠️ Widget ON/OFF state (stays until you toggle again)
- ⚠️ Trial end date (stays until extended again)
- ⚠️ Notes (stay saved)

---

## Troubleshooting

**Can't see stores?**
- Double-check password is correct
- Check if you're logged in (404 means bad password)

**Button click doesn't work?**
- Check browser console (F12) for errors
- Try refreshing the page
- Verify internet connection

**Numbers seem wrong?**
- Revenue requires: orders + attribution webhook
- Last Active: check if merchant actually used the app
- Chats: appears only if conversations exist in DB

---

## Tips

💡 **Pro tips:**

1. **Sort by Activity** to see who needs follow-up first
2. **Check Widget ON** for all new installations
3. **Extend trial by 7 days** multiple times if customer is close to converting
4. **Add notes** with every customer interaction
5. **Monitor the "At Risk" count** - high count means churn issues
6. **Watch new stores closely** - most churn happens in first 2 weeks

---

## Next Steps

1. ✅ Save the dashboard URL as a bookmark
2. ✅ Check it daily during your beta program
3. ✅ Send install links to testers
4. ✅ Extend trials for promising customers
5. ✅ Follow up with red-health stores
6. ✅ Track conversion milestones

---

## Need More Detail?

Read the full guides:
- **ADMIN_DASHBOARD_BETA_GUIDE.md** - Complete beta program workflow
- **ADMIN_DASHBOARD_FEATURES.md** - Technical feature overview

---

**Access your dashboard:**
```
https://shopmate-ai-helper-production.up.railway.app/internal-admin?password=YOUR_PASSWORD
```

🎯 You're ready to manage your beta program!
