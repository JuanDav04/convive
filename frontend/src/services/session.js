// services/session.js
// Guarda y lee la sesión (token + usuario + expiración) en localStorage.
// Vive aparte de auth.js para que http.js pueda leer el token sin importar
// auth.js (que a su vez usa http.js): así no hay importaciones circulares.
//
// Decisión: localStorage (la sesión sobrevive a cerrar la pestaña). Su costo es
// que un XSS podría leer el token; por eso el backend usa helmet y el token
// vence en JWT_EXPIRES_IN. La alternativa sería una cookie httpOnly, pero
// exigiría CSRF y cambiar el contrato (Bearer).
const SESSION_KEY = "convive:v3:session";

export const SESSION_EXPIRED_EVENT = "convive:session-expired";

export function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch {
        // localStorage puede no estar disponible (modo privado): no pasa nada
    }
}

// data = { token, expiresAt (ISO, como lo manda la API), user }
export function saveSession({ token, expiresAt, user }) {
    const session = { token, expiresAt: Date.parse(expiresAt), user };

    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
        // si no se puede guardar, la sesión solo dura mientras no se recargue
    }

    return session;
}

// Devuelve la sesión vigente o null (y limpia la sesión si ya venció o está corrupta).
export function getSession() {
    try {
        const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");

        if (session?.token && session.expiresAt > Date.now()) return session;
    } catch {
        // sesión corrupta: se trata como si no existiera
    }

    clearSession();
    return null;
}

export const getToken = () => getSession()?.token ?? null;

export function updateUser(user) {
    const session = getSession();

    if (session) saveSession({ ...session, expiresAt: new Date(session.expiresAt).toISOString(), user });
}

// Avisa a la app (RequireAuth) que hay que volver al login.
export function notifySessionExpired(reason) {
    clearSession();

    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
    }
}
