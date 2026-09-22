/**
 * One-off data migration: parse invoice `notes` structured text into the
 * InvoiceLineItem table (best-effort). The original `notes` text is NEVER
 * modified — only line-item rows are created.
 *
 * Formats handled:
 *  1. Current app format:  "Items:\n- Fan installation × 2 @ 499 = 998"
 *  2. Legacy seed format:  "AC Deep Service x1 — ₹1,499" / "Labour — ₹500"
 *
 * Idempotent: invoices that already have line items are skipped.
 *
 * Run: node scripts/migrate-invoice-line-items.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const round2 = (n) => Math.round(n * 100) / 100;

function parseNotesToItems(notes) {
  if (!notes || !notes.trim()) return [];

  const items = [];
  const lines = notes.split('\n');

  // Find the current-format "Items:" block, if present.
  const markerIdx = lines.findIndex((l) => l.trim() === 'Items:');
  const itemLines = markerIdx === -1 ? lines : lines.slice(markerIdx + 1);

  for (const raw of itemLines) {
    const line = raw.trim();
    if (!line) continue;

    // Format 1: "- desc × qty @ rate = total"  (× = U+00D7)
    let m = /^[-–]\s*(.+?)\s*×\s*([\d.]+)\s*@\s*([\d.]+)\s*=\s*[\d.,]+$/.exec(line);
    if (m) {
      const qty = Number(m[2]);
      const rate = Number(m[3]);
      if (m[1].trim() && qty > 0 && rate >= 0) {
        items.push({ description: m[1].trim(), qty, unitPrice: rate });
      }
      continue;
    }

    // Format 2: "desc x2 — ₹2,999" or "desc — ₹500" (— = U+2014 em dash)
    m = /^(.+?)\s*(?:[x×]\s*([\d.]+))?\s*[—–-]\s*[₹$]?\s*([\d,]+(?:\.\d{1,2})?)$/.exec(line);
    if (m) {
      const qty = m[2] ? Number(m[2]) : 1;
      const lineTotal = Number(m[3].replace(/,/g, ''));
      if (m[1].trim() && qty > 0 && lineTotal >= 0) {
        items.push({ description: m[1].trim(), qty, unitPrice: round2(lineTotal / qty) });
      }
      continue;
    }
    // Unrecognized line: stop being clever for this invoice (best-effort).
    // Only fail the whole invoice if we found nothing at all.
  }
  return items;
}

(async () => {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, number: true, notes: true, lineItems: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  });

  let migrated = 0;
  let skippedHasItems = 0;
  let skippedNoNotes = 0;
  let skippedUnparsed = 0;

  for (const inv of invoices) {
    if (inv.lineItems.length > 0) {
      skippedHasItems++;
      continue;
    }
    if (!inv.notes || !inv.notes.trim()) {
      skippedNoNotes++;
      continue;
    }
    const items = parseNotesToItems(inv.notes);
    if (items.length === 0) {
      skippedUnparsed++;
      console.log(`  [unparsed] ${inv.number}: ${JSON.stringify(inv.notes.slice(0, 120))}`);
      continue;
    }
    await prisma.invoiceLineItem.createMany({
      data: items.map((it, idx) => ({
        invoiceId: inv.id,
        description: it.description,
        qty: it.qty,
        unitPrice: it.unitPrice,
        position: idx,
      })),
    });
    migrated++;
    console.log(`  [migrated] ${inv.number}: ${items.length} line item(s)`);
  }

  console.log(
    `\nDone. migrated=${migrated} already-had-items=${skippedHasItems} ` +
      `no-notes=${skippedNoNotes} unparsed=${skippedUnparsed}`
  );
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
