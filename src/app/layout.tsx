import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kivo - Modern Field Service Platform",
  description: "The ultimate platform for field service professionals to manage their operations efficiently.",
  openGraph: {
    title: "Kivo - Modern Field Service Platform",
    description: "The ultimate platform for field service professionals to manage their operations efficiently.",
    url: "https://kivo.com",
    siteName: "Kivo",
    images: [
      {
        url: "https://kivo.com/og-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kivo - Modern Field Service Platform",
    description: "The ultimate platform for field service professionals to manage their operations efficiently.",
    images: ["https://kivo.com/og-image.jpg"],
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
              "@type": "LocalBusiness",
              name: "Kivo",
              image: "https://kivo.com/logo.png",
              description: "The ultimate platform for field service professionals.",
              address: {
                "@type": "PostalAddress",
                streetAddress: "123 Kivo Street",
                addressLocality: "San Francisco",
                addressRegion: "CA",
                postalCode: "94107",
                addressCountry: "US",
              },
              telephone: "+1-555-555-5555",
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
