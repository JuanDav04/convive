// hooks/useStudent.js
// Antes cada página repetía students.find(...). Ahora una sola línea:
//   const { student, loading } = useStudent(id);
import * as estudiantes from "../services/estudiantes";
import { useAsync } from "./useAsync";

export function useStudent(id) {
    const { data, loading } = useAsync(() => estudiantes.get(id), [id]);

    return { student: data, loading };
}
