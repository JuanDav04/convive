// tests/records.test.js — seguimientos, compromisos, observaciones y asistencia
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { dayAgo, prisma, request, resetAndSeed, startServer, stopServer, today, tokens } from "./helpers/index.js";

const { ADMIN, COORDINADOR, DOCENTE, DOCENTE2 } = tokens;

describe("Seguimientos, compromisos, observaciones y asistencia", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    describe("seguimientos", () => {
        it("el responsable es quien está logueado y la fecha por defecto es HOY (zona Colombia)", async () => {
            const res = await request("POST", "/cases/1/follow-ups", { token: DOCENTE, json: { description: "  Se habló con acudientes " } });

            assert.equal(res.status, 201);
            assert.equal(res.body.data.description, "Se habló con acudientes");
            assert.equal(res.body.data.date, today());
            assert.equal(res.body.data.responsible.fullName, "Docente Prueba");
        });

        it("se listan en orden cronológico", async () => {
            await request("POST", "/cases/1/follow-ups", { token: COORDINADOR, json: { description: "antiguo", date: dayAgo(10) } });

            const list = (await request("GET", "/cases/1/follow-ups", { token: COORDINADOR })).body.data;

            assert.deepEqual(list.map((f) => f.description), ["antiguo", "seg"]);
        });

        it("descripción vacía o fecha imposible = 400; caso inexistente = 404", async () => {
            assert.equal((await request("POST", "/cases/1/follow-ups", { token: ADMIN, json: { description: "  " } })).status, 400);
            assert.equal((await request("POST", "/cases/1/follow-ups", { token: ADMIN, json: { description: "x", date: "2026-02-30" } })).status, 400);
            assert.equal((await request("POST", "/cases/999/follow-ups", { token: ADMIN, json: { description: "x" } })).status, 404);
        });

        it("un docente NO ve ni escribe seguimientos en casos ajenos (404)", async () => {
            assert.equal((await request("GET", "/cases/2/follow-ups", { token: DOCENTE })).status, 404);
            assert.equal((await request("POST", "/cases/2/follow-ups", { token: DOCENTE, json: { description: "x" } })).status, 404);
            assert.equal((await request("POST", "/cases/1/follow-ups", { token: DOCENTE2, json: { description: "x" } })).status, 404);
        });

        it("solo staff o el autor editan/borran; otro docente no puede ni saber que existe", async () => {
            // seguimiento 1: del docente (3). Coordinación escribe el 2 en el mismo caso.
            await request("POST", "/cases/1/follow-ups", { token: COORDINADOR, json: { description: "del coord" } });

            // el docente NO puede tocar el de coordinación (aunque el caso sea suyo)
            assert.equal((await request("PATCH", "/follow-ups/2", { token: DOCENTE, json: { description: "hack" } })).status, 403);
            assert.equal((await request("DELETE", "/follow-ups/2", { token: DOCENTE })).status, 403);
            // el docente 2 no ve el caso: 404
            assert.equal((await request("PATCH", "/follow-ups/1", { token: DOCENTE2, json: { description: "hack" } })).status, 404);
            // el autor sí; coordinación puede con cualquiera
            assert.equal((await request("PATCH", "/follow-ups/1", { token: DOCENTE, json: { description: "mío editado" } })).body.data.description, "mío editado");
            assert.equal((await request("PATCH", "/follow-ups/1", { token: COORDINADOR, json: { description: "editado por coord" } })).status, 200);
            assert.equal((await request("DELETE", "/follow-ups/2", { token: ADMIN })).status, 200);
            assert.equal((await request("DELETE", "/follow-ups/999", { token: ADMIN })).status, 404);
        });
    });

    describe("compromisos", () => {
        it("por defecto PENDIENTE y el responsable es quien lo crea; el docente puede leerlos", async () => {
            const res = await request("POST", "/cases/1/commitments", { token: COORDINADOR, json: { description: "Asistir a reunión", dueDate: "2026-12-01" } });

            assert.equal(res.status, 201);
            assert.equal(res.body.data.status, "PENDIENTE");
            assert.equal(res.body.data.dueDate, "2026-12-01");
            assert.equal(res.body.data.responsible.fullName, "Coord Prueba");
            assert.equal((await request("GET", "/cases/1/commitments", { token: DOCENTE })).body.data.length, 2);
            assert.equal((await request("GET", "/cases/2/commitments", { token: DOCENTE })).status, 404);
        });

        it("se puede cambiar el estado y borrar la fecha límite (null) sin perder el resto", async () => {
            await request("PATCH", "/commitments/1", { token: COORDINADOR, json: { dueDate: "2026-12-01" } });

            const done = (await request("PATCH", "/commitments/1", { token: COORDINADOR, json: { status: "CUMPLIDO" } })).body.data;
            assert.equal(done.status, "CUMPLIDO");
            assert.equal(done.dueDate, "2026-12-01");

            assert.equal((await request("PATCH", "/commitments/1", { token: COORDINADOR, json: { dueDate: null } })).body.data.dueDate, null);
        });

        it("validaciones: estado inválido, fecha inválida, responsable inexistente o inactivo, body vacío", async () => {
            const bad = (json, id = 1) => request("PATCH", `/commitments/${id}`, { token: COORDINADOR, json });
            assert.equal((await bad({ status: "XX" })).status, 400);
            assert.equal((await bad({ dueDate: "mañana" })).status, 400);
            assert.equal((await bad({})).status, 400);
            assert.equal((await bad({ status: "CUMPLIDO" }, 999)).status, 404);

            const create = (responsibleId) => request("POST", "/cases/1/commitments", { token: COORDINADOR, json: { description: "x", responsibleId } });
            assert.equal((await create(999)).status, 400);

            await prisma.user.update({ where: { id: 4 }, data: { active: false } });
            assert.equal((await create(4)).status, 400);
            assert.equal((await create(3)).status, 201);
        });

        it("borrar y 404 al borrar de nuevo", async () => {
            assert.equal((await request("DELETE", "/commitments/1", { token: COORDINADOR })).status, 200);
            assert.equal((await request("DELETE", "/commitments/1", { token: COORDINADOR })).status, 404);
        });
    });

    describe("observaciones", () => {
        it("el docente solo ve las suyas; coordinación ve todas", async () => {
            const own = (await request("GET", "/students/1/observations", { token: DOCENTE })).body.data;
            const all = (await request("GET", "/students/1/observations", { token: COORDINADOR })).body.data;

            assert.deepEqual(own.map((o) => o.description), ["obs docente"]);
            assert.equal(all.length, 2);
            assert.deepEqual((await request("GET", "/students/1/observations", { token: DOCENTE2 })).body.data, []);
        });

        it("crear: fecha por defecto hoy, responsable = usuario; validaciones", async () => {
            const res = await request("POST", "/students/2/observations", { token: DOCENTE, json: { type: "COMPORTAMIENTO", description: " nueva " } });

            assert.equal(res.status, 201);
            assert.equal(res.body.data.date, today());
            assert.equal(res.body.data.description, "nueva");
            assert.equal(res.body.data.responsible.fullName, "Docente Prueba");

            const bad = (json, id = 2) => request("POST", `/students/${id}/observations`, { token: DOCENTE, json });
            assert.equal((await bad({ type: "XX", description: "x" })).status, 400);
            assert.equal((await bad({ type: "OTRA", description: "" })).status, 400);
            assert.equal((await bad({ type: "OTRA", description: "x" }, 999)).status, 404);
        });

        it("filtra por rango de fechas", async () => {
            await request("POST", "/students/1/observations", { token: COORDINADOR, json: { type: "OTRA", description: "vieja", date: dayAgo(30) } });

            const inRange = (await request("GET", `/students/1/observations?from=${dayAgo(5)}`, { token: COORDINADOR })).body.data;

            assert.ok(inRange.every((o) => o.description !== "vieja"));
        });

        it("borrar: staff o autor; la de otro se ve como inexistente (404) para un docente", async () => {
            assert.equal((await request("DELETE", "/observations/2", { token: DOCENTE })).status, 404); // es de coord
            assert.equal((await request("DELETE", "/observations/1", { token: DOCENTE2 })).status, 404); // es de docente 1
            assert.equal((await request("DELETE", "/observations/1", { token: DOCENTE })).status, 200);
            assert.equal((await request("DELETE", "/observations/2", { token: COORDINADOR })).status, 200);
        });
    });

    describe("asistencia", () => {
        const save = (records, date = dayAgo(1), token = DOCENTE) => request("PUT", "/attendance", { token, json: { date, records } });

        it("guarda el día de un curso y lo devuelve en el formato del contrato", async () => {
            const res = await save([{ studentId: 1, status: "PRESENTE" }, { studentId: 2, status: "AUSENTE" }]);

            assert.equal(res.status, 200);
            assert.deepEqual(res.body.data.map((a) => [a.studentId, a.status, a.date]), [[1, "PRESENTE", dayAgo(1)], [2, "AUSENTE", dayAgo(1)]]);
        });

        it("un solo registro por estudiante por día: guardar de nuevo ACTUALIZA, no duplica", async () => {
            await save([{ studentId: 1, status: "PRESENTE" }]);
            await save([{ studentId: 1, status: "TARDE" }]);

            const rows = await prisma.attendance.findMany({ where: { studentId: 1, date: new Date(`${dayAgo(1)}T00:00:00Z`) } });

            assert.equal(rows.length, 1);
            assert.equal(rows[0].status, "TARDE");
            assert.equal(rows[0].registeredBy, 3);
        });

        it("si el mismo estudiante viene repetido gana el último valor", async () => {
            await save([{ studentId: 2, status: "PRESENTE" }, { studentId: 2, status: "JUSTIFICADA" }]);

            const [row] = (await request("GET", `/attendance?studentId=2&date=${dayAgo(1)}`, { token: DOCENTE })).body.data;

            assert.equal(row.status, "JUSTIFICADA");
        });

        it("es atómico: si un estudiante no existe NO se guarda ninguno del lote", async () => {
            const res = await save([{ studentId: 2, status: "PRESENTE" }, { studentId: 999, status: "PRESENTE" }]);

            assert.equal(res.status, 400);
            assert.deepEqual(res.body.details.studentIds, [999]);
            assert.equal(await prisma.attendance.count({ where: { studentId: 2 } }), 0);
        });

        it("rechaza estudiantes inactivos, estados inválidos, lote vacío y fechas inválidas", async () => {
            await prisma.student.update({ where: { id: 2 }, data: { active: false } });

            assert.equal((await save([{ studentId: 2, status: "PRESENTE" }])).status, 400);
            assert.equal((await save([{ studentId: 1, status: "XX" }])).status, 400);
            assert.equal((await save([])).status, 400);
            assert.equal((await save([{ studentId: 1, status: "PRESENTE" }], "2026-13-01")).status, 400);
        });

        it("consulta por curso, por estudiante y por rango; exige parámetros", async () => {
            await save([{ studentId: 1, status: "PRESENTE" }, { studentId: 2, status: "AUSENTE" }], dayAgo(1));
            await save([{ studentId: 1, status: "TARDE" }], dayAgo(3));
            const get = async (qs) => (await request("GET", `/attendance?${qs}`, { token: DOCENTE })).body.data;

            assert.equal((await get(`grade=QUINTO&group=1&date=${dayAgo(1)}`)).length, 2);
            assert.equal((await get("grade=NOVENO&group=1")).length, 0);
            assert.equal((await get(`studentId=1&from=${dayAgo(5)}&to=${dayAgo(2)}`)).length, 1);
            assert.equal((await get("studentId=1")).length, 3); // incluye el de fixture de hoy

            assert.equal((await request("GET", "/attendance", { token: DOCENTE })).status, 400);
            assert.equal((await request("GET", "/attendance?grade=QUINTO", { token: DOCENTE })).status, 400);
        });
    });
});
