// routes/students.js
//   GET /api/students        lista (filtros: grade, group, active, search)
//   GET /api/students/:id    detalle + reincidencia
//   POST /api/students       crear        (ADMIN, COORDINADOR)
//   PATCH /api/students/:id  actualizar   (ADMIN, COORDINADOR)
// No hay DELETE: un estudiante que se retira se marca active=false.
import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { findStudentOr404 } from "../lib/access.js";
import { prisma } from "../lib/prisma.js";
import { presentStudent } from "../lib/presenters.js";
import { recurrenceFor } from "../lib/recurrence.js";
import { enums, group, idParams } from "../lib/schemas.js";
import { authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const staff = authorize(Role.ADMIN, Role.COORDINADOR);

const listQuery = z.object({
    grade: enums.grade.optional(),
    group: group.optional(),
    active: z.enum(["true", "false", "all"]).default("true"),
    search: z.string().trim().min(1).max(80).optional(),
});

const studentFields = {
    code: z.string().trim().min(1).max(20),
    fullName: z.string().trim().min(1).max(120),
    grade: enums.grade,
    group,
};

const createBody = z.object(studentFields);
const patchBody = z
    .object({ ...studentFields, active: z.boolean() })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Envía al menos un campo para actualizar");

router.get("/students", validate({ query: listQuery }), async (req, res) => {
    const { grade, group, active, search } = req.valid.query;

    const students = await prisma.student.findMany({
        where: {
            ...(grade && { grade }),
            ...(group && { group }),
            ...(active !== "all" && { active: active === "true" }),
            ...(search && {
                OR: [
                    { fullName: { contains: search, mode: "insensitive" } },
                    { code: { contains: search, mode: "insensitive" } },
                ],
            }),
        },
        orderBy: [{ grade: "asc" }, { group: "asc" }, { fullName: "asc" }],
    });

    res.json({ data: students.map(presentStudent) });
});

router.get("/students/:id", validate({ params: idParams }), async (req, res) => {
    const student = await findStudentOr404(req.valid.params.id);

    res.json({ data: { ...presentStudent(student), recurrence: await recurrenceFor(student.id) } });
});

router.post("/students", staff, validate({ body: createBody }), async (req, res) => {
    const student = await prisma.student.create({ data: req.valid.body });

    res.status(201).json({ data: presentStudent(student) });
});

router.patch("/students/:id", staff, validate({ params: idParams, body: patchBody }), async (req, res) => {
    const student = await prisma.student.update({
        where: { id: req.valid.params.id },
        data: req.valid.body,
    });

    res.json({ data: presentStudent(student) });
});

export default router;
