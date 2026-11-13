// routes/dashboard.js — GET /api/dashboard (ADMIN, COORDINADOR)
// Totales, casos por estado, casos por mes (últimos 12), estudiantes
// reincidentes y casos recientes.
import { CaseStatus, Role } from "@prisma/client";
import { Router } from "express";
import { parseDay, todayDay } from "../lib/dates.js";
import { prisma } from "../lib/prisma.js";
import { WHO, presentCase, presentStudent } from "../lib/presenters.js";
import { recurrentStudents } from "../lib/recurrence.js";
import { authorize } from "../middleware/auth.js";

const router = Router();

// Lista de los últimos 12 meses ["2025-12", ..., "2026-11"] terminando en el mes actual.
function lastMonths(count = 12) {
    const [year, month] = todayDay().split("-").map(Number);

    return Array.from({ length: count }, (_, i) => {
        const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));

        return d.toISOString().slice(0, 7);
    });
}

router.get("/dashboard", authorize(Role.ADMIN, Role.COORDINADOR), async (_req, res) => {
    const months = lastMonths();

    const [students, totalCases, byStatus, monthDates, recurrent, recent] = await Promise.all([
        prisma.student.count({ where: { active: true } }),
        prisma.case.count(),
        prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.case.findMany({ where: { date: { gte: parseDay(`${months[0]}-01`) } }, select: { date: true } }),
        recurrentStudents(),
        prisma.case.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { createdBy: WHO, student: true },
        }),
    ]);

    // Siempre salen los tres estados, aunque no tengan casos.
    const casesByStatus = Object.fromEntries(Object.values(CaseStatus).map((s) => [s, 0]));
    byStatus.forEach((row) => (casesByStatus[row.status] = row._count._all));

    // Contar por mes en JS (volumen de un colegio: unos cientos de filas).
    const counts = new Map(months.map((m) => [m, 0]));
    monthDates.forEach((row) => {
        const key = row.date.toISOString().slice(0, 7);
        if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    });

    const recurrentIds = recurrent.map((r) => r.studentId);
    const recurrentRows = await prisma.student.findMany({ where: { id: { in: recurrentIds } } });
    const byId = new Map(recurrentRows.map((s) => [s.id, s]));

    res.json({
        data: {
            totals: {
                students,
                cases: totalCases,
                openCases: totalCases - casesByStatus[CaseStatus.CERRADO],
            },
            casesByStatus,
            casesByMonth: months.map((month) => ({ month, count: counts.get(month) })),
            recurrentStudents: recurrent.map((r) => ({
                student: presentStudent(byId.get(r.studentId)),
                count: r.count,
            })),
            recentCases: recent.map((c) => ({ ...presentCase(c), student: presentStudent(c.student) })),
        },
    });
});

export default router;
