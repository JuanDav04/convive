/*StudentProfile.jsx*/
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import { AttendanceStatus } from "../constants/enums";
import { useAsync } from "../hooks/useAsync";
import { useStudent } from "../hooks/useStudent";
import * as asistencia from "../services/asistencia";
import { courseLabel } from "../utils/courses";
import { isStaff } from "../utils/permissions";
import "../styles/StudentProfile.css";

// Resume la asistencia real del estudiante (antes eran números fijos: 95%, 2, 1).
// Asistencia = presente + tarde sobre el total de registros; las ausencias
// justificadas cuentan como falta (se pueden separar si tu tesis lo pide).
function summarizeAttendance(records) {
    const count = (...statuses) =>
        records.filter((r) => statuses.includes(r.status)).length;

    const attended = count(AttendanceStatus.PRESENTE, AttendanceStatus.TARDE);

    return {
        percentage: records.length ? `${Math.round((attended / records.length) * 100)}%` : "—",
        late: count(AttendanceStatus.TARDE),
        absences: count(AttendanceStatus.AUSENTE, AttendanceStatus.JUSTIFICADA),
    };
}

function StudentProfile() {
    const { id } = useParams();
    const { student, loading } = useStudent(id);

    const { data: records } = useAsync(
        () => asistencia.list({ studentId: Number(id) }),
        [id]
    );

    const stats = useMemo(() => summarizeAttendance(records ?? []), [records]);

    if (loading) return <Loading />;

    if (!student) {
        return (
            <section className="student-profile-page">
                <h1>Estudiante no encontrado</h1>
            </section>
        );
    }

    const course = courseLabel(student);

    return (
        <section className="student-profile-page">
            <div className="student-profile-top">
                <div className="student-profile-title">
                    <Link to="/dashboard" className="back-arrow">
                        ←
                    </Link>

                    <h1>Perfil del estudiante</h1>
                </div>
            </div>

            <div className="student-profile-layout">
                <aside className="student-summary">
                    <div className="student-profile-avatar">👤</div>

                    <h2>{student.fullName}</h2>

                    <p className="student-id">ID: {student.code}</p>

                    <div className="student-details">
                        <p>
                            <strong>Curso:</strong> {course}
                        </p>

                        <p>
                            <strong>Estado:</strong>{" "}
                            <span className="student-active-status">
                                {student.active ? "Activo" : "Inactivo"}
                            </span>
                        </p>
                    </div>
                </aside>

                <section className="student-information">
                    <nav className="student-tabs">
                        <Link to={`/estudiante/${student.id}`} className="active">
                            Información general
                        </Link>

                        <Link to={`/estudiante/${student.id}/seguimiento`}>
                            Seguimiento de convivencia
                        </Link>

                        <Link to={`/estudiante/${student.id}/observaciones`}>
                            Observaciones
                        </Link>

                        {isStaff() && (
                            <Link to={`/estudiante/${student.id}/documentos`}>
                                Documentos
                            </Link>
                        )}
                    </nav>

                    <div className="student-information-card">
                        <h2>Asistencia</h2>

                        <div className="student-stat-grid">
                            <div className="student-stat">
                                <span>Asistencia</span>
                                <strong>{stats.percentage}</strong>
                            </div>

                            <div className="student-stat">
                                <span>Retardos</span>
                                <strong>{stats.late}</strong>
                            </div>

                            <div className="student-stat">
                                <span>Faltas</span>
                                <strong>{stats.absences}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="student-information-card">
                        <h2>Datos del estudiante</h2>

                        <div className="student-data-grid">
                            <div className="student-data-item">
                                <span>Nombre completo</span>
                                <strong>{student.fullName}</strong>
                            </div>

                            <div className="student-data-item">
                                <span>Identificación</span>
                                <strong>{student.code}</strong>
                            </div>

                            <div className="student-data-item">
                                <span>Curso</span>
                                <strong>{course}</strong>
                            </div>

                            <div className="student-data-item">
                                <span>Estado</span>
                                <strong>{student.active ? "Activo" : "Inactivo"}</strong>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </section>
    );
}

export default StudentProfile;
