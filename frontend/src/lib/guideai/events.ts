export const GUIDEAI_EVENTS = [
  'signup_started',
  'signup_completed',
  'trial_started',
  'trial_abandoned',
  'login_success',
  'onboarding_started',
  'onboarding_completed',
  'setup_completed',
  'key_action_completed',
  'invite_sent',
  'invite_accepted',
  'upgrade_cta_clicked',
  'addon_interest_clicked',
  'demo_requested',
  'lead_submitted',
  'pricing_page_view',
  'feedback_submitted',
  'support_ticket_created',
] as const;

export type GuideAIEventName = (typeof GUIDEAI_EVENTS)[number];

export type GuideAIEventType =
  | 'click'
  | 'page_view'
  | 'form_start'
  | 'form_submit'
  | 'form_abandon'
  | 'signup'
  | 'login'
  | 'identify'
  | 'guide_started'
  | 'guide_completed'
  | 'guide_step_action'
  | 'support_chat_opened'
  | 'share'
  | 'subscribe'
  | 'feedback_submitted'
  | 'custom';

type GuideAIClient = {
  track?: (eventType: string, props?: Record<string, unknown>) => void;
  identify?: (userId: string, traits?: Record<string, unknown>) => void;
};

function getClient(): GuideAIClient | undefined {
  // In Next.js server components, `window` is undefined.
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { guideai?: GuideAIClient }).guideai;
}

// IMPORTANT:
// The GuideAI backend validates `event_type` against an allowlist. It currently does NOT accept
// business-specific names like `login_success` as `event_type` (they cause 422 responses).
// We therefore send an allowed `event_type` and include the business event in `event_name`.
const EVENT_TYPE_BY_NAME: Record<GuideAIEventName, GuideAIEventType> = {
  pricing_page_view: 'page_view',

  signup_started: 'form_start',
  signup_completed: 'signup',
  trial_started: 'subscribe',
  trial_abandoned: 'form_abandon',
  login_success: 'login',

  onboarding_started: 'guide_started',
  onboarding_completed: 'guide_completed',
  setup_completed: 'guide_completed',
  key_action_completed: 'guide_step_action',

  invite_sent: 'share',
  invite_accepted: 'signup',

  upgrade_cta_clicked: 'click',
  addon_interest_clicked: 'click',

  demo_requested: 'form_submit',
  lead_submitted: 'form_submit',

  feedback_submitted: 'feedback_submitted',
  support_ticket_created: 'support_chat_opened',
};

export function guideaiTrack(event: GuideAIEventName, props: Record<string, unknown> = {}) {
  console.log('guideaiTrack called with', { event, props });
  const client = getClient();
  const debug =
    (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') ||
    (typeof window !== 'undefined' &&
      // Opt-in debug logging in production:
      // - `localStorage.setItem('GUIDEAI_DEBUG', '1')`
      // - or `window.GUIDEAI_DEBUG = true`
      (((window as unknown as { GUIDEAI_DEBUG?: boolean }).GUIDEAI_DEBUG === true) ||
        window.localStorage?.getItem('GUIDEAI_DEBUG') === '1'));
  if (!client || typeof client.track !== 'function') {
    // If the SDK snippet hasn't finished loading yet, queue the call for replay.
    // The GuideAI snippet drains `window.guideai._q` after init.
    if (typeof window !== 'undefined') {
      const w = window as unknown as { guideai?: { _q?: unknown[] } };
      if (!w.guideai) w.guideai = {};
      if (!Array.isArray(w.guideai._q)) w.guideai._q = [];
      w.guideai._q.push(['track', event, props]);
    }

    if (debug && typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.debug('[GuideAI] track queued (SDK not ready)', { event, props });
    }
    return;
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.debug('[GuideAI] track', { event_name: event, props });
  }

  const eventType = EVENT_TYPE_BY_NAME[event] ?? 'custom';
  client.track(eventType, { event_name: event, ...props });

  if (debug) {
    // eslint-disable-next-line no-console
    console.debug('[GuideAI] track dispatched', { event_type: eventType, event_name: event, props });
  }
}

export function guideaiIdentify(userId: string, traits: Record<string, unknown> = {}) {
  console.log('guideaiIdentify called with', { userId, traits });
  const client = getClient();
  const debug =
    (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') ||
    (typeof window !== 'undefined' &&
      (((window as unknown as { GUIDEAI_DEBUG?: boolean }).GUIDEAI_DEBUG === true) ||
        window.localStorage?.getItem('GUIDEAI_DEBUG') === '1'));
  if (!client || typeof client.identify !== 'function') {
    if (typeof window !== 'undefined') {
      const w = window as unknown as { guideai?: { _q?: unknown[] } };
      if (!w.guideai) w.guideai = {};
      if (!Array.isArray(w.guideai._q)) w.guideai._q = [];
      w.guideai._q.push(['identify', userId, traits]);
    }

    if (debug && typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.debug('[GuideAI] identify queued (SDK not ready)', { userId, traits });
    }
    return;
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.debug('[GuideAI] identify', { userId, ...traits });
  }
  client.identify(userId, traits);

  if (debug) {
    // eslint-disable-next-line no-console
    console.debug('[GuideAI] identify dispatched', { userId, traits });
  }
}
