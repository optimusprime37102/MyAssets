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

type AssetRow = Omit<Asset, "createdAt" | "updatedAt"> & {
  createdAt?: string;
  updatedAt?: string;
};

export async function POST(req: Request) {
  const nextReq = req as unknown as any;
  if (!checkAssetPassword(nextReq)) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = (await req.json()) as { assets?: AssetRow[] } | AssetRow[];
  const rows = Array.isArray(body) ? body : body?.assets;
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "Invalid import payload" }, { status: 400 });
  }

  let inserted = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const id = typeof (row as any).id === "string" ? String((row as any).id) : undefined;
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const url = typeof row.url === "string" ? row.url.trim() : "";
      const kind = typeof row.kind === "string" ? row.kind : "";
      const category = typeof row.category === "string" ? row.category.trim() : "Unsorted";
      const notes = typeof row.notes === "string" ? row.notes : "";
      const tags = normalizeTags((row as any).tags);
      const favorite = Boolean((row as any).favorite);

      if (!id || !title || !url || !isKind(kind)) continue;

      const createdAt = typeof row.createdAt === "string" ? new Date(row.createdAt) : undefined;
      // updatedAt is handled by Prisma automatically; we don't need it for sorting consistency.

      const exists = await tx.asset.findUnique({ where: { id } });
      if (!exists) inserted++;

      await tx.asset.upsert({
        where: { id },
        create: {
          id,
          title,
          url,
          kind,
          category,
          tags,
          notes,
          favorite,
          ...(createdAt && { createdAt }),
        },
        update: {
          title,
          url,
          kind,
          category,
          tags,
          notes,
          favorite,
        },
      });
    }
  });

  return NextResponse.json({ ok: true, upserted: rows.length, inserted });
}

