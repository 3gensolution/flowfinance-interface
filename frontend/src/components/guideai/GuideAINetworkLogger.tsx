'use client';

import { useEffect } from 'react';

function isDebugEnabled() {
  if (typeof window === 'undefined') return false;
  if ((window as unknown as { GUIDEAI_DEBUG?: boolean }).GUIDEAI_DEBUG === true) return true;
  return window.localStorage?.getItem('GUIDEAI_DEBUG') === '1';
}

function getGuideApiUrl(): string | null {
  if (typeof document === 'undefined') return null;
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script'));

  // Prefer scripts that look like the GuideAI snippet (has required data attrs).
  const byAttrs = scripts.find((s) => s.getAttribute('data-site-id') && s.getAttribute('data-token'));
  if (byAttrs) return byAttrs.getAttribute('data-api-url') ?? null;

  // Fallback: scripts whose src includes "guideai".
  const bySrc = scripts.find((s) => (s.getAttribute('src') ?? '').toLowerCase().includes('guideai'));
  return bySrc?.getAttribute('data-api-url') ?? null;
}

export function GuideAINetworkLogger() {
  useEffect(() => {
    if (!isDebugEnabled()) return;
    if (typeof window === 'undefined') return;
    if ((window as unknown as { __GUIDEAI_FETCH_LOGGER_INSTALLED__?: boolean }).__GUIDEAI_FETCH_LOGGER_INSTALLED__)
      return;
    (window as unknown as { __GUIDEAI_FETCH_LOGGER_INSTALLED__?: boolean }).__GUIDEAI_FETCH_LOGGER_INSTALLED__ = true;

    const apiUrl = getGuideApiUrl();
    if (!apiUrl) {
      // eslint-disable-next-line no-console
      console.debug('[GuideAI] network logger enabled, but no data-api-url found on script tag');
    }

    const originalFetch = window.fetch.bind(window);
    const originalSendBeacon = navigator.sendBeacon?.bind(navigator);
    const OriginalXHR = window.XMLHttpRequest;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const shouldLog = !!apiUrl && url.startsWith(apiUrl);

      const res = await originalFetch(input, init);

      if (shouldLog) {
        try {
          const clone = res.clone();
          const contentType = clone.headers.get('content-type') ?? '';
          let body: unknown = undefined;
          if (contentType.includes('application/json')) {
            body = await clone.json();
          } else {
            body = await clone.text();
          }
          // Typical success body from GuideAI server is something like: `{ accepted: number }`
          // eslint-disable-next-line no-console
          console.debug('[GuideAI] server response', { url, status: res.status, body });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.debug('[GuideAI] server response (unreadable)', { url, status: res.status, err });
        }
      }

      return res;
    };

    if (originalSendBeacon) {
      navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        const shouldLog = !!apiUrl && urlStr.startsWith(apiUrl);

        if (shouldLog) {
          let payload: unknown = undefined;
          try {
            if (typeof data === 'string') payload = data;
            // Blob/ArrayBuffer etc. are not trivially readable without async work; keep it simple.
          } catch {
            payload = undefined;
          }
          // NOTE: sendBeacon does not expose a response body; only a boolean "queued" result.
          // eslint-disable-next-line no-console
          console.debug('[GuideAI] sendBeacon', { url: urlStr, queued: true, payload });
        }

        return originalSendBeacon(url, data as BodyInit);
      };
    }

    // Wrap XHR (some SDK builds use XHR instead of fetch)
    class LoggedXHR extends OriginalXHR {
      private __guideaiUrl: string | null = null;

      open(method: string, url: string, async?: boolean, user?: string | null, password?: string | null) {
        this.__guideaiUrl = url;
        return super.open(method, url, async ?? true, user ?? null, password ?? null);
      }

      send(body?: Document | XMLHttpRequestBodyInit | null) {
        const shouldLog = !!apiUrl && !!this.__guideaiUrl && this.__guideaiUrl.startsWith(apiUrl);
        if (shouldLog) {
          this.addEventListener('loadend', () => {
            // eslint-disable-next-line no-console
            console.debug('[GuideAI] XHR response', {
              url: this.__guideaiUrl,
              status: this.status,
              response: this.responseType === '' || this.responseType === 'text' ? this.responseText : this.response,
            });
          });
        }
        return super.send(body ?? null);
      }
    }
    window.XMLHttpRequest = LoggedXHR as unknown as typeof XMLHttpRequest;

    // eslint-disable-next-line no-console
    console.debug('[GuideAI] network logger installed', { apiUrl, hasFetch: true, hasSendBeacon: !!originalSendBeacon, hasXHR: true });

    return () => {
      window.fetch = originalFetch;
      if (originalSendBeacon) navigator.sendBeacon = originalSendBeacon;
      window.XMLHttpRequest = OriginalXHR;
      (window as unknown as { __GUIDEAI_FETCH_LOGGER_INSTALLED__?: boolean }).__GUIDEAI_FETCH_LOGGER_INSTALLED__ = false;
    };
  }, []);

  return null;
}
