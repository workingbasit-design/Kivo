import type { Metadata } from 'next';
import Link from 'next/link';
import KivoLogo from '@/components/KivoLogo';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  CalendarClock,
  Check,
  FileText,
  Globe2,
  Languages,
  MapPin,
  PieChart,
  ReceiptText,
  Search,
  Share2,
  Sparkles,
  Tag,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kivo — Every job. One place.',
  description:
    'Kivo is a free field-service platform for service businesses: jobs, schedule, customers, quotes, invoices, payments, reminders and an AI assistant — all in one place. Free forever.',
};

const APPLE_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Segoe UI', sans-serif";

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'AI Copilot', href: '#copilot' },
  { label: 'Directory', href: '/directory' },
];

const TRADES = [
  'Plumbers',
  'Electricians',
  'AC & heating',
  'Salons',
  'Pest control',
  'Carpenters',
  'Painters',
  'Appliance repair',
];

/** The 12 modules — icon + name grid, Apple-style hairline dividers. */
const FEATURE_GRID = [
  { icon: Sparkles, label: 'AI Copilot' },
  { icon: CalendarClock, label: 'Schedule' },
  { icon: Briefcase, label: 'Jobs' },
  { icon: Users, label: 'Customers' },
  { icon: ReceiptText, label: 'Quotes' },
  { icon: FileText, label: 'Invoices' },
  { icon: Wallet, label: 'Payments' },
  { icon: Share2, label: 'Sharing' },
  { icon: Tag, label: 'Price Book' },
  { icon: Bell, label: 'Reminders' },
  { icon: PieChart, label: 'Reports' },
  { icon: UserCog, label: 'Team' },
];

/** Honest stats only — every number here is verifiably true. */
const STATS = [
  { value: 'Free', label: 'Cost', desc: 'Free forever. No credit card, no commissions, no locked features.' },
  { value: '12', label: 'Modules', desc: 'Jobs to reports — every module works for every business.' },
  { value: '2', label: 'Countries', desc: 'Local taxes, currencies and languages for India and Canada.' },
  { value: '3', label: 'Languages', desc: 'English, Français and हिन्दी across the app.' },
];

/** Local where it matters — India and Canada side by side. */
const REGIONS = [
  {
    icon: MapPin,
    title: 'India',
    points: [
      'GST-ready quotes and invoices',
      'INR, paise-accurate money math',
      'UPI ID on invoices — get paid directly',
      'Share on WhatsApp in one tap',
    ],
  },
  {
    icon: MapPin,
    title: 'Canada',
    points: [
      'Province-correct taxes: GST, HST, PST, QST',
      'CAD with cents-accurate math',
      'Full French interface — Français partout',
      'Canada-specific holidays in the schedule',
    ],
  },
];

const STEPS = [
  {
    n: '1',
    icon: Users,
    title: 'Add your customers',
    desc: 'Save a customer in seconds. Their jobs, quotes and payments build up automatically.',
  },
  {
    n: '2',
    icon: Calendar,
    title: 'Schedule the job',
    desc: 'Pick a customer, a service and a time — or let the AI copilot draft it from one message.',
  },
  {
    n: '3',
    icon: FileText,
    title: 'Invoice and get paid',
    desc: 'Send a clean invoice, share it anywhere, and record the payment when it lands.',
  },
];

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <KivoLogo size={32} />
      <span className="text-[21px] font-semibold tracking-tight text-zinc-900">Kivo</span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div
      className="landing-focus min-h-screen bg-white text-zinc-900 antialiased"
      style={{ fontFamily: APPLE_FONT }}
    >
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-[68px]">
            <Link href="/" aria-label="Kivo home">
              <Logo />
            </Link>
            <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-[15px] text-zinc-600 hover:text-zinc-900 transition"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-[15px] text-zinc-600 hover:text-zinc-900 transition px-4 py-2"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-zinc-900 text-white px-5 py-2.5 rounded-full text-[15px] font-medium hover:bg-zinc-700 transition active:scale-95"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — Apple-style statement headline */}
        <section className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-500 border border-zinc-200 rounded-full px-4 py-1.5 mb-8">
              <Sparkles size={14} className="text-[#6329d4]" />
              Free forever · No credit card · India &amp; Canada
            </p>
            <h1 className="text-[44px] leading-[1.04] sm:text-6xl md:text-7xl lg:text-[84px] font-bold tracking-[-0.03em] mb-6">
              Every job.
              <br />
              <span className="text-zinc-400">One place.</span>
            </h1>
            <p className="text-lg md:text-[21px] leading-relaxed text-zinc-600 mb-10 max-w-2xl mx-auto">
              The free field-service app for independent service businesses — plumbers,
              electricians, HVAC, salons and more. Jobs, schedule, quotes, invoices
              and an AI assistant that speaks your language.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-[#6329d4] text-white px-8 py-3.5 rounded-full text-[17px] font-medium hover:bg-[#5221b3] transition active:scale-95"
              >
                Start free <ArrowRight size={18} />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 text-[#6329d4] px-8 py-3.5 rounded-full text-[17px] font-medium hover:underline underline-offset-4"
              >
                See what&apos;s inside
              </Link>
            </div>
            <p className="text-[13px] text-zinc-400">
              Book your first job in under 20 seconds.
            </p>
          </div>

          {/* Product visual — honest stylized mock of the real app */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
            <div
              className="rounded-[24px] border border-zinc-200 bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.18)] overflow-hidden"
              aria-label="Preview of the Kivo app"
            >
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-100">
                <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-[13px] text-zinc-400">Today&apos;s schedule — Kivo</span>
              </div>
              <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
                {[
                  { name: 'Sharma Residence', job: 'AC service', time: '10:00 AM', amt: '$120', status: 'Confirmed', tone: 'text-emerald-600 bg-emerald-50' },
                  { name: 'Priya S.', job: 'Plumbing repair', time: '1:30 PM', amt: '$85', status: 'On the way', tone: 'text-amber-600 bg-amber-50' },
                  { name: 'Amit K.', job: 'Fan install', time: '4:00 PM', amt: '$60', status: 'Scheduled', tone: 'text-sky-600 bg-sky-50' },
                ].map((j) => (
                  <div key={j.name} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${j.tone}`}>
                        {j.status}
                      </span>
                      <span className="text-[13px] text-zinc-400">{j.time}</span>
                    </div>
                    <p className="text-[17px] font-semibold tracking-tight">{j.name}</p>
                    <p className="text-[14px] text-zinc-500 mb-3">{j.job}</p>
                    <p className="text-[15px] font-semibold">{j.amt}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 px-5 py-4 bg-zinc-50 border-t border-zinc-100">
                <Share2 size={17} className="text-[#6329d4] shrink-0" />
                <p className="text-[13px] text-zinc-600">
                  Invoice <span className="font-semibold text-zinc-900">INV-0001</span> shared with
                  customer — payment recorded
                </p>
                <Check size={16} className="ml-auto text-emerald-600 shrink-0" />
              </div>
            </div>
          </div>
        </section>

        {/* Trades strip */}
        <section className="border-y border-zinc-100 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
              {TRADES.map((t) => (
                <span key={t} className="text-[15px] text-zinc-400 font-medium">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Feature grid — hairline dividers, Apple style */}
        <section id="features" className="py-20 md:py-28 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-4xl md:text-[56px] leading-[1.05] font-bold tracking-[-0.025em] mb-4">
                Everything runs
                <br />
                <span className="text-zinc-400">on Kivo.</span>
              </h2>
              <p className="text-lg md:text-[19px] text-zinc-600">
                Twelve modules, one login. No add-ons, no locked features — it all just works.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-zinc-200/80 border border-zinc-200/80 rounded-[28px] overflow-hidden">
              {FEATURE_GRID.map((f) => (
                <div
                  key={f.label}
                  className="bg-white p-6 md:p-7 flex flex-col items-center text-center gap-3 hover:bg-zinc-50 transition"
                >
                  <f.icon size={26} strokeWidth={1.5} className="text-zinc-800" />
                  <span className="text-[13px] font-medium text-zinc-600">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Copilot — dark section */}
        <section id="copilot" className="py-20 md:py-28 bg-zinc-950 text-white scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Chat mock */}
              <div className="order-2 lg:order-1">
                <div className="bg-white/[0.05] rounded-[24px] border border-white/10 p-6 md:p-8">
                  <div className="flex items-center gap-2.5 mb-6">
                    <span className="w-8 h-8 rounded-full bg-[#6329d4] flex items-center justify-center">
                      <Sparkles size={16} className="text-white" />
                    </span>
                    <span className="font-semibold text-[15px]">Kivo Copilot</span>
                    <span className="ml-auto text-[11px] font-medium uppercase tracking-widest text-white/40">
                      English · Français · हिन्दी
                    </span>
                  </div>
                  <div className="space-y-4 text-[14px]">
                    <div className="flex justify-end">
                      <p className="bg-[#6329d4] text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]">
                        Book an AC service for Sharma tomorrow morning
                      </p>
                    </div>
                    <div className="flex">
                      <p className="bg-white/10 text-zinc-200 px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[85%]">
                        Found <span className="font-semibold text-white">Sharma Residence</span>.
                        AC service, tomorrow 10:00 AM, about $120. Shall I confirm?
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <p className="bg-[#6329d4] text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]">
                        Yes, confirm
                      </p>
                    </div>
                    <div className="flex">
                      <div className="bg-emerald-500/10 border border-emerald-400/25 px-4 py-3 rounded-2xl rounded-bl-md max-w-[85%]">
                        <p className="text-emerald-300 font-semibold flex items-center gap-2 mb-1 text-[14px]">
                          <Check size={15} /> Job created
                        </p>
                        <p className="text-zinc-400 text-[13px]">
                          AC service · Sharma Residence · Tomorrow 10:00 AM · $120
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 bg-white/5 border border-white/10 rounded-full px-5 py-3 flex items-center gap-3">
                    <span className="text-[#a78bfa] text-[13px] font-medium">Kivo AI</span>
                    <span className="w-px h-4 bg-white/15" />
                    <span className="text-white/30 text-[14px]">Type the way you talk…</span>
                  </div>
                </div>
              </div>
              {/* Copy */}
              <div className="order-1 lg:order-2">
                <p className="text-[13px] font-semibold tracking-[0.18em] text-[#a78bfa] uppercase mb-5">
                  Kivo Copilot
                </p>
                <h2 className="text-4xl md:text-[56px] leading-[1.05] font-bold tracking-[-0.025em] mb-6">
                  AI that works where
                  <br />
                  you work.
                </h2>
                <p className="text-lg md:text-[19px] text-white/55 mb-8 leading-relaxed max-w-lg">
                  Tell the copilot what you need — in your own words and language —
                  and it drafts the job, quote or reminder for you.
                </p>
                <ul className="space-y-4 mb-10">
                  {[
                    'Understands dates, prices, names and time-of-day naturally',
                    'Warns you if a customer does not exist yet',
                    'Always asks first — nothing is created or sent without your OK',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-white/75 text-[15px]">
                      <span className="w-5 h-5 rounded-full bg-[#6329d4] flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} className="text-white" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 text-[#a78bfa] font-medium text-[17px] hover:text-white transition"
                >
                  Try the copilot free <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Honest stats — Apple rhythm, true numbers only */}
        <section className="py-20 md:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl md:text-[56px] leading-[1.05] font-bold tracking-[-0.025em] text-center mb-14">
              Run your business
              <br />
              <span className="text-zinc-400">like a machine.</span>
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8">
              {STATS.map((s) => (
                <div key={s.label} className="text-center lg:text-left">
                  <p className="text-[12px] font-semibold tracking-[0.16em] text-[#6329d4] uppercase mb-2">
                    {s.label}
                  </p>
                  <p className="text-5xl md:text-6xl font-bold tracking-[-0.03em] mb-3">{s.value}</p>
                  <p className="text-[14px] text-zinc-500 leading-relaxed max-w-[220px] mx-auto lg:mx-0">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
            <div className="text-center mt-14">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white px-8 py-3.5 rounded-full text-[17px] font-medium hover:bg-zinc-700 transition active:scale-95"
              >
                Start free <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 md:py-28 bg-zinc-50 border-y border-zinc-100 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-4xl md:text-[52px] leading-[1.05] font-bold tracking-[-0.025em] mb-4">
                From first call to paid,
                <br />
                <span className="text-zinc-400">in three steps.</span>
              </h2>
              <p className="text-lg text-zinc-600">
                No training needed. If you can send a text, you can use Kivo.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {STEPS.map((s) => (
                <div key={s.n} className="relative bg-white rounded-[24px] border border-zinc-200/80 p-8">
                  <span className="absolute top-6 right-7 text-[64px] leading-none font-bold text-zinc-100 select-none">
                    {s.n}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mb-5">
                    <s.icon size={22} strokeWidth={1.6} />
                  </div>
                  <h3 className="text-[19px] font-semibold tracking-tight text-zinc-900 mb-2">{s.title}</h3>
                  <p className="text-[15px] text-zinc-600 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Local where it matters — India + Canada */}
        <section id="regions" className="py-20 md:py-28 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-[13px] font-semibold tracking-[0.18em] text-[#6329d4] uppercase mb-5 flex items-center justify-center gap-2">
                <Globe2 size={15} /> Local where it matters
              </p>
              <h2 className="text-4xl md:text-[52px] leading-[1.05] font-bold tracking-[-0.025em] mb-4">
                One app, at home
                <br />
                <span className="text-zinc-400">in two countries.</span>
              </h2>
              <p className="text-lg text-zinc-600">
                Not a generic tool with a sticker on it — taxes, money and language
                are built in for each region from day one.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {REGIONS.map((r) => (
                <div key={r.title} className="bg-white rounded-[24px] border border-zinc-200/80 p-8 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.12)] transition">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-2xl bg-[#6329d4]/10 text-[#6329d4] flex items-center justify-center">
                      <r.icon size={22} strokeWidth={1.6} />
                    </div>
                    <h3 className="text-[22px] font-semibold tracking-tight text-zinc-900">{r.title}</h3>
                  </div>
                  <ul className="space-y-3">
                    {r.points.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-[15px] text-zinc-600">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={12} className="text-emerald-700" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-center text-[14px] text-zinc-400 mt-10 flex items-center justify-center gap-2">
              <Languages size={15} /> Switch the whole app to Français anytime, from Settings.
            </p>
          </div>
        </section>

        {/* Directory teaser */}
        <section id="directory" className="pb-20 md:pb-28 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center bg-zinc-50 rounded-[32px] border border-zinc-200/70 p-8 md:p-14">
              <div>
                <p className="text-[13px] font-semibold tracking-[0.18em] text-[#6329d4] uppercase mb-5">
                  Kivo Directory
                </p>
                <h2 className="text-3xl md:text-[40px] leading-[1.08] font-bold tracking-[-0.02em] mb-4">
                  Customers can find you, too.
                </h2>
                <p className="text-[17px] text-zinc-600 mb-8 leading-relaxed">
                  List your business on the public Kivo Directory. Customers search by
                  service and city — their requests land in your inbox as lead drafts.
                  Listing is free, like everything else.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/directory"
                    className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-full text-[15px] font-medium hover:bg-zinc-700 transition active:scale-95"
                  >
                    Explore the directory <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 text-[#6329d4] px-6 py-3 rounded-full text-[15px] font-medium hover:underline underline-offset-4"
                  >
                    List your business — free
                  </Link>
                </div>
              </div>
              <div className="bg-white rounded-[24px] border border-zinc-200 p-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-400 mb-4">
                  How customers find you
                </p>
                <div className="space-y-3 text-[14px]">
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <Search size={18} className="text-zinc-700 shrink-0" />
                    <p className="text-zinc-600">
                      Customer searches <span className="font-semibold text-zinc-900">&ldquo;Plumber in Toronto&rdquo;</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <Users size={18} className="text-zinc-700 shrink-0" />
                    <p className="text-zinc-600">
                      They find <span className="font-semibold text-zinc-900">your business</span> and request a quote
                    </p>
                  </div>
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#6329d4]/[0.06] border border-[#6329d4]/20">
                    <Bell size={18} className="text-[#6329d4] shrink-0" />
                    <p className="text-zinc-600">
                      It arrives in your Kivo inbox as a <span className="font-semibold text-zinc-900">lead draft</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-24 md:pb-32">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-4xl md:text-[52px] leading-[1.05] font-bold tracking-[-0.025em] mb-6">
              Every job.
              <br />
              <span className="text-zinc-400">One place.</span>
            </h2>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#6329d4] text-white px-9 py-4 rounded-full text-[17px] font-medium hover:bg-[#5221b3] transition active:scale-95"
            >
              Start free <ArrowRight size={18} />
            </Link>
            <p className="text-[13px] text-zinc-400 mt-5">Free forever · No credit card</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Link href="/" aria-label="Kivo home">
              <Logo />
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3" aria-label="Footer">
              <Link href="/login" className="text-[14px] text-zinc-500 hover:text-zinc-900 transition">
                Login
              </Link>
              <Link href="/register" className="text-[14px] text-zinc-500 hover:text-zinc-900 transition">
                Create free account
              </Link>
              <Link href="/directory" className="text-[14px] text-zinc-500 hover:text-zinc-900 transition">
                Kivo Directory
              </Link>
            </nav>
          </div>
          <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
            <p className="text-[14px] text-zinc-500">
              &copy; {new Date().getFullYear()} Kivo. Every job. One place.
            </p>
            <p className="text-[13px] text-zinc-400 mt-1">
              Free forever. Made for India &amp; Canada.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
