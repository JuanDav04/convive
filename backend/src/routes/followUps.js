// routes/followUps.js — seguimientos de un caso (historial cronológico)
//   GET    /api/cases/:id/follow-ups   listar
//   POST   /api/cases/:id/follow-ups   crear (el responsable es quien está logueado)
//   PATCH  /api/follow-ups/:id         editar  (ADMIN/COORD, o su autor)
//   DELETE /api/follow-ups/:id         borrar  (ADMIN/COORD, o su autor)
import { Router } from "express";
import { z } from "zod";
import { findCaseOr404, isStaff } from "../lib/access.js";
import { parseDay, todayDay } from "../lib/dates.js";
import { forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { WHO, presentFollowUp } from "../lib/presenters.js";
import { day, idParams, text } from "../lib/schemas.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const createBody = z.object({ description: text(10000), date: day.optional() });
const patchBody = z.object({ description: text(10000) });

// Busca el seguimiento y comprueba que el usuario pueda modificarlo.
async function findEditable(followUpId, user) {
    const found = await prisma.caseFollowUp.findUnique({ where: { id: followUpId } });

    if (!found) throw notFound("Seguimiento");

    // El caso debe ser visible para el usuario (404 si es de otro docente)...
    await findCaseOr404(found.caseId, user);

    // ...y el docente solo puede tocar los seguimientos que él escribió.
    if (!isStaff(user) && found.responsibleId !== user.id) throw forbidden();

    return found;
}

router.get("/cases/:id/follow-ups", validate({ params: idParams }), async (req, res) => {
    const found = await findCaseOr404(req.valid.params.id, req.user);

    const followUps = await prisma.caseFollowUp.findMany({
        where: { caseId: found.id },
        include: { responsible: WHO },
        orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    res.json({ data: followUps.map(presentFollowUp) });
});

router.post("/cases/:id/follow-ups", validate({ params: idParams, body: createBody }), async (req, res) => {
    const found = await findCaseOr404(req.valid.params.id, req.user);
    const { description, date } = req.valid.body;

    const created = await prisma.caseFollowUp.create({
        data: {
            caseId: found.id,
            description,
            date: parseDay(date ?? todayDay()),
            responsibleId: req.user.id,
        },
        include: { responsible: WHO },
    });

    res.status(201).json({ data: presentFollowUp(created) });
});

router.patch("/follow-ups/:id", validate({ params: idParams, body: patchBody }), async (req, res) => {
    const found = await findEditable(req.valid.params.id, req.user);

    const updated = await prisma.caseFollowUp.update({
        where: { id: found.id },
        data: { description: req.valid.body.description },
        include: { responsible: WHO },
    });

    res.json({ data: presentFollowUp(updated) });
});

router.delete("/follow-ups/:id", validate({ params: idParams }), async (req, res) => {
    const found = await findEditable(req.valid.params.id, req.user);

    await prisma.caseFollowUp.delete({ where: { id: found.id } });

    res.json({ data: { id: found.id } });
});

export default router;
