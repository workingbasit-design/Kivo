'use server';

import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { runCopilot, type CopilotIntent, type JobDraft } from '@/lib/copilot/engine';
import { tryAnthropicReply } from '@/lib/copilot/anthropic';

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
 */
export async function chatWithCopilot(message: string): Promise<CopilotActionResult> {
  const { user, businessId } = await requireAuth();

  const rl = rateLimit(`copilot:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return {
      reply: 'Bahut saare requests — thoda ruk kar dobara try karein.',
      intent: 'unknown',
      needsConfirm: false,
      preview: null,
      error: 'rate_limited',
    };
  }

  const clean = message.slice(0, 2000).trim();
  if (!clean) {
    return {
      reply: 'Kuch likho to sahi — main kaise madad karoon?',
      intent: 'unknown',
      needsConfirm: false,
      preview: null,
    };
  }

  const result = await runCopilot(businessId, user.id, clean);

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
