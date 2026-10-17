import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ChatBubbleProps {
  from: 'me' | 'ai';
  children: ReactNode;
  sources?: string[];
}

/**
 * Copilot chat bubble mirroring the mockup's `.msg`: "me" bubbles use the
 * ink background, "ai" bubbles use the surface. Optional source pills.
 * Presentational.
 */
export function ChatBubble({ from, children, sources }: ChatBubbleProps) {
  const isMe = from === 'me';
  return (
    <div
      data-kit="chat-bubble"
      className={cn(
        'max-w-[88%] px-[14px] py-[11px] text-[16px] leading-[1.45]',
        isMe
          ? 'self-end rounded-[18px] rounded-br-[6px] bg-ink text-surface'
          : 'self-start rounded-[18px] rounded-bl-[6px] border border-line bg-surface text-ink',
      )}
    >
      <div>{children}</div>
      {sources != null && sources.length > 0 ? (
        <div className="mt-[10px] flex flex-wrap gap-1.5">
          {sources.map((source) => (
            <span
              key={source}
              className="inline-flex min-h-[28px] items-center rounded-full bg-surface-2 px-2.5 text-[13px] font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]"
            >
              {source}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
