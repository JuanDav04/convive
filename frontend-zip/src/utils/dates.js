// utils/dates.js
// Las fechas "solo día" viajan como "AAAA-MM-DD" (igual que en el contrato).

// Fecha de HOY en la zona horaria del usuario.
// OJO: new Date().toISOString() usa UTC y en Colombia (UTC-5) cambia de día
// a las 7 p. m.; por eso aquí se arma con la fecha local.
export function todayISO() {
    const d = new Date();

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
    ].join("-");
}

// Los strings ISO se pueden comparar directamente. from/to vacíos = sin límite.
export function inRange(date, from, to) {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
}

export const isISODate = (value) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
