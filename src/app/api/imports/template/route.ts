import { getSession } from '@/lib/auth';
import { getActiveMembershipForUser } from '@/lib/membership';
import { csvTemplate, type CsvType } from '@/lib/csv';

const TYPES: CsvType[] = ['customers', 'services', 'jobs'];

/** Download a CSV import template: GET /api/imports/template?type=customers */
export async function GET(req: Request) {
  const session = await getSession();
  const membership = session ? await getActiveMembershipForUser(session.user.id) : null;
  if (!membership?.businessId) {
    return new Response('Not signed in.', { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get('type') ?? 'customers') as CsvType;
  if (!TYPES.includes(type)) {
    return new Response('Invalid type', { status: 400 });
  }
  const csv = csvTemplate(type);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="everyjob-${type}-template.csv"`,
    },
  });
}
