import type { CSSProperties } from 'react';
import { Calendar, FileText, MessageSquare, ReceiptText, type LucideIcon } from 'lucide-react';
import EveryJobLogo from '@/components/EveryJobLogo';
import styles from './HeroVisual.module.css';

export interface HeroVisualStrings {
  visualLabel: string;
  pillInvoice: string;
  chipMessage: string;
  chipCalendar: string;
  chipQuote: string;
  onePlace: string;
}

function Chip({
  icon: Icon,
  label,
  className = '',
  entranceDelay,
  floatDelay,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  className?: string;
  entranceDelay: number;
  floatDelay: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`ej-hero-anim absolute ${className}`}
      style={{ '--ej-delay': `${entranceDelay}ms` } as CSSProperties}
    >
      <div className={styles.float} style={{ '--float-delay': floatDelay } as CSSProperties}>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] backdrop-blur ${
            accent
              ? 'border-amber-200 bg-amber-50/90 text-amber-900'
              : 'border-zinc-200 bg-white/90 text-zinc-700'
          }`}
        >
          <Icon size={15} strokeWidth={1.8} className={accent ? 'text-amber-600' : 'text-ink'} />
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * Scattered-context hero visual: a wavy timeline draws itself in while
 * floating chips (a client text, a calendar note, a quote draft, and a
 * "Where's that invoice?" pill) drift above it — all converging toward an
 * EveryJob card. Pure CSS motion; disabled under prefers-reduced-motion.
 * Decorative chips hide on small screens; the invoice pill and the EveryJob
 * card stay visible so the story survives on mobile.
 */
export default function HeroVisual({ strings }: { strings: HeroVisualStrings }) {
  const nodeDelay = (ms: number) => ({ '--ej-delay': `${ms}ms` }) as CSSProperties;

  return (
    <div
      role="img"
      aria-label={strings.visualLabel}
      className="relative mx-auto w-full max-w-5xl aspect-[1200/430] select-none"
      style={{
        backgroundImage: 'radial-gradient(circle, #e7e5e4 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 55%, transparent 100%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 90% 90% at 50% 50%, black 55%, transparent 100%)',
      }}
    >
      {/* Wavy timeline */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 430"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="ej-hero-wave" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#161616" stopOpacity="0.25" />
            <stop offset="0.55" stopColor="#161616" stopOpacity="0.55" />
            <stop offset="1" stopColor="#161616" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path
          d="M -20 300 C 180 190 340 380 540 270 S 900 150 1220 260"
          stroke="url(#ej-hero-wave)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={1}
          className={styles.draw}
        />
        {/* Nodes appear as the wave passes */}
        <circle cx="300" cy="300" r="6" fill="#fff" stroke="#161616" strokeWidth="3" className={styles.node} style={nodeDelay(900)} />
        <circle cx="540" cy="270" r="6" fill="#fff" stroke="#161616" strokeWidth="3" className={styles.node} style={nodeDelay(1200)} />
        <circle cx="790" cy="212" r="6" fill="#fff" stroke="#161616" strokeWidth="3" className={styles.node} style={nodeDelay(1500)} />
        <circle cx="1010" cy="243" r="6" fill="#fff" stroke="#161616" strokeWidth="3" className={styles.node} style={nodeDelay(1750)} />
      </svg>

      {/* Scattered chips */}
      <Chip
        icon={MessageSquare}
        label={strings.chipMessage}
        className="left-[2%] top-[8%] hidden sm:block"
        entranceDelay={520}
        floatDelay="0s"
      />
      <Chip
        icon={FileText}
        label={strings.pillInvoice}
        accent
        className="left-[31%] top-[1%]"
        entranceDelay={660}
        floatDelay="-1.6s"
      />
      <Chip
        icon={Calendar}
        label={strings.chipCalendar}
        className="left-[13%] bottom-[10%] hidden md:block"
        entranceDelay={800}
        floatDelay="-3.1s"
      />
      <Chip
        icon={ReceiptText}
        label={strings.chipQuote}
        className="right-[31%] top-[24%] hidden sm:block"
        entranceDelay={940}
        floatDelay="-4.4s"
      />

      {/* Convergence: the EveryJob card */}
      <div
        className="ej-hero-anim absolute right-[1%] bottom-[5%]"
        style={{ '--ej-delay': '1100ms' } as CSSProperties}
      >
        <div className={styles.float} style={{ '--float-delay': '-2.2s' } as CSSProperties}>
          <span className="inline-flex items-center gap-3 rounded-2xl border border-smoke bg-white/95 py-3 pl-3 pr-5 shadow-[0_20px_50px_-16px_rgba(22,22,22,0.4)] backdrop-blur">
            <EveryJobLogo size={36} />
            <span className="text-left leading-tight">
              <span className="block text-[16px] font-semibold tracking-tight text-ink">
                EveryJob
              </span>
              <span className="block text-[12px] font-medium text-graphite">
                {strings.onePlace}
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
