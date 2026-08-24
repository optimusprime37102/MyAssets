import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAssetPassword, unauthorizedResponse } from "@/lib/apiAuth";

export async function POST(req: Request) {
  const nextReq = req as unknown as any;
  if (!checkAssetPassword(nextReq)) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  // optional safety: confirm payload
  const body = await req.json().catch(() => ({} as any));
  if (body && body.confirm !== true) {
    return NextResponse.json({ error: "Missing confirm: true" }, { status: 400 });
  }

  await prisma.asset.deleteMany({});
  return NextResponse.json({ ok: true });
}

