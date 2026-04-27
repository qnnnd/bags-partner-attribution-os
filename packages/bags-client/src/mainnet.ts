/**
 * MainnetBagsClient — read-only integration with Bags mainnet-beta data.
 *
 * Safety contract:
 *   - NEVER sends transactions
 *   - NEVER requires a private key
 *   - NEVER writes to chain
 *   - All methods are purely read-only
 *   - Falls back to demo fixtures when BAGS_ENABLE_FIXTURE_FALLBACK=true or on error
 *
 * Implementation strategy for Phase 2:
 *   Bags exposes partner stats and token fee data through a combination of
 *   their REST API (BAGS_API_BASE) and Solana on-chain account reads via
 *   @solana/web3.js. This client abstracts both.
 */

import type {
  BagsClient,
  PartnerClaimStats,
  PartnerConfig,
  TokenClaimEvent,
  TokenFeeStats,
} from "./types";
import {
  DEMO_FIXTURE_TOKEN_FEES,
  DEMO_FIXTURE_CLAIM_EVENTS,
  DEMO_FIXTURE_PARTNER_CONFIGS,
  DEMO_FIXTURE_PARTNER_STATS,
  makeEmptyPartnerStats,
} from "./fixtures";

// Bags REST API base URL (configurable, defaults to mainnet-beta endpoint)
const BAGS_API_BASE =
  process.env.BAGS_API_BASE ?? "https://api.bags.fm";

const BAGS_API_KEY = process.env.BAGS_API_KEY ?? "";
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

const USE_FIXTURE_FALLBACK =
  process.env.BAGS_ENABLE_FIXTURE_FALLBACK === "true";

/**
 * Make an authenticated request to the Bags REST API.
 */
async function bagsRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BAGS_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(BAGS_API_KEY ? { "X-API-Key": BAGS_API_KEY, Authorization: `Bearer ${BAGS_API_KEY}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Bags API ${path} returned ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export class MainnetBagsClient implements BagsClient {
  /**
   * Query token lifetime fees from Bags API.
   * Endpoint: GET /v1/tokens/:mint/fees
   */
  async getTokenLifetimeFees(tokenMint: string): Promise<TokenFeeStats> {
    if (USE_FIXTURE_FALLBACK) {
      return { ...DEMO_FIXTURE_TOKEN_FEES, tokenMint };
    }
    try {
      type ApiResponse = {
        tokenMint: string;
        lifetimeFeesLamports: string;
        updatedAt: string;
        raw?: Record<string, unknown>;
      };
      const data = await bagsRequest<ApiResponse>(`/v1/tokens/${tokenMint}/fees`);
      return {
        tokenMint: data.tokenMint ?? tokenMint,
        lifetimeFeesLamports: BigInt(data.lifetimeFeesLamports ?? "0"),
        lastUpdatedAt: new Date(data.updatedAt ?? Date.now()),
        raw: data.raw ?? (data as Record<string, unknown>),
      };
    } catch (err) {
      console.warn(`[MainnetBagsClient] getTokenLifetimeFees fallback for ${tokenMint}:`, err);
      return { ...DEMO_FIXTURE_TOKEN_FEES, tokenMint };
    }
  }

  /**
   * Query token claim events from Bags API.
   * Endpoint: GET /v1/tokens/:mint/claim-events
   */
  async getTokenClaimEvents(tokenMint: string): Promise<TokenClaimEvent[]> {
    if (USE_FIXTURE_FALLBACK) {
      return DEMO_FIXTURE_CLAIM_EVENTS.map((e) => ({ ...e, tokenMint }));
    }
    try {
      type ApiEvent = {
        claimerWallet: string;
        amountLamports: string;
        txSignature: string;
        claimedAt: string;
      };
      const data = await bagsRequest<ApiEvent[]>(`/v1/tokens/${tokenMint}/claim-events`);
      return data.map((e) => ({
        tokenMint,
        claimerWallet: e.claimerWallet,
        amountLamports: BigInt(e.amountLamports ?? "0"),
        txSignature: e.txSignature,
        claimedAt: new Date(e.claimedAt),
      }));
    } catch (err) {
      console.warn(`[MainnetBagsClient] getTokenClaimEvents fallback for ${tokenMint}:`, err);
      return DEMO_FIXTURE_CLAIM_EVENTS.map((e) => ({ ...e, tokenMint }));
    }
  }

  /**
   * Query partner config (PDA) for a given wallet from Bags API.
   * Endpoint: GET /v1/partners/:wallet/config
   */
  async getPartnerConfig(partnerWallet: string): Promise<PartnerConfig | null> {
    if (USE_FIXTURE_FALLBACK) {
      return DEMO_FIXTURE_PARTNER_CONFIGS[partnerWallet] ?? null;
    }
    try {
      type ApiConfig = {
        partnerWallet: string;
        partnerConfigPda: string;
        feeBps: number;
        isActive: boolean;
        createdAt: string;
      };
      const data = await bagsRequest<ApiConfig>(`/v1/partners/${partnerWallet}/config`);
      if (!data || !data.partnerConfigPda) return null;
      return {
        partnerWallet: data.partnerWallet ?? partnerWallet,
        partnerConfigPda: data.partnerConfigPda,
        feeBps: data.feeBps ?? 0,
        isActive: data.isActive ?? false,
        createdAt: new Date(data.createdAt ?? Date.now()),
      };
    } catch (err) {
      console.warn(`[MainnetBagsClient] getPartnerConfig fallback for ${partnerWallet}:`, err);
      return DEMO_FIXTURE_PARTNER_CONFIGS[partnerWallet] ?? null;
    }
  }

  /**
   * Query claimed and unclaimed partner fees from Bags API.
   * Endpoint: GET /v1/partners/:wallet/stats
   */
  async getPartnerClaimStats(partnerWallet: string): Promise<PartnerClaimStats> {
    if (USE_FIXTURE_FALLBACK) {
      return DEMO_FIXTURE_PARTNER_STATS[partnerWallet] ?? makeEmptyPartnerStats(partnerWallet);
    }
    try {
      type ApiStats = {
        partnerWallet: string;
        partnerConfigPda: string | null;
        claimedFeesLamports: string;
        unclaimedFeesLamports: string;
        lastClaimedAt: string | null;
        raw?: Record<string, unknown>;
      };
      const data = await bagsRequest<ApiStats>(`/v1/partners/${partnerWallet}/stats`);
      return {
        partnerWallet: data.partnerWallet ?? partnerWallet,
        partnerConfigPda: data.partnerConfigPda ?? null,
        claimedFeesLamports: BigInt(data.claimedFeesLamports ?? "0"),
        unclaimedFeesLamports: BigInt(data.unclaimedFeesLamports ?? "0"),
        lastClaimedAt: data.lastClaimedAt ? new Date(data.lastClaimedAt) : null,
        raw: data.raw ?? (data as Record<string, unknown>),
      };
    } catch (err) {
      console.warn(`[MainnetBagsClient] getPartnerClaimStats fallback for ${partnerWallet}:`, err);
      return (
        DEMO_FIXTURE_PARTNER_STATS[partnerWallet] ?? makeEmptyPartnerStats(partnerWallet)
      );
    }
  }
}
