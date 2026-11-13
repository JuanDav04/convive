// tests/static-frontend.test.js
// El backend puede servir el build del frontend (un solo servicio en Render):
// archivos estáticos, fallback a index.html para rutas de React Router, y la API
// intacta (un /api desconocido responde JSON, no index.html).
import "./helpers/guard.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";

describe("frontend estático", () => {
    let server, base, dir;

    before(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), "convive-dist-"));
        await fs.writeFile(path.join(dir, "index.html"), "<html><body>CONVIVE-SPA</body></html>");
        await fs.mkdir(path.join(dir, "assets"));
        await fs.writeFile(path.join(dir, "assets", "app.js"), "console.log(1)");
        server = createApp({ frontendDist: dir }).listen(0);
        await once(server, "listening");
        base = `http://localhost:${server.address().port}`;
    });

    after(async () => {
        server.close();
        await fs.rm(dir, { recursive: true, force: true });
    });

    it("sirve index.html en / y en rutas del cliente", async () => {
        for (const p of ["/", "/estudiante/3", "/casos/10/editar"]) {
            const res = await fetch(base + p);
            assert.equal(res.status, 200, p);
            assert.match(await res.text(), /CONVIVE-SPA/);
        }
    });

    it("sirve los assets", async () => {
        const res = await fetch(base + "/assets/app.js");
        assert.equal(res.status, 200);
        assert.equal(await res.text(), "console.log(1)");
    });

    it("la API sigue respondiendo JSON, también los 404", async () => {
        const health = await fetch(base + "/api/health");
        assert.equal(health.status, 200);
        // Sin token la API responde 401 JSON (no el index.html de la SPA).
        const nf = await fetch(base + "/api/no-existe");
        assert.equal(nf.status, 401);
        assert.match(nf.headers.get("content-type"), /json/);
    });

    it("sin frontendDist solo responde la API", async () => {
        const s = createApp({ frontendDist: null }).listen(0);
        await once(s, "listening");
        const res = await fetch(`http://localhost:${s.address().port}/`);
        s.close();
        assert.equal(res.status, 404);
    });
});
