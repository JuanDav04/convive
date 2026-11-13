// prisma.config.ts — Prisma 7 ya no lee la URL desde schema.prisma: va aquí.
// dotenv/config carga .env (sin pisar variables que ya estén en el entorno,
// por eso en pruebas basta con exportar DATABASE_URL apuntando a la BD "test").
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
