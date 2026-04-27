import { MockBagsClient } from "./mock";
import { MainnetBagsClient } from "./mainnet";
import type { BagsClient, BagsClientMode } from "./types";

export { MockBagsClient } from "./mock";
export { MainnetBagsClient } from "./mainnet";
export { MOCK_AFFILIATE_FIXTURES, MOCK_TOKEN_MINT } from "./mock";
export * from "./fixtures";
export type { BagsClient, BagsClientMode } from "./types";
export type {
  TokenFeeStats,
  TokenClaimEvent,
  PartnerConfig,
  PartnerClaimStats,
  OnchainBuyCandidate,
} from "./types";
export { solscanTxLink, solscanAccountLink } from "./solscan";

/**
 * Factory: returns the correct BagsClient implementation based on
 * BAGS_CLIENT_MODE environment variable.
 *
 * BAGS_CLIENT_MODE=mock            → MockBagsClient (default, safe for CI/dev)
 * BAGS_CLIENT_MODE=mainnet-readonly → MainnetBagsClient (read-only, needs BAGS_API_KEY)
 */
export function createBagsClient(
  mode?: BagsClientMode,
): BagsClient {
  const resolved = (mode ?? process.env.BAGS_CLIENT_MODE ?? "mock") as BagsClientMode;

  if (resolved === "mainnet-readonly") {
    if (process.env.ENABLE_MAINNET_WRITE === "true") {
      throw new Error(
        "[BagsClient] ENABLE_MAINNET_WRITE=true is set but MainnetBagsClient is read-only. " +
          "This combination is not supported. Unset ENABLE_MAINNET_WRITE or do not use mainnet-readonly mode.",
      );
    }
    return new MainnetBagsClient();
  }

  return new MockBagsClient();
}
