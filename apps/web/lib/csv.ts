/**
 * Minimal CSV builder — no external dependencies.
 */

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(","));
  }
  return lines.join("\n");
}

export function lamportsToSolStr(lamports: bigint | number | string | null | undefined): string {
  if (lamports === null || lamports === undefined) return "0.000000000";
  const n = typeof lamports === "bigint" ? lamports : BigInt(String(lamports));
  const whole = n / BigInt(1_000_000_000);
  const frac = n % BigInt(1_000_000_000);
  return `${whole}.${frac.toString().padStart(9, "0")}`;
}
