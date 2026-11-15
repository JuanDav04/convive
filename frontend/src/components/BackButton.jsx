// BackButton.jsx
// Botón "← Volver" de la propia interfaz (antes había que usar la flecha del navegador).
// - Si el usuario llegó navegando dentro de la app, vuelve a la pantalla anterior (historial).
// - Si no hay historial (abrió un enlace directo o recargó en una pantalla profunda),
//   sube un nivel lógico: caso → seguimiento → perfil → curso/inicio.
// No se muestra en el inicio (/dashboard): no hay a dónde volver.
import { useLocation, useNavigate } from "react-router-dom";

// react-router guarda en history.state un contador `idx`; > 0 = hay una pantalla anterior de la app.
const hasAppHistory = () => (window.history.state?.idx ?? 0) > 0;

// Pantalla "padre" según la ruta actual (solo se usa cuando no hay historial).
export function parentPath(pathname, search = "") {
    const params = new URLSearchParams(search);
    const course =
        params.get("grado") && params.get("grupo")
            ? `/curso/${params.get("grado")}/${params.get("grupo")}`
            : null;

    let m;
    if ((m = pathname.match(/^\/estudiante\/(\d+)\/seguimiento\/caso\/(\d+)\/editar$/))) return `/estudiante/${m[1]}/seguimiento/caso/${m[2]}`;
    if ((m = pathname.match(/^\/estudiante\/(\d+)\/seguimiento\/caso\/\d+$/))) return `/estudiante/${m[1]}/seguimiento`;
    if ((m = pathname.match(/^\/estudiante\/(\d+)\/seguimiento\/nuevo$/))) return `/estudiante/${m[1]}/seguimiento`;
    if ((m = pathname.match(/^\/estudiante\/(\d+)\/(seguimiento|observaciones|editar)$/))) return `/estudiante/${m[1]}`;
    if (pathname === "/estudiante/nuevo" || pathname === "/asistencia" || pathname === "/reportes") return course ?? "/dashboard";
    return "/dashboard"; // perfil, curso y cualquier otra
}

function BackButton() {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();

    if (pathname === "/dashboard") return null;

    function handleBack() {
        if (hasAppHistory()) navigate(-1);
        else navigate(parentPath(pathname, search), { replace: true });
    }

    return (
        <div className="back-bar">
            <button type="button" className="back-button" onClick={handleBack}>
                <span aria-hidden="true">←</span> Volver
            </button>
        </div>
    );
}

export default BackButton;
