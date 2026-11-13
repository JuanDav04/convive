// StudentForm.jsx
// Formulario único para crear y editar estudiantes (misma idea que CaseForm).
// La página padre decide qué hacer al enviar mediante onSubmit(values).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GROUPS, optionsOf } from "../constants/enums";
import "../styles/NewCase.css";
import "../styles/StudentAdmin.css";

function validate(values) {
    if (!values.code.trim()) return "Escribe el código (ID) del estudiante.";
    if (values.code.trim().length > 20) return "El código admite máximo 20 caracteres.";
    if (!values.fullName.trim()) return "Escribe el nombre completo.";
    if (values.fullName.trim().length > 120) return "El nombre admite máximo 120 caracteres.";
    if (!values.grade) return "Selecciona el grado.";
    if (!GROUPS.includes(Number(values.group))) return "Selecciona el grupo.";

    return null;
}

function StudentForm({ heading, initialValues, showActive = false, submitLabel, cancelTo, onSubmit }) {
    const navigate = useNavigate();
    const [values, setValues] = useState({ code: "", fullName: "", grade: "", group: "", active: true, ...initialValues });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const bind = (field) => ({
        value: values[field],
        onChange: (event) => setValues((prev) => ({ ...prev, [field]: event.target.value })),
    });

    async function handleSubmit(event) {
        event.preventDefault();

        const problem = validate(values);

        if (problem) {
            setError(problem);
            return;
        }

        setError("");
        setSaving(true);

        try {
            await onSubmit({
                code: values.code.trim(),
                fullName: values.fullName.trim(),
                grade: values.grade,
                group: Number(values.group),
                ...(showActive && { active: values.active }),
            });
        } catch (err) {
            setError(err.status === 409 ? "Ya existe un estudiante con ese código." : err.message);
            setSaving(false);
        }
    }

    return (
        <main className="new-case">
            <section className="new-case-card">
                <h1>{heading}</h1>

                <form className="case-form" onSubmit={handleSubmit} noValidate>
                    <label htmlFor="student-code">Código (ID)</label>
                    <input id="student-code" type="text" placeholder="Ej. 6001" maxLength={20} {...bind("code")} />

                    <label htmlFor="student-name">Nombre completo</label>
                    <input id="student-name" type="text" placeholder="Ej. Juan David Ramírez López" maxLength={120} {...bind("fullName")} />

                    <label htmlFor="student-grade">Grado</label>
                    <select id="student-grade" {...bind("grade")}>
                        <option value="">Seleccione una opción</option>
                        {optionsOf("Grade").map(({ value, label }) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>

                    <label htmlFor="student-group">Grupo</label>
                    <select id="student-group" {...bind("group")}>
                        <option value="">Seleccione una opción</option>
                        {GROUPS.map((group) => (
                            <option key={group} value={group}>
                                {group}
                            </option>
                        ))}
                    </select>

                    {showActive && (
                        <label className="student-active-field" htmlFor="student-active">
                            <input
                                id="student-active"
                                type="checkbox"
                                checked={values.active}
                                onChange={(event) => setValues((prev) => ({ ...prev, active: event.target.checked }))}
                            />
                            Estudiante activo (si se retiró, desmárcalo: deja de aparecer en las listas)
                        </label>
                    )}

                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="case-form-actions">
                        <button type="button" className="cancel-button" onClick={() => navigate(cancelTo)}>
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

export default StudentForm;
