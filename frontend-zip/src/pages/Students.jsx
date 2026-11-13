import { Link, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import StudentCard from "../components/StudentCard";
import { useAsync } from "../hooks/useAsync";
import * as estudiantes from "../services/estudiantes";
import { parseCourse } from "../utils/courses";
import { isStaff } from "../utils/permissions";
import "../styles/Students.css";

function Students() {
    const { grado, grupo } = useParams();
    const course = parseCourse(grado, grupo);

    const { data: students, loading } = useAsync(
        () => (course ? estudiantes.list(course) : Promise.resolve([])),
        [grado, grupo]
    );

    if (!course) {
        return (
            <main className="students-page">
                <h1>Curso no encontrado</h1>
                <p>Selecciona un curso válido desde el menú lateral.</p>
            </main>
        );
    }

    if (loading) return <Loading />;

    return (
        <main className="students-page">
            <header className="students-header">
                <div className="students-heading">
                    <h1>Curso: {course.label}</h1>
                    <p>Selecciona un estudiante para ver su información.</p>
                </div>

                <div className="students-actions">
                    <Link
                        to={`/asistencia?grado=${grado}&grupo=${grupo}`}
                        className="course-action attendance-action"
                    >
                        <span>📋</span>
                        Asistencia
                    </Link>

                    {isStaff() && (
                        <Link
                            to={`/reportes?grado=${grado}&grupo=${grupo}`}
                            className="course-action reports-action"
                        >
                            <span>📄</span>
                            Consultar / generar reporte
                        </Link>
                    )}
                </div>
            </header>

            <section className="students-grid">
                {students?.length > 0 ? (
                    students.map((student) => (
                        <StudentCard key={student.id} estudiante={student} />
                    ))
                ) : (
                    <p className="students-empty">
                        No hay estudiantes registrados en este curso.
                    </p>
                )}
            </section>
        </main>
    );
}

export default Students;
