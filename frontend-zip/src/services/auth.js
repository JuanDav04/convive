// services/auth.js
// Login real contra POST /api/auth/login. La sesión (token, usuario, expiración)
// se guarda en session.js; aquí solo están las operaciones.
import { http } from "./http";
import { clearSession, getSession, saveSession, updateUser } from "./session";

export { getSession };

export async function login(username, password) {
    const data = await http.post("/auth/login", {
        json: { username: username.trim(), password },
        auth: false,
    });

    return saveSession(data);
}

export const logout = clearSession;

export const getCurrentUser = () => getSession()?.user ?? null;

// Pide a la API el usuario actual (rol y nombre vigentes) y lo guarda.
// Si el token ya no sirve, http.js cierra la sesión por su cuenta.
export async function refreshUser() {
    const user = await http.get("/auth/me");

    updateUser(user);
    return user;
}
