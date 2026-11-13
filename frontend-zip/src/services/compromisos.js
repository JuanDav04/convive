// services/compromisos.js
// Compromisos de un caso (solo ADMIN y COORDINADOR los crean/editan; el docente
// puede leerlos en sus casos). Todavía no hay pantalla que los use.
import { http, seg } from "./http";

export const list = ({ caseId }) => http.get(`/cases/${seg(caseId)}/commitments`);

export const create = ({ caseId, description, dueDate, responsibleId }) =>
    http.post(`/cases/${seg(caseId)}/commitments`, { json: { description, dueDate, responsibleId } });

export const update = (id, patch) => http.patch(`/commitments/${seg(id)}`, { json: patch });

export const setStatus = (id, status) => update(id, { status });

export const remove = (id) => http.delete(`/commitments/${seg(id)}`);
