// services/errors.js
// Error común de la capa de servicios. El cliente HTTP lanza siempre este tipo:
//  - status: código HTTP (0 = no hubo respuesta: red caída, timeout, CORS)
//  - details: lista [{ field, message }] cuando el backend responde 400 de validación
export class ApiError extends Error {
    constructor(message, status = 400, details = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
    }
}
