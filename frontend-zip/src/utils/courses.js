// utils/courses.js
// Antes esta validación (nombresGrados + ["1","2","3","4"]) estaba copiada en
// Students, Attendance y Reports. Ahora vive en un solo lugar.
import { Grade, GROUPS, labelOf } from "../constants/enums";

// "quinto", "1" -> { grade: "QUINTO", group: 1, label: "Quinto 1" } | null
export function parseCourse(gradeParam, groupParam) {
    const grade = String(gradeParam ?? "").toUpperCase();
    const group = Number(groupParam);

    if (!Object.hasOwn(Grade, grade) || !GROUPS.includes(group)) return null;

    return { grade, group, label: `${labelOf("Grade", grade)} ${group}` };
}

export const courseLabel = (student) =>
    `${labelOf("Grade", student.grade)} ${student.group}`;

// QUINTO -> "quinto" (así va en la URL: /curso/quinto/1)
export const gradeParam = (grade) => grade.toLowerCase();
