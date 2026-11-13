// services/estudiantes.js
// GET /api/students (filtros opcionales) y GET /api/students/:id, que además
// trae `recurrence` ({ count, minCases, windowDays, isRecurrent }).
import { http, seg } from "./http";

export const list = ({ grade, group, search, active } = {}) =>
    http.get("/students", { query: { grade, group, search, active } });

export const get = (id) => http.get(`/students/${seg(id)}`);
