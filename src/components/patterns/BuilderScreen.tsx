import type { ReactNode } from 'react';
import type { IconComponent } from '@/components/icons';
import {
  TopBar,
  Card,
  LineItems,
  StickyActionBar,
} from '@/components/kit';
import type { LineItem } from '@/components/kit';

export interface BuilderScreenProps {
  backLabel: string;
  onBack: () => void;
  icon: IconComponent;
  title: string;
  subtitle?: string;
  /** Line items section. */
  lineItemsTitle?: string;
  lines: LineItem[];
  subtotalLabel: string;
  subtotalCents: number;
  taxLabel: string;
  taxCents: number;
  totalLabel: string;
  totalCents: number;
  addFromPriceBookLabel: string;
  onAddFromPriceBook: () => void;
  addCustomItemLabel: string;
  onAddCustomItem: () => void;
  /** Optional items the customer can tick (e.g. quote add-ons). */
  optionalTitle?: string;
  optionalItems?: ReactNode;
  /** Terms: deposit, valid-until, tax source. */
  termsTitle?: string;
  terms?: ReactNode;
  /** Extra notice, e.g. the Ontario 10% rule info banner. */
  notice?: ReactNode;
  /** Sticky bar: live total, preview of what the customer sees, send/save. */
  stickyTotalLabel: string;
  previewLabel: string;
  onPreview: () => void;
  primaryLabel: string;
  onPrimary: () => void;
}

/**
 * Builder screen pattern (mockup: New quote, new invoice, job form).
 *
 * Line items with "add from price book" / "add a custom item", optional
 * items, terms, and an optional notice — with the live total in the sticky
 * action bar next to a preview of what the customer sees.
 */
export function BuilderScreen({
  backLabel,
  onBack,
  icon: Icon,
  title,
  subtitle,
  lineItemsTitle,
  lines,
  subtotalLabel,
  subtotalCents,
  taxLabel,
  taxCents,
  totalLabel,
  totalCents,
  addFromPriceBookLabel,
  onAddFromPriceBook,
  addCustomItemLabel,
  onAddCustomItem,
  optionalTitle,
  optionalItems,
  termsTitle,
  terms,
  notice,
  stickyTotalLabel,
  previewLabel,
  onPreview,
  primaryLabel,
  onPrimary,
}: BuilderScreenProps) {
  return (
    <div data-pattern="builder-screen" className="min-w-0">
      <TopBar variant="back" backLabel={backLabel} onBack={onBack} />
      <div className="flex items-center gap-3 px-0 pb-2.5 pt-1.5">
        <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-2xl border border-line bg-surface text-ink">
          <Icon size={28} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="m-0 text-[26px] font-bold leading-[1.1] tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mb-0 mt-[3px] text-[15px] text-ink-2">{subtitle}</p>
          )}
        </div>
      </div>

      {lineItemsTitle && (
        <div className="mx-[2px] mb-2 mt-5 flex items-baseline justify-between">
          <h2 className="m-0 text-[18px] font-bold text-ink">{lineItemsTitle}</h2>
        </div>
      )}
      <Card className="px-3.5 py-1">
        <LineItems
          lines={lines}
          subtotalLabel={subtotalLabel}
          subtotalCents={subtotalCents}
          taxLabel={taxLabel}
          taxCents={taxCents}
          totalLabel={totalLabel}
          totalCents={totalCents}
        />
      </Card>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddFromPriceBook}
          className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-surface-2 px-3 text-[14px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line)]"
        >
          {addFromPriceBookLabel}
        </button>
        <button
          type="button"
          onClick={onAddCustomItem}
          className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-surface-2 px-3 text-[14px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line)]"
        >
          {addCustomItemLabel}
        </button>
      </div>

      {optionalItems && (
        <section>
          {optionalTitle && (
            <div className="mx-[2px] mb-2 mt-5 flex items-baseline justify-between">
              <h2 className="m-0 text-[18px] font-bold text-ink">
                {optionalTitle}
              </h2>
            </div>
          )}
          <Card className="px-3.5 py-1">{optionalItems}</Card>
        </section>
      )}

      {terms && (
        <section>
          {termsTitle && (
            <div className="mx-[2px] mb-2 mt-5 flex items-baseline justify-between">
              <h2 className="m-0 text-[18px] font-bold text-ink">{termsTitle}</h2>
            </div>
          )}
          <Card className="px-3.5 py-1">{terms}</Card>
        </section>
      )}

      {notice && <div className="mt-3">{notice}</div>}

      <StickyActionBar
        totalLabel={stickyTotalLabel}
        totalCents={totalCents}
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        secondaryLabel={previewLabel}
        onSecondary={onPreview}
      />
    </div>
  );
}
