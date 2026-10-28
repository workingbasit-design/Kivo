/**
 * Scroll lesson 8 — the directory-profile prompt card.
 *
 * Shown on a completed/paid job when the customer consented, a profile
 * page exists, and the job's service is not already listed (those
 * gates are computed server-side; the parent also gates on the LIVE
 * status). One tap adds ONLY the service name to the public profile —
 * no customer details ever leave this card. "Not now" dismisses it for
 * this job only (localStorage, per job id); adding it removes the
 * prompt on the next load because the service is then listed.
 */
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { t, type Locale } from "@/lib/i18n";
import { addJobServiceToDirectoryProfile } from "@/app/actions/directory-profile";

function dismissKey(jobId: string): string {
  return `everyjob:dir-prompt:dismissed:${jobId}`;
}

export default function DirectoryPromptCard({
  jobId,
  service,
  locale,
}: {
  jobId: string;
  service: string;
  locale: Locale;
}) {
  const L = (k: string) => t(locale, `jobs.${k}`);
  const [dismissed, setDismissed] = useState(false);
  const [added, setAdded] = useState(false);
  const [alreadyListed, setAlreadyListed] = useState(false);
  const [isPending, startTransition] = useTransition();

  /* eslint-disable react-hooks/set-state-in-effect -- the per-job
     dismissal lives in localStorage, which can only be read client-side
     after hydration; the server-rendered card must match first paint. */
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey(jobId)) === "1");
    } catch {
      /* private mode — the card just stays visible */
    }
  }, [jobId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(jobId), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const add = () => {
    startTransition(async () => {
      const res = await addJobServiceToDirectoryProfile(jobId);
      if (!res.ok) {
        toast.error(L("directoryPromptError"));
        return;
      }
      if (res.added) setAdded(true);
      else setAlreadyListed(true);
    });
  };

  return (
    <section
      aria-label={L("directoryPromptTitle")}
      className="mx-4 mt-6 rounded-[24px] border border-line/70 bg-surface p-5 dark:border-hero-ink/10 dark:bg-coal"
    >
      {added || alreadyListed ? (
        <>
          <p className="text-[15px] font-bold text-ink">
            {added ? L("directoryPromptAdded") : L("directoryPromptAlreadyListed")}
          </p>
          <Link
            href="/directory-profile"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-hivis px-4 text-[13px] font-bold text-ink"
          >
            {L("directoryPromptViewProfile")}
          </Link>
        </>
      ) : (
        <>
          <p className="text-[15px] font-bold text-ink">{L("directoryPromptTitle")}</p>
          <p className="mt-1 text-[14px] leading-snug text-ink-2">
            {L("directoryPromptBody").replace("{service}", service)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={add}
              disabled={isPending}
              className="min-h-[44px] rounded-full bg-hivis px-4 text-[13px] font-bold text-ink disabled:opacity-50"
            >
              {L("directoryPromptAdd")}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-[44px] rounded-full border border-line px-4 text-[13px] font-semibold text-ink-2 dark:border-hero-ink/20"
            >
              {L("directoryPromptDismiss")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
