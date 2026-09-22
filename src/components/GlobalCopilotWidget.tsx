'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, X, Send, User, Briefcase, Calendar, Clock,
  MapPin, Phone, Wallet, Check, PencilLine,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { currencySymbol } from '@/lib/money';
import type { JobDraft } from '@/lib/copilot/engine';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  preview?: JobDraft | null;
  created?: boolean;
  /** Client-generated idempotency key for this preview — replayed confirms collapse onto one job. */
  idempotencyKey?: string | null;
};

const QUICK_PROMPTS = [
  'Aaj ke jobs?',
  'Kitna outstanding hai?',
  'Aaj kitna kamaya?',
  'Kal ke jobs?',
];

function PreviewCard({
  preview,
  onConfirm,
  onDiscard,
  confirming,
  currency,
}: {
  preview: JobDraft;
  onConfirm: (draft: JobDraft) => void;
  onDiscard: () => void;
  confirming: boolean;
  currency?: string;
}) {
  const [draft, setDraft] = useState<JobDraft>(preview);
  const set = (patch: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const phoneDigits = (draft.phone ?? '').replace(/\D/g, '');
  const phoneOk = phoneDigits === '' || /^[6-9]\d{9}$/.test(phoneDigits);
  const priceOk = draft.price == null || (Number.isFinite(draft.price) && draft.price >= 0);
  const canConfirm = !confirming && draft.customerName.trim().length > 0 && phoneOk && priceOk;

  return (
    <div className="mt-2 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-[#6329d4]/5 border-b border-[#6329d4]/10 px-4 py-3 flex items-center gap-2 text-[#6329d4] font-semibold text-sm">
        <div className="w-6 h-6 rounded-full bg-[#6329d4]/10 flex items-center justify-center">
          <Briefcase size={14} />
        </div>
        Job preview — edit karke confirm karein
      </div>
      <div className="p-4 space-y-2.5 text-sm">
        <Row icon={<Briefcase size={15} />} label="Service" value={preview.title} />
        <EditRow icon={<User size={15} />} label="Customer">
          <input
            value={draft.customerName}
            onChange={(e) => set({ customerName: e.target.value })}
            placeholder="Customer ka naam"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-sm text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30"
          />
        </EditRow>
        <EditRow icon={<Calendar size={15} />} label="Date">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-sm text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30"
          />
        </EditRow>
        <EditRow icon={<Clock size={15} />} label="Time">
          <input
            type="time"
            value={draft.time ?? ''}
            onChange={(e) => set({ time: e.target.value || null })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-sm text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30"
          />
        </EditRow>
        <EditRow icon={<Phone size={15} />} label="Phone">
          <input
            inputMode="numeric"
            value={draft.phone ?? ''}
            onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) || null })}
            placeholder="10-digit mobile"
            className={`w-full bg-zinc-50 border rounded-lg px-2.5 py-1.5 text-sm text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30 ${phoneOk ? 'border-zinc-200' : 'border-red-400'}`}
          />
        </EditRow>
        {preview.address && <Row icon={<MapPin size={15} />} label="Address" value={preview.address} />}
        <EditRow icon={<Wallet size={15} />} label="Price">
          <input
            inputMode="numeric"
            value={draft.price ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, '');
              set({ price: v === '' ? null : Number(v) });
            }}
            placeholder={`amount (${currencySymbol(currency)})`}
            className={`w-full bg-zinc-50 border rounded-lg px-2.5 py-1.5 text-sm text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6329d4]/30 ${priceOk ? 'border-zinc-200' : 'border-red-400'}`}
          />
        </EditRow>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => onConfirm({ ...draft, customerName: draft.customerName.trim(), phone: phoneDigits || null })}
          disabled={!canConfirm}
          className="flex-1 bg-[#6329d4] hover:bg-[#5221b3] disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
        >
          <Check size={14} />
          {confirming ? 'Booking…' : 'Confirm & book'}
        </button>
        <button
          onClick={onDiscard}
          disabled={confirming}
          className="flex-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
        >
          <PencilLine size={14} />
          Discard
        </button>
      </div>
      {!draft.customerName.trim() && (
        <p className="px-4 pb-3 text-[11px] text-amber-600">
          Customer ka naam zaroori hai — upar naam likh dein ya naya message bhejein, jaise "Ramesh Kumar ka AC repair kal".
        </p>
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

export default function GlobalCopilotWidget({ currency }: { currency?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Namaste! Main Kivo hoon — aapka AI assistant.\n\nJob book karna ho, schedule dekhna ho, ya payment ka hisaab — bas yahan likho. Main aapke asli business data se jawab dunga, aur job hamesha aapke confirm karne par hi book hogi.',
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: clean }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      pushMessage({
        role: 'assistant',
        content: json.reply as string,
        preview: json.needsConfirm ? (json.preview as JobDraft) : null,
        created: !!json.created,
        // One key per booking preview: double-taps / retries of the confirm
        // carry the same key, so the server creates the job exactly once.
        idempotencyKey: json.needsConfirm ? crypto.randomUUID() : null,
      });
    } catch {
      pushMessage({
        role: 'assistant',
        content: 'Kuch gadbad ho gayi — dobara try karein.',
      });
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

  const handleConfirm = async (msgId: string, preview: JobDraft) => {
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
      pushMessage({ role: 'assistant', content: 'Job book nahi ho payi — dobara try karein.' });
    } finally {
      confirmingRef.current = null;
      setConfirmingId(null);
    }
  };

  const handleDiscard = (msgId: string) => {
    // Only act if the preview is still pending — a double-click before
    // re-render must not push the reply twice.
    const msg = messagesRef.current.find((m) => m.id === msgId);
    if (!msg?.preview) return;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, preview: null } : m)));
    pushMessage({ role: 'assistant', content: 'Theek hai, job book nahi ki. Kuch aur chahiye to batao!' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-[#6329d4] rounded-full flex items-center justify-center shadow-2xl z-50 hover:bg-[#5221b3] transition-colors"
            aria-label="Open Kivo AI assistant"
          >
            <Sparkles className="w-6 h-6 text-white" />
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
            className="fixed bottom-4 right-4 md:bottom-10 md:right-10 w-[calc(100vw-32px)] md:w-[400px] h-[600px] max-h-[calc(100vh-100px)] bg-[#fbfbfd] rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col z-50"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-200 bg-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#6329d4] rounded-lg flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-900">Kivo AI</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      Aapke data se jawab
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                    <div className="flex gap-2">
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 shrink-0 rounded-full bg-[#6329d4]/10 flex items-center justify-center border border-[#6329d4]/20 mt-1">
                          <Sparkles className="w-3 h-3 text-[#6329d4]" />
                        </div>
                      )}
                      <div
                        className={`p-3 rounded-2xl flex-1 ${
                          msg.role === 'user'
                            ? 'bg-[#6329d4] text-white rounded-tr-sm'
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
                        <PreviewCard currency={currency}
                          preview={msg.preview}
                          confirming={confirmingId === msg.id}
                          onConfirm={(draft) => handleConfirm(msg.id, draft)}
                          onDiscard={() => handleDiscard(msg.id)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#6329d4]/10 flex items-center justify-center border border-[#6329d4]/20 mt-1">
                      <Sparkles className="w-3 h-3 text-[#6329d4]" />
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
            <div className="px-4 pt-2 flex gap-2 overflow-x-auto shrink-0 bg-[#fbfbfd]">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isTyping}
                  className="shrink-0 text-[11px] font-medium text-[#6329d4] bg-[#6329d4]/5 border border-[#6329d4]/15 rounded-full px-3 py-1.5 hover:bg-[#6329d4]/10 disabled:opacity-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-zinc-200 shrink-0">
              <form onSubmit={handleSend} className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Jaise: Ramesh ka AC repair kal 3 baje…"
                  className="w-full pl-4 pr-12 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#6329d4]/40 focus:border-transparent text-sm text-zinc-900 placeholder:text-zinc-400 transition-shadow"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#6329d4] hover:bg-[#5221b3] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                  aria-label="Send"
                >
                  <Send className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
