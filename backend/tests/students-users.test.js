// tests/students-users.test.js — estudiantes y usuarios
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { PASSWORD, request, resetAndSeed, startServer, stopServer, tokens } from "./helpers/index.js";

const { ADMIN, COORDINADOR, DOCENTE } = tokens;
const list = async (qs = "", token = DOCENTE) => (await request("GET", `/students${qs}`, { token })).body.data;

describe("Estudiantes", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    it("lista ordenada y en el formato del contrato (sin campos internos)", async () => {
        const all = await list();

        assert.deepEqual(all.map((s) => s.code), ["6001", "6002", "6003"]);
        assert.deepEqual(Object.keys(all[0]).sort(), ["active", "code", "fullName", "grade", "group", "id"]);
    });

    it("filtra por grado, grupo y búsqueda (nombre o código, sin importar mayúsculas)", async () => {
        assert.equal((await list("?grade=NOVENO")).length, 1);
        assert.equal((await list("?grade=QUINTO&group=1")).length, 2);
        assert.equal((await list("?group=2")).length, 0);
        assert.deepEqual((await list("?search=CARLA")).map((s) => s.code), ["6003"]);
        assert.deepEqual((await list("?search=6002")).map((s) => s.code), ["6002"]);
    });

    it("parámetros inválidos = 400", async () => {
        for (const qs of ["?grade=SEXTO", "?group=5", "?group=0", "?active=quizas"]) {
            assert.equal((await request("GET", `/students${qs}`, { token: DOCENTE })).status, 400, qs);
        }
    });

    it("GET /students/:id incluye la reincidencia; 404 si no existe; 400 si el id no es numérico", async () => {
        const res = await request("GET", "/students/1", { token: DOCENTE });

        assert.equal(res.body.data.code, "6001");
        assert.deepEqual(Object.keys(res.body.data.recurrence).sort(), ["count", "isRecurrent", "minCases", "windowDays"]);
        assert.equal((await request("GET", "/students/999", { token: DOCENTE })).status, 404);
        assert.equal((await request("GET", "/students/abc", { token: DOCENTE })).status, 400);
    });

    it("crear: código repetido = 409; campos inválidos = 400", async () => {
        const body = { code: "7001", fullName: "  Nuevo Alumno ", grade: "NOVENO", group: 2 };

        const created = await request("POST", "/students", { token: COORDINADOR, json: body });
        assert.equal(created.status, 201);
        assert.equal(created.body.data.fullName, "Nuevo Alumno");
        assert.equal(created.body.data.active, true);

        assert.equal((await request("POST", "/students", { token: COORDINADOR, json: body })).status, 409);
        assert.equal((await request("POST", "/students", { token: COORDINADOR, json: { ...body, code: "7002", group: 9 } })).status, 400);
        assert.equal((await request("POST", "/students", { token: COORDINADOR, json: { ...body, code: "7003", grade: "X" } })).status, 400);
    });

    it("desactivar a un estudiante lo oculta de la lista por defecto y no permite nuevos casos", async () => {
        const res = await request("PATCH", "/students/2", { token: COORDINADOR, json: { active: false } });

        assert.equal(res.body.data.active, false);
        assert.deepEqual((await list()).map((s) => s.code), ["6001", "6003"]);
        assert.equal((await list("?active=false")).length, 1);
        assert.equal((await list("?active=all")).length, 3);
    });

    it("editar: parche vacío = 400, inexistente = 404, código duplicado = 409", async () => {
        const patch = (id, json) => request("PATCH", `/students/${id}`, { token: COORDINADOR, json });

        assert.equal((await patch(1, {})).status, 400);
        assert.equal((await patch(999, { fullName: "x" })).status, 404);
        assert.equal((await patch(1, { code: "6002" })).status, 409);
        assert.equal((await patch(1, { grade: "NOVENO", group: 4 })).body.data.group, 4);
    });
});

describe("Usuarios", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    const create = (json, token = ADMIN) => request("POST", "/users", { token, json });
    const login = (username, password) => request("POST", "/auth/login", { json: { username, password } });

    it("lista sin contraseñas", async () => {
        const users = (await request("GET", "/users", { token: ADMIN })).body.data;

        assert.equal(users.length, 4);
        assert.ok(users.every((u) => !("passwordHash" in u) && !("password" in u)));
    });

    it("crear: rol DOCENTE por defecto, la contraseña se guarda cifrada y el usuario puede entrar", async () => {
        const res = await create({ username: "profe.nuevo", password: "clave12345", fullName: "Profe Nuevo" });

        assert.equal(res.status, 201);
        assert.equal(res.body.data.role, "DOCENTE");
        assert.equal((await login("profe.nuevo", "clave12345")).status, 200);
        assert.equal((await login("profe.nuevo", "otra")).status, 401);
    });

    it("validaciones: usuario repetido (409), contraseña corta o muy larga, usuario con caracteres raros, rol inválido (400)", async () => {
        assert.equal((await create({ username: "docente", password: "clave12345", fullName: "x" })).status, 409);
        assert.equal((await create({ username: "uno.mas", password: "corta", fullName: "x" })).status, 400);
        assert.equal((await create({ username: "uno.mas", password: "x".repeat(73), fullName: "x" })).status, 400);
        assert.equal((await create({ username: "con espacio!", password: "clave12345", fullName: "x" })).status, 400);
        assert.equal((await create({ username: "uno.mas", password: "clave12345", fullName: "x", role: "REY" })).status, 400);
    });

    it("el admin puede cambiar contraseña, rol y activar/desactivar; el usuario desactivado no entra", async () => {
        const patch = (id, json) => request("PATCH", `/users/${id}`, { token: ADMIN, json });

        await patch(3, { password: "nueva-clave-123" });
        assert.equal((await login("docente", PASSWORD)).status, 401);
        assert.equal((await login("docente", "nueva-clave-123")).status, 200);

        assert.equal((await patch(3, { role: "COORDINADOR" })).body.data.role, "COORDINADOR");

        await patch(3, { active: false });
        assert.equal((await login("docente", "nueva-clave-123")).status, 401);
    });

    it("el admin no puede desactivarse ni quitarse el rol a sí mismo", async () => {
        const patch = (json) => request("PATCH", "/users/1", { token: ADMIN, json });

        assert.equal((await patch({ active: false })).status, 400);
        assert.equal((await patch({ role: "DOCENTE" })).status, 400);
        assert.equal((await patch({ fullName: "Nuevo Nombre" })).status, 200);
    });

    it("parche vacío = 400; usuario inexistente = 404", async () => {
        assert.equal((await request("PATCH", "/users/2", { token: ADMIN, json: {} })).status, 400);
        assert.equal((await request("PATCH", "/users/999", { token: ADMIN, json: { fullName: "x" } })).status, 404);
    });
});
