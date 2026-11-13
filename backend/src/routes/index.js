// routes/index.js
// Arma el router de /api. El ORDEN importa: lo que está antes de
// router.use(authenticate) es público (health y login); todo lo de después
// exige un token válido.
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import attendance from "./attendance.js";
import auth from "./auth.js";
import cases from "./cases.js";
import commitments from "./commitments.js";
import dashboard from "./dashboard.js";
import documents from "./documents.js";
import followUps from "./followUps.js";
import observations from "./observations.js";
import reports from "./reports.js";
import students from "./students.js";
import users from "./users.js";

const router = Router();

// ── Públicas ───────────────────────────────────────────────
router.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ data: { status: "ok", database: "up", time: new Date().toISOString() } });
    } catch {
        res.status(503).json({ message: "Base de datos no disponible." });
    }
});

router.use(auth); // /auth/login es público; /auth/me exige token (lo pide la propia ruta)

// ── Protegidas ─────────────────────────────────────────────
router.use(authenticate);

for (const r of [users, students, cases, followUps, commitments, observations, attendance, documents, dashboard, reports]) {
    router.use(r);
}

export default router;
