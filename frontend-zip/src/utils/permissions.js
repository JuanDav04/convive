// utils/permissions.js
// Qué muestra la interfaz según el rol. Es solo comodidad (no mostrar botones
// que darían 403): la seguridad real la aplica el backend en cada petición.
import { Role } from "../constants/enums";
import { getCurrentUser } from "../services/auth";

// ADMIN y COORDINADOR: documentos de estudiante, reportes, compromisos.
export const isStaff = () => [Role.ADMIN, Role.COORDINADOR].includes(getCurrentUser()?.role);
