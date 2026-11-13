// routes/auth.js
//   POST /api/auth/login  (público)  -> { token, expiresAt, user }
//   GET  /api/auth/me     (con token) -> usuario actual
import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Hash falso para comparar aunque el usuario no exista: así la respuesta tarda
// parecido y no se puede averiguar qué usuarios existen midiendo el tiempo.
const DUMMY_HASH = bcrypt.hashSync("contraseña-de-relleno", 10);

const loginBody = z.object({
    username: z.string().trim().min(1, "Ingresa tu usuario"),
    password: z.string().min(1, "Ingresa tu contraseña"),
});

router.post("/auth/login", validate({ body: loginBody }), async (req, res) => {
    const { username, password } = req.valid.body;

    const user = await prisma.user.findUnique({ where: { username } });
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    // Mismo mensaje para "no existe", "inactivo" y "contraseña incorrecta".
    if (!user || !user.active || !passwordOk) {
        throw unauthorized("Usuario o contraseña incorrectos.");
    }

    const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
        algorithm: "HS256",
        subject: String(user.id),
        expiresIn: env.JWT_EXPIRES_IN,
    });

    res.json({
        data: {
            token,
            expiresAt: new Date(jwt.decode(token).exp * 1000).toISOString(),
            user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
        },
    });
});

router.get("/auth/me", authenticate, (req, res) => {
    res.json({ data: req.user });
});

export default router;
