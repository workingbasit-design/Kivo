import React from 'react';
import { redirect } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, Card, EmptyState } from '@/components/ui';
import { AddLeadForm, LeadsBoard, type LeadItem } from './leads-client';

export default async function LeadsPage() {
  const session = await getSession();
  if (!session?.user?.businessId) redirect('/login');
  const businessId = session.user.businessId;

  const leads = await prisma.lead.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });

  const newCount = leads.filter((l) => l.status === 'NEW').length;

  // Serialize for the client component boundary (dates as ISO strings).
  const items: LeadItem[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    details: l.details,
    source: l.source,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle={
          newCount > 0
            ? `${newCount} new lead${newCount === 1 ? '' : 's'} waiting for a follow-up`
            : 'Track enquiries until they become customers.'
        }
        actions={<AddLeadForm />}
      />

      {leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserPlus size={24} />}
            title="No leads yet"
            description="When someone enquires on WhatsApp or by phone, add them here so no enquiry slips through."
            action={<AddLeadForm />}
          />
        </Card>
      ) : (
        <LeadsBoard leads={items} />
      )}
    </div>
  );
}
