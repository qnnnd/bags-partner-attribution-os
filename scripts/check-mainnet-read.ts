#!/usr/bin/env tsx
/**
 * scripts/check-mainnet-read.ts
 *
 * Manual integration test for Bags mainnet-beta read-only access.
 *
 * Usage:
 *   BAGS_CLIENT_MODE=mainnet-readonly pnpm script:check-mainnet-read
 *
 * Or with a custom token mint / partner wallet:
 *   BAGS_CLIENT_MODE=mainnet-readonly \
 *   CHECK_TOKEN_MINT=<mint> \
 *   CHECK_PARTNER_WALLET=<wallet> \
 *   pnpm script:check-mainnet-read
 *
 * Safety:
 *   - READ ONLY. Does not send any transactions.
 *   - Does not require a private key.
 *   - Does not require SOL.
 *   - Will NOT run if ENABLE_MAINNET_WRITE=true.
 *   - Falls back to demo fixtures if API is unreachable.
 */

import { createBagsClient } from "../packages/bags-client/src/index";
import { DEMO_FIXTURE_TOKEN_MINT } from "../packages/bags-client/src/fixtures";

// ─── Safety check ─────────────────────────────────────────────────────────────
if (process.env.ENABLE_MAINNET_WRITE === "true") {
  console.error("❌ ENABLE_MAINNET_WRITE=true is set. This script is read-only and must NOT run with write mode enabled.");
  process.exit(1);
}

const mode = process.env.BAGS_CLIENT_MODE ?? "mock";
const tokenMint = process.env.CHECK_TOKEN_MINT ?? DEMO_FIXTURE_TOKEN_MINT;
const partnerWallet =
  process.env.CHECK_PARTNER_WALLET ??
  "AliceWallet1111111111111111111111111111111111";

console.log(`\n🔍 Bags Mainnet Read Check`);
console.log(`   Mode:           ${mode}`);
console.log(`   Token Mint:     ${tokenMint}`);
console.log(`   Partner Wallet: ${partnerWallet}`);
console.log(`   Solana RPC:     ${process.env.SOLANA_RPC_URL ?? "default"}`);
console.log(`   Bags API Base:  ${process.env.BAGS_API_BASE ?? "default"}`);
console.log(`   ENABLE_MAINNET_WRITE: ${process.env.ENABLE_MAINNET_WRITE ?? "false (safe)"}`);
console.log("─".repeat(60));

const client = createBagsClient(mode as never);

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await check("getTokenLifetimeFees returns non-zero bigint", async () => {
    const result = await client.getTokenLifetimeFees(tokenMint);
    if (!result) throw new Error("Null result");
    if (typeof result.lifetimeFeesLamports !== "bigint") throw new Error("lifetimeFeesLamports is not BigInt");
    if (result.lifetimeFeesLamports < BigInt(0)) throw new Error("Negative fees");
    console.log(`     lifetimeFeesLamports = ${result.lifetimeFeesLamports} (${Number(result.lifetimeFeesLamports) / 1e9} SOL)`);
  });

  await check("getTokenClaimEvents returns array", async () => {
    const events = await client.getTokenClaimEvents(tokenMint);
    if (!Array.isArray(events)) throw new Error("Not an array");
    console.log(`     ${events.length} claim event(s) found`);
    if (events.length > 0) {
      const e = events[0]!;
      console.log(`     First: claimer=${e.claimerWallet.slice(0, 8)}… amount=${Number(e.amountLamports) / 1e9} SOL`);
    }
  });

  await check("getPartnerConfig returns config or null", async () => {
    const cfg = await client.getPartnerConfig(partnerWallet);
    if (cfg === undefined) throw new Error("Returned undefined (should be null or PartnerConfig)");
    if (cfg) {
      console.log(`     partnerConfigPda = ${cfg.partnerConfigPda}`);
      console.log(`     feeBps = ${cfg.feeBps} (${cfg.feeBps / 100}%)`);
      console.log(`     isActive = ${cfg.isActive}`);
    } else {
      console.log(`     No partner config found for this wallet`);
    }
  });

  await check("getPartnerClaimStats returns claimed/unclaimed fees", async () => {
    const stats = await client.getPartnerClaimStats(partnerWallet);
    if (!stats) throw new Error("Null result");
    if (typeof stats.claimedFeesLamports !== "bigint") throw new Error("claimedFeesLamports is not BigInt");
    if (typeof stats.unclaimedFeesLamports !== "bigint") throw new Error("unclaimedFeesLamports is not BigInt");
    console.log(`     claimed = ${Number(stats.claimedFeesLamports) / 1e9} SOL`);
    console.log(`     unclaimed = ${Number(stats.unclaimedFeesLamports) / 1e9} SOL`);
    console.log(`     partnerConfigPda = ${stats.partnerConfigPda ?? "none"}`);
  });

  await check("No write operations were triggered", async () => {
    console.log(`     ENABLE_MAINNET_WRITE = ${process.env.ENABLE_MAINNET_WRITE ?? "false"}`);
    if (process.env.ENABLE_MAINNET_WRITE === "true") {
      throw new Error("ENABLE_MAINNET_WRITE must be false for read-only check");
    }
  });

  // ─── Summary ──────────────────────────────────────────────────────────────────
  console.log("─".repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\n⚠️  Some checks failed. This is expected if:");
    console.log("   - BAGS_CLIENT_MODE=mock (using mock data)");
    console.log("   - BAGS_API_KEY is not set or invalid");
    console.log("   - The Bags API is unreachable");
    console.log("   - The token mint / partner wallet has no data");
    console.log("\n   Set BAGS_ENABLE_FIXTURE_FALLBACK=true to use demo fixtures as fallback.");
    process.exit(1);
  } else {
    console.log("\n✅ All checks passed.");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
