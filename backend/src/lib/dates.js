// lib/dates.js
// Las fechas "solo día" viajan como "AAAA-MM-DD" y en la BD son medianoche UTC
// (columna DATE). Estas funciones convierten entre los dos mundos.
import { env } from "../config/env.js";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-30" -> Date (medianoche UTC)
export const parseDay = (day) => new Date(`${day}T00:00:00.000Z`);

// Date -> "2026-10-30" (null se queda null)
export const toDay = (date) => (date ? date.toISOString().slice(0, 10) : null);

// ¿Es una fecha real? (rechaza 2026-02-31, que new Date() "corregiría" a marzo)
export function isValidDay(day) {
    if (!DAY_RE.test(day)) return false;

    const date = parseDay(day);

    return !Number.isNaN(date.getTime()) && toDay(date) === day;
}

// "Hoy" en la zona horaria del colegio (no en UTC: a las 7 p. m. en Colombia
// UTC ya cambió de día). 'en-CA' da el formato AAAA-MM-DD.
export const todayDay = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: env.APP_TIMEZONE }).format(new Date());

export const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000);

// Filtro Prisma para un rango opcional { from, to } (ambos "AAAA-MM-DD").
export function dayRange({ from, to } = {}) {
    if (!from && !to) return undefined;

    return {
        ...(from && { gte: parseDay(from) }),
        ...(to && { lte: parseDay(to) }),
    };
}
