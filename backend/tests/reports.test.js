// tests/reports.test.js — reincidencia, dashboard y reportes
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { dayAgo, prisma, request, resetAndSeed, startServer, stopServer, today, tokens } from "./helpers/index.js";

const { ADMIN, COORDINADOR, DOCENTE } = tokens;

// Inserta casos directamente en la BD con fechas relativas a hoy.
async function addCases(studentId, daysAgoList, createdById = 2) {
    await prisma.case.createMany({
        data: daysAgoList.map((n, i) => ({
            studentId,
            title: `Caso ${i}`,
            category: "CONVIVENCIA",
            date: new Date(`${dayAgo(n)}T00:00:00Z`),
            description: "d",
            createdById,
        })),
    });
}

const recurrence = async (id) => (await request("GET", `/students/${id}`, { token: COORDINADOR })).body.data.recurrence;

describe("Reincidencia (3+ casos en 90 días)", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    it("2 casos NO es reincidente; 3 sí (el estudiante 1 ya trae 2 de los fixtures)", async () => {
        assert.deepEqual(await recurrence(1), { count: 2, minCases: 3, windowDays: 90, isRecurrent: false });

        await addCases(1, [5]);

        assert.deepEqual(await recurrence(1), { count: 3, minCases: 3, windowDays: 90, isRecurrent: true });
    });

    it("frontera: un caso de hace exactamente 90 días cuenta; de hace 91, no", async () => {
        await addCases(2, [1, 2, 91]);
        assert.equal((await recurrence(2)).count, 2);
        assert.equal((await recurrence(2)).isRecurrent, false);

        await prisma.case.deleteMany({ where: { studentId: 2 } });
        await addCases(2, [1, 2, 90]);
        assert.equal((await recurrence(2)).count, 3);
        assert.equal((await recurrence(2)).isRecurrent, true);
    });

    it("cuentan los casos de cualquier estado (un caso cerrado también es antecedente)", async () => {
        await addCases(2, [1, 2, 3]);
        await prisma.case.updateMany({ where: { studentId: 2 }, data: { status: "CERRADO", closedAt: new Date() } });

        assert.equal((await recurrence(2)).isRecurrent, true);
    });

    it("los casos de OTRO estudiante no cuentan", async () => {
        await addCases(3, [1, 2, 3]);

        assert.equal((await recurrence(2)).count, 0);
        assert.equal((await recurrence(3)).isRecurrent, true);
    });

    it("la reincidencia que ve un docente cuenta TODOS los casos (también los ajenos): es una alerta", async () => {
        const res = await request("GET", "/students/1", { token: DOCENTE }); // docente ve 1 caso suyo, pero hay 2 en total

        assert.equal(res.body.data.recurrence.count, 2);
    });
});

describe("Dashboard", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    it("totales, casos por estado (siempre los 3), por mes (12 meses), reincidentes y recientes", async () => {
        await addCases(2, [1, 2, 3]); // estudiante 2 queda reincidente
        await prisma.case.update({ where: { id: 1 }, data: { status: "CERRADO", closedAt: new Date() } });

        const d = (await request("GET", "/dashboard", { token: COORDINADOR })).body.data;

        assert.deepEqual(d.totals, { students: 3, cases: 5, openCases: 4 });
        assert.deepEqual(d.casesByStatus, { ABIERTO: 4, SEGUIMIENTO: 0, CERRADO: 1 });

        assert.equal(d.casesByMonth.length, 12);
        assert.equal(d.casesByMonth.at(-1).month, today().slice(0, 7));
        assert.equal(d.casesByMonth.reduce((sum, m) => sum + m.count, 0), 5);

        assert.deepEqual(d.recurrentStudents.map((r) => [r.student.code, r.count]), [["6002", 3]]);

        assert.equal(d.recentCases.length, 5);
        assert.ok(d.recentCases[0].student.fullName && d.recentCases[0].createdBy.fullName);
    });

    it("con la BD sin casos devuelve ceros, no errores", async () => {
        await prisma.document.deleteMany();
        await prisma.case.deleteMany();

        const d = (await request("GET", "/dashboard", { token: ADMIN })).body.data;

        assert.deepEqual(d.totals, { students: 3, cases: 0, openCases: 0 });
        assert.deepEqual(d.casesByStatus, { ABIERTO: 0, SEGUIMIENTO: 0, CERRADO: 0 });
        assert.deepEqual(d.recurrentStudents, []);
        assert.deepEqual(d.recentCases, []);
    });
});

describe("Reportes", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    const course = (qs = "grade=QUINTO&group=1") => request("GET", `/reports/course?${qs}`, { token: COORDINADOR });

    it("reporte de curso: estudiantes con asistencia, observaciones y casos (con sus seguimientos)", async () => {
        const { data } = (await course()).body;

        assert.deepEqual(data.course, { grade: "QUINTO", group: 1 });
        assert.deepEqual(data.range, { from: null, to: null });
        assert.deepEqual(data.students.map((s) => s.student.code), ["6001", "6002"]);
        assert.deepEqual(data.totals, { students: 2, attendance: 1, observations: 2, cases: 2, followUps: 1 });

        const ana = data.students[0];
        assert.equal(ana.cases.length, 2);
        assert.equal(ana.cases.find((c) => c.id === 1).followUps.length, 1);
        assert.equal(ana.attendance[0].status, "PRESENTE");
        assert.equal(data.students[1].cases.length, 0);
    });

    it("el rango de fechas filtra casos, observaciones, asistencia y seguimientos", async () => {
        const future = (await course(`grade=QUINTO&group=1&from=${dayAgo(-30)}`)).body.data;
        assert.deepEqual(future.totals, { students: 2, attendance: 0, observations: 0, cases: 0, followUps: 0 });

        // caso 2 es de hace 2 días; hasta hace 2 días solo entra ese
        const upTo = (await course(`grade=QUINTO&group=1&to=${dayAgo(2)}`)).body.data;
        assert.deepEqual(upTo.students[0].cases.map((c) => c.id), [2]);
        assert.equal(upTo.totals.followUps, 0);
    });

    it("un curso sin estudiantes devuelve listas vacías", async () => {
        const { data } = (await course("grade=NOVENO&group=4")).body;

        assert.deepEqual(data.students, []);
        assert.equal(data.totals.students, 0);
    });

    it("reporte individual de un estudiante, con y sin rango", async () => {
        const res = await request("GET", "/reports/student/1", { token: ADMIN });

        assert.equal(res.body.data.students.length, 1);
        assert.equal(res.body.data.students[0].student.code, "6001");
        assert.equal(res.body.data.totals.cases, 2);

        const empty = await request("GET", `/reports/student/1?from=${dayAgo(-10)}`, { token: ADMIN });
        assert.equal(empty.body.data.totals.cases, 0);
    });

    it("validaciones: grado/grupo inválidos o ausentes, rango invertido, estudiante inexistente", async () => {
        for (const qs of ["grade=SEXTO&group=1", "grade=QUINTO&group=7", "grade=QUINTO", `grade=QUINTO&group=1&from=${dayAgo(0)}&to=${dayAgo(9)}`, "grade=QUINTO&group=1&from=ayer"]) {
            assert.equal((await course(qs)).status, 400, qs);
        }
        assert.equal((await request("GET", "/reports/student/999", { token: ADMIN })).status, 404);
        assert.equal((await request("GET", `/reports/student/1?from=${dayAgo(0)}&to=${dayAgo(9)}`, { token: ADMIN })).status, 400);
    });

    it("el reporte no expone datos internos (hashes, storageKey)", async () => {
        const text = JSON.stringify((await course()).body);

        assert.ok(!/passwordHash|storageKey/.test(text));
    });
});
