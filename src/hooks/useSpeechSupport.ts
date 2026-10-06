'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the Web Speech API (SpeechRecognition) is available, read in a
 * hydration-safe way. The server snapshot always returns `false`, matching
 * the SSR HTML exactly; the client snapshot reads the real API presence
 * after hydration.
 *
 * Reading `window.SpeechRecognition` in a useState initializer instead
 * mismatches the server HTML on every browser that ships the API
 * (React #418 hydration crash + client re-render) — regression fixed
 * 2026-10-06 after morning QA caught the pageerror on /voice.
 */
function subscribe() {
  return () => {};
}

function getSnapshot(): boolean {
  return !!(
    window.SpeechRecognition || (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

function getServerSnapshot(): boolean {
  return false;
}

export function useSpeechSupport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
