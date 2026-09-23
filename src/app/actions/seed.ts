"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * Idempotent demo seed. Only seeds when the business has no customers yet,
 * so it never duplicates data on repeat runs.
 */
export async function seedFullDatabase(): Promise<{ message: string }> {
  // Safety: demo seed must never run in production, even if some UI path
  // ever references this action again.
  if (process.env.NODE_ENV === 'production') {
    return { message: 'Demo seed is disabled in production.' };
  }

  const { businessId } = await requireAuth();

  const existing = await prisma.customer.count({ where: { businessId } });
  if (existing > 0) {
    return { message: "Demo data already exists — nothing to seed." };
  }

  // Price book
  const serviceData = [
        { name: "Furnace Tune-Up", price: 149 },
        { name: "AC Repair Visit", price: 129 },
        { name: "Plumbing Service Call", price: 99 },
        { name: "Electrical Troubleshooting", price: 119 },
        { name: "Dryer Vent Cleaning", price: 139 },
        { name: "Home Deep Cleaning", price: 249 },
      ];
  await prisma.service.createMany({
    data: serviceData.map((s) => ({ ...s, businessId })),
  });

  // Customers
  const customerData = [
        { name: "John MacDonald", phone: "+14165550132", address: "123 Maple St, Toronto, ON", notes: "Prefers morning visits" },
        { name: "Sarah Tremblay", phone: "+15145550184", address: "456 Rue Sainte-Catherine, Montreal, QC" },
        { name: "David Chen", phone: "+16045550192", address: "789 Robson St, Vancouver, BC", notes: "Annual furnace contract" },
        { name: "Emily Wilson", phone: "+19055550176", address: "321 Queen St, Ottawa, ON" },
      ];
  const customers = await Promise.all(
    customerData.map((c) => prisma.customer.create({ data: { ...c, businessId } }))
  );

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Jobs across statuses and dates
  const jobSpecs: { title: string; status: string; offsetDays: number; price: number; customer: number; time?: string }[] = [
    { title: "Furnace Tune-Up", status: "SCHEDULED", offsetDays: 0, price: 149, customer: 0, time: "10:00 AM" },
    { title: "Plumbing Service Call", status: "SCHEDULED", offsetDays: 1, price: 99, customer: 1, time: "2:00 PM" },
    { title: "Electrical Troubleshooting", status: "IN PROGRESS", offsetDays: 0, price: 119, customer: 2, time: "9:00 AM" },
    { title: "AC Repair Visit", status: "COMPLETED", offsetDays: -3, price: 129, customer: 0 },
    { title: "Home Deep Cleaning", status: "COMPLETED", offsetDays: -7, price: 249, customer: 3 },
    { title: "Dryer Vent Cleaning", status: "PAID", offsetDays: -12, price: 139, customer: 1 },
  ];
  const jobs = await Promise.all(
    jobSpecs.map((j) =>
      prisma.job.create({
        data: {
          title: j.title,
          status: j.status,
          date: new Date(now + j.offsetDays * day),
          time: j.time,
          price: j.price,
          address: customers[j.customer].address,
          customerId: customers[j.customer].id,
          businessId,
        },
      })
    )
  );

  // Quotes
  const quotes = await Promise.all([
    prisma.quote.create({
      data: { number: "Q-1001", title: "Furnace + AC Tune-Up Package", total: 278, status: "SENT", customerId: customers[2].id, businessId },
    }),
    prisma.quote.create({
      data: { number: "Q-1002", title: "Bathroom Plumbing Overhaul", total: 450, status: "APPROVED", customerId: customers[3].id, businessId },
    }),
  ]);

  // Invoices with mixed payment states
  const taxRate = 13;
  const taxType = "HST";
  const mkInvoice = async (
    n: string, customerIdx: number, subtotal: number, status: string, offsetDays: number, paidAmount: number
  ) => {
    const taxAmount = Math.round(subtotal * (taxRate / 100));
    const inv = await prisma.invoice.create({
      data: {
        number: n,
        date: new Date(now + offsetDays * day),
        subtotal,
        taxRate,
        taxType,
        taxAmount,
        total: subtotal + taxAmount,
        status,
        customerId: customers[customerIdx].id,
        businessId,
      },
    });
    if (paidAmount > 0) {
      await prisma.payment.create({
        data: { amount: paidAmount, provider: "CASH", status: "COMPLETED", invoiceId: inv.id },
      });
    }
    return inv;
  };
  await mkInvoice("INV-1001", 0, 129, "PAID", -12, 146);
  await mkInvoice("INV-1002", 1, 139, "PARTIALLY PAID", -5, 70);
  await mkInvoice("INV-1003", 3, 249, "UNPAID", -2, 0);

  // Leads
  await prisma.lead.createMany({
    data: [
      { name: "Mike Ross", phone: "+14165550155", details: "Furnace making noise", status: "NEW", source: "WhatsApp", businessId },
      { name: "Lisa Park", phone: "+16045550143", details: "Kitchen faucet leaking", status: "CONTACTED", source: "Phone", businessId },
    ],
  });

  // Reviews
  await prisma.review.createMany({
    data: [
      { rating: 5, comment: "Great work, arrived on time!", source: "Google", customerId: customers[0].id, businessId },
      { rating: 4, comment: "Good service overall", source: "Direct", customerId: customers[1].id, businessId },
    ],
  });

  return {
    message: `Seeded ${customers.length} customers, ${jobs.length} jobs, ${quotes.length} quotes, 3 invoices, 2 leads and 2 reviews.`,
  };
}
