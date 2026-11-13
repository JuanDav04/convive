/*Documents.jsx*/
import { useState } from "react";
import { useParams } from "react-router-dom";
import Loading from "../components/Loading";
import { DocumentType, labelOf, optionsOf } from "../constants/enums";
import { useAsync } from "../hooks/useAsync";
import { useStudent } from "../hooks/useStudent";
import * as documentos from "../services/documentos";
import { formatBytes, saveBlob } from "../utils/files";
import "../styles/Documents.css";

// EVIDENCIA es exclusivo de los casos (se adjunta desde el detalle del caso).
const STUDENT_DOC_TYPES = optionsOf("DocumentType", [DocumentType.EVIDENCIA]);

function Documents() {
    const { id } = useParams();
    const { student, loading: loadingStudent } = useStudent(id);

    const { data: docs, error, reload } = useAsync(
        () => documentos.list({ studentId: Number(id) }),
        [id]
    );

    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [type, setType] = useState(DocumentType.OBSERVADOR);
    const [description, setDescription] = useState("");
    const [file, setFile] = useState(null);

    if (loadingStudent) return <Loading />;

    if (!student) {
        return (
            <main className="documents-page">
                <h1>Estudiante no encontrado</h1>
            </main>
        );
    }

    // Ej.: un docente no puede ver documentos del estudiante (403).
    if (error) {
        return (
            <main className="documents-page">
                <h1>Documentos</h1>
                <p>{error.message}</p>
            </main>
        );
    }

    function closeForm() {
        setName("");
        setType(DocumentType.OBSERVADOR);
        setDescription("");
        setFile(null);
        setShowForm(false);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (name.trim() === "") return alert("Escribe el nombre del documento.");
        if (!file) return alert("Selecciona el archivo del documento.");

        try {
            await documentos.upload({ file, type, name, description, studentId: student.id });
            closeForm();
            reload();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleDownload(doc) {
        try {
            saveBlob(await documentos.download(doc), doc.name);
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleDelete(docId) {
        if (!window.confirm("¿Estás seguro de que quieres eliminar este documento?")) return;

        try {
            await documentos.remove(docId);
            reload();
        } catch (error) {
            alert(error.message);
        }
    }

    return (
        <main className="documents-page">
            <div className="documents-header">
                <div>
                    <h1>Documentos</h1>

                    <p>
                        {student.fullName} · ID: {student.code}
                    </p>
                </div>

                {!showForm && (
                    <button
                        type="button"
                        className="add-document-button"
                        onClick={() => setShowForm(true)}
                    >
                        + Agregar documento
                    </button>
                )}
            </div>

            {showForm && (
                <section className="document-form-card">
                    <h2>Nuevo documento</h2>

                    <form onSubmit={handleSubmit}>
                        <label htmlFor="document-name">Nombre del documento</label>
                        <input
                            id="document-name"
                            type="text"
                            placeholder="Ej. Observador 2026"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />

                        <label htmlFor="document-type">Tipo de documento</label>
                        <select
                            id="document-type"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            {STUDENT_DOC_TYPES.map(({ value, label }) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>

                        <label htmlFor="document-description">Descripción</label>
                        <textarea
                            id="document-description"
                            rows="4"
                            placeholder="Descripción del documento..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />

                        <label htmlFor="document-file">
                            Archivo (máximo {documentos.MAX_UPLOAD_MB} MB)
                        </label>
                        <input
                            id="document-file"
                            type="file"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />

                        <div className="document-form-actions">
                            <button
                                type="button"
                                className="cancel-document-button"
                                onClick={closeForm}
                            >
                                Cancelar
                            </button>

                            <button type="submit" className="save-document-button">
                                Guardar documento
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="documents-list-section">
                <h2>Documentos del estudiante</h2>

                {!docs?.length ? (
                    <p className="no-documents">No hay documentos registrados.</p>
                ) : (
                    <div className="documents-list">
                        {docs.map((doc) => (
                            <article className="document-card" key={doc.id}>
                                <div className="document-icon">📄</div>

                                <div className="document-content">
                                    <div className="document-card-header">
                                        <div>
                                            <h3>{doc.name}</h3>
                                            <span>{labelOf("DocumentType", doc.type)}</span>
                                        </div>

                                        <span className="document-date">
                                            {doc.createdAt.slice(0, 10)}
                                        </span>
                                    </div>

                                    <p className="document-file">
                                        Tamaño: <strong>{formatBytes(doc.sizeBytes)}</strong>
                                    </p>

                                    {doc.description && (
                                        <p className="document-description">{doc.description}</p>
                                    )}

                                    <p className="document-responsible">
                                        Responsable: {doc.uploadedBy.fullName}
                                    </p>

                                    <div className="document-actions">
                                        <button
                                            type="button"
                                            className="download-document-button"
                                            onClick={() => handleDownload(doc)}
                                        >
                                            Descargar
                                        </button>

                                        <button
                                            type="button"
                                            className="delete-document-button"
                                            onClick={() => handleDelete(doc.id)}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default Documents;
