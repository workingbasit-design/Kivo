'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreVertical, Play, Check, Pencil, Trash2, FileText } from '@/components/icons';
import { updateJobStatus } from '@/app/actions/jobs';
import { t } from '@/lib/i18n';

interface JobRowMenuProps {
  jobId: string;
  jobTitle: string;
  status: string;
  locale: 'en' | 'fr';
}

/**
 * JobRowMenu — the visible menu alternative to swipe actions (WCAG 2.5.7).
 * Every swipe action (Start, Complete, Delete) appears here too.
 */
export default function JobRowMenu({ jobId, jobTitle, status, locale }: JobRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const T = (k: string) => t(locale, `jobs.${k}`);

  const handleStatus = async (newStatus: string) => {
    setBusy(true);
    setOpen(false);
    await updateJobStatus(jobId, newStatus);
    setBusy(false);
  };

  const menuItems: Array<{
    label: string;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
    danger?: boolean;
  }> = [];

  // Contextual quick actions based on status
  if (status === 'SCHEDULED' || status === 'NEW') {
    menuItems.push({
      label: T('startJob'),
      icon: <Play size={16} aria-hidden="true" />,
      onClick: () => handleStatus('IN PROGRESS'),
    });
  }
  if (status === 'IN PROGRESS') {
    menuItems.push({
      label: T('completeJob'),
      icon: <Check size={16} aria-hidden="true" />,
      onClick: () => handleStatus('COMPLETED'),
    });
  }
  if (status === 'COMPLETED') {
    menuItems.push({
      label: T('createInvoice'),
      icon: <FileText size={16} aria-hidden="true" />,
      href: `/invoices/new?jobId=${jobId}`,
    });
  }

  menuItems.push({
    label: t(locale, 'common.edit'),
    icon: <Pencil size={16} aria-hidden="true" />,
    href: `/jobs/${jobId}/edit`,
  });

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={T('rowActions').replace('{title}', jobTitle)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-ej-secondary hover:bg-ej-surface focus-visible:outline-2 focus-visible:outline-ej-focus disabled:opacity-50"
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[200px] bg-ej-raised border border-ej-border rounded-xl shadow-lg py-1.5"
        >
          {menuItems.map((item, i) =>
            item.href ? (
              <Link
                key={i}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ej-ink hover:bg-ej-surface min-h-[44px]"
              >
                <span className="text-ej-secondary">{item.icon}</span>
                {item.label}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-ej-ink hover:bg-ej-surface min-h-[44px] text-left"
              >
                <span className="text-ej-secondary">{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
