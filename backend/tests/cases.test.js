// tests/cases.test.js — reglas de negocio de los casos
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { FILES, dayAgo, env, filesOnDisk, prisma, request, resetAndSeed, startServer, stopServer, tokens } from "./helpers/index.js";

const valid = () => ({ studentId: 2, title: "Caso nuevo", category: "CONVIVENCIA", date: dayAgo(0), description: "descripción" });
const create = (token, json) => request("POST", "/cases", { token, json });
const patch = (id, json, token = tokens.COORDINADOR) => request("PATCH", `/cases/${id}`, { token, json });

describe("Casos", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    describe("crear", () => {
        it("aplica valores por defecto, recorta textos y respeta el formato del contrato", async () => {
            const res = await create(tokens.DOCENTE, { ...valid(), title: "  Con espacios  " });

            assert.equal(res.status, 201);
            const c = res.body.data;
            assert.equal(c.title, "Con espacios");
            assert.equal(c.severity, "TIPO_I");
            assert.equal(c.status, "ABIERTO");
            assert.equal(c.closedAt, null);
            assert.equal(c.actions, null);
            assert.equal(c.date, dayAgo(0));
            assert.deepEqual(c.createdBy, { id: 3, fullName: "Docente Prueba" });
            assert.equal("storageKey" in c, false);
        });

        it("el docente solo puede crear casos ABIERTO", async () => {
            for (const status of ["SEGUIMIENTO", "CERRADO"]) {
                assert.equal((await create(tokens.DOCENTE, { ...valid(), status })).status, 403);
            }
        });

        it("coordinación puede crear un caso ya CERRADO y se llena closedAt", async () => {
            const res = await create(tokens.COORDINADOR, { ...valid(), status: "CERRADO" });

            assert.equal(res.status, 201);
            assert.ok(res.body.data.closedAt);
        });

        const invalid = {
            "título vacío": { title: "   " },
            "categoría inválida": { category: "XX" },
            "gravedad inválida": { severity: "TIPO_9" },
            "fecha con formato incorrecto": { date: "30/10/2026" },
            "fecha imposible (31 de febrero)": { date: "2026-02-31" },
            "descripción ausente": { description: undefined },
            "estudiante no numérico": { studentId: "abc" },
        };

        for (const [name, override] of Object.entries(invalid)) {
            it(`rechaza (400): ${name}`, async () => {
                assert.equal((await create(tokens.COORDINADOR, { ...valid(), ...override })).status, 400);
            });
        }

        it("estudiante inexistente = 404 y estudiante inactivo = 400", async () => {
            assert.equal((await create(tokens.COORDINADOR, { ...valid(), studentId: 999 })).status, 404);

            await prisma.student.update({ where: { id: 2 }, data: { active: false } });
            assert.equal((await create(tokens.COORDINADOR, valid())).status, 400);
        });
    });

    describe("editar (PATCH)", () => {
        it("editar SIN enviar status NO reabre un caso cerrado", async () => {
            const closed = (await patch(1, { status: "CERRADO" })).body.data;
            const edited = (await patch(1, { title: "Título nuevo", description: "otra" })).body.data;

            assert.equal(edited.status, "CERRADO");
            assert.equal(edited.closedAt, closed.closedAt);
            assert.equal(edited.title, "Título nuevo");
        });

        it("cerrar llena closedAt; cerrar de nuevo no lo cambia; reabrir lo limpia", async () => {
            const first = (await patch(1, { status: "CERRADO" })).body.data;
            assert.ok(first.closedAt);

            const again = (await patch(1, { status: "CERRADO" })).body.data;
            assert.equal(again.closedAt, first.closedAt);

            const reopened = (await patch(1, { status: "SEGUIMIENTO" })).body.data;
            assert.equal(reopened.closedAt, null);
            assert.equal(reopened.status, "SEGUIMIENTO");
        });

        it("'actions': omitirlo conserva el valor; null o vacío lo borra", async () => {
            await patch(1, { actions: "Acción 1" });

            assert.equal((await patch(1, { title: "x" })).body.data.actions, "Acción 1");
            assert.equal((await patch(1, { actions: "" })).body.data.actions, null);
        });

        it("no se puede mover el caso a otro estudiante (studentId se ignora)", async () => {
            const res = await patch(1, { studentId: 3, title: "x" });

            assert.equal(res.body.data.studentId, 1);
        });

        it("body vacío = 400; valores inválidos = 400; caso inexistente = 404", async () => {
            assert.equal((await patch(1, {})).status, 400);
            assert.equal((await patch(1, { severity: "TIPO_9" })).status, 400);
            assert.equal((await patch(999, { title: "x" })).status, 404);
        });

        it("el docente no puede editar (403) y el caso queda intacto", async () => {
            assert.equal((await patch(1, { title: "hack" }, tokens.DOCENTE)).status, 403);
            assert.equal((await prisma.case.findUnique({ where: { id: 1 } })).title, "Caso del docente");
        });
    });

    describe("visibilidad", () => {
        it("el docente solo lista sus casos; coordinación y admin ven todos", async () => {
            const own = (await request("GET", "/cases", { token: tokens.DOCENTE })).body.data;
            const all = (await request("GET", "/cases", { token: tokens.COORDINADOR })).body.data;

            assert.deepEqual(own.map((c) => c.id), [1]);
            assert.deepEqual(all.map((c) => c.id).sort(), [1, 2]);
        });

        it("el caso de otro se ve como inexistente para un docente (404, no 403)", async () => {
            assert.equal((await request("GET", "/cases/2", { token: tokens.DOCENTE })).status, 404);
            assert.equal((await request("GET", "/cases/1", { token: tokens.DOCENTE2 })).status, 404);
        });

        it("filtros: estudiante, estado, gravedad, categoría, rango y límite", async () => {
            await patch(2, { status: "SEGUIMIENTO", severity: "TIPO_II" });
            const list = async (qs) => (await request("GET", `/cases?${qs}`, { token: tokens.COORDINADOR })).body.data.map((c) => c.id);

            assert.deepEqual(await list("studentId=3"), []);
            assert.deepEqual(await list("status=SEGUIMIENTO"), [2]);
            assert.deepEqual(await list("severity=TIPO_II"), [2]);
            assert.deepEqual(await list("category=CONVIVENCIA"), [1]);
            assert.deepEqual(await list(`from=${dayAgo(1)}`), [1]);
            assert.deepEqual(await list(`to=${dayAgo(2)}`), [2]);
            assert.equal((await list("limit=1")).length, 1);
        });

        it("el orden es por fecha descendente", async () => {
            const ids = (await request("GET", "/cases", { token: tokens.COORDINADOR })).body.data.map((c) => c.id);

            assert.deepEqual(ids, [1, 2]); // caso 1 (ayer) antes que caso 2 (anteayer)
        });

        it("rango invertido o parámetros inválidos = 400", async () => {
            for (const qs of [`from=${dayAgo(0)}&to=${dayAgo(5)}`, "status=XX", "limit=0", "limit=9999"]) {
                assert.equal((await request("GET", `/cases?${qs}`, { token: tokens.COORDINADOR })).status, 400, qs);
            }
        });

        it("fechas del contrato: AAAA-MM-DD y sin desfase por zona horaria", async () => {
            const res = await create(tokens.COORDINADOR, { ...valid(), date: "2026-03-01" });

            assert.equal(res.body.data.date, "2026-03-01");
            assert.equal((await request("GET", `/cases/${res.body.data.id}`, { token: tokens.ADMIN })).body.data.date, "2026-03-01");
        });
    });

    describe("borrar", () => {
        it("borra en cascada seguimientos, compromisos, documentos y los ARCHIVOS del disco, sin tocar lo demás", async () => {
            assert.deepEqual(await filesOnDisk(), [FILES.caseDoc, FILES.studentDoc].sort());

            assert.equal((await request("DELETE", "/cases/1", { token: tokens.ADMIN })).status, 200);

            assert.equal(await prisma.case.count({ where: { id: 1 } }), 0);
            assert.equal(await prisma.caseFollowUp.count(), 0);
            assert.equal(await prisma.commitment.count(), 0);
            assert.equal(await prisma.document.count({ where: { caseId: 1 } }), 0);
            // el archivo de la evidencia se borró; el documento del estudiante y el caso 2 siguen
            assert.deepEqual(await filesOnDisk(), [FILES.studentDoc]);
            assert.equal(await prisma.document.count({ where: { studentId: 1 } }), 1);
            assert.equal(await prisma.case.count({ where: { id: 2 } }), 1);
        });

        it("si el archivo ya no existe en disco, el borrado igual funciona", async () => {
            await fs.rm(path.join(env.uploadDir, FILES.caseDoc));

            assert.equal((await request("DELETE", "/cases/1", { token: tokens.ADMIN })).status, 200);
        });

        it("caso inexistente = 404", async () => {
            assert.equal((await request("DELETE", "/cases/999", { token: tokens.ADMIN })).status, 404);
        });
    });
});

