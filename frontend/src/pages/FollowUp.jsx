import { Link, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import { labelOf } from "../constants/enums";
import { useAsync } from "../hooks/useAsync";
import { useStudent } from "../hooks/useStudent";
import * as casos from "../services/casos";
import "../styles/FollowUp.css";

function FollowUp() {
    const { id } = useParams();
    const { student, loading: loadingStudent } = useStudent(id);

    const { data: cases, loading: loadingCases } = useAsync(
        () => casos.list({ studentId: Number(id) }),
        [id]
    );

    if (loadingStudent || loadingCases) return <Loading />;

    if (!student) {
        return (
            <main className="follow-up">
                <h1>Estudiante no encontrado</h1>
            </main>
        );
    }

    return (
        <main className="follow-up">
            <section className="follow-up-card">
                <div className="follow-up-header">
                    <div>
                        <h1>Seguimiento de Casos</h1>
                        <p>{student.fullName}</p>
                        <span>ID: {student.code}</span>
                    </div>
                </div>

                <div className="follow-up-section">
                    <h2>Casos Registrados</h2>

                    {!cases?.length ? (
                        <p>No hay casos registrados.</p>
                    ) : (
                        <div className="cases-list">
                            {cases.map((caso) => {
                                // Las clases CSS siguen en minúscula (status-abierto, ...)
                                const statusClass = caso.status.toLowerCase();

                                return (
                                    <article
                                        className={`case-card case-status-${statusClass}`}
                                        key={caso.id}
                                    >
                                        <h3>{caso.title}</h3>

                                        <p>
                                            <strong>Fecha:</strong> {caso.date}
                                        </p>

                                        <p>
                                            <strong>Gravedad:</strong>{" "}
                                            {labelOf("Severity", caso.severity)}
                                        </p>

                                        <p>
                                            <strong>Estado:</strong>{" "}
                                            <span className={`case-status status-${statusClass}`}>
                                                {labelOf("CaseStatus", caso.status)}
                                            </span>
                                        </p>

                                        <Link
                                            to={`/estudiante/${student.id}/seguimiento/caso/${caso.id}`}
                                            className="view-case-button"
                                        >
                                            Ver detalle
                                        </Link>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>

                <Link
                    to={`/estudiante/${student.id}/seguimiento/nuevo`}
                    className="new-case-button"
                >
                    Registrar nuevo caso
                </Link>
            </section>
        </main>
    );
}

export default FollowUp;
