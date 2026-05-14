# Commission UX Improvements — Design Spec
**Date:** 2026-05-14
**Status:** Approved

---

## 1. Overview

Three targeted improvements to the commission and messaging UX:

1. **Mandatory price + deadline at accept** — artist must set both when accepting, buyer sees them before confirming payment.
2. **Artist deadline notifications** — artist is also notified when a deadline is approaching (not just the buyer).
3. **Messages page commission tab** — a second tab on the messages page that navigates to commission chats.

---

## 2. Mandatory Price + Deadline at Accept

### Current flow
1. Artist hits Accept → sets price only → commission becomes ACCEPTED.
2. Buyer sees "Confirm payment · $X" button.
3. Artist can optionally set a deadline later via a separate control.

### New flow
1. Artist hits Accept → form requires **both price and deadline** → commission becomes ACCEPTED with both values set atomically.
2. Buyer sees a summary line above the confirm button: *"Price: $50 · Deadline: June 1"*.
3. The separate "Set deadline" control is removed from the ACCEPTED state (deadline is always set at accept).

### Schema change
None. `agreedPrice Float?` and `deadline DateTime?` already exist on `Commission`.

### Backend change
The `accept` mutation gains a required `deadline` parameter:

```ts
accept: protectedProcedure
  .input(z.object({
    id: z.string(),
    price: z.number().positive(),
    deadline: z.string().datetime(),
  }))
```

It sets `agreedPrice`, `deadline`, and `deadlineNotificationSent: false` in one update. The separate `setDeadline` mutation remains for edge cases (e.g. rescheduling after acceptance) but is no longer shown to artists on ACCEPTED commissions.

### UI changes — commission thread (`app/professional-dms/[id]/page.tsx`)

**Artist accept form** — replace the current single price input with a two-field form:
- Price input (existing)
- Deadline date input (`<input type="date">`)
- Accept button disabled until both are filled

**Buyer confirm payment bar** — add a summary line above the existing button:
```
Price: $50 · Deadline: June 1, 2026
```
The button itself is unchanged.

**Artist ACCEPTED state** — remove the "Set deadline / Update deadline" controls. The deadline is already set. Only show current price with an "Update price" option (existing behaviour).

---

## 3. Artist Deadline Notifications

### Current behaviour
In `commission.getById`, when the deadline is within 48 hours and `deadlineNotificationSent` is false, a notification is sent to the **buyer** only.

### New behaviour
The same check sends notifications to **both** the buyer and the artist. Two `notification.create` calls instead of one. Both use the same `commission_deadline_approaching:{id}` type.

The `deadlineNotificationSent` flag remains a single boolean — once set, neither party is re-notified.

---

## 4. Messages Page Commission Tab

### Current behaviour
`/messages` shows a list of direct message conversations. `/professional-dms` shows commission chats. They are completely separate pages with no cross-navigation.

### New behaviour
Both pages show a shared two-tab header at the top:
- **Messages** tab → `/messages`
- **Commissions** tab → `/professional-dms`

The active tab is highlighted based on the current route. Tapping the inactive tab navigates to that page.

### Implementation
A shared `MessagesTabs` component (or inline JSX) renders the two tab buttons. It is added to the top of both `app/messages/page.tsx` and `app/professional-dms/page.tsx`. No new route or layout needed.

---

## 5. What Is NOT in This Spec

- Allowing deadline changes after acceptance (the `setDeadline` mutation remains but is not exposed in the ACCEPTED UI).
- Push notifications (covered separately — this spec covers in-app notification records only).
- Redesigning the `/professional-dms` list page.
