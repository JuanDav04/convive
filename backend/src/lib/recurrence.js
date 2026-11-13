// lib/recurrence.js
// Reincidencia: un estudiante es reincidente si tiene REINCIDENCE_MIN_CASES o
// más casos con fecha dentro de los últimos REINCIDENCE_WINDOW_DAYS días
// (3 y 90 por defecto, configurables en .env). Cuenta casos de cualquier
// estado: un caso cerrado también cuenta como antecedente.
import { env } from "../config/env.js";
import { addDays, parseDay, toDay, todayDay } from "./dates.js";
import { prisma } from "./prisma.js";

const windowStart = () => addDays(parseDay(todayDay()), -env.REINCIDENCE_WINDOW_DAYS);

// El conteo lo hace la FUNCIÓN de PostgreSQL fn_contar_casos_desde (ver migración
// *_logica_sql); la fecha se envía como texto AAAA-MM-DD para evitar desfases de zona.
export async function recurrenceFor(studentId) {
    const [{ count }] = await prisma.$queryRaw`
        SELECT fn_contar_casos_desde(${studentId}::integer, ${toDay(windowStart())}::date) AS count`;

    return {
        count,
        minCases: env.REINCIDENCE_MIN_CASES,
        windowDays: env.REINCIDENCE_WINDOW_DAYS,
        isRecurrent: count >= env.REINCIDENCE_MIN_CASES,
    };
}

// Todos los estudiantes reincidentes: [{ studentId, count }], de más a menos casos.
export async function recurrentStudents() {
    const groups = await prisma.case.groupBy({
        by: ["studentId"],
        where: { date: { gte: windowStart() } },
        _count: { _all: true },
        having: { studentId: { _count: { gte: env.REINCIDENCE_MIN_CASES } } },
    });

    return groups
        .map((g) => ({ studentId: g.studentId, count: g._count._all }))
        .sort((a, b) => b.count - a.count);
}
