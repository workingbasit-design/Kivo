'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, X, Send, User, Briefcase, Calendar, CalendarDays, Clock,
  MapPin, Phone, Wallet, Check, PencilLine, Sparkles, ArrowLeft,
  UserPlus, TrendingUp, MessageSquare, Search, RotateCcw,
  CheckCircle2, ChevronRight,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { currencySymbol } from '@/lib/money';
import { formatDateShort, toISODateLocal } from '@/lib/utils';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import type { JobDraft, CustomerDraft } from '@/lib/copilot/engine';
import VoiceInputButton from '@/components/copilot/VoiceInputButton';
import { useRouter } from 'next/navigation';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  preview?: (JobDraft | CustomerDraft) | null;
  /** Which kind of record the preview would create. */
  previewKind?: 'job' | 'customer' | null;
  created?: boolean;
  /** Client-generated idempotency key for this preview — replayed confirms collapse onto one record. */
  idempotencyKey?: string | null;
};

type Mode = 'home' | 'chat' | 'flow';

type CustomerHit = { id: string; name: string; phone: string | null; address: string | null };
type ServiceHit = { id: string; name: string; price: number };

/** Booking flow state: 0 who → 1 service → 2 date → 3 time → 4 review. */
type BookingFlow = {
  kind: 'booking';
  step: 0 | 1 | 2 | 3 | 4;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  service: string;
  servicePrice: number | null;
  date: string;
  time: string | null;
  phone: string;
  price: string;
  showDateInput: boolean;
  showTimeInput: boolean;
};

/** Customer flow state: 0 name → 1 phone → 2 address → 3 review. */
type CustomerFlowState = {
  kind: 'customer';
  step: 0 | 1 | 2 | 3;
  name: string;
  phone: string;
  address: string;
};

type Flow = BookingFlow | CustomerFlowState | null;

type FlowDone = {
  kind: 'booking' | 'customer';
  headline: string;
  detail: string;
};

type Followup = { label: string; run: () => void };

const TIME_SLOTS = [
  { key: 'morning', time: '09:00' },
  { key: 'midday', time: '12:00' },
  { key: 'afternoon', time: '15:00' },
  { key: 'evening', time: '18:00' },
] as const;

const PHONE_RE = /^[2-9]\d{9}$/;
const onlyDigits = (v: string) => v.replace(/\D/g, '');

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

function ActionCard({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[64px] text-left bg-white border border-zinc-200 rounded-2xl px-4 py-3 shadow-sm hover:border-ink/40 hover:shadow active:scale-[0.98] transition-all flex items-center gap-3"
    >
      <span className="w-10 h-10 rounded-xl bg-ink/10 flex items-center justify-center shrink-0 text-ink">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-zinc-900 leading-tight">{label}</span>
        <span className="block text-[11px] text-zinc-500 leading-tight mt-0.5 truncate">{desc}</span>
      </span>
      <ChevronRight size={16} className="ml-auto shrink-0 text-zinc-300" />
    </button>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!selected}
      className={cx(
        'min-h-[44px] px-4 py-2.5 rounded-full text-sm font-semibold border transition-colors',
        selected
          ? 'bg-ink text-white border-ink'
          : 'bg-white text-zinc-700 border-zinc-200 hover:border-ink/40'
      )}
    >
      {label}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[52px] bg-ink hover:bg-graphite disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
    >
      {children}
    </button>
  );
}

function TextButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[44px] text-sm font-semibold text-zinc-500 hover:text-zinc-800 py-2 transition-colors"
    >
      {children}
    </button>
  );
}

const fieldClass =
  'w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 min-h-[52px] text-[15px] text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-ink/30 focus:border-ink/40 placeholder:text-zinc-400';

/** Step header: back, progress dots, step counter, title + hint. */
function FlowHeader({
  title,
  hint,
  step,
  total,
  onBack,
  lang,
}: {
  title: string;
  hint: string;
  step: number;
  total: number;
  onBack: () => void;
  lang: Locale;
}) {
  return (
    <div className="shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t(lang, 't10misc.copilot.backLabel')}
          className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-zinc-100 text-zinc-600 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-1.5 flex-1" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cx(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= step ? 'bg-ink' : 'bg-zinc-200'
              )}
            />
          ))}
        </div>
        <span className="text-[11px] font-semibold text-zinc-400 whitespace-nowrap">
          {t(lang, 't10misc.copilot.flowStep').replace('{n}', String(step + 1)).replace('{total}', String(total))}
        </span>
      </div>
      <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{title}</h3>
      <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{hint}</p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400 w-5 flex justify-center">{icon}</span>
      <span className="text-zinc-500 text-xs w-16 shrink-0">{label}</span>
      <span className="text-zinc-800 font-medium truncate">{value}</span>
    </div>
  );
}

function EditRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400 w-5 flex justify-center">{icon}</span>
      <span className="text-zinc-500 text-xs w-16 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
function PreviewCard({
  preview,
  onConfirm,
  onDiscard,
  confirming,
  currency,
  locale,
}: {
  preview: JobDraft;
  onConfirm: (draft: JobDraft) => void;
  onDiscard: () => void;
  confirming: boolean;
  currency?: string;
  locale: Locale;
}) {
  const [draft, setDraft] = useState<JobDraft>(preview);
  const set = (patch: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const phoneDigits = (draft.phone ?? '').replace(/\D/g, '');
  const phoneOk = phoneDigits === '' || PHONE_RE.test(phoneDigits);
  const priceOk = draft.price == null || (Number.isFinite(draft.price) && draft.price >= 0);
  const canConfirm = !confirming && draft.customerName.trim().length > 0 && phoneOk && priceOk;
  const innerField =
    'w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 min-h-[44px] text-sm text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-ink/30';

  return (
    <div className="mt-2 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-ink/5 border-b border-smoke px-4 py-3 flex items-center gap-2 text-ink font-semibold text-sm">
        <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center">
          <Briefcase size={14} />
        </div>
        {t(locale, 't10misc.copilot.previewTitle')}
      </div>
      <div className="p-4 space-y-2.5 text-sm">
        <Row icon={<Briefcase size={15} />} label={t(locale, 'copilot.fieldService')} value={preview.title} />
        <EditRow icon={<User size={15} />} label={t(locale, 'copilot.fieldCustomer')}>
          <input
            value={draft.customerName}
            onChange={(e) => set({ customerName: e.target.value })}
            placeholder={t(locale, 'copilot.namePlaceholder')}
            aria-label={t(locale, 'copilot.fieldCustomer')}
            className={innerField}
          />
        </EditRow>
        <EditRow icon={<Calendar size={15} />} label={t(locale, 'copilot.fieldDate')}>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            aria-label={t(locale, 'copilot.fieldDate')}
            className={innerField}
          />
        </EditRow>
        <EditRow icon={<Clock size={15} />} label={t(locale, 'copilot.fieldTime')}>
          <input
            type="time"
            value={draft.time ?? ''}
            onChange={(e) => set({ time: e.target.value || null })}
            aria-label={t(locale, 'copilot.fieldTime')}
            className={innerField}
          />
        </EditRow>
        <EditRow icon={<Phone size={15} />} label={t(locale, 'copilot.fieldPhone')}>
          <input
            inputMode="numeric"
            value={draft.phone ?? ''}
            onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) || null })}
            placeholder={t(locale, 'copilot.phonePlaceholder')}
            aria-label={t(locale, 'copilot.fieldPhone')}
            className={`${innerField} ${phoneOk ? '' : '!border-red-400'}`}
          />
        </EditRow>
        {preview.address && <Row icon={<MapPin size={15} />} label={t(locale, 'copilot.fieldAddress')} value={preview.address} />}
        <EditRow icon={<Wallet size={15} />} label={t(locale, 'copilot.fieldPrice')}>
          <input
            inputMode="numeric"
            value={draft.price ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, '');
              set({ price: v === '' ? null : Number(v) });
            }}
            placeholder={`amount (${currencySymbol(currency)})`}
            aria-label={t(locale, 'copilot.fieldPrice')}
            className={`${innerField} ${priceOk ? '' : '!border-red-400'}`}
          />
        </EditRow>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => onConfirm({ ...draft, customerName: draft.customerName.trim(), phone: phoneDigits || null })}
          disabled={!canConfirm}
          className="flex-1 min-h-[44px] bg-ink hover:bg-graphite disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
        >
          <Check size={14} />
          {confirming ? t(locale, 't10misc.copilot.booking') : t(locale, 't10misc.copilot.confirmBook')}
        </button>
        <button
          onClick={() => onDiscard()}
          disabled={confirming}
          className="flex-1 min-h-[44px] bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
        >
          <PencilLine size={14} />
          {t(locale, 't10misc.copilot.discard')}
        </button>
      </div>
      {!draft.customerName.trim() && (
        <p className="px-4 pb-3 text-[11px] text-amber-600">{t(locale, 'copilot.nameRequired')}</p>
      )}
    </div>
  );
}

/** Preview card for adding a brand-new customer — explicit confirm, never silent. */
function CustomerPreviewCard({
  preview,
  onConfirm,
  onDiscard,
  confirming,
  locale,
}: {
  preview: CustomerDraft;
  onConfirm: (draft: CustomerDraft) => void;
  onDiscard: () => void;
  confirming: boolean;
  locale: Locale;
}) {
  const [draft, setDraft] = React.useState<CustomerDraft>(preview);
  const set = (patch: Partial<CustomerDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const phoneDigits = (draft.phone ?? '').replace(/\D/g, '');
  const phoneOk = phoneDigits === '' || PHONE_RE.test(phoneDigits);
  const canConfirm = !confirming && draft.name.trim().length > 0 && phoneOk;
  const innerField =
    'w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 min-h-[44px] text-sm text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-ink/30';

  return (
    <div className="mt-2 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-ink/5 border-b border-smoke px-4 py-3 flex items-center gap-2 text-ink font-semibold text-sm">
        <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center">
          <User size={14} />
        </div>
        {t(locale, 't10misc.copilot.customerPreviewTitle')}
      </div>
      <div className="p-4 space-y-2.5 text-sm">
        <EditRow icon={<User size={15} />} label={t(locale, 'copilot.fieldCustomer')}>
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={t(locale, 'copilot.namePlaceholder')}
            aria-label={t(locale, 'copilot.fieldCustomer')}
            className={innerField}
          />
        </EditRow>
        <EditRow icon={<Phone size={15} />} label={t(locale, 'copilot.fieldPhone')}>
          <input
            inputMode="numeric"
            value={draft.phone ?? ''}
            onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) || null })}
            placeholder={t(locale, 'copilot.phonePlaceholder')}
            aria-label={t(locale, 'copilot.fieldPhone')}
            className={`${innerField} ${phoneOk ? '' : '!border-red-400'}`}
          />
        </EditRow>
        <EditRow icon={<MapPin size={15} />} label={t(locale, 'copilot.fieldAddress')}>
          <input
            value={draft.address ?? ''}
            onChange={(e) => set({ address: e.target.value || null })}
            aria-label={t(locale, 'copilot.fieldAddress')}
            className={innerField}
          />
        </EditRow>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => onConfirm({ ...draft, name: draft.name.trim(), phone: phoneDigits || null })}
          disabled={!canConfirm}
          className="flex-1 min-h-[44px] bg-ink hover:bg-graphite disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
        >
          <Check size={14} />
          {confirming ? t(locale, 't10misc.copilot.adding') : t(locale, 't10misc.copilot.confirmAdd')}
        </button>
        <button
          onClick={() => onDiscard()}
          disabled={confirming}
          className="flex-1 min-h-[44px] bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
        >
          <PencilLine size={14} />
          {t(locale, 't10misc.copilot.discard')}
        </button>
      </div>
      {!draft.name.trim() && (
        <p className="px-4 pb-3 text-[11px] text-amber-600">{t(locale, 'copilot.nameRequired')}</p>
      )}
    </div>
  );
}
export default function GlobalCopilotWidget({
  currency,
  locale,
}: {
  currency?: string;
  locale?: string;
}) {
  const lang: Locale = locale === 'fr' ? 'fr' : 'en';
  const quickPrompts = [
    lang === 'fr' ? "Les tâches d'aujourd'hui?" : "Today's jobs?",
    lang === 'fr' ? 'Combien me doit-on?' : "What's outstanding?",
    lang === 'fr' ? "Combien ai-je gagné aujourd'hui?" : 'How much did I earn today?',
    lang === 'fr' ? 'Les tâches de demain?' : "Tomorrow's jobs?",
  ];
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('home');
  const [flow, setFlow] = useState<Flow>(null);
  const [flowDone, setFlowDone] = useState<FlowDone | null>(null);
  const [confirmingFlow, setConfirmingFlow] = useState(false);

  // Guided-flow lookup state
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [services, setServices] = useState<ServiceHit[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customService, setCustomService] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(false);

  // On mobile the FAB floats over page content; hide it while the user
  // scrolls down so it never sits on top of buttons they need to tap,
  // and bring it back when they scroll up. Desktop keeps it always visible.
  const [fabHidden, setFabHidden] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = window.scrollY;
        if (!mq.matches) {
          setFabHidden(false);
        } else if (y < 40) {
          setFabHidden(false);
        } else {
          const dy = y - lastY;
          if (dy > 6) setFabHidden(true);
          else if (dy < -6) setFabHidden(false);
        }
        lastY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ---------------- chat state (existing free-text experience) -------- */
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: t(lang, 'copilot.greeting') },
  ]);
  const [input, setInput] = useState('');
  const [homeAsk, setHomeAsk] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [chatFollowups, setChatFollowups] = useState<Followup[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const sendBusyRef = useRef(false);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const scrollBodyTop = () => {
    bodyRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (isOpen && mode === 'chat') scrollToBottom();
    if (isOpen && (mode === 'home' || mode === 'flow')) scrollBodyTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isTyping, isOpen, mode, flow?.step, flowDone]);

  const pushMessage = (msg: Omit<Message, 'id'>) =>
    setMessages((prev) => [...prev, { ...msg, id: crypto.randomUUID() }]);

  const sendMessage = async (text: string) => {
    const clean = text.trim();
    if (!clean || sendBusyRef.current) return;
    sendBusyRef.current = true;
    setChatFollowups(null);

    pushMessage({ role: 'user', content: clean });
    setIsTyping(true);

    try {
      const history = messagesRef.current.slice(-6).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 2000),
      }));
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: clean, history }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      pushMessage({
        role: 'assistant',
        content: json.reply as string,
        preview: json.needsConfirm ? ((json.preview as JobDraft | CustomerDraft) ?? null) : null,
        previewKind: json.needsConfirm ? ((json.previewKind as string) === 'customer' ? 'customer' : 'job') : null,
        created: !!json.created,
        idempotencyKey: json.needsConfirm ? crypto.randomUUID() : null,
      });
    } catch {
      const msg = t(lang, 't10misc.copilot.sendError');
      pushMessage({ role: 'assistant', content: msg });
      toast.error(msg);
    } finally {
      sendBusyRef.current = false;
      setIsTyping(false);
    }
  };
  // Keep the event-listener ref pointed at the latest sendMessage. Assigned
  // in an effect: writing a ref during render is a side effect.
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  const confirmingRef = useRef<string | null>(null);

  const handleConfirm = async (msgId: string, preview: JobDraft | CustomerDraft, kind: 'job' | 'customer' = 'job') => {
    if (confirmingRef.current === msgId) return;
    confirmingRef.current = msgId;
    setConfirmingId(msgId);
    const msg = messagesRef.current.find((m) => m.id === msgId);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          previewType: kind,
          preview,
          idempotencyKey: msg?.idempotencyKey ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Confirm failed');
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, preview: null } : m)));
      pushMessage({ role: 'assistant', content: json.reply as string, created: true });
      setChatFollowups([
        { label: t(lang, 't10misc.copilot.bookAnother'), run: () => startBooking() },
        { label: t(lang, 't10misc.copilot.viewJobs'), run: () => { router.push('/jobs'); } },
        { label: t(lang, 't10misc.copilot.backToStart'), run: () => goHome() },
      ]);
    } catch {
      const msg = t(lang, 't10misc.copilot.confirmError');
      pushMessage({ role: 'assistant', content: msg });
      toast.error(msg);
    } finally {
      confirmingRef.current = null;
      setConfirmingId(null);
    }
  };

  const handleDiscard = (msgId: string, kind: 'job' | 'customer' = 'job') => {
    const msg = messagesRef.current.find((m) => m.id === msgId);
    if (!msg?.preview) return;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, preview: null } : m)));
    pushMessage({ role: 'assistant', content: kind === 'customer' ? t(lang, 't10misc.copilot.customerCancelled') : t(lang, 'copilot.bookingCancelled') });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  /* ---------------- navigation ---------------- */
  const goHome = () => {
    setMode('home');
    setFlow(null);
    setFlowDone(null);
    setChatFollowups(null);
    setConfirmingFlow(false);
  };

  const runQuickQuery = (en: string, frText: string) => {
    setMode('chat');
    void sendMessage(lang === 'fr' ? frText : en);
  };

  /* ---------------- guided-flow lookups ---------------- */
  const loadCustomers = async (q?: string) => {
    setLookupLoading(true);
    setLookupError(false);
    try {
      const res = await fetch(`/api/copilot?type=customers${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      if (!res.ok) throw new Error('lookup failed');
      const json = await res.json();
      setCustomers(json.customers ?? []);
    } catch {
      setLookupError(true);
    } finally {
      setLookupLoading(false);
    }
  };

  const loadServices = async () => {
    setLookupLoading(true);
    setLookupError(false);
    try {
      const res = await fetch('/api/copilot?type=services');
      if (!res.ok) throw new Error('lookup failed');
      const json = await res.json();
      setServices(json.services ?? []);
    } catch {
      setLookupError(true);
    } finally {
      setLookupLoading(false);
    }
  };

  // Debounced customer search while typing in the booking flow.
  useEffect(() => {
    if (mode !== 'flow' || flow?.kind !== 'booking' || flow.step !== 0) return;
    const id = window.setTimeout(() => {
      void loadCustomers(customerSearch.trim() || undefined);
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearch, mode, flow?.kind, flow && flow.kind === 'booking' ? flow.step : -1]);

  const freshBookingFlow = (): BookingFlow => ({
    kind: 'booking',
    step: 0,
    customerName: '',
    customerPhone: null,
    customerAddress: null,
    service: '',
    servicePrice: null,
    date: '',
    time: null,
    phone: '',
    price: '',
    showDateInput: false,
    showTimeInput: false,
  });

  const startBooking = () => {
    setFlow(freshBookingFlow());
    setFlowDone(null);
    setCustomerSearch('');
    setCustomService('');
    setMode('flow');
    void loadCustomers();
    void loadServices();
  };

  const startCustomerFlow = () => {
    setFlow({ kind: 'customer', step: 0, name: '', phone: '', address: '' });
    setFlowDone(null);
    setMode('flow');
  };

  const flowBack = () => {
    if (!flow) return goHome();
    if (flow.step === 0) return goHome();
    setFlow({ ...flow, step: (flow.step - 1) as never });
  };

  const todayIso = () => toISODateLocal(new Date());
  const tomorrowIso = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODateLocal(d);
  };
  const dateLabel = (iso: string) => {
    if (iso === todayIso()) return t(lang, 't10misc.copilot.bookToday');
    if (iso === tomorrowIso()) return t(lang, 't10misc.copilot.bookTomorrow');
    return formatDateShort(iso, lang === 'fr' ? 'fr-CA' : 'en-CA');
  };
  const timeLabel = (hhmm: string | null) => {
    if (!hhmm) return t(lang, 't10misc.copilot.bookNoTime');
    const slot = TIME_SLOTS.find((s) => s.time === hhmm);
    if (slot) return t(lang, `t10misc.copilot.book${slot.key[0].toUpperCase()}${slot.key.slice(1)}`);
    return hhmm;
  };

  /* ---------------- guided-flow confirms (explicit, never silent) ----- */
  const confirmBookingFlow = async (f: BookingFlow) => {
    if (confirmingFlow) return;
    setConfirmingFlow(true);
    const phoneDigits = onlyDigits(f.phone).slice(0, 10);
    const priceDigits = onlyDigits(f.price);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          preview: {
            title: f.service.trim().slice(0, 120),
            date: f.date,
            time: f.time,
            customerName: f.customerName.trim().slice(0, 80),
            phone: phoneDigits || null,
            address: f.customerAddress,
            price: priceDigits ? Number(priceDigits) : null,
          },
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Confirm failed');
      setFlow(null);
      setFlowDone({
        kind: 'booking',
        headline: t(lang, 't10misc.copilot.bookSuccess'),
        detail: `${f.customerName} · ${f.service} · ${dateLabel(f.date)}${f.time ? ` · ${timeLabel(f.time)}` : ''}`,
      });
    } catch {
      toast.error(t(lang, 't10misc.copilot.confirmError'));
    } finally {
      setConfirmingFlow(false);
    }
  };

  const confirmCustomerFlow = async (f: CustomerFlowState) => {
    if (confirmingFlow) return;
    setConfirmingFlow(true);
    const phoneDigits = onlyDigits(f.phone).slice(0, 10);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          previewType: 'customer',
          preview: {
            name: f.name.trim().slice(0, 80),
            phone: phoneDigits || null,
            address: f.address.trim() || null,
          },
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Confirm failed');
      setFlow(null);
      setFlowDone({
        kind: 'customer',
        headline: t(lang, 't10misc.copilot.custSuccess'),
        detail: f.name.trim(),
      });
    } catch {
      toast.error(t(lang, 't10misc.copilot.confirmError'));
    } finally {
      setConfirmingFlow(false);
    }
  };
  /* ---------------- flow step renderers ---------------- */
  const renderBookingStep = (f: BookingFlow) => {
    const set = (patch: Partial<BookingFlow>) => setFlow({ ...f, ...patch });
    const advance = (patch: Partial<BookingFlow> = {}) =>
      setFlow({ ...f, ...patch, step: (f.step + 1) as BookingFlow['step'] });

    if (f.step === 0) {
      const q = customerSearch.trim();
      return (
        <>
          <FlowHeader
            title={t(lang, 't10misc.copilot.bookWhoTitle')}
            hint={t(lang, 't10misc.copilot.bookWhoHint')}
            step={0} total={5} onBack={flowBack} lang={lang}
          />
          <div className="mt-4 space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder={t(lang, 't10misc.copilot.bookWhoSearch')}
                aria-label={t(lang, 't10misc.copilot.bookWhoTitle')}
                className={cx(fieldClass, 'pl-11')}
              />
            </div>
            {lookupLoading && <p className="text-xs text-zinc-400 px-1">{t(lang, 't10misc.copilot.loading')}</p>}
            {lookupError && <p className="text-xs text-rose-600 px-1">{t(lang, 't10misc.copilot.loadError')}</p>}
            {!lookupLoading && !lookupError && (
              <div className="space-y-2">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => advance({ customerName: c.name, customerPhone: c.phone, customerAddress: c.address })}
                    className="w-full min-h-[56px] text-left bg-white border border-zinc-200 rounded-2xl px-4 py-3 hover:border-ink/40 active:scale-[0.99] transition-all flex items-center gap-3"
                  >
                    <span className="w-9 h-9 rounded-full bg-ink/10 flex items-center justify-center shrink-0">
                      <User size={16} className="text-ink" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-zinc-900 truncate">{c.name}</span>
                      {c.phone && <span className="block text-[11px] text-zinc-500">{c.phone}</span>}
                    </span>
                    <ChevronRight size={16} className="ml-auto shrink-0 text-zinc-300" />
                  </button>
                ))}
                {customers.length === 0 && (
                  <p className="text-xs text-zinc-500 px-1 py-2">{t(lang, 't10misc.copilot.bookWhoEmpty')}</p>
                )}
                {q.length > 0 && (
                  <button
                    type="button"
                    onClick={() => advance({ customerName: q, customerPhone: null, customerAddress: null })}
                    className="w-full min-h-[56px] text-left bg-lime/20 border border-lime rounded-2xl px-4 py-3 hover:brightness-95 active:scale-[0.99] transition-all"
                  >
                    <span className="block text-sm font-bold text-ink">
                      {t(lang, 't10misc.copilot.bookNewName').replace('{name}', q)}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      );
    }

    if (f.step === 1) {
      return (
        <>
          <FlowHeader
            title={t(lang, 't10misc.copilot.bookServiceTitle')}
            hint={t(lang, 't10misc.copilot.bookServiceHint')}
            step={1} total={5} onBack={flowBack} lang={lang}
          />
          <div className="mt-4 space-y-2">
            <input
              value={customService}
              onChange={(e) => setCustomService(e.target.value)}
              placeholder={t(lang, 't10misc.copilot.bookServiceOther')}
              aria-label={t(lang, 't10misc.copilot.bookServiceTitle')}
              className={fieldClass}
            />
            {customService.trim() && (
              <PrimaryButton onClick={() => { const v = customService.trim(); setCustomService(''); advance({ service: v, servicePrice: null }); }}>
                {t(lang, 't10misc.copilot.continue')}
              </PrimaryButton>
            )}
            {lookupLoading && <p className="text-xs text-zinc-400 px-1">{t(lang, 't10misc.copilot.loading')}</p>}
            {lookupError && <p className="text-xs text-rose-600 px-1">{t(lang, 't10misc.copilot.loadError')}</p>}
            {!lookupLoading && !lookupError && services.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {services.map((s) => (
                  <Chip
                    key={s.id}
                    label={`${s.name}${s.price > 0 ? ` · $${s.price}` : ''}`}
                    onClick={() => advance({ service: s.name, servicePrice: s.price > 0 ? s.price : null })}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      );
    }

    if (f.step === 2) {
      return (
        <>
          <FlowHeader
            title={t(lang, 't10misc.copilot.bookDateTitle')}
            hint=""
            step={2} total={5} onBack={flowBack} lang={lang}
          />
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Chip
                label={t(lang, 't10misc.copilot.bookToday')}
                selected={f.date === todayIso()}
                onClick={() => advance({ date: todayIso(), showDateInput: false })}
              />
              <Chip
                label={t(lang, 't10misc.copilot.bookTomorrow')}
                selected={f.date === tomorrowIso()}
                onClick={() => advance({ date: tomorrowIso(), showDateInput: false })}
              />
              <Chip
                label={t(lang, 't10misc.copilot.bookPickDate')}
                selected={f.showDateInput}
                onClick={() => set({ showDateInput: true })}
              />
            </div>
            {f.showDateInput && (
              <div className="space-y-3">
                <input
                  type="date"
                  value={f.date}
                  min={todayIso()}
                  onChange={(e) => set({ date: e.target.value })}
                  aria-label={t(lang, 't10misc.copilot.bookPickDate')}
                  className={fieldClass}
                />
                <PrimaryButton onClick={() => advance()} disabled={!f.date}>
                  {t(lang, 't10misc.copilot.continue')}
                </PrimaryButton>
              </div>
            )}
          </div>
        </>
      );
    }

    if (f.step === 3) {
      return (
        <>
          <FlowHeader
            title={t(lang, 't10misc.copilot.bookTimeTitle')}
            hint=""
            step={3} total={5} onBack={flowBack} lang={lang}
          />
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {TIME_SLOTS.map((s) => (
                <Chip
                  key={s.key}
                  label={t(lang, `t10misc.copilot.book${s.key[0].toUpperCase()}${s.key.slice(1)}`)}
                  onClick={() => advance({ time: s.time, showTimeInput: false })}
                />
              ))}
              <Chip
                label={t(lang, 't10misc.copilot.bookNoTime')}
                onClick={() => advance({ time: null, showTimeInput: false })}
              />
              <Chip
                label={t(lang, 't10misc.copilot.bookPickTime')}
                selected={f.showTimeInput}
                onClick={() => set({ showTimeInput: true })}
              />
            </div>
            {f.showTimeInput && (
              <div className="space-y-3">
                <input
                  type="time"
                  value={f.time ?? ''}
                  onChange={(e) => set({ time: e.target.value || null })}
                  aria-label={t(lang, 't10misc.copilot.bookPickTime')}
                  className={fieldClass}
                />
                <PrimaryButton onClick={() => advance()} disabled={!f.time}>
                  {t(lang, 't10misc.copilot.continue')}
                </PrimaryButton>
              </div>
            )}
          </div>
        </>
      );
    }

    // Step 4: review + confirm
    const phoneDigits = onlyDigits(f.phone).slice(0, 10);
    const phoneOk = phoneDigits === '' || PHONE_RE.test(phoneDigits);
    return (
      <>
        <FlowHeader
          title={t(lang, 't10misc.copilot.bookReviewTitle')}
          hint={t(lang, 't10misc.copilot.bookReviewHint')}
          step={4} total={5} onBack={flowBack} lang={lang}
        />
        <div className="mt-4 bg-white border border-zinc-200 rounded-2xl p-4 space-y-2.5 text-sm shadow-sm">
          <Row icon={<User size={15} />} label={t(lang, 'copilot.fieldCustomer')} value={f.customerName} />
          <Row icon={<Briefcase size={15} />} label={t(lang, 'copilot.fieldService')} value={f.service} />
          <Row icon={<Calendar size={15} />} label={t(lang, 'copilot.fieldDate')} value={dateLabel(f.date)} />
          <Row icon={<Clock size={15} />} label={t(lang, 'copilot.fieldTime')} value={timeLabel(f.time)} />
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
              {t(lang, 't10misc.copilot.bookPhoneLabel')}
            </label>
            <input
              inputMode="numeric"
              value={f.phone}
              onChange={(e) => set({ phone: onlyDigits(e.target.value).slice(0, 10) })}
              placeholder={t(lang, 'copilot.phonePlaceholder')}
              className={cx(fieldClass, !phoneOk && '!border-red-400')}
            />
            {!phoneOk && <p className="text-[11px] text-rose-600 mt-1">{t(lang, 't10misc.copilot.phoneInvalid')}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
              {t(lang, 't10misc.copilot.bookPriceLabel')}
            </label>
            <input
              inputMode="numeric"
              value={f.price}
              onChange={(e) => set({ price: onlyDigits(e.target.value).slice(0, 7) })}
              placeholder={f.servicePrice != null ? `${currencySymbol(currency)}${f.servicePrice}` : `0`}
              className={fieldClass}
            />
          </div>
          <PrimaryButton onClick={() => {
            const effectivePrice = f.price === '' && f.servicePrice != null ? String(f.servicePrice) : f.price;
            if (effectivePrice !== f.price) setFlow({ ...f, price: effectivePrice });
            void confirmBookingFlow({ ...f, price: effectivePrice });
          }} disabled={confirmingFlow || !phoneOk}>
            <Check size={16} />
            {confirmingFlow ? t(lang, 't10misc.copilot.booking') : t(lang, 't10misc.copilot.bookConfirm')}
          </PrimaryButton>
          <TextButton onClick={() => { setCustomerSearch(''); setFlow(freshBookingFlow()); }}>
            <span className="inline-flex items-center gap-1.5"><RotateCcw size={14} />{t(lang, 't10misc.copilot.bookStartOver')}</span>
          </TextButton>
        </div>
      </>
    );
  };

  const renderCustomerStep = (f: CustomerFlowState) => {
    const set = (patch: Partial<CustomerFlowState>) => setFlow({ ...f, ...patch });
    const advance = (patch: Partial<CustomerFlowState> = {}) =>
      setFlow({ ...f, ...patch, step: (f.step + 1) as CustomerFlowState['step'] });

    if (f.step === 0) {
      return (
        <>
          <FlowHeader
            title={t(lang, 't10misc.copilot.custNameTitle')}
            hint={t(lang, 't10misc.copilot.custNameHint')}
            step={0} total={4} onBack={flowBack} lang={lang}
          />
          <div className="mt-4 space-y-3">
            <input
              value={f.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={t(lang, 'copilot.namePlaceholder')}
              aria-label={t(lang, 't10misc.copilot.custNameTitle')}
              className={fieldClass}
              autoFocus
            />
            <PrimaryButton onClick={() => advance()} disabled={!f.name.trim()}>
              {t(lang, 't10misc.copilot.continue')}
            </PrimaryButton>
          </div>
        </>
      );
    }

    if (f.step === 1) {
      const digits = onlyDigits(f.phone).slice(0, 10);
      const ok = digits === '' || PHONE_RE.test(digits);
      return (
        <>
          <FlowHeader
            title={t(lang, 't10misc.copilot.custPhoneTitle')}
            hint={t(lang, 't10misc.copilot.custPhoneHint')}
            step={1} total={4} onBack={flowBack} lang={lang}
          />
          <div className="mt-4 space-y-3">
            <input
              inputMode="numeric"
              value={f.phone}
              onChange={(e) => set({ phone: onlyDigits(e.target.value).slice(0, 10) })}
              placeholder={t(lang, 'copilot.phonePlaceholder')}
              aria-label={t(lang, 't10misc.copilot.custPhoneTitle')}
              className={cx(fieldClass, !ok && '!border-red-400')}
              autoFocus
            />
            {!ok && <p className="text-[11px] text-rose-600">{t(lang, 't10misc.copilot.phoneInvalid')}</p>}
            <PrimaryButton onClick={() => advance()} disabled={!ok}>
              {t(lang, 't10misc.copilot.continue')}
            </PrimaryButton>
            <TextButton onClick={() => advance({ phone: '' })}>{t(lang, 't10misc.copilot.skip')}</TextButton>
          </div>
        </>
      );
    }

    if (f.step === 2) {
      return (
        <>
          <FlowHeader
            title={t(lang, 't10misc.copilot.custAddressTitle')}
            hint={t(lang, 't10misc.copilot.custAddressHint')}
            step={2} total={4} onBack={flowBack} lang={lang}
          />
          <div className="mt-4 space-y-3">
            <input
              value={f.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder={t(lang, 'copilot.fieldAddress')}
              aria-label={t(lang, 't10misc.copilot.custAddressTitle')}
              className={fieldClass}
              autoFocus
            />
            <PrimaryButton onClick={() => advance()}>{t(lang, 't10misc.copilot.continue')}</PrimaryButton>
            <TextButton onClick={() => advance({ address: '' })}>{t(lang, 't10misc.copilot.skip')}</TextButton>
          </div>
        </>
      );
    }

    // Step 3: review + confirm
    const digits = onlyDigits(f.phone).slice(0, 10);
    return (
      <>
        <FlowHeader
          title={t(lang, 't10misc.copilot.custReviewTitle')}
          hint={t(lang, 't10misc.copilot.bookReviewHint')}
          step={3} total={4} onBack={flowBack} lang={lang}
        />
        <div className="mt-4 bg-white border border-zinc-200 rounded-2xl p-4 space-y-2.5 text-sm shadow-sm">
          <Row icon={<User size={15} />} label={t(lang, 'copilot.fieldCustomer')} value={f.name.trim()} />
          {digits && <Row icon={<Phone size={15} />} label={t(lang, 'copilot.fieldPhone')} value={digits} />}
          {f.address.trim() && <Row icon={<MapPin size={15} />} label={t(lang, 'copilot.fieldAddress')} value={f.address.trim()} />}
        </div>
        <div className="mt-3 space-y-3">
          <PrimaryButton onClick={() => void confirmCustomerFlow(f)} disabled={confirmingFlow}>
            <Check size={16} />
            {confirmingFlow ? t(lang, 't10misc.copilot.adding') : t(lang, 't10misc.copilot.custConfirm')}
          </PrimaryButton>
          <TextButton onClick={() => setFlow({ kind: 'customer', step: 0, name: '', phone: '', address: '' })}>
            <span className="inline-flex items-center gap-1.5"><RotateCcw size={14} />{t(lang, 't10misc.copilot.bookStartOver')}</span>
          </TextButton>
        </div>
      </>
    );
  };

  const renderDone = (d: FlowDone) => {
    const followups: Followup[] =
      d.kind === 'booking'
        ? [
            { label: t(lang, 't10misc.copilot.bookAnother'), run: () => startBooking() },
            { label: t(lang, 't10misc.copilot.viewJobs'), run: () => { router.push('/jobs'); } },
            { label: t(lang, 't10misc.copilot.backToStart'), run: () => goHome() },
          ]
        : [
            { label: t(lang, 't10misc.copilot.custAddAnother'), run: () => startCustomerFlow() },
            { label: t(lang, 't10misc.copilot.viewCustomers'), run: () => { router.push('/customers'); } },
            { label: t(lang, 't10misc.copilot.backToStart'), run: () => goHome() },
          ];
    return (
      <div className="flex flex-col items-center text-center pt-10 px-2">
        <span className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </span>
        <h3 className="text-xl font-bold text-zinc-900">{d.headline}</h3>
        <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{d.detail}</p>
        <div className="w-full mt-6 space-y-2">
          {followups.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={f.run}
              className="w-full min-h-[52px] bg-white border border-zinc-200 rounded-2xl px-4 text-sm font-bold text-ink hover:border-ink/40 active:scale-[0.99] transition-all flex items-center justify-between"
            >
              {f.label}
              <ChevronRight size={16} className="text-zinc-300" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderHome = () => {
    const cards = [
      {
        icon: <Briefcase size={20} />,
        label: t(lang, 't10misc.copilot.actionBook'),
        desc: t(lang, 't10misc.copilot.actionBookDesc'),
        run: () => startBooking(),
      },
      {
        icon: <UserPlus size={20} />,
        label: t(lang, 't10misc.copilot.actionAddCustomer'),
        desc: t(lang, 't10misc.copilot.actionAddCustomerDesc'),
        run: () => startCustomerFlow(),
      },
      {
        icon: <CalendarDays size={20} />,
        label: t(lang, 't10misc.copilot.actionToday'),
        desc: t(lang, 't10misc.copilot.actionTodayDesc'),
        run: () => runQuickQuery("Today's jobs?", "Les tâches d'aujourd'hui?"),
      },
      {
        icon: <Wallet size={20} />,
        label: t(lang, 't10misc.copilot.actionOwed'),
        desc: t(lang, 't10misc.copilot.actionOwedDesc'),
        run: () => runQuickQuery("What's outstanding?", 'Combien me doit-on?'),
      },
      {
        icon: <TrendingUp size={20} />,
        label: t(lang, 't10misc.copilot.actionEarnings'),
        desc: t(lang, 't10misc.copilot.actionEarningsDesc'),
        run: () => runQuickQuery('How much did I earn today?', "Combien ai-je gagné aujourd'hui?"),
      },
      {
        icon: <MessageSquare size={20} />,
        label: t(lang, 't10misc.copilot.actionChat'),
        desc: t(lang, 't10misc.copilot.actionChatDesc'),
        run: () => setMode('chat'),
      },
    ];
    const askExamples =
      lang === 'fr'
        ? ['Qui me doit de l’argent?', 'Quoi au programme aujourd’hui?', 'Comment vont les affaires cette semaine?']
        : ['Who owes me money?', "What's on today?", "How's business this week?"];
    const askQuestion = (q: string) => {
      const clean = q.trim();
      if (!clean) return;
      setHomeAsk('');
      setMode('chat');
      void sendMessage(clean);
    };
    return (
      <div className="pt-1">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-11 h-11 rounded-2xl bg-lime flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-ink" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 tracking-tight">
              {t(lang, 't10misc.copilot.homeTitle')}
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">{t(lang, 't10misc.copilot.homeSubtitle')}</p>
          </div>
        </div>
        {/* Ask-anything: the conversational Q&A, back on the home screen alongside the action cards. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion(homeAsk);
          }}
          className="mt-4 relative flex items-center gap-2"
        >
          <label htmlFor="copilot-home-ask" className="sr-only">
            {lang === 'fr' ? 'Poser une question' : 'Ask a question'}
          </label>
          <input
            id="copilot-home-ask"
            type="text"
            value={homeAsk}
            onChange={(e) => setHomeAsk(e.target.value)}
            placeholder={
              lang === 'fr'
                ? 'Posez n’importe quelle question sur votre entreprise…'
                : 'Ask anything about your business…'
            }
            aria-label={lang === 'fr' ? 'Poser une question' : 'Ask a question'}
            className="w-full min-h-[48px] pl-4 pr-14 py-3 rounded-2xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-ink/40 focus:border-transparent text-sm text-zinc-900 placeholder:text-zinc-400 transition-shadow"
          />
          <button
            type="submit"
            disabled={!homeAsk.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl bg-ink hover:bg-graphite disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
            aria-label={lang === 'fr' ? 'Envoyer la question' : 'Send question'}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
        <div className="flex gap-2 overflow-x-auto mt-2 pb-1">
          {askExamples.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => askQuestion(q)}
              className="shrink-0 min-h-[44px] text-[11px] font-medium text-ink bg-ink/5 border border-smoke rounded-full px-3 py-1.5 hover:bg-ink/10 active:scale-[0.98] transition-all"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          {cards.map((c) => (
            <ActionCard key={c.label} icon={c.icon} label={c.label} desc={c.desc} onClick={c.run} />
          ))}
        </div>
      </div>
    );
  };
  /* ---------------- chat screen (existing free-text experience) ------ */
  const renderChat = () => (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] ${msg.role === 'user' ? '' : 'w-full'}`}>
              <div className="flex gap-2">
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 shrink-0 rounded-full bg-ink/10 flex items-center justify-center border border-smoke mt-1">
                    <Bot className="w-3 h-3 text-ink" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl flex-1 ${
                    msg.role === 'user'
                      ? 'bg-ink text-white rounded-tr-sm'
                      : 'bg-white border border-zinc-200 shadow-sm rounded-tl-sm text-zinc-800'
                  }`}
                >
                  <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 shrink-0 rounded-full bg-zinc-200 flex items-center justify-center mt-1">
                    <User className="w-3 h-3 text-zinc-500" />
                  </div>
                )}
              </div>
              {msg.preview && (
                <div className="ml-8 mt-1">
                  {msg.previewKind === 'customer' ? (
                    <CustomerPreviewCard locale={lang}
                      preview={msg.preview as CustomerDraft}
                      confirming={confirmingId === msg.id}
                      // eslint-disable-next-line react-hooks/refs -- safe: handleConfirm reads refs only inside the tap handler below (never during render); the sync ref guard is required because state updates are async and a double-tap would otherwise double-submit.
                      onConfirm={(draft) => handleConfirm(msg.id, draft, 'customer')}
                      // eslint-disable-next-line react-hooks/refs -- safe: handleDiscard reads refs only inside the tap handler (never during render).
                      onDiscard={() => handleDiscard(msg.id, 'customer')}
                    />
                  ) : (
                    <PreviewCard locale={lang} currency={currency}
                      preview={msg.preview as JobDraft}
                      confirming={confirmingId === msg.id}
                      onConfirm={(draft) => handleConfirm(msg.id, draft, 'job')}
                      onDiscard={() => handleDiscard(msg.id, 'job')}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start" role="status" aria-label={t(lang, 't10misc.copilot.onlineBadge')}>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center border border-smoke mt-1">
                <Bot className="w-3 h-3 text-ink" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-zinc-200 shadow-sm flex items-center space-x-1.5 h-[42px]">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}

        {chatFollowups && !isTyping && (
          <div className="flex flex-wrap gap-2 pt-1">
            {chatFollowups.map((f) => (
              <Chip key={f.label} label={f.label} onClick={f.run} />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto shrink-0 bg-[#fbfbfd]">
        {quickPrompts.map((q) => (
          <button
            key={q}
            // eslint-disable-next-line react-hooks/refs -- safe: sendMessage reads refs only inside the tap handler (never during render); the sync ref guard prevents double-sends on double-tap.
            onClick={() => sendMessage(q)}
            disabled={isTyping}
            className="shrink-0 min-h-[44px] text-[11px] font-medium text-ink bg-ink/5 border border-smoke rounded-full px-3 py-1.5 hover:bg-ink/10 disabled:opacity-50 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 bg-white border-t border-zinc-200 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center gap-2">
          <VoiceInputButton
            compact
            onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
          />
          <label htmlFor="copilot-input" className="sr-only">
            {t(lang, 'copilot.sendLabel')}
          </label>
          <input
            id="copilot-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(lang, 'copilot.inputPlaceholder')}
            aria-label={t(lang, 'copilot.sendLabel')}
            className="w-full min-h-[44px] pl-4 pr-14 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-ink/40 focus:border-transparent text-sm text-zinc-900 placeholder:text-zinc-400 transition-shadow"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl bg-ink hover:bg-graphite disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
            aria-label={t(lang, 'copilot.sendLabel')}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </>
  );

  // External triggers (e.g. CopilotTriggerButton) open the chat directly.
  useEffect(() => {
    const handleOpenCopilot = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsOpen(true);
      setMode('chat');
      if (customEvent.detail?.message) {
        void sendMessageRef.current(customEvent.detail.message);
      }
    };
    window.addEventListener('open-copilot', handleOpenCopilot);
    return () => window.removeEventListener('open-copilot', handleOpenCopilot);
  }, []);

  const headerTitle =
    mode === 'flow'
      ? flow?.kind === 'customer'
        ? t(lang, 't10misc.copilot.actionAddCustomer')
        : t(lang, 't10misc.copilot.actionBook')
      : 'EveryJob AI';

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: fabHidden ? 0.6 : 1,
              opacity: fabHidden ? 0 : 1,
              y: fabHidden ? 16 : 0,
            }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setIsOpen(true); goHome(); }}
            style={{ pointerEvents: fabHidden ? 'none' : 'auto' }}
            className="fixed right-4 md:bottom-10 md:right-10 bottom-[calc(6rem+env(safe-area-inset-bottom))] w-14 h-14 bg-lime rounded-full flex items-center justify-center shadow-2xl shadow-ink/20 z-50 hover:brightness-105 transition-all border border-ink/10"
            aria-label={t(lang, 'copilot.openLabel')}
          >
            <Bot className="w-6 h-6 text-ink" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slide-over panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="false"
            aria-label={t(lang, 'copilot.openLabel')}
            className="fixed bottom-0 inset-x-0 sm:bottom-10 sm:right-10 sm:left-auto w-full sm:w-[400px] h-[calc(100dvh-5.5rem)] sm:h-[600px] sm:max-h-[calc(100dvh-120px)] bg-[#fbfbfd] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-200 bg-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2.5">
                {mode !== 'home' && (
                  <button
                    onClick={goHome}
                    className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-600"
                    aria-label={t(lang, 't10misc.copilot.backToStart')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4 text-lime" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-900">{headerTitle}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      {t(lang, 't10misc.copilot.onlineBadge')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500"
                aria-label={t(lang, 'copilot.closeLabel')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            {mode === 'chat' ? (
              renderChat()
            ) : (
              <div ref={bodyRef} className="flex-1 overflow-y-auto p-4">
                {/* eslint-disable-next-line react-hooks/refs -- safe: the flagged ref reads happen only inside tap handlers (card taps -> sendMessage), never during render; sendMessage's sync ref guard prevents double-sends on double-tap. */}
                {mode === 'home' && renderHome()}
                {mode === 'flow' && !flowDone && flow && (
                  flow.kind === 'booking' ? renderBookingStep(flow) : renderCustomerStep(flow)
                )}
                {mode === 'flow' && flowDone && renderDone(flowDone)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
