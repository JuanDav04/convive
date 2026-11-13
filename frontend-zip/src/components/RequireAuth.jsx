// Ruta protegida. Si no hay sesión vigente manda al login y recuerda a dónde
// quería ir el usuario. Además:
//  - cierra la sesión sola cuando llega la hora de expiración del token
//  - reacciona al aviso de http.js cuando el servidor responde 401
//  - al entrar pide /auth/me para tener el rol y nombre vigentes
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { refreshUser } from "../services/auth";
import { SESSION_EXPIRED_EVENT, getSession, notifySessionExpired } from "../services/session";

function RequireAuth() {
    const location = useLocation();
    const navigate = useNavigate();
    const [, forceRender] = useState(0);
    const session = getSession();
    const expiresAt = session?.expiresAt;

    // Volver al login cuando la API dice 401 (token vencido o usuario desactivado).
    useEffect(() => {
        function onExpired() {
            navigate("/", {
                replace: true,
                state: { from: location.pathname + location.search, reason: "expired" },
            });
        }

        window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    }, [navigate, location.pathname, location.search]);

    // Expiración local: el token trae su fecha; no hace falta esperar al 401.
    useEffect(() => {
        if (!expiresAt) return;

        // setTimeout no admite más de ~24 días; con 8 h de sesión sobra.
        const timer = setTimeout(() => notifySessionExpired("expired"), Math.max(0, expiresAt - Date.now()));

        return () => clearTimeout(timer);
    }, [expiresAt]);

    // Rol y nombre pueden haber cambiado desde el último login.
    useEffect(() => {
        if (!expiresAt) return;

        refreshUser()
            .then(() => forceRender((n) => n + 1))
            .catch(() => {
                // 401 ya lo maneja http.js; otros errores no impiden usar la app
            });
    }, [expiresAt]);

    if (!session) {
        return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
    }

    return <Outlet />;
}

export default RequireAuth;
