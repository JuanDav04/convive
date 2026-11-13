// tests/documents.test.js — subida, descarga y borrado de archivos
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { FILES, env, fileForm, filesOnDisk, prisma, request, resetAndSeed, startServer, stopServer, tokens } from "./helpers/index.js";

const { ADMIN, COORDINADOR, DOCENTE, DOCENTE2 } = tokens;
const upload = (form, token = COORDINADOR) => request("POST", "/documents", { token, form });
const baseline = [FILES.caseDoc, FILES.studentDoc].sort();

describe("Documentos", () => {
    before(startServer);
    after(stopServer);
    beforeEach(resetAndSeed);

    it("sube una evidencia a un caso: metadatos del contrato, SIN storageKey, archivo con nombre aleatorio", async () => {
        const res = await upload(fileForm({ type: "EVIDENCIA", caseId: 1 }, { name: "foto.png", type: "image/png", content: "PNGDATA" }), DOCENTE);

        assert.equal(res.status, 201);
        const d = res.body.data;
        assert.equal(d.name, "foto.png");
        assert.equal(d.mimeType, "image/png");
        assert.equal(d.sizeBytes, 7);
        assert.equal(d.caseId, 1);
        assert.equal(d.studentId, null);
        assert.equal(d.uploadedBy.fullName, "Docente Prueba");
        assert.equal("storageKey" in d, false);

        const row = await prisma.document.findUnique({ where: { id: d.id } });
        assert.match(row.storageKey, /^[0-9a-f-]{36}$/); // UUID: el nombre original nunca llega al disco
        assert.equal(await fs.readFile(path.join(env.uploadDir, row.storageKey), "utf8"), "PNGDATA");
    });

    it("sube un documento a un estudiante con nombre y descripción propios", async () => {
        const res = await upload(fileForm({ type: "AUTORIZACION", studentId: 1, name: "  Autorización salida ", description: "Firmada" }, { name: "a.pdf", type: "application/pdf" }));

        assert.equal(res.body.data.name, "Autorización salida");
        assert.equal(res.body.data.description, "Firmada");
    });

    it("la lista de estudiante NO incluye las evidencias de sus casos, y viceversa", async () => {
        const student = (await request("GET", "/documents?studentId=1", { token: COORDINADOR })).body.data;
        const caso = (await request("GET", "/documents?caseId=1", { token: COORDINADOR })).body.data;

        assert.deepEqual(student.map((d) => d.id), [2]);
        assert.deepEqual(caso.map((d) => d.id), [1]);
    });

    describe("validaciones al subir", () => {
        it("sin archivo = 400", async () => {
            const form = new FormData();
            form.set("type", "OTRO");
            form.set("studentId", "1");

            assert.equal((await upload(form)).status, 400);
        });

        it("tipo de archivo no permitido = 400 y no queda nada en disco", async () => {
            const res = await upload(fileForm({ type: "OTRO", studentId: 1 }, { name: "virus.exe", type: "application/x-msdownload" }));

            assert.equal(res.status, 400);
            assert.deepEqual(await filesOnDisk(), baseline);
        });

        it("dueño ambiguo o ausente (ambos o ninguno) = 400 sin dejar archivos huérfanos", async () => {
            assert.equal((await upload(fileForm({ type: "OTRO", studentId: 1, caseId: 1 }))).status, 400);
            assert.equal((await upload(fileForm({ type: "OTRO" }))).status, 400);
            assert.deepEqual(await filesOnDisk(), baseline);
        });

        it("tipo de documento inválido, y dueño inexistente = 400 / 404, sin huérfanos", async () => {
            assert.equal((await upload(fileForm({ type: "XX", studentId: 1 }))).status, 400);
            assert.equal((await upload(fileForm({ type: "OTRO", studentId: 999 }))).status, 404);
            assert.equal((await upload(fileForm({ type: "OTRO", caseId: 999 }))).status, 404);
            assert.deepEqual(await filesOnDisk(), baseline);
        });

        it("supera el máximo (MAX_UPLOAD_MB=1) = 413 y no queda archivo parcial", async () => {
            const res = await upload(fileForm({ type: "OTRO", studentId: 1 }, { name: "grande.pdf", type: "application/pdf", content: "x".repeat(1.5 * 1024 * 1024) }));

            assert.equal(res.status, 413);
            assert.match(res.body.message, /1 MB/);
            assert.deepEqual(await filesOnDisk(), baseline);
        });
    });

    describe("quién puede qué", () => {
        it("el docente no puede subir ni ver documentos de un estudiante (403)", async () => {
            assert.equal((await upload(fileForm({ type: "OBSERVADOR", studentId: 1 }), DOCENTE)).status, 403);
            assert.equal((await request("GET", "/documents?studentId=1", { token: DOCENTE })).status, 403);
            assert.deepEqual(await filesOnDisk(), baseline);
        });

        it("el docente no ve ni toca evidencias de casos ajenos (404)", async () => {
            // caso 2 es del coordinador; caso 1 es del docente, no del docente 2
            assert.equal((await upload(fileForm({ type: "EVIDENCIA", caseId: 2 }), DOCENTE)).status, 404);
            assert.equal((await request("GET", "/documents?caseId=1", { token: DOCENTE2 })).status, 404);
            assert.equal((await request("GET", "/documents/1/download", { token: DOCENTE2 })).status, 404);
            assert.equal((await request("DELETE", "/documents/1", { token: DOCENTE2 })).status, 404);
        });

        it("el docente puede borrar su evidencia, no la subida por coordinación", async () => {
            const coordDoc = (await upload(fileForm({ type: "EVIDENCIA", caseId: 1 }), COORDINADOR)).body.data.id;

            assert.equal((await request("DELETE", `/documents/${coordDoc}`, { token: DOCENTE })).status, 403);
            assert.equal((await request("DELETE", "/documents/1", { token: DOCENTE })).status, 200);
        });

        it("listar sin dueño o con ambos = 400", async () => {
            assert.equal((await request("GET", "/documents", { token: ADMIN })).status, 400);
            assert.equal((await request("GET", "/documents?studentId=1&caseId=1", { token: ADMIN })).status, 400);
        });
    });

    describe("descargar y borrar", () => {
        it("descarga el contenido exacto con el nombre original", async () => {
            const res = await request("GET", "/documents/1/download", { token: DOCENTE });

            assert.equal(res.status, 200);
            assert.equal(res.body.toString(), "archivo caso");
            assert.match(res.headers.get("content-disposition"), /evidencia\.txt/);
        });

        it("si el archivo desapareció del disco: 404 en JSON, no un error 500", async () => {
            await fs.rm(path.join(env.uploadDir, FILES.caseDoc));

            const res = await request("GET", "/documents/1/download", { token: ADMIN });

            assert.equal(res.status, 404);
            assert.ok(res.body.message);
        });

        it("borrar elimina la fila Y el archivo; borrar de nuevo = 404", async () => {
            assert.equal((await request("DELETE", "/documents/2", { token: COORDINADOR })).status, 200);

            assert.equal(await prisma.document.count({ where: { id: 2 } }), 0);
            assert.deepEqual(await filesOnDisk(), [FILES.caseDoc]);
            assert.equal((await request("DELETE", "/documents/2", { token: COORDINADOR })).status, 404);
        });

        it("el id de descarga no permite salirse de la carpeta (la ruta se arma con storageKey propio)", async () => {
            await prisma.document.update({ where: { id: 2 }, data: { storageKey: "../../etc/passwd" } });

            const res = await request("GET", "/documents/2/download", { token: ADMIN });

            assert.equal(res.status, 404); // basename('passwd') no existe en uploads
        });
    });
});
