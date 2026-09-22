'use client';

/**
 * Voice input via the free Web Speech API (no keys, no backend).
 * Supports Hindi (hi-IN) and English (en-IN) with a language toggle —
 * built for low-literacy field users who'd rather speak than type.
 *
 * States: 'idle' | 'listening' | 'unsupported' | 'denied' | 'error'
 *
 * Usage:
 *   const { state, transcript, interim, start, stop, toggle, lang, setLang } = useVoiceInput();
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceLang = 'hi-IN' | 'en-IN';
export type VoiceState = 'idle' | 'listening' | 'unsupported' | 'denied' | 'error';

/* Minimal Web Speech API typings (not in TS DOM lib). */
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return (typeof ctor === 'function' ? ctor : null) as SpeechRecognitionCtor | null;
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function useVoiceInput(initialLang: VoiceLang = 'hi-IN') {
  const [state, setState] = useState<VoiceState>('idle');
  const [lang, setLang] = useState<VoiceLang>(initialLang);
  const [transcript, setTranscript] = useState(''); // final transcript
  const [interim, setInterim] = useState(''); // live interim transcript
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    if (!getRecognitionCtor()) setState('unsupported');
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setState('unsupported');
      return;
    }
    // Restart cleanly if already listening.
    recRef.current?.abort();

    const rec = new Ctor();
    rec.lang = langRef.current;
    rec.continuous = false; // one utterance per tap — predictable UX
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const alt = res[0];
        if (res.isFinal) finalText += alt.transcript;
        else interimText += alt.transcript;
      }
      setInterim(interimText);
      if (finalText) setTranscript((prev) => (prev ? `${prev} ${finalText}` : finalText));
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setState('denied');
      } else if (e.error === 'aborted') {
        setState('idle');
      } else {
        setState('error');
      }
      setInterim('');
    };
    rec.onend = () => {
      setInterim('');
      setState((s) => (s === 'listening' ? 'idle' : s));
    };

    recRef.current = rec;
    setTranscript('');
    setInterim('');
    try {
      rec.start();
      setState('listening');
    } catch {
      setState('error');
    }
  }, []);

  const toggle = useCallback(() => {
    if (state === 'listening') stop();
    else start();
  }, [state, start, stop]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setState(isVoiceSupported() ? 'idle' : 'unsupported');
  }, []);

  return { state, lang, setLang, transcript, interim, start, stop, toggle, reset, supported: isVoiceSupported() };
}
