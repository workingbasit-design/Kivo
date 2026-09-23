'use client';

/**
 * Mic button for the EveryJob AI copilot — drop it next to the chat input:
 *
 *   <VoiceInputButton onTranscript={(text) => setInput((p) => p ? `${p} ${text}` : text)} />
 *
 * Shows a listening state with a live transcript preview, a hi-IN / en-IN
 * toggle, and graceful fallbacks when the mic or the Web Speech API is
 * unavailable. NOT wired into the copilot widget yet — intentional, so it
 * can be reviewed before it touches the widget.
 */
import { useEffect, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { useVoiceInput, type VoiceLang } from '@/hooks/useVoiceInput';

const LANGS: { code: VoiceLang; label: string }[] = [
  { code: 'hi-IN', label: 'हिं' },
  { code: 'en-IN', label: 'EN' },
];

export default function VoiceInputButton({
  onTranscript,
  compact = false,
}: {
  /** Called with the final transcript when the user finishes speaking. */
  onTranscript: (text: string) => void;
  /** Compact mode: just the round mic button, for tight input rows. */
  compact?: boolean;
}) {
  const { state, lang, setLang, transcript, interim, toggle, reset } = useVoiceInput('hi-IN');

  const listening = state === 'listening';

  const handleToggle = () => {
    if (listening) {
      toggle(); // stops; transcript lands via the effect below
    } else {
      reset();
      toggle();
    }
  };

  // Deliver the final transcript once listening stops — one clean string.
  const deliveredRef = useRef('');
  useEffect(() => {
    if (!listening && transcript && deliveredRef.current !== transcript) {
      deliveredRef.current = transcript;
      onTranscript(transcript.trim());
    }
    if (listening) deliveredRef.current = '';
  }, [listening, transcript, onTranscript]);

  if (state === 'unsupported') {
    return (
      <span
        title="Voice input isn't supported in this browser — try Chrome."
        className={`inline-flex items-center justify-center rounded-full text-zinc-300 ${
          compact ? 'w-9 h-9' : 'w-10 h-10'
        }`}
        aria-label="Voice input not supported"
      >
        <MicOff size={18} />
      </span>
    );
  }

  const micButton = (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={listening ? 'Stop listening' : 'Speak your message'}
      aria-pressed={listening}
      className={`inline-flex items-center justify-center rounded-full transition-all shrink-0 ${
        compact ? 'w-9 h-9' : 'w-10 h-10'
      } ${
        listening
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105'
          : 'bg-[#6329d4]/10 text-[#6329d4] hover:bg-[#6329d4]/20'
      }`}
    >
      {listening ? <Square size={15} /> : <Mic size={17} />}
    </button>
  );

  if (compact) {
    return (
      <div className="relative flex items-center">
        {micButton}
        {(listening || interim) && (
          <p
            className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap max-w-[200px] truncate text-[11px] text-zinc-500 italic bg-white border border-zinc-200 rounded-lg px-2 py-1 shadow-sm"
            aria-live="polite"
          >
            {interim || transcript || 'Listening…'}
          </p>
        )}
        {state === 'denied' && (
          <p className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 shadow-sm">
            Mic blocked — allow access in browser settings.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {state === 'denied' && (
        <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 max-w-[220px]">
          Microphone blocked — allow mic access in your browser settings, then tap again.
        </p>
      )}
      {state === 'error' && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 max-w-[220px]">
          Couldn&apos;t hear that — try again in a quieter spot.
        </p>
      )}
      {(listening || interim) && (
        <div className="flex items-center gap-2 max-w-[240px]">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <p className="text-[11px] text-zinc-500 italic truncate" aria-live="polite">
            {interim || transcript || 'Listening…'}
          </p>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <div
          role="group"
          aria-label="Voice language"
          className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5 text-[10px] font-bold"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              className={`rounded-full px-2 py-1 transition-colors ${
                lang === l.code ? 'bg-[#6329d4] text-white' : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        {micButton}
      </div>
    </div>
  );
}
