/*CaseDetail.jsx*/
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import CaseDocuments from "../components/CaseDocuments";
import Loading from "../components/Loading";
import { CaseStatus, labelOf } from "../constants/enums";
import { useAsync } from "../hooks/useAsync";
import { useStudent } from "../hooks/useStudent";
import * as casos from "../services/casos";
import * as seguimientos from "../services/seguimientos";
import "../styles/CaseDetail.css";

function CaseDetail() {
    const { id, caseId } = useParams();

    const { student, loading: loadingStudent } = useStudent(id);

    const { data: caso, loading: loadingCase, reload: reloadCase } = useAsync(
        () => casos.get(caseId),
        [caseId]
    );

    const { data: followUps, reload: reloadFollowUps } = useAsync(
        () => seguimientos.list({ caseId: Number(caseId) }),
        [caseId]
    );

    // Formulario de seguimiento: sirve para crear y para editar.
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null); // seguimiento que se edita, o null
    const [text, setText] = useState("");

    if (loadingStudent || loadingCase) return <Loading />;

    // El caso debe pertenecer al estudiante de la URL.
    if (!student || !caso || caso.studentId !== student.id) {
        return (
            <section className="case-detail-page">
                <h1>Caso no encontrado</h1>
            </section>
        );
    }

    const statusClass = caso.status.toLowerCase();

    function closeForm() {
        setText("");
        setEditing(null);
        setShowForm(false);
    }

    function startEditing(followUp) {
        setEditing(followUp);
        setText(followUp.description);
        setShowForm(true);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        try {
            if (editing) {
                await seguimientos.update(editing.id, { description: text });
            } else {
                await seguimientos.create({ caseId: caso.id, description: text });
            }

            closeForm();
            reloadFollowUps();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleDelete(followUpId) {
        if (!window.confirm("¿Estás seguro de que quieres eliminar este seguimiento?")) return;

        try {
            await seguimientos.remove(followUpId);
            reloadFollowUps();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleCloseCase() {
        if (!window.confirm("¿Estás seguro de que quieres cerrar este caso?")) return;

        try {
            await casos.close(caso.id);
            reloadCase(); // antes: window.location.reload()
        } catch (error) {
            alert(error.message);
        }
    }

    return (
        <section className="case-detail-page">
            <div className="case-detail-card">
                <Link to={`/estudiante/${student.id}/seguimiento`} className="back-link">
                    ← Volver al seguimiento
                </Link>

                <h1>{caso.title}</h1>

                <div className="case-info">
                    <p>
                        <strong>Estudiante:</strong> {student.fullName}
                    </p>

                    <p>
                        <strong>ID:</strong> {student.code}
                    </p>

                    <p>
                        <strong>Categoría:</strong> {labelOf("CaseCategory", caso.category)}
                    </p>

                    <p>
                        <strong>Gravedad:</strong> {labelOf("Severity", caso.severity)}
                    </p>

                    <p>
                        <strong>Fecha:</strong> {caso.date}
                    </p>

                    <p>
                        <strong>Estado:</strong>{" "}
                        <span className={`case-status status-${statusClass}`}>
                            {labelOf("CaseStatus", caso.status)}
                        </span>
                    </p>
                </div>

                <div className="case-detail-section">
                    <h2>Descripción</h2>
                    <p>{caso.description}</p>
                </div>

                <div className="case-detail-section">
                    <h2>Acciones realizadas</h2>
                    <p>{caso.actions || "No se registraron acciones."}</p>
                </div>

                <div className="case-detail-section">
                    <h2>Historial de seguimiento</h2>

                    {!followUps?.length ? (
                        <p className="no-follow-ups">No hay seguimientos registrados.</p>
                    ) : (
                        <div className="follow-ups-list">
                            {followUps.map((followUp) => (
                                <article className="follow-up-item" key={followUp.id}>
                                    <div className="follow-up-item-header">
                                        <strong>{followUp.date}</strong>
                                        <span>{followUp.responsible.fullName}</span>
                                    </div>

                                    <p>{followUp.description}</p>

                                    <div className="follow-up-actions">
                                        <button
                                            type="button"
                                            className="edit-follow-up-button"
                                            onClick={() => startEditing(followUp)}
                                        >
                                            Editar
                                        </button>

                                        <button
                                            type="button"
                                            className="delete-follow-up-button"
                                            onClick={() => handleDelete(followUp.id)}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    {!showForm && (
                        <button
                            type="button"
                            className="add-follow-up-button"
                            onClick={() => setShowForm(true)}
                        >
                            + Agregar seguimiento
                        </button>
                    )}

                    {showForm && (
                        <form className="follow-up-form" onSubmit={handleSubmit}>
                            <label htmlFor="follow-up-description">
                                {editing ? "Editar seguimiento" : "Descripción del seguimiento"}
                            </label>

                            <textarea
                                id="follow-up-description"
                                rows="5"
                                placeholder="Describe lo ocurrido durante este seguimiento..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />

                            <div className="follow-up-form-actions">
                                <button
                                    type="button"
                                    className="cancel-follow-up-button"
                                    onClick={closeForm}
                                >
                                    Cancelar
                                </button>

                                <button type="submit" className="save-follow-up-button">
                                    {editing ? "Guardar cambios" : "Guardar seguimiento"}
                                </button>
                            </div>
                        </form>
                    )}

                    <CaseDocuments caseId={caso.id} />
                </div>

                <Link
                    to={`/estudiante/${student.id}/seguimiento/caso/${caso.id}/editar`}
                    className="edit-case-button"
                >
                    Editar caso
                </Link>

                {caso.status !== CaseStatus.CERRADO && (
                    <button type="button" className="close-case-button" onClick={handleCloseCase}>
                        Cerrar caso
                    </button>
                )}
            </div>
        </section>
    );
}

export default CaseDetail;
