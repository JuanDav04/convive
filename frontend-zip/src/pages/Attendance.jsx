import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Loading from "../components/Loading";
import { optionsOf } from "../constants/enums";
import { useAsync } from "../hooks/useAsync";
import * as asistencia from "../services/asistencia";
import * as estudiantes from "../services/estudiantes";
import { parseCourse } from "../utils/courses";
import { todayISO } from "../utils/dates";
import "../styles/Attendance.css";

function Attendance() {
    const [searchParams] = useSearchParams();
    const grado = searchParams.get("grado");
    const grupo = searchParams.get("grupo");
    const course = parseCourse(grado, grupo);

    const [date, setDate] = useState(todayISO);
    // Cambios hechos en pantalla que todavía no se guardan: { [studentId]: status }
    const [draft, setDraft] = useState({});

    // Estudiantes del curso + lo ya guardado para la fecha elegida.
    const { data, loading, reload } = useAsync(async () => {
        if (!course) return { students: [], records: [] };

        const [students, records] = await Promise.all([
            estudiantes.list(course),
            asistencia.list({ grade: course.grade, group: course.group, date }),
        ]);

        return { students, records };
    }, [grado, grupo, date]);

    const students = data?.students ?? [];

    // Lo guardado + los cambios sin guardar (los cambios tienen prioridad).
    const statuses = useMemo(
        () => ({
            ...Object.fromEntries((data?.records ?? []).map((r) => [r.studentId, r.status])),
            ...draft,
        }),
        [data, draft]
    );

    const registered = students.filter((s) => statuses[s.id]).length;

    function changeDate(newDate) {
        setDraft({});
        setDate(newDate);
    }

    async function handleSave() {
        const records = students
            .filter((s) => statuses[s.id])
            .map((s) => ({ studentId: s.id, status: statuses[s.id] }));

        try {
            await asistencia.saveDay({ date, records });
            setDraft({});
            reload();
            alert("Asistencia guardada correctamente.");
        } catch (error) {
            alert(error.message);
        }
    }

    if (!course) {
        return (
            <main className="attendance-page">
                <h1>Curso no válido</h1>
                <p>Regresa al menú y selecciona un curso válido.</p>
            </main>
        );
    }

    if (!data && loading) return <Loading />;

    return (
        <main className="attendance-page">
            <header className="attendance-header">
                <div>
                    <h1>Control de asistencia</h1>
                    <p>Curso: {course.label}</p>
                </div>

                <Link to={`/curso/${grado}/${grupo}`} className="attendance-back-link">
                    Volver al curso
                </Link>
            </header>

            <section className="attendance-panel">
                <div className="attendance-toolbar">
                    <div className="attendance-date-field">
                        <label htmlFor="attendance-date">Fecha de asistencia</label>

                        <input
                            id="attendance-date"
                            type="date"
                            value={date}
                            onChange={(event) => event.target.value && changeDate(event.target.value)}
                        />
                    </div>

                    <div className="attendance-progress">
                        <strong>
                            {registered} de {students.length}
                        </strong>
                        <span>estudiantes registrados</span>
                    </div>
                </div>

                {students.length === 0 ? (
                    <p className="attendance-empty">
                        No hay estudiantes registrados en este curso.
                    </p>
                ) : (
                    <>
                        <div className="attendance-table-wrapper">
                            <table className="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Estudiante</th>
                                        <th>ID</th>
                                        <th>Estado de asistencia</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {students.map((student) => (
                                        <tr key={student.id}>
                                            <td>{student.fullName}</td>
                                            <td>{student.code}</td>
                                            <td>
                                                <select
                                                    aria-label={`Asistencia de ${student.fullName}`}
                                                    className={`attendance-select ${
                                                        statuses[student.id]?.toLowerCase() ?? "sin-registrar"
                                                    }`}
                                                    value={statuses[student.id] ?? ""}
                                                    onChange={(event) =>
                                                        setDraft((prev) => ({
                                                            ...prev,
                                                            [student.id]: event.target.value,
                                                        }))
                                                    }
                                                >
                                                    <option value="">Sin registrar</option>
                                                    {optionsOf("AttendanceStatus").map(({ value, label }) => (
                                                        <option key={value} value={value}>
                                                            {label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="attendance-footer">
                            <p>Recuerda guardar los cambios antes de salir.</p>

                            <button
                                type="button"
                                className="attendance-save-button"
                                disabled={loading || registered === 0}
                                onClick={handleSave}
                            >
                                Guardar asistencia
                            </button>
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}

export default Attendance;
