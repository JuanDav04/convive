// services/observaciones.js
// Observaciones por estudiante. Un docente solo ve y borra las suyas.
import { http, seg } from "./http";

export const list = ({ studentId, from, to }) =>
    http.get(`/students/${seg(studentId)}/observations`, { query: { from, to } });

// Si no se manda `date`, el servidor usa "hoy" (hora de Colombia).
export const create = ({ studentId, type, description, date }) =>
    http.post(`/students/${seg(studentId)}/observations`, { json: { type, description, date } });

export const remove = (id) => http.delete(`/observations/${seg(id)}`);
