// services/documentos.js
// Un solo modelo de documento para dos usos (igual que el schema):
//  - del estudiante -> { studentId }       (solo ADMIN y COORDINADOR)
//  - evidencia de un caso -> { caseId }
// En la BD solo van los metadatos; el archivo vive en el disco del servidor.
import { DocumentType } from "../constants/enums";
import { ApiError } from "./errors";
import { http, seg } from "./http";

// Solo para avisar ANTES de subir; el límite real lo impone el backend (MAX_UPLOAD_MB).
// Si cambias uno, cambia el otro: VITE_MAX_UPLOAD_MB en el frontend.
export const MAX_UPLOAD_MB = Number(import.meta.env?.VITE_MAX_UPLOAD_MB) || 10;

export const list = ({ studentId, caseId }) =>
    http.get("/documents", { query: caseId !== undefined ? { caseId } : { studentId } });

export async function upload({ file, type, name, description, studentId, caseId }) {
    if (!(file instanceof Blob)) throw new ApiError("Selecciona un archivo.", 400);
    if (!Object.hasOwn(DocumentType, type)) throw new ApiError("Tipo de documento inválido.", 400);

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        throw new ApiError(`"${file.name}" supera el máximo de ${MAX_UPLOAD_MB} MB.`, 413);
    }

    // multipart/form-data: el navegador pone el Content-Type con su "boundary".
    const form = new FormData();

    form.set("type", type);
    if (caseId) form.set("caseId", caseId);
    else form.set("studentId", studentId);
    if (name?.trim()) form.set("name", name.trim());
    if (description?.trim()) form.set("description", description.trim());
    form.set("file", file, file.name); // el archivo al final: así multer ya leyó los demás campos

    return http.post("/documents", { form });
}

// Devuelve el archivo (Blob). Va por fetch (no por <a href>) porque necesita el header Authorization.
export const download = (doc) => http.get(`/documents/${seg(doc.id)}/download`, { blob: true });

export const remove = (id) => http.delete(`/documents/${seg(id)}`);
