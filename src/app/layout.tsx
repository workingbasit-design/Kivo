import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import PwaRegister from "@/components/PwaRegister";
import { getLocale } from "@/lib/i18n/server";
import { getCspNonce } from "@/lib/csp-nonce";
import "./globals.css";

/* Part B (dashboard rebuild): Barlow for interface text, Barlow Condensed
   for numbers and big figures. Self-hosted woff2 (SIL Open Font License -
   see docs/LICENSES.md), font-display swap, latin subsets only. */
const barlow = localFont({
  variable: "--font-barlow",
  display: "swap",
  src: [
    { path: "../../public/fonts/barlow-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/barlow-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/barlow-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/barlow-700.woff2", weight: "700", style: "normal" },
  ],
});

const barlowCondensed = localFont({
  variable: "--font-barlow-condensed",
  display: "swap",
  src: [
    { path: "../../public/fonts/barlowcondensed-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/barlowcondensed-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/barlowcondensed-700.woff2", weight: "700", style: "normal" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Pre-paint theme init: reads the saved appearance (localStorage ej-theme,
   default follows the OS) and toggles .dark on <html> before first paint so
   there is no light/dark flash. Runs before React hydrates. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('ej-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

const SITE_URL = "https://kivo-nine-silk.vercel.app";
const SITE_TITLE = "EveryJob - Every job. One place.";
const SITE_DESCRIPTION =
  "EveryJob is free field-service software for Canadian home-service businesses: jobs, schedule, customers, quotes, invoices, payment records and a bilingual English-French AI assistant - all in one place. No credit card required.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    'free field service management software Canada',
    'free job scheduling app Canada',
    'home service business software',
    'contractor scheduling software',
    'small business job management app',
    'free invoicing software Canada',
    'plumber scheduling software',
    'HVAC business software',
    'cleaning business software',
    'bilingual business app Canada English French',
  ],
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "EveryJob",
    locale: "en_CA",
    alternateLocale: ["fr_CA"],
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og/og-home.png`,
        width: 1200,
        height: 630,
        alt: "EveryJob - Every job. One place.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og/og-home.png`],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Document language follows the app locale (kivo-locale cookie).
  // Native date/time inputs (<input type="time|date|datetime-local">) render
  // per the document lang in browsers: a hardcoded lang="en" made iOS show
  // "9:00 AM" even when the whole UI was French. The locale toggle does a
  // full reload, so the server-rendered lang stays in sync.
  const locale = await getLocale();
  const nonce = await getCspNonce();
  return (
    <html
      lang={locale === 'fr' ? 'fr-CA' : 'en-CA'}
      className={`${barlow.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "EveryJob",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: SITE_DESCRIPTION,
              url: SITE_URL,
              inLanguage: ["en-CA", "fr-CA"],
              areaServed: "CA",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "CAD",
              },
              publisher: {
                "@type": "Organization",
                name: "EveryJob",
                url: SITE_URL,
              },
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-surface focus:text-ink focus:px-4 focus:py-2 focus:rounded-lg"
        >
          Skip to content
        </a>
        {children}
        <PwaRegister />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
