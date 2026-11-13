// tests/database.test.js — lógica que vive en PostgreSQL:
// triggers (validación y auditoría), funciones, procedimiento almacenado,
// transacciones (COMMIT/ROLLBACK) y control de concurrencia.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { IDS, dayAgo, prisma, request, resetAndSeed, startServer, stopServer, tokens } from "./helpers/index.js";

const { ADMIN, COORDINADOR, DOCENTE } = tokens;
const history = async (caseId, token = COORDINADOR) => (await request("GET", `/cases/${caseId}/history`, { token })).body.data;
const newCase = (extra = {}) => ({ studentId: 2, title: "Caso nuevo", category: "CONVIVENCIA", date: dayAgo(0), description: "d", ...extra });

describe("Lógica en PostgreSQL", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    describe("trigger de validación (Case)", () => {
        it("rechaza un título vacío aunque se salte la API", async () => {
            await assert.rejects(
                prisma.case.create({ data: { studentId: 1, title: "   ", category: "OTRO", date: new Date(), description: "d", createdById: IDS.coord } }),
                /título del caso no puede estar vacío/
            );
        });

        it("mantiene closedAt coherente con el estado", async () => {
            const closed = await prisma.case.create({ data: { studentId: 1, title: "x", category: "OTRO", date: new Date(), description: "d", status: "CERRADO", createdById: IDS.coord } });
            assert.ok(closed.closedAt, "CERRADO sin closedAt => el trigger lo completa");

            const reopened = await prisma.case.update({ where: { id: closed.id }, data: { status: "ABIERTO" } });
            assert.equal(reopened.closedAt, null, "otro estado => closedAt queda en NULL");
        });
    });

    describe("trigger de validación (Attendance)", () => {
        it("no permite asistencia de un estudiante inactivo", async () => {
            await prisma.student.update({ where: { id: 2 }, data: { active: false } });

            await assert.rejects(
                prisma.attendance.create({ data: { studentId: 2, date: new Date(`${dayAgo(1)}T00:00:00Z`), status: "PRESENTE", registeredBy: IDS.docente } }),
                /estudiante inactivo/
            );
        });
    });

    describe("trigger de auditoría (CaseAudit)", () => {
        it("registra creación, cambio de estado, edición y borrado con QUIÉN lo hizo", async () => {
            const created = (await request("POST", "/cases", { token: DOCENTE, json: newCase() })).body.data;
            await request("PATCH", `/cases/${created.id}`, { token: COORDINADOR, json: { status: "SEGUIMIENTO" } });
            await request("PATCH", `/cases/${created.id}`, { token: COORDINADOR, json: { title: "Título editado" } });

            const rows = await history(created.id);
            assert.deepEqual(rows.map((r) => [r.action, r.oldStatus, r.newStatus, r.changedBy?.fullName]), [
                ["EDITADO", "SEGUIMIENTO", "SEGUIMIENTO", "Coord Prueba"],
                ["ESTADO", "ABIERTO", "SEGUIMIENTO", "Coord Prueba"],
                ["CREADO", null, "ABIERTO", "Docente Prueba"],
            ]);

            await request("DELETE", `/cases/${created.id}`, { token: ADMIN });
            const afterDelete = await history(created.id);
            assert.equal(afterDelete[0].action, "ELIMINADO");
            assert.equal(afterDelete[0].changedBy.fullName, "Admin Prueba");
            assert.equal(afterDelete.length, 4, "el historial sobrevive al caso borrado");
        });

        it("una edición que no cambia nada no genera fila de auditoría", async () => {
            const before = (await history(1)).length;

            await prisma.case.update({ where: { id: 1 }, data: { title: (await prisma.case.findUnique({ where: { id: 1 } })).title } });

            assert.equal((await history(1)).length, before);
        });

        it("la tabla es de solo lectura: ni UPDATE ni DELETE", async () => {
            await assert.rejects(prisma.$executeRaw`DELETE FROM "CaseAudit"`, /solo lectura/);
            await assert.rejects(prisma.$executeRaw`UPDATE "CaseAudit" SET "action" = 'X'`, /solo lectura/);
        });

        it("el historial solo lo ven ADMIN y COORDINADOR; un caso que nunca existió es 404", async () => {
            assert.equal((await request("GET", "/cases/1/history", { token: DOCENTE })).status, 403);
            assert.equal((await request("GET", "/cases/999/history", { token: ADMIN })).status, 404);
        });
    });

    describe("funciones", () => {
        it("fn_contar_casos_desde y fn_es_reincidente", async () => {
            const [row] = await prisma.$queryRaw`
                SELECT fn_contar_casos_desde(1, ${dayAgo(30)}::date) AS total,
                       fn_es_reincidente(1, ${dayAgo(30)}::date, 2) AS si,
                       fn_es_reincidente(1, ${dayAgo(30)}::date, 3) AS no,
                       fn_contar_casos_desde(1, ${dayAgo(0)}::date) AS hoy`;

            assert.deepEqual(row, { total: 2, si: true, no: false, hoy: 0 });
        });

        it("la API usa la función: coincide con el conteo directo", async () => {
            const { recurrence } = (await request("GET", "/students/1", { token: COORDINADOR })).body.data;

            assert.equal(recurrence.count, 2);
        });
    });

    describe("procedimiento almacenado sp_cerrar_caso (POST /cases/:id/close)", () => {
        it("cierra el caso, crea un seguimiento automático y audita al usuario", async () => {
            const res = await request("POST", "/cases/1/close", { token: COORDINADOR });

            assert.equal(res.status, 200);
            assert.equal(res.body.data.status, "CERRADO");
            assert.ok(res.body.data.closedAt);

            const followUps = (await request("GET", "/cases/1/follow-ups", { token: COORDINADOR })).body.data;
            assert.ok(followUps.some((f) => f.description === "Caso cerrado." && f.responsible.fullName === "Coord Prueba"));

            const [last] = await history(1);
            assert.deepEqual([last.action, last.oldStatus, last.newStatus, last.changedBy.fullName], ["ESTADO", "ABIERTO", "CERRADO", "Coord Prueba"]);
        });

        it("cerrar un caso ya cerrado = 409; inexistente = 404; docente = 403", async () => {
            await request("POST", "/cases/1/close", { token: COORDINADOR });

            assert.equal((await request("POST", "/cases/1/close", { token: COORDINADOR })).status, 409);
            assert.equal((await request("POST", "/cases/999/close", { token: COORDINADOR })).status, 404);
            assert.equal((await request("POST", "/cases/2/close", { token: DOCENTE })).status, 403);
        });
    });

    describe("transacciones", () => {
        it("ROLLBACK: si algo falla a mitad de camino no queda nada guardado", async () => {
            const antes = await prisma.case.count();

            await assert.rejects(
                prisma.$transaction(async (tx) => {
                    await tx.case.create({ data: { studentId: 1, title: "temporal", category: "OTRO", date: new Date(), description: "d", createdById: IDS.coord } });
                    throw new Error("falla simulada"); // => ROLLBACK
                }),
                /falla simulada/
            );

            assert.equal(await prisma.case.count(), antes);
            assert.equal(await prisma.caseAudit.count({ where: { action: "CREADO" } }), antes, "la auditoría también se revirtió");
        });

        it("COMMIT: si todo sale bien, el caso y su auditoría se guardan juntos", async () => {
            const antes = await prisma.case.count();

            await prisma.$transaction(async (tx) => {
                await tx.case.create({ data: { studentId: 1, title: "definitivo", category: "OTRO", date: new Date(), description: "d", createdById: IDS.coord } });
            });

            assert.equal(await prisma.case.count(), antes + 1);
            assert.equal(await prisma.caseAudit.count({ where: { action: "CREADO" } }), antes + 1);
        });
    });

    describe("control de concurrencia", () => {
        it("dos cierres simultáneos del mismo caso: uno gana (200) y el otro recibe 409", async () => {
            const results = await Promise.all([
                request("POST", "/cases/1/close", { token: COORDINADOR }),
                request("POST", "/cases/1/close", { token: ADMIN }),
            ]);

            assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
            assert.equal(await prisma.caseFollowUp.count({ where: { caseId: 1, description: "Caso cerrado." } }), 1);
            assert.equal(await prisma.caseAudit.count({ where: { caseId: 1, action: "ESTADO" } }), 1);
        });

        it("bloqueo optimista: editar con una versión vieja = 409 y no pisa los cambios del otro", async () => {
            const { updatedAt } = (await request("GET", "/cases/1", { token: COORDINADOR })).body.data;
            const patch = (json, token = COORDINADOR) => request("PATCH", "/cases/1", { token, json: { expectedUpdatedAt: updatedAt, ...json } });

            assert.equal((await patch({ title: "Cambio de la persona A" })).status, 200);

            const stale = await patch({ title: "Cambio de la persona B" }, ADMIN);
            assert.equal(stale.status, 409);
            assert.match(stale.body.message, /modificado por otra persona/);
            assert.equal((await prisma.case.findUnique({ where: { id: 1 } })).title, "Cambio de la persona A");
        });

        it("dos ediciones simultáneas con la misma versión: solo una se aplica", async () => {
            const { updatedAt } = (await request("GET", "/cases/1", { token: COORDINADOR })).body.data;
            const edit = (title) => request("PATCH", "/cases/1", { token: COORDINADOR, json: { expectedUpdatedAt: updatedAt, title } });

            const results = await Promise.all([edit("Uno"), edit("Dos")]);

            assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        });

        it("sin expectedUpdatedAt el PATCH funciona como siempre (compatibilidad)", async () => {
            assert.equal((await request("PATCH", "/cases/1", { token: COORDINADOR, json: { title: "Sin versión" } })).status, 200);
        });

        it("expectedUpdatedAt con formato inválido = 400", async () => {
            assert.equal((await request("PATCH", "/cases/1", { token: COORDINADOR, json: { title: "x", expectedUpdatedAt: "ayer" } })).status, 400);
        });
    });
});
