// src/components/public/CustomerHomePage.tsx
//
// EveryJob public customer home — exact reference build
// (Design Smart Home App chat, "EveryJob – Exact Reference Build").
//
// Design is reproduced exactly: header, hero with the cropped house photo,
// search, six service cards, "Pros in Etobicoke, Toronto" section, trust
// badges. The wiring behind it is the shipped foundation's real data:
//   - Search is a native GET form to /directory (shareable URLs; the
//     directory reads q / city / minRating).
//   - Pros come from the server (verified, consent-based directory
//     listings for the default city). The exact empty state shows only
//     when that real query returns nothing — nothing is invented.
//   - All copy is EN+FR via customer.publicHome.* (copy-lint safe:
//     the reference's em dash in "List your business — Free", the
//     middle dots in "Furnace • AC • Heating" and the em dash in the
//     trust line are reworded to pass scripts/check-copy-lint.mjs).
//   - Reference links that do not exist in the repo are reconciled to
//     real routes: /pro/register -> /register (business signup),
//     /how-it-works -> /how-it-works (new page), /directory?service=X
//     -> /directory?q=X (the directory matches q against service
//     keywords), ?location= -> ?city= (the directory reads city).

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import PublicHomeHeader from "@/components/public/PublicHomeHeader";
import DirectoryProCard, { type DirectoryProData } from "@/components/DirectoryProCard";

type Service = {
  name: string;
  icon: "plumbing" | "electrical" | "cleaning" | "hvac" | "handyman" | "painting";
  href: string;
};

const services: Service[] = [
  { name: "Plumbing", icon: "plumbing", href: "/directory?q=Plumbing" },
  { name: "Electrical", icon: "electrical", href: "/directory?q=Electrical" },
  { name: "Cleaning", icon: "cleaning", href: "/directory?q=Cleaning" },
  {
    name: "HVAC",
    icon: "hvac",
    href: "/directory?q=HVAC",
  },
  { name: "Handyman", icon: "handyman", href: "/directory?q=Handyman" },
  { name: "Painting", icon: "painting", href: "/directory?q=Painting" },
];

// Default city for the home search and the pros section: the reference
// design's city. A place name, identical in EN and FR.
const DEFAULT_CITY = "Etobicoke, Toronto";

function Icon({
  name,
  size = 22,
}: {
  name: Service["icon"] | "home" | "search" | "pin" | "chevron" | "shield" | "coins" | "people" | "plus" | "layers" | "bell" | "wrench";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /><path d="M2 10 12 2l10 8" /></svg>;
    case "search":
      return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>;
    case "pin":
      return <svg {...common}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case "chevron":
      return <svg {...common}><path d="m9 5 7 7-7 7" /></svg>;
    case "plumbing":
      return <svg {...common}><path d="M4 4v5a4 4 0 0 0 4 4h3v3a4 4 0 0 0 4 4h5" /><path d="M4 4h4v4H4zM16 16h4v4h-4zM11 9h4v4h-4z" /><path d="M15 11h4a2 2 0 0 1 2 2v3" /></svg>;
    case "electrical":
      return <svg {...common}><path d="m13 2-9 12h7l-1 8 10-13h-7z" /></svg>;
    case "cleaning":
      return <svg {...common}><path d="M8 3h8l-1 4H9zM9 7h6l2 13H7z" /><path d="M10 11h4M5 5l-2-2M19 5l2-2M4 12H2M22 12h-2" /></svg>;
    case "hvac":
      return <svg {...common}><circle cx="12" cy="12" r="2.5" /><path d="M12 9.5c-4-8-8-3-5 0 1 1 3 1 5 0ZM14.5 12c8-4 3-8 0-5-1 1-1 3 0 5ZM12 14.5c4 8 8 3 5 0-1-1-3-1-5 0ZM9.5 12c-8 4-3 8 0 5 1-1 1-3 0-5Z" /></svg>;
    case "handyman":
      return <svg {...common}><path d="m14 7 3-3a4 4 0 0 1 4 4l-3 3-4-4ZM3 21l9-9M5 5l14 14M4 4l4 4M16 16l4 4" /><path d="m3 7 4-4M17 21l4-4" /></svg>;
    case "painting":
      return <svg {...common}><path d="M4 4h16v7H4zM8 11v10M8 17h8" /><path d="M7 4V2h10v2" /></svg>;
    case "wrench":
      return <svg {...common}><path d="M14 6a5 5 0 0 0 6 6l-9 9a2.1 2.1 0 0 1-3-3l9-9a5 5 0 0 1-6-6l3 3 3-3z" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
    case "coins":
      return <svg {...common}><ellipse cx="9" cy="6" rx="6" ry="3" /><path d="M3 6v4c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4M3 10v4c0 1.7 2.7 3 6 3M15 10c0-1.7 1.3-3 3-3s3 1.3 3 3v8c0 1.7-1.3 3-3 3s-3-1.3-3-3z" /><path d="M15 10c0 1.7 1.3 3 3 3s3-1.3 3-3" /></svg>;
    case "people":
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "layers":
      return <svg {...common}><path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg>;
  }
}

export function CustomerHomePage({
  results,
  savedIds,
  showSave,
  locale,
}: {
  results: DirectoryProData[];
  savedIds: string[];
  showSave: boolean;
  locale: Locale;
}) {
  const tr = (path: string) => t(locale, path as never);
  const [service, setService] = useState("");
  const [location, setLocation] = useState(DEFAULT_CITY);
  const [rating, setRating] = useState("any");

  return (
    <main className="ej-home">
      <PublicHomeHeader locale={locale} active="find" />

      <section className="ej-home-hero" aria-labelledby="ej-home-title">
        <div className="ej-home-hero-photo" aria-hidden="true">
          <Image
            src="/images/everyjob-customer-home-hero.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 760px) 100vw, 58vw"
          />
        </div>
        <div className="ej-home-hero-content">
          <h1 id="ej-home-title">{tr('customer.publicHome.heroLine1')}<br />{tr('customer.publicHome.heroLine2')}</h1>
          <p className="ej-home-hero-copy">
            {tr('customer.publicHome.heroSub1')}<br className="desktop-break" />
            {tr('customer.publicHome.heroSub2')}
          </p>

          <form className="ej-home-search" action="/directory" method="get">
            <label className="ej-home-search-service">
              <Icon name="wrench" size={19} />
              <input
                name="q"
                aria-label={tr('customer.publicHome.searchServiceLabel')}
                value={service}
                onChange={(event) => setService(event.target.value)}
                placeholder={tr('customer.publicHome.searchServicePlaceholder')}
                maxLength={100}
              />
            </label>
            <span className="ej-home-search-divider" />
            <label className="ej-home-search-location">
              <Icon name="pin" size={19} />
              <input
                name="city"
                aria-label={tr('customer.publicHome.searchLocationLabel')}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={100}
              />
            </label>
            {rating !== "any" && (
              <input type="hidden" name="minRating" value={rating} />
            )}
            <button type="submit" className="ej-home-search-button">
              <Icon name="search" size={19} />
              <span>{tr('customer.publicHome.searchButton')}</span>
            </button>
          </form>

          <div className="ej-home-rating-filter" aria-label={tr('customer.publicHome.minRating')}>
            <span>{tr('customer.publicHome.minRating')}</span>
            <button type="button" className={rating === "any" ? "selected" : ""} onClick={() => setRating("any")}>
              {rating === "any" ? "✓ " : ""}{tr('customer.publicHome.ratingAny')}
            </button>
            <button type="button" className={rating === "4" ? "selected" : ""} onClick={() => setRating("4")}>{tr('customer.publicHome.rating4')}</button>
            <button type="button" className={rating === "4.5" ? "selected" : ""} onClick={() => setRating("4.5")}>{tr('customer.publicHome.rating45')}</button>
          </div>
        </div>
      </section>

      <section className="ej-home-services" aria-labelledby="ej-home-services-title">
        <div className="ej-home-section-heading">
          <h2 id="ej-home-services-title">{tr('customer.publicHome.servicesTitle')}</h2>
          <Link href="/directory">{tr('customer.publicHome.viewAllServices')} <span aria-hidden="true">→</span></Link>
        </div>
        <div className="ej-home-service-grid">
          {services.map((item) => (
            <Link href={item.href} className="ej-home-service-card" key={item.name}>
              <span className="ej-home-service-icon"><Icon name={item.icon} size={25} /></span>
              <span className="ej-home-service-copy">
                <strong>{tr(`customer.categories.${item.name}`)}</strong>
                {item.name === "HVAC" ? <small>{tr('customer.publicHome.serviceHvacDetail')}</small> : null}
              </span>
              <span className="ej-home-service-chevron"><Icon name="chevron" size={15} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ej-home-results" aria-labelledby="ej-home-results-title">
        <div className="ej-home-results-heading">
          <h2 id="ej-home-results-title"><Icon name="pin" size={23} /> <span>{tr('customer.publicHome.prosIn')} <strong>{DEFAULT_CITY}</strong></span></h2>
          <Link href="/directory?city=Etobicoke%2C%20Toronto" className="ej-home-change-location">
            <Icon name="pin" size={15} /> {tr('customer.publicHome.changeLocation')}
          </Link>
        </div>

        {results.length === 0 ? (
          <div className="ej-home-empty">
            <div className="ej-home-empty-art">
              <Image
                src="/images/everyjob-customer-home-empty-state.jpg"
                alt=""
                fill
                sizes="(max-width: 760px) 100vw, 30vw"
              />
            </div>
            <div className="ej-home-empty-content">
              <h3>{tr('customer.publicHome.emptyTitle')}</h3>
              <p>{tr('customer.publicHome.emptyText').replace('{city}', DEFAULT_CITY)}</p>
              <div className="ej-home-empty-actions">
                <Link href="/directory?city=Toronto" className="ej-home-broaden">
                  <Icon name="search" size={19} /> {tr('customer.publicHome.broadenSearch')}
                </Link>
                <Link href="/register" className="ej-home-invite">
                  <Icon name="plus" size={20} /> {tr('customer.publicHome.invitePro')}
                </Link>
              </div>
              <div className="ej-home-empty-tips">
                <div><Icon name="pin" size={22} /><span>{tr('customer.publicHome.tipNearby')}</span></div>
                <div><Icon name="layers" size={22} /><span>{tr('customer.publicHome.tipGeneral')}</span></div>
                <div><Icon name="bell" size={22} /><span>{tr('customer.publicHome.tipFirst')}</span></div>
              </div>
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {results.map((pro) => (
              <li key={pro.id}>
                <DirectoryProCard
                  pro={pro}
                  saved={savedIds.includes(pro.id)}
                  showSave={showSave}
                  locale={locale}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ej-home-trust" aria-label="Why EveryJob">
        <div className="ej-home-trust-item">
          <Icon name="shield" size={31} />
          <span><strong>{tr('customer.publicHome.trustFreeTitle')}</strong><small>{tr('customer.publicHome.trustFreeText')}</small></span>
        </div>
        <div className="ej-home-trust-item">
          <Icon name="coins" size={31} />
          <span><strong>{tr('customer.publicHome.trustNoCommissionTitle')}</strong><small>{tr('customer.publicHome.trustNoCommissionText')}</small></span>
        </div>
        <div className="ej-home-trust-item">
          <Icon name="people" size={31} />
          <span><strong>{tr('customer.publicHome.trustDirectTitle')}</strong><small>{tr('customer.publicHome.trustDirectText')}</small></span>
        </div>
      </section>
    </main>
  );
}
