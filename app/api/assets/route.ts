import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAssetPassword, unauthorizedResponse } from "@/lib/apiAuth";
import { KINDS, Kind, type Asset } from "@/lib/types";
import { SEED_ASSETS } from "@/lib/seed";
import { ensureDb } from "@/lib/ensureDb";
import { randomUUID } from "crypto";

function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((t) => typeof t === "string") as string[];
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ assets: SEED_ASSETS });
  }

  await ensureDb();

  const assets = await prisma.asset.findMany({
    orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
  });

  if (assets.length === 0) {
    await prisma.asset.createMany({
      data: SEED_ASSETS.map((a) => ({
        id: a.id,
        title: a.title,
        url: a.url,
        kind: a.kind as any,
        category: a.category,
        tags: a.tags,
        notes: a.notes,
        favorite: a.favorite,
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.updatedAt),
      })),
      skipDuplicates: true,
    });
  }

  const assets2 = await prisma.asset.findMany({
    orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({
    assets: assets2.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
}

type AssetCreate = Omit<Asset, "createdAt" | "updatedAt">;

export async function POST(req: Request) {
  const nextReq = req as unknown as any;
  if (!checkAssetPassword(nextReq)) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  await ensureDb();

  const body = (await req.json()) as Partial<AssetCreate> & { id?: string };
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const category = typeof body.category === "string" ? body.category.trim() : "Unsorted";
  const notes = typeof body.notes === "string" ? body.notes : "";
  const tags = normalizeTags(body.tags);
  const favorite = Boolean(body.favorite);

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });
  if (!isKind(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const id =
    typeof (body as any).id === "string" && (body as any).id
      ? String((body as any).id)
      : randomUUID();

  const created = await prisma.asset.create({
    data: {
      id,
      title,
      url,
      kind,
      category,
      tags,
      notes,
      favorite,
    },
  });

  return NextResponse.json({
    asset: {
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}

