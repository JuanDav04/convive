// routes/observations.js — observaciones por estudiante
//   GET    /api/students/:id/observations   listar (DOCENTE solo ve las suyas)
//   POST   /api/students/:id/observations   crear
//   DELETE /api/observations/:id            borrar (ADMIN/COORD, o su autor)
import { Router } from "express";
import { z } from "zod";
import { findStudentOr404, isStaff } from "../lib/access.js";
import { dayRange, parseDay, todayDay } from "../lib/dates.js";
import { notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { WHO, presentObservation } from "../lib/presenters.js";
import { day, enums, idParams, rangeFields, refineRange, text } from "../lib/schemas.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const listQuery = refineRange(z.object(rangeFields));
const createBody = z.object({
    type: enums.observationType,
    description: text(5000),
    date: day.optional(),
});

router.get("/students/:id/observations", validate({ params: idParams, query: listQuery }), async (req, res) => {
    const student = await findStudentOr404(req.valid.params.id);

    const observations = await prisma.observation.findMany({
        where: {
            studentId: student.id,
            // Confidencialidad: el docente ve solo lo que él escribió.
            ...(!isStaff(req.user) && { responsibleId: req.user.id }),
            date: dayRange(req.valid.query),
        },
        include: { responsible: WHO },
        orderBy: [{ date: "desc" }, { id: "desc" }],
    });

    res.json({ data: observations.map(presentObservation) });
});

router.post("/students/:id/observations", validate({ params: idParams, body: createBody }), async (req, res) => {
    const student = await findStudentOr404(req.valid.params.id);
    const { type, description, date } = req.valid.body;

    const created = await prisma.observation.create({
        data: {
            studentId: student.id,
            type,
            description,
            date: parseDay(date ?? todayDay()),
            responsibleId: req.user.id,
        },
        include: { responsible: WHO },
    });

    res.status(201).json({ data: presentObservation(created) });
});

router.delete("/observations/:id", validate({ params: idParams }), async (req, res) => {
    const found = await prisma.observation.findUnique({ where: { id: req.valid.params.id } });

    // Solo staff o su autor pueden borrarla. Para un docente, la observación de
    // otro se ve igual que una inexistente (404): no se revela que existe.
    if (!found || (!isStaff(req.user) && found.responsibleId !== req.user.id)) {
        throw notFound("Observación");
    }

    await prisma.observation.delete({ where: { id: found.id } });

    res.json({ data: { id: found.id } });
});

export default router;
