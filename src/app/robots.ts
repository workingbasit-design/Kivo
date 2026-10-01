import { MetadataRoute } from 'next'

const SITE_URL = 'https://kivo-nine-silk.vercel.app'

// AI agents are welcome on EveryJob via the documented Agent Protocol:
// manifest at /.well-known/everyjob.json, policy at /agents. Agents must
// use the API (never scrape HTML to perform actions) and every
// consequential action requires the human's one-tap confirmation.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
