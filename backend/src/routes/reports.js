// routes/reports.js — datos para los reportes (ADMIN, COORDINADOR)
//   GET /api/reports/course?grade=&group=[&from=&to=]
//   GET /api/reports/student/:id[?from=&to=]
// Devuelve los datos ya filtrados por rango de fechas; el PDF lo arma el frontend.
import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { dayRange } from "../lib/dates.js";
import { findStudentOr404 } from "../lib/access.js";
import { prisma } from "../lib/prisma.js";
import {
    WHO,
    presentAttendance,
    presentCase,
    presentFollowUp,
    presentObservation,
    presentStudent,
} from "../lib/presenters.js";
import { enums, group, idParams, rangeFields, refineRange } from "../lib/schemas.js";
import { authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const staff = authorize(Role.ADMIN, Role.COORDINADOR);

const courseQuery = refineRange(z.object({ grade: enums.grade, group, ...rangeFields }));
const studentQuery = refineRange(z.object(rangeFields));

// Arma el reporte de una lista de estudiantes con UNA consulta por tabla
// (en vez de consultar por cada estudiante).
async function buildReport(students, range) {
    const studentIds = students.map((s) => s.id);
    const date = dayRange(range);

    const [attendance, observations, cases] = await Promise.all([
        prisma.attendance.findMany({
            where: { studentId: { in: studentIds }, date },
            orderBy: { date: "asc" },
        }),
        prisma.observation.findMany({
            where: { studentId: { in: studentIds }, date },
            include: { responsible: WHO },
            orderBy: [{ date: "asc" }, { id: "asc" }],
        }),
        prisma.case.findMany({
            where: { studentId: { in: studentIds }, date },
            include: {
                createdBy: WHO,
                followUps: { where: { date }, include: { responsible: WHO }, orderBy: { id: "asc" } },
            },
            orderBy: [{ date: "asc" }, { id: "asc" }],
        }),
    ]);

    const rows = students.map((student) => {
        const studentCases = cases.filter((c) => c.studentId === student.id);

        return {
            student: presentStudent(student),
            attendance: attendance.filter((a) => a.studentId === student.id).map(presentAttendance),
            observations: observations.filter((o) => o.studentId === student.id).map(presentObservation),
            cases: studentCases.map((c) => ({ ...presentCase(c), followUps: c.followUps.map(presentFollowUp) })),
        };
    });

    return {
        range: { from: range.from ?? null, to: range.to ?? null },
        students: rows,
        totals: {
            students: rows.length,
            attendance: attendance.length,
            observations: observations.length,
            cases: cases.length,
            followUps: cases.reduce((sum, c) => sum + c.followUps.length, 0),
        },
    };
}

router.get("/reports/course", staff, validate({ query: courseQuery }), async (req, res) => {
    const { grade, group, from, to } = req.valid.query;

    const students = await prisma.student.findMany({
        where: { grade, group, active: true },
        orderBy: { fullName: "asc" },
    });

    res.json({ data: { course: { grade, group }, ...(await buildReport(students, { from, to })) } });
});

router.get("/reports/student/:id", staff, validate({ params: idParams, query: studentQuery }), async (req, res) => {
    const student = await findStudentOr404(req.valid.params.id);

    res.json({ data: await buildReport([student], req.valid.query) });
});

export default router;
