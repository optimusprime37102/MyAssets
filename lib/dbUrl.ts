const URL_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
  "STORAGE_PRISMA_URL",
  "STORAGE_URL_NON_POOLING",
  "STORAGE_URL",
  "NEON_DATABASE_URL",
] as const;

export function getDatabaseUrl() {
  for (const key of URL_KEYS) {
    const value = process.env[key]?.trim();
    if (
      value &&
      (value.startsWith("postgres://") || value.startsWith("postgresql://"))
    ) {
      return value;
    }
  }
  return undefined;
}
