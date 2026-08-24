import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma 7 reads the connection URL from prisma.config.ts (not schema.prisma).
    // For local dev / builds you can keep this dummy; production must set DATABASE_URL.
    url:
      process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.POSTGRES_URL ??
      process.env.STORAGE_PRISMA_URL ??
      process.env.STORAGE_URL ??
      "postgresql://postgres:postgres@localhost:5432/postgres",
  },
});

