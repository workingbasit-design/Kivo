/**
 * Scroll lesson 3 — the shareable pro card.
 *
 * The card is the business's own public artefact: name, headline, service
 * areas, and a link to its directory profile. When the pro turns the
 * "include rating" toggle on, one aggregate line is added (overall rating
 * + review count, e.g. "★ 4.9 (12 reviews)").
 *
 * Privacy by construction: this input type has NO customer fields, so a
 * share can never contain a customer name, photo, or review quote — not
 * by default, not with the toggle on. The toggle only gates the aggregate
 * rating, never any individual customer's words or identity.
 */

export interface ShareCardInput {
  businessName: string;
  headline: string | null;
  areas: string[];
  /** Aggregate rating, already locale-formatted (e.g. "4.9" / "4,9"). */
  rating: { avg: string; count: number } | null;
  /** The pro's consent toggle: aggregate rating in shares. Default off. */
  includeRating: boolean;
  /** Localized templates, e.g. '★ {avg} (1 review)' / '★ {avg} ({count} reviews)'. */
  ratingOne: string;
  ratingMany: string;
}

export function buildShareCardText(input: ShareCardInput): {
  title: string;
  text: string;
} {
  const lines: string[] = [];
  lines.push(
    input.headline
      ? `${input.businessName} — ${input.headline}`
      : input.businessName,
  );
  if (input.areas.length > 0) lines.push(input.areas.join(', '));
  if (input.includeRating && input.rating) {
    const template =
      input.rating.count === 1 ? input.ratingOne : input.ratingMany;
    lines.push(
      template
        .replace('{avg}', input.rating.avg)
        .replace('{count}', String(input.rating.count)),
    );
  }
  return { title: input.businessName, text: lines.join('\n') };
}

/** A directory profile is only shareable when it actually resolves publicly. */
export function isProfilePublic(input: {
  enabled: boolean;
  directoryOptIn: boolean;
  directoryVerifiedAt: Date | null;
}): boolean {
  return input.enabled && input.directoryOptIn && input.directoryVerifiedAt !== null;
}
