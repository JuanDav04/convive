// services/estudiantes.js
// GET /api/students (filtros opcionales) y GET /api/students/:id, que además
// trae `recurrence` ({ count, minCases, windowDays, isRecurrent }).
import { http, seg } from "./http";

export const list = ({ grade, group, search, active } = {}) =>
    http.get("/students", { query: { grade, group, search, active } });

export const get = (id) => http.get(`/students/${seg(id)}`);

// Crear y editar: solo ADMIN y COORDINADOR. No hay "eliminar": un estudiante que se
// retira se marca { active: false } y deja de aparecer en las listas por defecto.
export const create = (input) => http.post("/students", { json: input });

export const update = (id, patch) => http.patch(`/students/${seg(id)}`, { json: patch });
