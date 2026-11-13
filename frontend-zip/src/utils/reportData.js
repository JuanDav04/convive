// utils/reportData.js
// Filtra por rango de fechas y agrupa los datos por estudiante UNA sola vez.
// (Antes Reports.jsx volvía a filtrar las listas completas por cada estudiante.)
import { inRange } from "./dates";

export function buildReportData(raw, { from, to }) {
    const { students, attendance, cases, observations, followUps } = raw;
    const within = (row) => inRange(row.date, from, to);

    const byStudent = new Map(
        students.map((s) => [
            s.id,
            { attendance: [], observations: [], cases: [], followUps: [] },
        ])
    );

    const caseOwner = new Map();

    attendance
        .filter(within)
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((row) => byStudent.get(row.studentId)?.attendance.push(row));

    observations
        .filter(within)
        .forEach((row) => byStudent.get(row.studentId)?.observations.push(row));

    cases.filter(within).forEach((row) => {
        byStudent.get(row.studentId)?.cases.push(row);
        caseOwner.set(row.id, row.studentId);
    });

    followUps.filter(within).forEach((row) => {
        const owner = caseOwner.get(row.caseId);

        if (owner !== undefined) byStudent.get(owner).followUps.push(row);
    });

    const sum = (key) =>
        [...byStudent.values()].reduce((total, data) => total + data[key].length, 0);

    return {
        byStudent,
        totals: {
            students: students.length,
            attendance: sum("attendance"),
            cases: sum("cases"),
            observations: sum("observations"),
            followUps: sum("followUps"),
        },
    };
}
