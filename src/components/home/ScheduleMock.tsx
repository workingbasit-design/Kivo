import { Check, Share2 } from '@/components/icons';

export interface ScheduleMockStrings {
  title: string;
  jobs: {
    name: string;
    service: string;
    time: string;
    amt: string;
    status: string;
  }[];
  footerBefore: string;
  footerInv: string;
  footerAfter: string;
}

const TONES = [
  'text-ok bg-ok-bg',
  'text-warn-text bg-warn-bg',
  'text-info bg-info-bg',
];

/**
 * Animated "today's schedule" product mock (server component - motion is pure
 * CSS): gentle float, a pulsing live dot, and a shimmer sweep on the
 * payment-recorded strip.
 */
export default function ScheduleMock({ strings }: { strings: ScheduleMockStrings }) {
  return (
    <div
      className="ej-mock-float rounded-[24px] border border-line bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.18)] overflow-hidden"
      aria-label="Preview of the EveryJob app"
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-line">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[13px] text-ink-2">{strings.title}</span>
        <span className="ej-mock-live-dot ml-auto w-2 h-2 rounded-full bg-ok" aria-hidden />
      </div>
      <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line">
        {strings.jobs.map((j, i) => (
          <div key={j.name} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${TONES[i % TONES.length]}`}
              >
                {j.status}
              </span>
              <span className="text-[13px] text-ink-2">{j.time}</span>
            </div>
            <p className="text-[17px] font-semibold tracking-tight">{j.name}</p>
            <p className="text-[14px] text-ink-2 mb-3">{j.service}</p>
            <p className="text-[15px] font-semibold">{j.amt}</p>
          </div>
        ))}
      </div>
      <div className="relative flex items-center gap-3 px-5 py-4 bg-surface-2 border-t border-line overflow-hidden">
        <div className="ej-mock-shimmer pointer-events-none absolute inset-0" aria-hidden />
        <Share2 size={17} className="text-ink shrink-0" />
        <p className="text-[13px] text-ink-2">
          {strings.footerBefore} <span className="font-semibold text-ink">{strings.footerInv}</span>{' '}
          {strings.footerAfter}
        </p>
        <Check size={16} className="ml-auto text-ok shrink-0" />
      </div>
    </div>
  );
}
