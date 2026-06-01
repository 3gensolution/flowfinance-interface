# Awinfi Frontend

## GuideAI tracking

The GuideAI script is loaded via `frontend/src/app/header.tsx` (`/guideai.js` + `data-site-id` + `data-token`).

### Event contract (exact strings)

These are the supported event names (see `frontend/src/lib/guideai/events.ts`):

- `signup_started`
- `signup_completed`
- `trial_started`
- `trial_abandoned`
- `login_success`
- `onboarding_started`
- `onboarding_completed`
- `setup_completed`
- `key_action_completed`
- `invite_sent`
- `invite_accepted`
- `upgrade_cta_clicked`
- `addon_interest_clicked`
- `demo_requested`
- `lead_submitted`
- `pricing_page_view`
- `feedback_submitted`
- `support_ticket_created`

### Helper API

Use the wrapper so calls are safe even if the script hasn’t loaded yet:

- `guideaiTrack(event, props?)` from `frontend/src/lib/guideai/events.ts`
- `guideaiIdentify(userId, traits?)` from `frontend/src/lib/guideai/events.ts`

Note: `guideaiTrack()` sends a **validated `event_type`** (e.g. `login`, `page_view`, `custom`) and includes your business event string as `event_name`.
Note: `guideaiTrack()` sends an allowlisted `event_type` (e.g. `login`, `form_start`, `page_view`) and includes your business event string as `event_name` in metadata (e.g. `login_success`).

### Debug logging

`guideaiTrack()` / `guideaiIdentify()` log to the browser console in development.

To enable logs in production builds, run in DevTools:

```js
localStorage.setItem('GUIDEAI_DEBUG', '1');
location.reload();
```

### Where we currently fire events

- `pricing_page_view`: on landing page mount (`frontend/src/app/page.tsx`)
- `signup_started`: when user clicks “Connect Wallet” (`frontend/src/components/wallet/ConnectButton.tsx`)
- `login_success` + `identify`: when wallet connects (`frontend/src/components/guideai/WalletIdentity.tsx`)
- `onboarding_started`: when landing CTA is clicked (`frontend/src/components/landing/CTA.tsx`)

Add more events by calling `guideaiTrack(...)` at the “business moment” you care about (after successful API/tx confirmations, not before).
