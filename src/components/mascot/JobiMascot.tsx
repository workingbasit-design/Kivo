'use client';

/**
 * Jobi — EveryJob's animated mascot.
 *
 * A lime ball character (Bible Strong Avatar Lab, AGPL-3.0) that lives in the
 * bottom-right corner of every page and reacts to visitors:
 * - page load: "waking" -> "idle"
 * - primary button hover: "excited"
 * - success toast: "celebrate" / error toast: "confused"
 * - 30s inactivity: "drowsy" -> "sleeping" (any activity wakes)
 * - click the mascot: "laughing"
 *
 * Respects prefers-reduced-motion (still neutral expression), is dismissible
 * (choice persisted in localStorage), and shrinks on small screens so it never
 * covers buttons.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, type AvatarController } from '@bible-strong/avatar-react';
import '@bible-strong/avatar-react/styles.css';
import jobiDefinition from './jobi.avatar.json';

const DISMISS_KEY = 'ej-mascot-dismissed';
const IDLE_TIMEOUT_MS = 30_000;

type Mood =
  | 'waking'
  | 'idle'
  | 'excited'
  | 'celebrate'
  | 'confused'
  | 'thinking'
  | 'drowsy'
  | 'sleeping'
  | 'laughing';

const VALID_MOODS = new Set<string>([
  'sleeping',
  'waking',
  'idle',
  'listening',
  'thinking',
  'searching',
  'working',
  'excited',
  'bored',
  'suspicious',
  'angry',
  'drowsy',
  'happy',
  'curious',
  'confused',
  'surprised',
  'proud',
  'shy',
  'sad',
  'laughing',
  'scared',
  'playful',
  'celebrate',
]);

export default function JobiMascot() {
  const controllerRef = useRef<AvatarController | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const moodRef = useRef<Mood>('waking');

  const play = useCallback((mood: Mood) => {
    if (!VALID_MOODS.has(mood)) return;
    moodRef.current = mood;
    controllerRef.current?.play(mood as never);
  }, []);

  const goIdle = useCallback(() => {
    play('idle');
  }, [play]);

  const wakeUp = useCallback(() => {
    if (wakeTimer.current) clearTimeout(wakeTimer.current);
    // Any activity wakes Jobi from drowsy/sleeping
    if (moodRef.current === 'drowsy' || moodRef.current === 'sleeping') {
      play('waking');
      wakeTimer.current = setTimeout(goIdle, 2000);
    }
    // Reset the inactivity clock
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      play('drowsy');
      wakeTimer.current = setTimeout(() => play('sleeping'), 4000);
    }, IDLE_TIMEOUT_MS);
  }, [play, goIdle]);

  // Reduced-motion + dismissed preferences (client only). Reads stay in an
  // effect (never in a useState initializer) so the server render is
  // identical for every visitor — localStorage in an initializer caused
  // React #418 hydration crashes. setState calls live in the subscription
  // callback, not the effect body (react-hooks cascading-render rule).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPrefs = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(DISMISS_KEY);
      } catch {
        /* storage unavailable — show mascot */
      }
      setDismissed(stored === '1');
      setReducedMotion(mq.matches);
      setReady(true);
    };
    mq.addEventListener('change', applyPrefs);
    applyPrefs();
    return () => mq.removeEventListener('change', applyPrefs);
  }, []);

  // Page-load sequence: waking -> idle
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    play('waking');
    const t = setTimeout(goIdle, 2500);
    return () => clearTimeout(t);
  }, [ready, dismissed, reducedMotion, play, goIdle]);

  // Inactivity tracking: drowsy -> sleeping after 30s
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, wakeUp, { passive: true }));
    wakeUp();
    return () => {
      events.forEach((e) => window.removeEventListener(e, wakeUp));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (wakeTimer.current) clearTimeout(wakeTimer.current);
    };
  }, [ready, dismissed, reducedMotion, wakeUp]);

  // Primary-button hover -> excited (event delegation, tap on phones)
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const onOver = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const btn = t?.closest?.(
        'a[class*="primary"], button[class*="primary"], [data-mascot-excited]'
      );
      if (btn) {
        play('excited');
        setTimeout(() => {
          if (moodRef.current === 'excited') goIdle();
        }, 1800);
      }
    };
    if (!isCoarse) document.addEventListener('mouseover', onOver, { passive: true });
    return () => document.removeEventListener('mouseover', onOver);
  }, [ready, dismissed, reducedMotion, play, goIdle]);

  // Toast watching: sonner success -> celebrate, error -> confused
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const seen = new WeakSet<Node>();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement) || seen.has(node)) continue;
          seen.add(node);
          const text = node.textContent ?? '';
          const cls = node.className ?? '';
          const html = node.outerHTML ?? '';
          const looksSuccess =
            /success/i.test(cls) || /data-type="success"/.test(html);
          const looksError =
            /error/i.test(cls) || /data-type="error"/.test(html);
          if (looksSuccess && text.trim()) {
            play('celebrate');
            setTimeout(() => {
              if (moodRef.current === 'celebrate') goIdle();
            }, 3000);
          } else if (looksError && text.trim()) {
            play('confused');
            setTimeout(() => {
              if (moodRef.current === 'confused') goIdle();
            }, 3000);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ready, dismissed, reducedMotion, play, goIdle]);

  // Custom events other parts of the app can dispatch
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const on = (mood: Mood, holdMs: number) => () => {
      play(mood);
      setTimeout(() => {
        if (moodRef.current === mood) goIdle();
      }, holdMs);
    };
    const celebrate = on('celebrate', 3000);
    const confused = on('confused', 3000);
    const thinking = on('thinking', 2500);
    window.addEventListener('ej:mascot-celebrate', celebrate);
    window.addEventListener('ej:mascot-confused', confused);
    window.addEventListener('ej:mascot-thinking', thinking);
    return () => {
      window.removeEventListener('ej:mascot-celebrate', celebrate);
      window.removeEventListener('ej:mascot-confused', confused);
      window.removeEventListener('ej:mascot-thinking', thinking);
    };
  }, [ready, dismissed, reducedMotion, play, goIdle]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const handleClick = useCallback(() => {
    wakeUp();
    if (reducedMotion) return;
    play('laughing');
    setTimeout(() => {
      if (moodRef.current === 'laughing') goIdle();
    }, 2500);
  }, [play, goIdle, wakeUp, reducedMotion]);

  if (!ready || dismissed) return null;

  return (
    <div
      className="ej-mascot"
      role="complementary"
      aria-label="Jobi, the EveryJob mascot"
      style={{
        position: 'fixed',
        left: 'max(1rem, env(safe-area-inset-left))',
        bottom: 'max(5.5rem, env(safe-area-inset-bottom))',
        zIndex: 60,
        lineHeight: 0,
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide Jobi the mascot"
        title="Hide Jobi"
        style={{
          position: 'absolute',
          top: -8,
          left: -8,
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '1px solid rgba(0,0,0,0.12)',
          background: '#fff',
          color: '#555',
          fontSize: 13,
          lineHeight: 1,
          cursor: 'pointer',
          zIndex: 2,
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        ×
      </button>
      <div
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
        role="button"
        tabIndex={0}
        aria-label="Jobi the mascot — click to say hi"
        title="Jobi — EveryJob's helper"
        style={{ cursor: 'pointer', borderRadius: '50%' }}
      >
        {reducedMotion ? (
          <Avatar
            definition={jobiDefinition as never}
            defaultExpression="neutral"
            size="clamp(72px, 18vw, 120px)"
            ariaLabel="Jobi, the EveryJob mascot"
          />
        ) : (
          <Avatar
            ref={controllerRef as never}
            definition={jobiDefinition as never}
            defaultAnimation="idle"
            size="clamp(72px, 18vw, 120px)"
            ariaLabel="Jobi, the EveryJob mascot"
            onAnimationEnd={(anim) => {
              // Chain waking -> idle and drowsy -> sleeping naturally
              if (anim === 'waking') goIdle();
            }}
          />
        )}
      </div>
    </div>
  );
}
