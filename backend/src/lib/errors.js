// lib/errors.js
// Error "esperado" con código HTTP y mensaje seguro para mostrar al cliente.
// Cualquier otro error (bug, caída de BD) se responde como 500 genérico.
export class AppError extends Error {
    constructor(status, message, details) {
        super(message);
        this.name = "AppError";
        this.status = status;
        this.details = details;
    }
}

export const badRequest = (message, details) => new AppError(400, message, details);
export const unauthorized = (message = "Debes iniciar sesión.") => new AppError(401, message);
export const forbidden = (message = "No tienes permiso para realizar esta acción.") =>
    new AppError(403, message);
export const notFound = (what = "Recurso") => new AppError(404, `${what} no encontrado.`);
export const conflict = (message) => new AppError(409, message);
