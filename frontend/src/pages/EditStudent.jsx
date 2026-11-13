// EditStudent.jsx — /estudiante/:id/editar
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import StudentForm from "../components/StudentForm";
import { useStudent } from "../hooks/useStudent";
import * as estudiantes from "../services/estudiantes";
import { isStaff } from "../utils/permissions";

function EditStudent() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { student, loading } = useStudent(id);

    if (!isStaff()) return <Navigate to={`/estudiante/${id}`} replace />;

    if (loading) return <Loading />;

    if (!student) {
        return (
            <main className="new-case">
                <h1>Estudiante no encontrado</h1>
            </main>
        );
    }

    async function handleUpdate(values) {
        await estudiantes.update(student.id, values);

        navigate(`/estudiante/${student.id}`);
    }

    return (
        <StudentForm
            heading="Editar estudiante"
            initialValues={{
                code: student.code,
                fullName: student.fullName,
                grade: student.grade,
                group: student.group,
                active: student.active,
            }}
            showActive
            submitLabel="Guardar cambios"
            cancelTo={`/estudiante/${student.id}`}
            onSubmit={handleUpdate}
        />
    );
}

export default EditStudent;
