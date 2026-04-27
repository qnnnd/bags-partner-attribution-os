/**
 * Singleton BagsClient instance for server-side use.
 * Mode is controlled by BAGS_CLIENT_MODE environment variable.
 */
import { createBagsClient, type BagsClient } from "@bags/bags-client";

let _client: BagsClient | null = null;

export function getBagsClient(): BagsClient {
  if (!_client) {
    _client = createBagsClient();
  }
  return _client;
}

/** Reset the cached client (useful in tests). */
export function resetBagsClient(): void {
  _client = null;
}
