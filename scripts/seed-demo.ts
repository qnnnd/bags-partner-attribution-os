/**
 * seed-demo.ts
 *
 * Creates demo data for Phase 0 local development:
 *   - 1 creator user
 *   - 1 campaign (BAGS Genesis Launch)
 *   - 3 affiliates (Alice, Bob, Carol)
 *   - ~20 tracking events
 *   - 3 attribution conversions with varying confidence scores
 *   - 3 partner_fee_snapshots (mock Bags data)
 *   - 1 token_fee_snapshot
 *   - 3 payout_ledger entries
 *
 * Usage: pnpm seed:demo
 * Requires DATABASE_URL to be set in .env
 */

import { PrismaClient } from "../packages/db/src/generated/client";

const prisma = new PrismaClient({
  log: ["error"],
});

const CREATOR_WALLET = "CreatorWallet11111111111111111111111111111111";
const TOKEN_MINT = "MockToken11111111111111111111111111111111111";
const CAMPAIGN_ID = "demo-campaign-001";

const AFFILIATES = [
  {
    id: "aff-alice-001",
    walletAddress: "AliceWallet1111111111111111111111111111111111",
    displayName: "Alice.sol",
    refCode: "ALICE42",
    partnerWallet: "AliceWallet1111111111111111111111111111111111",
    partnerConfigPda: "AlicePDA111111111111111111111111111111111111",
  },
  {
    id: "aff-bob-001",
    walletAddress: "BobWallet11111111111111111111111111111111111",
    displayName: "Bob.sol",
    refCode: "BOB99",
    partnerWallet: "BobWallet11111111111111111111111111111111111",
    partnerConfigPda: "BobPDA1111111111111111111111111111111111111",
  },
  {
    id: "aff-carol-001",
    walletAddress: "CarolWallet111111111111111111111111111111111",
    displayName: "Carol.sol",
    refCode: "CAROL7",
    partnerWallet: "CarolWallet111111111111111111111111111111111",
    partnerConfigPda: "CarolPDA11111111111111111111111111111111111",
  },
];

const BUYER_WALLETS = [
  "BuyerWallet1111111111111111111111111111111111",
  "BuyerWallet2222222222222222222222222222222222",
  "BuyerWallet3333333333333333333333333333333333",
];

async function main() {
  console.log("🌱  Seeding demo data...\n");

  // ─── Clean up previous seed ────────────────────────────────────────────────
  await prisma.payoutLedger.deleteMany({ where: { campaignId: CAMPAIGN_ID } });
  await prisma.riskFlag.deleteMany({ where: { campaignId: CAMPAIGN_ID } });
  await prisma.partnerFeeSnapshot.deleteMany({ where: { campaignId: CAMPAIGN_ID } });
  await prisma.tokenFeeSnapshot.deleteMany({ where: { campaignId: CAMPAIGN_ID } });
  await prisma.attributionConversion.deleteMany({ where: { campaignId: CAMPAIGN_ID } });
  await prisma.trackingEvent.deleteMany({ where: { campaignId: CAMPAIGN_ID } });
  await prisma.affiliate.deleteMany({ where: { campaignId: CAMPAIGN_ID } });
  await prisma.campaign.deleteMany({ where: { id: CAMPAIGN_ID } });
  await prisma.user.deleteMany({ where: { walletAddress: CREATOR_WALLET } });

  console.log("  ✓ Cleared previous seed data");

  // ─── Creator user ──────────────────────────────────────────────────────────
  const creator = await prisma.user.create({
    data: {
      walletAddress: CREATOR_WALLET,
      role: "creator",
      displayName: "Demo Creator",
    },
  });
  console.log(`  ✓ Created creator: ${creator.walletAddress}`);

  // ─── Campaign ──────────────────────────────────────────────────────────────
  const campaign = await prisma.campaign.create({
    data: {
      id: CAMPAIGN_ID,
      creatorWallet: CREATOR_WALLET,
      tokenMint: TOKEN_MINT,
      name: "BAGS Genesis Launch",
      slug: "bags-genesis",
      bagsTokenUrl: "https://bags.fm/token/MockToken111",
      attributionWindowMinutes: 1440,
      status: "active",
    },
  });
  console.log(`  ✓ Created campaign: "${campaign.name}" (${campaign.id})`);

  // ─── Affiliates ────────────────────────────────────────────────────────────
  for (const aff of AFFILIATES) {
    await prisma.affiliate.create({
      data: {
        id: aff.id,
        campaignId: CAMPAIGN_ID,
        walletAddress: aff.walletAddress,
        displayName: aff.displayName,
        refCode: aff.refCode,
        partnerWallet: aff.partnerWallet,
        partnerConfigPda: aff.partnerConfigPda,
        status: "active",
      },
    });
    console.log(`  ✓ Created affiliate: ${aff.displayName} (${aff.refCode})`);
  }

  // ─── Tracking events ───────────────────────────────────────────────────────
  const now = new Date();
  const events: Array<{
    campaignId: string;
    affiliateId: string;
    eventType: "visit" | "wallet_connect" | "buy_click" | "outbound_to_bags";
    sessionId: string;
    walletAddress?: string;
    tokenMint: string;
    refCode: string;
    ipHash: string;
    userAgentHash: string;
    createdAt: Date;
  }> = [
    // Alice: visit, wallet_connect, buy_click (high-confidence session)
    ...Array.from({ length: 8 }, (_, i) => ({
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-alice-001",
      eventType: "visit" as const,
      sessionId: `sess-alice-${i + 1}`,
      tokenMint: TOKEN_MINT,
      refCode: "ALICE42",
      ipHash: `iph-alice-${(i % 3) + 1}`,
      userAgentHash: "uah-chrome-mac",
      createdAt: new Date(now.getTime() - (8 - i) * 3_600_000),
    })),
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-alice-001",
      eventType: "wallet_connect",
      sessionId: "sess-alice-3",
      walletAddress: BUYER_WALLETS[0],
      tokenMint: TOKEN_MINT,
      refCode: "ALICE42",
      ipHash: "iph-alice-1",
      userAgentHash: "uah-chrome-mac",
      createdAt: new Date(now.getTime() - 5 * 3_600_000),
    },
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-alice-001",
      eventType: "buy_click",
      sessionId: "sess-alice-3",
      walletAddress: BUYER_WALLETS[0],
      tokenMint: TOKEN_MINT,
      refCode: "ALICE42",
      ipHash: "iph-alice-1",
      userAgentHash: "uah-chrome-mac",
      createdAt: new Date(now.getTime() - 4.5 * 3_600_000),
    },
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-alice-001",
      eventType: "outbound_to_bags",
      sessionId: "sess-alice-3",
      walletAddress: BUYER_WALLETS[0],
      tokenMint: TOKEN_MINT,
      refCode: "ALICE42",
      ipHash: "iph-alice-1",
      userAgentHash: "uah-chrome-mac",
      createdAt: new Date(now.getTime() - 4.4 * 3_600_000),
    },
    // Bob: visit, wallet_connect, buy_click (medium-confidence)
    ...Array.from({ length: 5 }, (_, i) => ({
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-bob-001",
      eventType: "visit" as const,
      sessionId: `sess-bob-${i + 1}`,
      tokenMint: TOKEN_MINT,
      refCode: "BOB99",
      ipHash: `iph-bob-${(i % 2) + 1}`,
      userAgentHash: "uah-firefox-win",
      createdAt: new Date(now.getTime() - (5 - i) * 2_400_000),
    })),
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-bob-001",
      eventType: "wallet_connect",
      sessionId: "sess-bob-2",
      walletAddress: BUYER_WALLETS[1],
      tokenMint: TOKEN_MINT,
      refCode: "BOB99",
      ipHash: "iph-bob-1",
      userAgentHash: "uah-firefox-win",
      createdAt: new Date(now.getTime() - 3 * 2_400_000),
    },
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-bob-001",
      eventType: "buy_click",
      sessionId: "sess-bob-2",
      walletAddress: BUYER_WALLETS[1],
      tokenMint: TOKEN_MINT,
      refCode: "BOB99",
      ipHash: "iph-bob-1",
      userAgentHash: "uah-firefox-win",
      createdAt: new Date(now.getTime() - 2.8 * 2_400_000),
    },
    // Carol: visit only, low-confidence
    ...Array.from({ length: 3 }, (_, i) => ({
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-carol-001",
      eventType: "visit" as const,
      sessionId: `sess-carol-${i + 1}`,
      tokenMint: TOKEN_MINT,
      refCode: "CAROL7",
      ipHash: "iph-carol-1",
      userAgentHash: "uah-safari-ios",
      createdAt: new Date(now.getTime() - (3 - i) * 1_800_000),
    })),
  ];

  for (const event of events) {
    await prisma.trackingEvent.create({ data: event });
  }
  console.log(`  ✓ Created ${events.length} tracking events`);

  // ─── Attribution conversions ───────────────────────────────────────────────
  const aliceConversion = await prisma.attributionConversion.create({
    data: {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-alice-001",
      buyerWallet: BUYER_WALLETS[0],
      tokenMint: TOKEN_MINT,
      attributionType: "onchain_candidate",
      confidenceScore: 90,
      status: "confirmed",
      reason:
        "onchain_candidate attribution (score: 90): ref link visit, wallet connected, buy click recorded, on-chain candidate detected",
    },
  });

  const bobConversion = await prisma.attributionConversion.create({
    data: {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-bob-001",
      buyerWallet: BUYER_WALLETS[1],
      tokenMint: TOKEN_MINT,
      attributionType: "wallet_intent",
      confidenceScore: 75,
      status: "candidate",
      reason:
        "wallet_intent attribution (score: 75): ref link visit, wallet connected, buy click recorded",
    },
  });

  const carolConversion = await prisma.attributionConversion.create({
    data: {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-carol-001",
      buyerWallet: BUYER_WALLETS[2],
      tokenMint: TOKEN_MINT,
      attributionType: "click",
      confidenceScore: 40,
      status: "candidate",
      reason: "click attribution (score: 40): ref link visit",
    },
  });
  console.log("  ✓ Created 3 attribution conversions");

  // ─── Risk flags ────────────────────────────────────────────────────────────
  await prisma.riskFlag.create({
    data: {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-carol-001",
      conversionId: carolConversion.id,
      riskType: "repeated_click",
      severity: "low",
      scoreDelta: -20,
      reason: "Same IP hash triggered 3 visits in 30 minutes.",
    },
  });
  console.log("  ✓ Created risk flag for Carol");

  // ─── Partner fee snapshots ─────────────────────────────────────────────────
  const feeSnapshots = [
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-alice-001",
      partnerWallet: AFFILIATES[0]!.partnerWallet,
      partnerConfigPda: AFFILIATES[0]!.partnerConfigPda,
      claimedFeesLamports: BigInt(12_500_000_000),
      unclaimedFeesLamports: BigInt(3_200_000_000),
      raw: { source: "mock", note: "Phase 0 seed" },
    },
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-bob-001",
      partnerWallet: AFFILIATES[1]!.partnerWallet,
      partnerConfigPda: AFFILIATES[1]!.partnerConfigPda,
      claimedFeesLamports: BigInt(8_750_000_000),
      unclaimedFeesLamports: BigInt(1_500_000_000),
      raw: { source: "mock", note: "Phase 0 seed" },
    },
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: "aff-carol-001",
      partnerWallet: AFFILIATES[2]!.partnerWallet,
      partnerConfigPda: AFFILIATES[2]!.partnerConfigPda,
      claimedFeesLamports: BigInt(4_200_000_000),
      unclaimedFeesLamports: BigInt(900_000_000),
      raw: { source: "mock", note: "Phase 0 seed" },
    },
  ];

  for (const snap of feeSnapshots) {
    await prisma.partnerFeeSnapshot.create({ data: snap });
  }
  console.log("  ✓ Created 3 partner fee snapshots");

  // ─── Token fee snapshot ────────────────────────────────────────────────────
  await prisma.tokenFeeSnapshot.create({
    data: {
      campaignId: CAMPAIGN_ID,
      tokenMint: TOKEN_MINT,
      lifetimeFeesLamports: BigInt(250_000_000_000),
      raw: { source: "mock", note: "Phase 0 seed" },
    },
  });
  console.log("  ✓ Created token fee snapshot");

  // ─── Payout ledger ─────────────────────────────────────────────────────────
  const payouts = [
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: aliceConversion.affiliateId,
      suggestedAmountLamports: BigInt(3_200_000_000),
      status: "pending_review" as const,
    },
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: bobConversion.affiliateId,
      suggestedAmountLamports: BigInt(1_500_000_000),
      status: "pending_review" as const,
    },
    {
      campaignId: CAMPAIGN_ID,
      affiliateId: carolConversion.affiliateId,
      suggestedAmountLamports: BigInt(900_000_000),
      status: "pending_review" as const,
    },
  ];

  for (const payout of payouts) {
    await prisma.payoutLedger.create({ data: payout });
  }
  console.log("  ✓ Created 3 payout ledger entries");

  console.log("\n✅  Demo seed complete!\n");
  console.log("  Campaign ID : demo-campaign-001");
  console.log("  Affiliates  : Alice.sol (ALICE42), Bob.sol (BOB99), Carol.sol (CAROL7)");
  console.log("  Run: pnpm dev → http://localhost:3000\n");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
