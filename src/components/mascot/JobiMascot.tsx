'use client';

/**
 * Jobi — EveryJob's animated mascot.
 *
 * A lime ball character (Bible Strong Avatar Lab, AGPL-3.0) that lives in the
 * bottom-left corner of every page and reacts to visitors:
 * - page load: "waking" -> "idle"
 * - primary button hover: "excited"
 * - success toast: "celebrate" / error toast: "confused"
 * - 30s inactivity: "drowsy" -> "sleeping" (any activity wakes)
 * - click the mascot: "laughing"
 *
 * Uses controlled `animation` prop (not the imperative controller) for
 * reliability. Respects prefers-reduced-motion (still neutral expression),
 * is dismissible (choice persisted in localStorage), and shrinks on small
 * screens so it never covers buttons.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@bible-strong/avatar-react';
import '@bible-strong/avatar-react/styles.css';
import jobiDefinition from './jobi.avatar.json';

const DISMISS_KEY = 'ej-mascot-dismissed-v2';
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

export default function JobiMascot() {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [mood, setMood] = useState<Mood>('waking');
  const moodRef = useRef<Mood>('waking');

  const setMoodBoth = useCallback((m: Mood) => {
    moodRef.current = m;
    setMood(m);
  }, []);

  // Play a mood temporarily, then return to idle
  const playOnce = useCallback(
    (m: Mood, holdMs: number) => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
      setMoodBoth(m);
      revertTimer.current = setTimeout(() => {
        if (moodRef.current === m) setMoodBoth('idle');
      }, holdMs);
    },
    [setMoodBoth]
  );

  const wakeUp = useCallback(() => {
    // Any activity wakes Jobi from drowsy/sleeping
    if (moodRef.current === 'drowsy' || moodRef.current === 'sleeping') {
      playOnce('waking', 2000);
    }
    // Reset the inactivity clock
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setMoodBoth('drowsy');
      revertTimer.current = setTimeout(() => {
        if (moodRef.current === 'drowsy') setMoodBoth('sleeping');
      }, 4000);
    }, IDLE_TIMEOUT_MS);
  }, [playOnce, setMoodBoth]);

  // Reduced-motion + dismissed preferences (client only)
  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
        return;
      }
    } catch {
      /* storage unavailable — show mascot */
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    setReady(true);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Page-load sequence: waking -> idle (handled by onAnimationEnd + fallback)
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    setMoodBoth('waking');
    const t = setTimeout(() => {
      if (moodRef.current === 'waking') setMoodBoth('idle');
    }, 3000);
    return () => clearTimeout(t);
  }, [ready, dismissed, reducedMotion, setMoodBoth]);

  // Inactivity tracking: drowsy -> sleeping after 30s
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, wakeUp, { passive: true }));
    wakeUp();
    return () => {
      events.forEach((e) => window.removeEventListener(e, wakeUp));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (revertTimer.current) clearTimeout(revertTimer.current);
    };
  }, [ready, dismissed, reducedMotion, wakeUp]);

  // Primary-button hover -> excited (event delegation)
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    if (isCoarse) return;
    const onOver = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const btn = t?.closest?.(
        'a[class*="primary"], button[class*="primary"], [data-mascot-excited]'
      );
      if (btn && moodRef.current === 'idle') playOnce('excited', 1800);
    };
    document.addEventListener('mouseover', onOver, { passive: true });
    return () => document.removeEventListener('mouseover', onOver);
  }, [ready, dismissed, reducedMotion, playOnce]);

  // Toast watching: sonner success -> celebrate, error -> confused
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const seen = new WeakSet<Node>();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement) || seen.has(node)) continue;
          seen.add(node);
          const text = (node.textContent ?? '').trim();
          if (!text) continue;
          const html = node.outerHTML ?? '';
          const cls = typeof node.className === 'string' ? node.className : '';
          if (/success/i.test(cls) || /data-type="success"/.test(html)) {
            playOnce('celebrate', 3000);
          } else if (/error/i.test(cls) || /data-type="error"/.test(html)) {
            playOnce('confused', 3000);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ready, dismissed, reducedMotion, playOnce]);

  // Custom events other parts of the app can dispatch:
  // window.dispatchEvent(new Event('ej:mascot-celebrate'))
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const celebrate = () => playOnce('celebrate', 3000);
    const confused = () => playOnce('confused', 3000);
    const thinking = () => playOnce('thinking', 2500);
    window.addEventListener('ej:mascot-celebrate', celebrate);
    window.addEventListener('ej:mascot-confused', confused);
    window.addEventListener('ej:mascot-thinking', thinking);
    return () => {
      window.removeEventListener('ej:mascot-celebrate', celebrate);
      window.removeEventListener('ej:mascot-confused', confused);
      window.removeEventListener('ej:mascot-thinking', thinking);
    };
  }, [ready, dismissed, reducedMotion, playOnce]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const [bubble, setBubble] = useState<string | null>(null);

  const showBubble = useCallback((text: string, ms = 4000) => {
    setBubble(text);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  const handleClick = useCallback(() => {
    wakeUp();
    if (reducedMotion) return;
    const phrases = [
      'Hehe! That tickles!',
      'Every job, one place!',
      'Need a hand? Just ask!',
      'You got this!',
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    showBubble(phrase, 2500);
    playOnce('laughing', 2500);
  }, [playOnce, wakeUp, reducedMotion, showBubble]);

  const handleAnimationEnd = useCallback(
    (anim: string) => {
      // Chain waking -> idle naturally when the animation completes
      if (anim === 'waking' && moodRef.current === 'waking') {
        setMoodBoth('idle');
      }
    },
    [setMoodBoth]
  );

  // Welcome bubble on first load
  useEffect(() => {
    if (!ready || dismissed || reducedMotion) return;
    const t = setTimeout(() => {
      showBubble("Hi! I'm Jobi — click me anytime!", 5000);
      playOnce('excited', 2000);
    }, 3500);
    return () => clearTimeout(t);
  }, [ready, dismissed, reducedMotion, showBubble, playOnce]);

  const restore = useCallback(() => {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
    setDismissed(false);
  }, []);

  if (dismissed) {
    // Tiny restore dot so Jobi is never permanently lost
    return (
      <button
        type="button"
        onClick={restore}
        aria-label="Show Jobi the mascot"
        title="Show Jobi"
        style={{
          position: 'fixed',
          left: 'max(1rem, env(safe-area-inset-left))',
          bottom: 'max(5.5rem, env(safe-area-inset-bottom))',
          zIndex: 60,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#b9e838',
          border: '2px solid #161616',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      />
    );
  }

  if (!ready) return null;

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
      {bubble && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 12px)',
            left: 0,
            maxWidth: 220,
            background: '#161616',
            color: '#fff',
            fontSize: 13,
            lineHeight: 1.4,
            padding: '10px 14px',
            borderRadius: 16,
            borderBottomLeftRadius: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 3,
            animation: 'ej-bubble-pop 0.25s ease-out',
          }}
        >
          {bubble}
        </div>
      )}
      <div
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Jobi the mascot — click to say hi"
        title="Jobi — EveryJob's helper"
        style={{ cursor: 'pointer', borderRadius: '50%' }}
      >
        <Avatar
          key={mood}
          definition={jobiDefinition as never}
          animation={reducedMotion ? undefined : (mood as never)}
          expression={reducedMotion ? ('neutral' as never) : undefined}
          autoplay
          size="clamp(72px, 18vw, 120px)"
          ariaLabel="Jobi, the EveryJob mascot"
          onAnimationEnd={handleAnimationEnd as never}
        />
      </div>
    </div>
  );
}
