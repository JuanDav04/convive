// routes/users.js — gestión de usuarios (solo ADMIN)
//   GET /api/users · POST /api/users · PATCH /api/users/:id
// No hay DELETE: un usuario deja de usarse con active=false, porque sus casos,
// seguimientos y observaciones siguen apuntando a él (trazabilidad).
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { presentUser } from "../lib/presenters.js";
import { enums, idParams } from "../lib/schemas.js";
import { authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const adminOnly = authorize(Role.ADMIN);

const username = z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, punto, guion y guion bajo");

// bcrypt solo usa los primeros 72 bytes: por eso el máximo.
const password = z.string().min(8, "Mínimo 8 caracteres").max(72);

const createBody = z.object({
    username,
    password,
    fullName: z.string().trim().min(1).max(120),
    role: enums.role.default(Role.DOCENTE),
});

const patchBody = z
    .object({
        fullName: z.string().trim().min(1).max(120),
        role: enums.role,
        active: z.boolean(),
        password,
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Envía al menos un campo para actualizar");

router.get("/users", adminOnly, async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });

    res.json({ data: users.map(presentUser) });
});

router.post("/users", adminOnly, validate({ body: createBody }), async (req, res) => {
    const { password: plain, ...rest } = req.valid.body;

    const user = await prisma.user.create({
        data: { ...rest, passwordHash: await bcrypt.hash(plain, 10) },
    });

    res.status(201).json({ data: presentUser(user) });
});

router.patch("/users/:id", adminOnly, validate({ params: idParams, body: patchBody }), async (req, res) => {
    const { id } = req.valid.params;
    const { password: plain, ...rest } = req.valid.body;

    // Evita que el último admin se bloquee a sí mismo.
    if (id === req.user.id && (rest.active === false || (rest.role && rest.role !== Role.ADMIN))) {
        throw badRequest("No puedes desactivarte ni quitarte el rol de administrador a ti mismo.");
    }

    const user = await prisma.user.update({
        where: { id },
        data: { ...rest, ...(plain && { passwordHash: await bcrypt.hash(plain, 10) }) },
    });

    res.json({ data: presentUser(user) });
});

export default router;
