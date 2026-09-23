import type { CSSProperties } from 'react';
import { Check, Bot } from 'lucide-react';

export interface CopilotDemoStrings {
  chatTitle: string;
  langBadge: string;
  msg1: string;
  msg2: string;
  msg3: string;
  msg4Title: string;
  msg4Detail: string;
  inputLabel: string;
  inputHint: string;
}

/** Small helper: each chat bubble gets a --msg-delay for the staggered reveal. */
function Msg({
  children,
  delay,
  side,
}: {
  children: React.ReactNode;
  delay: number;
  side: 'user' | 'bot';
}) {
  return (
    <div className={side === 'user' ? 'flex justify-end' : 'flex'}>
      <div
        className="ej-chat-msg max-w-[85%]"
        style={{ '--msg-delay': `${delay}ms` } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Copilot chat demo (server component). Bubbles stagger in one-by-one once the
 * parent .ej-reveal-visible class lands (see globals.css); the wrapper is a
 * Reveal island in page.tsx.
 */
export default function CopilotDemo({ strings }: { strings: CopilotDemoStrings }) {
  return (
    <div className="bg-white/[0.05] rounded-[24px] border border-white/10 p-6 md:p-8">
      <div
        className="ej-chat-msg flex items-center gap-2.5 mb-6"
        style={{ '--msg-delay': '0ms' } as CSSProperties}
      >
        <span className="w-8 h-8 rounded-full bg-ink flex items-center justify-center">
          <Bot size={16} className="text-white" />
        </span>
        <span className="font-semibold text-[15px]">{strings.chatTitle}</span>
        <span className="ml-auto text-[11px] font-medium uppercase tracking-widest text-white/40">
          {strings.langBadge}
        </span>
      </div>
      <div className="space-y-4 text-[14px]">
        <Msg side="user" delay={250}>
          <p className="bg-ink text-white px-4 py-2.5 rounded-2xl rounded-br-md">
            {strings.msg1}
          </p>
        </Msg>
        <Msg side="bot" delay={950}>
          <p className="bg-white/10 text-zinc-200 px-4 py-2.5 rounded-2xl rounded-bl-md">
            {strings.msg2}
          </p>
        </Msg>
        <Msg side="user" delay={1650}>
          <p className="bg-ink text-white px-4 py-2.5 rounded-2xl rounded-br-md">
            {strings.msg3}
          </p>
        </Msg>
        <Msg side="bot" delay={2350}>
          <div className="bg-emerald-500/10 border border-emerald-400/25 px-4 py-3 rounded-2xl rounded-bl-md">
            <p className="text-emerald-300 font-semibold flex items-center gap-2 mb-1 text-[14px]">
              <Check size={15} /> {strings.msg4Title}
            </p>
            <p className="text-zinc-400 text-[13px]">{strings.msg4Detail}</p>
          </div>
        </Msg>
      </div>
      <div
        className="ej-chat-msg mt-6 bg-white/5 border border-white/10 rounded-full px-5 py-3 flex items-center gap-3"
        style={{ '--msg-delay': '2900ms' } as CSSProperties}
      >
        <span className="text-lime text-[13px] font-medium">{strings.inputLabel}</span>
        <span className="w-px h-4 bg-white/15" />
        <span className="text-white/30 text-[14px]">{strings.inputHint}</span>
      </div>
    </div>
  );
}
