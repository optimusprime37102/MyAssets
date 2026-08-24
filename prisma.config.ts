import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma 7 reads the connection URL from prisma.config.ts (not schema.prisma).
    // For local dev / builds you can keep this dummy; production must set DATABASE_URL.
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/postgres",
  },
});

