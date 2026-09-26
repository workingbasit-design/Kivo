'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, X, Send, User, Briefcase, Calendar, Clock,
  MapPin, Phone, Wallet, Check, PencilLine, Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { currencySymbol } from '@/lib/money';
import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';
import type { JobDraft, CustomerDraft } from '@/lib/copilot/engine';
import VoiceInputButton from '@/components/copilot/VoiceInputButton';

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

const QUICK_PROMPTS: Record<Locale, string[]> = {
  en: [
    "Today's jobs?",
    "What's outstanding?",
    'How much did I earn today?',
    "Tomorrow's jobs?",
  ],
  fr: [
    "Les tâches d'aujourd'hui?",
    'Combien me doit-on?',
    "Combien ai-je gagné aujourd'hui?",
    'Les tâches de demain?',
  ],
};

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
  const phoneOk = phoneDigits === '' || /^[2-9]\d{9}$/.test(phoneDigits);
  const priceOk = draft.price == null || (Number.isFinite(draft.price) && draft.price >= 0);
  const canConfirm = !confirming && draft.customerName.trim().length > 0 && phoneOk && priceOk;
  const fieldClass =
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
            className={fieldClass}
          />
        </EditRow>
        <EditRow icon={<Calendar size={15} />} label={t(locale, 'copilot.fieldDate')}>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            aria-label={t(locale, 'copilot.fieldDate')}
            className={fieldClass}
          />
        </EditRow>
        <EditRow icon={<Clock size={15} />} label={t(locale, 'copilot.fieldTime')}>
          <input
            type="time"
            value={draft.time ?? ''}
            onChange={(e) => set({ time: e.target.value || null })}
            aria-label={t(locale, 'copilot.fieldTime')}
            className={fieldClass}
          />
        </EditRow>
        <EditRow icon={<Phone size={15} />} label={t(locale, 'copilot.fieldPhone')}>
          <input
            inputMode="numeric"
            value={draft.phone ?? ''}
            onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) || null })}
            placeholder={t(locale, 'copilot.phonePlaceholder')}
            aria-label={t(locale, 'copilot.fieldPhone')}
            className={`${fieldClass} ${phoneOk ? '' : '!border-red-400'}`}
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
            className={`${fieldClass} ${priceOk ? '' : '!border-red-400'}`}
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
          onClick={onDiscard}
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
  const phoneOk = phoneDigits === '' || /^[2-9]\d{9}$/.test(phoneDigits);
  const canConfirm = !confirming && draft.name.trim().length > 0 && phoneOk;
  const fieldClass =
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
            className={fieldClass}
          />
        </EditRow>
        <EditRow icon={<Phone size={15} />} label={t(locale, 'copilot.fieldPhone')}>
          <input
            inputMode="numeric"
            value={draft.phone ?? ''}
            onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) || null })}
            placeholder={t(locale, 'copilot.phonePlaceholder')}
            aria-label={t(locale, 'copilot.fieldPhone')}
            className={`${fieldClass} ${phoneOk ? '' : '!border-red-400'}`}
          />
        </EditRow>
        <EditRow icon={<MapPin size={15} />} label={t(locale, 'copilot.fieldAddress')}>
          <input
            value={draft.address ?? ''}
            onChange={(e) => set({ address: e.target.value || null })}
            aria-label={t(locale, 'copilot.fieldAddress')}
            className={fieldClass}
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
          onClick={onDiscard}
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

function EmptyStateCard({
  locale,
  onExample,
  disabled,
}: {
  locale: Locale;
  onExample: (text: string) => void;
  disabled: boolean;
}) {
  const examples = [
    t(locale, 't10misc.copilot.example1'),
    t(locale, 't10misc.copilot.example2'),
    t(locale, 't10misc.copilot.example3'),
  ];
  return (
    <div className="rounded-2xl border border-smoke bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-lime flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-ink" />
        </div>
        <h4 className="text-sm font-bold text-zinc-900">{t(locale, 't10misc.copilot.emptyTitle')}</h4>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed mb-3">{t(locale, 't10misc.copilot.emptySubtitle')}</p>
      <div className="space-y-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onExample(ex)}
            disabled={disabled}
            className="w-full text-left text-xs font-medium text-ink bg-ink/5 hover:bg-ink/10 border border-smoke rounded-xl px-3.5 py-2.5 min-h-[44px] transition-colors disabled:opacity-50"
          >
            “{ex}”
          </button>
        ))}
      </div>
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
  const quickPrompts = QUICK_PROMPTS[lang];
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: t(lang, 'copilot.greeting'),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Mirror of `messages` for use inside async handlers (avoids stale closures).
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  // Synchronous "a send is in flight" flag. `isTyping` state updates
  // asynchronously, so two submits in the same tick (double-Enter,
  // double-tap on a quick prompt) would both see `isTyping === false`
  // and fire duplicate requests. This ref is set synchronously and
  // guarantees one user message yields exactly one assistant response.
  const sendBusyRef = useRef(false);
  // Latest sendMessage for the once-registered `open-copilot` listener,
  // which must not close over the first render's stale `isTyping`.
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isTyping, isOpen]);

  // Allow other parts of the app to open the copilot (e.g. CopilotTriggerButton)
  // NOTE: registered exactly once. It calls through sendMessageRef so the
  // handler always uses the latest sendMessage (with the live duplicate
  // guard) instead of the first render's stale closure, whose `isTyping`
  // was forever false and would bypass the guard on repeated events.
  useEffect(() => {
    const handleOpenCopilot = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsOpen(true);
      if (customEvent.detail?.message) {
        void sendMessageRef.current(customEvent.detail.message);
      }
    };
    window.addEventListener('open-copilot', handleOpenCopilot);
    return () => window.removeEventListener('open-copilot', handleOpenCopilot);
  }, []);

  const pushMessage = (msg: Omit<Message, 'id'>) =>
    setMessages((prev) => [...prev, { ...msg, id: crypto.randomUUID() }]);

  const sendMessage = async (text: string) => {
    const clean = text.trim();
    // Synchronous guard (not the async `isTyping` state): prevents the same
    // message being sent twice when submits land before a re-render.
    if (!clean || sendBusyRef.current) return;
    sendBusyRef.current = true;

    pushMessage({ role: 'user', content: clean });
    setIsTyping(true);

    try {
      // Minimal conversation context for pronoun follow-ups: the last few
      // turns, excluding the message just pushed above (the ref updates
      // after render).
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
        // One key per preview: double-taps / retries of the confirm
        // carry the same key, so the server creates the record exactly once.
        idempotencyKey: json.needsConfirm ? crypto.randomUUID() : null,
      });
    } catch {
      const msg = t(lang, 't10misc.copilot.sendError');
      pushMessage({
        role: 'assistant',
        content: msg,
      });
      toast.error(msg);
    } finally {
      sendBusyRef.current = false;
      setIsTyping(false);
    }
  };
  // Keep the ref pointed at the latest sendMessage for the event listener.
  sendMessageRef.current = sendMessage;

  // Synchronous per-message confirm guard: `confirmingId` state updates
  // asynchronously, so a double-tap before re-render would fire two confirm
  // POSTs. The server would still create one job (idempotency key), but the
  // client would push two success messages. The ref stops the second tap.
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
      // Remove the preview from the original message, then add the success reply
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, preview: null } : m))
      );
      pushMessage({ role: 'assistant', content: json.reply as string, created: true });
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
    // Only act if the preview is still pending — a double-click before
    // re-render must not push the reply twice.
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

  const hasUserMessage = messages.some((m) => m.role === 'user');

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
            onClick={() => setIsOpen(true)}
            style={{ pointerEvents: fabHidden ? 'none' : 'auto' }}
            className="fixed bottom-24 right-4 md:bottom-10 md:right-10 w-14 h-14 bg-lime rounded-full flex items-center justify-center shadow-2xl shadow-ink/20 z-50 hover:brightness-105 transition-all border border-ink/10"
            aria-label={t(lang, 'copilot.openLabel')}
          >
            <Bot className="w-6 h-6 text-ink" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slide-over Chat Panel */}
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
            <div className="px-5 py-4 border-b border-zinc-200 bg-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4 text-lime" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-900">EveryJob AI</h3>
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

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {!hasUserMessage && !isTyping && (
                <EmptyStateCard locale={lang} onExample={(ex) => void sendMessage(ex)} disabled={isTyping} />
              )}
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
                            onConfirm={(draft) => handleConfirm(msg.id, draft, 'customer')}
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

              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto shrink-0 bg-[#fbfbfd]">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isTyping}
                  className="shrink-0 min-h-[44px] text-[11px] font-medium text-ink bg-ink/5 border border-smoke rounded-full px-3 py-1.5 hover:bg-ink/10 disabled:opacity-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-3 sm:p-4 bg-white border-t border-zinc-200 shrink-0">
              <form onSubmit={handleSend} className="relative flex items-center gap-2">
                <VoiceInputButton
                  compact
                  onTranscript={(text) =>
                    setInput((prev) => (prev ? `${prev} ${text}` : text))
                  }
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
