// tests/permissions.test.js
// MATRIZ RUTA × ROL: cada ruta de la API se prueba con los tres roles
// (permitido y prohibido) y sin token. Cada caso arranca de la BD reiniciada,
// así ninguna prueba depende de otra.
//
// Al final hay una prueba de COBERTURA: si agregas una ruta nueva y no la
// pones en esta tabla, la suite falla (no se puede olvidar probar una ruta).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { dayAgo, fileForm, request, resetAndSeed, startServer, stopServer, tokens } from "./helpers/index.js";

// A = ADMIN, C = COORDINADOR, D = DOCENTE: código HTTP esperado para cada rol.
const body = {
    newUser: () => ({ username: "nuevo.usuario", password: "clave12345", fullName: "Nuevo Usuario" }),
    newStudent: () => ({ code: "7001", fullName: "Nuevo Alumno", grade: "NOVENO", group: 2 }),
    newCase: () => ({ studentId: 2, title: "Caso nuevo", category: "CONVIVENCIA", date: dayAgo(0), description: "desc" }),
    attendance: () => ({ date: dayAgo(0), records: [{ studentId: 1, status: "PRESENTE" }, { studentId: 2, status: "TARDE" }] }),
};

const MATRIX = [
    // ── Autenticación ──
    { route: "GET /auth/me", path: "/auth/me", A: 200, C: 200, D: 200 },
    // ── Usuarios (solo ADMIN) ──
    { route: "GET /users", path: "/users", A: 200, C: 403, D: 403 },
    { route: "POST /users", path: "/users", json: body.newUser, A: 201, C: 403, D: 403 },
    { route: "PATCH /users/:id", path: "/users/4", json: () => ({ fullName: "Renombrado" }), A: 200, C: 403, D: 403 },
    // ── Estudiantes ──
    { route: "GET /students", path: "/students", A: 200, C: 200, D: 200 },
    { route: "GET /students/:id", path: "/students/1", A: 200, C: 200, D: 200 },
    { route: "POST /students", path: "/students", json: body.newStudent, A: 201, C: 201, D: 403 },
    { route: "PATCH /students/:id", path: "/students/1", json: () => ({ fullName: "Otro Nombre" }), A: 200, C: 200, D: 403 },
    // ── Casos ──
    { route: "GET /cases", path: "/cases", A: 200, C: 200, D: 200 },
    { route: "GET /cases/:id", path: "/cases/1", A: 200, C: 200, D: 200 },
    { route: "POST /cases", path: "/cases", json: body.newCase, A: 201, C: 201, D: 201 },
    { route: "PATCH /cases/:id", path: "/cases/1", json: () => ({ title: "Editado" }), A: 200, C: 200, D: 403 },
    { route: "POST /cases/:id/close", path: "/cases/1/close", A: 200, C: 200, D: 403 },
    { route: "GET /cases/:id/history", path: "/cases/1/history", A: 200, C: 200, D: 403 },
    { route: "DELETE /cases/:id", path: "/cases/1", A: 200, C: 403, D: 403 },
    // ── Seguimientos ──
    { route: "GET /cases/:id/follow-ups", path: "/cases/1/follow-ups", A: 200, C: 200, D: 200 },
    { route: "POST /cases/:id/follow-ups", path: "/cases/1/follow-ups", json: () => ({ description: "nuevo" }), A: 201, C: 201, D: 201 },
    { route: "PATCH /follow-ups/:id", path: "/follow-ups/1", json: () => ({ description: "editado" }), A: 200, C: 200, D: 200 },
    { route: "DELETE /follow-ups/:id", path: "/follow-ups/1", A: 200, C: 200, D: 200 },
    // ── Compromisos ──
    { route: "GET /cases/:id/commitments", path: "/cases/1/commitments", A: 200, C: 200, D: 200 },
    { route: "POST /cases/:id/commitments", path: "/cases/1/commitments", json: () => ({ description: "nuevo" }), A: 201, C: 201, D: 403 },
    { route: "PATCH /commitments/:id", path: "/commitments/1", json: () => ({ status: "CUMPLIDO" }), A: 200, C: 200, D: 403 },
    { route: "DELETE /commitments/:id", path: "/commitments/1", A: 200, C: 200, D: 403 },
    // ── Observaciones ──
    { route: "GET /students/:id/observations", path: "/students/1/observations", A: 200, C: 200, D: 200 },
    { route: "POST /students/:id/observations", path: "/students/1/observations", json: () => ({ type: "OTRA", description: "nueva" }), A: 201, C: 201, D: 201 },
    { route: "DELETE /observations/:id", path: "/observations/1", A: 200, C: 200, D: 200 },
    // ── Asistencia ──
    { route: "GET /attendance", path: "/attendance?grade=QUINTO&group=1", A: 200, C: 200, D: 200 },
    { route: "PUT /attendance", path: "/attendance", json: body.attendance, A: 200, C: 200, D: 200 },
    // ── Documentos ──
    { route: "GET /documents", path: "/documents?caseId=1", A: 200, C: 200, D: 200 },
    { route: "GET /documents", path: "/documents?studentId=1", A: 200, C: 200, D: 403, label: "de estudiante" },
    { route: "POST /documents", path: "/documents", form: () => fileForm({ type: "EVIDENCIA", caseId: 1 }), A: 201, C: 201, D: 201, label: "a un caso" },
    { route: "POST /documents", path: "/documents", form: () => fileForm({ type: "OBSERVADOR", studentId: 1 }), A: 201, C: 201, D: 403, label: "a un estudiante" },
    { route: "GET /documents/:id/download", path: "/documents/1/download", A: 200, C: 200, D: 200, label: "evidencia de caso" },
    { route: "GET /documents/:id/download", path: "/documents/2/download", A: 200, C: 200, D: 403, label: "documento de estudiante" },
    { route: "DELETE /documents/:id", path: "/documents/1", A: 200, C: 200, D: 200, label: "evidencia de caso" },
    { route: "DELETE /documents/:id", path: "/documents/2", A: 200, C: 200, D: 403, label: "documento de estudiante" },
    // ── Dashboard y reportes (solo coordinación) ──
    { route: "GET /dashboard", path: "/dashboard", A: 200, C: 200, D: 403 },
    { route: "GET /reports/course", path: "/reports/course?grade=QUINTO&group=1", A: 200, C: 200, D: 403 },
    { route: "GET /reports/student/:id", path: "/reports/student/1", A: 200, C: 200, D: 403 },
];

// Rutas que NO exigen token.
const PUBLIC = [
    { route: "GET /health", path: "/health", expect: 200 },
    { route: "POST /auth/login", path: "/auth/login", json: { username: "admin", password: "x" }, expect: 401 }, // llega al handler (credenciales malas), no es 401 por falta de token
];

const ROLE_TOKEN = { A: "ADMIN", C: "COORDINADOR", D: "DOCENTE" };
const method = (row) => row.route.split(" ")[0];
const resolve = (value) => (typeof value === "function" ? value() : value);

describe("Permisos: ruta × rol", () => {
    before(async () => startServer());
    after(async () => stopServer());

    for (const row of MATRIX) {
        const title = `${row.route} ${row.label ? `(${row.label}) ` : ""}→ ${row.path}`;

        for (const [key, role] of Object.entries(ROLE_TOKEN)) {
            it(`${role}: ${title} = ${row[key]}`, async () => {
                await resetAndSeed();

                const res = await request(method(row), row.path, {
                    token: tokens[role],
                    json: resolve(row.json),
                    form: resolve(row.form),
                });

                assert.equal(res.status, row[key], JSON.stringify(res.body).slice(0, 200));

                // Una respuesta 403 siempre trae mensaje y NO debe haber ejecutado nada.
                if (row[key] === 403) assert.ok(res.body.message);
            });
        }

        it(`SIN TOKEN: ${title} = 401`, async () => {
            await resetAndSeed();

            const res = await request(method(row), row.path, { json: resolve(row.json), form: resolve(row.form) });

            assert.equal(res.status, 401);
            assert.ok(res.body.message);
        });
    }

    for (const row of PUBLIC) {
        it(`PÚBLICA: ${row.route} responde sin token (${row.expect})`, async () => {
            await resetAndSeed();

            assert.equal((await request(method(row), row.path, { json: row.json })).status, row.expect);
        });
    }

    it("un 403 de un rol prohibido no modifica los datos", async () => {
        await resetAndSeed();
        const { prisma } = await import("./helpers/index.js");

        await request("DELETE", "/cases/1", { token: tokens.COORDINADOR });
        await request("PATCH", "/cases/1", { token: tokens.DOCENTE, json: { title: "Hackeado" } });
        await request("DELETE", "/commitments/1", { token: tokens.DOCENTE });

        const caso = await prisma.case.findUnique({ where: { id: 1 } });

        assert.equal(caso.title, "Caso del docente");
        assert.equal(await prisma.commitment.count(), 1);
    });

    // ── Cobertura: toda ruta registrada en Express debe estar en la tabla ──
    it("COBERTURA: todas las rutas de la API están en la matriz", () => {
        const registered = new Set();

        (function collect(stack) {
            for (const layer of stack) {
                if (layer.route) {
                    for (const m of Object.keys(layer.route.methods)) {
                        registered.add(`${m.toUpperCase()} ${layer.route.path}`);
                    }
                } else if (layer.handle?.stack) {
                    collect(layer.handle.stack);
                }
            }
        })(createApp().router.stack);

        const tested = new Set([...MATRIX, ...PUBLIC].map((r) => r.route));
        const missing = [...registered].filter((r) => !tested.has(r));

        assert.ok(registered.size >= 30, `Se esperaba descubrir las rutas (hallé ${registered.size})`);
        assert.deepEqual(missing, [], `Rutas sin prueba de permisos: ${missing.join(", ")}`);
    });
});
