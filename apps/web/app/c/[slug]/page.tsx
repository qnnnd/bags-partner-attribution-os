import { notFound } from "next/navigation";
import { prisma } from "@bags/db";
import { Nav } from "../../../components/Nav";
import { CampaignTracker } from "./CampaignTracker";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}

export default async function PublicCampaignPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { ref: refCode } = await searchParams;

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      affiliates: { where: { status: "active" }, select: { id: true, displayName: true, refCode: true } },
    },
  });

  if (!campaign || campaign.status === "archived") notFound();

  const matchingAffiliate = campaign.affiliates.find((a) => a.refCode === refCode) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-xl px-6 py-16">
        {/* Campaign header */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Bags Token Campaign
          </span>
          <h1 className="mt-4 text-3xl font-bold text-white">{campaign.name}</h1>
          <p className="mt-2 font-mono text-sm text-[var(--muted)]">
            Token: {campaign.tokenMint.slice(0, 8)}…{campaign.tokenMint.slice(-6)}
          </p>
          {campaign.bagsTokenUrl && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              <a
                href={campaign.bagsTokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-purple-300 transition"
              >
                View on Bags →
              </a>
            </p>
          )}
        </div>

        {/* What is this? */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          <p>
            This is a partner attribution campaign for{" "}
            <span className="text-white">{campaign.name}</span>. When you connect your wallet
            and buy through this link, the referring partner earns credit for their contribution.
          </p>
        </div>

        {/* Tracker (client component) */}
        <CampaignTracker
          campaignId={campaign.id}
          tokenMint={campaign.tokenMint}
          refCode={refCode ?? null}
          bagsTokenUrl={campaign.bagsTokenUrl ?? null}
          affiliateName={matchingAffiliate?.displayName ?? null}
        />

        {/* Attribution notice */}
        <div className="mt-8 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="text-xs text-yellow-500/70">
            Attribution is based on confidence scoring, not 100% verified on-chain proof.
            Attribution window: {campaign.attributionWindowMinutes / 60}h.
          </p>
        </div>
      </main>
    </div>
  );
}
