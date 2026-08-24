import type { NextRequest } from "next/server";

export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export function checkAssetPassword(req: NextRequest) {
  const expected = process.env.ASSET_PASSWORD;
  // In dev (or if you forget the env var), allow writes.
  if (!expected) return true;
  const given = req.headers.get("x-asset-password");
  return given === expected;
}

