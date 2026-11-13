// config/env.js
// Lee y VALIDA las variables de entorno una sola vez al arrancar. Si falta algo
// o es inválido el servidor no arranca y dice exactamente qué corregir (mejor
// que fallar a mitad de una petición con un error confuso).
import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
    CORS_ORIGINS: z.string().default("http://localhost:5173"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
    JWT_EXPIRES_IN: z.string().default("8h"),
    APP_TIMEZONE: z.string().default("America/Bogota"),
    UPLOAD_DIR: z.string().default("uploads"),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
    REINCIDENCE_MIN_CASES: z.coerce.number().int().positive().default(3),
    REINCIDENCE_WINDOW_DAYS: z.coerce.number().int().positive().default(90),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error("Variables de entorno inválidas:");
    for (const issue of parsed.error.issues) {
        console.error(` - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
}

const raw = parsed.data;

export const env = {
    ...raw,
    isProduction: raw.NODE_ENV === "production",
    isTest: raw.NODE_ENV === "test",
    corsOrigins: raw.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
    uploadDir: path.resolve(raw.UPLOAD_DIR),
    maxUploadBytes: Math.round(raw.MAX_UPLOAD_MB * 1024 * 1024),
};
