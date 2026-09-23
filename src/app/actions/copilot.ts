'use server';

import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { runCopilot, type CopilotHistoryItem, type CopilotIntent, type JobDraft } from '@/lib/copilot/engine';
import { tryAnthropicReply } from '@/lib/copilot/anthropic';
import { getLocale } from '@/lib/i18n/server';

export interface CopilotActionResult {
  reply: string;
  intent: CopilotIntent;
  needsConfirm: boolean;
  preview: JobDraft | null;
  error?: string;
}

/**
 * Server-action wrapper around the copilot engine.
 * Used by server components / widgets that prefer actions over fetch.
 * Job creation still requires explicit confirmation via /api/copilot (confirm:true).
 *
 * `history` is optional: recent conversation turns so pronoun follow-ups
 * ("usko kal kar do") can resolve against earlier messages.
 */
export async function chatWithCopilot(
  message: string,
  history: CopilotHistoryItem[] = []
): Promise<CopilotActionResult> {
  const { user, businessId } = await requireAuth();
  const locale = await getLocale();
  const isFr = locale === 'fr';

  const rl = rateLimit(`copilot:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return {
      reply: isFr
        ? 'Trop de requêtes — attendez un moment et réessayez.'
        : 'Too many requests — please wait a moment and try again.',
      intent: 'unknown',
      needsConfirm: false,
      preview: null,
      error: 'rate_limited',
    };
  }

  const clean = message.slice(0, 2000).trim();
  if (!clean) {
    return {
      reply: isFr
        ? 'Écrivez quelque chose — comment puis-je vous aider?'
        : 'Type something first — how can I help?',
      intent: 'unknown',
      needsConfirm: false,
      preview: null,
    };
  }

  const result = await runCopilot(businessId, user.id, clean, history.slice(-6), {
    locale,
  });

  let reply = result.reply;
  if (process.env.ANTHROPIC_API_KEY) {
    const llm = await tryAnthropicReply(clean, {
      intent: result.intent,
      dataSummary: result.reply,
      preview: result.preview,
    });
    if (llm) reply = llm;
  }

  return {
    reply,
    intent: result.intent,
    needsConfirm: result.intent === 'create_job' && !!result.preview,
    preview: result.preview ?? null,
  };
}
