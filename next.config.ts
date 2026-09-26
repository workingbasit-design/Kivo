import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Security headers for every route. CSP is intentionally NOT set
        // globally: Next.js relies on inline scripts/styles and a strict CSP
        // would break the app; the headers below give strong baseline
        // protection without that risk.
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // SAMEORIGIN (not DENY): blocks external clickjacking while keeping
          // the door open for businesses embedding their own public booking
          // page on their own site in the future.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // geolocation=(self): the technician's "share my location" toggle
            // needs foreground GPS on our own origin. It was previously
            // geolocation=(), which silently blocked every location ping.
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
