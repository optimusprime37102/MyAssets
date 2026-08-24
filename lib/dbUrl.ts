const URL_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
  "STORAGE_PRISMA_URL",
  "STORAGE_URL_NON_POOLING",
  "STORAGE_URL",
  "NEON_DATABASE_URL",
] as const;

const PART_PREFIXES = ["POSTGRES", "STORAGE", "PG", "NEON"] as const;

function isDbUrl(value: string) {
  return (
    value.startsWith("postgres://") ||
    value.startsWith("postgresql://") ||
    value.startsWith("prisma://") ||
    value.startsWith("prisma+postgres://")
  );
}

function fromParts(prefix: string) {
  const user = process.env[`${prefix}_USER`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`];
  const host = process.env[`${prefix}_HOST`]?.trim();
  const database =
    process.env[`${prefix}_DATABASE`]?.trim() ||
    process.env[`${prefix}_DB`]?.trim();
  if (!user || !host || !database || password === undefined) return undefined;
  const encoded = encodeURIComponent(password);
  return `postgresql://${user}:${encoded}@${host}/${database}?sslmode=require`;
}

export function getDatabaseUrl() {
  for (const key of URL_KEYS) {
    const value = process.env[key]?.trim().replace(/^['"]|['"]$/g, "");
    if (!value) continue;
    // PrismaPg needs a direct TCP URL, not Prisma Accelerate.
    if (value.startsWith("prisma://") || value.startsWith("prisma+postgres://")) {
      continue;
    }
    if (isDbUrl(value) && !value.includes("db.example.com")) {
      return value;
    }
  }

  for (const prefix of PART_PREFIXES) {
    const built = fromParts(prefix);
    if (built) return built;
  }

  return undefined;
}

export function listRelatedEnvKeys() {
  return Object.keys(process.env)
    .filter((key) =>
      /DATABASE|POSTGRES|STORAGE|NEON|^PG_/i.test(key),
    )
    .sort();
}
