// services/seguimientos.js
// Seguimientos de un caso. El responsable es quien tiene la sesión (lo pone el
// servidor) y la fecha por defecto es "hoy" en hora de Colombia.
import { http, seg } from "./http";

export const list = ({ caseId }) => http.get(`/cases/${seg(caseId)}/follow-ups`);

export const create = ({ caseId, description, date }) =>
    http.post(`/cases/${seg(caseId)}/follow-ups`, { json: { description, date } });

export const update = (id, { description }) =>
    http.patch(`/follow-ups/${seg(id)}`, { json: { description } });

export const remove = (id) => http.delete(`/follow-ups/${seg(id)}`);
