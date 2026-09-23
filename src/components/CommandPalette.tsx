"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, CornerDownLeft } from "lucide-react";
import { navSections } from "@/components/nav-sections";
import { t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Entry = {
  id: string;
  label: string;
  hint: string; // section label
  href: string;
  action?: boolean;
};

const QUICK_ACTIONS: { key: string; href: string }[] = [
  { key: "nav.jobs", href: "/jobs/new" },
  { key: "nav.customers", href: "/customers/new" },
  { key: "nav.quotes", href: "/quotes/new" },
  { key: "nav.invoices", href: "/invoices/new" },
];

/**
 * Command palette (⌘K / Ctrl+K). Lazy-loaded by the app layout so it never
 * costs anything on first paint. Fully keyboard-operable and bilingual:
 * entries reuse the same nav nameKeys as the sidebar.
 */
export default function CommandPalette({ locale = "en" }: { locale?: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const entries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const section of navSections) {
      const hint = t(locale, section.labelKey);
      for (const item of section.items) {
        out.push({
          id: item.href,
          label: t(locale, item.nameKey),
          hint,
          href: item.href,
        });
      }
    }
    const newLabel = locale === "fr" ? "Nouveau" : "New";
    for (const qa of QUICK_ACTIONS) {
      out.push({
        id: `new:${qa.href}`,
        label: `${newLabel} · ${t(locale, qa.key).toLowerCase()}`,
        hint: locale === "fr" ? "Action rapide" : "Quick action",
        href: qa.href,
        action: true,
      });
    }
    return out;
  }, [locale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.label.toLowerCase().includes(q) || e.hint.toLowerCase().includes(q)
    );
  }, [entries, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  // Global shortcut + programmatic open (sidebar / mobile trigger buttons)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("everyjob:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("everyjob:open-palette", onOpen);
    };
  }, []);

  // Focus the input when the palette opens
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open ]);

  // Keep the active item in view
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (filtered.length === 0 ? 0 : (a + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) =>
        filtered.length === 0 ? 0 : (a - 1 + filtered.length) % filtered.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[active];
      if (item) go(item.href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={locale === "fr" ? "Recherche rapide" : "Quick search"}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200"
      >
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4">
          <Search size={18} className="text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={filtered[active] ? `cmdk-item-${filtered[active].id}` : undefined}
            placeholder={locale === "fr" ? "Aller à… (nom, section, action)" : "Go to… (name, section, action)"}
            className="h-14 w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
            ESC
          </kbd>
        </div>
        <div ref={listRef} id="cmdk-list" role="listbox" className="max-h-[40vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">
              {locale === "fr" ? "Aucun résultat." : "No results."}
            </p>
          ) : (
            filtered.slice(0, 30).map((e, i) => (
              <button
                key={e.id}
                id={`cmdk-item-${e.id}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(e.href)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                  i === active ? "bg-smoke" : "bg-transparent"
                )}
              >
                {e.action ? (
                  <Plus size={16} className="text-zinc-400 shrink-0" />
                ) : (
                  <CornerDownLeft size={16} className="text-zinc-400 shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900 truncate">{e.label}</span>
                  <span className="block text-[11px] text-zinc-400">{e.hint}</span>
                </span>
                {i === active && (
                  <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                    ↵
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-zinc-100 px-4 py-2.5 flex items-center gap-4 text-[11px] text-zinc-400">
          <span>
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1">↑↓</kbd>{" "}
            {locale === "fr" ? "naviguer" : "navigate"}
          </span>
          <span>
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1">↵</kbd>{" "}
            {locale === "fr" ? "ouvrir" : "open"}
          </span>
          <span className="ml-auto">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
