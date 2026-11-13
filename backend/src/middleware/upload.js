// middleware/upload.js
// multer: recibe UN archivo en el campo "file" y lo guarda en UPLOAD_DIR con un
// nombre aleatorio (storageKey). El nombre original NUNCA se usa en disco, así
// nadie puede escribir fuera de la carpeta ni pisar otro archivo.
import crypto from "node:crypto";
import multer from "multer";
import { env } from "../config/env.js";
import { badRequest } from "../lib/errors.js";

// Tipos permitidos. OJO: el mimetype lo declara el cliente, así que esto
// filtra errores comunes pero no sustituye un antivirus / análisis real.
const ALLOWED_MIME = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const storage = multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
});

export const uploadSingle = multer({
    storage,
    limits: { fileSize: env.maxUploadBytes, files: 1 },
    fileFilter: (_req, file, cb) =>
        ALLOWED_MIME.has(file.mimetype)
            ? cb(null, true)
            : cb(badRequest("Tipo de archivo no permitido. Usa PDF, imagen, Word, Excel o texto.")),
}).single("file");
