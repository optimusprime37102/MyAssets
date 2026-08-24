import { prisma } from "./prisma";
import { getDatabaseUrl } from "./dbUrl";

let schemaReady: Promise<void> | null = null;

export async function ensureDb() {
  if (!getDatabaseUrl()) return;
  if (!schemaReady) {
    schemaReady = createSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function createSchema() {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "Kind" AS ENUM ('component', 'inspiration', 'web', 'mobile', 'toolkit');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Asset" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "kind" "Kind" NOT NULL,
      "category" TEXT NOT NULL,
      "tags" TEXT[] NOT NULL,
      "notes" TEXT NOT NULL,
      "favorite" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
    );
  `);
}
