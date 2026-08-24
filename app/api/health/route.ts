import { NextResponse } from "next/server";
import { getDatabaseUrl, listRelatedEnvKeys } from "@/lib/dbUrl";

export async function GET() {
  return NextResponse.json({
    connected: Boolean(getDatabaseUrl()),
    relatedEnvKeys: listRelatedEnvKeys(),
  });
}
