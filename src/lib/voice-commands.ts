/**
 * Voice-mode command parser — turns a transcript into a job action.
 * Bilingual (EN/FR), pure, tested. The client handles microphone +
 * follow-up prompts; this module only decides what was said.
 */
import type { Locale } from './i18n/index.ts';

export interface VoiceJob {
  id: string;
  title: string;
  customerName: string;
  status: string;
}

export type VoiceActionKind = 'start' | 'complete' | 'note' | 'material';

export type VoiceAction =
  | { kind: VoiceActionKind; jobId: string; text?: string }
  | { kind: 'needJob'; action: VoiceActionKind; text?: string }
  | { kind: 'needText'; action: 'note' | 'material'; jobId: string }
  | { kind: 'unknown' };

const FILLER = new Set([
  'the', 'a', 'an', 'job', 'for', 'to', 'on', 'my',
  'le', 'la', 'les', 'un', 'une', 'de', 'du', 'des', 'travail', 'pour', 'mon', 'ma',
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents for FR matching
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove action words + filler, leaving the job hint ("smith"). */
function jobHint(rest: string): string {
  return norm(rest)
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .join(' ');
}

function findJob(hint: string, jobs: VoiceJob[]): VoiceJob | null {
  if (!hint) return null;
  const scored = jobs
    .map((j) => {
      const hay = norm(`${j.customerName} ${j.title}`);
      if (hay.includes(hint)) return { j, score: hint.length };
      // word-overlap fallback: any hint word appears in the job text
      const words = hint.split(' ').filter((w) => w.length > 2);
      const hits = words.filter((w) => hay.includes(w)).length;
      return { j, score: hits > 0 ? hits : -1 };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.length > 0 ? scored[0].j : null;
}

interface CmdPattern {
  re: RegExp;
  action: VoiceActionKind;
  /** how to split the action word from the rest: index of the match end */
  strip: RegExp;
}

const EN_PATTERNS: CmdPattern[] = [
  { re: /\bstart\b|\bbegin\b/, action: 'start', strip: /^(start|begin)\b\s*/ },
  { re: /\bcomplete\b|\bfinish\b|\bdone\b/, action: 'complete', strip: /^(complete|finish|i'?m done|done)\b\s*/ },
  { re: /\badd\b.*\bnote\b|\bnote\b/, action: 'note', strip: /^(add\s+(a\s+)?note|note)\b\s*/ },
  { re: /\badd\b.*\b(material|part)\b/, action: 'material', strip: /^(add\s+(material|part))\b\s*/ },
];

const FR_PATTERNS: CmdPattern[] = [
  { re: /\bcommence\b|\bdémarre\b|\bcommencer\b/, action: 'start', strip: /^(commence|demarre|commencer)\b\s*/ },
  { re: /\btermine\b|\bfini\b|\bterminer\b/, action: 'complete', strip: /^(termine|fini|terminer)\b\s*/ },
  { re: /\bajoute\b.*\bnote\b|\bnote\b/, action: 'note', strip: /^(ajoute\s+(une\s+)?note|note)\b\s*/ },
  { re: /\bajoute\b.*\b(matériel|materiel|pièce|piece)\b/, action: 'material', strip: /^(ajoute\s+(du\s+)?(materiel|piece))\b\s*/ },
];

/**
 * Parse one transcript. When `jobs` has exactly one job and no hint is
 * given, that job is assumed (the common field case: one job today).
 */
export function parseVoiceCommand(
  raw: string,
  locale: Locale,
  jobs: VoiceJob[]
): VoiceAction {
  const text = norm(raw);
  if (!text) return { kind: 'unknown' };
  const patterns = locale === 'fr' ? FR_PATTERNS : EN_PATTERNS;

  for (const p of patterns) {
    if (!p.re.test(text)) continue;
    const rest = text.replace(p.strip, '').trim();
    const hint = jobHint(rest);

    if (p.action === 'note' || p.action === 'material') {
      // "add note <text>" / "add note <text> for smith" — split text from job hint
      const job = findJob(hint, jobs) ?? (jobs.length === 1 ? jobs[0] : null);
      // text = rest minus the matched job hint words
      let noteText = rest;
      if (job) {
        const hay = norm(`${job.customerName} ${job.title}`);
        const hintWords = hint.split(' ').filter((w) => hay.includes(w) && w.length > 2);
        noteText = rest
          .split(' ')
          .filter((w) => !hintWords.includes(w) && !FILLER.has(w))
          .join(' ')
          .replace(/\b(for|to|pour)\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      if (!job) return { kind: 'needJob', action: p.action, text: noteText || undefined };
      if (!noteText) return { kind: 'needText', action: p.action, jobId: job.id };
      return { kind: p.action, jobId: job.id, text: noteText };
    }

    const job = findJob(hint, jobs) ?? (jobs.length === 1 ? jobs[0] : null);
    if (!job) return { kind: 'needJob', action: p.action };
    return { kind: p.action, jobId: job.id };
  }
  return { kind: 'unknown' };
}
