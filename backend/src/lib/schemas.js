// lib/schemas.js
// Piezas de validación (zod) reutilizadas por todas las rutas. Los enums salen
// de @prisma/client, así que Prisma sigue siendo la única fuente de verdad.
import {
    AttendanceStatus,
    CaseCategory,
    CaseStatus,
    CommitmentStatus,
    DocumentType,
    Grade,
    ObservationType,
    Role,
    Severity,
} from "@prisma/client";
import { z } from "zod";
import { isValidDay } from "./dates.js";

// Mensajes de zod en español.
z.config(z.locales.es());

export const enums = {
    role: z.enum(Role),
    grade: z.enum(Grade),
    category: z.enum(CaseCategory),
    severity: z.enum(Severity),
    status: z.enum(CaseStatus),
    observationType: z.enum(ObservationType),
    attendanceStatus: z.enum(AttendanceStatus),
    documentType: z.enum(DocumentType),
    commitmentStatus: z.enum(CommitmentStatus),
};

// Id numérico que llega como texto en la URL o en el query string.
export const id = z.coerce.number().int().positive();
export const idParams = z.object({ id });

export const day = z.string().refine(isValidDay, "Debe ser una fecha válida AAAA-MM-DD");
export const group = z.coerce.number().int().min(1).max(4);

// Texto obligatorio, sin espacios sobrantes.
export const text = (max = 5000) => z.string().trim().min(1, "No puede estar vacío").max(max);

// Rango de fechas opcional en el query string. Se exporta en dos piezas porque
// zod no permite extender un objeto que ya tiene .refine(): primero se arma el
// objeto con sus campos y al final se aplica refineRange.
export const rangeFields = { from: day.optional(), to: day.optional() };

export const refineRange = (schema) =>
    schema.refine((r) => !r.from || !r.to || r.from <= r.to, {
        message: "'from' no puede ser posterior a 'to'",
        path: ["from"],
    });

// Texto opcional que se puede borrar enviando null o "" (queda null en la BD).
// undefined (campo ausente) NO toca el valor: importante en PATCH.
export const nullableText = (max = 10000) =>
    z
        .string()
        .trim()
        .max(max)
        .nullish()
        .transform((v) => (v === undefined ? undefined : v || null));
