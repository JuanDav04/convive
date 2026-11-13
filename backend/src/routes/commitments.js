// routes/commitments.js — compromisos de un caso
//   GET    /api/cases/:id/commitments   listar (todos los roles, según visibilidad del caso)
//   POST   /api/cases/:id/commitments   crear      (ADMIN, COORDINADOR)
//   PATCH  /api/commitments/:id         actualizar (ADMIN, COORDINADOR) — p. ej. marcar CUMPLIDO
//   DELETE /api/commitments/:id         borrar     (ADMIN, COORDINADOR)
import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { findCaseOr404 } from "../lib/access.js";
import { parseDay } from "../lib/dates.js";
import { badRequest, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { WHO, presentCommitment } from "../lib/presenters.js";
import { day, enums, id, idParams, text } from "../lib/schemas.js";
import { authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const staff = authorize(Role.ADMIN, Role.COORDINADOR);

const createBody = z.object({
    description: text(5000),
    dueDate: day.nullish(),
    responsibleId: id.optional(), // por defecto, quien lo crea
});

const patchBody = z
    .object({
        description: text(5000),
        dueDate: day.nullable(),
        status: enums.commitmentStatus,
        responsibleId: id,
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Envía al menos un campo para actualizar");

// El responsable debe ser un usuario activo.
async function assertActiveUser(userId) {
    const user = await prisma.user.findFirst({ where: { id: userId, active: true } });

    if (!user) throw badRequest("El responsable no existe o está inactivo.");
}

router.get("/cases/:id/commitments", validate({ params: idParams }), async (req, res) => {
    const found = await findCaseOr404(req.valid.params.id, req.user);

    const commitments = await prisma.commitment.findMany({
        where: { caseId: found.id },
        include: { responsible: WHO },
        orderBy: { id: "asc" },
    });

    res.json({ data: commitments.map(presentCommitment) });
});

router.post("/cases/:id/commitments", staff, validate({ params: idParams, body: createBody }), async (req, res) => {
    const found = await findCaseOr404(req.valid.params.id, req.user);
    const { description, dueDate, responsibleId } = req.valid.body;

    if (responsibleId) await assertActiveUser(responsibleId);

    const created = await prisma.commitment.create({
        data: {
            caseId: found.id,
            description,
            dueDate: dueDate ? parseDay(dueDate) : null,
            responsibleId: responsibleId ?? req.user.id,
        },
        include: { responsible: WHO },
    });

    res.status(201).json({ data: presentCommitment(created) });
});

router.patch("/commitments/:id", staff, validate({ params: idParams, body: patchBody }), async (req, res) => {
    const { dueDate, responsibleId, ...rest } = req.valid.body;
    const found = await prisma.commitment.findUnique({ where: { id: req.valid.params.id } });

    if (!found) throw notFound("Compromiso");

    if (responsibleId) await assertActiveUser(responsibleId);

    const updated = await prisma.commitment.update({
        where: { id: found.id },
        data: {
            ...rest,
            ...(responsibleId && { responsibleId }),
            ...(dueDate !== undefined && { dueDate: dueDate ? parseDay(dueDate) : null }),
        },
        include: { responsible: WHO },
    });

    res.json({ data: presentCommitment(updated) });
});

router.delete("/commitments/:id", staff, validate({ params: idParams }), async (req, res) => {
    const found = await prisma.commitment.findUnique({ where: { id: req.valid.params.id } });

    if (!found) throw notFound("Compromiso");

    await prisma.commitment.delete({ where: { id: found.id } });

    res.json({ data: { id: found.id } });
});

export default router;
