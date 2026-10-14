import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Security headers for every route. The Content-Security-Policy is
        // set by src/middleware.ts (per-request nonce); it is intentionally
        // NOT duplicated here - two CSP headers would both be enforced and
        // the static one has no nonce.
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // B2.2 decision (2026-10-14): the middleware CSP enforces
          // `frame-ancestors 'none'` (stricter wins; the booking-page
          // embedding idea is not a live feature). X-Frame-Options
          // SAMEORIGIN stays as a legacy fallback for browsers that do
          // not support CSP frame-ancestors.
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
