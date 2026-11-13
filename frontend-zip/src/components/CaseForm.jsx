// CaseForm.jsx
// Formulario único para crear y editar casos (NewCase y EditCase eran casi
// idénticos: ~220 líneas duplicadas). La página padre solo decide qué hacer
// al enviar (crear o actualizar) mediante onSubmit.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Role, SEVERITY_HINTS, optionsOf } from "../constants/enums";
import { getCurrentUser } from "../services/auth";
import { todayISO } from "../utils/dates";
import "../styles/NewCase.css";

const EMPTY = {
    title: "",
    category: "",
    severity: "TIPO_I",
    date: "",
    description: "",
    actions: "",
    status: "ABIERTO",
};

function validate(values) {
    if (!values.title.trim()) return "Escribe un título para el caso.";
    if (!values.category) return "Selecciona la categoría de la situación.";
    if (!values.date) return "Selecciona una fecha.";
    if (!values.description.trim()) return "Escribe una descripción para el caso.";

    return null;
}

function CaseForm({ student, heading, showId = false, initialValues, submitLabel, cancelTo, onSubmit }) {
    const navigate = useNavigate();
    const [values, setValues] = useState({ ...EMPTY, date: todayISO(), ...initialValues });
    const [saving, setSaving] = useState(false);

    // El docente solo registra casos ABIERTOS (regla del backend): no se le muestra el estado.
    const canChooseStatus = getCurrentUser()?.role !== Role.DOCENTE;

    // Conecta un campo con el estado: <input {...bind("title")} />
    const bind = (field) => ({
        value: values[field],
        onChange: (event) =>
            setValues((prev) => ({ ...prev, [field]: event.target.value })),
    });

    async function handleSubmit(event) {
        event.preventDefault();

        const problem = validate(values);

        if (problem) {
            alert(problem);
            return;
        }

        setSaving(true);

        try {
            const { status, ...rest } = values;

            await onSubmit(canChooseStatus ? values : rest);
        } catch (error) {
            alert(error.message);
            setSaving(false);
        }
    }

    return (
        <main className="new-case">
            <section className="new-case-card">
                <h1>{heading}</h1>

                <p className="new-case-student">
                    Estudiante: <strong>{student.fullName}</strong>
                </p>

                {showId && <p className="new-case-id">ID: {student.code}</p>}

                <form className="case-form" onSubmit={handleSubmit}>
                    <label htmlFor="case-title">Título del caso</label>
                    <input
                        id="case-title"
                        type="text"
                        placeholder="Ej. Agresión verbal durante clase"
                        {...bind("title")}
                    />

                    <label htmlFor="case-category">Categoría de la situación</label>
                    <select id="case-category" {...bind("category")}>
                        <option value="">Seleccione una opción</option>
                        {optionsOf("CaseCategory").map(({ value, label }) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>

                    <label htmlFor="case-severity">Gravedad (Decreto 1965 de 2013)</label>
                    <select id="case-severity" {...bind("severity")}>
                        {optionsOf("Severity").map(({ value, label }) => (
                            <option key={value} value={value}>
                                {label} — {SEVERITY_HINTS[value]}
                            </option>
                        ))}
                    </select>

                    <label htmlFor="case-date">Fecha</label>
                    <input id="case-date" type="date" {...bind("date")} />

                    <label htmlFor="description">Descripción</label>
                    <textarea
                        id="description"
                        rows="5"
                        placeholder="Describe la situación..."
                        {...bind("description")}
                    />

                    <label htmlFor="actions">Acciones realizadas</label>
                    <textarea
                        id="actions"
                        rows="5"
                        placeholder="Describe las acciones realizadas..."
                        {...bind("actions")}
                    />

                    {canChooseStatus && (
                        <>
                            <label htmlFor="status">Estado</label>
                            <select id="status" {...bind("status")}>
                                {optionsOf("CaseStatus").map(({ value, label }) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}

                    <div className="case-form-actions">
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={() => navigate(cancelTo)}
                        >
                            Cancelar
                        </button>

                        <button type="submit" className="save-case-button" disabled={saving}>
                            {saving ? "Guardando..." : submitLabel}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}

export default CaseForm;
