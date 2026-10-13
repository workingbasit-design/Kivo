import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { checkSameOrigin, originForbidden } from '@/lib/csrf';
import { rateLimit, ACTION_LIMIT } from '@/lib/rate-limit';
import { parseReportPromptDetailed, runReport } from '@/lib/reports';
import { normalizeLocale } from '@/lib/i18n';

const runSchema = z.object({
  prompt: z.string().trim().min(2).max(500),
  locale: z.enum(['en', 'fr']).optional().default('en'),
});

/**
 * POST /api/reports/run — build a report from a natural-language prompt.
 *
 * The rule-based EN/FR parser turns the prompt into a ReportConfig, which runs
 * against real tenant-scoped data. Responds with { config, result, defaulted };
 * `defaulted` is true when the prompt was too vague to detect a report type.
 */
export async function POST(req: NextRequest) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) return originForbidden();

  const session = await getSession();
  const businessId = session?.user?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const rl = rateLimit(`reports-run:${businessId}`, ACTION_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid prompt.' },
      { status: 400 }
    );
  }

  const locale = normalizeLocale(parsed.data.locale);
  const { config, defaulted } = parseReportPromptDetailed(parsed.data.prompt);
  const result = await runReport(businessId, config, locale);
  return NextResponse.json({ config, result, defaulted });
}
