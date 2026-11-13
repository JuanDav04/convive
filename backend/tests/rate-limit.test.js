// tests/rate-limit.test.js — límite de intentos de login
// Va en su propio archivo (= proceso aparte) porque los límites se leen de las
// variables de entorno al cargar la app: aquí se bajan ANTES de importarla.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

process.env.LOGIN_RATE_LIMIT_MAX = "3";

const { PASSWORD, request, resetAndSeed, startServer, stopServer } = await import("./helpers/index.js");

const login = (password) => request("POST", "/auth/login", { json: { username: "coord", password } });

describe("Límite de intentos de login", () => {
    before(async () => {
        await startServer();
        await resetAndSeed();
    });
    after(stopServer);

    it("tras 3 intentos fallidos responde 429 con mensaje (incluso con la contraseña correcta)", async () => {
        for (let i = 0; i < 3; i++) assert.equal((await login("mala")).status, 401);

        const blocked = await login(PASSWORD);

        assert.equal(blocked.status, 429);
        assert.match(blocked.body.message, /Demasiadas solicitudes/);
    });

    it("los límites no afectan a otras rutas", async () => {
        assert.equal((await request("GET", "/health")).status, 200);
    });
});
