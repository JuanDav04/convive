// tests/auth.test.js — login, tokens y errores generales
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { PASSWORD, env, prisma, request, resetAndSeed, signToken, startServer, stopServer, tokens } from "./helpers/index.js";

const login = (username, password) => request("POST", "/auth/login", { json: { username, password } });

describe("Autenticación", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    it("login correcto: token, expiración futura en ISO y usuario sin datos sensibles", async () => {
        const res = await login("coord", PASSWORD);

        assert.equal(res.status, 200);
        const { token, expiresAt, user } = res.body.data;
        assert.equal(jwt.verify(token, env.JWT_SECRET).sub, "2");
        assert.ok(new Date(expiresAt) > new Date());
        assert.deepEqual(Object.keys(user).sort(), ["fullName", "id", "role", "username"]);
        assert.equal(user.role, "COORDINADOR");
    });

    it("contraseña incorrecta y usuario inexistente dan EL MISMO error (no revela qué usuarios existen)", async () => {
        const badPassword = await login("coord", "otra-clave");
        const unknownUser = await login("fantasma", "otra-clave");

        assert.equal(badPassword.status, 401);
        assert.equal(unknownUser.status, 401);
        assert.equal(badPassword.body.message, unknownUser.body.message);
    });

    it("un usuario inactivo no puede entrar", async () => {
        await prisma.user.update({ where: { username: "docente" }, data: { active: false } });

        assert.equal((await login("docente", PASSWORD)).status, 401);
    });

    it("login sin campos = 400 con detalle por campo", async () => {
        const res = await request("POST", "/auth/login", { json: {} });

        assert.equal(res.status, 400);
        assert.deepEqual(res.body.details.map((d) => d.field).sort(), ["password", "username"]);
    });

    it("GET /auth/me devuelve el usuario del token", async () => {
        const res = await request("GET", "/auth/me", { token: tokens.DOCENTE });

        assert.equal(res.body.data.username, "docente");
        assert.equal("passwordHash" in res.body.data, false);
    });

    for (const [name, header] of [
        ["sin encabezado", undefined],
        ["esquema distinto de Bearer", "Basic abc"],
        ["Bearer sin token", "Bearer "],
        ["token basura", "Bearer esto.no.es.un.jwt"],
    ]) {
        it(`rechaza (401): ${name}`, async () => {
            const res = await request("GET", "/students", { headers: header ? { authorization: header } : {} });

            assert.equal(res.status, 401);
        });
    }

    it("rechaza un token firmado con OTRO secreto", async () => {
        const forged = jwt.sign({ role: "ADMIN" }, "otro-secreto-distinto-de-32-caracteres-xx", { subject: "1" });

        assert.equal((await request("GET", "/students", { token: forged })).status, 401);
    });

    it("rechaza un token expirado", async () => {
        const expired = signToken(1, "ADMIN", { expiresIn: -10 });

        const res = await request("GET", "/students", { token: expired });

        assert.equal(res.status, 401);
        assert.match(res.body.message, /expir/i);
    });

    it("rechaza un token 'alg: none' (sin firma)", async () => {
        const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
        const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "1", role: "ADMIN" })}.`;

        assert.equal((await request("GET", "/users", { token: none })).status, 401);
    });

    it("un token válido de un usuario DESACTIVADO deja de servir de inmediato", async () => {
        assert.equal((await request("GET", "/students", { token: tokens.DOCENTE })).status, 200);

        await prisma.user.update({ where: { id: 3 }, data: { active: false } });

        assert.equal((await request("GET", "/students", { token: tokens.DOCENTE })).status, 401);
    });

    it("el rol sale de la BD, no del token: un token que dice ADMIN pero es de un docente NO es admin", async () => {
        const lying = signToken(3, "ADMIN"); // sub = docente

        assert.equal((await request("GET", "/users", { token: lying })).status, 403);
    });

    it("ruta inexistente = 404 en JSON; JSON mal formado = 400", async () => {
        const missing = await request("GET", "/no-existe", { token: tokens.ADMIN });
        assert.equal(missing.status, 404);
        assert.ok(missing.body.message);

        const broken = await request("POST", "/auth/login", { headers: { "content-type": "application/json" }, form: "{mal" });
        assert.equal(broken.status, 400);
    });

    it("los errores no filtran detalles internos (sin stack ni SQL)", async () => {
        const res = await request("GET", "/cases/abc", { token: tokens.ADMIN });

        assert.equal(res.status, 400);
        assert.ok(!JSON.stringify(res.body).match(/prisma|select |stack|node_modules/i));
    });

    it("el health check responde sin token e informa la BD", async () => {
        const res = await request("GET", "/health");

        assert.equal(res.body.data.status, "ok");
        assert.equal(res.body.data.database, "up");
    });
});

describe("CORS", () => {
    before(startServer);
    after(stopServer);

    const preflight = (origin) =>
        request("OPTIONS", "/cases", {
            headers: { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" },
        });

    it("un origen listado recibe cabeceras CORS (con Authorization permitido)", async () => {
        const res = await preflight(env.corsOrigins[0]);

        assert.equal(res.status, 204);
        assert.equal(res.headers.get("access-control-allow-origin"), env.corsOrigins[0]);
        assert.match(res.headers.get("access-control-allow-headers"), /authorization/i);
    });

    it("un origen NO listado no recibe cabeceras CORS y no provoca un 500", async () => {
        const res = await preflight("http://sitio-malicioso.example");

        assert.notEqual(res.status, 500);
        assert.equal(res.headers.get("access-control-allow-origin"), null);
    });
});
