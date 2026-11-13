// lib/access.js
// Reglas de visibilidad. Confidencialidad: un DOCENTE solo ve los casos (y
// observaciones) que él mismo registró; ADMIN y COORDINADOR ven todo.
import { Role } from "@prisma/client";
import { notFound } from "./errors.js";
import { prisma } from "./prisma.js";

export const isStaff = (user) => user.role === Role.ADMIN || user.role === Role.COORDINADOR;

// Filtro Prisma para casos según el rol.
export const caseScope = (user) => (isStaff(user) ? {} : { createdById: user.id });

// Devuelve el caso o responde 404. Para un docente, un caso ajeno se ve igual
// que uno inexistente (no se revela que existe).
export async function findCaseOr404(caseId, user, args = {}) {
    const found = await prisma.case.findFirst({
        where: { id: caseId, ...caseScope(user) },
        ...args,
    });

    if (!found) throw notFound("Caso");

    return found;
}

export async function findStudentOr404(studentId) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });

    if (!student) throw notFound("Estudiante");

    return student;
}
