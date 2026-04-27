/**
 * Transaction signature validator utilities for Phase 4 payout ledger.
 *
 * Safety contract:
 *   - NEVER sends a transaction
 *   - NEVER requires a private key
 *   - verifyTxOnChain is purely a READ-ONLY status check
 *   - Falls back to a mock response when BAGS_CLIENT_MODE != "mainnet-readonly"
 */

/**
 * Solana transaction signatures are base58-encoded 64-byte (512-bit) values.
 * Base58 encoding of 64 bytes produces 87 or 88 characters.
 * Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
 */
const SOLANA_TX_SIG_REGEX = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

export interface TxValidationResult {
  valid: boolean;
  error?: string;
}

export interface TxOnChainResult {
  exists: boolean;
  slot?: number;
  confirmationStatus?: string;
  err?: string | null;
}

/**
 * Validates the format of a Solana transaction signature.
 * Does not make any network calls.
 */
export function validateTxSignatureFormat(sig: unknown): TxValidationResult {
  if (typeof sig !== "string" || sig.trim() === "") {
    return { valid: false, error: "Transaction signature must be a non-empty string." };
  }
  if (!SOLANA_TX_SIG_REGEX.test(sig.trim())) {
    return {
      valid: false,
      error: `Invalid transaction signature format. Expected 87–88 base58 characters, got ${sig.trim().length}.`,
    };
  }
  return { valid: true };
}

/**
 * Read-only RPC check: verifies that a transaction exists on-chain.
 *
 * When BAGS_CLIENT_MODE is not "mainnet-readonly" (i.e., in mock/dev/test mode),
 * returns a mock "exists" response so tests never hit the network.
 *
 * NEVER sends a transaction. NEVER requires SOL or a private key.
 */
export async function verifyTxOnChain(sig: string): Promise<TxOnChainResult> {
  const mode = process.env.BAGS_CLIENT_MODE ?? "mock";

  if (mode !== "mainnet-readonly") {
    // Mock mode: treat any format-valid signature as "exists"
    return {
      exists: true,
      slot: 999_999_999,
      confirmationStatus: "finalized",
      err: null,
    };
  }

  // Mainnet read-only: call the Solana JSON-RPC endpoint directly via fetch.
  // No SDK needed — this is a plain POST request to getSignatureStatuses.
  const rpcUrl =
    process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignatureStatuses",
        params: [[sig.trim()], { searchTransactionHistory: true }],
      }),
    });
    if (!response.ok) {
      return { exists: false, err: `RPC HTTP ${response.status}` };
    }
    type RpcStatus = {
      slot?: number;
      confirmationStatus?: string;
      err?: unknown;
    };
    type RpcResponse = {
      result?: { value?: (RpcStatus | null)[] };
      error?: { message?: string };
    };
    const data = (await response.json()) as RpcResponse;
    if (data.error) {
      return { exists: false, err: data.error.message };
    }
    const status = data.result?.value?.[0];
    if (!status) {
      return { exists: false };
    }
    return {
      exists: true,
      slot: status.slot,
      confirmationStatus: status.confirmationStatus ?? undefined,
      err: status.err != null ? JSON.stringify(status.err) : null,
    };
  } catch (err) {
    console.warn("[verifyTxOnChain] RPC lookup failed:", err);
    return { exists: false, err: err instanceof Error ? err.message : String(err) };
  }
}
