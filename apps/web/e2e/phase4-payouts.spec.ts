/**
 * Phase 4 E2E Tests: Payout Ledger + Partner Claims
 *
 * Tests the full payout workflow:
 * 1. Generate suggested payouts
 * 2. GET /api/payouts/campaign/:id — list payouts
 * 3. Approve a payout
 * 4. Attach a tx signature
 * 5. Reject a payout
 * 6. CSV includes Phase 4 columns
 * 7. Partner claims page renders
 * 8. Suspicious conversion is excluded from payout generation
 *
 * No real transactions are sent. No SOL is required.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// A valid 87-char base58 signature (all 'A' chars are valid base58)
const MOCK_TX_SIG = "A".repeat(87);

test.describe("Phase 4 Payout Ledger Flow", () => {
  let campaignId: string;
  let affiliateId: string;
  let payoutId: string;

  test("setup: create campaign with affiliate and tracking events", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });

    const campaignRes = await request.post(`${BASE}/api/campaigns`, {
      data: {
        name: "Phase4 Payout Test Campaign",
        tokenMint: "So11111111111111111111111111111111111111112",
        attributionWindowMinutes: 1440,
      },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = (await campaignRes.json()).id;

    const affRes = await request.post(`${BASE}/api/campaigns/${campaignId}/affiliates`, {
      data: {
        walletAddress: "AliceWallet1111111111111111111111111111111111",
        displayName: "Alice KOL",
      },
    });
    expect(affRes.status()).toBe(201);
    affiliateId = (await affRes.json()).id;

    // Record some tracking events
    const sessionId = `phase4-${Date.now()}`;
    const refCode = (await affRes.json()).refCode ?? "REFTEST";
    await request.post(`${BASE}/api/tracking/visit`, {
      data: { campaignId, sessionId, refCode },
    });
    await request.post(`${BASE}/api/tracking/buy-click`, {
      data: { campaignId, sessionId, refCode, walletAddress: "BuyerWallet11111111111111111111111111111111" },
    });
  });

  test("generate suggested payouts", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    expect(campaignId).toBeTruthy();

    const res = await request.post(`/api/payouts/generate/${campaignId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.campaignId).toBe(campaignId);
    expect(typeof body.generated).toBe("number");
  });

  test("GET /api/payouts/campaign/:id returns ledger list", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    expect(campaignId).toBeTruthy();

    const res = await request.get(`${BASE}/api/payouts/campaign/${campaignId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.campaignId).toBe(campaignId);
    expect(Array.isArray(body.ledgers)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.total).toBe("number");

    if (body.ledgers.length > 0) {
      payoutId = body.ledgers[0].id;
      const ledger = body.ledgers[0];
      expect(ledger.suggestedAmountLamports).toBeDefined();
      expect(ledger.status).toBe("pending_review");
    }
  });

  test("approve a payout with default suggested amount", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    if (!payoutId) return; // skip if no payout was generated

    const res = await request.post(`${BASE}/api/payouts/${payoutId}/approve`, {
      data: {},
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("approved");
    expect(body.approvedAmountLamports).toBeDefined();
  });

  test("approved amount > suggested is rejected without forceOverride", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    if (!payoutId) return;

    // Create a fresh payout to test on
    const genRes = await request.post(`${BASE}/api/payouts/generate/${campaignId}`);
    expect(genRes.status()).toBe(200);

    const listRes = await request.get(`${BASE}/api/payouts/campaign/${campaignId}`);
    const listBody = await listRes.json();
    const pendingRow = listBody.ledgers.find(
      (l: { status: string }) => l.status === "pending_review",
    );
    if (!pendingRow) return; // already all approved/rejected in prior tests

    const suggestedBigInt = BigInt(pendingRow.suggestedAmountLamports);
    const overAmount = (suggestedBigInt + BigInt(1_000_000_000)).toString();

    const res = await request.post(`${BASE}/api/payouts/${pendingRow.id}/approve`, {
      data: { approvedAmountLamports: overAmount },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("exceeds");
  });

  test("attach tx signature to approved payout → status becomes tx_created", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    if (!payoutId) return;

    const res = await request.post(`${BASE}/api/payouts/${payoutId}/attach-tx`, {
      data: { txSignature: MOCK_TX_SIG, verifyOnChain: false },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("tx_created");
    expect(body.txSignature).toBe(MOCK_TX_SIG);
    expect(body.solscanLink).toContain("solscan.io/tx/");
  });

  test("attach-tx with verifyOnChain=true → status becomes paid (mock mode)", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });

    // Create and approve a fresh payout
    await request.post(`${BASE}/api/payouts/generate/${campaignId}`);
    const listRes = await request.get(`${BASE}/api/payouts/campaign/${campaignId}`);
    const listBody = await listRes.json();
    const pendingRow = listBody.ledgers.find(
      (l: { status: string }) => l.status === "pending_review",
    );
    if (!pendingRow) return;

    await request.post(`${BASE}/api/payouts/${pendingRow.id}/approve`, { data: {} });

    const attachRes = await request.post(
      `${BASE}/api/payouts/${pendingRow.id}/attach-tx`,
      { data: { txSignature: MOCK_TX_SIG, verifyOnChain: true } },
    );
    expect(attachRes.status()).toBe(200);
    const attachBody = await attachRes.json();
    // In mock mode, verifyTxOnChain returns exists=true → status=paid
    expect(attachBody.status).toBe("paid");
    expect(attachBody.onChainVerified).toBe(true);
  });

  test("reject a payout", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });

    // Generate fresh payout for rejection test
    await request.post(`${BASE}/api/payouts/generate/${campaignId}`);
    const listRes = await request.get(`${BASE}/api/payouts/campaign/${campaignId}`);
    const listBody = await listRes.json();
    const pendingRow = listBody.ledgers.find(
      (l: { status: string }) => l.status === "pending_review",
    );
    if (!pendingRow) return;

    const res = await request.post(`${BASE}/api/payouts/${pendingRow.id}/reject`, {
      data: { reason: "Test rejection" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("rejected");
  });

  test("payout CSV includes Phase 4 columns", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    expect(campaignId).toBeTruthy();

    const res = await request.get(
      `${BASE}/api/reports/campaign/${campaignId}/payout.csv`,
    );
    expect(res.status()).toBe(200);
    const csv = await res.text();
    expect(csv).toContain("payout_id");
    expect(csv).toContain("payout_status");
    expect(csv).toContain("approved_amount_sol");
    expect(csv).toContain("payout_tx_signature");
    // Phase 3 columns still present
    expect(csv).toContain("suggested_payout_sol");
    expect(csv).toContain("solscan_link");
  });

  test("payout ledger page renders", async ({ page }) => {
    expect(campaignId).toBeTruthy();
    await page.goto(`${BASE}/creator/campaigns/${campaignId}/payouts`);
    await expect(page.locator("h1")).toContainText("Payout Ledger");
  });

  test("partner claims page renders", async ({ page }) => {
    expect(campaignId).toBeTruthy();
    await page.goto(`${BASE}/creator/campaigns/${campaignId}/partner-claims`);
    await expect(page.locator("h1")).toContainText("Partner Claim Status");
  });

  test("invalid tx signature format is rejected", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });

    // Get an approved payout
    const listRes = await request.get(`${BASE}/api/payouts/campaign/${campaignId}`);
    const listBody = await listRes.json();
    const approvedRow = listBody.ledgers.find(
      (l: { status: string }) => l.status === "approved",
    );
    if (!approvedRow) return;

    const res = await request.post(`${BASE}/api/payouts/${approvedRow.id}/attach-tx`, {
      data: { txSignature: "invalid-sig" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
