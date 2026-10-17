'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { IconComponent } from '@/components/icons';
import { Avatar } from './Avatar';

export interface ListRowProps {
  icon?: IconComponent;
  avatarInitials?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  amount?: string;
  amountCaption?: string;
  amountTone?: 'default' | 'bad' | 'warn' | 'good';
  href?: string;
  onClick?: () => void;
}

const amountCaptionTone: Record<NonNullable<ListRowProps['amountTone']>, string> = {
  default: 'text-ink-2',
  bad: 'text-danger',
  warn: 'text-warn-text',
  good: 'text-ok',
};

/**
 * List row (mockup `.row`): icon tile or avatar on the left, title /
 * subtitle / meta in the middle, amount + caption right-aligned.
 * Renders as an <a> when `href` is given, otherwise a <div>.
 */
export function ListRow({
  icon: Icon,
  avatarInitials,
  title,
  subtitle,
  meta,
  amount,
  amountCaption,
  amountTone = 'default',
  href,
  onClick,
}: ListRowProps) {
  const Tag = href ? 'a' : 'div';

  return (
    <Tag
      data-kit="list-row"
      href={href}
      onClick={onClick}
      className={cn(
        'grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3 items-center',
        'px-3.5 py-3 min-h-[68px] w-full text-left border-t border-line',
        'first:border-t-0 text-inherit no-underline',
        (href || onClick) && 'cursor-pointer active:bg-surface-2',
        'focus-visible:outline-2 focus-visible:outline-focus',
      )}
    >
      {Icon ? (
        <span className="w-10 h-10 rounded-xl bg-surface-2 ring-1 ring-inset ring-line grid place-items-center text-ink">
          <Icon size={22} aria-hidden="true" />
        </span>
      ) : avatarInitials ? (
        <Avatar initials={avatarInitials} />
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="min-w-0 block">
        <span className="block font-semibold text-[16px] leading-[1.25] text-ink">
          {title}
        </span>
        {subtitle && (
          <span className="block text-ink-2 text-[15px] mt-[1px] overflow-hidden text-ellipsis whitespace-nowrap">
            {subtitle}
          </span>
        )}
        {meta && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-1.5 text-[14px] text-ink-2 font-semibold">
            {meta}
          </span>
        )}
      </span>
      {(amount || amountCaption) && (
        <span className="text-right flex flex-col items-end gap-[3px]">
          {amount && (
            <span className="num text-[20px] font-bold leading-[1.1] text-ink">
              {amount}
            </span>
          )}
          {amountCaption && (
            <small
              className={cn(
                'text-[13px] font-semibold whitespace-nowrap',
                amountCaptionTone[amountTone],
              )}
            >
              {amountCaption}
            </small>
          )}
        </span>
      )}
    </Tag>
  );
}
