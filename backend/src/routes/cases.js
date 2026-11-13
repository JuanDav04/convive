// routes/cases.js
//   GET    /api/cases        lista (filtros) — DOCENTE solo ve los suyos
//   GET    /api/cases/:id    detalle
//   POST   /api/cases        crear      (todos; el DOCENTE solo en estado ABIERTO)
//   PATCH  /api/cases/:id    editar     (ADMIN, COORDINADOR)
//   POST   /api/cases/:id/close    cerrar con el procedimiento sp_cerrar_caso (ADMIN, COORDINADOR)
//   GET    /api/cases/:id/history  historial de cambios (tabla CaseAudit; ADMIN, COORDINADOR)
//   DELETE /api/cases/:id    borrar     (solo ADMIN; borra también sus archivos)
//
// Reglas clave:
//  - Editar SIN enviar `status` NO reabre ni cierra el caso.
//  - Bloqueo optimista: si el PATCH trae `expectedUpdatedAt` y el caso cambió desde
//    entonces (otra persona lo editó), responde 409 en vez de pisar sus cambios.
//  - Cada cambio queda en CaseAudit gracias a un trigger de PostgreSQL.
import { CaseStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { caseScope, findCaseOr404, findStudentOr404 } from "../lib/access.js";
import { dayRange, parseDay, todayDay } from "../lib/dates.js";
import { withAuditUser } from "../lib/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { removeFiles } from "../lib/files.js";
import { prisma } from "../lib/prisma.js";
import { WHO, presentAudit, presentCase } from "../lib/presenters.js";
import { enums, id, idParams, nullableText, rangeFields, refineRange, text, day } from "../lib/schemas.js";
import { authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const staff = authorize(Role.ADMIN, Role.COORDINADOR);

const listQuery = refineRange(
    z.object({
        studentId: id.optional(),
        status: enums.status.optional(),
        severity: enums.severity.optional(),
        category: enums.category.optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200),
        ...rangeFields,
    })
);

const fields = {
    title: text(200),
    category: enums.category,
    severity: enums.severity,
    date: day,
    description: text(10000),
    actions: nullableText(),
    status: enums.status,
};

const createBody = z.object({
    studentId: id,
    ...fields,
    severity: fields.severity.default("TIPO_I"),
    status: fields.status.default(CaseStatus.ABIERTO),
});

// En PATCH todo es opcional y no se puede cambiar el estudiante del caso.
const patchBody = z
    .object({ ...fields, expectedUpdatedAt: z.iso.datetime().optional() })
    .partial()
    .refine(
        (b) => Object.keys(b).some((key) => key !== "expectedUpdatedAt"),
        "Envía al menos un campo para actualizar"
    );

router.get("/cases", validate({ query: listQuery }), async (req, res) => {
    const { studentId, status, severity, category, limit, from, to } = req.valid.query;

    const cases = await prisma.case.findMany({
        where: {
            ...caseScope(req.user),
            ...(studentId && { studentId }),
            ...(status && { status }),
            ...(severity && { severity }),
            ...(category && { category }),
            date: dayRange({ from, to }),
        },
        include: { createdBy: WHO },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: limit,
    });

    res.json({ data: cases.map(presentCase) });
});

router.get("/cases/:id", validate({ params: idParams }), async (req, res) => {
    const found = await findCaseOr404(req.valid.params.id, req.user, { include: { createdBy: WHO } });

    res.json({ data: presentCase(found) });
});

router.post("/cases", validate({ body: createBody }), async (req, res) => {
    const { studentId, date, ...rest } = req.valid.body;

    // Un docente reporta; cerrar o poner "en seguimiento" lo decide coordinación.
    if (req.user.role === Role.DOCENTE && rest.status !== CaseStatus.ABIERTO) {
        throw forbidden("Como docente solo puedes registrar casos en estado ABIERTO.");
    }

    const student = await findStudentOr404(studentId);

    if (!student.active) throw badRequest("El estudiante está inactivo.");

    const created = await withAuditUser(req.user.id, (tx) =>
        tx.case.create({
            data: {
                ...rest,
                studentId,
                date: parseDay(date),
                closedAt: rest.status === CaseStatus.CERRADO ? new Date() : null,
                createdById: req.user.id,
            },
            include: { createdBy: WHO },
        })
    );

    res.status(201).json({ data: presentCase(created) });
});

router.patch("/cases/:id", staff, validate({ params: idParams, body: patchBody }), async (req, res) => {
    const current = await findCaseOr404(req.valid.params.id, req.user);
    const { date, status, expectedUpdatedAt, ...rest } = req.valid.body;

    const data = { ...rest, ...(date && { date: parseDay(date) }) };

    // closedAt solo cambia si el estado REALMENTE cambia.
    if (status && status !== current.status) {
        data.status = status;
        data.closedAt = status === CaseStatus.CERRADO ? new Date() : null;
    }

    // UPDATE ... WHERE id = ? AND updatedAt = ? : si otra persona lo cambió antes,
    // no coincide ninguna fila (count = 0) y avisamos en lugar de pisar su trabajo.
    const updated = await withAuditUser(req.user.id, async (tx) => {
        const { count } = await tx.case.updateMany({
            where: { id: current.id, ...(expectedUpdatedAt && { updatedAt: new Date(expectedUpdatedAt) }) },
            data,
        });

        if (count === 0) {
            throw expectedUpdatedAt
                ? conflict("Este caso fue modificado por otra persona. Recarga la página y vuelve a intentarlo.")
                : notFound("Caso");
        }

        return tx.case.findUnique({ where: { id: current.id }, include: { createdBy: WHO } });
    });

    res.json({ data: presentCase(updated) });
});

// Cierra el caso llamando al PROCEDIMIENTO ALMACENADO sp_cerrar_caso: bloquea la fila
// (FOR UPDATE), cambia el estado, registra un seguimiento y deja la auditoría, todo
// en una sola transacción. Si dos personas cierran a la vez, la segunda recibe 409.
router.post("/cases/:id/close", staff, validate({ params: idParams }), async (req, res) => {
    const current = await findCaseOr404(req.valid.params.id, req.user);

    const [row] = await prisma.$queryRaw`
        CALL sp_cerrar_caso(${current.id}::integer, ${req.user.id}::integer, ${todayDay()}::date, NULL::text)`;

    if (row?.p_resultado === "YA_CERRADO") throw conflict("El caso ya está cerrado.");
    if (row?.p_resultado !== "OK") throw notFound("Caso");

    const closed = await prisma.case.findUnique({ where: { id: current.id }, include: { createdBy: WHO } });

    res.json({ data: presentCase(closed) });
});

router.get("/cases/:id/history", staff, validate({ params: idParams }), async (req, res) => {
    const { id: caseId } = req.valid.params;

    const rows = await prisma.caseAudit.findMany({
        where: { caseId },
        orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    });

    // El historial sobrevive al caso borrado; solo es 404 si nunca existió.
    if (rows.length === 0 && !(await prisma.case.count({ where: { id: caseId } }))) throw notFound("Caso");

    const userIds = [...new Set(rows.map((r) => r.changedBy).filter((v) => v !== null))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } });
    const byId = new Map(users.map((u) => [u.id, u]));

    res.json({ data: rows.map((r) => presentAudit(r, byId.get(r.changedBy) ?? null)) });
});

router.delete("/cases/:id", authorize(Role.ADMIN), validate({ params: idParams }), async (req, res) => {
    const current = await findCaseOr404(req.valid.params.id, req.user, {
        include: { documents: { select: { storageKey: true } } },
    });

    // La BD borra en cascada seguimientos, compromisos y filas de documentos;
    // los archivos en disco los borramos nosotros después de confirmar.
    await withAuditUser(req.user.id, (tx) => tx.case.delete({ where: { id: current.id } }));
    await removeFiles(current.documents.map((d) => d.storageKey));

    res.json({ data: { id: current.id } });
});

export default router;
