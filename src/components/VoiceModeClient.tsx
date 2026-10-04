"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Play, Check, StickyNote, Wrench } from "lucide-react";
import { updateJobStatus, addJobNote } from "@/app/actions/jobs";
import {
  parseVoiceCommand,
  type VoiceAction,
  type VoiceJob,
} from "@/lib/voice-commands";
import { t, type Locale } from "@/lib/i18n";
import { fillTemplate } from "@/lib/revenue";
import { Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

/* Minimal Web Speech API typing (not in TS DOM lib everywhere). */
interface SpeechRecognitionT extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionT;
    webkitSpeechRecognition?: new () => SpeechRecognitionT;
  }
}

interface LogEntry {
  id: number;
  heard: string;
  result: string;
  ok: boolean;
}

function fill(key: string, locale: Locale, params: Record<string, string | number> = {}) {
  return fillTemplate(t(locale, key), params);
}

export default function VoiceModeClient({
  jobs,
  locale,
}: {
  jobs: VoiceJob[];
  locale: Locale;
}) {
  const [supported] = useState(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<
    | { action: "note" | "material"; jobId: string }
    | { action: "start" | "complete" | "note" | "material"; needJob: true; text?: string }
    | null
  >(null);
  const recRef = useRef<SpeechRecognitionT | null>(null);
  const logId = useRef(0);
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const speak = useCallback(
    (text: string) => {
      try {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = locale === "fr" ? "fr-CA" : "en-CA";
        window.speechSynthesis.speak(u);
      } catch {
        /* speech is a nicety, never a blocker */
      }
    },
    [locale]
  );

  const pushLog = useCallback((heardText: string, result: string, ok: boolean) => {
    logId.current += 1;
    setLog((l) => [{ id: logId.current, heard: heardText, result, ok }, ...l].slice(0, 10));
  }, []);

  const runAction = useCallback(
    async (action: VoiceAction, transcript: string) => {
      if (action.kind === "unknown") {
        const msg = fill("voice.unknownCommand", locale);
        pushLog(transcript, msg, false);
        speak(msg);
        return;
      }
      if (action.kind === "needJob") {
        setPending({ action: action.action, needJob: true, text: action.text });
        const msg = fill("voice.whichJob", locale);
        pushLog(transcript, msg, false);
        speak(msg);
        return;
      }
      if (action.kind === "needText") {
        setPending({ action: action.action, jobId: action.jobId });
        const msg = fill(action.action === "note" ? "voice.sayNote" : "voice.sayMaterial", locale);
        pushLog(transcript, msg, false);
        speak(msg);
        return;
      }
      const job = jobsRef.current.find((j) => j.id === action.jobId);
      const jobLabel = job ? `“${job.title}”` : "";
      setBusy(action.jobId + action.kind);
      try {
        if (action.kind === "start" || action.kind === "complete") {
          const res = await updateJobStatus(
            action.jobId,
            action.kind === "start" ? "IN PROGRESS" : "COMPLETED"
          );
          if (res.error) throw new Error(res.error);
          const msg = fill(
            action.kind === "start" ? "voice.confirmStart" : "voice.confirmComplete",
            locale,
            { title: job?.title ?? "" }
          );
          pushLog(transcript, msg, true);
          speak(msg);
        } else {
          const fd = new FormData();
          fd.set("jobId", action.jobId);
          fd.set(
            "content",
            action.kind === "material" ? `Material used: ${action.text}` : (action.text ?? "")
          );
          const res = await addJobNote({ ok: true }, fd);
          if (res.error) throw new Error(res.error);
          const msg =
            fill("voice.didAction", locale) +
            " — " +
            fill(action.kind === "material" ? "voice.confirmMaterial" : "voice.confirmNote", locale) +
            ` ${jobLabel}`;
          pushLog(transcript, msg, true);
          speak(msg);
        }
      } catch {
        const msg = t(locale, "common.retry");
        pushLog(transcript, msg, false);
        speak(msg);
      } finally {
        setBusy(null);
        setPending(null);
      }
    },
    [locale, pushLog, speak]
  );

  const handleTranscript = useCallback(
    (transcript: string) => {
      setHeard(transcript);
      // Follow-up: we asked "what should the note say?" — treat this as the text.
      if (pending && "jobId" in pending && !("needJob" in pending)) {
        const p = pending as { action: "note" | "material"; jobId: string };
        runAction({ kind: p.action, jobId: p.jobId, text: transcript }, transcript);
        return;
      }
      // Follow-up: we asked "which job?" — re-parse with the job name.
      if (pending && "needJob" in pending) {
        const p = pending as { action: "start" | "complete" | "note" | "material"; needJob: true; text?: string };
        const retry = p.text ? `${p.action} ${transcript} ${p.text}` : `${p.action} ${transcript}`;
        runAction(parseVoiceCommand(retry, locale, jobsRef.current), transcript);
        return;
      }
      runAction(parseVoiceCommand(transcript, locale, jobsRef.current), transcript);
    },
    [locale, pending, runAction]
  );

  const toggleListening = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = locale === "fr" ? "fr-CA" : "en-CA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const transcript = last[0].transcript.trim();
      setHeard(transcript);
      if (last.isFinal && transcript) handleTranscript(transcript);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        rec.stop();
        setListening(false);
      }
    };
    rec.onend = () => {
      // Auto-restart while the toggle is on (mobile browsers stop often).
      if (recRef.current === rec) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, locale, handleTranscript]);

  useEffect(() => {
    return () => {
      const rec = recRef.current;
      recRef.current = null;
      try {
        rec?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const tap = (action: VoiceAction) => runAction(action, "—");

  return (
    <div className="space-y-5">
      {/* Mic toggle */}
      <Card className="p-5 text-center">
        {!supported ? (
          <p className="text-sm text-zinc-600">{t(locale, "voice.notSupported")}</p>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleListening}
              aria-pressed={listening}
              className={cn(
                "ej-spring mx-auto flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition-colors min-h-[96px] min-w-[96px]",
                listening ? "bg-red-600 hover:bg-red-700" : "bg-ink hover:bg-graphite"
              )}
            >
              {listening ? <MicOff size={36} /> : <Mic size={36} />}
            </button>
            <p className="mt-3 text-sm font-bold text-zinc-900">
              {listening ? t(locale, "voice.listening") : t(locale, "voice.startListening")}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{t(locale, "voice.micPermission")}</p>
          </>
        )}
        {heard && (
          <p className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            <span className="font-bold">{t(locale, "voice.heard")}: </span>“{heard}”
          </p>
        )}
      </Card>

      {/* Today's jobs — big tap targets */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          {t(locale, "voice.todayJobs")}
        </h2>
        {jobs.length === 0 ? (
          <Card>
            <EmptyState icon={<Mic size={22} />} title={t(locale, "voice.noJobs")} description="" />
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isBusy = busy?.startsWith(job.id);
              return (
                <Card key={job.id} className="p-4">
                  <p className="text-sm font-bold text-zinc-900">{job.title}</p>
                  <p className="text-xs text-zinc-500 mb-3">
                    {job.customerName} · {job.status}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!!isBusy}
                      onClick={() => tap({ kind: "start", jobId: job.id })}
                      className="min-h-[56px] rounded-xl bg-ink text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Play size={16} /> {t(locale, "voice.startJob")}
                    </button>
                    <button
                      type="button"
                      disabled={!!isBusy}
                      onClick={() => tap({ kind: "complete", jobId: job.id })}
                      className="min-h-[56px] rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Check size={16} /> {t(locale, "voice.completeJob")}
                    </button>
                    <button
                      type="button"
                      disabled={!!isBusy}
                      onClick={() => tap({ kind: "needText", action: "note", jobId: job.id })}
                      className="min-h-[56px] rounded-xl bg-white border border-zinc-200 text-zinc-800 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <StickyNote size={16} /> {t(locale, "voice.addNote")}
                    </button>
                    <button
                      type="button"
                      disabled={!!isBusy}
                      onClick={() => tap({ kind: "needText", action: "material", jobId: job.id })}
                      className="min-h-[56px] rounded-xl bg-white border border-zinc-200 text-zinc-800 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Wrench size={16} /> {t(locale, "voice.addMaterial")}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-zinc-400 mt-3 px-1">{t(locale, "voice.tapHint")}</p>
      </section>

      {/* Action log */}
      {log.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
            {t(locale, "voice.didAction")}
          </h2>
          <Card className="px-2 py-2 divide-y divide-zinc-100">
            {log.map((e) => (
              <div key={e.id} className="px-3 py-2.5">
                <p className="text-xs text-zinc-500 truncate">“{e.heard}”</p>
                <p className={cn("text-sm font-semibold", e.ok ? "text-emerald-700" : "text-amber-700")}>
                  {e.result}
                </p>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
