// middleware/errorHandler.js
// Último eslabón: convierte cualquier error en JSON { message, details? } con
// el código HTTP correcto. Los errores inesperados NO exponen detalles
// internos (solo se registran en el log del servidor).
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const send = (res, status, message, details) =>
    res.status(status).json({ message, ...(details && { details }) });

export function notFoundHandler(req, res) {
    send(res, 404, `Ruta no encontrada: ${req.method} ${req.path}`);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err instanceof AppError) return send(res, err.status, err.message, err.details);

    if (err instanceof z.ZodError) {
        return send(
            res,
            400,
            "Datos inválidos.",
            err.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
        );
    }

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return send(res, 413, `El archivo supera el máximo de ${env.MAX_UPLOAD_MB} MB.`);
        }

        return send(res, 400, "No se pudo procesar el archivo enviado.");
    }

    // Errores de body-parser (JSON mal formado o demasiado grande).
    if (err.type === "entity.parse.failed") return send(res, 400, "El cuerpo no es un JSON válido.");
    if (err.type === "entity.too.large") return send(res, 413, "La petición es demasiado grande.");

    // Errores conocidos de Prisma.
    if (err.code === "P2002") return send(res, 409, "Ya existe un registro con esos datos.");
    if (err.code === "P2025") return send(res, 404, "Recurso no encontrado.");
    if (err.code === "P2003") {
        return send(res, 409, "No se puede completar: hay registros relacionados que lo impiden.");
    }

    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    send(res, 500, "Error interno del servidor.");
}
