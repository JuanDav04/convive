// lib/presenters.js
// Convierte filas de Prisma al formato EXACTO del contrato (el mismo que ya
// usan los servicios del frontend): fechas solo-día como "AAAA-MM-DD", y los
// usuarios relacionados como { id, fullName } (nunca el passwordHash).
import { toDay } from "./dates.js";

// Úsalo en `include` / `select` para traer solo id y nombre del usuario.
export const WHO = { select: { id: true, fullName: true } };

export const presentUser = (u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    active: u.active,
});

export const presentStudent = (s) => ({
    id: s.id,
    code: s.code,
    fullName: s.fullName,
    grade: s.grade,
    group: s.group,
    active: s.active,
});

export const presentCase = (c) => ({
    id: c.id,
    studentId: c.studentId,
    title: c.title,
    category: c.category,
    severity: c.severity,
    date: toDay(c.date),
    description: c.description,
    actions: c.actions,
    status: c.status,
    closedAt: c.closedAt,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
});

export const presentAudit = (a, user) => ({
    id: a.id,
    caseId: a.caseId,
    action: a.action,
    oldStatus: a.oldStatus,
    newStatus: a.newStatus,
    changedBy: user,
    changedAt: a.changedAt,
});

export const presentFollowUp = (f) => ({
    id: f.id,
    caseId: f.caseId,
    date: toDay(f.date),
    description: f.description,
    responsible: f.responsible,
    createdAt: f.createdAt,
});

export const presentCommitment = (c) => ({
    id: c.id,
    caseId: c.caseId,
    description: c.description,
    dueDate: toDay(c.dueDate),
    status: c.status,
    responsible: c.responsible,
    createdAt: c.createdAt,
});

export const presentObservation = (o) => ({
    id: o.id,
    studentId: o.studentId,
    type: o.type,
    description: o.description,
    date: toDay(o.date),
    responsible: o.responsible,
    createdAt: o.createdAt,
});

export const presentAttendance = (a) => ({
    id: a.id,
    studentId: a.studentId,
    date: toDay(a.date),
    status: a.status,
    registeredBy: a.registeredBy,
});

export const presentDocument = (d) => ({
    id: d.id,
    studentId: d.studentId,
    caseId: d.caseId,
    type: d.type,
    name: d.name,
    description: d.description,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    uploadedBy: d.uploadedBy,
    createdAt: d.createdAt,
});
