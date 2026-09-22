import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, LayoutDashboard, Search, Users, Calendar, FileText, MessageSquare, Briefcase, Settings, Zap, ArrowUpRight, BarChart3, Clock, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-indigo-100">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Sparkles className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-zinc-900">Kivo Pro</span>
            </div>
            <div className="flex items-center space-x-6">
              <span className="text-sm text-zinc-500 hidden md:inline-block">Sign up for Kivo AI™</span>
              <Link href="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition">Login</Link>
              <Link href="/register" className="bg-zinc-900 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-zinc-800 transition active:scale-95 shadow-sm">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24">
        
        {/* Section 1: The Context Hero */}
        <section className="pt-24 pb-32 text-center px-4 max-w-5xl mx-auto">
          <h1 className="text-6xl md:text-[5rem] leading-[1.1] font-bold tracking-tight mb-6 text-zinc-900">
            60% of human work <br className="hidden md:block"/>
            is lost in <span className="text-zinc-400">context</span>
          </h1>
          <p className="text-xl text-zinc-500 mb-16 max-w-2xl mx-auto font-medium">
            Work Sprawl is killing context - and destroying field service profitability.
          </p>

          {/* Knot Graphic Mock */}
          <div className="relative w-full max-w-4xl mx-auto h-48 md:h-64 mb-12 flex items-center justify-center">
            {/* The SVG Line (mocking the knot) */}
            <svg className="absolute inset-0 w-full h-full text-zinc-200" preserveAspectRatio="none" viewBox="0 0 1000 200">
              <path d="M 0,100 C 300,100 400,20 500,100 C 600,180 700,100 1000,100" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
            </svg>
            
            {/* Nodes */}
            <div className="absolute left-1/4 top-1/3 bg-white p-2 rounded-xl shadow-lg border border-zinc-100 hover:scale-110 transition cursor-pointer">
              <MessageSquare className="w-6 h-6 text-green-500" />
            </div>
            <div className="absolute left-1/3 bottom-1/4 bg-white p-2 rounded-xl shadow-lg border border-zinc-100 hover:scale-110 transition cursor-pointer">
              <Calendar className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="absolute right-1/3 top-1/4 bg-white p-2 rounded-xl shadow-lg border border-zinc-100 hover:scale-110 transition cursor-pointer">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            
            {/* Text Tooltips */}
            <div className="absolute right-1/4 bottom-1/3 bg-white px-3 py-1.5 rounded-full shadow-sm border border-zinc-200 text-xs font-medium text-zinc-600">
              Where's that invoice?
            </div>
          </div>

          <Link href="/register" className="inline-flex items-center gap-2 bg-zinc-900 text-white px-6 py-3.5 rounded-full text-sm font-semibold hover:bg-zinc-800 transition active:scale-95 shadow-sm">
            Get more from Kivo <ArrowRight size={18} />
          </Link>
        </section>

        {/* Section 2: Features Bento */}
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-4">
              Converged AI platform
            </h2>
            <p className="text-lg text-zinc-500 mb-16">
              100+ features to maximize human and AI productivity in the field.
            </p>
            
            {/* Bento Grid matching the screenshot: large white container with internal borders */}
            <div className="border border-zinc-200 rounded-[2.5rem] overflow-hidden bg-white shadow-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-y md:divide-y-0 lg:divide-y-0 border-b-0 md:border-b border-zinc-200 [&>*:nth-child(n)]:border-r [&>*:nth-child(2n)]:border-r-0 md:[&>*:nth-child(2n)]:border-r lg:[&>*:nth-child(6n)]:border-r-0 border-b lg:border-b-0 [&>*:nth-child(n+7)]:border-t border-zinc-200">
                {[
                  { icon: Sparkles, label: "AI Copilot" },
                  { icon: Calendar, label: "Schedule" },
                  { icon: Search, label: "Connected Search" },
                  { icon: MessageSquare, label: "AI Answers Agent" },
                  { icon: FileText, label: "AI Notetaker" },
                  { icon: Users, label: "Customers" },
                  { icon: CheckCircle2, label: "Tasks" },
                  { icon: Briefcase, label: "Jobs" },
                  { icon: Settings, label: "Automations" },
                  { icon: LayoutDashboard, label: "Reporting" },
                  { icon: Clock, label: "Time estimates" },
                  { icon: Zap, label: "API Calls" },
                ].map((item, i) => (
                  <div key={i} className="p-8 flex flex-col items-center justify-center gap-4 hover:bg-zinc-50/50 transition cursor-pointer group aspect-[4/3] lg:aspect-square">
                    <item.icon className="w-8 h-8 text-zinc-400 group-hover:text-zinc-600 transition-colors" strokeWidth={1} />
                    <span className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-900 tracking-wide text-center">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Copilot Showcase */}
        <section className="py-24 bg-[#fafafa]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              
              {/* Mock Chat UI */}
              <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-[2rem] p-8 shadow-2xl border border-zinc-800 relative overflow-hidden h-[400px]">
                <div className="absolute top-4 left-6 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                
                <div className="mt-12 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                      <Sparkles size={16} />
                    </div>
                    <div className="bg-zinc-800 text-zinc-200 px-4 py-2 rounded-2xl rounded-tl-none text-sm">
                      How can I help you today?
                    </div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="text-indigo-400 w-4 h-4" />
                      <span className="text-zinc-300 text-xs font-medium uppercase tracking-wider">Suggested Actions</span>
                    </div>
                    <button className="w-full text-left bg-white/5 hover:bg-white/10 transition px-3 py-2 rounded-lg text-sm text-zinc-200 flex items-center justify-between mb-2">
                      Chase overdue Invoice #102 <ArrowRight size={14} className="text-zinc-500"/>
                    </button>
                    <button className="w-full text-left bg-white/5 hover:bg-white/10 transition px-3 py-2 rounded-lg text-sm text-zinc-200 flex items-center justify-between">
                      Rebalance tomorrow's schedule <ArrowRight size={14} className="text-zinc-500"/>
                    </button>
                  </div>
                </div>
                
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="bg-zinc-800 border border-zinc-700 rounded-full px-4 py-3 flex items-center gap-2">
                    <span className="text-indigo-400 text-sm font-medium">@KivoBrain</span>
                    <div className="w-[1px] h-4 bg-zinc-600"></div>
                    <span className="text-zinc-500 text-sm">Message...</span>
                  </div>
                </div>
              </div>

              {/* Copy */}
              <div>
                <h3 className="text-sm font-bold tracking-widest text-indigo-600 uppercase mb-4">Kivo Brain</h3>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-6">
                  AI that works where you work
                </h2>
                <p className="text-lg text-zinc-600 mb-8">
                  Get AI with full context of your field service business embedded straight into your workflows with Smart Follow-ups, Predictive Capacity Planning, and so much more.
                </p>
                <Link href="/register" className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-700 transition">
                  Upgrade now <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Agent Cards */}
        <section className="py-24 bg-white border-t border-zinc-100">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight text-zinc-900 mb-4">AI solutions for every team</h2>
              <p className="text-lg text-zinc-500">Your key workflows, powered by Kivo Agents.</p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { title: "Deliver jobs on time, every time", desc: "Get your technicians running smoothly with predictive routing.", btn: "Try Dispatch Agent", image: "/agents/dispatch-v2.jpg" },
                { title: "Maximize revenue recovery", desc: "Automate invoice chasing and payment links via WhatsApp/SMS.", btn: "Try Finance Agent", image: "/agents/finance-v2.jpg" },
                { title: "Ship faster quotes", desc: "Generate multi-option estimates instantly based on past data.", btn: "Try Sales Agent", image: "/agents/sales-v2.jpg" },
                { title: "Create systems for scale", desc: "Unify your entire operational protocol in a single workspace.", btn: "Try Operations Agent", image: "/agents/operations-v2.jpg" },
              ].map((agent, i) => (
                <div key={i} className="bg-[#fafafa] rounded-[2rem] p-6 border border-zinc-100 flex flex-col h-full hover:shadow-xl transition-shadow duration-300">
                  <div className={`w-full aspect-square rounded-[1.5rem] mb-6 flex items-center justify-center overflow-hidden relative bg-zinc-200`}>
                     <Image src={agent.image} alt={agent.title} fill className="object-cover" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 mb-3">{agent.title}</h3>
                  <p className="text-sm text-zinc-600 mb-8 flex-1">{agent.desc}</p>
                  <button className="w-full bg-zinc-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition active:scale-95">
                    {agent.btn}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: ROI Metrics */}
        <section className="py-32 bg-[#fafafa] border-t border-zinc-100 text-center">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 mb-20">
              Run your business like a machine.
            </h2>
            
            <div className="grid md:grid-cols-4 gap-12 text-left">
              <div>
                <div className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-2">Time Saved</div>
                <div className="text-5xl font-bold text-zinc-900 mb-4">15h+</div>
                <p className="text-sm text-zinc-500">Average hours saved per week by automating scheduling and invoicing.</p>
              </div>
              <div>
                <div className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-2">Faster Payments</div>
                <div className="text-5xl font-bold text-zinc-900 mb-4">3x</div>
                <p className="text-sm text-zinc-500">Get paid three times faster with integrated payment links and auto-reminders.</p>
              </div>
              <div>
                <div className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-2">Missed Jobs</div>
                <div className="text-5xl font-bold text-zinc-900 mb-4">0%</div>
                <p className="text-sm text-zinc-500">Eliminate no-shows and scheduling conflicts with the AI Dispatch Agent.</p>
              </div>
              <div>
                <div className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-2">Efficiency</div>
                <div className="text-5xl font-bold text-zinc-900 mb-4">100%</div>
                <p className="text-sm text-zinc-500">Completely paperless operations from the first quote to the final signature.</p>
              </div>
            </div>
            
            <div className="mt-20">
              <Link href="/register" className="inline-flex items-center gap-2 bg-zinc-900 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-zinc-800 transition active:scale-95 shadow-md">
                Go beyond free <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-zinc-200 py-12 text-center text-zinc-500">
        <p>&copy; {new Date().getFullYear()} Kivo Pro. Every job. One place.</p>
      </footer>
    </div>
  );
}
