import type { ReactNode } from 'react';

/**
 * Settings section heading (ChatGPT Settings redesign): green icon tile +
 * title + description, matching the prototype's `.settings-section-heading`.
 * Token classes only; the tile uses --ok-bg / --ok so it flips with the
 * theme. Rendered inside the card it heads, or passed as a `heading` prop
 * into the card components that render their own Card.
 */
export function SettingsSectionHeading({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
}) {
  return (
    <div className="ej-settings-section-heading">
      <span aria-hidden>{icon}</span>
      <div className="min-w-0">
        <h2>{title}</h2>
        {desc != null && <p>{desc}</p>}
      </div>
    </div>
  );
}

/** Group title row (prototype `.settings-group-title`). */
export function SettingsGroupTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="ej-settings-group-title">
      <h2>{title}</h2>
      <p>{desc}</p>
    </div>
  );
}
