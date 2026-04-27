import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Phase 1 Full Tracking Flow", () => {
  let campaignId: string;
  let campaignSlug: string;
  let affiliateRefCode: string;

  test("1 - Dev login as creator", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/dev-login`, {
      data: {},
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("creator");
    expect(body.walletAddress).toBeTruthy();
  });

  test("2 - Create a campaign", async ({ request }) => {
    // Login first
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });

    const res = await request.post(`${BASE}/api/campaigns`, {
      data: {
        name: "E2E Test Campaign",
        tokenMint: "So11111111111111111111111111111111111111112",
        bagsTokenUrl: "https://bags.fm/token/So11111111111111111111111111111111111111112",
        attributionWindowMinutes: 1440,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.slug).toMatch(/^e2e-test-campaign-/);
    campaignId = body.id;
    campaignSlug = body.slug;
  });

  test("3 - Add 3 affiliates to the campaign", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    expect(campaignId).toBeTruthy();

    for (const name of ["Alice.sol", "Bob.sol", "Charlie.sol"]) {
      const wallet = `Test${name.replace(".", "")}11111111111111111111111111111111111111`;
      const res = await request.post(`${BASE}/api/campaigns/${campaignId}/affiliates`, {
        data: { walletAddress: wallet, displayName: name },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.refCode).toHaveLength(8);
      if (name === "Alice.sol") affiliateRefCode = body.refCode;
    }
  });

  test("4 - Affiliates have unique ref_codes", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    expect(campaignId).toBeTruthy();

    const res = await request.get(`${BASE}/api/campaigns/${campaignId}/affiliates`);
    expect(res.status()).toBe(200);
    const affiliates: Array<{ refCode: string }> = await res.json();
    const codes = affiliates.map((a) => a.refCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  test("5 - Navigate to ref link → visit event is recorded", async ({ request }) => {
    expect(campaignId).toBeTruthy();
    expect(affiliateRefCode).toBeTruthy();

    const sessionId = `e2e-session-${Date.now()}`;
    const res = await request.post(`${BASE}/api/tracking/visit`, {
      data: { campaignId, sessionId, refCode: affiliateRefCode },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.eventType).toBe("visit");
    expect(body.sessionId).toBe(sessionId);
    expect(body.eventId).toBeTruthy();
  });

  test("6 - Buy on Bags → buy_click and outbound_to_bags events recorded", async ({
    request,
  }) => {
    expect(campaignId).toBeTruthy();
    const sessionId = `e2e-buy-${Date.now()}`;

    // First visit
    await request.post(`${BASE}/api/tracking/visit`, {
      data: { campaignId, sessionId, refCode: affiliateRefCode },
    });

    // Then buy_click
    const buyClickRes = await request.post(`${BASE}/api/tracking/buy-click`, {
      data: {
        campaignId,
        sessionId,
        refCode: affiliateRefCode,
        walletAddress: "TestBuyer11111111111111111111111111111111111",
      },
    });
    expect(buyClickRes.status()).toBe(201);
    expect((await buyClickRes.json()).eventType).toBe("buy_click");

    // Then outbound
    const outboundRes = await request.post(`${BASE}/api/tracking/outbound-to-bags`, {
      data: { campaignId, sessionId, refCode: affiliateRefCode },
    });
    expect(outboundRes.status()).toBe(201);
    expect((await outboundRes.json()).eventType).toBe("outbound_to_bags");
  });

  test("7 - Affiliate promo link API returns correct URL", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    expect(campaignId).toBeTruthy();

    const affiliatesRes = await request.get(`${BASE}/api/campaigns/${campaignId}/affiliates`);
    const affiliates: Array<{ id: string; refCode: string }> = await affiliatesRes.json();
    const alice = affiliates[0]!;

    const linkRes = await request.get(`${BASE}/api/affiliates/${alice.id}/link`);
    expect(linkRes.status()).toBe(200);
    const { promoUrl, refCode } = await linkRes.json();
    expect(promoUrl).toContain(`/c/${campaignSlug}?ref=${alice.refCode}`);
    expect(refCode).toBe(alice.refCode);
  });

  test("8 - Leaderboard shows affiliate event counts", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    expect(campaignId).toBeTruthy();

    const res = await request.get(
      `${BASE}/api/attribution/campaign/${campaignId}/leaderboard`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("live");
    expect(Array.isArray(body.entries)).toBe(true);
    // We've recorded visits + buy_clicks for Alice's refCode
    const alice = body.entries.find((e: { refCode: string }) => e.refCode === affiliateRefCode);
    expect(alice).toBeTruthy();
    expect(alice.clicks).toBeGreaterThan(0);
  });

  test("9 - Activate campaign via API", async ({ request }) => {
    await request.post(`${BASE}/api/auth/dev-login`, { data: {} });
    expect(campaignId).toBeTruthy();

    const res = await request.post(`${BASE}/api/campaigns/${campaignId}/activate`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("active");
  });

  test("10 - Public campaign page renders", async ({ page }) => {
    expect(campaignSlug).toBeTruthy();
    await page.goto(`${BASE}/c/${campaignSlug}?ref=${affiliateRefCode}`);
    await expect(page.locator("h1")).toContainText("E2E Test Campaign");
    await expect(page.locator("[data-testid=buy-on-bags-btn]")).toBeVisible();
  });
});
