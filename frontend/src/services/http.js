// services/http.js
// Cliente HTTP central: todos los servicios pasan por aquí. Se encarga de:
//  - la URL base (VITE_API_URL) y de armar la query sin valores vacíos
//  - agregar el header Authorization: Bearer <token>
//  - desenvolver { data } de las respuestas correctas
//  - convertir cualquier fallo en ApiError (mensaje en español + status)
//  - si el servidor responde 401 con un token puesto: cerrar sesión y avisar
import { ApiError } from "./errors";
import { getToken, notifySessionExpired } from "./session";

const BASE_URL = (import.meta.env?.VITE_API_URL ?? "http://localhost:3000/api").replace(/\/+$/, "");

const TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

const DEFAULT_MESSAGES = {
    400: "La solicitud no es válida.",
    401: "Tu sesión expiró. Inicia sesión de nuevo.",
    403: "No tienes permiso para hacer esto.",
    404: "No se encontró lo que buscas.",
    409: "Ya existe un registro con esos datos.",
    413: "El archivo o la petición es demasiado grande.",
    429: "Demasiadas solicitudes. Intenta de nuevo en unos minutos.",
};

function buildUrl(path, query) {
    const url = new URL(`${BASE_URL}${path}`, globalThis.location?.origin);

    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    }

    return url;
}

async function readError(response) {
    const body = await response.json().catch(() => null);
    const message =
        body?.message ??
        DEFAULT_MESSAGES[response.status] ??
        (response.status >= 500 ? "Error del servidor. Intenta de nuevo más tarde." : "No se pudo completar la acción.");

    return new ApiError(message, response.status, body?.details ?? null);
}

/**
 * request(método, ruta, opciones)
 *  - query: objeto para ?a=1&b=2 (omite undefined/null/"")
 *  - json:  cuerpo JSON
 *  - form:  FormData (subida de archivos; NO se fija Content-Type a mano)
 *  - auth:  false solo para el login
 *  - blob:  true devuelve un Blob (descargas) en vez de leer { data }
 */
export async function request(method, path, { query, json, form, auth = true, blob = false } = {}) {
    const headers = { Accept: blob ? "*/*" : "application/json" };
    const token = auth ? getToken() : null;

    if (token) headers.Authorization = `Bearer ${token}`;
    if (json !== undefined) headers["Content-Type"] = "application/json";

    let response;

    try {
        response = await fetch(buildUrl(path, query), {
            method,
            headers,
            body: json !== undefined ? JSON.stringify(json) : form,
            signal: AbortSignal.timeout(form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
        });
    } catch (error) {
        const timedOut = error?.name === "TimeoutError";

        throw new ApiError(
            timedOut
                ? "El servidor tardó demasiado en responder."
                : "No se pudo conectar con el servidor. Revisa tu conexión.",
            0
        );
    }

    if (!response.ok) {
        const error = await readError(response);

        // 401 con token = sesión vencida o usuario desactivado. (El 401 del login
        // no entra aquí: se hace con auth:false y solo muestra "credenciales incorrectas".)
        if (response.status === 401 && token) notifySessionExpired("expired");

        throw error;
    }

    if (blob) return response.blob();
    if (response.status === 204) return null;

    return (await response.json()).data;
}

export const http = {
    get: (path, options) => request("GET", path, options),
    post: (path, options) => request("POST", path, options),
    put: (path, options) => request("PUT", path, options),
    patch: (path, options) => request("PATCH", path, options),
    delete: (path, options) => request("DELETE", path, options),
};

// Para armar rutas con ids que vienen de la URL del navegador.
export const seg = (value) => encodeURIComponent(String(value));
