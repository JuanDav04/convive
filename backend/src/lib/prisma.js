// lib/prisma.js
// Única instancia de PrismaClient de toda la app. En Prisma 7 el cliente se
// conecta a través de un "adapter": aquí usamos el de PostgreSQL (pg).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
