'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

/**
 * A boolean flag persisted in localStorage that is safe to read during React
 * hydration. The server snapshot always returns `initial`, matching the SSR
 * HTML exactly; the client snapshot reads the real stored value after
 * hydration. Reading localStorage in a useState initializer instead
 * mismatches the server HTML for any returning visitor who changed the flag
 * (React #418 hydration crash + client re-render).
 *
 * The setter writes through to localStorage (best-effort) and bumps a nonce
 * so the snapshot re-reads in the same tab; changes from other tabs arrive
 * via the 'storage' event.
 */
export function useStoredFlag(key: string, initial = false): [boolean, (next: boolean) => void] {
  const [nonce, setNonce] = useState(0);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (e: StorageEvent) => {
        if (!e.key || e.key === key) onChange();
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
    [key]
  );

  const getSnapshot = useCallback(() => {
    void nonce; // re-read after local writes in this tab
    try {
      return window.localStorage.getItem(key) === '1';
    } catch {
      return initial;
    }
  }, [key, nonce, initial]);

  const getServerSnapshot = useCallback(() => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // private mode — the flag just won't persist
      }
      setNonce((n) => n + 1);
    },
    [key]
  );

  return [value, set];
}

/**
 * Collapsible-section variant: a persisted open/closed flag that auto-expands
 * when `autoExpand` becomes true (e.g. the active nav item lives inside the
 * section). A manual toggle always wins until `autoExpand` changes again.
 * Hydration-safe: same server-snapshot guarantee as useStoredFlag.
 */
export function useAutoExpandFlag(key: string, autoExpand: boolean): [boolean, () => void] {
  const [stored, setStored] = useStoredFlag(key);
  const [manual, setManual] = useState<boolean | null>(null);
  const [prevAuto, setPrevAuto] = useState(autoExpand);
  if (prevAuto !== autoExpand) {
    setPrevAuto(autoExpand);
    setManual(null);
  }
  const open = manual ?? (stored || autoExpand);
  const toggle = useCallback(() => {
    const next = !open;
    setManual(next);
    setStored(next);
  }, [open, setStored]);
  return [open, toggle];
}
