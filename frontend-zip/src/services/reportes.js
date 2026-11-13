// services/reportes.js
// Datos del reporte de un curso en UNA sola petición (el servidor consulta por
// tabla, no por estudiante). Se aplana a la forma que ya usa utils/reportData.js:
// { students, attendance, cases, observations, followUps }.
// Solo ADMIN y COORDINADOR.
import { http } from "./http";

export async function course({ grade, group }) {
    const { students: rows } = await http.get("/reports/course", { query: { grade, group } });

    return {
        students: rows.map((row) => row.student),
        attendance: rows.flatMap((row) => row.attendance),
        observations: rows.flatMap((row) => row.observations),
        cases: rows.flatMap((row) => row.cases.map(({ followUps: _followUps, ...rest }) => rest)),
        followUps: rows.flatMap((row) => row.cases.flatMap((c) => c.followUps)),
    };
}
