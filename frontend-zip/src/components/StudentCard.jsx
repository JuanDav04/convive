import { Link } from "react-router-dom";

// La URL usa el id de base de datos; lo que se muestra es el código visible.
function StudentCard({ estudiante }) {
    return (
        <Link to={`/estudiante/${estudiante.id}`} className="student-card">
            <div className="student-avatar">👤</div>

            <h3>{estudiante.fullName}</h3>

            <p>ID: {estudiante.code}</p>
        </Link>
    );
}

export default StudentCard;
