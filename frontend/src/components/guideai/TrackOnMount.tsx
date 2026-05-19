'use client';

import { useEffect } from 'react';
import { guideaiTrack, GuideAIEventName } from '@/lib/guideai/events';

export function TrackOnMount({
  event,
  props,
}: {
  event: GuideAIEventName;
  props?: Record<string, unknown>;
}) {
  useEffect(() => {
    guideaiTrack(event, props ?? {});
  }, [event, props]);

  return null;
}

