/**
 * Solscan explorer link utilities (read-only, no network calls).
 */

const SOLSCAN_BASE = "https://solscan.io";

/**
 * Returns a read-only Solscan transaction explorer link.
 * Example: solscanTxLink("5xABC...") → "https://solscan.io/tx/5xABC..."
 */
export function solscanTxLink(txSignature: string): string {
  return `${SOLSCAN_BASE}/tx/${txSignature}`;
}

/**
 * Returns a read-only Solscan account explorer link.
 */
export function solscanAccountLink(address: string): string {
  return `${SOLSCAN_BASE}/account/${address}`;
}
