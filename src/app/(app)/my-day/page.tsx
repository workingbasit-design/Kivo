import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJobTime } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import Link from 'next/link';

export default async function MyDayPage() {
  const session = await requireAuth();
  const locale = await getLocale();
  const businessId = session.businessId;
  const userId = session.user.id;
  
  if (!businessId) {
    return <div className="p-4">No business.</div>;
  }

  // Get today's jobs assigned to this user
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      assignedToId: userId,
      date: {
        gte: today,
        lt: tomorrow,
      },
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
    },
    include: {
      customer: {
        select: { name: true, phone: true, address: true },
      },
    },
    orderBy: { time: 'asc' },
  });

  const t = {
    en: {
      title: 'My Day',
      noJobs: 'No jobs scheduled for today.',
      maps: 'Maps',
      call: 'Call',
      notes: 'Notes',
      complete: 'Mark Complete',
      clockIn: 'Clock In',
      clockOut: 'Clock Out',
    },
    fr: {
      title: 'Ma journée',
      noJobs: 'Aucun travail prévu pour aujourd\'hui.',
      maps: 'Cartes',
      call: 'Appeler',
      notes: 'Notes',
      complete: 'Marquer terminé',
      clockIn: 'Pointer l\'arrivée',
      clockOut: 'Pointer le départ',
    },
  }[locale === 'fr' ? 'fr' : 'en'];

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>
      
      {jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>{t.noJobs}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="ej-glass-card p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{formatJobTime(job.time, locale === 'fr' ? 'fr' : 'en')}</div>
                  <div className="text-sm text-gray-600">{job.title}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  job.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {job.status}
                </span>
              </div>
              
              <div className="text-sm mb-3">
                <div className="font-medium">{job.customer.name}</div>
                <div className="text-gray-600">{job.customer.address}</div>
                {job.customer.phone && (
                  <div className="text-gray-600">{job.customer.phone}</div>
                )}
              </div>

              {job.notes && (
                <div className="text-sm bg-yellow-50 p-2 rounded mb-3">
                  <span className="font-medium">{t.notes}:</span> {job.notes}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {job.customer.address && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(job.customer.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                  >
                    {t.maps}
                  </a>
                )}
                {job.customer.phone && (
                  <a
                    href={`tel:${job.customer.phone}`}
                    className="px-3 py-2 bg-green-600 text-white rounded text-sm"
                  >
                    {t.call}
                  </a>
                )}
                <Link
                  href={`/jobs/${job.id}`}
                  className="px-3 py-2 bg-gray-200 rounded text-sm"
                >
                  {t.complete}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
