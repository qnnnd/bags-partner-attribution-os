/**
 * GET /api/risk/conversion/:id
 *
 * Returns all risk flags for a specific attribution conversion.
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";
import { solscanTxLink } from "@bags/bags-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: conversionId } = await params;

  const conversion = await prisma.attributionConversion.findUnique({
    where: { id: conversionId },
    select: {
      id: true,
      campaignId: true,
      affiliateId: true,
      buyerWallet: true,
      tokenMint: true,
      txSignature: true,
      attributionType: true,
      confidenceScore: true,
      status: true,
      reason: true,
      createdAt: true,
    },
  });
  if (!conversion) {
    return NextResponse.json({ error: "Conversion not found" }, { status: 404 });
  }

  const flags = await prisma.riskFlag.findMany({
    where: { conversionId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    conversion: {
      ...conversion,
      solscanLink: conversion.txSignature ? solscanTxLink(conversion.txSignature) : null,
      createdAt: conversion.createdAt.toISOString(),
    },
    flags: flags.map((f) => ({
      id: f.id,
      riskType: f.riskType,
      severity: f.severity,
      scoreDelta: f.scoreDelta,
      reason: f.reason,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}
