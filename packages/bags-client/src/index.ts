export * from "./types";
export { MockBagsClient, MOCK_AFFILIATE_FIXTURES, MOCK_TOKEN_MINT } from "./mock";

import { MockBagsClient } from "./mock";
import type { BagsClient, BagsClientMode } from "./types";

export function createBagsClient(
  mode?: BagsClientMode | string,
): BagsClient {
  const resolvedMode = mode ?? process.env.BAGS_CLIENT_MODE ?? "mock";

  if (resolvedMode === "mock") {
    return new MockBagsClient();
  }

  if (resolvedMode === "mainnet-readonly") {
    // Phase 2: MainnetBagsClient will be implemented here
    throw new Error(
      "MainnetBagsClient is not yet implemented. Set BAGS_CLIENT_MODE=mock for Phase 0.",
    );
  }

  throw new Error(`Unknown BAGS_CLIENT_MODE: "${resolvedMode}"`);
}
