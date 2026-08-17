import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  History,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg border border-[oklch(0.8_0.11_85/45%)] bg-[oklch(0.8_0.11_85/10%)]">
        <Sparkles className="size-4 text-[oklch(0.8_0.11_85)]" />
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Mythos
      </span>
    </div>
  );
}

function MockChat() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-2xl">
      {/* glow */}
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,oklch(0.8_0.11_85/14%),transparent_70%)]" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-[oklch(0.14_0.004_285)] px-4 py-3">
          <span className="size-2.5 rounded-full bg-[oklch(0.66_0.19_25)]" />
          <span className="size-2.5 rounded-full bg-[oklch(0.7_0.13_55/80%)]" />
          <span className="size-2.5 rounded-full bg-[oklch(0.72_0.02_285)]" />
          <span className="ml-3 font-mono text-[11px] text-muted-foreground">
            mythos — new session
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[oklch(0.8_0.11_85)]">
            <Zap className="size-3" /> streaming
          </span>
        </div>
        <div className="space-y-5 px-5 py-6">
          {/* user message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5 text-sm leading-relaxed text-secondary-foreground">
              Write a Python script that renames all .txt files in a folder to
              use snake_case.
            </div>
          </div>
          {/* assistant message */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[oklch(0.8_0.11_85/35%)] bg-[oklch(0.8_0.11_85/10%)]">
              <Sparkles className="size-3.5 text-[oklch(0.8_0.11_85)]" />
            </div>
            <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed text-foreground">
              <p>
                Here you go — drop this in your folder and run{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-[oklch(0.8_0.11_85)]">
                  python rename.py
                </code>
              </p>
              <div className="overflow-hidden rounded-lg border border-border bg-[oklch(0.11_0.004_285)]">
                <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-1.5">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    rename.py
                  </span>
                  <Copy className="size-3 text-muted-foreground" />
                </div>
                <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[oklch(0.86_0.01_90)]">
{`import os, re
from pathlib import Path

for path in Path(".").glob("*.txt"):
    stem = re.sub(r"[^a-z0-9]+", "_", path.stem.lower()).strip("_")
    path.rename(path.with_name(f"{stem}.txt"))`}
                </pre>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Check className="size-3 text-[oklch(0.78_0.11_80)]" /> done in
                1.2s · gemini-2.5-flash
                <span className="mythos-caret" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: Zap,
    title: "Blazing-fast streaming",
    body: "Answers stream in as they're generated — first token in about a second, powered by Gemini Flash.",
  },
  {
    icon: Code2,
    title: "Code-first output",
    body: "Full files in copy-pasteable code blocks with syntax labels, so you can lift solutions straight into your editor.",
  },
  {
    icon: MessageSquare,
    title: "Real conversations",
    body: "Threads keep full context, so you can iterate: fix this, explain that, now make it faster.",
  },
  {
    icon: History,
    title: "Everything saved",
    body: "Every session and message persists on your own backend. Pick up exactly where you left off.",
  },
  {
    icon: ShieldCheck,
    title: "Private & yours",
    body: "It calls the model with your own free API key — your prompts stay yours, no middleman subscription.",
  },
  {
    icon: Smartphone,
    title: "Runs anywhere",
    body: "A featherweight web app that hums along on anything with a browser — even a low-end Android box running Termux.",
  },
];

const steps = [
  {
    step: "01",
    title: "Grab a free Gemini key",
    body: "Google AI Studio hands out a free API key in under a minute. No credit card, no trial clock.",
  },
  {
    step: "02",
    title: "Paste it once",
    body: "Drop the key into the app's Keys tab as GOOGLE_API_KEY. Done — it's stored server-side, never in the browser.",
  },
  {
    step: "03",
    title: "Code, free forever",
    body: "Flash models on the free tier give you thousands of requests a day. That's effectively $0/month for a personal coding agent.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#zero-cost" className="transition-colors hover:text-foreground">
              Zero cost
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Link to="/auth?returnTo=/dashboard">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 rounded-lg">
              <Link to="/auth?returnTo=/dashboard">
                Open Mythos <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-20 pt-32 sm:pt-40">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 bg-[radial-gradient(closest-side,oklch(0.8_0.11_85/9%),transparent)]" />
          <div className="absolute inset-0 bg-[linear-gradient(oklch(1_0_0/3%)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/3%)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-[oklch(0.8_0.11_85/30%)] bg-[oklch(0.8_0.11_85/8%)] px-3 py-1 text-[oklch(0.8_0.11_85)]"
          >
            <Sparkles className="size-3" />
            Free · Blazing fast · Yours
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.06] tracking-tight sm:text-6xl">
            Your coding agent.
            <br />
            <span className="mythos-shimmer">Built for zero cost.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Mythos is a blazing-fast coding agent that runs on Gemini's free
            tier. Streamed answers, full code files, saved conversations — no
            subscription, no credit card, no surprises.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="w-full gap-2 rounded-xl px-7 text-[15px] sm:w-auto"
            >
              <Link to="/auth?returnTo=/dashboard">
                Start coding free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-xl px-7 text-[15px] sm:w-auto"
            >
              <a href="#features">See how it works</a>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <MockChat />
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-[oklch(0.145_0.004_285)]">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px px-5 sm:grid-cols-4">
          {[
            { value: "$0", label: "per month, forever" },
            { value: "~1s", label: "to first token" },
            { value: "1500+", label: "free requests / day" },
            { value: "Anywhere", label: "browser, Termux, low-end" },
          ].map((stat) => (
            <div key={stat.label} className="px-2 py-7 text-center">
              <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-5 py-24">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.8_0.11_85)]">
            The agent
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a coding agent should be — nothing it shouldn't.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Version 1 is focused: one sharp coding agent that writes, explains,
            and fixes code at zero cost. No bloat, no paywalls.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              {...fadeUp}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-[oklch(0.8_0.11_85/35%)]"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-muted text-[oklch(0.8_0.11_85)] transition-colors group-hover:border-[oklch(0.8_0.11_85/40%)] group-hover:bg-[oklch(0.8_0.11_85/10%)]">
                <feature.icon className="size-5" />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Zero cost */}
      <section
        id="zero-cost"
        className="border-y border-border bg-[oklch(0.145_0.004_285)]"
      >
        <div className="mx-auto w-full max-w-6xl px-5 py-24">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.8_0.11_85)]">
              The zero-cost engine
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Free tier, real agent.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Mythos calls Gemini's free tier directly with your own key. The
              free tier is genuinely free — no card, no quota games for a
              personal workflow.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                {...fadeUp}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="relative rounded-2xl border border-border bg-card p-6"
              >
                <p className="font-mono text-xs text-[oklch(0.8_0.11_85)]">
                  {step.step}
                </p>
                <h3 className="mt-3 text-[15px] font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
          <motion.div {...fadeUp} className="mt-10 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="gap-2 rounded-xl px-7 text-[15px]"
            >
              <Link to="/auth?returnTo=/dashboard">
                <KeyRound className="size-4" /> Set it up in 2 minutes
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-xl px-7 text-[15px]"
            >
              <a href="#how">How the free tier works</a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto w-full max-w-6xl px-5 py-24">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.8_0.11_85)]">
            Under the hood
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Small, fast, and honest.
          </h2>
        </motion.div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {[
            {
              icon: KeyRound,
              title: "Your key, your backend",
              body: "The API key lives server-side in your deployment. The browser never sees it, and there's no shared proxy in the middle.",
            },
            {
              icon: Zap,
              title: "Streamed, not waited on",
              body: "Tokens flow through your backend straight into the UI as they arrive. It feels like the model is typing next to you.",
            },
            {
              icon: History,
              title: "Persisted by default",
              body: "Conversations and messages live in your database. Refresh, switch devices, come back next week — it's all there.",
            },
            {
              icon: Smartphone,
              title: "Light enough for anywhere",
              body: "No heavy runtime, no bloated bundle. It runs fine in a desktop browser — or in a proot Ubuntu session in Termux on an old phone.",
            },
          ].map((item, index) => (
            <motion.div
              key={item.title}
              {...fadeUp}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className="flex gap-4 rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-[oklch(0.8_0.11_85)]">
                <item.icon className="size-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-24">
        <motion.div
          {...fadeUp}
          className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-[oklch(0.8_0.11_85/25%)] bg-[radial-gradient(80%_120%_at_50%_0%,oklch(0.8_0.11_85/12%),transparent_65%)] px-8 py-16 text-center sm:py-20"
        >
          <Sparkles className="mx-auto size-8 text-[oklch(0.8_0.11_85)]" />
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Stop paying for chat.
            <br />
            Start building.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
            One free key. One tab. A coding agent that never asks for a credit
            card.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 gap-2 rounded-xl px-8 text-[15px]"
          >
            <Link to="/auth?returnTo=/dashboard">
              Open Mythos <ArrowRight className="size-4" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-muted-foreground">
            Mythos · a zero-cost coding agent, built for one person — you.
          </p>
        </div>
      </footer>
    </div>
  );
}
