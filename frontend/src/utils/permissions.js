// utils/permissions.js
// Qué muestra la interfaz según el rol. Es solo comodidad (no mostrar botones
// que darían 403): la seguridad real la aplica el backend en cada petición.
import { Role } from "../constants/enums";
import { getCurrentUser } from "../services/auth";

// ADMIN y COORDINADOR: editar y cerrar casos, reportes, compromisos.
export const isStaff = () => [Role.ADMIN, Role.COORDINADOR].includes(getCurrentUser()?.role);

// Solo ADMIN: eliminar casos (borra también seguimientos, compromisos y archivos).
export const isAdmin = () => getCurrentUser()?.role === Role.ADMIN;

// Staff puede tocar cualquier registro; un docente solo los que él creó
// (seguimientos, evidencias). `author` = { id } del responsable / quien subió.
export const canModify = (author) => isStaff() || (author?.id != null && author.id === getCurrentUser()?.id);
