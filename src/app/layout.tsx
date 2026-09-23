import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://kivo-nine-silk.vercel.app";
const SITE_TITLE = "EveryJob — Every job. One place.";
const SITE_DESCRIPTION =
  "EveryJob is free field-service software for Canadian home-service businesses: jobs, schedule, customers, quotes, invoices, payment records and a bilingual English–French AI assistant — all in one place. No credit card required.";

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
        alt: "EveryJob — Every job. One place.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
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
        {children}
        <PwaRegister />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
