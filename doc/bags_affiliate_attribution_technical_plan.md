# Bags Affiliate Attribution Network 技术方案

版本：v1.0  
日期：2026-04-27  
目标：面向 The Bags Hackathon 的阶段化开发方案。每个阶段可独立开发、独立测试、独立验收；高风险功能放在最后阶段，避免影响参赛交付。

---

## 0. 作品定位

项目名称建议：**Bags Partner Attribution OS**

一句话定位：

> Bags Partner Attribution OS is a Bags-native partner revenue attribution layer. It connects campaign links, wallet identity, partner keys, Bags fee sharing, partner stats, and on-chain fee data to help creators understand which KOLs and channels generate real long-term token revenue.

中文定位：

> Bags Partner Attribution OS 是 Bags 原生的 partner revenue attribution layer。它把推广链接、钱包身份、partner key、Bags fee sharing、partner stats 和链上 fee 数据连接起来，帮助 creator 判断哪些 KOL / 渠道真正带来了长期 token 收益。

---

## 1. 核心原则

### 1.1 必须坚持的产品边界

本作品不是普通 affiliate tracking，不以点击量、UV、转化率作为主要价值。

必须围绕以下 Bags-native 能力开发：

1. Bags token mint
2. Bags partner key / partner config
3. Bags fee sharing
4. Partner claimed / unclaimed fees
5. Token lifetime fees
6. Token claim events
7. Wallet intent
8. Attribution confidence score
9. Risk flag
10. Payout report

### 1.2 禁止在 MVP 中承诺的能力

MVP 不承诺：

1. 100% 证明某笔 buy 一定来自某个 KOL；
2. 自动给 KOL 打款；
3. 完整女巫识别；
4. 大规模 KOL marketplace；
5. 多触点复杂归因；
6. 后端托管用户私钥。

MVP 使用表述：

> confidence-based attribution candidate

不要使用表述：

> 100% verified affiliate conversion

---

## 2. 官方能力依据

### 2.1 Bags 网络依据

Bags 官方 SDK / 文档示例中，launch token、create partner key、claim partner fees 等真实流程均使用：

```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

因此本项目的 Bags 真实数据集成网络定为：

> **Solana mainnet-beta**

### 2.2 Bags 能力依据

官方文档已支持以下能力：

| 能力 | 本项目用途 |
|---|---|
| Create Partner Key | 为 affiliate / partner 建立可获得 fee share 的 partner config |
| Partner Config PDA | 识别 partner fee 配置 |
| Partner Claim Stats | 查询 claimed / unclaimed partner fees |
| Claim Partner Fees | 后期阶段用于 partner fee claim |
| Launch Token with fee sharing | 证明 partner config 可进入 token launch fee sharing |
| Token Lifetime Fees | 计算 token 总收入基础 |
| Token Claim Events | 构建 fee / claim 时间线 |
| Solana RPC | 查询钱包、交易、token activity |

---

## 3. 网络策略

### 3.1 总体选择

| 环境 | 网络 | 是否写链 | 用途 |
|---|---|---:|---|
| 本地开发 | Mock / 本地数据库 | 否 | 前端、后端、归因、风控、报表开发 |
| 单元测试 | Mock Bags API + Mock Solana RPC | 否 | CI 可重复测试 |
| 集成测试 | Solana mainnet-beta 只读 | 否 | 读取真实 Bags token / partner stats / fee 数据 |
| 钱包签名测试 | 本地钱包签名 / 可选 Solana devnet | 可选 | 仅测试通用签名流程，不测试 Bags 专属写链 |
| 黑客松 Demo | Solana mainnet-beta 只读 + 预置 tracking 数据 | 否，默认不现场写链 | 稳定演示 |
| 后期主网写操作 | Solana mainnet-beta | 是，手动触发 | 创建 partner key、claim、payout 等高风险功能 |

### 3.2 为什么不把 devnet 作为核心测试网

原因：Affiliate Attribution 的核心价值来自 Bags fee sharing、partner stats、token lifetime fees、claim events。若只在 devnet 或纯模拟环境展示，容易被评委认为是 Web2 affiliate 工具。

所以：

1. 核心读数据必须接 mainnet-beta；
2. 开发和自动化测试使用 mock；
3. Bags 写链放后置阶段，并且只手动执行；
4. Demo 不依赖现场主网写操作。

### 3.3 主网写操作保护规则

所有 mainnet-beta 写操作必须满足：

1. 默认关闭；
2. 独立脚本执行，不进入 CI；
3. 需要 `ENABLE_MAINNET_WRITE=true`；
4. 需要二次确认参数；
5. 不使用后端托管用户私钥；
6. 优先前端钱包签名；
7. 每次写操作保存 tx signature；
8. Demo 时不现场执行 claim / payout。

---

## 4. 技术栈

### 4.1 推荐技术栈

为降低 AI 开发复杂度，推荐 TypeScript 单语言优先：

| 模块 | 技术 |
|---|---|
| Monorepo | pnpm workspace / Turborepo |
| 前端 | Next.js App Router + React + Tailwind CSS |
| API | Next.js Route Handlers 或 NestJS |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| Bags 集成 | Bags TypeScript SDK / REST API 封装 |
| Solana | @solana/web3.js |
| 钱包登录 | Solana wallet adapter + message signing |
| 后台任务 | Node.js worker + cron |
| 测试 | Vitest + Playwright |
| 部署 | Vercel + Supabase / Neon Postgres |
| 报表 | CSV 导出，PDF 可后置 |

### 4.2 为什么不优先 Java 后端

可以用 Java Spring Boot，但 Bags 官方示例和 SDK 以 TypeScript 集成为主。黑客松阶段为了减少跨语言和 SDK 封装风险，建议先用 TypeScript 完成全栈。赛后如需长期维护，再迁移 Java 后端。

---

## 5. 系统架构

```text
User Browser
  ├─ Creator Dashboard
  ├─ Affiliate Dashboard
  └─ Public Campaign Landing Page
        │
        ▼
Next.js API / Backend
  ├─ Auth Service
  ├─ Campaign Service
  ├─ Tracking Service
  ├─ Wallet Link Service
  ├─ Bags Sync Service
  ├─ Attribution Engine
  ├─ Risk Engine
  ├─ Report Service
  └─ Optional Payout Service
        │
        ├──────── PostgreSQL
        │
        ├──────── Bags API / Bags SDK
        │
        └──────── Solana RPC mainnet-beta
```

---

## 6. 仓库结构

```text
bags-partner-attribution-os/
  apps/
    web/
      app/
        page.tsx
        login/page.tsx
        creator/dashboard/page.tsx
        creator/campaigns/page.tsx
        creator/campaigns/[id]/page.tsx
        affiliate/dashboard/page.tsx
        c/[slug]/page.tsx
        api/
          auth/
          campaigns/
          affiliates/
          tracking/
          bags/
          attribution/
          risk/
          reports/
      components/
      lib/
      tests/
  packages/
    db/
      prisma/schema.prisma
      src/client.ts
    bags-client/
      src/index.ts
      src/mock.ts
      src/mainnet.ts
    attribution-engine/
      src/index.ts
      src/scoring.ts
      src/types.ts
    risk-engine/
      src/index.ts
      src/rules.ts
      src/types.ts
    shared/
      src/types.ts
      src/constants.ts
  workers/
    sync-worker/
      src/index.ts
      src/syncPartnerStats.ts
      src/syncTokenFees.ts
  scripts/
    seed-demo.ts
    check-mainnet-read.ts
    create-partner-key-mainnet.ts
    claim-partner-fees-mainnet.ts
    generate-demo-fixtures.ts
  docs/
    demo-script.md
    api.md
    testing.md
  .env.example
  package.json
  pnpm-workspace.yaml
```

---

## 7. 数据库设计

### 7.1 核心表

#### users

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 用户 ID |
| wallet_address | text unique | 登录钱包 |
| role | enum | creator / affiliate / admin |
| display_name | text nullable | 显示名 |
| created_at | timestamp | 创建时间 |

#### wallet_sessions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | session ID |
| wallet_address | text | 钱包地址 |
| nonce | text | 签名 nonce |
| signed_message | text | 钱包签名消息 |
| expires_at | timestamp | 过期时间 |
| created_at | timestamp | 创建时间 |

#### campaigns

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | campaign ID |
| creator_wallet | text | creator 钱包 |
| token_mint | text | Bags token mint |
| name | text | 活动名称 |
| slug | text unique | URL slug |
| bags_token_url | text nullable | Bags token 页面 |
| attribution_window_minutes | int | 默认 1440 |
| status | enum | draft / active / paused / archived |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

#### affiliates

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | affiliate ID |
| campaign_id | uuid | campaign ID |
| wallet_address | text | KOL / affiliate 钱包 |
| display_name | text | KOL 名称 |
| ref_code | text | 推广码 |
| partner_wallet | text nullable | partner wallet |
| partner_config_pda | text nullable | partner config PDA |
| status | enum | invited / active / paused |
| created_at | timestamp | 创建时间 |

#### tracking_events

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | event ID |
| campaign_id | uuid | campaign ID |
| affiliate_id | uuid nullable | affiliate ID |
| event_type | enum | visit / share / wallet_connect / buy_click / outbound_to_bags |
| session_id | text | 浏览器 session |
| wallet_address | text nullable | 用户钱包 |
| token_mint | text | token mint |
| ref_code | text nullable | 推广码 |
| ip_hash | text nullable | IP hash |
| user_agent_hash | text nullable | UA hash |
| metadata | jsonb | 额外信息 |
| created_at | timestamp | 创建时间 |

#### attribution_conversions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | conversion ID |
| campaign_id | uuid | campaign ID |
| affiliate_id | uuid | affiliate ID |
| buyer_wallet | text nullable | 买家钱包 |
| token_mint | text | token mint |
| tx_signature | text nullable | 链上交易签名 |
| attribution_type | enum | click / wallet_intent / onchain_candidate / confirmed |
| confidence_score | int | 0-100 |
| attributed_volume_lamports | bigint nullable | 归因交易量 |
| status | enum | candidate / confirmed / suspicious / rejected |
| reason | text | 归因理由 |
| created_at | timestamp | 创建时间 |

#### partner_fee_snapshots

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | snapshot ID |
| campaign_id | uuid nullable | campaign ID |
| affiliate_id | uuid nullable | affiliate ID |
| partner_wallet | text | partner 钱包 |
| partner_config_pda | text nullable | partner config PDA |
| claimed_fees_lamports | bigint | 已领取 fees |
| unclaimed_fees_lamports | bigint | 未领取 fees |
| raw | jsonb | Bags 原始返回 |
| snapshot_at | timestamp | 快照时间 |

#### token_fee_snapshots

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | snapshot ID |
| token_mint | text | token mint |
| lifetime_fees_lamports | bigint nullable | lifetime fees |
| raw | jsonb | Bags 原始返回 |
| snapshot_at | timestamp | 快照时间 |

#### risk_flags

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | flag ID |
| campaign_id | uuid | campaign ID |
| affiliate_id | uuid nullable | affiliate ID |
| conversion_id | uuid nullable | conversion ID |
| risk_type | enum | self_buy / repeated_click / tiny_buy / abnormal_conversion / new_wallet / burst_activity / multi_wallet_pattern |
| severity | enum | low / medium / high |
| score_delta | int | 风险扣分 |
| reason | text | 说明 |
| created_at | timestamp | 创建时间 |

#### payout_ledgers

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | payout ID |
| campaign_id | uuid | campaign ID |
| affiliate_id | uuid | affiliate ID |
| currency | text | SOL / USDC |
| suggested_amount_lamports | bigint | 建议 payout |
| approved_amount_lamports | bigint nullable | creator 审批金额 |
| status | enum | pending_review / approved / tx_created / paid / rejected |
| tx_signature | text nullable | 支付交易签名 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

---

## 8. API 设计

### 8.1 Auth

```http
POST /api/auth/nonce
POST /api/auth/verify-signature
GET  /api/auth/me
POST /api/auth/logout
```

### 8.2 Campaign

```http
POST   /api/campaigns
GET    /api/campaigns
GET    /api/campaigns/:id
PATCH  /api/campaigns/:id
POST   /api/campaigns/:id/activate
POST   /api/campaigns/:id/pause
```

### 8.3 Affiliate

```http
POST   /api/campaigns/:id/affiliates
GET    /api/campaigns/:id/affiliates
PATCH  /api/affiliates/:affiliateId
GET    /api/affiliates/:affiliateId/link
```

### 8.4 Tracking

```http
POST /api/tracking/visit
POST /api/tracking/share
POST /api/tracking/wallet-connect
POST /api/tracking/buy-click
POST /api/tracking/outbound-to-bags
```

### 8.5 Bags Sync

```http
POST /api/bags/sync/token-fees
POST /api/bags/sync/partner-stats
GET  /api/bags/token/:mint/fees
GET  /api/bags/partner/:wallet/stats
```

### 8.6 Attribution

```http
POST /api/attribution/recompute/:campaignId
GET  /api/attribution/campaign/:campaignId/leaderboard
GET  /api/attribution/campaign/:campaignId/conversions
```

### 8.7 Risk

```http
POST /api/risk/recompute/:campaignId
GET  /api/risk/campaign/:campaignId
GET  /api/risk/conversion/:conversionId
```

### 8.8 Report

```http
GET /api/reports/campaign/:campaignId/summary
GET /api/reports/campaign/:campaignId/payout.csv
GET /api/reports/campaign/:campaignId/attribution.csv
```

### 8.9 Optional Payout

```http
POST /api/payouts/generate/:campaignId
POST /api/payouts/:payoutId/approve
POST /api/payouts/:payoutId/attach-tx
GET  /api/payouts/campaign/:campaignId
```

---

## 9. 归因模型

### 9.1 三层归因

| 层级 | 名称 | 判断依据 | 可信度 |
|---|---|---|---:|
| L1 | Click Attribution | 用户访问 ref link | 低 |
| L2 | Wallet Intent Attribution | 用户连接钱包并点击 Buy | 中 |
| L3 | On-chain Candidate Attribution | 同钱包在时间窗口内发生目标 token 买入 | 高 |

### 9.2 MVP scoring

```text
score = 0

+20: 访问有效 ref link
+20: session 没有异常重复点击
+25: 连接钱包
+20: 点击 Buy / outbound to Bags
+25: 时间窗口内检测到目标 token 交易候选
-30: buyer wallet == affiliate wallet
-20: 同 IP/UA 短时间重复事件过多
-20: 极小金额刷单候选
-20: affiliate 转化率异常

score >= 80: high-confidence candidate
score >= 50: medium-confidence candidate
score < 50: low-confidence candidate
命中 high risk: suspicious
```

### 9.3 Last-touch 规则

MVP 使用 last-touch：

1. 同一 session 多次点击不同 KOL 链接，归因给最后一次有效点击；
2. 同一 wallet 在 24 小时内多次点击不同 KOL 链接，归因给最近一次 wallet intent；
3. 被 risk engine 标记为 high-risk 的转化不进入 suggested payout。

---

## 10. 风控模型

### 10.1 MVP 规则

| 规则 | 触发条件 | 处理 |
|---|---|---|
| self_buy | affiliate wallet == buyer wallet | high risk，扣 30 |
| repeated_click | 同 IP hash + UA hash 10 分钟内超过阈值 | medium risk，扣 20 |
| abnormal_conversion | 点击极少但 buy intent 极高 | medium risk，扣 20 |
| tiny_buy | 多个极小金额 candidate | medium risk，扣 20 |
| burst_activity | 多钱包在极短时间集中触发 | medium / high risk |
| missing_wallet | 只有 click，没有 wallet intent | 不计入 high confidence |

### 10.2 输出格式

```json
{
  "riskLevel": "medium",
  "riskScore": 42,
  "flags": [
    {
      "type": "repeated_click",
      "severity": "medium",
      "reason": "Same IP hash and user agent triggered 18 visits in 10 minutes."
    }
  ]
}
```

---

## 11. Bags 集成方案

### 11.1 Bags Client 抽象

必须先做接口抽象，避免前端和业务逻辑直接依赖 Bags SDK。

```ts
export interface BagsClient {
  getTokenLifetimeFees(tokenMint: string): Promise<TokenFeeStats>;
  getTokenClaimEvents(tokenMint: string): Promise<TokenClaimEvent[]>;
  getPartnerConfig(partnerWallet: string): Promise<PartnerConfig | null>;
  getPartnerClaimStats(partnerWallet: string): Promise<PartnerClaimStats>;
  createPartnerKeyTx?(partnerWallet: string): Promise<SerializedTx>;
  getPartnerClaimTxs?(partnerWallet: string): Promise<SerializedTx[]>;
}
```

### 11.2 两种实现

```text
MockBagsClient
  - 本地开发
  - CI 测试
  - Demo fallback

MainnetBagsClient
  - mainnet-beta 只读同步
  - 手动 smoke test
  - 黑客松 demo 数据刷新
```

### 11.3 环境变量

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=http://localhost:3000
BAGS_API_KEY=xxx
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BAGS_NETWORK=mainnet-beta
BAGS_CLIENT_MODE=mock|mainnet-readonly
ENABLE_MAINNET_WRITE=false
DEMO_SEED_ENABLED=true
SESSION_SECRET=xxx
HASH_SALT=xxx
```

---

## 12. 阶段化开发方案

## 阶段 0：项目骨架与 Mock 数据闭环

### 目标

建立项目可运行基础，不接任何真实链上服务。

### 功能

1. Monorepo 初始化；
2. Next.js 页面骨架；
3. Prisma + PostgreSQL；
4. MockBagsClient；
5. demo seed 数据；
6. 基础 UI：Dashboard、Campaign List、Campaign Detail。

### 网络

| 类型 | 选择 |
|---|---|
| 开发网络 | 本地 Mock |
| 测试网络 | 本地 Mock |
| 是否需要 SOL | 否 |
| 是否需要 Bags API Key | 否 |

### 测试要求

1. `pnpm test` 可通过；
2. `pnpm db:migrate` 可通过；
3. `pnpm seed:demo` 可生成演示 campaign、affiliate、tracking event；
4. 页面可展示 mock attribution leaderboard。

### 验收标准

1. 本地启动后可进入 Creator Dashboard；
2. 能看到一个 mock campaign；
3. 能看到 3 个 mock affiliates；
4. 能看到 clicks / buy intents / estimated fees；
5. 不需要任何外部 API。

---

## 阶段 1：Campaign + Affiliate + Tracking 完整闭环

### 目标

完成 Web2 tracking 层，但明确它只是 attribution 输入，不作为最终价值。

### 功能

#### Creator 端

1. 钱包签名登录；
2. 创建 campaign；
3. 绑定 token mint；
4. 添加 affiliate；
5. 生成 ref link；
6. 查看 tracking events。

#### Public Campaign Page

1. `/c/{slug}?ref={refCode}`；
2. 记录 visit；
3. 记录 share；
4. 支持连接钱包；
5. 记录 wallet_connect；
6. 点击 Buy on Bags；
7. 记录 buy_click；
8. 跳转 Bags token 页面。

#### Affiliate 端

1. 钱包登录；
2. 查看自己的推广链接；
3. 查看自己的 clicks / wallet connects / buy intents。

### 网络

| 类型 | 选择 |
|---|---|
| 开发网络 | 本地 Mock |
| 测试网络 | 本地 Mock |
| 钱包签名 | 本地钱包签名即可 |
| 是否需要 SOL | 否 |
| 是否需要 Bags API Key | 否 |

### 测试要求

#### 单元测试

1. ref code 生成唯一；
2. campaign slug 生成唯一；
3. tracking event 正确入库；
4. wallet signature verify 正确；
5. session_id 正确关联多事件。

#### E2E 测试

1. creator 创建 campaign；
2. creator 添加 3 个 affiliates；
3. 打开 KOL A 链接；
4. 记录 visit；
5. 连接钱包；
6. 点击 Buy；
7. campaign detail 中可看到事件增长。

### 验收标准

阶段 1 完成后，作品已经可以演示：

> creator 创建活动 → KOL 获得链接 → 用户点击 → 钱包连接 → buy intent 记录 → affiliate leaderboard 更新。

但此时还不能宣称 Bags-native，只能作为 tracking layer。

---

## 阶段 2：Bags mainnet-beta 只读集成 + Revenue Attribution MVP

### 目标

接入真实 Bags 数据，让作品从 Web2 tracking 升级为 Bags-native partner revenue attribution。

### 功能

1. MainnetBagsClient；
2. 查询 token lifetime fees；
3. 查询 partner config；
4. 查询 partner claimed / unclaimed fees；
5. 保存 partner_fee_snapshots；
6. 保存 token_fee_snapshots；
7. attribution leaderboard 合并 tracking + partner stats；
8. payout report CSV；
9. Demo 数据刷新按钮。

### 网络

| 类型 | 选择 |
|---|---|
| 开发网络 | Mock + mainnet-beta read-only 可切换 |
| 测试网络 | CI 使用 Mock；手动集成测试使用 mainnet-beta read-only |
| 是否写链 | 否 |
| 是否需要 SOL | 否 |
| 是否需要 Bags API Key | 是 |
| 是否需要 Solana RPC | 是 |

### 测试要求

#### 单元测试

1. MockBagsClient 返回固定 token fees；
2. MockBagsClient 返回固定 partner stats；
3. attribution leaderboard 正确合并 clicks、buy intents、claimed fees、unclaimed fees；
4. CSV report 字段正确。

#### 集成测试

手动执行：

```bash
BAGS_CLIENT_MODE=mainnet-readonly pnpm script:check-mainnet-read
```

测试内容：

1. 使用真实 token mint 查询数据；
2. 使用真实或已准备 partner wallet 查询 partner stats；
3. 只读测试不能发交易；
4. 失败时可 fallback 到 demo fixture。

### 验收标准

阶段 2 完成后，作品可以作为黑客松可提交 MVP。

必须能演示：

1. 创建 campaign；
2. 添加 affiliate；
3. 生成 ref link；
4. 记录 visit / buy intent；
5. 同步真实 Bags token fee / partner stats；
6. 展示 attribution leaderboard；
7. 导出 payout report。

### 阶段 2 演示话术

> We combine off-chain campaign intent with on-chain Bags partner fee data. This is not just click tracking; it estimates which affiliates drive real partner revenue for a Bags token.

---

## 阶段 3：On-chain Buy Candidate 检测 + Risk Flag

### 目标

增强归因可信度，但仍不承诺 100% proof。

### 功能

1. 通过 Solana RPC 查询 buyer wallet 的目标 token activity；
2. 在 attribution window 内匹配 token buy candidate；
3. 保存 tx_signature；
4. 生成 Solscan link；
5. 实现 MVP risk engine；
6. 标记 suspicious conversion；
7. risk review 页面；
8. attribution confidence explanation。

### 网络

| 类型 | 选择 |
|---|---|
| 开发网络 | Mock RPC + fixtures |
| 测试网络 | Mock RPC；手动 mainnet-beta read-only |
| 是否写链 | 否 |
| 是否需要 SOL | 否 |
| 是否需要 Bags API Key | 是，若同步 Bags 数据 |
| 是否需要 RPC | 是 |

### 测试要求

#### 单元测试

1. last-touch attribution 正确；
2. attribution window 正确；
3. self_buy 风险正确触发；
4. repeated_click 风险正确触发；
5. tiny_buy 风险正确触发；
6. risk flag 会降低 confidence score；
7. suspicious 不进入 suggested payout。

#### 集成测试

1. 使用固定钱包 fixture；
2. 读取 mainnet-beta 交易历史；
3. 匹配 token mint；
4. 生成 tx link；
5. 不发交易。

### 验收标准

阶段 3 完成后，作品竞争力明显增强。

必须能展示：

1. Click Attribution；
2. Wallet Intent Attribution；
3. On-chain Candidate Attribution；
4. Risk Flag；
5. Confidence Score；
6. Solscan Link；
7. Payout report 自动排除 suspicious conversion。

---

## 阶段 4：Creator Approval + Partner Claim Status + Manual Payout Ledger

### 目标

加入结算流程，但不自动打款，不托管私钥。

### 功能

1. creator 审核 payout report；
2. 修改 approved payout；
3. 生成 payout ledger；
4. payout 状态流转：pending_review → approved → tx_created → paid / rejected；
5. 手动录入 tx signature；
6. 校验 tx signature 是否存在；
7. partner claim status 页面；
8. claim recommendation：提示 affiliate 是否有 unclaimed fees。

### 网络

| 类型 | 选择 |
|---|---|
| 开发网络 | Mock |
| 测试网络 | Mock + mainnet-beta read-only 校验 tx |
| 是否写链 | 否 |
| 是否需要 SOL | 否 |
| 是否需要 Bags API Key | 是 |
| 是否需要 RPC | 是 |

### 测试要求

1. creator 可审批 payout；
2. approved amount 不可超过 suggested amount，除非手动确认；
3. rejected payout 不进入 paid report；
4. tx signature 格式校验；
5. partner claim stats 可刷新；
6. report 能导出 payout ledger。

### 验收标准

阶段 4 完成后，作品具备完整业务闭环：

> tracking → attribution → risk → revenue → payout review → report

但仍不承担自动资金操作风险。

---

## 阶段 5：主网写操作，手动触发版

### 目标

支持真实 Bags 写操作，但全部放在手动脚本或前端钱包签名，不进入核心 demo 依赖。

### 功能

1. 创建 partner key；
2. 查询 partner config PDA；
3. claim partner fees；
4. claim token fees；
5. 生成 unsigned transaction；
6. 前端钱包签名；
7. 保存 tx signature；
8. 展示链上执行结果。

### 网络

| 类型 | 选择 |
|---|---|
| 开发网络 | 不开发写链 mock 以外的真实写操作 |
| 测试网络 | mainnet-beta，手动，小额，低频 |
| 是否写链 | 是 |
| 是否需要 SOL | 是 |
| 是否需要 Bags API Key | 是 |
| 是否进入 CI | 否 |
| 是否作为 Demo 必需 | 否 |

### 安全要求

1. 不在后端保存 PRIVATE_KEY；
2. `.env.example` 可以出现变量名，但真实私钥不得提交；
3. mainnet 写脚本必须检测 `ENABLE_MAINNET_WRITE=true`；
4. 每次写操作前打印操作摘要；
5. 每次写操作后保存 tx signature；
6. 出错时不自动重试多次；
7. claim 交易顺序必须严格执行。

### 测试要求

手动测试 checklist：

1. 准备测试钱包；
2. 钱包中有少量 SOL；
3. 创建 partner key；
4. 复制 partner config PDA；
5. 查询 partner claim stats；
6. 若有可 claim fees，再手动 claim；
7. 保存 Solscan link；
8. 将截图或 tx link 放入 demo fixtures。

### 验收标准

阶段 5 完成后，可以在 README 中写：

> Supports mainnet partner key creation and partner fee claim through manual wallet-signed flows.

不能写：

> Fully automated affiliate payout network.

---

## 阶段 6：不建议黑客松阶段实现，但完整保留的高风险功能

本阶段是赛后扩展，不作为黑客松交付前置条件。

---

### 6.1 自动 payout

#### 目标

creator 审核后，系统生成 payout transaction，由 creator 钱包签名完成 SOL / USDC 付款。

#### 技术方案

1. payout_ledgers 中 status = approved；
2. 后端生成 payout intent；
3. 前端读取 payout intent；
4. creator 钱包签名；
5. 广播交易；
6. 保存 tx signature；
7. 后端通过 RPC 确认交易；
8. status 更新为 paid。

#### 禁止方案

1. 后端托管 creator 私钥；
2. 后端自动无限额转账；
3. affiliate 自己触发 payout；
4. 未经 creator 审核自动打款。

#### 测试网络

| 类型 | 选择 |
|---|---|
| 通用转账开发 | Solana devnet |
| Bags 相关真实 payout | mainnet-beta，手动小额 |
| CI | Mock transaction |

---

### 6.2 多触点归因模型

#### 目标

支持 first-touch、last-touch、linear、time-decay、自定义分成。

#### 技术方案

新增表：`attribution_models`

| 字段 | 说明 |
|---|---|
| id | model ID |
| campaign_id | campaign ID |
| model_type | last_touch / first_touch / linear / time_decay / custom |
| config | jsonb |
| enabled | boolean |

归因流程：

1. 读取同一 wallet / session 的所有 touchpoints；
2. 过滤 attribution window 外事件；
3. 按 model_type 计算权重；
4. 生成多条 attribution_conversion_splits；
5. payout report 按 split 聚合。

新增表：`attribution_conversion_splits`

| 字段 | 说明 |
|---|---|
| id | split ID |
| conversion_id | conversion ID |
| affiliate_id | affiliate ID |
| weight_bps | 权重，10000 = 100% |
| reason | 分配原因 |

#### 测试要求

1. last-touch 与 MVP 结果一致；
2. first-touch 可正确归给最早 KOL；
3. linear 权重总和 = 10000 bps；
4. time-decay 越接近 buy 权重越高；
5. suspicious touchpoint 不参与分配。

---

### 6.3 完整 Sybil / Fraud Graph

#### 目标

识别批量钱包、自买、共同资金来源、刷量网络。

#### 技术方案

新增数据：

1. wallet first seen time；
2. wallet transaction count；
3. wallet token holding history；
4. common funder；
5. shared IP hash；
6. shared UA hash；
7. timing cluster；
8. buy amount cluster。

新增表：`wallet_risk_profiles`

| 字段 | 说明 |
|---|---|
| wallet_address | 钱包 |
| first_seen_at | 首次出现时间 |
| tx_count | 交易数 |
| funding_source | 资金来源 |
| risk_score | 风险分 |
| raw | jsonb |

新增规则：

1. common_funder_cluster；
2. new_wallet_burst；
3. identical_amount_cluster；
4. same_affiliate_only_wallet；
5. affiliate_self_funded_wallet。

#### 测试要求

1. 构造 10 个同源钱包 fixture；
2. 风险模型能识别 cluster；
3. 不直接拒绝，只标记 suspicious；
4. creator 可以手动 override。

---

### 6.4 KOL Marketplace

#### 目标

让 creator 发现 KOL，让 KOL 申请 campaign。

#### 技术方案

新增页面：

1. Marketplace；
2. KOL Profile；
3. Campaign Application；
4. Creator Review；
5. Historical Performance。

新增表：`affiliate_profiles`

| 字段 | 说明 |
|---|---|
| wallet_address | KOL 钱包 |
| handle | X / Telegram handle |
| categories | 类型 |
| historical_clicks | 历史点击 |
| historical_conversions | 历史转化 |
| historical_revenue | 历史 revenue |
| risk_level | 风险等级 |

#### 风险

该功能前端和产品复杂度高，容易稀释 Bags-native 核心，不建议黑客松阶段做。

---

### 6.5 多签 / 金库 / Spending Limit

#### 目标

让 creator 将 payout 资金放入金库，由规则控制支出上限。

#### 技术方案

1. 创建 treasury config；
2. 设置 payout budget；
3. 设置 per-affiliate cap；
4. 设置 daily cap；
5. 设置 require approval threshold；
6. 生成 transaction proposal；
7. 多签确认；
8. 执行 payout。

#### 数据表：`treasury_configs`

| 字段 | 说明 |
|---|---|
| id | treasury ID |
| creator_wallet | creator |
| treasury_address | 金库地址 |
| daily_cap_lamports | 单日上限 |
| per_affiliate_cap_lamports | 单 affiliate 上限 |
| approval_threshold | 审批阈值 |
| status | active / paused |

#### 测试要求

1. 本地 mock proposal；
2. devnet 测试通用转账 proposal；
3. mainnet 只手动小额；
4. 黑客松阶段不作为核心 demo。

---

## 13. 阶段优先级

| 阶段 | 是否黑客松必须 | 价值 | 风险 | 结论 |
|---|---:|---:|---:|---|
| 阶段 0 | 是 | 中 | 低 | 必做 |
| 阶段 1 | 是 | 中 | 低 | 必做 |
| 阶段 2 | 是 | 高 | 中 | 必做，MVP 核心 |
| 阶段 3 | 强烈建议 | 高 | 中 | 加分项 |
| 阶段 4 | 可选 | 中高 | 中 | 时间够再做 |
| 阶段 5 | 可选 | 高 | 高 | 不作为 demo 依赖 |
| 阶段 6 | 否 | 高 | 很高 | 赛后功能 |

黑客松最低提交版本：阶段 0 + 1 + 2。  
有竞争力版本：阶段 0 + 1 + 2 + 3。  
更完整版本：阶段 0 + 1 + 2 + 3 + 4。  
不建议为了阶段 5 / 6 牺牲阶段 2 / 3 的稳定性。

---

## 14. Demo 数据要求

### 14.1 必需准备

| 资源 | 用途 |
|---|---|
| Bags API Key | 查询 Bags 数据 |
| Solana RPC URL | 查询 mainnet-beta |
| 1 个真实 Bags token mint | 作为 campaign token |
| 1 个 creator wallet | 创建 campaign |
| 2-3 个 affiliate wallet | 演示 KOL 对比 |
| 预置 tracking events | 保证 demo 稳定 |
| partner stats fixture | API 不稳定时 fallback |
| token fee snapshot fixture | API 不稳定时 fallback |

### 14.2 强烈建议准备

| 资源 | 用途 |
|---|---|
| partner key / partner config PDA | 证明 Bags-native fee sharing |
| Solscan tx link | 证明链上真实性 |
| 2-3 条真实交易候选 | 演示 on-chain candidate |
| payout CSV | 展示商业闭环 |
| risk flag 样例 | 展示反作弊能力 |

### 14.3 不要求现场发生

1. 现场创建 partner key；
2. 现场 claim partner fees；
3. 现场真实买入；
4. 现场自动 payout。

---

## 15. Demo 流程

1. Creator 钱包登录；
2. 创建 campaign；
3. 绑定真实 Bags token mint；
4. 添加 3 个 affiliates；
5. 系统生成 3 个 ref links；
6. 打开 KOL A 链接；
7. 模拟用户连接钱包；
8. 点击 Buy on Bags；
9. 系统记录 buy intent；
10. 同步 Bags mainnet-beta partner stats / token fees；
11. Leaderboard 显示 clicks、buy intents、fee contribution、confidence score；
12. 展示 suspicious flag；
13. 导出 payout report；
14. 展示 Solscan link 或 partner stats source。

---

## 16. 测试总清单

### 16.1 CI 必跑

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:migrate:test
pnpm playwright:test
```

### 16.2 单元测试覆盖

1. campaign 创建；
2. affiliate 创建；
3. ref link 生成；
4. tracking event 入库；
5. wallet signature verify；
6. attribution scoring；
7. last-touch attribution；
8. risk rules；
9. payout report；
10. Bags mock client。

### 16.3 集成测试覆盖

1. Mainnet read-only token fee sync；
2. Mainnet read-only partner stats sync；
3. RPC tx lookup；
4. Solscan link generation；
5. API fallback fixture。

### 16.4 手动测试覆盖

1. 使用新 campaign；
2. 使用 3 个 affiliate；
3. 模拟 10 条 visit；
4. 模拟 3 条 wallet connect；
5. 模拟 2 条 buy intent；
6. 同步真实 Bags 数据；
7. 生成 leaderboard；
8. 生成 payout CSV；
9. 触发 self-buy risk；
10. 验证 suspicious 不进入 payout。

---

## 17. 费用与资源

### 17.1 必要成本

| 项目 | 是否付费 | 说明 |
|---|---:|---|
| DoraHacks 报名 | 未确认收费 | 当前未看到报名收费要求 |
| GitHub | 否 | 免费可用 |
| Vercel | 可免费 | MVP 可用免费额度 |
| PostgreSQL | 可免费 | Supabase / Neon 可用免费额度 |
| Bags API Key | 未确认收费 | 需要申请 / 获取 |
| Solana RPC | 可免费 | 可用公共 RPC，稳定性不足可换付费 RPC |
| mainnet-beta 写交易 | 是 | 创建 partner key、claim、launch、trade 需要少量 SOL |

### 17.2 建议预算策略

1. 阶段 0-4 不需要 SOL；
2. 阶段 5 才需要少量 SOL；
3. Demo 不依赖现场花费；
4. 所有真实写链操作提前完成并保存 tx link；
5. 不做自动 payout，避免资金风险。

---

## 18. AI 开发执行顺序

按以下顺序给 AI 开发，不要跳阶段：

1. 生成 monorepo + Next.js + Prisma；
2. 实现数据库 schema；
3. 实现 seed demo；
4. 实现 Creator Dashboard；
5. 实现 Campaign CRUD；
6. 实现 Affiliate CRUD；
7. 实现 public ref link tracking；
8. 实现 wallet connect event；
9. 实现 buy click event；
10. 实现 MockBagsClient；
11. 实现 attribution leaderboard；
12. 实现 MainnetBagsClient read-only；
13. 实现 token fee sync；
14. 实现 partner stats sync；
15. 实现 payout CSV；
16. 实现 on-chain candidate 检测；
17. 实现 risk engine；
18. 实现 risk review 页面；
19. 实现 manual payout ledger；
20. 最后再实现 mainnet write scripts。

---

## 19. README 必须写清楚的边界

README 中必须写：

```text
This project provides confidence-based attribution by combining off-chain campaign intent with on-chain Bags partner fee data. It does not claim to prove every buy source with 100% certainty.
```

README 中不要写：

```text
We fully prove every purchase came from a specific influencer.
```

README 中必须强调：

1. Bags-native；
2. Partner revenue attribution；
3. Fee sharing；
4. Partner stats；
5. Risk flags；
6. Payout report；
7. Mainnet read-only demo；
8. No backend custody。

---

## 20. 最终交付清单

黑客松提交前必须有：

1. GitHub repo；
2. README；
3. `.env.example`；
4. deployed web URL；
5. demo video；
6. demo token mint；
7. demo campaign；
8. 2-3 个 affiliates；
9. tracking demo data；
10. Bags mainnet-beta fee / partner stats 截图或页面；
11. payout CSV；
12. risk flag 演示；
13. 技术架构说明；
14. 不托管私钥说明；
15. limitations 说明。

---

## 21. 最终建议

黑客松阶段建议交付到阶段 3：

> Campaign tracking + wallet intent + Bags mainnet-beta partner stats + attribution leaderboard + risk flag + payout report。

阶段 4 如果时间允许再做。  
阶段 5 和阶段 6 不要影响核心交付。

核心判断：

> 这个作品能做，但必须把真实 Bags fee / partner stats 放进 MVP。只做点击统计，不够；做成 partner revenue attribution，才有竞争力。

---

## 22. 参考来源

1. Bags API Documentation - Program IDs: https://docs.bags.fm/principles/program-ids
2. Bags API Documentation - Create Partner Key: https://docs.bags.fm/how-to-guides/create-partner-key
3. Bags API Documentation - Claim Partner Fees: https://docs.bags.fm/how-to-guides/claim-partner-fees
4. Bags API Documentation - Launch a Token: https://docs.bags.fm/how-to-guides/launch-token
5. The Bags Hackathon: https://dorahacks.io/hackathon/the-bags-hackathon/detail
6. 用户上传文件：bags_hackathon_conversation_summary.md
