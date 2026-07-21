import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "prisma/config";

// The Prisma CLI runs outside the compiled app, where src/secrets.ts isn't on
// disk in the runtime image — hence this inline read instead of an import.
// Same convention: <SECRETS_DIR>/<var name lowercased>.txt.
function secret(name: string): string | undefined {
  const dir = process.env.SECRETS_DIR ?? "/secrets";
  for (const base of [dir, join(process.cwd(), "..", "secrets")]) {
    try {
      const value = readFileSync(join(base, `${name.toLowerCase()}.txt`), "utf8").trim();
      if (value) return value;
    } catch {
      // try next location
    }
  }
  return process.env[name];
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // env-first: docker-entrypoint.sh exports the container-correct URL.
    // The secrets file is the host-side (localhost) fallback. See prisma.service.ts.
    url: process.env["DATABASE_URL"] || secret("DATABASE_URL"),
  },
  // Prisma 7 reads seed/migration settings from this file only — a `prisma`
  // block in package.json is ignored, which is why `prisma db seed` needs the
  // command declared here rather than alongside the npm scripts.
  migrations: {
    path: "./prisma/migrations",
    seed: "ts-node --transpile-only --project tsconfig.json prisma/seed.ts",
  },
});