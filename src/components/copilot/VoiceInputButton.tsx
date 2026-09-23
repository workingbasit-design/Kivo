'use client';

/**
 * Mic button for the EveryJob AI copilot — drop it next to the chat input:
 *
 *   <VoiceInputButton onTranscript={(text) => setInput((p) => p ? `${p} ${text}` : text)} />
 *
 * Shows a listening state with a live transcript preview, an en-CA / fr-CA
 * toggle, and graceful fallbacks when the mic or the Web Speech API is
 * unavailable.
 */
import { useEffect, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { useVoiceInput, type VoiceLang } from '@/hooks/useVoiceInput';
import { useResolvedT } from '@/hooks/useResolvedLocale';

const LANGS: { code: VoiceLang; enKey: string; frKey: string }[] = [
  { code: 'en-CA', enKey: 't10misc.voice.langEn', frKey: 't10misc.voice.langEn' },
  { code: 'fr-CA', enKey: 't10misc.voice.langFr', frKey: 't10misc.voice.langFr' },
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
  const { t } = useResolvedT();
  const { state, lang, setLang, transcript, interim, toggle, reset } = useVoiceInput('en-CA');

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
        title={t('t10misc.voice.notSupported')}
        className={`inline-flex items-center justify-center rounded-full text-zinc-300 ${
          compact ? 'w-11 h-11' : 'w-12 h-12'
        }`}
        aria-label={t('t10misc.voice.notSupportedLabel')}
        role="img"
      >
        <MicOff size={18} />
      </span>
    );
  }

  const micButton = (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={listening ? t('t10misc.voice.stopListening') : t('t10misc.voice.speakMessage')}
      aria-pressed={listening}
      className={`inline-flex items-center justify-center rounded-full transition-all shrink-0 min-w-[44px] min-h-[44px] ${
        compact ? 'w-11 h-11' : 'w-12 h-12'
      } ${
        listening
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105'
          : 'bg-ink/10 text-ink hover:bg-smoke'
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
            {interim || transcript || t('t10misc.voice.listening')}
          </p>
        )}
        {state === 'denied' && (
          <p className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 shadow-sm">
            {t('t10misc.voice.deniedShort')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {state === 'denied' && (
        <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 max-w-[220px]">
          {t('t10misc.voice.denied')}
        </p>
      )}
      {state === 'error' && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 max-w-[220px]">
          {t('t10misc.voice.error')}
        </p>
      )}
      {(listening || interim) && (
        <div className="flex items-center gap-2 max-w-[240px]">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <p className="text-[11px] text-zinc-500 italic truncate" aria-live="polite">
            {interim || transcript || t('t10misc.voice.listening')}
          </p>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <div
          role="group"
          aria-label={t('t10misc.voice.language')}
          className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5 text-[10px] font-bold"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              className={`rounded-full px-3 py-2 min-h-[44px] transition-colors ${
                lang === l.code ? 'bg-ink text-white' : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              {t(l.enKey)}
            </button>
          ))}
        </div>
        {micButton}
      </div>
    </div>
  );
}
