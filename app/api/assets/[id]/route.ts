import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAssetPassword, unauthorizedResponse } from "@/lib/apiAuth";
import { KINDS, Kind, type Asset } from "@/lib/types";

function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((t) => typeof t === "string") as string[];
}

type AssetUpdate = Partial<Omit<Asset, "id" | "createdAt" | "updatedAt">> & { id?: string };

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const nextReq = req as unknown as any;
  if (!checkAssetPassword(nextReq)) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const id = (await ctx.params).id;
  const body = (await req.json()) as AssetUpdate;

  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const url = typeof body.url === "string" ? body.url.trim() : undefined;
  const kind = typeof body.kind === "string" ? body.kind : undefined;
  const category = typeof body.category === "string" ? body.category.trim() : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const tags = body.tags !== undefined ? normalizeTags(body.tags) : undefined;
  const favorite = body.favorite !== undefined ? Boolean(body.favorite) : undefined;

  if (kind !== undefined && !isKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (title !== undefined && !title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (url !== undefined && !url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const updated = await prisma.asset.update({
    where: { id },
    data: {
      title,
      url,
      kind,
      category: category ?? undefined,
      notes,
      tags,
      favorite,
    },
  });

  return NextResponse.json({
    asset: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const nextReq = req as unknown as any;
  if (!checkAssetPassword(nextReq)) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const id = (await ctx.params).id;
  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

