// routes/attendance.js — asistencia (un solo registro por estudiante por día)
//   GET /api/attendance   por curso (grade+group) o por estudiante (studentId), con rango
//   PUT /api/attendance   guarda el día completo de un curso (crea o actualiza)
// Todos los roles pueden consultar y registrar asistencia.
import { Router } from "express";
import { z } from "zod";
import { dayRange, parseDay } from "../lib/dates.js";
import { badRequest } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { presentAttendance } from "../lib/presenters.js";
import { day, enums, group, id, rangeFields, refineRange } from "../lib/schemas.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const listQuery = refineRange(
    z.object({
        studentId: id.optional(),
        grade: enums.grade.optional(),
        group: group.optional(),
        date: day.optional(), // atajo: from = to = date
        ...rangeFields,
    })
).refine((q) => q.studentId || (q.grade && q.group), {
    message: "Indica studentId, o grade y group",
    path: ["studentId"],
});

const saveBody = z.object({
    date: day,
    records: z
        .array(z.object({ studentId: id, status: enums.attendanceStatus }))
        .min(1, "Marca la asistencia de al menos un estudiante")
        .max(200),
});

router.get("/attendance", validate({ query: listQuery }), async (req, res) => {
    const { studentId, grade, group, date, from, to } = req.valid.query;

    const records = await prisma.attendance.findMany({
        where: {
            ...(studentId ? { studentId } : { student: { grade, group } }),
            date: dayRange(date ? { from: date, to: date } : { from, to }),
        },
        orderBy: [{ date: "asc" }, { studentId: "asc" }],
    });

    res.json({ data: records.map(presentAttendance) });
});

router.put("/attendance", validate({ body: saveBody }), async (req, res) => {
    const { date, records } = req.valid.body;

    // Si un estudiante viene repetido, gana el último valor.
    const byStudent = new Map(records.map((r) => [r.studentId, r.status]));
    const ids = [...byStudent.keys()];

    const valid = await prisma.student.findMany({
        where: { id: { in: ids }, active: true },
        select: { id: true },
    });

    if (valid.length !== ids.length) {
        const known = new Set(valid.map((s) => s.id));

        throw badRequest("Hay estudiantes inexistentes o inactivos.", {
            studentIds: ids.filter((i) => !known.has(i)),
        });
    }

    const when = parseDay(date);

    // Todo o nada: si algo falla a la mitad no queda el día guardado a medias.
    const saved = await prisma.$transaction(
        [...byStudent].map(([studentId, status]) =>
            prisma.attendance.upsert({
                where: { studentId_date: { studentId, date: when } },
                create: { studentId, date: when, status, registeredBy: req.user.id },
                update: { status, registeredBy: req.user.id },
            })
        )
    );

    res.json({ data: saved.map(presentAttendance) });
});

export default router;
