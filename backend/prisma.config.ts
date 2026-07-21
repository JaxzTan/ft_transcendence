import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
  // Prisma 7 reads seed/migration settings from this file only — a `prisma`
  // block in package.json is ignored, which is why `prisma db seed` needs the
  // command declared here rather than alongside the npm scripts.
  migrations: {
    path: "./prisma/migrations",
    seed: "ts-node --transpile-only --project tsconfig.json prisma/seed.ts",
  },
});