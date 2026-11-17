'use client';

import { useEffect } from 'react';
import { X } from '@/components/icons';
import JobForm, {
  type JobFormCustomer,
  type JobFormCrew,
} from '@/components/JobForm';
import { createJobWithOfflineFallback } from '@/lib/offline/job-action';
import { t, type Locale } from '@/lib/i18n';

/**
 * New Job modal (Jobs list redesign, ChatGPT Jobs prototype).
 *
 * The prototype's modal chrome — WORKSPACE kicker, "Create a job", close
 * button — wrapped around the REAL JobForm and the REAL create-job server
 * action (with the offline fallback). No sample data, no fake persistence:
 * a successful submit redirects to the new job's detail page, exactly like
 * /jobs/new. Escape and backdrop clicks close the modal.
 */
export default function NewJobModal({
  customers,
  crews,
  locale,
  onClose,
}: {
  customers: JobFormCustomer[];
  crews: JobFormCrew[];
  locale: Locale;
  onClose: () => void;
}) {
  const jobsL = (k: string) => t(locale, `jobs.${k}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="ej-jobs-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="ej-jobs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ej-new-job-title"
      >
        <div className="ej-jobs-modal-heading">
          <div>
            <span className="ej-jobs-modal-kicker">{jobsL('eyebrow')}</span>
            <h2 id="ej-new-job-title">{jobsL('createJobTitle')}</h2>
            <p>{jobsL('createJobSubtitle')}</p>
          </div>
          <button
            type="button"
            className="ej-jobs-modal-close"
            onClick={onClose}
            aria-label={t(locale, 'common.close')}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <JobForm
          customers={customers}
          crews={crews}
          action={createJobWithOfflineFallback}
          submitLabel="Create job"
          locale={locale}
          onCancel={onClose}
        />
      </section>
    </div>
  );
}
