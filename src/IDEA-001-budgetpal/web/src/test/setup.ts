import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * jsdom stand-ins for the browser APIs the Radix based kit needs (SPEC-010 Enabler-002 AC-6):
 * matchMedia (switchable per test), ResizeObserver, pointer capture and scrollIntoView.
 */

export interface MediaState {
  /** Viewport below 768 px (the `use-mobile` breakpoint). */
  mobile: boolean;
  /** `prefers-color-scheme: dark`. */
  dark: boolean;
}

const MOBILE_WIDTH = 360;
const DESKTOP_WIDTH = 1280;
const DEFAULT_STATE: MediaState = { mobile: false, dark: false };
let mediaState: MediaState = { ...DEFAULT_STATE };

type Listener = (event: MediaQueryListEvent) => void;
interface Registered {
  query: string;
  last: boolean;
  listeners: Set<Listener>;
  list: MediaQueryList;
}
const registered = new Set<Registered>();

function evaluate(query: string, state: MediaState): boolean {
  const q = query.replace(/\s+/g, ' ').toLowerCase();
  if (q.includes('prefers-color-scheme: dark')) return state.dark;
  if (q.includes('prefers-color-scheme: light')) return !state.dark;
  const width = state.mobile ? MOBILE_WIDTH : DESKTOP_WIDTH;
  const max = /max-width:\s*(\d+(?:\.\d+)?)px/.exec(q);
  if (max) return width <= Number(max[1]);
  const min = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(q);
  if (min) return width >= Number(min[1]);
  return false;
}

function createMatchMedia(query: string): MediaQueryList {
  const entry = { query, last: evaluate(query, mediaState), listeners: new Set<Listener>() } as Registered;
  const list = {
    media: query,
    get matches() {
      return evaluate(query, mediaState);
    },
    onchange: null,
    addEventListener: (type: string, listener: Listener) => {
      if (type === 'change') entry.listeners.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      if (type === 'change') entry.listeners.delete(listener);
    },
    addListener: (listener: Listener) => entry.listeners.add(listener),
    removeListener: (listener: Listener) => entry.listeners.delete(listener),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
  entry.list = list;
  registered.add(entry);
  return list;
}

/**
 * Switches the simulated media features for the current test and notifies `change` listeners
 * (so a mounted `useIsMobile` follows). Reset to desktop and light after every test.
 */
export function setMatchMedia(next: Partial<MediaState>): void {
  mediaState = { ...mediaState, ...next };
  for (const entry of registered) {
    const now = evaluate(entry.query, mediaState);
    if (now === entry.last) continue;
    entry.last = now;
    const event = { matches: now, media: entry.query } as MediaQueryListEvent;
    entry.listeners.forEach((listener) => listener(event));
  }
}

/** Current simulated media features. */
export function getMatchMediaState(): MediaState {
  return { ...mediaState };
}

function installStandIns(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => createMatchMedia(query),
  });

  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStandIn {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = ResizeObserverStandIn as unknown as typeof ResizeObserver;
  }

  const proto = window.HTMLElement.prototype;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
}

// Suites marked `@vitest-environment node` have no window; the stand-ins are for jsdom only.
if (typeof window !== 'undefined') installStandIns();

afterEach(() => {
  cleanup();
  mediaState = { ...DEFAULT_STATE };
  registered.clear();
});
