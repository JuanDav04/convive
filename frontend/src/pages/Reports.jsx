import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Loading from "../components/Loading";
import { useAsync } from "../hooks/useAsync";
import * as reportes from "../services/reportes";
import { parseCourse } from "../utils/courses";
import { downloadCourseReport, downloadStudentReport } from "../utils/pdfReport";
import { buildReportData } from "../utils/reportData";
import "../styles/ModulePage.css";
import "../styles/Reports.css";

function Reports() {
    const [searchParams] = useSearchParams();
    const grado = searchParams.get("grado");
    const grupo = searchParams.get("grupo");
    const course = parseCourse(grado, grupo);

    // Rango de fechas del reporte (vacío = sin límite).
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    // Se cargan los datos del curso una sola vez; el rango filtra en memoria.
    const { data: raw, loading, error } = useAsync(async () => {
        if (!course) return null;

        return reportes.course(course);
    }, [grado, grupo]);

    const report = useMemo(
        () => (raw ? buildReportData(raw, { from, to }) : null),
        [raw, from, to]
    );

    if (!course) {
        return (
            <main className="reports-page">
                <section className="reports-panel">
                    <h1>Consultas / Reportes</h1>
                    <p>
                        Para consultar y generar un reporte, entra primero al
                        curso que deseas revisar.
                    </p>

                    <Link to="/dashboard" className="module-back-link">
                        Volver al inicio
                    </Link>
                </section>
            </main>
        );
    }

    if (error) {
        return (
            <main className="reports-page">
                <section className="reports-panel">
                    <h1>Consultas / Reportes</h1>
                    <p>{error.message}</p>

                    <Link to="/dashboard" className="module-back-link">
                        Volver al inicio
                    </Link>
                </section>
            </main>
        );
    }

    if (loading || !report) return <Loading />;

    const range = { from, to };
    const { students } = raw;

    async function handleCoursePdf() {
        try {
            await downloadCourseReport({
                courseName: course.label,
                students,
                byStudent: report.byStudent,
                totals: report.totals,
                range,
            });
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleStudentPdf(student) {
        try {
            await downloadStudentReport({
                student,
                data: report.byStudent.get(student.id),
                range,
            });
        } catch (error) {
            alert(error.message);
        }
    }

    return (
        <main className="reports-page">
            <header className="reports-header">
                <div>
                    <h1>Consultas / Reportes</h1>
                    <p>
                        Curso seleccionado: <strong>{course.label}</strong>
                    </p>
                </div>

                <Link to={`/curso/${grado}/${grupo}`} className="module-back-link">
                    Volver al curso
                </Link>
            </header>

            <section className="reports-panel">
                <h2>Rango de fechas</h2>

                <div className="reports-range">
                    <div className="reports-range-field">
                        <label htmlFor="report-from">Desde</label>
                        <input
                            id="report-from"
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>

                    <div className="reports-range-field">
                        <label htmlFor="report-to">Hasta</label>
                        <input
                            id="report-to"
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>

                    {(from || to) && (
                        <button
                            type="button"
                            className="reports-range-clear"
                            onClick={() => {
                                setFrom("");
                                setTo("");
                            }}
                        >
                            Quitar filtro
                        </button>
                    )}
                </div>
            </section>

            <section className="reports-panel">
                <h2>Resumen de información</h2>

                <div className="reports-summary-grid">
                    <article className="reports-summary-card">
                        <span>Estudiantes</span>
                        <strong>{report.totals.students}</strong>
                    </article>

                    <article className="reports-summary-card">
                        <span>Registros de asistencia</span>
                        <strong>{report.totals.attendance}</strong>
                    </article>

                    <article className="reports-summary-card">
                        <span>Casos registrados</span>
                        <strong>{report.totals.cases}</strong>
                    </article>

                    <article className="reports-summary-card">
                        <span>Observaciones</span>
                        <strong>{report.totals.observations}</strong>
                    </article>
                </div>

                <p className="reports-description">
                    El PDF incluirá los datos disponibles de cada estudiante,
                    su historial de asistencia, las observaciones registradas,
                    los casos de convivencia y los seguimientos asociados
                    dentro del rango de fechas elegido.
                </p>

                <button
                    type="button"
                    className="generate-report-button"
                    onClick={handleCoursePdf}
                >
                    Descargar PDF del curso
                </button>
            </section>

            <section className="reports-panel">
                <h2>Consulta por estudiante</h2>

                {students.length === 0 ? (
                    <p>No hay estudiantes registrados en este curso.</p>
                ) : (
                    <div className="reports-table-wrapper">
                        <table className="reports-table">
                            <thead>
                                <tr>
                                    <th>Estudiante</th>
                                    <th>ID</th>
                                    <th>Asistencias</th>
                                    <th>Casos</th>
                                    <th>Observaciones</th>
                                    <th>PDF individual</th>
                                </tr>
                            </thead>

                            <tbody>
                                {students.map((student) => {
                                    const data = report.byStudent.get(student.id);

                                    return (
                                        <tr key={student.id}>
                                            <td>{student.fullName}</td>
                                            <td>{student.code}</td>
                                            <td>{data.attendance.length}</td>
                                            <td>{data.cases.length}</td>
                                            <td>{data.observations.length}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="generate-individual-report-button"
                                                    onClick={() => handleStudentPdf(student)}
                                                >
                                                    Descargar PDF
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}

export default Reports;
