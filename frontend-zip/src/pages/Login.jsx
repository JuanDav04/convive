import "../styles/Login.css";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import * as auth from "../services/auth";

const REMEMBER_KEY = "convive:v2:rememberedUser";

// Lee el usuario recordado (localStorage puede fallar en modo privado).
function readRememberedUser() {
    try {
        return localStorage.getItem(REMEMBER_KEY) ?? "";
    } catch {
        return "";
    }
}

/**
 * Inicio de sesión.
 * - Valida los campos, muestra/oculta la contraseña y puede recordar el usuario.
 * - Al entrar guarda la sesión (token JWT + expiración) y vuelve a la ruta que
 *   el usuario quería abrir (o al dashboard).
 */
function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [username, setUsername] = useState(readRememberedUser);
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(() => readRememberedUser() !== "");
    const [showPassword, setShowPassword] = useState(false);
    // Si vienes de una sesión vencida, se explica por qué volviste al login.
    const [error, setError] = useState(
        location.state?.reason === "expired" ? "Tu sesión expiró. Inicia sesión de nuevo." : ""
    );
    const [loading, setLoading] = useState(false);

    // Si ya hay sesión vigente no tiene sentido mostrar el login.
    if (auth.getSession()) return <Navigate to="/dashboard" replace />;

    async function handleSubmit(event) {
        event.preventDefault();

        if (username.trim() === "") return setError("Ingresa tu usuario");
        if (password === "") return setError("Ingresa tu contraseña");

        setError("");
        setLoading(true);

        try {
            await auth.login(username, password);

            try {
                if (remember) localStorage.setItem(REMEMBER_KEY, username.trim());
                else localStorage.removeItem(REMEMBER_KEY);
            } catch {
                // no pasa nada si no se puede recordar
            }

            navigate(location.state?.from ?? "/dashboard", { replace: true });
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <main className="login-container">
            {/* Tarjeta principal del formulario */}
            <section className="login-card">
                <div className="login-header">
                    <div className="login-icon">👥</div>

                    {/* Identidad de la plataforma */}
                    <h1>CONVIVE</h1>
                    <p>Gestión de convivencia escolar</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label htmlFor="username">Usuario</label>
                    <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        placeholder="Ingresa tu usuario"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />

                    <label htmlFor="password">Contraseña</label>
                    <div className="password-input-container">
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder="Ingresa tu contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <button
                            type="button"
                            className="password-toggle"
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            onClick={() => setShowPassword((visible) => !visible)}
                        >
                            👁
                        </button>
                    </div>

                    <div className="login-options">
                        <label className="remember">
                            <input
                                id="remember"
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                            />
                            <span>Recordarme</span>
                        </label>

                        <a href="#">¿Olvidaste tu contraseña?</a>
                    </div>

                    {error && <p className="login-error">{error}</p>}

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? "Ingresando..." : "Iniciar Sesión"}
                    </button>
                </form>
            </section>

            <footer className="login-footer">
                © 2026 Convive. Todos los derechos reservados.
            </footer>
        </main>
    );
}

export default Login;
