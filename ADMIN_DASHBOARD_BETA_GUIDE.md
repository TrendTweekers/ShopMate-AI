# ShopMate Admin Dashboard - Beta Program Guide

## Overview

The internal admin dashboard is a professional tool for managing your beta program. It provides complete visibility into store performance, health metrics, and gives you controls to optimize each store's trial experience.

**Access:** `https://shopmate-ai-helper-production.up.railway.app/internal-admin?password=YOUR_PASSWORD`

---

## Features

### 1. **Dashboard Overview**

At a glance see:
- **Total Stores** - Count of all active beta stores
- **Pro Plans** - How many stores have converted to paid
- **Total Chats** - Cumulative chat volume across all stores
- **At Risk** - Percentage of stores with red health status
- **Avg Revenue** - Average AI-attributed revenue per store
- **Monthly MRR** - Total monthly recurring revenue (pro plans only)

### 2. **Auto-Calculated Health Scores**

Health is automatically calculated based on activity:

| Status | Criteria | Action |
|--------|----------|--------|
| 🟢 **Green** | Active within last 3 days | Healthy, no action needed |
| 🟡 **Yellow** | Inactive 3-7 days | Follow up, ensure setup is working |
| 🔴 **Red** | Inactive >7 days OR never active | Churned or failed setup, priority follow-up |

**Override:** Click a store to manually override the auto-calculated score for custom tracking.

### 3. **Stores Table**

Browse all beta stores with:

**Columns:**
- **Domain** - Store URL
- **Plan** - free or pro (convertible)
- **Health** - Auto-calculated status badge
- **Last Active** - When the merchant last used the chat (days ago)
- **Chats** - Total conversations
- **Revenue** - Total AI-attributed revenue
- **Widget** - Is the chat widget enabled? (ON/OFF)

**Sorting Options:**
- Activity (most inactive first)
- Domain (A-Z)
- Plan (pro first)
- Health Status (red → yellow → green)
- Revenue (highest first)

**Search:** Filter stores by domain name in real-time

### 4. **Store Detail Panel** (Click any row to expand)

#### Metrics (Left)
- **Total Chats** - Conversation count
- **AI Revenue** - Total attributed revenue
- **Deflection Rate** - % of chats handled by AI
- **Days Inactive** - How long since last activity
- **Trial Expires** - When free trial ends
- **Created** - When store was first set up

#### Controls (Middle)

**Widget Toggle**
- Turn merchant's chat widget on/off instantly
- Widget disappears from their storefront immediately
- Useful for testing or pausing for spammy stores

**Health Override**
- Manually override the auto-calculated health score
- Use for stores you're actively helping (override red → yellow)
- Or mark healthy stores as red if they've churned

**Trial Extension**
- Only visible for free (non-pro) stores
- Adds 7 more days to their trial
- Updates `trialEndsAt` in database
- Useful for: "Let me check our setup, give me 7 more days"

#### Notes (Right)
- Private notes visible only to you
- Auto-saves when you click away
- Perfect for:
  - "Customer needs custom webhook setup"
  - "VIP prospect, follow up next week"
  - "Integration failing, debugging with them"

### 5. **Feedback Inbox**

View all merchant feedback submissions:

**For each entry:**
- **From** - Store domain and timestamp
- **Message** - Their exact feedback
- **Reply** - Direct link to email them back
- **Sort** - By most recent or oldest first

**Use cases:**
- Feature requests
- Bug reports
- Questions during setup
- Complaints or issues

---

## Setup for Beta Users

### Step 1: Create Installation Link

Share this with your beta testers:

```
https://shopmate-ai-helper-production.up.railway.app/?shop=beta-store-1.myshopify.com
```

Or direct them to your Shopify App Store listing.

### Step 2: Monitor from Dashboard

Once they install:
1. Refresh the admin dashboard
2. Their store appears in the **Stores** table
3. Initially shows:
   - Health: 🟡 Yellow (just installed, no activity yet)
   - Last Active: Never
   - Chats: 0
   - Revenue: $0

### Step 3: Track Onboarding Progress

**Day 1-2:**
- If they still show 0 chats → they haven't tested the widget
- Add note: "Sent setup docs"
- Check if widget toggle is ON

**Day 3-7:**
- Should see first chats appear
- Health auto-updates to 🟢 Green if active
- Watch Revenue column for attributed orders

**After Day 7:**
- If still inactive → extends trial with +7 day button
- If chats are slow → override health to Yellow, add note about optimization
- If converting → watch Revenue grow

### Step 4: Optimize Based on Metrics

**For stores with:**
- Low chats but high revenue → They're satisfied, focus on conversion
- High chats but $0 revenue → AI working but no orders yet (normal for some industries)
- High chats AND high revenue → Success story, case study candidate
- Red health + no chats → Needs immediate follow-up or probably churned

---

## Action Reference

### **Extend Trial**

When to use:
- Merchant needs more time to test
- Setup is in progress
- They're promising but need another week

How it works:
1. Click store row to expand
2. Click "Extend Trial +7d" button
3. Their `trialEndsAt` date updates immediately
4. They don't need to reinstall or do anything

### **Toggle Widget**

When to use:
- Testing widget on/off states
- Merchant requests temporary disable
- Troubleshooting widget display issues

How it works:
1. Expand store detail
2. Click "Widget: ON" or "Widget: OFF" button
3. Changes instantly on their storefront
4. They see chat widget disappear/reappear

### **Override Health**

When to use:
- You're actively helping a "red" store (override to yellow)
- Mark a "green" store as red if they've explicitly churned
- Custom tracking for specific stores

How it works:
1. Expand store detail
2. Select new health from dropdown (green/yellow/red)
3. Click "Apply Health Change"
4. Overrides auto-calculated score until next refresh

### **Update Notes**

When to use:
- Log why a store is at risk
- Track what you discussed with them
- Remember follow-up actions

How it works:
1. Expand store detail
2. Type in Notes section
3. Click away or press outside
4. Auto-saves (shows "🔄 Saving..." then "✓ Auto-saves on blur")

---

## Beta Program Workflow

### **Initial Outreach**

1. Send installation link
2. Brief onboarding email with setup expectations
3. Set expectations: "We'll monitor your progress on our dashboard"

### **Week 1: Onboarding**

- Check daily for first chats
- If none by day 3 → email to confirm widget is ON
- If issues → override health to Yellow, add notes, follow up

### **Week 2-4: Optimization**

- Review chats that aren't converting
- Identify common questions → add to Knowledge Base
- High-performing stores → ask for testimonial/case study

### **Month 2+: Conversion**

- Stores with good metrics → pitch Pro plan
- Use revenue data in pitch: "You've generated $XXX, here's what you could earn..."
- Extend trials for high-potential stores if needed

### **Post-Trial: Churn Prevention**

- Monitor stores approaching trial end
- Reach out 3 days before expiry for non-converters
- Offer free extended trial + custom setup if they're close

---

## Data Accuracy

### What's Tracked

✅ **Accurate (Real-time):**
- Trial end date (set by you or system)
- Widget enabled/disabled state
- Health score (auto-calculated)
- Last active timestamp (updates when merchant uses app)
- Chat count (from Conversation model)

⚠️ **Estimated:**
- Deflection % (calculated as `chats * 0.7 * 10`, needs refinement)
- AI Revenue (requires order attribution webhook to be firing)

### Revenue Attribution

Revenue only appears when:
1. Merchant has orders in their Shopify store
2. Customer clicked a product in the chat
3. Customer completed checkout within 24 hours
4. `orders/create` webhook fires and matches the click

If a store shows 0 revenue but high chats, they may just not have orders yet (normal for new stores or certain products).

---

## Metrics & KPIs to Track

**For Your SaaS:**
- Total Stores - Growth indicator
- Pro Conversion Rate - (Pro / Total) * 100
- Avg Revenue/Store - Unit economics
- Churn Rate - (Inactive >14d) / Total
- Health Distribution - % Green / Yellow / Red

**For Each Store:**
- Days to First Chat - Onboarding speed
- Chats in Trial - Engagement indicator
- Revenue Generated - Success metric
- Time to Conversion - Sales cycle

---

## Troubleshooting

### Store shows "Never" for Last Active

**Cause:** Merchant installed but never accessed the dashboard or chat widget.

**Solution:**
1. Check if Widget is ON
2. Send them setup email with direct widget test link
3. Extend trial if needed to give them more time

### Extend Trial button doesn't work

**Check:**
- Store plan is "free" (button only shows for free plans)
- Browser console for errors
- Form is submitting (button should show "✓ Trial extended" message)

### Revenue shows $0 for stores with many chats

**Likely causes:**
- No orders in trial period (normal)
- Orders webhook not firing
- Product click attribution window too short (24h)

**Check:**
- Do orders exist in their Shopify admin?
- Are customers actually buying?
- Are product recommendations being clicked?

---

## Security

✅ **Protected by:**
- Password authentication (must match `ADMIN_PASSWORD` env var)
- 404 response if password is wrong (hidden from merchants)
- All data visible only to you

⚠️ **Best practices:**
- Don't share your admin password
- Log out by clearing the password from URL
- Update password if anyone has access to your computer

---

## Features Coming Soon

- [ ] Bulk actions (extend multiple trials, toggle widgets en masse)
- [ ] Revenue charts over time
- [ ] Churn prediction flagging
- [ ] Automated follow-up reminders
- [ ] CSV export of all stores
- [ ] Webhook health monitoring
- [ ] Merchant email integration

---

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Look at Railway deployment logs
3. Verify `ADMIN_PASSWORD` is set correctly
4. Try different password format (no special chars if issues)

