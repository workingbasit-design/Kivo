// src/components/public/PublicHomeHeader.tsx
//
// Shared header for the public customer-facing pages (homepage,
// /how-it-works, /faq) — the exact reference build's header, one
// implementation so the three pages cannot drift apart.
//
// The "Sign In" control is a menu, not a single link: a returning pro
// clicking Sign In used to land in the customer login with no pro path
// in sight. The menu offers both, one tap away once open:
//   - Customer sign in -> /customer/login
//   - Pro sign in -> /login (business sign-in, lands on /dashboard)
// The button keeps the reference look (same outlined button, same
// position, same size) at every width, so the header layout is
// unchanged — a third visible button would overflow the 390px header.
// Menu behaviour mirrors JobsExportMenu: closes on outside tap and
// Escape, aria-haspopup / aria-expanded, role="menu" / "menuitem".
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

function HeaderIcon({
  name,
  size = 16,
}: {
  name: "home" | "people" | "wrench" | "chevronDown";
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
      return (
        <svg {...common}>
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
          <path d="M2 10 12 2l10 8" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...common}>
          <path d="M14 6a5 5 0 0 0 6 6l-9 9a2.1 2.1 0 0 1-3-3l9-9a5 5 0 0 1-6-6l3 3 3-3z" />
        </svg>
      );
    case "chevronDown":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
  }
}

export default function PublicHomeHeader({
  locale,
  active = "none",
}: {
  locale: Locale;
  /** Which nav item carries the active pill: the homepage highlights
      Find Pros, /how-it-works highlights How It Works, /faq none. */
  active?: "find" | "how" | "none";
}) {
  const tr = (path: string) => t(locale, path as never);
  const [signInOpen, setSignInOpen] = useState(false);
  const signInRef = useRef<HTMLDivElement>(null);

  // Close on outside tap / Escape (JobsExportMenu pattern).
  useEffect(() => {
    if (!signInOpen) return;
    const onDown = (e: PointerEvent) => {
      if (signInRef.current && !signInRef.current.contains(e.target as Node)) {
        setSignInOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSignInOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [signInOpen]);

  return (
    <header className="ej-home-header">
      <Link href="/" className="ej-home-brand" aria-label="EveryJob home">
        <span className="ej-home-brand-mark">
          <HeaderIcon name="home" size={21} />
        </span>
        <span>EveryJob</span>
      </Link>

      <nav className="ej-home-nav" aria-label="Main navigation">
        <Link
          className={active === "find" ? "is-active" : undefined}
          href="/directory"
        >
          {tr("customer.publicHome.navFindPros")}
        </Link>
        <Link href="/register">{tr("customer.publicHome.navForPros")}</Link>
        <Link
          className={active === "how" ? "is-active" : undefined}
          href="/how-it-works"
        >
          {tr("customer.publicHome.navHowItWorks")}
        </Link>
      </nav>

      <div className="ej-home-header-actions">
        <div className="ej-home-signin-menu" ref={signInRef}>
          <button
            type="button"
            className="ej-home-signin"
            aria-haspopup="menu"
            aria-expanded={signInOpen}
            aria-controls="ej-home-signin-menu"
            onClick={() => setSignInOpen((v) => !v)}
          >
            {tr("customer.publicHome.signIn")}
            <span
              className={`ej-home-signin-chevron${signInOpen ? " is-open" : ""}`}
              aria-hidden="true"
            >
              <HeaderIcon name="chevronDown" size={14} />
            </span>
          </button>
          {signInOpen && (
            <div
              id="ej-home-signin-menu"
              role="menu"
              className="ej-home-signin-panel"
            >
              <Link
                role="menuitem"
                href="/customer/login"
                onClick={() => setSignInOpen(false)}
              >
                <HeaderIcon name="people" size={16} />
                {tr("customer.publicHome.signInCustomer")}
              </Link>
              <Link
                role="menuitem"
                href="/login"
                onClick={() => setSignInOpen(false)}
              >
                <HeaderIcon name="wrench" size={16} />
                {tr("customer.publicHome.signInPro")}
              </Link>
            </div>
          )}
        </div>
        <Link className="ej-home-list-business" href="/register">
          {tr("customer.publicHome.listBusiness")}
        </Link>
      </div>
    </header>
  );
}
