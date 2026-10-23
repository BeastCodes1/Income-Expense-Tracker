import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, CircleDollarSign, ClipboardList, ShieldCheck, Sparkles, Target, TrendingUp, Wallet } from "lucide-react";

export default function HomePage() {
  return (
    <main className="landing-page min-h-screen overflow-hidden bg-[#f8f9ff] text-slate-900">
      <header className="landing-header relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Pocket Ledger home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><Wallet size={23} /></span>
          <span><span className="block text-lg font-extrabold tracking-tight">Pocket Ledger</span><span className="block text-xs font-medium text-slate-500">A clearer view of your money</span></span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5" aria-label="Main navigation">
          <Link href="/login" className="hidden text-sm font-semibold text-slate-600 transition hover:text-indigo-700 sm:inline">Log in</Link>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:px-5">Get started <ArrowRight size={16} /></Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:px-10 lg:pb-28">
        <div className="absolute -left-40 top-4 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden="true" />
        <div className="landing-hero-copy relative z-10 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-2 text-xs font-bold uppercase tracking-[.14em] text-indigo-700 shadow-sm"><Sparkles size={14} /> Money management, made calmer</div>
          <h1 className="text-5xl font-black leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-7xl">Feel good about <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent">where your money goes.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">A simple, private place to track income, understand spending, plan monthly budgets, and feel more in control—one clear decision at a time.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3.5 font-bold text-white shadow-xl shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700">Start tracking for free <ArrowRight size={18} /></Link>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">I already have an account <ArrowUpRight size={17} /></Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><Check size={16} className="text-emerald-600" /> Easy to use</span><span className="inline-flex items-center gap-2"><Check size={16} className="text-emerald-600" /> Monthly budget goals</span><span className="inline-flex items-center gap-2"><Check size={16} className="text-emerald-600" /> Your own account</span></div>
        </div>

        <div className="landing-preview relative mx-auto w-full max-w-xl lg:ml-auto">
          <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-sky-200/60 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-8 -left-8 h-48 w-48 rounded-full bg-violet-200/60 blur-3xl" aria-hidden="true" />
          <div className="relative rounded-[2rem] border border-white bg-white/90 p-4 shadow-[0_30px_100px_-30px_rgba(53,55,120,.28)] backdrop-blur sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div><p className="text-sm font-semibold text-slate-500">Your overview</p><p className="mt-1 text-2xl font-extrabold tracking-tight">A fresh start</p></div>
              <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><TrendingUp size={22} /></span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><span className="rounded-lg bg-white p-1.5"><ArrowUpRight size={15} /></span> Income</div><p className="mt-4 text-2xl font-extrabold text-slate-900">$4,250</p><p className="mt-1 text-xs text-emerald-700">Know what comes in</p></div>
              <div className="rounded-2xl bg-rose-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-rose-800"><span className="rounded-lg bg-white p-1.5"><CircleDollarSign size={15} /></span> Spending</div><p className="mt-4 text-2xl font-extrabold text-slate-900">$2,180</p><p className="mt-1 text-xs text-rose-700">See where it goes</p></div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-100 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><p className="font-bold">Monthly budget</p><p className="mt-1 text-sm text-slate-500">Everyday spending</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">On track</span></div>
              <div className="mt-5 flex items-end justify-between gap-3"><p className="text-2xl font-extrabold">$320 <span className="text-sm font-medium text-slate-400">of $500</span></p><p className="text-sm font-bold text-indigo-600">64%</p></div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[64%] rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" /></div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>$180 remaining</span><span>Spending limit</span></div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-900 p-4 text-white"><span className="rounded-xl bg-white/10 p-2.5 text-indigo-200"><Target size={20} /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold">Small steps add up</p><p className="mt-1 text-xs text-slate-300">Set a limit, track progress, stay intentional.</p></div><ArrowRight size={17} className="text-indigo-200" /></div>
            <p className="mt-4 text-center text-[11px] text-slate-400">Illustrative preview · Your dashboard uses your own saved data</p>
          </div>
          <div className="absolute -left-6 top-24 hidden items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-xl sm:flex"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><ShieldCheck size={20} /></span><span><span className="block text-sm font-bold">Your data, your account</span><span className="block text-xs text-slate-500">Private by user account</span></span></div>
        </div>
      </section>

      <section className="landing-features border-y border-slate-200/70 bg-white/70 px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-[.18em] text-indigo-600">A little more clarity</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Everything you need to build better money habits.</h2><p className="mt-4 leading-7 text-slate-600">No complicated spreadsheets. Just practical tools that help your financial picture make sense.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className="landing-feature-card rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="inline-flex rounded-2xl bg-indigo-50 p-3 text-indigo-700"><ClipboardList size={23} /></span><h3 className="mt-5 text-lg font-extrabold">Track it in one place</h3><p className="mt-2 leading-7 text-slate-600">Record income and expenses with categories, dates, notes, and a searchable monthly history.</p></article>
            <article className="landing-feature-card rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Target size={23} /></span><h3 className="mt-5 text-lg font-extrabold">Set budgets that fit</h3><p className="mt-2 leading-7 text-slate-600">Choose spending limits by category and get clear progress indicators before you go over.</p></article>
            <article className="landing-feature-card rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="inline-flex rounded-2xl bg-sky-50 p-3 text-sky-700"><TrendingUp size={23} /></span><h3 className="mt-5 text-lg font-extrabold">Plan ahead</h3><p className="mt-2 leading-7 text-slate-600">See your monthly totals and account for recurring income or bills to plan with more confidence.</p></article>
          </div>
        </div>
      </section>

      <section className="landing-cta px-5 py-16 sm:px-8 lg:px-10 lg:py-20"><div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-7 rounded-[2rem] bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-8 text-center text-white shadow-2xl shadow-indigo-200 sm:p-12 md:flex-row md:text-left"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-indigo-200">Your next chapter</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Make your money feel manageable.</h2><p className="mt-3 max-w-xl leading-7 text-indigo-100">Start with what you have today. Build a clearer picture as you go.</p></div><Link href="/signup" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 font-bold text-indigo-700 transition hover:bg-indigo-50">Create your account <ArrowRight size={17} /></Link></div></section>

      <footer className="border-t border-slate-200/70 px-5 py-7 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row"><Link href="/" className="font-bold text-slate-700">Pocket Ledger</Link><p>Personal finance, made a little simpler.</p><div className="flex gap-4"><Link href="/login" className="transition hover:text-indigo-700">Log in</Link><Link href="/signup" className="transition hover:text-indigo-700">Sign up</Link></div></div></footer>
    </main>
  );
}
