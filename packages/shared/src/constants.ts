// ─── Attribution Window ───────────────────────────────────────────────────────

export const DEFAULT_ATTRIBUTION_WINDOW_MINUTES = 1440; // 24 hours

// ─── Attribution Score Modifiers ─────────────────────────────────────────────

export const SCORE_MODIFIERS = {
  VALID_REF_LINK: 20,
  NO_REPEATED_CLICKS: 20,
  WALLET_CONNECT: 25,
  BUY_CLICK: 20,
  ONCHAIN_CANDIDATE: 25,
  SELF_BUY: -30,
  REPEATED_CLICK: -20,
  TINY_BUY: -20,
  ABNORMAL_CONVERSION: -20,
} as const;

// ─── Attribution Confidence Thresholds ───────────────────────────────────────

export const CONFIDENCE_HIGH = 80;
export const CONFIDENCE_MEDIUM = 50;

// ─── Risk Engine ─────────────────────────────────────────────────────────────

export const REPEATED_CLICK_WINDOW_MINUTES = 10;
export const REPEATED_CLICK_THRESHOLD = 10;
export const TINY_BUY_THRESHOLD_LAMPORTS = 1_000_000; // 0.001 SOL
export const ABNORMAL_CONVERSION_RATIO_THRESHOLD = 0.9; // > 90% buy intents from clicks

// Phase 3: burst activity thresholds
export const BURST_WALLET_THRESHOLD = 5; // distinct wallets within burst window
export const BURST_WINDOW_MINUTES = 5; // minutes to consider a burst

// ─── Mock Token ───────────────────────────────────────────────────────────────

export const MOCK_TOKEN_MINT = "MockToken11111111111111111111111111111111111";
export const MOCK_CREATOR_WALLET = "CreatorWallet11111111111111111111111111111111";

// ─── App ──────────────────────────────────────────────────────────────────────

export const APP_NAME = "Bags Partner Attribution OS";
export const APP_TAGLINE =
  "Bags-native partner revenue attribution for creators and KOLs";
