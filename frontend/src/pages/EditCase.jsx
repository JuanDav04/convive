/* EditCase.jsx */
import { Navigate, useNavigate, useParams } from "react-router-dom";
import CaseForm from "../components/CaseForm";
import Loading from "../components/Loading";
import { useAsync } from "../hooks/useAsync";
import { useStudent } from "../hooks/useStudent";
import * as casos from "../services/casos";
import { isStaff } from "../utils/permissions";

function EditCase() {
    const { id, caseId } = useParams();
    const navigate = useNavigate();
    const { student, loading: loadingStudent } = useStudent(id);

    const { data: caso, loading: loadingCase } = useAsync(() => casos.get(caseId), [caseId]);

    // Un docente que escriba la URL a mano vuelve al caso (el backend también lo rechaza).
    if (!isStaff()) return <Navigate to={`/estudiante/${id}/seguimiento/caso/${caseId}`} replace />;

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
        // expectedUpdatedAt: si otra persona editó el caso mientras tanto, la API responde 409.
        await casos.update(caso.id, { ...values, expectedUpdatedAt: caso.updatedAt });

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
