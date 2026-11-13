import { useState } from "react";
import { useParams } from "react-router-dom";
import Loading from "../components/Loading";
import { ObservationType, labelOf, optionsOf } from "../constants/enums";
import { useAsync } from "../hooks/useAsync";
import { useStudent } from "../hooks/useStudent";
import * as observaciones from "../services/observaciones";
import "../styles/Observations.css";

function Observations() {
    const { id } = useParams();
    const { student, loading: loadingStudent } = useStudent(id);

    const { data: observations, reload } = useAsync(
        () => observaciones.list({ studentId: Number(id) }),
        [id]
    );

    const [showForm, setShowForm] = useState(false);
    const [type, setType] = useState(ObservationType.CONVIVENCIA);
    const [description, setDescription] = useState("");

    if (loadingStudent) return <Loading />;

    if (!student) {
        return (
            <main className="observations-page">
                <h1>Estudiante no encontrado</h1>
            </main>
        );
    }

    function closeForm() {
        setDescription("");
        setType(ObservationType.CONVIVENCIA);
        setShowForm(false);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        try {
            await observaciones.create({ studentId: student.id, type, description });
            closeForm();
            reload();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleDelete(observationId) {
        if (!window.confirm("¿Estás seguro de que quieres eliminar esta observación?")) return;

        try {
            await observaciones.remove(observationId);
            reload();
        } catch (error) {
            alert(error.message);
        }
    }

    return (
        <main className="observations-page">
            <div className="observations-header">
                <div>
                    <h1>Observaciones</h1>

                    <p>
                        {student.fullName} · ID: {student.code}
                    </p>
                </div>

                {!showForm && (
                    <button
                        type="button"
                        className="add-observation-button"
                        onClick={() => setShowForm(true)}
                    >
                        + Agregar observación
                    </button>
                )}
            </div>

            {showForm && (
                <section className="observation-form-card">
                    <h2>Nueva observación</h2>

                    <form onSubmit={handleSubmit}>
                        <label htmlFor="observation-type">Tipo de observación</label>

                        <select
                            id="observation-type"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            {optionsOf("ObservationType").map(({ value, label }) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>

                        <label htmlFor="observation-description">Observación</label>

                        <textarea
                            id="observation-description"
                            rows="5"
                            placeholder="Escribe la observación..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />

                        <div className="observation-form-actions">
                            <button
                                type="button"
                                className="cancel-observation-button"
                                onClick={closeForm}
                            >
                                Cancelar
                            </button>

                            <button type="submit" className="save-observation-button">
                                Guardar observación
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="observations-list-section">
                <h2>Historial de observaciones</h2>

                {!observations?.length ? (
                    <p className="no-observations">No hay observaciones registradas.</p>
                ) : (
                    <div className="observations-list">
                        {observations.map((observation) => (
                            <article className="observation-card" key={observation.id}>
                                <div className="observation-card-header">
                                    <div>
                                        <h3>{labelOf("ObservationType", observation.type)}</h3>
                                        <span>{observation.date}</span>
                                    </div>

                                    <span className="observation-responsible">
                                        {observation.responsible.fullName}
                                    </span>
                                </div>

                                <p>{observation.description}</p>

                                <button
                                    type="button"
                                    className="delete-observation-button"
                                    onClick={() => handleDelete(observation.id)}
                                >
                                    Eliminar
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default Observations;
