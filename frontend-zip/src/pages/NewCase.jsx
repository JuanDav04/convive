import { useNavigate, useParams } from "react-router-dom";
import CaseForm from "../components/CaseForm";
import Loading from "../components/Loading";
import { useStudent } from "../hooks/useStudent";
import * as casos from "../services/casos";

function NewCase() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { student, loading } = useStudent(id);

    if (loading) return <Loading />;

    if (!student) {
        return (
            <main className="new-case">
                <h1>El estudiante no fue encontrado</h1>
            </main>
        );
    }

    async function handleCreate(values) {
        await casos.create({ ...values, studentId: student.id });

        alert("Caso registrado correctamente.");
        navigate(`/estudiante/${student.id}/seguimiento`);
    }

    return (
        <CaseForm
            student={student}
            heading="Registrar nuevo caso"
            showId
            submitLabel="Guardar caso"
            cancelTo={`/estudiante/${student.id}/seguimiento`}
            onSubmit={handleCreate}
        />
    );
}

export default NewCase;
