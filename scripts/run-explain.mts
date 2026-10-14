// One-off runner for scripts/explain-perf.sql: executes each EXPLAIN statement
// and prints name + plan + execution time. Scratch DB only.
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? '';
if (!url.includes('127.0.0.1:54333') && !url.includes('localhost:54333')) {
  console.error('REFUSED: only runs against the local scratch DB.');
  process.exit(1);
}
const db = new PrismaClient({ datasources: { db: { url } } });
const sql = readFileSync('scripts/explain-perf.sql', 'utf8');
const stmts = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 0);

for (const stmt of stmts) {
  if (!/\bEXPLAIN\s*\(/i.test(stmt)) continue; // header comment block
  const name = (stmt.match(/-- (Q\d+: [^\n]*)/) ?? [])[1] ?? 'query';
  const rows = (await db.$queryRawUnsafe(stmt)) as Array<{ 'QUERY PLAN': string }>;
  const plan = rows.map((r) => r['QUERY PLAN']).join('\n');
  const exec = (plan.match(/Execution Time: ([\d.]+) ms/) ?? [])[1] ?? '?';
  console.log(`=== ${name} | Execution Time: ${exec} ms ===`);
  console.log(plan);
  console.log('');
}
await db.$disconnect();
