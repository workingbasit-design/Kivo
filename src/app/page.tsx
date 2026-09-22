import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  Check,
  FileText,
  IndianRupee,
  MapPin,
  MessageCircle,
  PieChart,
  ReceiptText,
  Sparkles,
  Tag,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kivo — Every job. One place.',
  description:
    'Kivo is a free field-service platform for Indian service businesses: jobs, schedule, customers, GST quotes, invoices, UPI-ready payments, WhatsApp sharing and a Hinglish AI assistant — all in one place.',
};

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Directory', href: '/directory' },
  { label: 'Free', href: '#free' },
];

const TRADES = [
  'Plumbers',
  'Electricians',
  'AC repair',
  'Salons',
  'Pest control',
  'Carpenters',
  'Painters',
  'Appliance repair',
];

const FEATURES = [
  {
    icon: Briefcase,
    title: 'Jobs',
    desc: 'Create, assign and track every job from the first call to done.',
  },
  {
    icon: Calendar,
    title: 'Smart Schedule',
    desc: 'See the day at a glance — book a job in under 20 seconds.',
  },
  {
    icon: Users,
    title: 'Customers',
    desc: 'Every customer, their jobs, quotes and payments in one profile.',
  },
  {
    icon: ReceiptText,
    title: 'GST Quotes',
    desc: 'Professional quotes with GST that customers approve in one tap.',
  },
  {
    icon: FileText,
    title: 'Invoices',
    desc: 'GST invoices with clear paid, partial and unpaid tracking.',
  },
  {
    icon: Wallet,
    title: 'UPI-ready payments',
    desc: 'Show your UPI ID on invoices and record UPI, cash or bank payments.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp sharing',
    desc: 'Share quotes and invoices on WhatsApp with one tap. You send — nothing auto-sends.',
  },
  {
    icon: Sparkles,
    title: 'AI Copilot',
    desc: 'Book jobs in Hinglish or English. It always confirms before creating anything.',
  },
  {
    icon: Bell,
    title: 'Reminders',
    desc: 'Payment and appointment reminder drafts — you review, then send.',
  },
  {
    icon: PieChart,
    title: 'Reports',
    desc: 'Revenue, jobs and customer reports that show what is working.',
  },
  {
    icon: Tag,
    title: 'Price book',
    desc: 'Your services and rates, ready to drop into any quote or job.',
  },
  {
    icon: UserCog,
    title: 'Team',
    desc: 'Add technicians, assign jobs and track timesheets.',
  },
];

const INDIA_FIRST = [
  {
    icon: ReceiptText,
    title: 'GST-ready paperwork',
    desc: 'Quotes and invoices with GST calculated the way Indian businesses expect.',
  },
  {
    icon: IndianRupee,
    title: 'INR, paise-accurate',
    desc: 'Rupees everywhere it matters, with CAD and provincial taxes for Canada.',
  },
  {
    icon: Wallet,
    title: 'UPI on every invoice',
    desc: 'Put your UPI ID on invoices so customers can pay you directly. Kivo never touches your money.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp-native',
    desc: 'Share quotes, invoices and updates on the app India already uses.',
  },
  {
    icon: Sparkles,
    title: 'Hinglish AI',
    desc: 'Type the way you talk — “kal AC service book karo” just works.',
  },
  {
    icon: MapPin,
    title: 'Get discovered',
    desc: 'List your business on the Kivo Directory so nearby customers can find you.',
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
    desc: 'Pick a customer, a service and a time — or let the AI copilot do it from one Hinglish message.',
  },
  {
    n: '3',
    icon: MessageCircle,
    title: 'Invoice on WhatsApp, get paid on UPI',
    desc: 'Send a GST invoice straight to WhatsApp. Add your UPI ID and record the payment when it lands.',
  },
];

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="w-8 h-8 bg-[#6329d4] rounded-lg flex items-center justify-center shadow-sm">
        <Sparkles className="text-white w-5 h-5" />
      </span>
      <span className="text-xl font-bold tracking-tight text-zinc-900">Kivo</span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-focus min-h-screen bg-white text-zinc-900 font-sans">
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-zinc-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" aria-label="Kivo home">
              <Logo />
            </Link>
            <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition px-3 py-2"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-[#6329d4] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#5221b3] transition active:scale-95 shadow-sm"
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-[#6329d4]/[0.07] via-transparent to-transparent"
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="text-center lg:text-left">
                <p className="inline-flex items-center gap-2 bg-[#6329d4]/10 text-[#6329d4] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  <Sparkles size={14} /> Free forever · No credit card
                </p>
                <h1 className="text-5xl md:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
                  Every job.
                  <br />
                  <span className="text-[#6329d4]">One place.</span>
                </h1>
                <p className="text-lg md:text-xl text-zinc-600 mb-4 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Kivo is the free field-service app for Indian service businesses —
                  plumbers, electricians, AC repair, salons and more. Jobs, schedule,
                  GST quotes, invoices and a Hinglish AI assistant, all in one place.
                </p>
                <p className="text-sm font-medium text-zinc-500 mb-8">
                  Kaam ki har cheez, ek jagah.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 bg-[#6329d4] text-white px-7 py-3.5 rounded-full text-base font-semibold hover:bg-[#5221b3] transition active:scale-95 shadow-md"
                  >
                    Start free <ArrowRight size={18} />
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="inline-flex items-center justify-center gap-2 bg-white text-zinc-800 px-7 py-3.5 rounded-full text-base font-semibold border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition active:scale-95"
                  >
                    See how it works
                  </Link>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  Free forever · No credit card · Made for India
                </p>
              </div>

              {/* Product mock */}
              <div className="relative mx-auto w-full max-w-sm" aria-label="Preview of the Kivo app">
                <div className="rounded-[2rem] border border-zinc-200 bg-white shadow-2xl shadow-[#6329d4]/10 overflow-hidden">
                  <div className="bg-[#17122b] px-5 py-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#6329d4] rounded-md flex items-center justify-center">
                      <Sparkles className="text-white w-4 h-4" />
                    </span>
                    <span className="text-white text-sm font-bold">Today&apos;s schedule</span>
                    <span className="ml-auto text-[10px] font-semibold text-white/60 uppercase tracking-widest">
                      Tue 22 Sep
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { name: 'Sharma Ji', job: 'AC service', time: '10:00 AM', amt: '₹1,200', tone: 'bg-emerald-100 text-emerald-700', status: 'Confirmed' },
                      { name: 'Priya S.', job: 'Plumbing repair', time: '1:30 PM', amt: '₹850', tone: 'bg-amber-100 text-amber-700', status: 'On the way' },
                      { name: 'Amit K.', job: 'Ceiling fan install', time: '4:00 PM', amt: '₹600', tone: 'bg-sky-100 text-sky-700', status: 'Scheduled' },
                    ].map((j) => (
                      <div key={j.name} className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-100 bg-zinc-50/60">
                        <div className="w-10 h-10 rounded-xl bg-[#6329d4]/10 text-[#6329d4] flex items-center justify-center text-sm font-bold shrink-0">
                          {j.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{j.name} · {j.job}</p>
                          <p className="text-xs text-zinc-500">{j.time} · {j.amt}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${j.tone}`}>
                          {j.status}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#6329d4] text-white">
                      <MessageCircle size={18} className="shrink-0" />
                      <p className="text-xs font-medium leading-relaxed">
                        Invoice INV-0001 shared on WhatsApp — paid via UPI
                      </p>
                      <Check size={16} className="ml-auto shrink-0" />
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-5 -left-4 sm:-left-8 bg-white rounded-2xl border border-zinc-200 shadow-xl px-4 py-3 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <IndianRupee size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-zinc-900">₹2,714 collected</p>
                    <p className="text-[11px] text-zinc-500">today · UPI + cash</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trades strip */}
        <section className="border-y border-zinc-100 bg-zinc-50/60 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6">
              Built for service pros across India &amp; Canada
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {TRADES.map((t) => (
                <span
                  key={t}
                  className="px-4 py-2 rounded-full bg-white border border-zinc-200 text-sm font-medium text-zinc-600 shadow-sm"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 md:py-28 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Everything a service business needs
              </h2>
              <p className="text-lg text-zinc-600">
                Twelve modules, one login. No add-ons, no locked features — it all just works.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="bg-white rounded-3xl border border-zinc-200/70 p-6 hover:border-[#6329d4]/40 hover:shadow-lg hover:shadow-[#6329d4]/5 transition group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#6329d4]/10 text-[#6329d4] flex items-center justify-center mb-4 group-hover:bg-[#6329d4] group-hover:text-white transition">
                    <f.icon size={22} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Copilot */}
        <section id="copilot" className="py-20 md:py-28 bg-[#14101f] text-white scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Chat mock */}
              <div className="order-2 lg:order-1">
                <div className="bg-white/[0.06] backdrop-blur rounded-[2rem] border border-white/10 p-6 md:p-8 shadow-2xl">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="w-8 h-8 rounded-full bg-[#6329d4] flex items-center justify-center">
                      <Sparkles size={16} className="text-white" />
                    </span>
                    <span className="font-bold text-sm">Kivo Copilot</span>
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-white/40">
                      Hinglish · English
                    </span>
                  </div>
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-end">
                      <p className="bg-[#6329d4] text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]">
                        Sharma ji ke liye kal AC service book karo
                      </p>
                    </div>
                    <div className="flex">
                      <p className="bg-white/10 text-zinc-100 px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[85%]">
                        Mil gaya — <span className="font-semibold text-white">Sharma Ji · 98765 43210</span>.
                        Kal (23 Sep) AC service, subah 10 baje. Estimated ₹1,200. Confirm kar du?
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <p className="bg-[#6329d4] text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]">
                        Haan, confirm
                      </p>
                    </div>
                    <div className="flex">
                      <div className="bg-emerald-500/15 border border-emerald-400/30 px-4 py-3 rounded-2xl rounded-bl-md max-w-[85%]">
                        <p className="text-emerald-300 font-semibold flex items-center gap-2 mb-1">
                          <Check size={15} /> Job created
                        </p>
                        <p className="text-zinc-300 text-[13px]">
                          AC service · Sharma Ji · Kal 10:00 AM · ₹1,200
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 bg-white/5 border border-white/10 rounded-full px-5 py-3 flex items-center gap-3">
                    <span className="text-[#a78bfa] text-sm font-medium">Kivo AI</span>
                    <span className="w-px h-4 bg-white/15" />
                    <span className="text-white/35 text-sm">Type in Hinglish or English…</span>
                  </div>
                </div>
              </div>
              {/* Copy */}
              <div className="order-1 lg:order-2">
                <p className="text-xs font-bold tracking-widest text-[#a78bfa] uppercase mb-4">
                  AI Copilot
                </p>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                  Book jobs the way you talk
                </h2>
                <p className="text-lg text-white/60 mb-6 leading-relaxed">
                  Tell the copilot what you need — in Hinglish or English — and it drafts
                  the job, quote or reminder for you.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Understands dates, prices, names and time-of-day in Hinglish',
                    'Warns you if a customer does not exist yet',
                    'Always asks for confirmation — nothing is created or sent without your OK',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-white/80 text-[15px]">
                      <span className="w-5 h-5 rounded-full bg-[#6329d4] flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} className="text-white" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 text-[#a78bfa] font-semibold hover:text-white transition"
                >
                  Try the copilot free <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 md:py-28 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                From first call to paid, in three steps
              </h2>
              <p className="text-lg text-zinc-600">
                No training needed. If you can use WhatsApp, you can use Kivo.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {STEPS.map((s) => (
                <div key={s.n} className="relative bg-zinc-50 rounded-3xl border border-zinc-200/70 p-8">
                  <span className="absolute top-6 right-7 text-6xl font-bold text-[#6329d4]/10 select-none">
                    {s.n}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-[#6329d4] text-white flex items-center justify-center mb-5 shadow-md shadow-[#6329d4]/25">
                    <s.icon size={24} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-[#6329d4] text-white px-7 py-3.5 rounded-full text-base font-semibold hover:bg-[#5221b3] transition active:scale-95 shadow-md"
              >
                Start your first job <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* India-first */}
        <section id="india" className="py-20 md:py-28 bg-zinc-50 border-y border-zinc-100 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-xs font-bold tracking-widest text-[#6329d4] uppercase mb-4">
                India-first
              </p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Built for how India does business
              </h2>
              <p className="text-lg text-zinc-600">
                Not a Western tool with an India sticker — the money, tax and messaging
                habits are built in from day one.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {INDIA_FIRST.map((f) => (
                <div key={f.title} className="bg-white rounded-3xl border border-zinc-200/70 p-6">
                  <div className="w-11 h-11 rounded-2xl bg-[#6329d4]/10 text-[#6329d4] flex items-center justify-center mb-4">
                    <f.icon size={22} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free forever */}
        <section id="free" className="py-20 md:py-28 scroll-mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-gradient-to-br from-[#6329d4] to-[#3b1f96] rounded-[2.5rem] p-10 md:p-16 text-white shadow-2xl shadow-[#6329d4]/25 relative overflow-hidden">
              <div
                aria-hidden
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1.5px, transparent 1.5px)',
                  backgroundSize: '22px 22px',
                }}
              />
              <div className="relative">
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
                  V1 is free. Actually free.
                </h2>
                <p className="text-lg text-white/75 mb-8 max-w-xl mx-auto leading-relaxed">
                  No billing, no commissions, no locked features, no credit card.
                  Every module works for every business — there is no paid plan to upgrade to.
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-white text-[#6329d4] px-8 py-4 rounded-full text-base font-bold hover:bg-zinc-100 transition active:scale-95 shadow-lg"
                >
                  Create your free account <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Directory teaser */}
        <section id="directory" className="pb-20 md:pb-28 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center bg-zinc-50 rounded-[2.5rem] border border-zinc-200/70 p-8 md:p-14">
              <div>
                <p className="text-xs font-bold tracking-widest text-[#6329d4] uppercase mb-4">
                  Kivo Directory
                </p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Customers can find you, too
                </h2>
                <p className="text-zinc-600 mb-8 leading-relaxed">
                  List your business on the public Kivo Directory. Customers search by
                  service and city — their requests land in your inbox as lead drafts.
                  Listing is free, like everything else.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/directory"
                    className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-zinc-800 transition active:scale-95"
                  >
                    Explore the directory <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 bg-white text-zinc-800 px-6 py-3 rounded-full text-sm font-semibold border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition active:scale-95"
                  >
                    List your business — free
                  </Link>
                </div>
              </div>
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                  How customers find you
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <MapPin size={18} className="text-[#6329d4] shrink-0" />
                    <p className="text-zinc-700">
                      Customer searches <span className="font-semibold text-zinc-900">“AC repair in Pune”</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <Users size={18} className="text-[#6329d4] shrink-0" />
                    <p className="text-zinc-700">
                      They find <span className="font-semibold text-zinc-900">your business</span> and request a quote
                    </p>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#6329d4]/5 border border-[#6329d4]/20">
                    <Bell size={18} className="text-[#6329d4] shrink-0" />
                    <p className="text-zinc-700">
                      It arrives in your Kivo inbox as a <span className="font-semibold text-zinc-900">lead draft</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
              <Link href="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition">
                Login
              </Link>
              <Link href="/register" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition">
                Create free account
              </Link>
              <Link href="/directory" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition">
                Kivo Directory
              </Link>
            </nav>
          </div>
          <div className="mt-8 pt-8 border-t border-zinc-100 text-center">
            <p className="text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} Kivo. Every job. One place.
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Free forever. Made for India &amp; Canada.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
