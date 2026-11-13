// NewStudent.jsx — /estudiante/nuevo?grado=quinto&grupo=1 (el curso viene prellenado)
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import StudentForm from "../components/StudentForm";
import * as estudiantes from "../services/estudiantes";
import { gradeParam, parseCourse } from "../utils/courses";
import { isStaff } from "../utils/permissions";

function NewStudent() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const course = parseCourse(params.get("grado"), params.get("grupo"));

    // Un docente que escriba la URL a mano vuelve al inicio (el backend también lo rechaza).
    if (!isStaff()) return <Navigate to="/dashboard" replace />;

    const backTo = course ? `/curso/${gradeParam(course.grade)}/${course.group}` : "/dashboard";

    async function handleCreate(values) {
        const created = await estudiantes.create(values);

        navigate(`/estudiante/${created.id}`);
    }

    return (
        <StudentForm
            heading="Agregar estudiante"
            initialValues={course ? { grade: course.grade, group: course.group } : undefined}
            submitLabel="Guardar estudiante"
            cancelTo={backTo}
            onSubmit={handleCreate}
        />
    );
}

export default NewStudent;
