import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-white hover:text-purple-300 transition"
        >
          <span className="text-purple-400">◆</span>
          <span>Bags Attribution</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/creator/dashboard"
            className="text-[var(--muted)] hover:text-white transition"
          >
            Creator
          </Link>
          <Link
            href="/affiliate/dashboard"
            className="text-[var(--muted)] hover:text-white transition"
          >
            Affiliate
          </Link>
          <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300 border border-purple-500/30">
            Mock Mode
          </span>
        </div>
      </div>
    </nav>
  );
}
