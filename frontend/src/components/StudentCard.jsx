import { Link } from "react-router-dom";

// La URL usa el id de base de datos; lo que se muestra es el código visible.
function StudentCard({ estudiante }) {
    return (
        <Link to={`/estudiante/${estudiante.id}`} className={estudiante.active ? "student-card" : "student-card is-inactive"}>
            <div className="student-avatar">👤</div>

            <h3>{estudiante.fullName}</h3>

            <p>ID: {estudiante.code}</p>

            {!estudiante.active && <span className="student-inactive-tag">Inactivo</span>}
        </Link>
    );
}

export default StudentCard;
