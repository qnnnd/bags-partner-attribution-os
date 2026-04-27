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
 * Phase 2: Bags REST API for partner stats / token fees.
 * Phase 3: Solana RPC read-only for on-chain buy candidate detection.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import type {
  BagsClient,
  OnchainBuyCandidate,
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
  DEMO_FIXTURE_ONCHAIN_CANDIDATES,
  makeEmptyPartnerStats,
} from "./fixtures";
import { solscanTxLink } from "./solscan";

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
   *
   * NOTE: The endpoint path `/v1/tokens/:mint/fees` is an adapter placeholder
   * modelled on Bags SDK conventions. It should be verified against the
   * official Bags REST API documentation before production use.
   */
  async getTokenLifetimeFees(tokenMint: string): Promise<TokenFeeStats> {
    if (USE_FIXTURE_FALLBACK) {
      return {
        ...DEMO_FIXTURE_TOKEN_FEES,
        tokenMint,
        raw: { ...DEMO_FIXTURE_TOKEN_FEES.raw, source: "fixture_fallback" },
      };
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
        raw: { ...(data.raw ?? (data as Record<string, unknown>)), source: "real_mainnet" },
      };
    } catch (err) {
      console.warn(`[MainnetBagsClient] getTokenLifetimeFees fallback for ${tokenMint}:`, err);
      return {
        ...DEMO_FIXTURE_TOKEN_FEES,
        tokenMint,
        raw: { ...DEMO_FIXTURE_TOKEN_FEES.raw, source: "fixture_fallback" },
      };
    }
  }

  /**
   * Query token claim events from Bags API.
   *
   * NOTE: The endpoint path `/v1/tokens/:mint/claim-events` is an adapter
   * placeholder. Verify against official Bags API docs before production use.
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
   *
   * NOTE: The endpoint path `/v1/partners/:wallet/config` is an adapter
   * placeholder. Verify against official Bags API docs before production use.
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
   * Query a wallet's recent transactions on-chain for buy candidates involving
   * the target token mint. Pure read-only — no transactions sent, no key needed.
   *
   * Strategy:
   *   1. getSignaturesForAddress for the buyer wallet (up to 50 recent sigs)
   *   2. For each sig within the window, getParsedTransaction
   *   3. Check if pre/postTokenBalances contain the target mint
   *   4. Return matching candidates with Solscan links
   */
  async getWalletTokenActivity(
    walletAddress: string,
    tokenMint: string,
    since: Date,
  ): Promise<OnchainBuyCandidate[]> {
    if (USE_FIXTURE_FALLBACK) {
      const candidates = DEMO_FIXTURE_ONCHAIN_CANDIDATES[walletAddress] ?? [];
      return candidates.filter((c) => c.tokenMint === tokenMint && c.timestamp >= since);
    }
    try {
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const pubkey = new PublicKey(walletAddress);
      const sinceUnix = Math.floor(since.getTime() / 1000);

      const signatures = await connection.getSignaturesForAddress(pubkey, {
        limit: 50,
      });

      const candidates: OnchainBuyCandidate[] = [];

      for (const sigInfo of signatures) {
        // Skip transactions older than the attribution window
        if (sigInfo.blockTime != null && sigInfo.blockTime < sinceUnix) continue;
        // Skip failed transactions
        if (sigInfo.err != null) continue;

        let tx;
        try {
          tx = await connection.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });
        } catch {
          continue;
        }
        if (!tx) continue;

        const preBalances = tx.meta?.preTokenBalances ?? [];
        const postBalances = tx.meta?.postTokenBalances ?? [];
        const involvesMint =
          preBalances.some((b) => b.mint === tokenMint) ||
          postBalances.some((b) => b.mint === tokenMint);

        if (involvesMint) {
          const timestamp =
            sigInfo.blockTime != null
              ? new Date(sigInfo.blockTime * 1000)
              : new Date();
          candidates.push({
            txSignature: sigInfo.signature,
            walletAddress,
            tokenMint,
            timestamp,
            solscanLink: solscanTxLink(sigInfo.signature),
          });
        }
      }

      return candidates;
    } catch (err) {
      console.warn(
        `[MainnetBagsClient] getWalletTokenActivity fallback for ${walletAddress}:`,
        err,
      );
      const candidates = DEMO_FIXTURE_ONCHAIN_CANDIDATES[walletAddress] ?? [];
      return candidates.filter((c) => c.tokenMint === tokenMint && c.timestamp >= since);
    }
  }

  /**
   * Query claimed and unclaimed partner fees from Bags API.
   *
   * NOTE: The endpoint path `/v1/partners/:wallet/stats` is an adapter
   * placeholder. Verify against official Bags API docs before production use.
   */
  async getPartnerClaimStats(partnerWallet: string): Promise<PartnerClaimStats> {
    if (USE_FIXTURE_FALLBACK) {
      const fixture = DEMO_FIXTURE_PARTNER_STATS[partnerWallet] ?? makeEmptyPartnerStats(partnerWallet);
      return { ...fixture, raw: { ...fixture.raw, source: "fixture_fallback" } };
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
        raw: { ...(data.raw ?? (data as Record<string, unknown>)), source: "real_mainnet" },
      };
    } catch (err) {
      console.warn(`[MainnetBagsClient] getPartnerClaimStats fallback for ${partnerWallet}:`, err);
      const fixture = DEMO_FIXTURE_PARTNER_STATS[partnerWallet] ?? makeEmptyPartnerStats(partnerWallet);
      return { ...fixture, raw: { ...fixture.raw, source: "fixture_fallback" } };
    }
  }
}
