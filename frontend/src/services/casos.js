// services/casos.js
// Casos de convivencia. Las reglas de negocio (closedAt, no reabrir al editar,
// borrado en cascada, qué ve cada rol) las aplica el backend; aquí solo se llama.
import { http, seg } from "./http";

// filtros: studentId, status, severity, category, from, to, limit
export const list = (filters = {}) => http.get("/cases", { query: filters });

export const get = (id) => http.get(`/cases/${seg(id)}`);

export const create = (input) => http.post("/cases", { json: input });

export const update = (id, patch) => http.patch(`/cases/${seg(id)}`, { json: patch });

// Cierra con el procedimiento almacenado sp_cerrar_caso (transacción en PostgreSQL).
// Si otra persona ya lo cerró, la API responde 409.
export const close = (id) => http.post(`/cases/${seg(id)}/close`);

// Historial de cambios (tabla de auditoría llenada por un trigger). ADMIN y COORDINADOR.
export const history = (id) => http.get(`/cases/${seg(id)}/history`);

export const remove = (id) => http.delete(`/cases/${seg(id)}`);
