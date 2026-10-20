export interface TimelineItem {
  title: string;
  timestamp: string;
  description?: string;
}

/**
 * Vertical timeline: dot rail, title, timestamp and optional description.
 * Token classes only (kit has no Timeline).
 */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-line">
      {items.map((item, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-hivis ring-4 ring-bg"
          />
          <p className="text-base font-semibold text-ink">{item.title}</p>
          <p className="text-xs text-ink-2 mt-0.5">{item.timestamp}</p>
          {item.description && (
            <p className="text-sm text-ink-2 mt-1">{item.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
