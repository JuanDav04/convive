import { useNavigate } from "react-router-dom";
import { labelOf } from "../constants/enums";
import * as auth from "../services/auth";
import "../styles/Navbar.css";

function Navbar() {
    const navigate = useNavigate();
    const user = auth.getCurrentUser();

    function handleLogout() {
        auth.logout();
        navigate("/", { replace: true });
    }

    return (
        <header className="navbar">
            <div className="navbar-brand">
                <span>CONVIVE</span>
            </div>

            <div className="navbar-search">
                <input type="text" placeholder="Buscar Estudiante..." />
            </div>

            <div className="navbar-user">
                <span>🔔</span>
                <span>
                    {user?.fullName} ({labelOf("Role", user?.role)})
                </span>
                <button type="button" className="navbar-logout" onClick={handleLogout}>
                    Cerrar sesión
                </button>
            </div>
        </header>
    );
}

export default Navbar;
