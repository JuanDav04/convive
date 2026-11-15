// services/dashboard.js
// Resumen para la pantalla de inicio (solo ADMIN y COORDINADOR; el backend lo exige).
// Devuelve { totals, casesByStatus, casesByMonth, recurrentStudents, recentCases }.
import { http } from "./http";

export const summary = () => http.get("/dashboard");
