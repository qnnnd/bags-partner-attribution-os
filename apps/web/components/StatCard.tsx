interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, sub, highlight }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "border-purple-500/40 bg-purple-500/10"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${highlight ? "text-purple-300" : "text-white"}`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}
