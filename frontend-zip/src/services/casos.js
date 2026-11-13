// services/casos.js
// Casos de convivencia. Las reglas de negocio (closedAt, no reabrir al editar,
// borrado en cascada, qué ve cada rol) las aplica el backend; aquí solo se llama.
import { CaseStatus } from "../constants/enums";
import { http, seg } from "./http";

// filtros: studentId, status, severity, category, from, to, limit
export const list = (filters = {}) => http.get("/cases", { query: filters });

export const get = (id) => http.get(`/cases/${seg(id)}`);

export const create = (input) => http.post("/cases", { json: input });

export const update = (id, patch) => http.patch(`/cases/${seg(id)}`, { json: patch });

export const close = (id) => update(id, { status: CaseStatus.CERRADO });

export const remove = (id) => http.delete(`/cases/${seg(id)}`);
