/*CaseDocuments.jsx*/
// Evidencias de un caso. Antes este archivo traía ~90 líneas de IndexedDB;
// ahora todo eso vive en services/documentos.js y el componente solo pinta.
import { useState } from "react";
import { DocumentType } from "../constants/enums";
import { useAsync } from "../hooks/useAsync";
import * as documentos from "../services/documentos";
import { formatBytes, saveBlob } from "../utils/files";
import "../styles/CaseDocuments.css";

function CaseDocuments({ caseId }) {
    const [message, setMessage] = useState("");

    const { data: docs, loading, error, reload } = useAsync(
        () => documentos.list({ caseId }),
        [caseId]
    );

    async function handleAttach(event) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";

        if (files.length === 0) return;

        try {
            // Se suben de una en una; si una falla, se muestra su error.
            for (const file of files) {
                await documentos.upload({ file, type: DocumentType.EVIDENCIA, caseId });
            }

            setMessage("Documentos adjuntados correctamente.");
        } catch (err) {
            setMessage(err.message);
        }

        reload();
    }

    async function handleDownload(doc) {
        try {
            saveBlob(await documentos.download(doc), doc.name);
        } catch (err) {
            setMessage(err.message);
        }
    }

    async function handleDelete(doc) {
        if (!window.confirm(`¿Quieres eliminar "${doc.name}"?`)) return;

        try {
            await documentos.remove(doc.id);
            setMessage("Documento eliminado.");
            reload();
        } catch (err) {
            setMessage(err.message);
        }
    }

    return (
        <section className="case-detail-section case-documents">
            <h2>Documentos del caso</h2>

            <p className="case-documents-description">
                Adjunta evidencias, actas u otros archivos relacionados con este
                caso. Tamaño máximo: {documentos.MAX_UPLOAD_MB} MB por archivo.
            </p>

            <label className="case-documents-upload">
                + Adjuntar documentos
                <input type="file" multiple onChange={handleAttach} />
            </label>

            {message && (
                <p className="case-documents-message" role="status">
                    {message}
                </p>
            )}

            {error ? (
                <p className="case-documents-message">No se pudieron cargar los documentos.</p>
            ) : loading && !docs ? (
                <p>Cargando documentos...</p>
            ) : !docs?.length ? (
                <p className="case-documents-empty">
                    Todavía no hay documentos adjuntos a este caso.
                </p>
            ) : (
                <div className="case-documents-list">
                    {docs.map((doc) => (
                        <article className="case-document-item" key={doc.id}>
                            <div className="case-document-info">
                                <strong>{doc.name}</strong>
                                <span>{formatBytes(doc.sizeBytes)}</span>
                            </div>

                            <div className="case-document-actions">
                                <button type="button" onClick={() => handleDownload(doc)}>
                                    Descargar
                                </button>

                                <button
                                    type="button"
                                    className="case-document-delete"
                                    onClick={() => handleDelete(doc)}
                                >
                                    Eliminar
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

export default CaseDocuments;
