import Link from "next/link";
import { Nav } from "../components/Nav";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-300">
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            Phase 0 — Mock Data Mode
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
            Bags Partner{" "}
            <span className="bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
              Attribution OS
            </span>
          </h1>
          <p className="mt-6 text-lg text-[var(--muted)] leading-relaxed">
            Bags-native partner revenue attribution layer. Connect campaign
            links, wallet identity, partner keys, Bags fee sharing, and
            on-chain fee data to understand which KOLs drive real long-term
            token revenue.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/creator/dashboard"
              className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-purple-500 transition"
            >
              Creator Dashboard →
            </Link>
            <Link
              href="/affiliate/dashboard"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-white hover:border-purple-500/50 transition"
            >
              Affiliate Dashboard →
            </Link>
            <Link
              href={`/creator/campaigns/demo-campaign-001`}
              className="rounded-xl border border-green-500/30 bg-green-500/10 px-6 py-3 text-sm font-semibold text-green-300 hover:bg-green-500/20 transition"
            >
              View Demo Campaign →
            </Link>
          </div>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid max-w-5xl gap-5 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const FEATURES = [
  {
    icon: "🔗",
    title: "Ref Link Tracking",
    desc: "Generate unique affiliate ref links. Track visits, wallet connects, and buy intents per KOL.",
  },
  {
    icon: "⛓️",
    title: "On-chain Attribution",
    desc: "Match wallet buy activity within the attribution window to affiliate ref links.",
  },
  {
    icon: "🛡️",
    title: "Risk Engine",
    desc: "Detect self-buys, repeated clicks, tiny buys, and abnormal conversion patterns.",
  },
  {
    icon: "💰",
    title: "Fee Snapshots",
    desc: "Sync Bags partner claimed/unclaimed fees. Show each KOL's real revenue contribution.",
  },
  {
    icon: "📊",
    title: "Attribution Leaderboard",
    desc: "Confidence-scored leaderboard showing which affiliates drive the most attributable revenue.",
  },
  {
    icon: "📑",
    title: "Payout Reports",
    desc: "Export CSV payout reports. Creator reviews and approves before any payment.",
  },
];
