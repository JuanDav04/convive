// services/asistencia.js
// Un solo registro por estudiante por día (el servidor hace "upsert" en una
// transacción: se guarda todo el lote o nada).
//   list({ grade, group, date })        -> asistencia de un curso en un día
//   list({ studentId, from, to })       -> historial de un estudiante
import { http } from "./http";

export const list = ({ grade, group, date, studentId, from, to }) =>
    http.get("/attendance", { query: { grade, group, date, studentId, from, to } });

// records: [{ studentId, status }] de un mismo día.
export const saveDay = ({ date, records }) => http.put("/attendance", { json: { date, records } });
