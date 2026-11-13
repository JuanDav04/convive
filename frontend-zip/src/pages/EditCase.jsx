/* EditCase.jsx */
import { useNavigate, useParams } from "react-router-dom";
import CaseForm from "../components/CaseForm";
import Loading from "../components/Loading";
import { useAsync } from "../hooks/useAsync";
import { useStudent } from "../hooks/useStudent";
import * as casos from "../services/casos";

function EditCase() {
    const { id, caseId } = useParams();
    const navigate = useNavigate();
    const { student, loading: loadingStudent } = useStudent(id);
    const { data: caso, loading: loadingCase } = useAsync(() => casos.get(caseId), [caseId]);

    if (loadingStudent || loadingCase) return <Loading />;

    // El caso debe pertenecer al estudiante de la URL.
    if (!student || !caso || caso.studentId !== student.id) {
        return (
            <main className="new-case">
                <h1>Caso no encontrado</h1>
            </main>
        );
    }

    const detailUrl = `/estudiante/${student.id}/seguimiento/caso/${caso.id}`;

    async function handleUpdate(values) {
        await casos.update(caso.id, values);

        alert("Caso actualizado correctamente.");
        navigate(detailUrl);
    }

    return (
        <CaseForm
            student={student}
            heading="Editar caso"
            submitLabel="Guardar cambios"
            cancelTo={detailUrl}
            initialValues={{
                title: caso.title,
                category: caso.category,
                severity: caso.severity,
                date: caso.date,
                description: caso.description,
                actions: caso.actions ?? "",
                status: caso.status,
            }}
            onSubmit={handleUpdate}
        />
    );
}

export default EditCase;
