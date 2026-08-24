import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAssetPassword, unauthorizedResponse } from "@/lib/apiAuth";
import { ensureDb } from "@/lib/ensureDb";
import { getDatabaseUrl } from "@/lib/dbUrl";

export async function POST(req: Request) {
  const nextReq = req as unknown as any;
  if (!checkAssetPassword(nextReq)) return unauthorizedResponse();

  if (!getDatabaseUrl()) {
    return NextResponse.json(
      {
        error:
          "Database is not connected. In Vercel go to Storage, connect Neon/Postgres, then redeploy.",
      },
      { status: 503 },
    );
  }

  await ensureDb();

  // optional safety: confirm payload
  const body = await req.json().catch(() => ({} as any));
  if (body && body.confirm !== true) {
    return NextResponse.json({ error: "Missing confirm: true" }, { status: 400 });
  }

  await prisma.asset.deleteMany({});
  return NextResponse.json({ ok: true });
}

