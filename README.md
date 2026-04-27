# Bags Partner Attribution OS

An open-source, confidence-based affiliate attribution system for Solana token launches on [Bags](https://bags.fm).

---

## Important Disclaimers

- **Confidence-based attribution only** — scores indicate likelihood of a valid referral, not 100% verified proof of conversion.
- **Not a verified conversion proof system** — on-chain buy candidates are detected heuristically; attribution cannot be claimed as legally conclusive.
- **No backend private key custody** — this platform never holds, stores, or manages private keys.
- **No automatic payout** — all payouts require manual creator approval and off-platform wallet-signed transactions.
- **Mainnet read-only by default** — all Solana RPC and Bags API calls are read-only. Write operations require `ENABLE_MAINNET_WRITE=true` and a dedicated manual script.
- **Suspicious conversions excluded from suggested payout** — high-risk flagged affiliates are automatically excluded from payout generation.
- **Demo / CI mode uses fixture fallback** — when `BAGS_ENABLE_FIXTURE_FALLBACK=true` or `BAGS_CLIENT_MODE=mock`, data comes from local fixtures, not mainnet. The UI labels fixture-sourced data accordingly.

---

## Architecture

```
bags-partner-attribution-os/
├── apps/
│   └── web/                   # Next.js 15 App Router (creator + public campaign pages)
├── packages/
│   ├── attribution-engine/    # Scoring, last-touch dedup, attribution types
│   ├── bags-client/           # BagsClient interface + MockBagsClient + MainnetBagsClient
│   ├── db/                    # Prisma schema + migrations (PostgreSQL)
│   ├── risk-engine/           # Risk flag rules (self_buy, repeated_click, burst_activity, …)
│   └── shared/                # Shared types and constants
└── scripts/                   # Mainnet read-check, seed scripts
```

**Stack:** pnpm workspaces · Turborepo · Next.js 15 · Prisma · PostgreSQL · Tailwind CSS · iron-session · @noble/ed25519

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL (local or Docker)

### Setup

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, SESSION_SECRET, HASH_SALT at minimum

# Generate Prisma client
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Seed demo data
pnpm seed:demo

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

In mock mode (`BAGS_CLIENT_MODE=mock`), use **Dev Login** on the sign-in page. No Phantom wallet required.

For real wallet sign-in, install [Phantom](https://phantom.com/) and set `BAGS_CLIENT_MODE=mainnet-readonly`.

---

## Environment Variables

See `.env.example` for all variables. Key ones:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BAGS_CLIENT_MODE` | `mock` (local/CI) or `mainnet-readonly` (real data) |
| `NEXT_PUBLIC_BAGS_CLIENT_MODE` | Must match `BAGS_CLIENT_MODE` — controls client-side UI gating |
| `BAGS_API_KEY` | Bags API key (required for mainnet-readonly) |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `SESSION_SECRET` | ≥32-char secret for iron-session cookie encryption |
| `HASH_SALT` | Salt for IP/UA hashing (privacy) |
| `ENABLE_MAINNET_WRITE` | Must stay `false` — safety guard against accidental writes |

---

## Attribution Model (Phases 0–4)

### Confidence Score

| Signal | Points |
|---|---|
| Valid ref link visit | +20 |
| No repeated-click anomaly | +20 |
| Wallet connected | +25 |
| Buy click recorded | +20 |
| On-chain buy candidate detected | +25 |
| Self-buy penalty | −30 |
| Repeated-click penalty | −20 |

### Attribution Types

- **Click** — visitor clicked ref link only
- **WalletIntent** — wallet connected + buy click recorded
- **OnchainCandidate** — on-chain token activity detected in wallet within attribution window

### Risk Rules

| Rule | Severity | Trigger |
|---|---|---|
| `self_buy` | High | Buyer wallet = affiliate wallet |
| `repeated_click` | Medium | Same IP+UA > threshold in 10 min |
| `tiny_buy` | Medium | Attributed volume below minimum |
| `abnormal_conversion` | Medium | Buy-intent/click ratio > threshold |
| `burst_activity` | Medium/High | > 5 distinct wallets in 5 min burst window |
| `missing_wallet` | Low | Clicks but no wallet connection |

High-risk affiliates are automatically excluded from suggested payouts.

---

## Payout Workflow

1. Creator opens **Payout Ledger** → clicks **Generate Suggested Payouts**
2. System creates `pending_review` entries (suspicious affiliates excluded)
3. Creator reviews and **Approves** (optionally adjusting the amount)
4. Creator executes the transfer manually from their wallet (off-platform)
5. Creator pastes the transaction signature → system validates format + optionally verifies on-chain
6. Status transitions: `pending_review` → `approved` → `tx_created` → `paid`

**No private keys required. No automatic transfers. Read-only mainnet.**

---

## Development

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript
pnpm test        # Vitest unit tests
pnpm e2e         # Playwright end-to-end tests
```

---

## Phases

| Phase | Description | Status |
|---|---|---|
| 0 | Monorepo, Prisma, MockBagsClient, seed demo, basic dashboard | ✅ |
| 1 | Wallet login (Phantom), campaigns, affiliates, ref links, tracking events | ✅ |
| 2 | MainnetBagsClient, token fees, partner config snapshots, leaderboard, CSV | ✅ |
| 3 | On-chain buy candidates, attribution window, risk engine, risk review page | ✅ |
| 4 | Payout ledger, creator approval, manual tx signature, partner claim status | ✅ |
| 5 | On-chain claim execution (manual wallet-signed) | 🔜 |
| 6 | Automated monitoring, alerts, advanced analytics | 🔜 |

---

## License

MIT
