// middleware/auth.js
// authenticate: exige "Authorization: Bearer <token>", valida el JWT y carga al
// usuario desde la BD (así, si un admin desactiva a alguien, su token deja de
// servir de inmediato en lugar de seguir válido hasta que expire).
// authorize: limita una ruta a ciertos roles.
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export async function authenticate(req, _res, next) {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) throw unauthorized();

    let payload;

    try {
        payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
        throw unauthorized("Tu sesión no es válida o expiró. Inicia sesión de nuevo.");
    }

    const user = await prisma.user.findUnique({
        where: { id: Number(payload.sub) },
        select: { id: true, username: true, fullName: true, role: true, active: true },
    });

    if (!user?.active) throw unauthorized("Tu usuario no está activo.");

    req.user = user;
    next();
}

export const authorize =
    (...roles) =>
    (req, _res, next) => {
        if (!roles.includes(req.user.role)) throw forbidden();

        next();
    };
